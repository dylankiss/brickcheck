// Generates every app icon in public/ from one logo definition, so they stay
// consistent. Run with `npm run icons` after changing the logo.
import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const RED = "#d01012";

// The logo on a 512 grid: three studs and a check mark.
const glyph = `<g fill="#ffffff" fill-opacity="0.92">
    <circle cx="176" cy="176" r="72"/>
    <circle cx="336" cy="176" r="72"/>
    <circle cx="176" cy="336" r="72"/>
  </g>
  <path d="M296 340l36 36 72-84" fill="none" stroke="#ffffff" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>`;

/**
 * rounded: transparent corners (favicon, manifest "any" icons).
 * Without it the background is full-bleed, for platforms that apply their
 * own mask (iOS, Android maskable). The logo itself reaches at most 72% of
 * the half-width from the centre, inside the maskable safe zone (80%), so it
 * keeps the same size everywhere.
 */
function svg({ rounded }) {
  const bg = rounded
    ? `<rect width="512" height="512" rx="112" fill="${RED}"/>`
    : `<rect width="512" height="512" fill="${RED}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n  ${bg}\n  ${glyph}\n</svg>\n`;
}

function png(file, size, source) {
  const out = new Resvg(source, { fitTo: { mode: "width", value: size } })
    .render()
    .asPng();
  writeFileSync(new URL(`../public/${file}`, import.meta.url), out);
}

const rounded = svg({ rounded: true });
writeFileSync(new URL("../public/favicon.svg", import.meta.url), rounded);
png("pwa-192x192.png", 192, rounded);
png("pwa-512x512.png", 512, rounded);
// Android and iOS apply their own mask; iOS rounds about like the favicon.
const square = svg({ rounded: false });
png("maskable-512x512.png", 512, square);
png("apple-touch-icon.png", 180, square);
