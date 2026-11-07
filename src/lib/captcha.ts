/** The public Cloudflare Turnstile site key, or undefined when CAPTCHA is not configured. */
export const turnstileSiteKey: string | undefined =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || undefined;
