# BrickCheck architecture

BrickCheck is a mobile-first PWA for checking a LEGO set against a pile of loose
pieces: pick a set, tap each part as you find it, end with the list of missing
pieces. Several users can check the same set live, each on their own phone.

This document is the reference for every change and every review. If a change
deliberately departs from it, update this document in the same commit.
`CLAUDE.md` says which sections to read for which kind of change.

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
   of the same set within 3 minutes. It also deletes `set_import_log` rows
   older than 7 days, so the log stays small. A failed import calls `release_import`, so
   it can be retried at once; the attempt still counts towards the limits. Each
   Rebrickable request has a 45 s timeout, because part details make Rebrickable
   slow (about 40 ms per inventory line, fetched in pages of 500), and the whole
   import has a 110 s budget (free Edge Functions stop at 150 s). Otherwise it
   reads everything from the API first: the set, its parts, its minifigs, and
   each minifig's parts. Then it writes it all in **one** call to
   `import_set(set, parts)` (service role only). `import_set` takes a per-set
   advisory lock and merges rows that share a line key, summing their
   quantities (Rebrickable can list the same part and color twice). It inserts
   with `on conflict do nothing` and stamps `parts_fetched_at` last. Once a set
   is imported, its inventory is **immutable**: `set_progress` references
   `inventory_lines.id`, so rows are never updated, deleted or re-keyed.
3. **Checking**: the UI shows one card per **part** (part number + color). A part can be backed
   by several inventory lines: the set's own line, minifig lines, and a spare
   line. A tap calls `adjust_part(set, part_num, color_id, delta)`. Increments
   fill the set line first, then minifig lines, then spares; decrements undo in
   reverse order. The function locks the part's rows, always in `line_id`
   order, so concurrent taps neither lose counts nor deadlock. It returns the
   part's lines as `{line_id, found_qty, updated_at}`, the same fields a
   broadcast carries (a broadcast adds `updated_by`). Clients never write `set_progress` directly. A retried call
   applies its delta again, which is accepted for taps. A complete set is
   not frozen: a piece found later can still be counted. The owner can reset
   all counts: `reset_set_progress(set)` (owner only) sets every `found_qty` to
   0, keeping the rows, and sends one `changed` broadcast instead of a
   `progress` per row (the progress trigger skips its broadcast while it runs),
   so every open page refetches the progress. Moving a Set into or out of a
   Group (`move_set_to_group`) updates `sets` (and `set_members` when moving
   out), so the usual `changed` broadcast goes out on `set:<id>`: open pages
   refresh the summary, and someone who lost access finds no Set. My sets and
   Missing across sets read `set_summaries` through RLS, so they show a moved
   Set on the next load (on open and when the app becomes visible again); they
   have no channel of their own.
4. **Live sync**: a trigger on `set_progress` sends a `progress` broadcast
   (`{line_id, found_qty, updated_at, updated_by}`) to the **private** Realtime channel
   `set:<id>`. RLS policies on `realtime.messages` let only members of the
   set (per-Set or through its Group) receive broadcasts and send presence there. A `changed` broadcast
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

| Table / view           | Purpose                                                               | Written by                                                                                             |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `profiles`             | display name and avatar per auth user (the email is never exposed)    | trigger on `auth.users`, the user themselves                                                           |
| `lego_sets`            | set catalog and metadata                                              | catalog script, `import_set` (service role)                                                            |
| `inventory_lines`      | cached inventory lines                                                | `import_set` (service role)                                                                            |
| `set_import_log`       | Rebrickable fetches per user, for rate limiting                       | `fetch-set` (service role)                                                                             |
| `sets`                 | one physical set being checked: a copy of a catalog set (GLOSSARY.md) | owner insert; `title` by helpers                                                                       |
| `set_members`          | who can see or edit a set (`owner`, `helper`, `viewer`)               | trigger (owner), `accept_invite` RPC; role changes and removals by the owner; leaving by the member    |
| `set_progress`         | `found_qty` per (set, inventory line); a missing row means 0          | `adjust_part` and `reset_set_progress` RPCs only                                                       |
| `set_invites`          | invite tokens                                                         | the owner                                                                                              |
| `set_removals`         | who the owner removed, and when                                       | trigger on `set_members` delete                                                                        |
| `groups`               | a named set of people sharing access to its Sets (GLOSSARY.md)        | `create_group` RPC; `name` by the Group's Owners                                                       |
| `group_members`        | who is in a Group (`owner`, `helper`, `viewer`)                       | trigger (creator as Owner), `accept_group_invite` RPC; role changes and removals by the Group's Owners |
| `group_invites`        | Group invite tokens                                                   | the Group's Owners                                                                                     |
| `group_removals`       | who an Owner removed from a Group, and when                           | trigger on `group_members` delete                                                                      |
| `set_lines` (view)     | every line that counts for a set, with `found_qty`                    | —                                                                                                      |
| `set_summaries` (view) | per set: catalog set info, my effective role, needed, found, Group    | —                                                                                                      |

