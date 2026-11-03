// Seeds demo data into the LOCAL stack so the UI can be explored without a
// Rebrickable API key. Usage: SUPABASE_SECRET_KEY=... npm run seed-demo -- you@example.com
//
// Creates a fictional Set with a cached inventory (every image URL checked to
// exist on Rebrickable's CDN), then acts as real users
// (signed in with one-time codes) through the same RPCs and RLS as the app:
//   - "Little House": partly found, with Sam as a Helper and an open Invite
//   - "Little House (second copy)": complete
//   - "Sam's house": owned by Sam, where you are a Helper
// Running it again replaces the demo Checks. Log in as the given email
// afterwards (the login email lands in Mailpit, http://127.0.0.1:54324).
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to the environment.
}
const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  "http://127.0.0.1:54321";
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const EMAIL = process.argv[2];

const { protocol, hostname } = new globalThis.URL(SUPABASE_URL);
if (protocol !== "http:" || !["127.0.0.1", "localhost"].includes(hostname))
  throw new Error(`Refusing to seed a non-local stack: ${SUPABASE_URL}`);
if (!SECRET_KEY)
  throw new Error("Set SUPABASE_SECRET_KEY (from `npx supabase status`)");
if (!PUBLISHABLE_KEY)
  throw new Error("Set VITE_SUPABASE_PUBLISHABLE_KEY in .env.local");
if (!EMAIL || !EMAIL.includes("@"))
  throw new Error("Usage: npm run seed-demo -- you@example.com");

const SAM_EMAIL = "sam.demo@example.com";
if (EMAIL.toLowerCase() === SAM_EMAIL)
  throw new Error("Use your own email, not the demo user Sam");
const SET_NUM = "demo-house-1";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(SUPABASE_URL, SECRET_KEY, options);

const must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};
const img = (color, part) =>
  `https://cdn.rebrickable.com/media/parts/ldraw/${color}/${part}.png`;

// part_num, part_name, color_id, color_name, color_rgb, quantity, extra fields
const line = (
  part_num,
  part_name,
  color_id,
  color_name,
  color_rgb,
  quantity,
  extra = {},
) => ({
  part_num,
  part_name,
  color_id,
  color_name,
  color_rgb,
  quantity,
  img_url: img(color_id, part_num),
  bricklink_part_id: part_num,
  ...extra,
});
const FIG = "fig-demo-01";
const INVENTORY = [
  line("3001", "Brick 2 x 4", 15, "White", "FFFFFF", 8, {
    bricklink_color_id: 1,
  }),
  line("3010", "Brick 1 x 4", 15, "White", "FFFFFF", 6, {
    bricklink_color_id: 1,
  }),
  line("3004", "Brick 1 x 2", 15, "White", "FFFFFF", 10, {
    bricklink_color_id: 1,
  }),
  line("3005", "Brick 1 x 1", 15, "White", "FFFFFF", 4, {
    bricklink_color_id: 1,
  }),
  line("3004", "Brick 1 x 2", 71, "Light Bluish Gray", "A0A5A9", 6, {
    bricklink_color_id: 86,
  }),
  line("3001", "Brick 2 x 4", 4, "Red", "C91A09", 2, { bricklink_color_id: 5 }),
  line("3039", "Slope 45 2 x 2", 4, "Red", "C91A09", 8, {
    bricklink_color_id: 5,
  }),
  line("3020", "Plate 2 x 4", 2, "Green", "237841", 4, {
    bricklink_color_id: 6,
  }),
  line("3710", "Plate 1 x 4", 72, "Dark Bluish Gray", "6C6E68", 6, {
    bricklink_color_id: 85,
  }),
  line("3068b", "Tile 2 x 2", 19, "Tan", "E4CD9E", 4, {
    bricklink_color_id: 2,
  }),
  line("3941", "Brick Round 2 x 2", 70, "Reddish Brown", "582A12", 2, {
    bricklink_color_id: 88,
  }),
  line("4073", "Plate Round 1 x 1", 27, "Lime", "BBE90B", 5, {
    bricklink_color_id: 34,
  }),
  line("4073", "Plate Round 1 x 1", 27, "Lime", "BBE90B", 1, {
    bricklink_color_id: 34,
    is_spare: true,
  }),
  line("3062b", "Brick Round 1 x 1", 47, "Trans-Clear", "FCFCFC", 2, {
    bricklink_color_id: 12,
    is_trans: true,
  }),
  line("3062b", "Brick Round 1 x 1", 47, "Trans-Clear", "FCFCFC", 1, {
    bricklink_color_id: 12,
    is_trans: true,
    is_spare: true,
  }),
  line("3626c", "Minifig Head", 14, "Yellow", "F2CD37", 1, {
    fig_num: FIG,
    bricklink_color_id: 3,
  }),
  line("973", "Torso Plain", 1, "Blue", "0055BF", 1, {
    fig_num: FIG,
    bricklink_color_id: 7,
  }),
  line("970c00", "Legs", 1, "Blue", "0055BF", 1, {
    fig_num: FIG,
    bricklink_color_id: 7,
  }),
];

