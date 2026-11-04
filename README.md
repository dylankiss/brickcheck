# BrickCheck

Check your LEGO sets piece by piece, together. Pick a set, tap each part as you
find it, and end up with the list of missing pieces.

See `ARCHITECTURE.md` for how it fits together and `CLAUDE.md` for commands.

## Local setup

You need Node 26 (see `.nvmrc`) and Docker.

Claude works in this repo inside Claude Code's sandbox (`.claude/settings.json`).
Docker isn't available to it, so run `npx supabase start`,
`npx supabase db reset`, `npm run test:db`, `npx supabase functions serve` and
the browser tests yourself.

1. `npm install`
2. Copy `.env.example` → `.env.local` and `supabase/.env.example` → `supabase/.env`,
   fill in a Rebrickable API key (https://rebrickable.com/api/; not needed if you only use `npm run seed-demo`).
3. `npx supabase start` (needs Docker), then put the printed API URL and
   publishable key into `.env.local`.
4. Seed the set catalog: `SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=<secret key> npm run import-catalog`
5. `npx supabase functions serve` and `npm run dev`, then open http://localhost:5173.
   Magic-link emails land in Mailpit at http://127.0.0.1:54324.
6. Optional, to try the UI without a Rebrickable key: `npm run seed-demo -- you@example.com`
   adds a demo catalog set and three Sets of it (partly found, complete, shared by a demo user Sam). Then log in as that email.
