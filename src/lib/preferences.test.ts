import { describe, expect, it } from "vitest";
import { parsePreference } from "./preferences";

describe("parsePreference", () => {
  it("falls back to the default when nothing is stored", () => {
    expect(parsePreference("cardSize", null)).toBe("compact");
    expect(parsePreference("hideFound", null)).toBe(true);
  });

  it("reads back what was stored", () => {
    expect(parsePreference("cardSize", "large")).toBe("large");
    expect(parsePreference("hideFound", "0")).toBe(false);
    expect(parsePreference("hideFound", "1")).toBe(true);
  });

  it("ignores a stored value it does not know", () => {
    expect(parsePreference("cardSize", "huge")).toBe("compact");
    expect(parsePreference("hideFound", "maybe")).toBe(true);
  });
});
