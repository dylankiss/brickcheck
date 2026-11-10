import { describe, expect, it } from "vitest";
import {
  AVATAR_COLORS,
  AVATAR_ICONS,
  avatarChoice,
  composeAvatar,
} from "./avatars";

describe("avatarChoice", () => {
  it("reads the icon and colour of a saved id", () => {
    expect(avatarChoice("woman-pink")).toMatchObject({
      icon: "woman",
      color: "pink",
      hex: "#E3599D",
    });
  });

  it("gives back what composeAvatar made", () => {
    expect(
      avatarChoice(composeAvatar({ icon: "head", color: "azure" })),
    ).toMatchObject({
      icon: "head",
      color: "azure",
    });
  });

  it("ignores no value and ids it does not know", () => {
    expect(avatarChoice(null)).toBeNull();
    expect(avatarChoice(undefined)).toBeNull();
    expect(avatarChoice("red-brick")).toBeNull();
    expect(avatarChoice("man-purple")).toBeNull();
    expect(avatarChoice("man-blue-extra")).toBeNull();
  });

  it("only makes ids the database accepts", () => {
    for (const icon of AVATAR_ICONS) {
      for (const color of AVATAR_COLORS) {
        expect(composeAvatar({ icon: icon.id, color: color.id })).toMatch(
          /^[a-z]{1,12}-[a-z]{1,12}$/,
        );
      }
    }
  });
});
