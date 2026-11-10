import { describe, expect, it } from "vitest";
import { setThumbnailUrl } from "./images";

describe("setThumbnailUrl", () => {
  const original = "https://cdn.rebrickable.com/media/sets/41703-1.jpg";

  it("asks the proxy for a WebP at twice the box, never enlarged", () => {
    const url = new URL(setThumbnailUrl(original, 64)!);
    expect(url.origin).toBe("https://wsrv.nl");
    expect(url.searchParams.get("url")).toBe(original);
    expect(url.searchParams.get("w")).toBe("128");
    expect(url.searchParams.get("h")).toBe("128");
    expect(url.searchParams.get("fit")).toBe("inside");
    expect(url.searchParams.get("output")).toBe("webp");
    expect(url.searchParams.has("we")).toBe(true);
  });

  it("leaves other addresses and a missing picture alone", () => {
    const part = "https://cdn.rebrickable.com/media/parts/elements/6450822.jpg";
    expect(setThumbnailUrl(part, 64)).toBe(part);
    expect(setThumbnailUrl(null, 64)).toBeNull();
  });
});
