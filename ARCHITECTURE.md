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
| PWA       | `vite-plugin-pwa` (installable, offline app shell)            |
| Hosting   | Cloudflare Pages (static, SPA fallback is built in)           |
| Backend   | Supabase: Postgres, Auth, Realtime, Edge Functions (Deno)     |
| LEGO data | Rebrickable: CSV dump for the catalog, API v3 for inventories |
| Images    | Hot-linked from Rebrickable's CDN (`cdn.rebrickable.com`)     |

There is no custom server. The browser talks to Supabase only.

Claude works in Claude Code's sandbox, set up in `.claude/settings.json`: no
Docker, so the Supabase CLI and browser tests run outside it.

## Data flow

```
Browser ──(supabase-js, user JWT)──► Postgres (RLS)        reads, search, RPCs
        ──(functions.invoke)───────► fetch-set ──► Rebrickable API v3
                                         │ service role: import_set()
                                         ▼
                                     set cache (lego_sets, inventory_lines)
        ◄──(Realtime broadcast, private channel set:<id>)── triggers:
                 `progress` from set_progress, `changed` from sets / set_members

scripts/import-catalog.mjs ──(service role)──► lego_sets   (Rebrickable sets.csv.gz)
```

1. **Catalog and search**: `lego_sets` is seeded from Rebrickable's free CSV dump
   (`scripts/import-catalog.mjs`; rerun it now and then to pick up new sets).
   Search is a plain Postgres query (trigram index on `name`, prefix on
   `set_num`), so it uses none of the Rebrickable API quota.
2. **Set import**: `fetch-set` only accepts sets that are in the catalog (404
   otherwise, without calling Rebrickable). It returns at once if the inventory
   is cached (`lego_sets.parts_fetched_at` set). Before calling Rebrickable it
   calls `claim_import`. That function atomically applies the per-user hourly
   limit and a global cap of 200 imports per hour, and refuses a second import
   of the same set within 3 minutes. A failed import calls `release_import`,
   so it can be retried at once; the attempt still counts towards the limits. Each Rebrickable
   request has a 45 s timeout, because part details make Rebrickable slow
   (about 40 ms per inventory line, fetched in pages of 500), and the whole
   import has a 110 s budget (free Edge Functions stop at 150 s). Otherwise it reads everything from the API
   first: the set, its parts, its minifigs, and each minifig's parts. Then it
   writes it all in **one** `import_set(set, parts)` call (service role only).
   `import_set` takes a per-set advisory lock and merges rows that share a line
   key, summing their quantities (Rebrickable can list the same part and color
   twice). It inserts with `on conflict do nothing` and stamps
   `parts_fetched_at` last. Once a set is imported, its
   inventory is **immutable**: `set_progress` references `inventory_lines.id`, so
   rows are never updated, deleted or re-keyed.
3. **Checking**: the UI shows one card per **part** (part number + color). A part can be backed
   by several inventory lines: the set's own line, minifig lines, and a spare
   line. A tap calls `adjust_part(set, part_num, color_id, delta)`. Increments
   fill the set line first, then minifig lines, then spares; decrements undo in
   reverse order. The function locks the part's rows, always in `line_id`
   order, so concurrent taps neither lose counts nor deadlock. It returns the
   part's lines as `{line_id, found_qty, updated_at}`, the same fields a
   broadcast carries (a broadcast adds `updated_by`). Clients never write `set_progress` directly. A retried call
   applies its delta again, which is accepted for taps. A complete set is
   not frozen: a piece found later can still be counted.
4. **Live sync**: a trigger on `set_progress` sends a `progress` broadcast
   (`{line_id, found_qty, updated_at, updated_by}`) to the **private** Realtime channel
   `set:<id>`. RLS policies on `realtime.messages` let only members of the
   set receive broadcasts and send presence there. A `changed` broadcast
   (from triggers on `sets` and `set_members`) tells open pages to refresh
   the summary. A removed member's page then finds no set and shows "not
   found". There is **one channel per
   set** in the client: `SetLayout` (the `/sets/:id` layout route) calls
   `useSet` once and shares it with its child pages through `SetContext`.
   The inventory (`set_lines`) is loaded once per visit. Phones drop sockets
   when the screen locks, so on (re)subscribe and on `visibilitychange` the
   client refetches **only** the progress (`set_progress`: id, count,
   timestamp) and the summary. Overlapping refreshes are merged into one.