/** Signs in as `email` (created if needed) with a one-time code; returns a client and the user id. */
async function signIn(email, name) {
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (created.error && created.error.code !== "email_exists")
    throw new Error(created.error.message);
  const link = must(
    await admin.auth.admin.generateLink({ type: "magiclink", email }),
  );
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, options);
  const { user } = must(
    await client.auth.verifyOtp({
      email,
      token: link.properties.email_otp,
      type: "email",
    }),
  );
  const profile = must(
    await client
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single(),
  );
  if (!profile.display_name)
    must(
      await client
        .from("profiles")
        .update({ display_name: name })
        .eq("id", user.id),
    );
  return { client, id: user.id };
}

async function createCheck(owner, title, { includeSpares = false } = {}) {
  const row = must(
    await owner.client
      .from("checks")
      .insert({
        set_num: SET_NUM,
        title,
        include_spares: includeSpares,
        include_minifigs: true,
      })
      .select("id")
      .single(),
  );
  return row.id;
}

/** Ticks off `found` pieces of a part (part number + color) through adjust_part, as the app does. */
async function tickOff(user, checkId, partNum, colorId, found) {
  if (found > 0)
    must(
      await user.client.rpc("adjust_part", {
        p_check_id: checkId,
        p_part_num: partNum,
        p_color_id: colorId,
        p_delta: found,
      }),
    );
}

/** Adds `member` to `owner`'s Check through an Invite, as the join page does. */
async function join(owner, member, checkId, role) {
  const invite = must(
    await owner.client
      .from("check_invites")
      .insert({ check_id: checkId, role })
      .select("token")
      .single(),
  );
  must(await member.client.rpc("accept_invite", { p_token: invite.token }));
}

// The Set and its inventory. import_set does nothing if the Set is already
// cached, so changes here need `npx supabase db reset` first.
const pieces = INVENTORY.filter((l) => !l.is_spare).reduce(
  (n, l) => n + l.quantity,
  0,
);
must(
  await admin.rpc("import_set", {
    p_set: {
      set_num: SET_NUM,
      name: "Little House (demo set)",
      year: 2026,
      num_parts: pieces,
      img_url: null,
    },
    p_parts: INVENTORY,
  }),
);

const me = await signIn(EMAIL, EMAIL.split("@")[0]);
const sam = await signIn(SAM_EMAIL, "Sam");

// Replace earlier demo Checks of both users (the Owner may delete; members go with the Check).
for (const user of [me, sam]) {
  must(
    await user.client
      .from("checks")
      .delete()
      .eq("owner_id", user.id)
      .eq("set_num", SET_NUM),
  );
}

// 1. Partly found, with a Helper and an open Invite for viewers.
const house = await createCheck(me, "Little House");
await join(me, sam, house, "helper");
const progress = {
  "3001|15": 8,
  "3010|15": 4,
  "3004|15": 7,
  "3005|15": 4,
  "3004|71": 6,
  "3039|4": 3,
  "3020|2": 4,
  "3710|72": 2,
  "4073|27": 5,
  "3626c|14": 1,
};
for (const [key, found] of Object.entries(progress)) {
  const [partNum, colorId] = key.split("|");
  // Sam found the roof slopes; the rest is yours.
  await tickOff(
    partNum === "3039" ? sam : me,
    house,
    partNum,
    Number(colorId),
    found,
  );
}
must(
  await me.client
    .from("check_invites")
    .insert({ check_id: house, role: "viewer" }),
);

// 2. Complete (spares included, all found).
const done = await createCheck(me, "Little House (second copy)", {
  includeSpares: true,
});
const totals = new Map();
for (const l of INVENTORY) {
  const key = `${l.part_num}|${l.color_id}`;
  totals.set(key, (totals.get(key) ?? 0) + l.quantity);
}
for (const [key, needed] of totals) {
  const [partNum, colorId] = key.split("|");
  await tickOff(me, done, partNum, Number(colorId), needed);
}

// 3. Sam's Check, where you are a Helper.
const samsHouse = await createCheck(sam, "Sam's house");
await join(sam, me, samsHouse, "helper");
await tickOff(sam, samsHouse, "3001", 15, 3);
await tickOff(sam, samsHouse, "3039", 4, 8);

console.log(
  `Seeded demo data for ${EMAIL}: 3 Checks of "${SET_NUM}" (one partly found, one complete, one shared by Sam).`,
);
console.log(
  "Log in at http://localhost:5173 as that email; the login email lands in Mailpit at http://127.0.0.1:54324.",
);
