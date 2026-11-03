# BrickCheck architecture

BrickCheck is a mobile-first PWA for checking a LEGO set against a pile of loose
pieces: pick a set, tap each part as you find it, end with the list of missing
pieces. Several users can check the same set live, each on their own phone.

This document is the reference for every change and every review. If a change
deliberately departs from it, update this document in the same commit.

## Stack (all free tiers)

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Frontend  | React + Vite + TypeScript, Tailwind CSS v4, react-router      |
| PWA       | `vite-plugin-pwa` (phase 3)                                   |
| Hosting   | Cloudflare Pages (static, SPA fallback is built in)           |
| Backend   | Supabase: Postgres, Auth, Realtime, Edge Functions (Deno)     |
| LEGO data | Rebrickable: CSV dump for the catalog, API v3 for inventories |
| Images    | Hot-linked from Rebrickable's CDN (`cdn.rebrickable.com`)     |

There is no custom server. The browser talks to Supabase only.

## Data flow

```
Browser ──(supabase-js, user JWT)──► Postgres (RLS)        reads, search, RPCs
        ──(functions.invoke)───────► fetch-set ──► Rebrickable API v3
                                         │ service role: import_set()
                                         ▼
                                     set cache (lego_sets, set_parts)
        ◄──(Realtime broadcast, private channel check:<id>)── trigger on check_progress

scripts/import-catalog.mjs ──(service role)──► lego_sets   (Rebrickable sets.csv.gz)
```

1. **Catalog and search**: `lego_sets` is seeded from Rebrickable's free CSV dump
   (`scripts/import-catalog.mjs`; rerun it now and then to pick up new sets).
   Search is a plain Postgres query (trigram index on `name`, prefix on
   `set_num`), so it uses none of the Rebrickable API quota.
2. **Set import**: `fetch-set` only accepts sets that are in the catalog (404
   otherwise, without calling Rebrickable). It returns at once if the inventory
   is cached (`lego_sets.parts_fetched_at` set). Before calling Rebrickable it
   calls `claim_import`, which atomically applies the per-user hourly limit and
   refuses a second import of the same set within 3 minutes. Each Rebrickable
   request has a 10 s timeout, and the whole import has a 110 s budget (free
   Edge Functions stop at 150 s). Otherwise it reads everything from the API
   first: the set, its parts, its minifigs, and each minifig's parts. Then it
   writes it all in **one** `import_set(set, parts)` call (service role only).
   `import_set` takes a per-set advisory lock and merges rows that share a line
   key, summing their quantities (Rebrickable can list the same part and color
   twice). It inserts with `on conflict do nothing` and stamps
   `parts_fetched_at` last. Once a set is imported, its
   inventory is **immutable**: `check_progress` references `set_parts.id`, so
   rows are never updated, deleted or re-keyed.
3. **Checking**: the UI shows one tile per **part + color**. A tile can be backed
   by several inventory lines: the set's own line, minifig lines, and a spare
   line. A tap calls `adjust_part(check, part_num, color_id, delta)`. Increments
   fill the set line first, then minifig lines, then spares; decrements undo in
   reverse order. The function locks the tile's rows, always in `set_part_id`
   order, so concurrent taps neither lose counts nor deadlock. It returns the
   tile's lines as `{set_part_id, found_qty, updated_at}`, the same fields a
   broadcast carries (a broadcast adds `updated_by`). Clients never write `check_progress` directly. A retried call
   applies its delta again, which is accepted for taps. A complete check is
   not frozen: a piece found later can still be counted.
4. **Live sync**: a trigger on `check_progress` sends a `progress` broadcast
   (`{set_part_id, found_qty, updated_at, updated_by}`) to the **private** Realtime channel
   `check:<id>`. RLS policies on `realtime.messages` let only members of the
   check receive broadcasts and send presence there. Phones drop sockets when
   the screen locks, so clients refetch all lines on (re)subscribe and on
   `visibilitychange`.

## Data model

| Table / view             | Purpose                                                            | Written by                                     |
| ------------------------ | ------------------------------------------------------------------ | ---------------------------------------------- |
| `profiles`               | display name and avatar per auth user (the email is never exposed) | trigger on `auth.users`, the user themselves   |
| `lego_sets`              | set catalog and metadata                                           | catalog script, `import_set` (service role)    |
| `set_parts`              | cached inventory lines                                             | `import_set` (service role)                    |
| `set_import_log`         | Rebrickable fetches per user, for rate limiting                    | `fetch-set` (service role)                     |
| `checks`                 | one sorting session of one physical copy of a set                  | owner insert; `title` by helpers               |
| `check_members`          | who can see or edit a check (`owner`, `helper`, `viewer`)          | trigger (owner), `accept_invite` RPC (phase 2) |
| `check_progress`         | `found_qty` per (check, set_part); a missing row means 0           | `adjust_part` RPC only                         |
| `check_invites`          | invite tokens                                                      | the owner                                      |
| `check_lines` (view)     | every line that counts for a check, with `found_qty`               | —                                              |
| `check_summaries` (view) | per check: set info, my role, needed, found                        | —                                              |

An inventory line (`set_parts`) is unique on
`(set_num, part_num, color_id, is_spare, fig_num)` with `NULLS NOT DISTINCT`.
`fig_num` is null for the set's own parts. For minifig parts it holds the
minifig, and the quantity is already multiplied by the number of copies of that
minifig in the set. Lines also store the BrickLink part and color ids for export.