## Data model

| Table / view           | Purpose                                                               | Written by                                                                                          |
| ---------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `profiles`             | display name and avatar per auth user (the email is never exposed)    | trigger on `auth.users`, the user themselves                                                        |
| `lego_sets`            | set catalog and metadata                                              | catalog script, `import_set` (service role)                                                         |
| `inventory_lines`      | cached inventory lines                                                | `import_set` (service role)                                                                         |
| `set_import_log`       | Rebrickable fetches per user, for rate limiting                       | `fetch-set` (service role)                                                                          |
| `sets`                 | one physical set being checked: a copy of a catalog set (GLOSSARY.md) | owner insert; `title` by helpers                                                                    |
| `set_members`          | who can see or edit a set (`owner`, `helper`, `viewer`)               | trigger (owner), `accept_invite` RPC; role changes and removals by the owner; leaving by the member |
| `set_progress`         | `found_qty` per (set, inventory line); a missing row means 0          | `adjust_part` RPC only                                                                              |
| `set_invites`          | invite tokens                                                         | the owner                                                                                           |
| `set_removals`         | who the owner removed, and when                                       | trigger on `set_members` delete                                                                     |
| `set_lines` (view)     | every line that counts for a set, with `found_qty`                    | —                                                                                                   |
| `set_summaries` (view) | per set: catalog set info, my role, needed, found                     | —                                                                                                   |

An inventory line (`inventory_lines`) is unique on
`(set_num, part_num, color_id, is_spare, fig_num)` with `NULLS NOT DISTINCT`.
`fig_num` is null for the set's own parts. For minifig parts it holds the
minifig, and the quantity is already multiplied by the number of copies of that
minifig in the set. Lines also store the BrickLink part and color ids for export.

**Counting rule**: `include_spares` and `include_minifigs` are fixed when a
set is created; there is no update grant on them. The rule that decides which
lines count is the SQL function `line_counts`. Only `set_lines` and
`adjust_part` use it. The client never re-implements it: it reads `set_lines`
and groups them by part and color.

## Security rules

- RLS is enabled on every public table. `anon` has no privileges in `public`.
  Default privileges keep it that way for future tables, sequences and
  functions, and a pgTAP test checks it.
- The membership functions (`my_set_ids()`, `set_role_of`, `is_set_member`,
  `is_set_helper`, `is_set_owner`, `shares_set_with`) are `security
definer` with `search_path = ''` so that policies don't recurse into
  `set_members`. Row policies use `set_id in (select my_set_ids())`, which
  is evaluated once per query rather than once per row.
- Any logged-in user can read the set cache. Only the service role can write it.
- `sets`, `set_members`, `set_progress` and the views are readable by
  members only. Views are `security_invoker = true`.
- `profiles` are readable by the user themselves and by people they share a
  set with.
- Column-level grants limit writes: updates to `sets(title)`,
  `set_members(role)` and `profiles(display_name)`, and inserts
  to `set_invites(set_id, role, expires_at)`. Invites expire within 30 days.
