// Set pictures are 1600px JPEGs of 200 to 330 KB, shown at 60 to 200px. Decoding
// them is what made My sets slow, so lists ask an image proxy for a small WebP
// instead (3 KB). Part pictures are small already and stay as they are.
const PROXY = "https://wsrv.nl/";
const SET_PICTURES = "https://cdn.rebrickable.com/media/sets/";

/**
 * A small copy of a set picture, for a box of `cssPx` pixels (asked for at twice
 * that, for sharp screens, and never enlarged). Any other address comes back
 * unchanged, so a caller can pass whatever it has.
 */
export function setThumbnailUrl(url: string | null, cssPx: number) {
  if (!url?.startsWith(SET_PICTURES)) {
    return url;
  }
  const size = Math.round(cssPx * 2);
  const query = new URLSearchParams({
    url,
    w: String(size),
    h: String(size),
    fit: "inside",
    output: "webp",
    q: "80",
  });
  // `we` (without enlargement) is a flag, not a key=value pair.
  return `${PROXY}?${query}&we`;
}
