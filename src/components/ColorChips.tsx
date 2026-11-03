import type { ReactNode } from "react";
import type { PartColor } from "../lib/parts";
import { ColorSwatch } from "./ui";

/** A horizontally scrolling row of filter chips: any leading ones, then one per color; tap a color again to clear it. */
export function ColorChips({
  colors,
  colorId,
  onColorChange,
  children,
}: {
  colors: PartColor[];
  colorId: number | null;
  onColorChange: (colorId: number | null) => void;
  children?: ReactNode;
}) {
  return (
    // Vertical padding keeps the chips' outlines inside the scroll area, which clips them.
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 text-sm">
      {children}
      {colors.map((color) => (
        <Chip
          key={color.id}
          active={colorId === color.id}
          onClick={() => onColorChange(colorId === color.id ? null : color.id)}
        >
          <ColorSwatch rgb={color.rgb} className="size-3.5" />
          {color.name}
        </Chip>
      ))}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 ring-1 ${
        active
          ? "bg-neutral-900 text-white ring-neutral-900 dark:bg-white dark:text-neutral-900"
          : "ring-neutral-300 dark:ring-neutral-700"
      }`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
