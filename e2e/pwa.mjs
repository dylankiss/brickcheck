// Checks the production build as a PWA: manifest, service worker, offline app shell.
// Usage: npm run build && npx vite preview --port 4173, then node e2e/pwa.mjs
import { chromium } from "playwright-core";

const APP = process.env.APP_URL ?? "http://localhost:4173";
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) process.exitCode = 1;
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  await page.goto(`${APP}/login`);
  await page.getByText("Email me a login link").waitFor();

  const manifest = await (
    await page.request.get(`${APP}/manifest.webmanifest`)
  ).json();
  ok(
    manifest.display === "standalone" &&
      manifest.icons.some((i) => i.purpose === "maskable"),
    "manifest is installable (standalone, maskable icon)",
  );

  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope,
  );
  ok(scope === `${APP}/`, `service worker is active for ${scope}`);

  // Let the service worker take control and finish precaching.
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await ctx.setOffline(true);
  await page.reload();
  await page.getByText("Email me a login link").waitFor({ timeout: 5000 });
  ok(true, "the app shell loads offline");
  await page.goto(`${APP}/checks/some-check`);
  await page.getByText("Email me a login link").waitFor({ timeout: 5000 });
  ok(true, "deep links load offline (index.html fallback)");
} finally {
  await browser.close();
}
