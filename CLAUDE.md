# BrickCheck

Mobile-first PWA to check LEGO sets piece by piece, collaboratively. The design is in `ARCHITECTURE.md`, the domain words in `GLOSSARY.md`.

## Before changing code

`ARCHITECTURE.md` is the reference for every change and every review. Read the sections for the area you touch, and update them in the same commit when a change departs from them:

- Database, RLS, RPCs, migrations: _Data flow_, _Data model_, _Security rules_
- Edge Functions: _Edge Functions_, _Security rules_, _Invites_
- `src/` (pages, hooks, components): _Routes_, _Frontend conventions_, _Code style_
- Login, passkeys, CAPTCHA, PWA: _Frontend conventions_
- Hosting, auth settings, environment: _Deployment notes_, then `DEPLOY.md`
- Any area: _Standards and gaps_ lists known deviations from industry standards; don't add new ones, and delete an entry when you fix it

## Commands

Before committing, run `npm run lint`, `npm run format:check`, `npm test` and `npm run build`. CI runs the same, plus `npm run test:db`.

- `npm run format` and `npx oxlint --fix`: fix style (run `--fix` twice for nested cases, then format)
- `npm run dev`: needs `.env.local` (see `.env.example`)
- `npm run test:db`: pgTAP tests in `supabase/tests/database`
- `npx supabase start`, `db reset` and `functions serve`: the local stack (Docker)
- `npm run smoke`, `e2e` and `seed-demo -- <email>` run only against the local stack. They read its URL and keys from `npx supabase status` (`scripts/local-stack.mjs`). `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` override that, so unset a production key left in your shell. `smoke` needs `functions serve`; `e2e` needs `functions serve`, `npm run dev` and Google Chrome.
- `npm run test:pwa`: needs `npm run build`, then `npx vite preview --port 4173`
- `npm run import-catalog`: seeds `lego_sets` from Rebrickable's CSV (needs `SUPABASE_URL`, `SUPABASE_SECRET_KEY`)
- `npm run icons`: regenerates every icon in `public/` from `scripts/icons.mjs`; edit the logo there, never the icon files
- Deploying: `DEPLOY.md`

## Rules

- All data access goes through `src/lib/api.ts`.
- Call the Rebrickable API only from Edge Functions.
- New tables get RLS policies in the same migration.
- Migrations are deployed to the hosted project: add a new migration, never edit an existing one.
- In migrations, index every new foreign key, write `(select auth.uid())` in policies, and give every `security definer` function `set search_path = ''`.
- A new third-party origin (script, frame, image or API) goes into the Content-Security-Policy in `public/_headers` in the same commit.
- UI follows WCAG 2.2 AA: pair `text-neutral-500` with `dark:text-neutral-400`, label every control, keep 44px touch targets, and announce status with `role="status"` or `role="alert"`.
- Commit messages follow Conventional Commits: `type(scope): summary`, lower case and imperative, with details in the body. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`, `perf`, `style`. Scopes are optional, e.g. `db`, `functions`, `ui`, `sync`, `pwa`.

## Sandbox

Claude works in Claude Code's sandbox (`.claude/settings.json`), which has no Docker. The Supabase CLI, `test:db`, `smoke` and `e2e` run outside it.

## Agent skills

### Issue tracker

GitHub Issues on `dylankiss/brickcheck`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
