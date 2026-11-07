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
     only mails team members and allows a few emails per hour. Mail needs a
     sending domain whose DNS you control; a bare `pages.dev` address won't do,
     and a free-mail sender such as `@gmail.com` fails DMARC alignment and tends
     to land in spam. It doesn't have to be the domain that serves the app: a
     subdomain of any domain you own works (for example
     `brickcheck.<mail-domain>`), and the app stays on `pages.dev`. With Brevo
     (free, 300 emails/day):
     1. Brevo > Senders, Domains & Dedicated IPs > Domains: add that subdomain
        as the sending domain. Choose the Brevo-managed setup, which only needs
        two NS records for the subdomain at your DNS host (keep them as long
        as you use Brevo). Leave your root domain's own records, such as SPF
        and DMARC, alone.
     2. Add a sender on it, for example `login@brickcheck.<mail-domain>`.
     3. Brevo > Transactional > Settings > Configuration > SMTP Relay: note the
        host (`smtp-relay.brevo.com`), port 587 and login, and create an SMTP
        key. Don't use the account password and don't commit the key.
     4. Enter those, the sender address and the name `BrickCheck` in Supabase.
     5. Send yourself a login email and check in Gmail's "Show original" that
        SPF, DKIM and DMARC all pass.
   - **Authentication > Emails > Templates**: the hosted project doesn't read
     `supabase/config.toml`. Paste `supabase/templates/login.html` into both
     _Magic link_ and _Confirm signup_ (subject "Your BrickCheck login"). A new
     user gets _Confirm signup_, a returning one _Magic link_. The 6-digit code
     is needed by the installed iOS app. The logo comes from the Site URL.
   - **Authentication > Sign in / Providers > Email**: email OTP expiration 900 s,
     email OTP length 6. Hosted projects ignore `config.toml`, and the default
     length is 8, which doesn't match the "6-digit" text in the app and email.
   - **Authentication > Sign in / Providers > Google**: enable it with an OAuth
     client from Google Cloud Console (Web application). Add the authorized
     redirect URI that Supabase shows.
   - **Authentication > Passkeys** (beta): turn it on. If the dashboard asks
     for a relying party ID or allowed origins, use the domain that serves the
     app (`<project>.pages.dev` or your custom domain). Passkeys are tied to
     that domain, so choose it before users add passkeys: after a move to
     another domain, existing passkeys stop working and users add new ones.
   - **Realtime > Settings**: turn off "Allow public access", so only private
     channels are allowed.
   - Before going public: CAPTCHA, in this order (see step 2 for the site key).
     The app only sends a token when the build has the site key, so enabling
     it in Supabase first breaks email login:
     1. Cloudflare > Turnstile > Add widget, for your Pages hostname (and the
        preview hostnames if you want it there). Widget mode: Managed. Note the
        **site key** (public) and the **secret key**.
     2. Add the site key as `VITE_TURNSTILE_SITE_KEY` in Cloudflare Pages and
        redeploy (step 2).
     3. Supabase > Authentication > Attack protection: enable CAPTCHA with
        provider Cloudflare Turnstile and the secret key. The secret key goes
        only here.
     4. Request a login email on the live site. Google sign-in is unaffected.

## 2. Cloudflare Pages (the web app)

1. Push this repo to GitHub, then in Cloudflare: **Workers & Pages > Create > Pages >
   Connect to Git**.
2. Build settings: framework _None_, build command `npm run build`, output directory `dist`.
3. Environment variables (Production and Preview):
   - `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_...`
   - `VITE_PUBLIC_URL` = `https://<your-domain>` (so invite links from previews point at production)
   - `VITE_TURNSTILE_SITE_KEY` = the Turnstile site key (see step 1, CAPTCHA). Optional; without it the login form has no CAPTCHA.
   - Don't set `NODE_VERSION` (delete it if present): Pages reads the version from `.nvmrc`.
4. Optional: add a custom domain (about €10/yr). Otherwise use `<project>.pages.dev`.

Pages serves `index.html` for unknown paths (there is no `404.html`), so client-side
routes like `/join/<token>` work. `public/_headers` sets security headers and keeps
`sw.js` uncached.

## 3. GitHub

- **CI** (`.github/workflows/ci.yml`) runs lint, the format check, unit tests, the build and the database tests.
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
4. Check the Content-Security-Policy, which `public/_headers` enforces. After
   a deploy, open a desktop browser's developer tools console (context
   "top", filter `Content-Security-Policy`) and go through login (email,
   Google, passkey), a set, an enlarged picture, your avatar and the install
   prompt. A line that starts with "Refused to" is something the policy
   blocked. The CAPTCHA frame prints its own errors (about `eval`, `data:` and
   permissions); those come from Cloudflare's page. With DevTools open,
   Turnstile also pauses on `debugger` statements; resume them or use
   Deactivate breakpoints. If our own flows break, rename the header in
   `public/_headers` to `Content-Security-Policy-Report-Only` and deploy.
   Fix the policy before enforcing it again.
