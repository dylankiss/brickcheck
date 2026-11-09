/**
 * The 44px square of an icon-only filter control. `on` inverts it; `marked`
 * only thickens its outline, for a control that shows a color swatch, which
 * must stay on the plain background to be seen.
 */
export const filterButtonClass = (state: "off" | "on" | "marked" = "off") =>
  `relative flex size-11 shrink-0 items-center justify-center rounded-xl focus-within:ring-2 ${
    state === "on"
      ? "bg-neutral-900 text-white ring-1 ring-neutral-900 dark:bg-white dark:text-neutral-900"
      : state === "marked"
        ? "bg-white ring-2 ring-neutral-900 dark:bg-neutral-900 dark:ring-white"
        : "bg-white ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
  }`;
