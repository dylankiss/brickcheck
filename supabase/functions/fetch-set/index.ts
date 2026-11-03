// Imports a set's inventory from Rebrickable into the shared cache (once per set).
// POST { set_num } -> lego_sets row. See ARCHITECTURE.md, "Data flow" step 2.
import { adminClient, requireUser } from "../_shared/auth.ts";
import { HttpError, json, serve } from "../_shared/http.ts";
import { Rebrickable, type RbInventoryPart } from "../_shared/rebrickable.ts";

const SET_NUM_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const IMPORTS_PER_HOUR = 30;

interface ImportLine {
  part_num: string;
  part_name: string;
  part_cat_id: number | null;
  color_id: number;
  color_name: string;
  color_rgb: string | null;
  is_trans: boolean;
  img_url: string | null;
  element_id: string | null;
  bricklink_part_id: string | null;
  bricklink_color_id: number | null;
  quantity: number;
  is_spare: boolean;
  fig_num: string | null;
}

/** Adds inventory rows to `lines`, merging rows that share the cache's line key. */
function addLines(
  lines: Map<string, ImportLine>,
  parts: RbInventoryPart[],
  figNum: string | null,
  multiplier: number,
) {
  for (const p of parts) {
    const key = [p.part.part_num, p.color.id, p.is_spare, figNum].join("|");
    const existing = lines.get(key);
    if (existing) {
      existing.quantity += p.quantity * multiplier;
      continue;
    }
    lines.set(key, {
      part_num: p.part.part_num,
      part_name: p.part.name,
      part_cat_id: p.part.part_cat_id,
      color_id: p.color.id,
      color_name: p.color.name,
      color_rgb: p.color.rgb,
      is_trans: p.color.is_trans,
      img_url: p.part.part_img_url,
      element_id: p.element_id,
      bricklink_part_id: p.part.external_ids?.BrickLink?.[0] ?? null,
      bricklink_color_id: p.color.external_ids?.BrickLink?.ext_ids?.[0] ?? null,
      quantity: p.quantity * multiplier,
      is_spare: p.is_spare,
      fig_num: figNum,
    });
  }
}

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");

  const admin = adminClient();
  const userId = await requireUser(req, admin);

  const body = await req.json().catch(() => null);
  const setNum = typeof body?.set_num === "string" ? body.set_num.trim() : "";
  if (!SET_NUM_PATTERN.test(setNum))
    throw new HttpError(400, "Invalid set number");

  const { data: cached, error: cachedError } = await admin
    .from("lego_sets")
    .select("*")
    .eq("set_num", setNum)
    .maybeSingle();
  if (cachedError) throw cachedError;
  if (cached?.parts_fetched_at) return json(cached);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("set_import_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (countError) throw countError;
  if ((count ?? 0) >= IMPORTS_PER_HOUR) {
    throw new HttpError(
      429,
      "Too many new sets imported, try again in an hour",
    );
  }
  const { error: logError } = await admin
    .from("set_import_log")
    .insert({ user_id: userId, set_num: setNum });
  if (logError) throw logError;

  // Read everything first, then write once (import_set is atomic).
  const rb = Rebrickable.fromEnv();
  const set = await rb.getSet(setNum);
  const lines = new Map<string, ImportLine>();
  addLines(lines, await rb.getSetParts(setNum), null, 1);

  const figCopies = new Map<string, number>();
  for (const fig of await rb.getSetMinifigs(setNum)) {
    figCopies.set(
      fig.set_num,
      (figCopies.get(fig.set_num) ?? 0) + fig.quantity,
    );
  }
  for (const [figNum, copies] of figCopies) {
    addLines(lines, await rb.getMinifigParts(figNum), figNum, copies);
  }

  if (lines.size === 0)
    throw new HttpError(422, "Rebrickable has no inventory for this set");

  const { error: importError } = await admin.rpc("import_set", {
    p_set: {
      set_num: set.set_num,
      name: set.name,
      year: set.year,
      theme_id: set.theme_id,
      num_parts: set.num_parts,
      img_url: set.set_img_url,
    },
    p_parts: [...lines.values()],
  });
  if (importError) throw importError;

  const { data: imported, error: importedError } = await admin
    .from("lego_sets")
    .select("*")
    .eq("set_num", set.set_num)
    .single();
  if (importedError) throw importedError;
  return json(imported);
});
