// The built-in avatars: one of three minifigure-head icons on a background
// colour. It is saved on the profile as the two ids joined by a hyphen, such as
// "woman-blue". There is no URL to fetch, so nobody can use a picture to see the
// IP address of the people who look at it.
//
// The icons are "lego" by Musket from the Noun Project (CC BY 3.0, icons 106255,
// 106256 and 106257), traced to SVG and recoloured; the credit is shown on the Account page.

export const AVATAR_ICONS = [
  { id: "head" },
  { id: "man" },
  { id: "woman" },
] as const;

/**
 * LEGO's own colours (the brand colours lego.com uses), as the avatar's background.
 * The head on top is black line art on a light tint of the colour, so the
 * contrast is the same on all of them.
 */
export const AVATAR_COLORS = [
  { id: "red", hex: "#DD1A22" },
  { id: "blue", hex: "#006CB7" },
  { id: "yellow", hex: "#FFD400" },
  { id: "green", hex: "#00AF4D" },
  { id: "orange", hex: "#F47D20" },
  { id: "lavender", hex: "#A591F9" },
  { id: "pink", hex: "#E3599D" },
  { id: "azure", hex: "#00A3DA" },
] as const;

/** A light tint of a colour (`#RRGGBB`), the share of it kept being `amount`. */
function tint(hex: string, amount: number) {
  const channels = [1, 3, 5].map((i) => {
    const value = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(value * amount + 255 * (1 - amount));
  });
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export type AvatarIcon = (typeof AVATAR_ICONS)[number]["id"];
export type AvatarColor = (typeof AVATAR_COLORS)[number]["id"];

export interface AvatarParts {
  icon: AvatarIcon;
  color: AvatarColor;
}

export const DEFAULT_AVATAR: AvatarParts = { icon: "man", color: "blue" };

export function composeAvatar(parts: AvatarParts) {
  return `${parts.icon}-${parts.color}`;
}

/** The icon and colour of a saved id, or null when there is none or it is not one of ours. */
export function avatarChoice(id: string | null | undefined) {
  const [iconId, colorId, ...rest] = (id ?? "").split("-");
  const icon = AVATAR_ICONS.find((i) => i.id === iconId);
  const color = AVATAR_COLORS.find((c) => c.id === colorId);
  if (rest.length > 0 || !icon || !color) {
    return null;
  }
  return {
    icon: icon.id,
    color: color.id,
    hex: color.hex,
    /** The face of the head: the colour, much lighter. */
    face: tint(color.hex, 0.28),
  };
}
