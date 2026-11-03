# Deploying BrickCheck

Everything below runs on free tiers. Expect about an hour the first time.

## 1. Supabase (database, auth, realtime, functions)

1. Create a project at https://supabase.com (free plan). Pick a region near your users.
2. Link and push the schema from this repo:
   ```sh
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   Do **not** run `supabase config push`: `supabase/config.toml` holds local
   settings (localhost URLs, `skip_nonce_check`).
3. Deploy the Edge Function and set its secrets:
   ```sh
   npx supabase functions deploy fetch-set --no-verify-jwt
   npx supabase secrets set REBRICKABLE_API_KEY=<key from rebrickable.com/api> \
     BRICKCHECK_SECRET_KEY=<sb_secret_... from Settings > API keys> \
     ALLOWED_ORIGINS='https://<your-domain>,https://*.<pages-project>.pages.dev'
   ```
4. Seed the catalog once (28k sets, about a minute):
   ```sh
   SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SECRET_KEY=<sb_secret_...> npm run import-catalog
   ```
5. Dashboard settings:
   - **Authentication > URL configuration**: Site URL `https://<your-domain>`. Redirect
     URLs `https://<your-domain>/**` and `https://*.<pages-project>.pages.dev/**` (previews).
   - **Authentication > Emails > SMTP**: use a free provider. The built-in sender
     only mails team members and allows a few emails per hour. Brevo works with a
     single verified sender address. Resend needs a domain you own, so it won't
     work with a bare `pages.dev` site.
   - **Authentication > Emails > Templates**: paste `supabase/templates/login.html`
     into both _Magic link_ and _Confirm signup_ (subject "Your BrickCheck login").
     The 6-digit code is needed by the installed iOS app.
   - **Authentication > Sign in / Providers > Email**: email OTP expiration 900 s,
     email OTP length 6.
   - **Authentication > Sign in / Providers > Google**: enable it with an OAuth
     client from Google Cloud Console (Web application). Add the authorized
     redirect URI that Supabase shows.
   - **Realtime > Settings**: turn off "Allow public access", so only private
     channels are allowed.
   - Before going public: **Authentication > Attack protection**, enable CAPTCHA
     (Cloudflare Turnstile, free).

## 2. Cloudflare Pages (the web app)

1. Push this repo to GitHub, then in Cloudflare: **Workers & Pages > Create > Pages >
   Connect to Git**.
2. Build settings: framework _None_, build command `npm run build`, output directory `dist`.
3. Environment variables (Production and Preview):
   - `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_...`
   - `VITE_PUBLIC_URL` = `https://<your-domain>` (so invite links from previews point at production)
   - Don't set `NODE_VERSION` (delete it if present): Pages reads the version from `.nvmrc`.
4. Optional: add a custom domain (about €10/yr). Otherwise use `<project>.pages.dev`.

Pages serves `index.html` for unknown paths (there is no `404.html`), so client-side
routes like `/join/<token>` work. `public/_headers` sets security headers and keeps
`sw.js` uncached.

## 3. GitHub

- **CI** (`.github/workflows/ci.yml`) runs lint, unit tests, the build and the database tests.
- **Catalog refresh** (`.github/workflows/catalog.yml`) runs twice a week. Add the
  repository secrets `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. It also keeps the
  free project from being paused after 7 idle days. GitHub disables scheduled
  workflows after 60 days without repository activity; re-enable it under Actions
  if that happens.

## 4. Smoke test the deployment

1. Open the site on your phone, log in with your email, and install it
   (Safari: Share > Add to Home Screen; Chrome: Install app).
2. Add a set, a small one (e.g. 40516-1). The first import takes a few
   seconds per minifigure.
3. Invite yourself from a second account in another browser and tap a part. It
   should appear on both screens.
