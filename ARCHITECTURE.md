# BrickCheck architecture

BrickCheck is a mobile-first PWA for checking a LEGO set against a pile of loose
pieces: pick a set, tap each part as you find it, end with the list of missing
pieces. Several users can check the same set live, each on their own phone.

This document is the reference for every change and every review. If a change
deliberately departs from it, update this document in the same commit.

## Stack (all free tiers)

| Layer     | Choice                                                    |
| --------- | --------------------------------------------------------- |
| Frontend  | React + Vite + TypeScript, Tailwind CSS v4, react-router  |
| PWA       | `vite-plugin-pwa` (phase 3)                               |
| Hosting   | Cloudflare Pages (static, SPA fallback is built in)       |
| Backend   | Supabase: Postgres, Auth, Realtime, Edge Functions (Deno) |
| LEGO data | Rebrickable API v3, only ever called from Edge Functions  |
| Images    | Hot-linked from Rebrickable's CDN (`cdn.rebrickable.com`) |

There is no custom server. The browser talks to Supabase only.

## Data flow

```
Browser ──(supabase-js, user JWT)──► Postgres (RLS)          reads, RPCs
        ──(functions.invoke)───────► Edge Function ──► Rebrickable API
                                         │ service role
                                         ▼
                                     Postgres cache (lego_sets, set_parts)
        ◄──(Realtime postgres_changes on check_progress)──
```

1. **Set search**: `search-sets` proxies Rebrickable search. It writes nothing.
2. **Set import**: `fetch-set` returns at once if the set's inventory is already
   cached (`lego_sets.parts_fetched_at` set). Otherwise it fetches the set, its
   parts, its minifigs and each minifig's parts, upserts them with the service
   role, and stamps `parts_fetched_at` last. A cached inventory is **immutable**:
   `check_progress` references `set_parts.id`, so rows are never deleted or
   re-keyed.
3. **Checking**: every tap calls the `adjust_found` RPC. Clients never write
   `check_progress` directly.
4. **Live sync**: clients subscribe to `postgres_changes` on `check_progress`
   filtered by `check_id`. Realtime enforces the table's SELECT policy, and
   presence uses a Realtime channel named `check:<id>`.

## Data model

| Table            | Purpose                                                   | Written by                                   |
| ---------------- | --------------------------------------------------------- | -------------------------------------------- |
| `profiles`       | display name and avatar per auth user                     | trigger on `auth.users`, the user themselves |
| `lego_sets`      | cached set metadata                                       | `fetch-set` (service role)                   |
| `set_parts`      | cached inventory lines                                    | `fetch-set` (service role)                   |
| `checks`         | one sorting session of one physical copy of a set         | owner insert; `title` by helpers             |
| `check_members`  | who can see or edit a check (`owner`, `helper`, `viewer`) | trigger (owner), `accept_invite` RPC         |
| `check_progress` | `found_qty` per (check, set_part)                         | `adjust_found` RPC only                      |
| `check_invites`  | invite tokens                                             | the owner                                    |

An inventory line (`set_parts`) is unique on
`(set_num, part_num, color_id, is_spare, fig_num)`. `fig_num` is null for the
set's own parts. For minifig parts it holds the minifig, and the quantity is
already multiplied by the number of copies of that minifig in the set.

Each check stores `include_spares` and `include_minifigs`. Which lines count is
computed from those flags: in SQL (`check_summaries` view, `adjust_found`) and in
`src/lib/progress.ts` on the client. Both must apply the same rule.

## Security rules

- RLS is enabled on every public table. Two functions, `is_check_member(check_id)`
  and `is_check_helper(check_id)`, are `security definer` with
  `search_path = ''` so that policies don't recurse into `check_members`.
- Any logged-in user can read the set cache. Only the service role can write it.
- `checks`, `check_members` and `check_progress` are readable by members only.
- Every `security definer` function sets `search_path = ''`, checks permissions
  explicitly, and checks that its input belongs together (for example, that the
  set_part belongs to the check's set).
- The Rebrickable key exists only as an Edge Function secret
  (`REBRICKABLE_API_KEY`). It never appears in `VITE_*` variables or client code.
- Edge Functions require a valid user JWT, so anonymous traffic can't use up
  our Rebrickable quota.

## Frontend conventions

```
src/
  lib/supabase.ts   the one supabase client
  lib/api.ts        ALL data access (queries, RPCs, function calls, realtime)
  lib/types.ts      domain types shared by api, hooks and UI
  lib/progress.ts   pure logic (counting rules, missing list, exports), unit-tested
  hooks/            React state built on lib/api (useAuth, useCheck, ...)
  pages/            route components
  components/       presentational components; no data fetching
```

- Pages and components never import `supabase` directly. They go through
  `lib/api.ts`, usually via a hook.
- Database row types are written by hand in `lib/types.ts` for now. Switch to
  `supabase gen types` once a linked project exists.
- Taps update the UI optimistically. The value returned by the RPC, or the next
  realtime event, replaces it.
- Mobile first: touch targets are at least 44px, and the app is usable one-handed.
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Edge Functions

`supabase/functions/<name>/index.ts` (Deno). Shared code lives in
`supabase/functions/_shared/` (CORS, the Rebrickable client with 429 back-off,
the auth check).
