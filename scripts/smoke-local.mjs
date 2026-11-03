// End-to-end smoke test against a running local stack (`supabase start` + `supabase functions serve`).
// Usage: SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... node scripts/smoke-local.mjs
// Creates throwaway users and a `smoke-<timestamp>` set; meant for local databases only.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!PUB || !SECRET)
  throw new Error("Set SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY");
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(URL))
  throw new Error("Refusing to run against a non-local stack");
const SET = `smoke-${Date.now()}`;
const admin = createClient(URL, SECRET, { auth: { persistSession: false } });
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) process.exitCode = 1;
};

async function user(email) {
  await admin.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  const c = createClient(URL, PUB, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({
    email,
    password: "password123",
  });
  if (error) throw error;
  return c;
}

const { error: impErr } = await admin.rpc("import_set", {
  p_set: { set_num: SET, name: "Smoke set" },
  p_parts: [
    {
      part_num: "3001",
      part_name: "Brick",
      color_id: 4,
      color_name: "Red",
      quantity: 3,
    },
    {
      part_num: "3001",
      part_name: "Brick",
      color_id: 4,
      color_name: "Red",
      quantity: 2,
      fig_num: "fig-1",
    },
  ],
});
ok(!impErr, `import_set via service role ${impErr?.message ?? ""}`);

const anon = createClient(URL, PUB, { auth: { persistSession: false } });
let r = await anon.functions.invoke("fetch-set", { body: { set_num: SET } });
ok(
  r.error?.context?.status === 401,
  `fetch-set without login -> ${r.error?.context?.status}`,
);

const a = await user(`a${Date.now()}@example.com`);
const b = await user(`b${Date.now()}@example.com`);
r = await a.functions.invoke("fetch-set", { body: { set_num: "../etc" } });
ok(
  r.error?.context?.status === 400,
  `invalid set number -> ${r.error?.context?.status}`,
);
r = await a.functions.invoke("fetch-set", { body: { set_num: SET } });
ok(
  r.data?.parts_fetched_at,
  `cached set returned without Rebrickable: ${JSON.stringify(r.data)?.slice(0, 80)}`,
);

const { data: search } = await a
  .from("lego_sets")
  .select("set_num,name")
  .ilike("name", "%millennium falcon%")
  .limit(3);
ok(
  search?.length > 0,
  `catalog search works: ${search?.map((s) => s.set_num).join(", ")}`,
);

const { data: check, error: ce } = await a
  .from("checks")
  .insert({ set_num: SET, title: "Smoke" })
  .select()
  .single();
ok(!ce, `create check ${ce?.message ?? ""}`);

// Concurrency: 20 parallel taps, two users' worth of clients sharing a check.
const { error: ie } = await admin.from("check_members").insert({
  check_id: check.id,
  user_id: (await b.auth.getUser()).data.user.id,
  role: "helper",
});
ok(!ie, `add helper ${ie?.message ?? ""}`);
const taps = await Promise.all(
  Array.from({ length: 20 }, (_, i) =>
    (i % 2 ? a : b).rpc("adjust_part", {
      p_check_id: check.id,
      p_part_num: "3001",
      p_color_id: 4,
      p_delta: 1,
    }),
  ),
);
ok(
  taps.every((t) => !t.error),
  `20 concurrent taps without errors ${taps.find((t) => t.error)?.error?.message ?? ""}`,
);
const { data: lines } = await a
  .from("check_lines")
  .select("fig_num,quantity,found_qty")
  .eq("check_id", check.id);
ok(
  lines.every((l) => l.found_qty === l.quantity),
  `all lines full and clamped: ${JSON.stringify(lines)}`,
);
const down = await Promise.all(
  Array.from({ length: 4 }, () =>
    a.rpc("adjust_part", {
      p_check_id: check.id,
      p_part_num: "3001",
      p_color_id: 4,
      p_delta: -1,
    }),
  ),
);
const { data: s } = await a
  .from("check_summaries")
  .select("needed,found")
  .eq("id", check.id)
  .single();
ok(
  s.needed === 5 && s.found === 1 && down.every((d) => !d.error),
  `4 concurrent decrements -> ${JSON.stringify(s)}`,
);

// Deadlock check: mixed concurrent +1/-1 on a multi-line tile.
const mixed = await Promise.all(
  Array.from({ length: 40 }, (_, i) =>
    (i % 2 ? a : b).rpc("adjust_part", {
      p_check_id: check.id,
      p_part_num: "3001",
      p_color_id: 4,
      p_delta: i % 3 ? 1 : -1,
    }),
  ),
);
ok(
  mixed.every((t) => !t.error),
  `40 concurrent mixed taps without deadlock ${mixed.find((t) => t.error)?.error?.message ?? ""}`,
);
const { data: s2 } = await a
  .from("check_summaries")
  .select("needed,found")
  .eq("id", check.id)
  .single();
ok(
  s2.found >= 0 && s2.found <= 5,
  `total stays within bounds: ${JSON.stringify(s2)}`,
);

r = await a.functions.invoke("fetch-set", {
  body: { set_num: "not-in-catalog-1" },
});
ok(
  r.error?.context?.status === 404,
  `set outside the catalog -> ${r.error?.context?.status} (no Rebrickable call)`,
);
