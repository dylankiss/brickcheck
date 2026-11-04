// Browser end-to-end test of checking a set with two users, against a local
// stack and `npm run dev`. Uses the installed Google Chrome.
// Usage: npm run e2e [-- screenshot-dir] (keys come from `npx supabase status` unless set in the environment).
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { localStack } from "../scripts/local-stack.mjs";

const OUT = process.argv[2] ?? "e2e/screenshots";
mkdirSync(OUT, { recursive: true });
const APP = process.env.APP_URL ?? "http://localhost:5173";
const { url: SUPABASE_URL, secretKey } = localStack();
const admin = createClient(SUPABASE_URL, secretKey, {
  auth: { persistSession: false },
});
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) process.exitCode = 1;
};
const img = (color, part) =>
  `https://cdn.rebrickable.com/media/parts/ldraw/${color}/${part}.png`;

const SET_NUM = `demo-${Date.now()}`;
await admin.rpc("import_set", {
  p_set: {
    set_num: SET_NUM,
    name: `Demo Castle ${SET_NUM.slice(-4)}`,
    year: 2026,
    num_parts: 12,
    img_url: null,
  },
  p_parts: [
    {
      part_num: "3001",
      part_name: "Brick 2 x 4",
      color_id: 4,
      color_name: "Red",
      color_rgb: "C91A09",
      quantity: 4,
      img_url: img(4, "3001"),
      bricklink_part_id: "3001",
      bricklink_color_id: 5,
    },
    {
      part_num: "3001",
      part_name: "Brick 2 x 4",
      color_id: 4,
      color_name: "Red",
      color_rgb: "C91A09",
      quantity: 1,
      is_spare: true,
      img_url: img(4, "3001"),
    },
    {
      part_num: "3004",
      part_name: "Brick 1 x 2",
      color_id: 71,
      color_name: "Light Bluish Gray",
      color_rgb: "A0A5A9",
      quantity: 3,
      img_url: img(71, "3004"),
      bricklink_part_id: "3004",
      bricklink_color_id: 86,
    },
    {
      part_num: "3626c",
      part_name: "Minifig Head",
      color_id: 14,
      color_name: "Yellow",
      color_rgb: "F2CD37",
      quantity: 2,
      fig_num: "fig-000001",
      img_url: null,
    },
    {
      part_num: "3062b",
      part_name: "Brick Round 1 x 1",
      color_id: 47,
      color_name: "Trans-Clear",
      color_rgb: "FCFCFC",
      is_trans: true,
      quantity: 2,
      img_url: img(47, "3062b"),
    },
  ],
});

async function newPage(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: APP,
  });
  // Headless Chrome has no share sheet; take the copy-to-clipboard path instead.
  await ctx.addInitScript(() => delete Navigator.prototype.share);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  return page;
}

