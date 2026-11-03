import { describe, expect, it } from "vitest";
import {
  applyProgress,
  buildTiles,
  compareTimestamps,
  filterTiles,
  missingParts,
  sortTiles,
  tileKey,
  toBrickLinkXml,
  toLineMap,
  toRebrickableCsv,
} from "./tiles";
import type { CheckLine } from "./types";

let nextId = 1;
function line(overrides: Partial<CheckLine>): CheckLine {
  return {
    check_id: "c1",
    set_part_id: nextId++,
    part_num: "3001",
    part_name: "Brick 2 x 4",
    part_cat_id: 11,
    color_id: 4,
    color_name: "Red",
    color_rgb: "C91A09",
    is_trans: false,
    img_url: null,
    element_id: null,
    bricklink_part_id: "3001",
    bricklink_color_id: 5,
    quantity: 1,
    is_spare: false,
    fig_num: null,
    found_qty: 0,
    updated_at: null,
    ...overrides,
  };
}

describe("buildTiles", () => {
  it("merges set, minifig and spare lines of one part + color", () => {
    const lines = toLineMap([
      line({ quantity: 3, found_qty: 1 }),
      line({ quantity: 1, fig_num: "fig-1" }),
      line({ quantity: 1, is_spare: true }),
      line({
        part_num: "3626",
        color_id: 14,
        color_name: "Yellow",
        quantity: 1,
      }),
    ]);
    const tiles = buildTiles(lines);
    expect(tiles).toHaveLength(2);
    const red = tiles.find((t) => t.key === tileKey("3001", 4))!;
    expect(red).toMatchObject({
      needed: 5,
      found: 1,
      has_minifig_lines: true,
      has_spare_lines: true,
    });
  });

  it("adds pending deltas, clamped to the tile", () => {
    const lines = toLineMap([line({ quantity: 2, found_qty: 1 })]);
    expect(buildTiles(lines, new Map([[tileKey("3001", 4), 5]]))[0].found).toBe(
      2,
    );
    expect(
      buildTiles(lines, new Map([[tileKey("3001", 4), -5]]))[0].found,
    ).toBe(0);
  });
});

describe("progress merging", () => {
  const t1 = "2026-11-03T10:00:00.1+00:00";
  const t2 = "2026-11-03T10:00:00.100001+00:00";

  it("compares microsecond timestamps", () => {
    expect(compareTimestamps(t2, t1)).toBeGreaterThan(0);
    expect(compareTimestamps(t1, "2026-11-03T10:00:00.100000+00:00")).toBe(0);
  });

  it("ignores updates older than the held value", () => {
    const l = line({ found_qty: 2, updated_at: t2 });
    const lines = toLineMap([l]);
    expect(
      applyProgress(lines, [
        { set_part_id: l.set_part_id, found_qty: 1, updated_at: t1 },
      ]),
    ).toBe(lines);
    const next = applyProgress(lines, [
      {
        set_part_id: l.set_part_id,
        found_qty: 3,
        updated_at: "2026-11-03T10:00:01+00:00",
      },
    ]);
    expect(next.get(l.set_part_id)!.found_qty).toBe(3);
  });
});

describe("filter and sort", () => {
  const tiles = buildTiles(
    toLineMap([
      line({ part_num: "3001", quantity: 2, found_qty: 2 }),
      line({
        part_num: "3004",
        part_name: "Brick 1 x 2",
        color_id: 1,
        color_name: "Blue",
        quantity: 5,
        found_qty: 1,
      }),
      line({
        part_num: "3010",
        part_name: "Brick 1 x 4",
        color_id: 4,
        quantity: 2,
      }),
    ]),
  );

  it("hides complete tiles and searches name, number and color", () => {
    expect(
      filterTiles(tiles, { query: "", colorId: null, hideComplete: true }).map(
        (t) => t.part_num,
      ),
    ).toEqual(["3004", "3010"]);
    expect(
      filterTiles(tiles, { query: "blue", colorId: null, hideComplete: false }),
    ).toHaveLength(1);
    expect(
      filterTiles(tiles, { query: "", colorId: 4, hideComplete: false }),
    ).toHaveLength(2);
  });

  it("sorts complete tiles last", () => {
    expect(sortTiles(tiles, "remaining").map((t) => t.part_num)).toEqual([
      "3004",
      "3010",
      "3001",
    ]);
    expect(sortTiles(tiles, "part").at(-1)!.part_num).toBe("3001");
  });
});

describe("exports", () => {
  const tiles = buildTiles(
    toLineMap([
      line({ part_num: "3001", quantity: 3, found_qty: 1 }),
      line({ part_num: "x<1>", bricklink_part_id: null, quantity: 1 }),
      line({ part_num: "3002", quantity: 1, found_qty: 1 }),
    ]),
  );
  const missing = missingParts(tiles);

  it("lists only what is missing", () => {
    expect(missing.map((m) => [m.tile.part_num, m.missing])).toEqual([
      ["3001", 2],
      ["x<1>", 1],
    ]);
  });

  it("writes Rebrickable CSV", () => {
    expect(toRebrickableCsv(missing)).toBe(
      "Part,Color,Quantity\n3001,4,2\nx<1>,4,1\n",
    );
  });

  it("writes BrickLink XML and reports parts without BrickLink ids", () => {
    const { xml, skipped } = toBrickLinkXml(missing);
    expect(xml).toContain("<ITEMID>3001</ITEMID>");
    expect(xml).toContain("<COLOR>5</COLOR>");
    expect(xml).toContain("<MINQTY>2</MINQTY>");
    expect(skipped.map((s) => s.tile.part_num)).toEqual(["x<1>"]);
  });
});
