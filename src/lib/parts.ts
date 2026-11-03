// Pure logic for Checks: lines -> parts, filtering, sorting, missing lists (one Check or all), exports.
// Which lines count is decided in SQL (check_lines); nothing here re-implements it.
import type {
  CheckRole,
  CheckSummary,
  InventoryLine,
  LineProgress,
} from "./types";

/** One part (part number + color), summed over its inventory lines. */
export interface Part {
  key: string;
  part_num: string;
  part_name: string;
  part_cat_id: number | null;
  color_id: number;
  color_name: string;
  color_rgb: string | null;
  is_trans: boolean;
  img_url: string | null;
  bricklink_part_id: string | null;
  bricklink_color_id: number | null;
  needed: number;
  found: number;
  has_minifig_lines: boolean;
  has_spare_lines: boolean;
}

export type SortMode = "color" | "part" | "missing";

export interface PartFilter {
  query: string;
  colorId: number | null;
  hideFound: boolean;
}

export const partKey = (partNum: string, colorId: number) =>
  `${partNum}|${colorId}`;

/** How a Part is named to people and screen readers: "Brick 2 x 4, Red". */
export const partLabel = (part: Pick<Part, "part_name" | "color_name">) =>
  `${part.part_name}, ${part.color_name}`;

const collator = new Intl.Collator(undefined, { numeric: true });

export type LineMap = ReadonlyMap<number, InventoryLine>;

/**
 * Orders Postgres timestamps (e.g. "2026-11-03T13:22:11.12+00:00") with
 * microsecond precision, which Date alone cannot represent.
 */
export function compareTimestamps(a: string, b: string): number {
  const micros = (ts: string) =>
    Number((/\.(\d+)/.exec(ts)?.[1] ?? "").padEnd(6, "0").slice(3, 6));
  return Date.parse(a) - Date.parse(b) || micros(a) - micros(b);
}

const isNewer = (a: string | null, b: string | null) =>
  a !== null && (b === null || compareTimestamps(a, b) > 0);

export function toLineMap(lines: InventoryLine[]): LineMap {
  return new Map(lines.map((line) => [line.line_id, line]));
}

/**
 * Applies server progress to lines, ignoring updates older than what is held,
 * so out-of-order RPC results and broadcasts cannot move a count backwards.
 * Returns the same map when nothing changed.
 */
export function applyProgress(
  lines: LineMap,
  updates: LineProgress[],
): LineMap {
  let next: Map<number, InventoryLine> | null = null;
  for (const update of updates) {
    const line = (next ?? lines).get(update.line_id);
    if (!line) continue;
    if (isNewer(line.updated_at, update.updated_at)) continue;
    if (
      line.found_qty === update.found_qty &&
      line.updated_at === update.updated_at
    )
      continue;
    next ??= new Map(lines);
    next.set(update.line_id, {
      ...line,
      found_qty: update.found_qty,
      updated_at: update.updated_at,
    });
  }
  return next ?? lines;
}

/** Groups lines into parts; `pending` holds unacknowledged deltas per part key. */
export function groupParts(
  lines: LineMap,
  pending: ReadonlyMap<string, number> = new Map(),
): Part[] {
  const parts = new Map<string, Part>();
  for (const line of lines.values()) {
    const key = partKey(line.part_num, line.color_id);
    let part = parts.get(key);
    if (!part) {
      part = {
        key,
        part_num: line.part_num,
        part_name: line.part_name,
        part_cat_id: line.part_cat_id,
        color_id: line.color_id,
        color_name: line.color_name,
        color_rgb: line.color_rgb,
        is_trans: line.is_trans,
        img_url: line.img_url,
        bricklink_part_id: line.bricklink_part_id,
        bricklink_color_id: line.bricklink_color_id,
        needed: 0,
        found: 0,
        has_minifig_lines: false,
        has_spare_lines: false,
      };
      parts.set(key, part);
    }
    part.needed += line.quantity;
    part.found += line.found_qty;
    part.img_url ??= line.img_url;
    part.has_minifig_lines ||= line.fig_num !== null;
    part.has_spare_lines ||= line.is_spare;
  }
  for (const [key, delta] of pending) {
    const part = parts.get(key);
    if (part)
      part.found = Math.min(part.needed, Math.max(0, part.found + delta));
  }
  return [...parts.values()];
}

