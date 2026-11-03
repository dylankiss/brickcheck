# BrickCheck

Check your LEGO sets piece by piece, together. Pick a set, tap each part as you
find it, and end up with the list of missing pieces.

See `ARCHITECTURE.md` for how it fits together and `CLAUDE.md` for commands.

## Local setup

1. `npm install`
2. Copy `.env.example` → `.env.local` and `supabase/.env.example` → `supabase/.env`,
   fill in a Rebrickable API key (https://rebrickable.com/api/).
3. `npx supabase start` (needs Docker), then put the printed API URL and
   publishable key into `.env.local`.
4. `npx supabase functions serve` and `npm run dev`.