- Every `security definer` function sets `search_path = ''`, checks permissions
  explicitly, and checks that its input belongs together (for example, that a
  part belongs to the set's catalog set). Trigger functions get no execute grant.
- The Rebrickable key exists only as an Edge Function secret
  (`REBRICKABLE_API_KEY`). It never appears in `VITE_*` variables or client code.
- **Realtime limitation**: Realtime checks the channel policies when a client
  joins (and on token refresh), not for each message. A removed member whose
  client stays connected and ignores the `changed` event could keep receiving
  broadcasts until the token expires (`jwt_expiry`, 1 h). Our client leaves
  the channel as soon as it notices.
- `avatar_url` is set only from the OAuth provider at signup; users cannot
  change it (no tracking pixels for co-members).
- Migrations grant what the app needs to `authenticated` explicitly instead of
  relying on platform default privileges.
- Edge Functions run with `verify_jwt = false` and verify the caller in code
  (`_shared/auth.ts`, `auth.getClaims()`), rejecting anyone who isn't an
  authenticated, non-anonymous user. With asymmetric JWTs the check is local, so
  a signed-out token stays valid until it expires. `fetch-set` limits each user
  to 30 Rebrickable imports per hour (`claim_import`, `set_import_log`).
- Functions prefer a new-style secret key (`BRICKCHECK_SECRET_KEY` function
  secret; the `SUPABASE_` prefix is reserved) and fall back to the legacy
  `SUPABASE_SERVICE_ROLE_KEY`.

## Routes

| Path                | Page              | Notes                                                                                              |
| ------------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `/login`            | Login             | magic link, 6-digit code, or Google; returns to the requested path                                 |
| `/`                 | MySets            | my sets; asks email users for a display name once                                                  |
| `/missing`          | MissingAcrossSets | every Part still missing in your Sets, where it goes, tick it off there (loaded on open, not live) |
| `/new`              | AddSet            | catalog search → `fetch-set` → create set                                                          |
| `/join/:token`      | Join              | invite preview → `accept_invite`                                                                   |
| `/sets/:id`         | SetLayout         | owns `useSet` (one channel, presence) for its children                                             |
| `/sets/:id` (index) | SetPage           | the grid of part cards                                                                             |
| `/sets/:id/missing` | Missing           | missing list and exports                                                                           |
| `/sets/:id/people`  | Share             | members, roles, invite links, leave or delete                                                      |

Everything except `/login` is behind `RequireAuth`.

## Frontend conventions

```
src/
  lib/supabase.ts   the one supabase client
  lib/api.ts        ALL data access (queries, RPCs, function calls, realtime)
  lib/types.ts      domain types shared by api, hooks and UI
  lib/parts.ts      pure logic: grouping lines into parts, missing list, exports (unit-tested)
  lib/theme.ts      light/dark preference (localStorage) and the `dark` class
  hooks/            React state built on lib/api and lib/theme (useAuth, useSet, useTheme, ...)
  pages/            route components
  components/       presentational components; no data fetching
```

- **Presence**: the set channel only tracks the user's id; presence keys are
  chosen by clients, so they are never trusted for names. `useSet` loads the
  member list (again on every `changed` broadcast) and exposes `online` and
  `others` as members whose id is present. A `changed` broadcast also bumps
  `version`, which other views (invites) depend on.
- **Lost access**: when a refresh finds no set (deleted, or we were removed),
  `useSet` shows "not found" and leaves the channel.
- **Name first**: `RequireAuth` asks users without a display name for one
  before showing any page, including the join page.
- **Login**: the login email carries a link and a 6-digit code
  (`supabase/templates/login.html`). The code matters for the installed iOS
  PWA, where the link opens Safari instead of the app.
- Pages and components never import `supabase` directly. They go through
  `lib/api.ts`, usually via a hook. Components don't fetch data; the one
  exception is `AuthProvider`, which holds app-level session state.
- Database row types are written by hand in `lib/types.ts` for now. Switch to
  `supabase gen types` once a linked project exists.
- **Recovery** (`useSet`):
  - A tap times out after 10 s; a timeout takes the normal failure path.
  - A refresh requested while one runs schedules exactly one more run.
  - A failed first load is redone in full on the next reconnect or
    visibility change.
  - Background refresh errors are logged, not shown.
  - Async results from an earlier mount are discarded (generation counter).
  - A channel that is still leaving is awaited before the same topic is
    joined again.
- **Optimistic taps** (`useSet`):
  - A part's card shows the server's count plus its unacknowledged deltas.
  - Each part has at most one `adjust_part` call in flight. Taps made
    meanwhile are summed and sent next, so +1/−1 corrections apply in order.
  - While a part's call is in flight, server values for that part (broadcasts,
    refetches) are held back. They are applied together with the call's
    result, so a delta is never counted twice.
  - Server values are kept per line with `updated_at`. A value older than the
    one held is ignored.
  - A failed call drops its delta, shows the error and refetches progress.
- **Stable layout**: the grid's order and filtering are computed from a
  snapshot of the parts, which is refreshed 1.5 s after the last change (at
  most 5 s after the first deferred one), or at once when the filter or sort
  changes. Cards don't jump under your thumb while
  you tap. `PartCard` re-renders only when its counts change.
