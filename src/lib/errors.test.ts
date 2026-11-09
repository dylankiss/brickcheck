import { describe, expect, it } from "vitest";
import { ApiError, fail, translateError } from "./errors";
import { setActiveLanguage } from "./i18n";
import { en } from "./messages/en";
import { nl } from "./messages/nl";

const raw = (glob: Record<string, unknown>) => Object.values(glob).join("\n");
const migrations = raw(
  import.meta.glob("../../supabase/migrations/*.sql", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);
const functions = raw(
  import.meta.glob(
    [
      "../../supabase/functions/**/*.ts",
      "!../../supabase/functions/**/*.test.ts",
    ],
    { query: "?raw", import: "default", eager: true },
  ),
);
const client = raw(
  import.meta.glob("./api.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);

const errorKeys = Object.keys(en).filter((k) =>
  k.startsWith("errors."),
) as (keyof typeof en)[];
const plain = (key: keyof typeof en) => en[key] as string;
const dutch = (key: keyof typeof en) => nl[key] as string;
// A text with its {placeholders} filled in with a sample value.
const sample = (text: string) => text.replace(/\{\w+\}/g, "X1");

describe("translateError", () => {
  it("translates every known message into Dutch", () => {
    expect(errorKeys.length).toBeGreaterThan(20);
    for (const key of errorKeys) {
      expect(translateError(sample(plain(key)), "nl"), key).toBe(
        sample(dutch(key)),
      );
      expect(dutch(key), key).not.toBe("");
    }
  });

  it("shows English known messages with the punctuation of their text", () => {
    for (const key of errorKeys) {
      const text = sample(plain(key));
      expect(translateError(text, "en"), key).toBe(text);
      // The server leaves a final full stop off.
      expect(translateError(text.replace(/\.$/, ""), "en"), key).toBe(text);
    }
    // A sentence ends with a full stop, a fragment does not.
    expect(translateError("Only an owner can delete the group", "en")).toBe(
      "Only an owner can delete the group.",
    );
    expect(translateError("Invalid delta", "en")).toBe("Invalid delta");
  });

  it("carries the values of a message into the Dutch text", () => {
    expect(
      translateError("Catalog set 75192-1 has no cached inventory yet", "nl"),
    ).toBe(dutch("errors.noCachedInventory").replace("{setNum}", "75192-1"));
    expect(translateError("Part 3001/4 is not part of this set", "nl")).toBe(
      dutch("errors.partNotInSet")
        .replace("{partNum}", "3001")
        .replace("{colorId}", "4"),
    );
  });

  it("shows an unknown message in English, never blank", () => {
    expect(translateError("Something new broke", "nl")).toBe(
      "Something new broke",
    );
    expect(translateError("", "nl")).toBe(dutch("errors.generic"));
    expect(translateError("", "en")).toBe(plain("errors.generic"));
  });

  it("matches a message with or without a final full stop", () => {
    expect(translateError("Not logged in.", "nl")).toBe(
      dutch("errors.notLoggedIn"),
    );
    expect(translateError("Not logged in", "nl")).toBe(
      dutch("errors.notLoggedIn"),
    );
    // An unknown message is shown as it came, punctuation included.
    expect(translateError("Already done!", "en")).toBe("Already done!");
  });

  it("does not match a known message inside a longer one", () => {
    const longer = "Not logged in, really";
    expect(translateError(longer, "nl")).toBe(longer);
  });

  it("follows the active language when an error is thrown", () => {
    setActiveLanguage("nl");
    try {
      expect(() => fail({ message: "Not logged in" })).toThrow(
        dutch("errors.notLoggedIn"),
      );
      expect(new ApiError("Only an owner can delete the group").message).toBe(
        dutch("errors.groupDeleteOwnerOnly"),
      );
      expect(() => fail(null)).toThrow(dutch("errors.generic"));
      expect(() => fail({ message: "Unheard of" })).toThrow("Unheard of");
    } finally {
      setActiveLanguage("en");
    }
    expect(() => fail({ message: "Not logged in" })).toThrow("Not logged in");
  });
});

describe("known messages stay in sync with the server", () => {
  // `%` in a raise exception is where the database fills in a value.
  const raised = [
    ...migrations.matchAll(/raise exception\s+'((?:[^']|'')*)'/g),
  ].map((m) => (m[1] ?? "").replaceAll("''", "'").replaceAll("%", "X1"));

  it("finds the raise exception texts", () => {
    expect(raised.length).toBeGreaterThanOrEqual(20);
  });

  it("translates every raise exception text of the migrations", () => {
    expect(
      raised.filter((message) => translateError(message, "nl") === message),
    ).toEqual([]);
  });

  it("translates every Edge Function message", () => {
    const messages = [
      ...functions.matchAll(/HttpError\(\s*\d+,\s*"([^"]+)"/g),
      // The 404 text `Rebrickable.get` takes as an argument.
      ...functions.matchAll(/"(Set not found on Rebrickable)"/g),
    ].map((m) => m[1] ?? "");
    expect(messages.length).toBeGreaterThan(10);
    expect(
      messages.filter((message) => translateError(message, "nl") === message),
    ).toEqual([]);
  });

  it("has no known message that no source has any more", () => {
    const corpus = (migrations + functions + client).replaceAll("''", "'");
    // The generic text is the fallback written in lib/errors.ts itself.
    const stale = errorKeys.filter(
      (key) =>
        key !== "errors.generic" &&
        // The server writes a message without the final full stop.
        plain(key)
          .replace(/\.$/, "")
          .split(/\{\w+\}/)
          .some(
            (part) => part !== "" && !corpus.includes(part.replace("%", "")),
          ),
    );
    expect(stale).toEqual([]);
  });
});