/** Logs in via the magic link, or by typing the 6-digit code when `viaCode`. */
async function loginPage(browser, email, { viaCode = false, name } = {}) {
  await admin.auth.admin.createUser({ email, email_confirm: true });
  const page = await newPage(browser);
  if (viaCode) {
    await page.goto(`${APP}/login`);
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByText("Email me a login link").click();
    await page.getByLabel("Login code").waitFor();
    // Read a fresh code instead of the email (auth allows one request per second).
    await page.waitForTimeout(1500);
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error) throw error;
    await page.getByLabel("Login code").fill(data.properties.email_otp);
    await page.getByText("Log in with code").click();
  } else {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${APP}/` },
    });
    if (error) throw error;
    await page.goto(data.properties.action_link);
  }
  await page.waitForURL(`${APP}/**`);
  // New email users are asked for a name first.
  await page.getByPlaceholder("Your name").fill(name);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("My sets").waitFor();
  return page;
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  // Login screen
  const anonCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const anon = await anonCtx.newPage();
  await anon.goto(`${APP}/sets/whatever`);
  await anon.getByText("Email me a login link").waitFor();
  await anon.screenshot({ path: `${OUT}/1-login.png` });
  ok(anon.url().endsWith("/login"), "unauthenticated users are sent to /login");

  const a = await loginPage(browser, `alice${Date.now()}@example.com`, {
    name: "Alice",
  });
  ok(true, "magic link logs in and lands on My sets");

  // New set
  await a.getByText("+ Add a set").click();
  await a
    .getByPlaceholder("Set number or name")
    .fill("Demo Castle " + SET_NUM.slice(-4));
  await a
    .getByText(`Demo Castle ${SET_NUM.slice(-4)}`)
    .first()
    .click();
  await a.screenshot({ path: `${OUT}/2-new-set.png` });
  await a.getByText("Start checking").click();
  // Fail with the app's own error message instead of a bare navigation timeout.
  await Promise.race([
    a.waitForURL(/\/sets\/[0-9a-f-]{36}$/),
    a
      .getByRole("alert")
      .waitFor()
      .then(
        async () => {
          throw new Error(
            `Adding the set failed: ${await a.getByRole("alert").innerText()}`,
          );
        },
        () => {}, // no error banner within the timeout: the URL wait decides
      ),
  ]).catch(async (error) => {
    await a.screenshot({ path: `${OUT}/failed-add-set.png` });
    const spinner = await a
      .getByText(/Adding set|Loading the parts list/)
      .isVisible();
    throw new Error(
      `${error.message}${spinner ? " (still busy: fetch-set or creating the set never answered)" : ""}`,
    );
  });
  const setId = a.url().split("/").pop();
  await a.getByText("0/11").waitFor();
  ok(true, "set created with 11 needed pieces (spare excluded)");

  // Tap red brick 3 times, then undo once
  // Anchored: the card's own button, not its "Enlarge picture of …" button.
  const red = a.getByRole("button", { name: /^Brick 2 x 4, Red:/ });
  for (let i = 0; i < 3; i++) await red.click();
  await a.getByRole("button", { name: "Remove one Brick 2 x 4" }).click();
  await a.getByText("2/11").waitFor();
  ok(true, "taps and undo update the counter optimistically");

  // Enlarge a part's picture, zoom in with a tap, then close it with Escape
  await a
    .getByRole("button", { name: "Enlarge picture of Brick 2 x 4, Red" })
    .click();
  const enlarged = a.getByRole("dialog", { name: "Brick 2 x 4, Red" });
  await enlarged.getByText(/2 of 4 found/).waitFor();
  await enlarged.getByRole("img", { name: "Brick 2 x 4, Red" }).click();
  await a.screenshot({ path: `${OUT}/3b-enlarged-part.png` });
  await a.keyboard.press("Escape");
  await enlarged.waitFor({ state: "hidden" });
  ok(
    true,
    "an enlarged picture shows live counts, zooms on tap and closes with Escape",
  );

  // A quick tap + undo burst must end where it started (taps are sent in order).
  // Both clicks fire synchronously, before the first request can return.
  await a.evaluate(() => {
    const part = [...document.querySelectorAll("button")].find((b) =>
      b.getAttribute("aria-label")?.startsWith("Brick 2 x 4, Red"),
    );
    const undo = [...document.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === "Remove one Brick 2 x 4",
    );
    for (let i = 0; i < 3; i++) {
      part.click();
      undo.click();
    }
  });
  await a.waitForTimeout(1500);
  await a.reload();
  await a.getByText("2/11").waitFor();
  ok(true, "a +1/−1 burst is applied in order and persisted");

  // Bob logs in with the code from the email and picks a name
  const b = await loginPage(browser, `bob${Date.now()}@example.com`, {
    viaCode: true,
    name: "Bob Builder",
  });
  ok(true, "logging in with the 6-digit code works, after choosing a name");

  // Alice invites helpers; Bob joins through the link
  await a.getByRole("link", { name: "People" }).click();
  await a.getByRole("button", { name: "Invite helpers" }).click();
  await a.getByText("Copied!").waitFor();
  const link = await a.evaluate(() => navigator.clipboard.readText());
  ok(/\/join\/[0-9a-f-]{36}$/.test(link), `invite link copied: ${link}`);
  await b.goto(link);
  await b.getByText("Alice invited you to tick off parts.").waitFor();
  await b.screenshot({ path: `${OUT}/7-join.png` });
  await b.getByRole("button", { name: "Join" }).click();
  await b.getByText("2/11").waitFor();
  ok(true, "the invitee joins and sees the same progress");
  await a.getByText("Bob Builder").waitFor();
  await a.screenshot({ path: `${OUT}/8-people.png` });
  ok(true, "the owner sees the new member appear live");
  await a.getByRole("link", { name: "Back" }).click();
  await a
    .getByRole("link", { name: "People" })
    .locator('[title="Bob Builder"]')
    .waitFor({ timeout: 10000 });
  ok(true, "Bob's avatar shows as online on Alice's set");
  await b.getByRole("button", { name: /^Minifig Head, Yellow:/ }).click();
  await b.getByRole("button", { name: /^Minifig Head, Yellow:/ }).click();
  await a.getByText("4/11").waitFor({ timeout: 10000 });
  ok(true, "Bob's taps appear on Alice's screen in real time");

  // Fill everything gray from Alice and check filters
  const gray = a.getByRole("button", {
    name: /^Brick 1 x 2, Light Bluish Gray:/,
  });
  for (let i = 0; i < 3; i++) await gray.click();
  await a.getByText("7/11").waitFor();
  await a.screenshot({ path: `${OUT}/3-set.png` });
  await a.getByRole("button", { name: "Hide found" }).click();
  ok(
    (await a
      .getByRole("button", { name: /Light Bluish Gray: 3 of 3/ })
      .count()) === 0,
    "Hide found hides fully found parts",
  );
  await a.getByRole("button", { name: "Hide found" }).click();

  // Missing view
  await a.getByText(/^Missing 4$/).click();
  await a.getByText("4 pieces in 2 parts still to find.").waitFor();
  await a.screenshot({ path: `${OUT}/4-missing.png` });
  ok(true, "missing view lists the 4 missing pieces");
  await a
    .getByRole("button", { name: "Enlarge picture of Brick 2 x 4, Red" })
    .click();
  await a
    .getByRole("dialog", { name: "Brick 2 x 4, Red" })
    .getByRole("button", { name: "Close" })
    .click();
  await a.getByRole("dialog").waitFor({ state: "hidden" });
  ok(true, "missing view enlarges a picture and the Close button closes it");
  const [download] = await Promise.all([
    a.waitForEvent("download"),
    a.getByText("Rebrickable CSV").click(),
  ]);
  const csv = await (
    await download.createReadStream()
  )
    .toArray()
    .then((c) => Buffer.concat(c).toString());
  ok(
    csv === "Part,Color,Quantity\n3001,4,2\n3062b,47,2\n",
    `CSV export: ${JSON.stringify(csv)}`,
  );

  // Missing page updates live from the shared channel
  await b.getByRole("button", { name: /^Brick 2 x 4, Red:/ }).click();
  await a
    .getByText("3 pieces in 2 parts still to find.")
    .waitFor({ timeout: 10000 });
  ok(true, "the missing list updates live");

  // Alice makes Bob a viewer; his page switches to read-only without reloading
  await b.goto(`${APP}/sets/${setId}`);
  await a.goto(`${APP}/sets/${setId}/people`);
  await a.getByLabel("Role of Bob Builder").selectOption("viewer");
  await b
    .getByText("You can view this set but not change it.")
    .waitFor({ timeout: 10000 });
  ok(
    await b.getByRole("button", { name: /^Brick 2 x 4, Red:/ }).isDisabled(),
    "a role change reaches the member live",
  );

  // Alice removes Bob; his page notices
  a.once("dialog", (d) => d.accept());
  await a.getByRole("button", { name: "Remove" }).click();
  await b.getByText("Set not found").waitFor({ timeout: 10000 });
  ok(true, "a removed member loses access live");
  await b.goto(link);
  await b.getByText("This invite link is invalid or has expired").waitFor();
  ok(true, "a removed member cannot rejoin with the old link");

  // My sets list
  await a.goto(`${APP}/`);
  await a.getByText("8/11").waitFor();
  await a.screenshot({ path: `${OUT}/5-sets.png` });
  ok(true, "My sets shows progress");

  // Missing in all sets: see where a found piece goes and tick it off there
  await a.getByRole("link", { name: /See where it goes/ }).click();
  const foundOne = a.getByRole("button", {
    name: `Found one Brick 2 x 4, Red for Demo Castle ${SET_NUM.slice(-4)}`,
  });
  await foundOne.click();
  // The Set needed one more red brick, so it drops off that part's list.
  await foundOne.waitFor({ state: "detached" });
  await a.screenshot({ path: `${OUT}/5b-missing-across-sets.png` });
  ok(true, "the all-sets overview ticks off a piece in the right set");

  // Dark mode screenshot of the set
  await a.emulateMedia({ colorScheme: "dark" });
  await a.goto(`${APP}/sets/${setId}`);
  await a.getByText("9/11").waitFor();
  await a.screenshot({ path: `${OUT}/6-set-dark.png` });
} finally {
  await browser.close();
}
