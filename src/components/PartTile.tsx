import { memo } from "react";
import { isComplete, type Tile } from "../lib/tiles";
import { ColorSwatch, PartImage } from "./ui";

interface Props {
  tile: Tile;
  canEdit: boolean;
  onTap: (tile: Tile, delta: 1 | -1) => void;
}

/** Tap the tile to count one found piece; the "−" button undoes one. */
export const PartTile = memo(function PartTile({
  tile,
  canEdit,
  onTap,
}: Props) {
  const complete = isComplete(tile);
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition dark:bg-neutral-900 ${
        complete
          ? "opacity-50 ring-green-600"
          : "ring-neutral-200 dark:ring-neutral-800"
      }`}
    >
      <button
        type="button"
        disabled={!canEdit || complete}
        onClick={() => onTap(tile, 1)}
        className="flex flex-1 flex-col items-stretch p-2 text-left active:scale-[0.97] disabled:active:scale-100"
        aria-label={`${tile.part_name}, ${tile.color_name}: ${tile.found} of ${tile.needed} found. Tap to add one.`}
      >
        <PartImage src={tile.img_url} alt="" className="aspect-square w-full" />
        <div className="mt-1 flex items-center gap-1.5">
          <ColorSwatch rgb={tile.color_rgb} trans={tile.is_trans} />
          <span className="truncate text-xs text-neutral-500">
            {tile.color_name}
          </span>
        </div>
        <span className="truncate text-xs font-medium" title={tile.part_name}>
          {tile.part_name}
        </span>
        <span className="mt-1 text-xl font-bold tabular-nums">
          {complete ? "✓ " : ""}
          {tile.found}
          <span className="text-sm font-normal text-neutral-500">
            {" "}
            / {tile.needed}
          </span>
        </span>
      </button>
      {canEdit && tile.found > 0 && (
        <button
          type="button"
          onClick={() => onTap(tile, -1)}
          className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full bg-neutral-100/90 text-xl font-bold opacity-100 dark:bg-neutral-800/90"
          aria-label={`Remove one ${tile.part_name}`}
        >
          −
        </button>
      )}
      {(tile.has_minifig_lines || tile.has_spare_lines) && (
        <div className="absolute top-2 left-2 flex gap-1 text-[10px] font-semibold uppercase">
          {tile.has_minifig_lines && (
            <span className="rounded bg-yellow-300 px-1 text-yellow-950">
              minifig
            </span>
          )}
          {tile.has_spare_lines && (
            <span className="rounded bg-sky-200 px-1 text-sky-950">spare</span>
          )}
        </div>
      )}
    </div>
  );
});