- Every list read is paginated until a page comes back empty, whatever the
  server's `max_rows`.
- Mobile first: touch targets are at least 44px, and the app is usable one-handed.
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and
  optionally `VITE_PUBLIC_URL`. Function secrets: `REBRICKABLE_API_KEY`,
  `BRICKCHECK_SECRET_KEY`, `ALLOWED_ORIGINS` (comma-separated, `*` wildcards).
- **Theme**: `dark:` styles follow a `dark` class on `<html>`. It follows the
  system setting unless the user picks Light or Dark (the button on My sets),
  a per-device preference in `localStorage`. An inline script in `index.html`
  applies it before the first paint; `lib/theme.ts` keeps it applied.
- **Errors**: routes have an error page with a Reload button, and a failed
  lazy chunk load (after a deploy) reloads the page into the new version.
- **PWA** (`vite.config.ts`):
  - The service worker precaches the app shell, and every navigation falls
    back to `index.html`, so deep links and invite links open offline.
  - Nothing is cached at runtime. Supabase (API, auth, realtime) must never
    be. Rebrickable images send no CORS headers, so a service worker could
    only store them as opaque responses, which count about 7 MB each against
    the quota. The browser's HTTP cache keeps them instead (the CDN sends
    `max-age=31536000`), and that also works offline.
  - Login uses the implicit flow (tokens in the URL hash), which the fallback
    leaves alone.
  - The installed app checks for a new version every hour.
  - Icons: `scripts/icons.mjs` (`npm run icons`) generates every icon in
    `public/` from one logo definition: `favicon.svg` and the manifest icons
    with rounded corners, plus full-bleed `apple-touch-icon.png` and
    `maskable-512x512.png`, which iOS and Android mask themselves. The logo
    fits Android's safe zone at full size.
  - In the installed app (`display-mode: standalone`) the login page offers
    only email, because OAuth would finish in Safari, outside the app.
  - Updates use `registerType: 'prompt'`: `UpdatePrompt` asks before
    reloading, because a reload would drop taps in flight.
  - Routes other than login and My sets are lazy-loaded. React and Supabase
    are separate chunks, so an app update only re-downloads app code.
- Invite links use `VITE_PUBLIC_URL` when it is set, so links made on a preview
  deploy point at production.

## Edge Functions

`supabase/functions/<name>/index.ts` (Deno). Shared code lives in
`supabase/functions/_shared/` (CORS, auth check, Rebrickable client with 429
back-off).

## Invites

- The owner creates an invite: a random uuid token, a role of `helper` or
  `viewer`, and an expiry (7 days by default). The owner can revoke it by
  deleting it.
- `accept_invite(token)` (security definer) works only for an unexpired token.
  If the user isn't a member yet, it adds them with the invite's role. If they
  already are, it never changes or downgrades their role, and it can never
  grant `owner`. It returns the set id.
- `/join/<token>` survives login: the path is kept and passed as
  `emailRedirectTo` / `redirectTo`. Only same-origin paths are accepted.
- `invite_preview(token)` shows the set, its catalog set and the inviter before joining.
- Members can leave a set. The owner can remove members, change their roles,
  or delete the set.
- A removal is recorded in `set_removals`. Links created before the removal
  no longer work for that person (neither preview nor accept); a newer link
  does, and accepting it clears the record. Leaving on your own isn't recorded.

## Deployment notes

Step-by-step instructions are in `DEPLOY.md`.

- **Hosted Realtime**: turn off "Allow public access" (private channels only).
- **Hosted auth**: set `site_url` to the Pages domain. Add the Pages domain and
  `https://*.<project>.pages.dev/**` to the redirect URLs. Do **not** run
  `supabase config push`, which would push the local `localhost` settings.
- **Email**: Supabase's built-in SMTP only sends to team members and is heavily
  rate-limited. Use a free SMTP provider for magic links: Brevo works with a
  single verified sender address, while Resend needs a domain you own. Add a
  CAPTCHA (Cloudflare Turnstile) to sign-in once the app is public.
- **Free tier**: a project with no activity for a week is paused. The
  twice-weekly catalog refresh (`.github/workflows/catalog.yml`) prevents that.
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