**Groups** (ADR 0001): `sets.group_id` is an optional reference to a Group (a Set
is in at most one; `on delete restrict`, so a Group with Sets can't be deleted).
Access is **derived**: the membership helpers take Group membership into
account when access is checked, and nothing is copied into `set_members`. The
effective role on a Set is the highest of the per-Set role and the Group role
(`set_role_of` takes `min()` of the `owner, helper, viewer` enum), and a Group
Owner is an Owner of every Set in the Group. A Group role never shows up in
`set_members`; `set_summaries.my_role` is the effective role, and `group_name`
is null for someone who can read the Set but not the Group. `create_group(name)`
is the only way to create a Group (no insert grant): it makes the creator the
Owner, and a trigger caps each person at 10 created Groups (error code `54000`,
serialised per person with an advisory lock). Only Group Owners can rename, and
a trigger stores the name trimmed. A
Set can be given a Group at creation if its creator is an Owner or Helper of
that Group (`sets_before_insert`). A `before insert` trigger on `group_members`
caps a Group at 20 members (error code `54000`, serialised per Group with an
advisory lock). Group invites are described under _Invites_. A trigger on
`group_members` (insert, update, delete) sends the usual `changed` broadcast to
the channel of each of the Group's Sets, so open pages refresh when someone
joins, changes role or is removed.
**Moving Sets**: `sets.group_id` has no update
grant, so `move_set_to_group(set, group)` (`group` null moves out) is the only
way to change it. Moving in needs an Owner of the Set (effective role) who is an
Owner or Helper of the target Group, and a Set already in a Group must be moved
out first (error `55000`). Moving out needs an Owner of the Set (its adder, or an
Owner of its Group), and the caller becomes a per-Set Owner (the one place a
Group change writes `set_members`; an existing lower per-Set role is raised).
Everyone with access only through the Group loses it at once, and per-Set
members keep their roles. Not allowed and not found both raise `42501`.
**Managing members**: Owners
update `group_members.role` (promote to Owner, or change to Helper or Viewer;
only that column is updatable) and delete rows (remove any member, another
Owner or themselves) directly, through RLS. Two triggers hold the rules that
must not depend on who makes the change, so leaving reuses them: the
**last-Owner rule** lives in `group_members_guard_last_owner` (before update of
`role` or delete; error `23514`, "A group needs at least one owner. Promote
another member to owner first."; serialised per Group with an advisory lock;
skipped when the Group or the person's profile is already being deleted), and
`group_members_drop_adder_access` (after delete) removes the person's per-Set
Owner row, which adding a Set gave them, on Sets they added in that Group.
Their Sets stay in the Group, and they lose access to them. When a role is
lowered, `group_members_lower_adder_access` (after update of `role`) lowers that
same per-Set row to the new role, so a Helper demoted to Viewer cannot still tick
off parts or delete the Sets they added (raising a role restores nothing). Other per-Set
members, and Sets they added outside the Group, are untouched. The `sets`
read rule lets an adder read their own row only while they can still reach it
(not in a Group, or still in it). Removal is recorded by
`record_group_removal` (see _Invites_). **Leaving**: any member deletes their
own `group_members` row (policy "group_members: leave"), so both triggers above
apply as for a removal: the last Owner cannot leave (`23514`), and Sets the
leaver added stay in the Group while they lose access (unless someone gave them
a per-Set role, which is kept). Leaving is not recorded as a removal. The UI
warns first and offers `move_set_to_group(set, null)` for the Sets they added.
**Deleting a Group**: Owners only (policy "groups: owner deletes"), and only
when it has no Sets. `groups_before_delete` (security definer, so Sets the
Owner cannot read still count) raises `55000` ("A group with sets cannot be
deleted. Move or delete its sets first.") before the `on delete restrict`
foreign key would raise a raw violation. Deleting cascades to members, invites
and removals.

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
  `is_set_helper`, `is_set_owner`, `shares_set_with`) are `security definer`
  with `search_path = ''` so that policies don't recurse into `set_members`.
  They also consider Groups (`my_group_ids()`, `group_role_of`,
  `is_group_owner` are the Group equivalents), so policies and the Realtime
  channel policies, which only call the helpers, cover Group members without
  changes. `sets` deletion follows `is_set_owner`, so a Group Owner can delete a
  Group's Sets. `groups` and `group_members` are readable by the Group's
  members only. `group_invites` is readable, creatable (`group_id`, `role`,
  `expires_at` columns only) and deletable by the Group's Owners only;
  `group_removals` has no policies and no grants (security definer functions
  only). Invites expire within 30 days and never carry the `owner` role.
  `move_set_to_group` is `security definer`, executable by `authenticated` only,
  and checks `is_set_owner` and the caller's Group role itself.
  `group_members` can be updated (`role` column only) and deleted by the
  Group's Owners only, and any member can delete their own row (leave). The
  last Owner cannot be demoted, removed or leave (`group_members_guard_last_owner`,
  whoever does it). `groups` can be deleted by the Group's Owners only, and not
  while the Group has Sets (`groups_before_delete`).
  Row policies use `set_id in (select my_set_ids())`, which is evaluated once
  per query rather than once per row.
- Any logged-in user can read the set cache. Only the service role can write it.
- `sets`, `set_members`, `set_progress` and the views are readable by
  members only. Views are `security_invoker = true`.
- `profiles` are readable by the user themselves and by people they share a
  set or a Group with (`shares_set_with`; a Group counts before it has Sets).
  Email is never in `profiles`, so Group members never see it.
- Only the owner can reset a set's counts (`reset_set_progress`, which checks
  `is_set_owner`); helpers can still correct single parts with taps.
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
- **Browser headers** (`public/_headers`, served by Cloudflare Pages): `nosniff`,
  a strict referrer policy, a minimal `Permissions-Policy`, `X-Frame-Options`,
  HSTS, `Cross-Origin-Opener-Policy: same-origin` and a
  Content-Security-Policy that allows only our own files, Supabase
  (`https` and `wss`), Cloudflare Turnstile, Rebrickable images and Google
  avatars. No inline scripts exist, so the CSP needs no `unsafe-inline` for
  scripts; styles keep it because React sets `style` attributes. A new third-party
  origin (script, frame, image, API) must be added to the CSP in the same commit.
- Edge Functions run with `verify_jwt = false` and verify the caller in code
  (`_shared/auth.ts`, `auth.getClaims()`), rejecting anyone who isn't an
  authenticated, non-anonymous user. With asymmetric JWTs the check is local, so
  a signed-out token stays valid until it expires. `fetch-set` limits each user
  to 30 Rebrickable imports per hour (`claim_import`, `set_import_log`).
- Functions prefer a new-style secret key (`BRICKCHECK_SECRET_KEY` function
  secret; the `SUPABASE_` prefix is reserved) and fall back to the legacy
  `SUPABASE_SERVICE_ROLE_KEY`.

## Routes

| Path                 | Page              | Notes                                                                                                                                                                                                                                                                                                               |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`             | Login             | magic link, 6-digit code, passkey, or Google; returns to the requested path                                                                                                                                                                                                                                         |
| `/`                  | Home              | the start screen: cards for My sets, Groups and "Where does this piece go?", each with a status line; the avatar (Account) and theme button; asks email users for a display name once                                                                                                                               |
| `/sets`              | MySets            | my sets, with a Group label and a Group filter                                                                                                                                                                                                                                                                      |
| `/groups`            | Groups            | create, list and rename (Owners) your Groups, show their members and roles, change roles, promote and remove members (Owners), create and revoke Group invites (Owners), leave (with a warning listing the Sets you added and a Move out button for each) and delete (Owners, only when empty); linked from My sets |
| `/account`           | Account           | your display name (editable), login email (read-only), passkeys, sign out; opened from the avatar on the start screen                                                                                                                                                                                               |
| `/missing`           | MissingAcrossSets | every Part still missing in your Sets, where it goes, tick it off there (loaded on open, not live)                                                                                                                                                                                                                  |
| `/new`               | AddSet            | catalog search → `fetch-set` → create set, with an optional Group (where you are Owner or Helper)                                                                                                                                                                                                                   |
| `/join/:token`       | Join              | invite preview → `accept_invite`                                                                                                                                                                                                                                                                                    |
| `/join/group/:token` | JoinGroup         | Group invite preview → `accept_group_invite`, then the Groups page                                                                                                                                                                                                                                                  |
| `/sets/:id`          | SetLayout         | owns `useSet` (one channel, presence) for its children                                                                                                                                                                                                                                                              |
| `/sets/:id` (index)  | SetPage           | the grid of part cards; the header icon opens Manage and shows who is online instead when others are                                                                                                                                                                                                                |
| `/sets/:id/missing`  | Missing           | missing list and exports                                                                                                                                                                                                                                                                                            |
| `/sets/:id/manage`   | Manage            | Manage: Group (move in or out), members, members through the Group, roles, invite links, reset counts, leave or delete                                                                                                                                                                                              |

Everything except `/login` is behind `RequireAuth`.

## Frontend conventions

### Structure

```
src/
  lib/supabase.ts   the one supabase client
  lib/api.ts        ALL data access (queries, RPCs, function calls, realtime); import everything from here
  lib/auth.ts       sign-in methods, passkeys, session and own profile; part of api.ts, which re-exports it
  lib/errors.ts     ApiError and fail(), shared by api.ts and auth.ts
  lib/captcha.ts    the public Turnstile site key (VITE_TURNSTILE_SITE_KEY), if set
  lib/types.ts      domain types shared by api, hooks and UI
  lib/parts.ts      pure logic: grouping lines into parts, missing list, exports (unit-tested)
  lib/theme.ts      light/dark preference (localStorage) and the `dark` class
  lib/i18n.ts       translations: t(), plurals, language choice, date and number formats (unit-tested)
  lib/messages/     the texts: en/<area>.ts (source), nl/<area>.ts (translation), one index each
  hooks/            React state built on lib/api and lib/theme (useAuth, useSet, useTheme, ...);
                    useCaptcha wraps the Turnstile widget and token lifecycle
  pages/            route components
  components/       presentational components; no data fetching
```

- Pages and components never import `supabase` directly. They go through
  `lib/api.ts`, usually via a hook. Components don't fetch data; the one
  exception is `AuthProvider`, which holds app-level session state.
- Database row types are written by hand in `lib/types.ts`.
  `supabase gen types` could generate them now that the project is linked.
- Every list read is paginated until a page comes back empty, whatever the
  server's `max_rows`.
- **Groups in the UI**: My sets is one list of every Set I can see, whatever
  the access path. A Set in a Group shows a "Group: name" chip, and a Group
  select (shown when some Set has a Group) filters by All, Not in a group, or
  one Group. The options come from the loaded Sets, so a Group appears once
  one of its Sets does. AddSet and Manage list only Groups where I am Owner or
  Helper (from `useGroups`). Manage's Group section (Owners of the Set) moves
  the Set in or out through `moveSetToGroup`; a separate "Through the group"
  list shows the Group's members read-only, marked "· group", so they are not
  mistaken for per-Set members (those are the only ones with role controls).
  The list is empty for someone who cannot read the Group. Manage fetches
  `useGroups` only for an Owner of a Set that is in no Group, and shows "Leave
  set" only to people with a per-Set row (`set_members`): someone with access
  only through the Group is pointed to the Groups page, where they leave the
  Group. My sets resets its filter to All when the chosen Group is no longer an
  option, and AddSet drops a chosen Group that is no longer a valid target.
  JoinGroup shows "invalid or expired" only when the invite is not found; other
  errors get their own message and a retry button.
- **Start screen** (`/`): login and the "page not found" fallback land here.
  Its three cards link to My sets (`/sets`), Groups and Missing in all sets, and
  show a status line built from data the app already loads (`useMySets`,
  `useGroups`), so it needs no new queries. Back arrows go to the screen you
  came from: Groups, Missing in all sets, Account and the join pages go back to
  the start screen; Add a set and the Set pages go back to My sets.
- **Selects** use `Select` (`components/ui.tsx`), which sets a fixed height and
  draws its own arrow: iOS Safari ignores `min-height` on a native select and
  draws it too short for the 44px touch target.
- **My sets keeps its last list** in memory, per user (`useMySets`). Coming back
  to the page shows it at once and refreshes it in the background, so there is no
  spinner on a revisit. Pictures are never cached by the app: the browser's HTTP
  cache serves them (see `vite.config.ts`).
- Mobile first: touch targets are at least 44px, and the app is usable one-handed.
- **Accessibility** (WCAG 2.2 AA): `Header` moves focus to the page's `<h1>`
  when a page opens (unless a field already has focus, like the catalog
  search), so screen readers announce the new page. `Spinner` is a
  `role="status"` with a hidden "Loading" label; `ProgressBar` has a name and a
  text value. Secondary text is `text-neutral-500 dark:text-neutral-400`.
  Transitions stop with `prefers-reduced-motion`; the spinner only slows down.
  The picture zoom works with Enter and Space as well as taps.
- Environment variables are documented where they are used: `.env.example`
  (frontend), `supabase/.env.example` (local function secrets) and `DEPLOY.md`
  (hosted). The hosted function secrets are `REBRICKABLE_API_KEY`,
  `BRICKCHECK_SECRET_KEY` and `ALLOWED_ORIGINS` (comma-separated, `*`
  wildcards).
- **Theme**: `dark:` styles follow a `dark` class on `<html>`. It follows the
  system setting unless the user picks Light or Dark (the button on the start screen),
  a per-device preference in `localStorage`. `public/theme-init.js` (a blocking script
  in `index.html`) applies it before the first paint; `lib/theme.ts` keeps it applied.
- **Languages** (English and Dutch; `lib/i18n.ts`, `lib/messages/`): no library.
  English is the source. `messages/en/<area>.ts` defines every key (`area.screen.item`,
  e.g. `account.name.label`), grouped by screen or area, one file per area, merged in
  `en/index.ts`; `messages/nl/` mirrors it, and its type (`Messages`) fails the build
  when a key has no Dutch text. Add texts to your own area's file only (new area:
  one file in each folder plus one import and spread line in each index). A text is a
  string with `{placeholders}`, or a plural object (`{ one, other }`, the forms
  `Intl.PluralRules` needs for the language) that needs a `count` param. Components
  call `const { t, date, number } = useLanguage()` and write `t("account.save")`,
  `t("sets.count", { count })`; never build "1 set" / "2 sets" by hand, and never
  translate Rebrickable names (set, part, color, minifigure). Numbers follow
  the language (1,234 in English, 1.234 in Dutch): `t()` formats every numeric param
  itself (strings are left alone, so pass a part number or id as a string), and
  `number()` formats a number printed outside `t()` (the found/needed counts). `date()`
  formats a date: English uses the browser's locale (so a US reader gets 11/3/2026),
  Dutch `nl-NL`; `dayMonth()` is the always day-first "3 Nov" of the "started" label.
  No `toLocaleDateString()`.
  **Punctuation**: a text that is a sentence (a hint, a message, a question)
  ends with a full stop, `?` or `!`, in every language. Titles, labels, buttons,
  placeholders, short status lines and fragments (a list such as "Heads, torsos,
  legs") do not. Error texts follow the same rule, each on its own merits:
  "Only an owner can delete the group." is a sentence, "Invalid delta" a fragment,
  and a Dutch text is judged as Dutch ("Je bent niet ingelogd." for the fragment
  "Not logged in"). No semicolons in a text: use two sentences.
  A key missing in a language shows the English text. Each language is one lazily
  loaded chunk (`import("./messages/nl")`), precached by the service worker (the
  `js` glob). `LanguageProvider` (in `main.tsx`, around the app) loads the chunk of
  the language before the first render (until then a neutral "Loading / Laden"
  spinner; after 4 seconds it gives up and shows English, keeping the saved choice
  for the next visit), keeps `<html lang>` in step and updates every
  screen on a change without reload. `setLanguage()` keeps the last choice: a slower, earlier
  load never overrides a later one. When the chunk cannot load (offline, not cached) it
  rejects and the language stays; the Account page shows `account.language.failed` in
  a `role="alert"`. Code outside React reads `getActiveLanguage()`,
  but pure helpers in `lib/parts.ts` take the text they need from the caller (the
  start-date label of `missingAcrossSets`), so it follows the language. The language is the saved choice (`localStorage` key
  `language`, set by the picker on the Account page, per device) or else the browser's
  (Dutch if it starts with `nl`, otherwise English). The picker lists each language
  in its own name. The PWA manifest stays English, and the e2e flow pins its browser
  locale to `en`. Tests (`lib/i18n.test.ts`) check plurals, fallback, language choice
  and key and placeholder parity of English and Dutch. To add a language: a
  `messages/<lang>/` folder, a `LANGUAGES` and `loadMessages` entry in `lib/i18n.ts`,
  a locale in `LOCALES`, and its parity test case.
  **Server errors** are translated in `lib/errors.ts`, not in the screens. The
  English text of every `errors.*` key (`messages/en/errors.ts`) is a message the
  database (`raise exception`), an Edge Function or `lib/api.ts` raises, word for
  word except for the final full stop a sentence text has and the server leaves off
  (a final full stop is ignored when matching). A known message shows the text of
  its key, English included, so the texts decide the punctuation; any other message,
  such as a Supabase auth error, shows as it came;
  `{placeholders}` match a value in the message (the database's `%`). `ApiError`'s
  constructor (so `fail()` too) runs the message through `translateError()` with
  `getActiveLanguage()`, so every screen that shows `error.message` shows it in the
  language in use, with no change at the call sites. The language can only change on
  the Account page, so that page is the one place an error can outlive a change: it
  keeps its own error with the language it was written in and shows it only in that
  language, and its passkeys section is keyed by language, so its error is dropped.
  An empty message becomes the generic text of the language in use. A message that matches nothing, or has no Dutch text, shows
  as it came (English), never blank. The Dutch error texts are imported statically
  (a few lines) because `fail()` is synchronous and cannot wait for the language
  chunk. A new `raise exception` or `HttpError` needs an `errors.*` key in both
  languages; `lib/errors.test.ts` reads the migrations and Edge Functions and fails
  when a message has no Dutch text or a key matches nothing any more. Auth
  messages from Supabase and the WebAuthn (passkey) errors stay as they are sent
  (English or the browser's own language); the CAPTCHA component's own two messages
  are translated (`login.captcha.*`).
- **Errors**: routes have an error page with a Reload button, and a failed
  lazy chunk load (after a deploy) reloads the page into the new version.
- Invite links use `VITE_PUBLIC_URL` when it is set, so links made on a preview
  deploy point at production.

### The set page (`useSet`)

- **Presence**: the set channel only tracks the user's id; presence keys are
  chosen by clients, so they are never trusted for names. `useSet` loads the
  member list (again on every `changed` broadcast) and exposes `online` and
  `others` as members whose id is present. A `changed` broadcast also bumps
  `version`, which other views (invites) depend on.
- **Lost access**: when a refresh finds no set (deleted, or we were removed),
  `useSet` shows "not found" and leaves the channel.
- **Recovery**:
  - A tap times out after 10 s; a timeout takes the normal failure path.
  - A refresh requested while one runs schedules exactly one more run.
  - A failed first load is redone in full on the next reconnect or
    visibility change.
  - Background refresh errors are logged, not shown.
  - Async results from an earlier mount are discarded (generation counter).
  - A channel that is still leaving is awaited before the same topic is
    joined again.
- **Optimistic taps**:
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
  snapshot of the parts. Cards never move on their own: a completed card stays
  where it is (green, dimmed) so a tap always lands on the card you aimed at,
  also after a pause. The snapshot is refreshed when the filter or sort
  changes, when the number of parts changes (first load), or when the user
  presses "Update order", a floating button that appears only while a fresh
  layout would differ. `PartCard` re-renders only when its counts change.
- **Card size**: a card shows the element id (the number in the manual's parts
  list, `partNumber()`; the part number when Rebrickable has none), not the name
  (the name stays in search, labels and the enlarged picture). The grid fits as
  many cards per row as have room at 6.5rem or wider (`auto-fill`): three on a
  phone, more on bigger screens. Text is compact. The count sits on the picture's
  bottom-left corner and the "−" button on its bottom-right, both marks 28px in a
  44px touch target, so a card is just the picture, the number and the color. The
  "minifig" and "spare" labels sit on the picture's top-left corner.
- **Tick feedback** (`TickToast`, `useRecentTick`): each tick shows a bar at the
  bottom with the part's picture, a short summary and Undo, for 4 seconds or
  until the next tick, because a finger resting on a card hides the card itself.
  On the Set page the summary is the new count ("4/5"); on Missing in all sets it
  is the Set the piece went to, shown only once the tick is saved. Screen readers
  get the full sentence from a hidden text in the `role="status"` region. Undo
  sends a −1 for that part through the normal path. Un-ticking with "−" clears
  the bar on the Set page. The 10 ms vibration of `useSet.tap` stays.
- **Header on the Set page** (`Header` with `hideOnScroll`, `useHideOnScroll`): it
  slides out of view on a short scroll down and then stays out however you
  scroll, because looking for a piece means scrolling up and down for a while and
  a header that comes and goes is distracting. It returns near the top of the
  page, while a text field has focus (a scroll of more than about 200px hides
  it anyway, so a field left focused cannot pin it), or from a round button at
  the bottom right (`common.showFilters`); the next scroll down hides it again. It moves with a
  transform, so the layout never shifts, and it is `inert` while hidden. Other
  pages keep a plain sticky header.
- **Filter bar** (`FilterBar`): the search field, then three 44px icon-only
  controls (`filterButtonClass`): sort (a native `<select>` laid transparently
  over the sort icon, so the system picker opens), color and hide found (a toggle
  with `aria-pressed`). Each has an `aria-label`. The fields keep the browser's
  16px text: iOS Safari zooms the page when a field with smaller text takes
  focus, so they must not shrink.
- **Color filter** (`ColorFilter`): an icon-only button, a palette or, once a
  color is chosen, its swatch with a heavier outline. It opens a full-screen
  native `<dialog>` with a swatch grid and a search by name; "All colors" in it
  clears the choice. The Set page and Missing in all sets share it. Colors in the
  picker, like the "Color" sort, are ordered by name.

### Login and account

- **Name first**: `RequireAuth` asks users without a display name for one
  before showing any page, including the join page. If the profile can't be
  loaded it shows the error with a retry button instead of letting the person
  in nameless. Only the newest profile request sets state, so a slow reply
  after a sign-out or account switch is ignored.
- **Login email**: it carries a link and a 6-digit code
  (`supabase/templates/login.html`). The code matters for the installed iOS
  PWA, where the link opens Safari instead of the app. The template is a
  table-based HTML email with inline styles (mail clients ignore most CSS),
  light and dark colors, and the app icon loaded from `{{ .SiteURL }}`, so
  the logo only shows once the Auth Site URL is the deployed address.
- **Installed app**: in `display-mode: standalone` the login page hides
  Google, because OAuth would finish in Safari, outside the app. Email and
  passkeys stay.
- **Passkeys** (Supabase Auth, beta; `supabase.auth.signInWithPasskey`,
  `registerPasskey`, `passkey.*`, on by default in the installed
  `supabase-js`): the account page lists, adds and removes the user's
  passkeys (`hooks/usePasskeys.ts`), and the login page has a "Log in with a
  passkey" button, shown wherever `PublicKeyCredential` exists, including the
  installed iOS app. Dismissing the browser prompt is not an error. The button
  sends the CAPTCHA token like the email form does. A passkey is bound to the
  domain it was created on, so moving the app to another domain makes existing
  passkeys unusable; users fall back to an email code and add a new one.
- **CAPTCHA**: when `VITE_TURNSTILE_SITE_KEY` is set, the login form shows a
  Cloudflare Turnstile widget (`components/Turnstile.tsx`, "interaction-only":
  invisible unless Cloudflare wants a click) and sends its token as
  `captchaToken` with `signInWithOtp` and the passkey login. `hooks/useCaptcha`
  hides the lifecycle: the page renders its `widget`, disables buttons while
  `pending`, and wraps each protected request in `use(token => ...)`, which
  fetches a fresh token afterwards because a token works once. Without the key
  (local development, e2e) there is no widget and no token, which matches the
  local stack, where CAPTCHA is off. Google sign-in and `verifyOtp` don't send
  one. Don't turn CAPTCHA on in Supabase before a build with the site key is
  live, or email login stops working.

### PWA (`vite.config.ts`)

- The service worker precaches the app shell, and every navigation falls
  back to `index.html`, so deep links and invite links open offline.
- Nothing is cached at runtime. Supabase (API, auth, realtime) must never
  be. Rebrickable images send no CORS headers, so a service worker could
  only store them as opaque responses, which count about 7 MB each against
  the quota. The browser's HTTP cache keeps them instead (the CDN sends
  `max-age=31536000`), and that also works offline.
- Login uses the implicit flow (tokens in the URL hash), which the fallback
  leaves alone.
- Links to the app: the manifest has `id`, `scope` and
  `launch_handler: navigate-existing`. Android Chrome then opens in-scope
  links in the installed app and Chromium desktop reuses the open window.
  iOS has no way to send a link to a home-screen app; it always opens in
  Safari, which is why the login email also carries a code.
- Manifest: standalone display with no orientation lock (the OS decides, so
  tablets and landscape phones work), `categories`, and two long-press
  `shortcuts` (Add a set, Missing in all sets). `theme_color` stays the brand
  red in both themes. There are no `screenshots`: they only feed Chrome's
  richer install dialog and need real images.
- Offline: the app shell opens without a connection, and `OfflineBanner`
  (inside `Header`, and on Login) says "You're offline" while
  `navigator.onLine` is false (`hooks/useOnline`). Data calls still fail with
  their usual error.
- The installed app checks for a new version every hour. Updates use
  `registerType: 'prompt'`: `UpdatePrompt` asks before reloading, because a
  reload would drop taps in flight.
- Icons: `scripts/icons.mjs` (`npm run icons`) generates every icon in
  `public/` from one logo definition: `favicon.svg` and the manifest icons
  with rounded corners, plus full-bleed `apple-touch-icon.png` and
  `maskable-512x512.png`, which iOS and Android mask themselves. The logo
  fits Android's safe zone at full size.
- Routes other than login, the start screen and My sets are lazy-loaded. React and Supabase
  are separate chunks, so an app update only re-downloads app code.

## Code style

Prettier formats everything with its default options, plus
`prettier-plugin-tailwindcss` for class order (`.prettierrc.json`); don't
hand-format or add overrides. oxlint (`.oxlintrc.json`) enforces `interface`
for object shapes (`type` for unions and aliases), no `any`, `import type`,
braces on every `if`, `else`, `for` and `while`, and the `jsx-a11y` accessibility
rules (except `prefer-tag-over-role`, which would swap our styled `div`s for
`<progress>` and `<output>`). `npm run lint` fails on warnings. TypeScript runs
with `strict` and `noUncheckedIndexedAccess`, so indexing an array gives
`T | undefined`. SQL migrations, email
templates, `public/` and lock files are skipped by Prettier (`.prettierignore`).

What no tool decides:

- TypeScript everywhere in `src`; the scripts in `scripts/` and `e2e/` are
  plain ES modules (`.mjs`).
- Deno code (`supabase/functions`) imports local files with their `.ts`
  extension and packages by the bare names in `deno.json`.

## Edge Functions

`supabase/functions/<name>/index.ts` (Deno). Shared code lives in
`supabase/functions/_shared/` (CORS, auth check, Rebrickable client with 429
back-off).

`supabase/functions/deno.json` is the shared Deno config. Its `imports` map
pins npm dependencies (e.g. `@supabase/supabase-js`), and functions import them
by bare specifier, not an inline `npm:` prefix. `nodeModulesDir: "none"` keeps
Deno on its own cache instead of the repo's `node_modules`. The library is
pinned to an exact version (`@2.118.0`, the version the frontend is tested
with); Dependabot doesn't update `deno.json`, so bump it by hand with the
frontend's version. `lock: false` means
there is no `deno.lock`: the editor's Deno would pin newer package versions
than the Supabase Edge Runtime can resolve, and `functions serve` fails on it.

CORS (`_shared/http.ts`): the function answers only origins in `ALLOWED_ORIGINS`
(comma-separated, `*` wildcards). When it is unset, only local origins
(`localhost`, `127.0.0.1` and private-network addresses such as a phone on the
LAN) are allowed, never the public web, so a hosted project that forgot the
secret fails visibly instead of answering every site. Every call is also
JWT-checked.

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
  reset all counts, or delete the set.
- A removal is recorded in `set_removals`. Links created before the removal
  no longer work for that person (neither preview nor accept); a newer link
  does, and accepting it clears the record. Leaving on your own isn't recorded.

### Group invites

They mirror the per-Set Invites, for a Group (`group_invites`, `group_removals`).

- A Group Owner creates one: a random uuid token, a role of `helper` or
  `viewer` (never `owner`), and an expiry (7 days by default, 30 at most). An
  Owner can revoke it by deleting it. Non-Owners and non-members can neither
  read nor create them.
- `accept_group_invite(token)` works only for an unexpired token. An existing
  member is returned the Group id with their role untouched (no downgrade, no
  upgrade, even when the Group is full); otherwise the user is added with the
  invite's role. The 20-member cap is enforced by the trigger on `group_members`
  (error `54000`). Removals work as for Sets (`group_removals`): when an Owner
  removes someone (a delete on `group_members` by another user, recorded by a
  trigger), links created before the removal no longer work for that person
  (neither preview nor accept); a newer link does, and accepting it clears the
  record. Leaving on your own (any member can, see _Data model_), and deleting a
  Group or an account, are not recorded, so an older link still works for
  someone who left. Deleting a Group removes its invites. A removal also ends access to the Group's Sets at once, and open
  pages get the refresh broadcast.
- `group_invite_preview(token)` shows the Group name, the inviter and whether
  you are already a member, with no row for an invalid token.
- `/join/group/<token>` survives login like `/join/<token>`; after joining the
  app opens the Groups page.

## Deployment notes

Step-by-step instructions are in `DEPLOY.md`.

- **Hosted Realtime**: turn off "Allow public access" (private channels only).
- **Hosted auth**: set `site_url` to the Pages domain. Add the Pages domain and
  `https://*.<project>.pages.dev/**` to the redirect URLs. Do **not** run
  `supabase config push`, which would push the local `localhost` settings.
- **Email**: Supabase's built-in SMTP only sends to team members and is heavily
  rate-limited. Use a free SMTP provider for magic links, sending from a domain
  whose DNS you control (it need not serve the app); `DEPLOY.md` has the Brevo
  setup. Turn on CAPTCHA (Cloudflare Turnstile, see Login) once the app is
  public.
- **Free tier**: a project with no activity for a week is paused. The
  twice-weekly catalog refresh (`.github/workflows/catalog.yml`) prevents that.
- **Testing on a phone**: Vite listens on the LAN (`server.host`). Add the LAN
  URL to `additional_redirect_urls` so magic links work on the phone.

## Standards and gaps

Where the code stands against current industry standards, from an audit on
2026-11-07 (WCAG 2.2 AA, OWASP, GitHub Actions hardening, Supabase's production
checklist and database advisors, GDPR). The audit checked the code with
measurements where it could: strictness flags, lint runs, SQL and contrast
maths. Nothing here stops the app from working. Fix gaps before a wider launch,
in this order, and delete an entry when it is fixed.

Met, so keep it that way:

- TypeScript runs with `strict` (the default in TypeScript 7),
  `noUncheckedIndexedAccess`, `verbatimModuleSyntax` and `erasableSyntaxOnly`.
- Every table has RLS with `to authenticated` policies, and policies write
  `(select auth.uid())`. Every `security definer` function sets
  `search_path = ''`. Views are `security_invoker`. pgTAP tests cover denied
  access. Foreign keys have indexes.
- CI: workflow actions are pinned to commit SHAs, checkout keeps no
  credentials, the catalog job installs without scripts (a secret is in
  scope), jobs have timeouts and concurrency, `npm audit` runs on the
  production dependencies, and Dependabot proposes npm and action updates
  weekly.
- Security headers include an enforced Content-Security-Policy (see Security
  rules). The Cloudflare Turnstile frame logs its own CSP and `eval` errors in
  the console; they come from Cloudflare's page, not from ours.
- No cookies or tracking. `localStorage` only holds the theme and the language.

Gaps, highest impact first:

1. **Backups**: the free Supabase plan has none and no point-in-time recovery.
   Fix: a weekly `supabase db dump` workflow, or the Pro plan, and a dump
   before every `db push`. Roll back with a new corrective migration.
2. **Privacy**: no privacy policy page, although email, name and avatar are
   stored and IP addresses reach Cloudflare and Rebrickable. Fix: a static
   `/privacy` page linked from Login, naming Supabase, Cloudflare, Rebrickable
   and Google.
3. **Account deletion and export**: no "delete my account" (GDPR Art. 17 and 20).
   Deleting an owner deletes their sets for everyone. Fix for now: a manual
   procedure in `DEPLOY.md`; later a `delete-account` Edge Function.
4. **Accessibility is untested by hand**: the contrast, focus, label and
   motion fixes are checked by arithmetic and lint, not with VoiceOver,
   TalkBack, a keyboard or Lighthouse. Do a pass before a wider launch.
5. **Tests**: only `lib/parts.ts` is unit-tested. Hooks, `api.ts` error mapping
   and components are not, there is no coverage report, and CI skips
   `test:pwa`. Fix: add vitest coverage, tests for `lib/errors.ts` and the
   `useSet` sync logic, and a `test:pwa` CI step.
6. **Performance**: the part grid is not virtualised (matters around 5000
   parts), the search box is not deferred, images lack `decoding="async"`.
   Measure on a phone before changing.
7. **Monitoring**: none. `RouteError` shows a message but logs nothing. Fix:
   `console.error` it now; error reporting (with consent) later.

## Known limitations

- The membership helper functions live in the `public` schema, so the Supabase
  database advisor's lint 0029 fires for them. Accepted: they only return the
  caller's own data.
- The global cap of 200 imports per hour is shared by all users, so a few
  accounts importing at their per-user limit can exhaust it.
- Rebrickable throttling is per function invocation. Imports of different sets
  running at the same time can briefly exceed 1 req/s on the shared key. That
  is fine at hobby scale; a queue would fix it.
- Sets for which Rebrickable has no inventory are not cached, so asking again
  costs one API call.
- Sets that contain other sets (Rebrickable `/sets/{id}/sets/`) only import the
  parent set's own parts and minifigs.