**Counting rule**: `include_spares` and `include_minifigs` are fixed when a
check is created; there is no update grant on them. The rule that decides which
lines count is the SQL function `line_counts`. Only `check_lines` and
`adjust_part` use it. The client never re-implements it: it reads `check_lines`
and groups them by part and color.

## Security rules

- RLS is enabled on every public table. `anon` has no privileges in `public`.
  Default privileges keep it that way for future tables, sequences and
  functions, and a pgTAP test checks it.
- The membership functions (`my_check_ids()`, `check_role_of`, `is_check_member`,
  `is_check_helper`, `is_check_owner`, `shares_check_with`) are `security
definer` with `search_path = ''` so that policies don't recurse into
  `check_members`. Row policies use `check_id in (select my_check_ids())`, which
  is evaluated once per query rather than once per row.
- Any logged-in user can read the set cache. Only the service role can write it.
- `checks`, `check_members`, `check_progress` and the views are readable by
  members only. Views are `security_invoker = true`.
- `profiles` are readable by the user themselves and by people they share a
  check with.
- Column-level grants limit writes: updates to `checks(title)`,
  `check_members(role)` and `profiles(display_name, avatar_url)`, and inserts
  to `check_invites(check_id, role, expires_at)`. Invites expire within 30 days.
- Every `security definer` function sets `search_path = ''`, checks permissions
  explicitly, and checks that its input belongs together (for example, that a
  part belongs to the check's set). Trigger functions get no execute grant.
- The Rebrickable key exists only as an Edge Function secret
  (`REBRICKABLE_API_KEY`). It never appears in `VITE_*` variables or client code.
- Edge Functions run with `verify_jwt = false` and verify the caller in code
  (`_shared/auth.ts`, `auth.getClaims()`), rejecting anyone who isn't an
  authenticated, non-anonymous user. With asymmetric JWTs the check is local, so
  a signed-out token stays valid until it expires. `fetch-set` limits each user
  to 30 Rebrickable imports per hour (`claim_import`, `set_import_log`).
- Functions prefer a new-style secret key (`SUPABASE_SECRET_KEY` function
  secret) and fall back to the legacy `SUPABASE_SERVICE_ROLE_KEY`.

## Frontend conventions

```
src/
  lib/supabase.ts   the one supabase client
  lib/api.ts        ALL data access (queries, RPCs, function calls, realtime)
  lib/types.ts      domain types shared by api, hooks and UI
  lib/tiles.ts      pure logic: grouping lines into tiles, missing list, exports (unit-tested)
  hooks/            React state built on lib/api (useAuth, useCheck, ...)
  pages/            route components
  components/       presentational components; no data fetching
```

- Pages and components never import `supabase` directly. They go through
  `lib/api.ts`, usually via a hook. Components don't fetch data; the one
  exception is `AuthProvider`, which holds app-level session state.
- Database row types are written by hand in `lib/types.ts` for now. Switch to
  `supabase gen types` once a linked project exists.
- **Optimistic taps**: a tile shows the server's count plus the deltas still in
  flight. Server values are kept per line together with `updated_at`. An RPC
  result, a broadcast or a refetch replaces a line only if it is not older than
  what is held. A delta leaves the pending list once its own RPC call returns.
- Mobile first: touch targets are at least 44px, and the app is usable one-handed.
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- The PWA service worker (phase 3) must not cache Supabase API or auth callback
  URLs.

## Edge Functions

`supabase/functions/<name>/index.ts` (Deno). Shared code lives in
`supabase/functions/_shared/` (CORS, auth check, Rebrickable client with 429
back-off).

## Invites (phase 2)

- The owner creates an invite: a random uuid token, a role of `helper` or
  `viewer`, and an expiry (7 days by default). The owner can revoke it by
  deleting it.
- `accept_invite(token)` (security definer) works only for an unexpired token.
  If the user isn't a member yet, it adds them with the invite's role. If they
  already are, it never changes or downgrades their role, and it can never
  grant `owner`. It returns the check id.
- `/join/<token>` survives login: the path is kept and passed as
  `emailRedirectTo` / `redirectTo`.
- Members can leave a check. The owner can remove members, change their roles,
  or delete the check.

## Deployment notes

- **Hosted auth**: set `site_url` to the Pages domain. Add the Pages domain and
  `https://*.<project>.pages.dev/**` to the redirect URLs. Do **not** run
  `supabase config push`, which would push the local `localhost` settings.
- **Email**: Supabase's built-in SMTP only sends to team members and is heavily
  rate-limited. Use a free SMTP provider (Resend or Brevo) for magic links, and
  add a CAPTCHA (Cloudflare Turnstile) to sign-in once the app is public.
- **Free tier**: a project with no activity for a week is paused. A scheduled
  ping prevents that if needed.
- **Testing on a phone**: Vite listens on the LAN (`server.host`). Add the LAN
  URL to `additional_redirect_urls` so magic links work on the phone.

## Known limitations

- Rebrickable throttling is per function invocation. Imports of different sets
  running at the same time can briefly exceed 1 req/s on the shared key. That
  is fine at hobby scale; a queue would fix it.
- Sets for which Rebrickable has no inventory are not cached, so asking again
  costs one API call.

- Sets that contain other sets (Rebrickable `/sets/{id}/sets/`) only import the
  parent set's own parts and minifigs.
