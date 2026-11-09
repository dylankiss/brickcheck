import { describe, expect, it } from "vitest";
import { createTranslator } from "../i18n";
import { en } from "./en";
import { nl } from "./nl";

const tNl = createTranslator("nl", nl, en);
const tEn = createTranslator("en", en, en);

describe("start screen, My sets and Add a set in Dutch", () => {
  it("counts sets, groups and pieces", () => {
    expect(tNl("sets.count", { count: 1 })).toBe("1 set");
    expect(tNl("sets.count", { count: 2 })).toBe("2 sets");
    expect(tNl("sets.groupCount", { count: 1 })).toBe("1 groep");
    expect(tNl("sets.groupCount", { count: 3 })).toBe("3 groepen");
    expect(tNl("sets.pieces", { count: 1 })).toBe("1 stukje");
    expect(tNl("sets.pieces", { count: 1200 })).toBe("1.200 stukjes");
    expect(tEn("sets.pieces", { count: 1 })).toBe("1 piece");
  });

  it("agrees the verb with the number of missing pieces", () => {
    expect(tNl("sets.home.missing", { count: 1, sets: "1 set" })).toBe(
      "1 stukje ontbreekt in 1 set",
    );
    expect(tNl("sets.home.missing", { count: 4, sets: "2 sets" })).toBe(
      "4 stukjes ontbreken in 2 sets",
    );
  });

  it("uses the glossary words", () => {
    expect(tNl("sets.home.groups")).toBe("Groepen");
    expect(tNl("sets.my.noGroup")).toBe("Niet in een groep");
    expect(tNl("login.email.submit")).toBe("Stuur me een inloglink");
    expect(tNl("sets.join.invited", { name: "Sam", role: "x" })).toContain(
      "uitgenodigd",
    );
  });

  it("shows no English where Dutch exists", () => {
    const same = Object.keys(en).filter(
      (k) =>
        /^(common|login|sets)\./.test(k) &&
        typeof en[k as keyof typeof en] === "string" &&
        nl[k as keyof typeof nl] === en[k as keyof typeof en],
    );
    // Words that are the same in both languages.
    const allowed = [
      "common.update.later",
      "common.online",
      "common.onlineCount",
    ];
    expect(same.filter((k) => !allowed.includes(k))).toEqual([]);
  });
});