export function totals(parts: Part[]): { needed: number; found: number } {
  return parts.reduce(
    (sum, p) => ({ needed: sum.needed + p.needed, found: sum.found + p.found }),
    {
      needed: 0,
      found: 0,
    },
  );
}

export const isAllFound = (part: Part) => part.found >= part.needed;

export function filterParts(parts: Part[], filter: PartFilter): Part[] {
  const query = filter.query.trim().toLowerCase();
  return parts.filter(
    (p) =>
      (!filter.hideFound || !isAllFound(p)) &&
      (filter.colorId === null || p.color_id === filter.colorId) &&
      (!query ||
        p.part_num.toLowerCase().includes(query) ||
        p.part_name.toLowerCase().includes(query) ||
        p.color_name.toLowerCase().includes(query)),
  );
}

export function sortParts(parts: Part[], mode: SortMode): Part[] {
  const byPart = (a: Part, b: Part) =>
    collator.compare(a.part_num, b.part_num) ||
    collator.compare(a.color_name, b.color_name);
  const compare: Record<SortMode, (a: Part, b: Part) => number> = {
    color: (a, b) =>
      collator.compare(a.color_name, b.color_name) || byPart(a, b),
    part: byPart,
    missing: (a, b) =>
      b.needed - b.found - (a.needed - a.found) || byPart(a, b),
  };
  // Fully found parts always sink to the bottom.
  return [...parts].sort(
    (a, b) =>
      Number(isAllFound(a)) - Number(isAllFound(b)) || compare[mode](a, b),
  );
}

/** A color as the filter chips show it. */
export interface PartColor {
  id: number;
  name: string;
  rgb: string | null;
}

/** Distinct colors present in the parts, for the color filter. */
export function partColors(parts: Part[]): PartColor[] {
  const colors = new Map<number, PartColor>();
  for (const p of parts)
    colors.set(p.color_id, {
      id: p.color_id,
      name: p.color_name,
      rgb: p.color_rgb,
    });
  return [...colors.values()].sort((a, b) => collator.compare(a.name, b.name));
}

export interface MissingPart {
  part: Part;
  missing: number;
}

export function missingParts(parts: Part[]): MissingPart[] {
  return sortParts(parts, "color")
    .filter((part) => !isAllFound(part))
    .map((part) => ({ part, missing: part.needed - part.found }));
}

/** A Check is complete when nothing is missing (GLOSSARY.md). */
export const isComplete = (check: Pick<CheckSummary, "found" | "needed">) =>
  check.found >= check.needed;

/** Owners and Helpers tick off parts; Viewers only follow along. */
export const canTickOff = (role: CheckRole | null) =>
  role === "owner" || role === "helper";

/** A Check a missing Part goes to, and how many it still needs there. */
export interface MissingInCheck {
  checkId: string;
  /** The Check's title, with its start date when another Check has the same title. */
  label: string;
  missing: number;
  canTickOff: boolean;
}

/** A Part missing in one or more Checks. */
export interface MissingAcross {
  /** The Part, with needed and found summed over the Checks listed. */
  part: Part;
  missing: number;
  checks: MissingInCheck[];
}

/**
 * Every Part still missing in any of `checks`, with where it goes. Lines are
 * grouped per Check first: two Checks of the same Set share line ids.
 */
