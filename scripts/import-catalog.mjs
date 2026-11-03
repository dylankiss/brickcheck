// Seeds/refreshes the lego_sets catalog from Rebrickable's free CSV dump.
// Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/import-catalog.mjs [sets.csv.gz]
// Only catalog columns are upserted; parts_fetched_at and inventories are never touched.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";

const CSV_URL = "https://cdn.rebrickable.com/media/downloads/sets.csv.gz";
const BATCH_SIZE = 1000;

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function loadCsv(path) {
  if (path) return gunzipSync(await readFile(path)).toString("utf8");
  const res = await fetch(CSV_URL);
  if (!res.ok)
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  return gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [header, ...rows] = parseCsv(await loadCsv(process.argv[2]));
  const col = Object.fromEntries(header.map((name, i) => [name, i]));
  for (const name of [
    "set_num",
    "name",
    "year",
    "theme_id",
    "num_parts",
    "img_url",
  ]) {
    if (!(name in col)) throw new Error(`CSV is missing column ${name}`);
  }

  const sets = rows
    .filter((r) => r.length === header.length && r[col.set_num])
    .map((r) => ({
      set_num: r[col.set_num],
      name: r[col.name],
      year: Number(r[col.year]) || null,
      theme_id: Number(r[col.theme_id]) || null,
      num_parts: Number(r[col.num_parts]) || 0,
      img_url: r[col.img_url] || null,
    }));

  for (let i = 0; i < sets.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from("lego_sets")
      .upsert(sets.slice(i, i + BATCH_SIZE), { onConflict: "set_num" });
    if (error) throw error;
    process.stdout.write(
      `\r${Math.min(i + BATCH_SIZE, sets.length)}/${sets.length} sets`,
    );
  }
  process.stdout.write("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
