import { describe, expect, it } from "vitest";
import {
  applyProgress,
  groupParts,
  compareTimestamps,
  filterParts,
  applyCheckProgress,
  missingAcrossChecks,
  searchMissingAcross,
  missingParts,
  sortParts,
  partKey,
  partLabel,
  toBrickLinkXml,
  toLineMap,
  toRebrickableCsv,
} from "./parts";
import type { CheckSummary, InventoryLine } from "./types";

let nextId = 1;
function line(overrides: Partial<InventoryLine>): InventoryLine {
  return {
    check_id: "c1",
    line_id: nextId++,
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

describe("groupParts", () => {
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
    const parts = groupParts(lines);
    expect(parts).toHaveLength(2);
    const red = parts.find((p) => p.key === partKey("3001", 4))!;
    expect(red).toMatchObject({
      needed: 5,
      found: 1,
      has_minifig_lines: true,
      has_spare_lines: true,
    });
  });

  it("adds pending deltas, clamped to the part", () => {
    const lines = toLineMap([line({ quantity: 2, found_qty: 1 })]);
    expect(groupParts(lines, new Map([[partKey("3001", 4), 5]]))[0].found).toBe(
      2,
    );
    expect(
      groupParts(lines, new Map([[partKey("3001", 4), -5]]))[0].found,
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
        { line_id: l.line_id, found_qty: 1, updated_at: t1 },
      ]),
    ).toBe(lines);
    const next = applyProgress(lines, [
      {
        line_id: l.line_id,
        found_qty: 3,
        updated_at: "2026-11-03T10:00:01+00:00",
      },
    ]);
    expect(next.get(l.line_id)!.found_qty).toBe(3);
  });
});

