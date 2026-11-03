import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { partLabel, type Part } from "../lib/parts";
import { ColorSwatch, PartImage } from "./ui";

const ZOOM = 2.5;

/**
 * A Part's picture enlarged to fill the screen, to see its details. Tap the
 * picture to zoom in on that spot (drag to look around), tap again to fit.
 * A native modal <dialog>: Escape and the Android back gesture close it, focus
 * stays inside, and the page behind is inert. The browser's own pinch zoom is
 * off inside it, so the page never stays zoomed after closing.
 */
export function EnlargedPart({
  part,
  onClose,
}: {
  part: Part | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = part !== null;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label={part ? partLabel(part) : undefined}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none bg-white p-0 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
      style={{ touchAction: "pan-x pan-y" }}
    >
      {part && (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{part.part_name}</p>
              <p className="flex items-center gap-1.5 text-sm text-neutral-500 tabular-nums dark:text-neutral-400">
                <ColorSwatch
                  rgb={part.color_rgb}
                  trans={part.is_trans}
                  className="size-3"
                />
                <span className="truncate">
                  {part.color_name} · {part.part_num} · {part.found} of{" "}
                  {part.needed} found
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg dark:bg-neutral-800"
              aria-label="Close"
              autoFocus
            >
              ✕
            </button>
          </div>
          {/* Keyed so a new Part starts fitted. */}
          <ZoomablePicture key={part.key} part={part} />
        </div>
      )}
    </dialog>
  );
}

/** Fits the picture to the space; a tap zooms in on that spot, the next tap fits again. */
function ZoomablePicture({ part }: { part: Part }) {
  const area = useRef<HTMLDivElement>(null);
  const [zoomedAt, setZoomedAt] = useState<{ x: number; y: number } | null>(
    null,
  );

  const toggle = (e: MouseEvent<HTMLDivElement>) => {
    if (zoomedAt) return setZoomedAt(null);
    const box = e.currentTarget.getBoundingClientRect();
    setZoomedAt({
      x: (e.clientX - box.left) / box.width,
      y: (e.clientY - box.top) / box.height,
    });
  };

  // Scroll the zoomed picture so the tapped spot stays under the finger.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el || !zoomedAt) return;
    el.scrollLeft = zoomedAt.x * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = zoomedAt.y * el.scrollHeight - el.clientHeight / 2;
  }, [zoomedAt]);

  return (
    // Renders are drawn for a light background, as on the cards.
    <div
      ref={area}
      className="min-h-0 flex-1 overflow-auto bg-white dark:bg-neutral-200"
      onClick={toggle}
    >
      <div
        className={
          zoomedAt
            ? "cursor-zoom-out"
            : "flex size-full cursor-zoom-in items-center justify-center"
        }
        style={
          zoomedAt
            ? { width: `${ZOOM * 100}%`, height: `${ZOOM * 100}%` }
            : undefined
        }
      >
        <PartImage
          src={part.img_url}
          alt={partLabel(part)}
          className="size-full p-4"
        />
      </div>
    </div>
  );
}

/** Magnifier that enlarges a Part's picture; sits over the picture's corner. */
export function EnlargeButton({
  part,
  onEnlarge,
  className = "",
}: {
  part: Part;
  onEnlarge: (key: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onEnlarge(part.key)}
      className={`flex size-11 items-center justify-center ${className}`}
      aria-label={`Enlarge picture of ${partLabel(part)}`}
    >
      <MagnifierBadge />
    </button>
  );
}

/** The magnifier mark, also shown on pictures that are themselves the enlarge button. */
export function MagnifierBadge() {
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-white/85 text-neutral-600 shadow-sm ring-1 ring-black/10">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        className="size-4"
        aria-hidden
      >
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15l5 5M10.5 8v5M8 10.5h5" />
      </svg>
    </span>
  );
}
