# BrickCheck

Mobile-first PWA to check LEGO sets piece by piece, collaboratively.
Read `ARCHITECTURE.md` before changing anything; keep it up to date.

## Commands

- `npm run dev`: Vite dev server (needs `.env.local`, see `.env.example`)
- `npm run build`: type-check and build
- `npm run lint`: oxlint
- `npm test`: vitest (pure logic in `src/lib`)
- `npx supabase start` / `npx supabase db reset`: local stack (Docker)
- `npx supabase functions serve`: run Edge Functions locally

## Rules

- All data access goes through `src/lib/api.ts`.
- The Rebrickable API is called only from Edge Functions.
- New tables need RLS policies in the same migration.
- Never edit an applied migration; add a new one.
- Each step is reviewed by a separate fresh-context agent against `ARCHITECTURE.md`.
