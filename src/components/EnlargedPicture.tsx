import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { Part } from "../lib/parts";
import { partPicture, type Picture } from "./pictures";
import { PartImage } from "./ui";

const ZOOM = 2.5;

/**
 * A picture enlarged to fill the screen, to see its details. Tap the picture to
 * zoom in on that spot (drag to look around), tap again to fit. A native modal
 * <dialog>: Escape and the Android back gesture close it, focus stays inside,
 * and the page behind is inert. The browser's own pinch zoom is off inside it,
 * so the page never stays zoomed after closing.
 */
export function EnlargedPicture({
  picture,
  onClose,
}: {
  picture: Picture | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = picture !== null;

  useEffect(() => {
    const el = dialog.current;
    if (!el) {
      return;
    }
    if (open && !el.open) {
      el.showModal();
    }
    if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label={picture?.label}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none bg-white p-0 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
      style={{ touchAction: "pan-x pan-y" }}
    >
      {picture && (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{picture.title}</p>
              {picture.detail && (
                <p className="flex items-center gap-1.5 text-sm text-neutral-500 tabular-nums dark:text-neutral-400">
                  {picture.detail}
                </p>
              )}
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
          <ZoomablePicture
            key={picture.key}
            src={picture.src}
            label={picture.label}
          />
        </div>
      )}
    </dialog>
  );
}

/** A Part's picture enlarged, with its live found count. */
export function EnlargedPart({
  part,
  onClose,
}: {
  part: Part | null;
  onClose: () => void;
}) {
  return (
    <EnlargedPicture picture={part && partPicture(part)} onClose={onClose} />
  );
}

/** Fits the picture to the space; a tap zooms in on that spot, the next tap fits again. */
function ZoomablePicture({
  src,
  label,
}: {
  src: string | null;
  label: string;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [zoomedAt, setZoomedAt] = useState<{ x: number; y: number } | null>(
    null,
  );

  // A tap zooms in on that spot; the keyboard zooms in on the middle.
  const toggle = (e: MouseEvent<HTMLDivElement>) => {
    if (zoomedAt) {
      return setZoomedAt(null);
    }
    const box = e.currentTarget.getBoundingClientRect();
    setZoomedAt({
      x: (e.clientX - box.left) / box.width,
      y: (e.clientY - box.top) / box.height,
    });
  };
  const toggleWithKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") {
      return;
    }
    e.preventDefault();
    setZoomedAt(zoomedAt ? null : { x: 0.5, y: 0.5 });
  };

  // Scroll the zoomed picture so the tapped spot stays under the finger.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el || !zoomedAt) {
      return;
    }
    el.scrollLeft = zoomedAt.x * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = zoomedAt.y * el.scrollHeight - el.clientHeight / 2;
  }, [zoomedAt]);

  return (
    // Pictures come with a white background, so the area is white in both themes.
    <div
      ref={area}
      className="min-h-0 flex-1 overflow-auto bg-white"
      role="button"
      tabIndex={0}
      aria-label={`${zoomedAt ? "Zoom out" : "Zoom in"}: ${label}`}
      onClick={toggle}
      onKeyDown={toggleWithKey}
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
        <PartImage src={src} alt={label} className="size-full p-4" />
      </div>
    </div>
  );
}

/** Magnifier that enlarges a picture; sits over the picture's corner. */
export function EnlargeButton({
  label,
  onEnlarge,
  className = "",
}: {
  label: string;
  onEnlarge: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onEnlarge}
      className={`flex size-11 items-center justify-center ${className}`}
      aria-label={`Enlarge picture of ${label}`}
    >
      <MagnifierBadge />
    </button>
  );
}

/** A small picture that is itself the enlarge button; disabled when there is no picture. */
export function EnlargeableThumbnail({
  src,
  label,
  onEnlarge,
  className = "size-14 rounded-lg bg-white",
}: {
  src: string | null;
  label: string;
  onEnlarge: () => void;
  /** Size and look of the picture. Position it with a wrapper: the button itself is `relative`. */
  className?: string;
}) {
  const [noPicture, setNoPicture] = useState(!src);
  return (
    <button
      type="button"
      onClick={onEnlarge}
      disabled={noPicture}
      // Disabled (no picture): taps go through to whatever is underneath, also
      // when a pointer-events-none wrapper positions it on top of a card.
      className="pointer-events-auto relative shrink-0 rounded-lg disabled:pointer-events-none"
      aria-label={`Enlarge picture of ${label}`}
    >
      <PartImage
        src={src}
        alt=""
        onError={() => setNoPicture(true)}
        className={className}
      />
      {!noPicture && (
        <span className="absolute -right-1 -bottom-1 scale-75">
          <MagnifierBadge />
        </span>
      )}
    </button>
  );
}

/** The magnifier mark. */
function MagnifierBadge() {
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
