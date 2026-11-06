// End-to-end smoke test against a running local stack (`supabase start` + `supabase functions serve`).
// Usage: npm run smoke (keys come from `npx supabase status` unless set in the environment).
// Creates throwaway users and a `smoke-<timestamp>` set; meant for local databases only.
import { createClient } from "@supabase/supabase-js";
import { localStack } from "./local-stack.mjs";

const {
  url: SUPABASE_URL,
  publishableKey: PUB,
  secretKey: SECRET,
} = localStack();
const SET_NUM = `smoke-${Date.now()}`;
const admin = createClient(SUPABASE_URL, SECRET, {
  auth: { persistSession: false },
});
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) {
    process.exitCode = 1;
  }
};

async function user(email) {
  await admin.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  const c = createClient(SUPABASE_URL, PUB, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({
    email,
    password: "password123",
  });
  if (error) {
    throw error;
  }
  return c;
}

const { error: impErr } = await admin.rpc("import_set", {
  p_set: { set_num: SET_NUM, name: "Smoke set" },
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

const anon = createClient(SUPABASE_URL, PUB, {
  auth: { persistSession: false },
});
let r = await anon.functions.invoke("fetch-set", {
  body: { set_num: SET_NUM },
});
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
r = await a.functions.invoke("fetch-set", { body: { set_num: SET_NUM } });
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

const { data: set, error: ce } = await a
  .from("sets")
  .insert({ set_num: SET_NUM, title: "Smoke" })
  .select()
  .single();
ok(!ce, `create set ${ce?.message ?? ""}`);

// Concurrency: 20 parallel taps, two users' worth of clients sharing a set.
const { error: ie } = await admin.from("set_members").insert({
  set_id: set.id,
  user_id: (await b.auth.getUser()).data.user.id,
  role: "helper",
});
ok(!ie, `add helper ${ie?.message ?? ""}`);
const taps = await Promise.all(
  Array.from({ length: 20 }, (_, i) =>
    (i % 2 ? a : b).rpc("adjust_part", {
      p_set_id: set.id,
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
  .from("set_lines")
  .select("fig_num,quantity,found_qty")
  .eq("set_id", set.id);
ok(
  lines.every((l) => l.found_qty === l.quantity),
  `all lines full and clamped: ${JSON.stringify(lines)}`,
);
const down = await Promise.all(
  Array.from({ length: 4 }, () =>
    a.rpc("adjust_part", {
      p_set_id: set.id,
      p_part_num: "3001",
      p_color_id: 4,
      p_delta: -1,
    }),
  ),
);
const { data: s } = await a
  .from("set_summaries")
  .select("needed,found")
  .eq("id", set.id)
  .single();
ok(
  s.needed === 5 && s.found === 1 && down.every((d) => !d.error),
  `4 concurrent decrements -> ${JSON.stringify(s)}`,
);

// Deadlock check: mixed concurrent +1/-1 on a multi-line part.
const mixed = await Promise.all(
  Array.from({ length: 40 }, (_, i) =>
    (i % 2 ? a : b).rpc("adjust_part", {
      p_set_id: set.id,
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
  .from("set_summaries")
  .select("needed,found")
  .eq("id", set.id)
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
