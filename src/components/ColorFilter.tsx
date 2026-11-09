import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { PartColor } from "../lib/parts";
import { filterButtonClass } from "./filterButton";
import { ColorSwatch, PaletteIcon } from "./ui";

/**
 * The color filter: an icon-only button, a palette or, once a color is chosen,
 * its swatch. It opens the picker, where "All colors" clears the choice.
 */
export function ColorFilter({
  colors,
  colorId,
  onColorChange,
}: {
  colors: PartColor[];
  colorId: number | null;
  onColorChange: (colorId: number | null) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const chosen = colors.find((c) => c.id === colorId) ?? null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={filterButtonClass(chosen ? "marked" : "off")}
        aria-haspopup="dialog"
        aria-label={
          chosen
            ? t("set.filter.colorActive", { name: chosen.name })
            : t("set.filter.color")
        }
      >
        {chosen ? (
          <ColorSwatch
            rgb={chosen.rgb}
            trans={chosen.is_trans}
            className="size-6"
          />
        ) : (
          <PaletteIcon />
        )}
      </button>
      <ColorPicker
        open={open}
        colors={colors}
        colorId={colorId}
        onPick={(id) => {
          onColorChange(id);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * Every color of the Set as a swatch with its name, ordered by name, with a
 * search for the name. A native modal <dialog>, like the enlarged picture:
 * Escape and the Android back gesture close it, and focus stays inside.
 */
function ColorPicker({
  open,
  colors,
  colorId,
  onPick,
  onClose,
}: {
  open: boolean;
  colors: PartColor[];
  colorId: number | null;
  onPick: (colorId: number | null) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const el = dialog.current;
    if (!el) {
      return;
    }
    if (open && !el.open) {
      setQuery("");
      el.showModal();
    }
    if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? colors.filter((c) => c.name.toLowerCase().includes(needle))
    : colors;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label={t("set.color.title")}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none bg-white p-0 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <h2 className="min-w-0 flex-1 truncate font-semibold">
              {t("set.color.title")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg dark:bg-neutral-800"
              aria-label={t("set.color.close")}
              autoFocus
            >
              ✕
            </button>
          </div>
          <div className="px-4 pb-3">
            <input
              name="color-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("set.color.search")}
              aria-label={t("set.color.search")}
              className="min-h-11 w-full rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {!needle && colorId !== null && (
              <button
                type="button"
                onClick={() => onPick(null)}
                className="mb-3 flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold ring-1 ring-neutral-300 dark:ring-neutral-700"
              >
                {t("set.color.all")}
              </button>
            )}
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {shown.map((color) => (
                <li key={color.id}>
                  <button
                    type="button"
                    onClick={() => onPick(color.id)}
                    aria-pressed={colorId === color.id}
                    className={`flex h-full min-h-11 w-full flex-col items-center gap-1.5 rounded-xl p-2 text-center text-xs ring-1 ${
                      colorId === color.id
                        ? "bg-neutral-900 text-white ring-neutral-900 dark:bg-white dark:text-neutral-900"
                        : "ring-neutral-200 dark:ring-neutral-800"
                    }`}
                  >
                    <ColorSwatch
                      rgb={color.rgb}
                      trans={color.is_trans}
                      className="size-10"
                    />
                    <span className="line-clamp-2 wrap-break-word">
                      {color.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {shown.length === 0 && (
              <p
                role="status"
                className="py-8 text-center text-neutral-500 dark:text-neutral-400"
              >
                {t("set.color.none")}
              </p>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