export function missingAcrossChecks(
  checks: CheckSummary[],
  lines: InventoryLine[],
): MissingAcross[] {
  const linesByCheck = new Map<string, InventoryLine[]>();
  for (const l of lines) {
    const list = linesByCheck.get(l.check_id) ?? [];
    list.push(l);
    linesByCheck.set(l.check_id, list);
  }
  const titleCount = new Map<string, number>();
  for (const c of checks)
    titleCount.set(c.title, (titleCount.get(c.title) ?? 0) + 1);
  const label = (c: CheckSummary) =>
    titleCount.get(c.title)! > 1
      ? `${c.title} (started ${startDate.format(new Date(c.created_at))})`
      : c.title;
  const result = new Map<string, MissingAcross>();
  for (const c of checks) {
    for (const part of groupParts(toLineMap(linesByCheck.get(c.id) ?? []))) {
      const missing = part.needed - part.found;
      if (missing <= 0) continue;
      let entry = result.get(part.key);
      if (!entry) {
        entry = {
          part: { ...part, needed: 0, found: 0 },
          missing: 0,
          checks: [],
        };
        result.set(part.key, entry);
      }
      entry.part.needed += part.needed;
      entry.part.found += part.found;
      entry.missing += missing;
      entry.checks.push({
        checkId: c.id,
        label: label(c),
        missing,
        canTickOff: canTickOff(c.my_role),
      });
    }
  }
  for (const entry of result.values())
    entry.checks.sort((x, y) => y.missing - x.missing);
  return sortParts(
    [...result.values()].map((entry) => entry.part),
    "color",
  ).map((part) => result.get(part.key)!);
}

const startDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

/** The missing Parts matching a search (name, number or color) and color filter, with totals over them. */
export function searchMissingAcross(
  missing: MissingAcross[],
  { query, colorId }: Pick<PartFilter, "query" | "colorId">,
): { parts: MissingAcross[]; pieces: number; checks: number } {
  const keys = new Set(
    filterParts(
      missing.map((m) => m.part),
      { query, colorId, hideFound: false },
    ).map((p) => p.key),
  );
  const parts = missing.filter((m) => keys.has(m.part.key));
  return {
    parts,
    pieces: parts.reduce((sum, m) => sum + m.missing, 0),
    checks: new Set(parts.flatMap((m) => m.checks.map((c) => c.checkId))).size,
  };
}

/** Applies server progress (an adjust_part result) to the lines of one Check, leaving other Checks alone. */
export function applyCheckProgress(
  lines: InventoryLine[],
  checkId: string,
  updates: LineProgress[],
): InventoryLine[] {
  const own = toLineMap(lines.filter((l) => l.check_id === checkId));
  const next = applyProgress(own, updates);
  if (next === own) return lines;
  return lines.map((l) => (l.check_id === checkId ? next.get(l.line_id)! : l));
}

/** Rebrickable's CSV import format (Part, Color, Quantity with Rebrickable ids). */
export function toRebrickableCsv(missing: MissingPart[]): string {
  const rows = missing.map(
    ({ part, missing: qty }) =>
      `${csvField(part.part_num)},${part.color_id},${qty}`,
  );
  return ["Part,Color,Quantity", ...rows].join("\n") + "\n";
}

const csvField = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/**
 * BrickLink Wanted List XML. Parts without BrickLink ids cannot be expressed
 * and are returned separately so the UI can mention them.
 */
export function toBrickLinkXml(missing: MissingPart[]): {
  xml: string;
  skipped: MissingPart[];
} {
  const skipped: MissingPart[] = [];
  const items: string[] = [];
  for (const entry of missing) {
    const { part, missing: qty } = entry;
    if (!part.bricklink_part_id || part.bricklink_color_id === null) {
      skipped.push(entry);
      continue;
    }
    items.push(
      "  <ITEM>\n" +
        "    <ITEMTYPE>P</ITEMTYPE>\n" +
        `    <ITEMID>${xmlEscape(part.bricklink_part_id)}</ITEMID>\n` +
        `    <COLOR>${part.bricklink_color_id}</COLOR>\n` +
        `    <MINQTY>${qty}</MINQTY>\n` +
        "  </ITEM>",
    );
  }
  return {
    xml: `<INVENTORY>\n${items.join("\n")}${items.length ? "\n" : ""}</INVENTORY>\n`,
    skipped,
  };
}

const xmlEscape = (value: string) =>
  value.replace(
    /[<>&'"]/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[c]!,
  );
