import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTranslator,
  formatDate,
  formatDayMonth,
  formatNumber,
  getStoredLanguage,
  resolveLanguage,
  storeLanguage,
  type Messages,
} from "./i18n";
import { en } from "./messages/en";
import { nl } from "./messages/nl";

// Keys that exist only for these tests; the translator takes any Messages.
const sampleEn = {
  "test.greeting": "Hello {name}",
  "test.sets": { one: "{count} set", other: "{count} sets" },
} as unknown as Messages;
const sampleNl = {
  "test.greeting": "Hallo {name}",
  "test.sets": { one: "{count} set", other: "{count} sets" },
} as unknown as Messages;
const key = (k: string) => k as never;

describe("t", () => {
  it("fills in placeholders", () => {
    const t = createTranslator("nl", sampleNl, sampleEn);
    expect(t(key("test.greeting"), { name: "Sam" })).toBe("Hallo Sam");
  });

  it("picks the plural form of the language", () => {
    const tEn = createTranslator("en", sampleEn, sampleEn);
    expect(tEn(key("test.sets"), { count: 1 })).toBe("1 set");
    expect(tEn(key("test.sets"), { count: 2 })).toBe("2 sets");
    expect(tEn(key("test.sets"), { count: 0 })).toBe("0 sets");
    const tNl = createTranslator("nl", sampleNl, sampleEn);
    expect(tNl(key("test.sets"), { count: 1 })).toBe("1 set");
    expect(tNl(key("test.sets"), { count: 3 })).toBe("3 sets");
  });

  it("falls back to the English text for a key missing in Dutch", () => {
    const t = createTranslator("nl", {} as Messages, sampleEn);
    expect(t(key("test.greeting"), { name: "Sam" })).toBe("Hello Sam");
    expect(t(key("test.sets"), { count: 2 })).toBe("2 sets");
  });

  it("formats numeric params for the language", () => {
    const tEn = createTranslator("en", sampleEn, sampleEn);
    expect(tEn(key("test.sets"), { count: 1234 })).toBe("1,234 sets");
    const tNl = createTranslator("nl", sampleNl, sampleEn);
    expect(tNl(key("test.sets"), { count: 1234 })).toBe("1.234 sets");
    expect(tNl(key("test.greeting"), { name: "1234" })).toBe("Hallo 1234");
  });

  it("never shows blank for an unknown key", () => {
    const t = createTranslator("nl", {} as Messages, {} as Messages);
    expect(t(key("nope"))).toBe("nope");
  });

  it("translates the Account page into Dutch", () => {
    const t = createTranslator("nl", nl, en);
    expect(t("account.title")).toBe("Account");
    expect(t("account.signOut")).toBe("Uitloggen");
  });
});

describe("language choice", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses Dutch for any nl browser language, English otherwise", () => {
    expect(resolveLanguage(null, ["nl-BE", "en"])).toBe("nl");
    expect(resolveLanguage(null, ["NL"])).toBe("nl");
    expect(resolveLanguage(null, ["en-GB"])).toBe("en");
    expect(resolveLanguage(null, ["de-DE", "fr"])).toBe("en");
    expect(resolveLanguage(null, [])).toBe("en");
  });

  it("lets a saved choice override the browser", () => {
    expect(resolveLanguage("en", ["nl"])).toBe("en");
    expect(resolveLanguage("nl", ["en-US"])).toBe("nl");
  });

  it("ignores a saved value that is not a language", () => {
    expect(resolveLanguage("klingon", ["nl"])).toBe("nl");
  });

  it("remembers the choice on this device", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    });
    expect(getStoredLanguage()).toBeNull();
    storeLanguage("nl");
    expect(getStoredLanguage()).toBe("nl");
  });

  it("works when storage is blocked", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });
    expect(getStoredLanguage()).toBeNull();
    expect(() => storeLanguage("nl")).not.toThrow();
  });
});

describe("dates and numbers", () => {
  it("follow the language", () => {
    const day = "2026-11-03T12:00:00Z";
    expect(formatDayMonth("en", day)).toBe("3 Nov");
    expect(formatDayMonth("nl", day)).toBe("3 nov");
    // English numeric dates follow the browser locale, Dutch is always nl-NL.
    expect(formatDate("en", day)).toBe(
      new Intl.DateTimeFormat(undefined).format(new Date(day)),
    );
    expect(formatDate("nl", day)).toBe("3-11-2026");
    expect(formatNumber("en", 1234567.5)).toBe("1,234,567.5");
    expect(formatNumber("nl", 1234567.5)).toBe("1.234.567,5");
  });
});

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const textOf = (value: string | Record<string, string>) =>
  typeof value === "string" ? value : Object.values(value).join(" ");

describe("translation parity", () => {
  const enKeys = Object.keys(en) as (keyof typeof en)[];

  it("has a Dutch text for every English key", () => {
    expect(enKeys.filter((k) => !(k in nl))).toEqual([]);
  });

  it("has no Dutch key that English lacks", () => {
    expect(Object.keys(nl).filter((k) => !(k in en))).toEqual([]);
  });

  it("uses the same placeholders in both languages", () => {
    const differing = enKeys.filter(
      (k) =>
        k in nl &&
        placeholders(textOf(en[k])).join() !==
          placeholders(textOf(nl[k])).join(),
    );
    expect(differing).toEqual([]);
  });

  it("gives every plural the forms its language needs", () => {
    for (const [lang, messages] of [
      ["en", en],
      ["nl", nl],
    ] as const) {
      const needed = new Intl.PluralRules(lang).resolvedOptions()
        .pluralCategories;
      const incomplete = Object.entries(messages).filter(
        ([, v]) => typeof v !== "string" && !needed.every((c) => c in v),
      );
      expect(incomplete).toEqual([]);
    }
  });
});
