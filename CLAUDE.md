# BrickCheck

Mobile-first PWA to check LEGO sets piece by piece, collaboratively.
Read `ARCHITECTURE.md` before changing anything; keep it up to date.

## Commands

- `npm run dev`: Vite dev server (needs `.env.local`, see `.env.example`)
- `npm run build`: type-check and build
- `npm run lint`: oxlint
- `npm test`: vitest (pure logic in `src/lib`)
- `npm run test:db`: pgTAP tests in `supabase/tests/database`
- `npx supabase start` / `npx supabase db reset`: local stack (Docker)
- `npx supabase functions serve`: run Edge Functions locally
- `npm run import-catalog`: seed `lego_sets` from Rebrickable's CSV (needs `SUPABASE_URL`, `SUPABASE_SECRET_KEY`)
- `npm run icons`: regenerate every icon in `public/` from the logo in `scripts/icons.mjs`; don't edit the icon files by hand
- `npm run seed-demo -- <email>`: a demo catalog set and three Sets for that user on the local stack (needs `SUPABASE_SECRET_KEY` and `.env.local`)
- `npm run smoke`: API smoke test against the local stack
- `npm run e2e`: browser test of checking a set (local stack + `npm run dev`, uses Google Chrome)
- `npm run test:pwa`: PWA test (manifest, service worker, offline) against `npx vite preview --port 4173`
- Deploying: see `DEPLOY.md`

## Rules

- All data access goes through `src/lib/api.ts`.
- The Rebrickable API is called only from Edge Functions.
- New tables need RLS policies in the same migration.
- Never edit a deployed migration; add a new one. (Nothing is deployed yet.)
- Each step is reviewed by a separate fresh-context agent against `ARCHITECTURE.md`.
- Commit messages follow Conventional Commits: `type(scope): summary`, lower case and imperative, with details in the body. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`, `perf`, `style`. Scopes are optional, e.g. `db`, `functions`, `ui`, `sync`, `pwa`.

## Agent skills

### Issue tracker

GitHub Issues on `dylankiss/brickcheck`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