describe("filter and sort", () => {
  const parts = groupParts(
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

  it("hides fully found parts and searches name, number and color", () => {
    expect(
      filterParts(parts, { query: "", colorId: null, hideFound: true }).map(
        (p) => p.part_num,
      ),
    ).toEqual(["3004", "3010"]);
    expect(
      filterParts(parts, { query: "blue", colorId: null, hideFound: false }),
    ).toHaveLength(1);
    expect(
      filterParts(parts, { query: "", colorId: 4, hideFound: false }),
    ).toHaveLength(2);
  });

  it("sorts fully found parts last", () => {
    expect(sortParts(parts, "missing").map((p) => p.part_num)).toEqual([
      "3004",
      "3010",
      "3001",
    ]);
    expect(sortParts(parts, "part").at(-1)!.part_num).toBe("3001");
  });
});

describe("exports", () => {
  const parts = groupParts(
    toLineMap([
      line({ part_num: "3001", quantity: 3, found_qty: 1 }),
      line({ part_num: "x<1>", bricklink_part_id: null, quantity: 1 }),
      line({ part_num: "3002", quantity: 1, found_qty: 1 }),
    ]),
  );
  const missing = missingParts(parts);

  it("lists only what is missing", () => {
    expect(missing.map((m) => [m.part.part_num, m.missing])).toEqual([
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
    expect(skipped.map((s) => s.part.part_num)).toEqual(["x<1>"]);
  });
});

describe("partLabel", () => {
  it("names a part by name and color", () => {
    expect(partLabel({ part_name: "Brick 2 x 4", color_name: "Red" })).toBe(
      "Brick 2 x 4, Red",
    );
  });
});

function check(
  id: string,
  overrides: Partial<CheckSummary> = {},
): CheckSummary {
  return {
    id,
    owner_id: "u1",
    set_num: "1-1",
    title: `Check ${id}`,
    include_spares: false,
    include_minifigs: true,
    created_at: "2026-11-01T00:00:00Z",
    set_name: "Test set",
    set_year: 2026,
    set_img_url: null,
    my_role: "owner",
    needed: 0,
    found: 0,
    ...overrides,
  };
}

describe("missingAcrossChecks", () => {
  it("lists every Check a missing part goes to, with what each still needs", () => {
    const missing = missingAcrossChecks(
      [check("a", { title: "House" }), check("b", { title: "Castle" })],
      [
        line({ check_id: "a", quantity: 4, found_qty: 1 }),
        line({ check_id: "b", quantity: 2, found_qty: 1 }),
      ],
    );
    expect(missing).toHaveLength(1);
    expect(missing[0].part.part_name).toBe("Brick 2 x 4");
    expect(missing[0].missing).toBe(4);
    expect(missing[0].checks).toEqual([
      { checkId: "a", label: "House", missing: 3, canTickOff: true },
      { checkId: "b", label: "Castle", missing: 1, canTickOff: true },
    ]);
  });

  it("lists Checks you only view without letting you tick off, and skips fully found ones", () => {
    const missing = missingAcrossChecks(
      [check("a", { my_role: "viewer" }), check("b", { my_role: "helper" })],
      [
        line({ check_id: "a", quantity: 2, found_qty: 0 }),
        line({ check_id: "b", quantity: 2, found_qty: 2 }),
      ],
    );
    expect(missing.map((m) => m.checks)).toEqual([
      [{ checkId: "a", label: "Check a", missing: 2, canTickOff: false }],
    ]);
  });

  it("orders parts by color and, per part, the Check needing the most first", () => {
    const missing = missingAcrossChecks(
      [check("a"), check("b")],
      [
        line({ check_id: "a", color_id: 4, color_name: "Red", quantity: 1 }),
        line({ check_id: "b", color_id: 4, color_name: "Red", quantity: 3 }),
        line({ check_id: "a", color_id: 1, color_name: "Blue", quantity: 1 }),
      ],
    );
    expect(missing.map((m) => m.part.color_name)).toEqual(["Blue", "Red"]);
    expect(missing[1].checks.map((c) => c.checkId)).toEqual(["b", "a"]);
  });

  it("tells apart Checks with the same title (two copies of one Set) by start date", () => {
    const missing = missingAcrossChecks(
      [
        check("a", { title: "House", created_at: "2026-11-01T09:00:00Z" }),
        check("b", { title: "House", created_at: "2026-11-03T09:00:00Z" }),
      ],
      [
        line({ check_id: "a", quantity: 1 }),
        line({ check_id: "b", quantity: 2 }),
      ],
    );
    expect(missing[0].checks.map((c) => c.label)).toEqual([
      "House (started 3 Nov)",
      "House (started 1 Nov)",
    ]);
  });

  it("searches by name, number or color and totals what is shown", () => {
    const missing = missingAcrossChecks(
      [check("a"), check("b")],
      [
        line({ check_id: "a", quantity: 2 }),
        line({ check_id: "b", quantity: 1 }),
        line({
          check_id: "a",
          part_num: "3004",
          part_name: "Brick 1 x 2",
          color_id: 1,
          color_name: "Blue",
          quantity: 3,
        }),
      ],
    );
    expect(
      searchMissingAcross(missing, { query: "red", colorId: null }),
    ).toMatchObject({
      parts: [{ part: { part_num: "3001" } }],
      pieces: 3,
      checks: 2,
    });
    expect(
      searchMissingAcross(missing, { query: "", colorId: null }),
    ).toMatchObject({ pieces: 6, checks: 2 });
    expect(
      searchMissingAcross(missing, { query: "3004", colorId: null }).parts.map(
        (m) => m.part.part_name,
      ),
    ).toEqual(["Brick 1 x 2"]);
    expect(
      searchMissingAcross(missing, { query: "", colorId: 1 }),
    ).toMatchObject({
      parts: [{ part: { color_name: "Blue" } }],
      pieces: 3,
      checks: 1,
    });
  });

  it("applies a tick-off to its own Check only, though Checks of one Set share line ids", () => {
    const lines = [
      line({ check_id: "a", line_id: 7, quantity: 2 }),
      line({ check_id: "b", line_id: 7, quantity: 2 }),
    ];
    const next = applyCheckProgress(lines, "b", [
      { line_id: 7, found_qty: 1, updated_at: "2026-11-04T10:00:00Z" },
    ]);
    expect(next.map((l) => [l.check_id, l.found_qty])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
  });
});
