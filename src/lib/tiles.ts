// Pure logic for the check screen: lines -> tiles, filtering, sorting, exports.
// Which lines count is decided in SQL (check_lines); nothing here re-implements it.
import type { CheckLine, LineProgress } from "./types";

/** All lines of one part + color, as shown on one tile. */
export interface Tile {
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

export type SortMode = "color" | "part" | "remaining";

export interface TileFilter {
  query: string;
  colorId: number | null;
  hideComplete: boolean;
}

export const tileKey = (partNum: string, colorId: number) =>
  `${partNum}|${colorId}`;

export type LineMap = ReadonlyMap<number, CheckLine>;

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

export function toLineMap(lines: CheckLine[]): LineMap {
  return new Map(lines.map((line) => [line.set_part_id, line]));
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
  let next: Map<number, CheckLine> | null = null;
  for (const update of updates) {
    const line = (next ?? lines).get(update.set_part_id);
    if (!line) continue;
    if (isNewer(line.updated_at, update.updated_at)) continue;
    if (
      line.found_qty === update.found_qty &&
      line.updated_at === update.updated_at
    )
      continue;
    next ??= new Map(lines);
    next.set(update.set_part_id, {
      ...line,
      found_qty: update.found_qty,
      updated_at: update.updated_at,
    });
  }
  return next ?? lines;
}

/**
 * Merges a full refetch into the held lines, keeping held values that are
 * newer than the fetched ones (a broadcast may arrive while the fetch runs).
 */
export function mergeFetchedLines(
  lines: LineMap,
  fetched: CheckLine[],
): LineMap {
  return new Map(
    fetched.map((line) => {
      const held = lines.get(line.set_part_id);
      const keepHeld = held && isNewer(held.updated_at, line.updated_at);
      return [
        line.set_part_id,
        keepHeld
          ? { ...line, found_qty: held.found_qty, updated_at: held.updated_at }
          : line,
      ];
    }),
  );
}

/** Groups lines into tiles; `pending` holds unacknowledged deltas per tile key. */
export function buildTiles(
  lines: LineMap,
  pending: ReadonlyMap<string, number> = new Map(),
): Tile[] {
  const tiles = new Map<string, Tile>();
  for (const line of lines.values()) {
    const key = tileKey(line.part_num, line.color_id);
    let tile = tiles.get(key);
    if (!tile) {
      tile = {
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
      tiles.set(key, tile);
    }
    tile.needed += line.quantity;
    tile.found += line.found_qty;
    tile.img_url ??= line.img_url;
    tile.has_minifig_lines ||= line.fig_num !== null;
    tile.has_spare_lines ||= line.is_spare;
  }
  for (const [key, delta] of pending) {
    const tile = tiles.get(key);
    if (tile)
      tile.found = Math.min(tile.needed, Math.max(0, tile.found + delta));
  }
  return [...tiles.values()];
}

export function totals(tiles: Tile[]): { needed: number; found: number } {
  return tiles.reduce(
    (sum, t) => ({ needed: sum.needed + t.needed, found: sum.found + t.found }),
    {
      needed: 0,
      found: 0,
    },
  );
}

export const isComplete = (tile: Tile) => tile.found >= tile.needed;

export function filterTiles(tiles: Tile[], filter: TileFilter): Tile[] {
  const query = filter.query.trim().toLowerCase();
  return tiles.filter(
    (t) =>
      (!filter.hideComplete || !isComplete(t)) &&
      (filter.colorId === null || t.color_id === filter.colorId) &&
      (!query ||
        t.part_num.toLowerCase().includes(query) ||
        t.part_name.toLowerCase().includes(query) ||
        t.color_name.toLowerCase().includes(query)),
  );
}

export function sortTiles(tiles: Tile[], mode: SortMode): Tile[] {
  const byPart = (a: Tile, b: Tile) =>
    a.part_num.localeCompare(b.part_num, undefined, { numeric: true }) ||
    a.color_name.localeCompare(b.color_name);
  const compare: Record<SortMode, (a: Tile, b: Tile) => number> = {
    color: (a, b) => a.color_name.localeCompare(b.color_name) || byPart(a, b),
    part: byPart,
    remaining: (a, b) =>
      b.needed - b.found - (a.needed - a.found) || byPart(a, b),
  };
  // Completed tiles always sink to the bottom.
  return [...tiles].sort(
    (a, b) =>
      Number(isComplete(a)) - Number(isComplete(b)) || compare[mode](a, b),
  );
}

/** Distinct colors present in the tiles, for the color filter. */
export function tileColors(
  tiles: Tile[],
): { id: number; name: string; rgb: string | null }[] {
  const colors = new Map<
    number,
    { id: number; name: string; rgb: string | null }
  >();
  for (const t of tiles)
    colors.set(t.color_id, {
      id: t.color_id,
      name: t.color_name,
      rgb: t.color_rgb,
    });
  return [...colors.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface MissingPart {
  tile: Tile;
  missing: number;
}

export function missingParts(tiles: Tile[]): MissingPart[] {
  return sortTiles(tiles, "color")
    .filter((tile) => !isComplete(tile))
    .map((tile) => ({ tile, missing: tile.needed - tile.found }));
}

/** Rebrickable's CSV import format (Part, Color, Quantity with Rebrickable ids). */
export function toRebrickableCsv(missing: MissingPart[]): string {
  const rows = missing.map(
    ({ tile, missing: qty }) =>
      `${csvField(tile.part_num)},${tile.color_id},${qty}`,
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
    const { tile, missing: qty } = entry;
    if (!tile.bricklink_part_id || tile.bricklink_color_id === null) {
      skipped.push(entry);
      continue;
    }
    items.push(
      "  <ITEM>\n" +
        "    <ITEMTYPE>P</ITEMTYPE>\n" +
        `    <ITEMID>${xmlEscape(tile.bricklink_part_id)}</ITEMID>\n` +
        `    <COLOR>${tile.bricklink_color_id}</COLOR>\n` +
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
