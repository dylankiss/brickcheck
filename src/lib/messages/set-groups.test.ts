import { describe, expect, it } from "vitest";
import { createTranslator } from "../i18n";
import { en } from "./en";
import { nl } from "./nl";

const tNl = createTranslator("nl", nl, en);
const tEn = createTranslator("en", en, en);

describe("set and groups texts", () => {
  it("counts pieces, parts and sets in both languages", () => {
    expect(tEn("set.count.pieces", { count: 1 })).toBe("1 piece");
    expect(tEn("set.count.pieces", { count: 3 })).toBe("3 pieces");
    expect(tNl("set.count.pieces", { count: 1 })).toBe("1 stukje");
    expect(tNl("set.count.pieces", { count: 3 })).toBe("3 stukjes");
    expect(tNl("set.count.parts", { count: 1 })).toBe("1 onderdeel");
    expect(tNl("set.count.parts", { count: 2 })).toBe("2 onderdelen");
    expect(tNl("set.count.sets", { count: 2 })).toBe("2 sets");
  });

  it("agrees the leave warning with one or several sets", () => {
    expect(tNl("groups.leave.added", { count: 1 })).toContain("deze set");
    expect(tNl("groups.leave.added", { count: 2 })).toContain("deze sets");
    expect(tEn("groups.leave.added", { count: 1 })).toContain("this set");
  });

  it("names the start date of a set in the language", () => {
    expect(tNl("set.missing.started", { title: "House", date: "3 nov" })).toBe(
      "House (gestart op 3 nov)",
    );
    expect(tEn("set.missing.started", { title: "House", date: "3 Nov" })).toBe(
      "House (started 3 Nov)",
    );
  });
});
