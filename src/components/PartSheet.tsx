import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { partNumber, type Part } from "../lib/parts";
import { partPicture } from "./pictures";
import { PartCountControls } from "./PartCountControls";
import { ColorSwatch, PartImage } from "./ui";

/** How far a drag must go down before the panel follows it. */
const DRAG_START_PX = 8;
/** How far to drag down, in CSS pixels, to close the sheet. */
const CLOSE_DRAG_PX = 60;
/** A quicker downward flick closes it after this much, in CSS pixels. */
const FLICK_DRAG_PX = 20;
/** How fast a flick is, in CSS pixels per millisecond. */
const FLICK_SPEED = 0.4;

/**
 * A panel from the bottom of the screen for one part: its picture (tap it to
 * see it full screen), its details and, for someone who can tick, its count
 * with "Found all". A native modal <dialog>, so Escape and the Android back
 * gesture close it, focus stays inside and the page behind is inert. It also
 * closes by a tap outside, the ✕, or by dragging down from anywhere on it.
 */
export function PartSheet({
  part,
  canEdit,
  onTap,
  onEnlarge,
  onClose,
  toast,
}: {
  part: Part | null;
  canEdit: boolean;
  onTap: (part: Part, delta: number) => void;
  onEnlarge: (key: string) => void;
  onClose: () => void;
  /** The Undo bar, shown just above the panel: the page behind a modal is out of reach. */
  toast?: ReactNode;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    from: number;
    dy: number;
    active: boolean;
    t0: number;
  } | null>(null);
  const open = part !== null;

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

  // A tap on the backdrop lands on the dialog itself, not on its content. (A
  // listener, not a prop: the dialog is not an interactive element, and the
  // keyboard already closes it with Escape.)
  useEffect(() => {
    const el = dialog.current;
    const close = (e: MouseEvent) => {
      if (e.target === el) {
        onClose();
      }
    };
    el?.addEventListener("click", close);
    return () => el?.removeEventListener("click", close);
  }, [onClose]);

  // The browser's own long-press menu arrives after the panel has opened, so it
  // lands on the panel, not on the card that cancelled it.
  useEffect(() => {
    const el = dialog.current;
    const noMenu = (e: Event) => e.preventDefault();
    el?.addEventListener("contextmenu", noMenu);
    return () => el?.removeEventListener("contextmenu", noMenu);
  }, []);

  const picture = part && partPicture(part, t);

  const moveTo = (dy: number) => {
    const el = sheet.current;
    if (el) {
      el.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
      el.style.transition = "";
    }
  };
  // The whole panel is the drag area. A drag only takes hold once it has gone
  // a few pixels down, and only then captures the pointer, so a tap on a
  // button or the picture still reaches it as a click.
  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = {
      from: e.clientY,
      dy: 0,
      active: false,
      t0: e.timeStamp,
    };
  };
  const dragDown = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) {
      return;
    }
    d.dy = Math.max(0, e.clientY - d.from);
    if (!d.active && d.dy > DRAG_START_PX) {
      d.active = true;
      d.t0 = e.timeStamp;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (d.active) {
      moveTo(d.dy);
    }
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) {
      return;
    }
    const el = sheet.current;
    if (el) {
      el.style.transition = "transform 150ms ease-out";
    }
    const speed = d.dy / Math.max(1, performance.now() - d.t0);
    if (d.dy > CLOSE_DRAG_PX || (d.dy > FLICK_DRAG_PX && speed > FLICK_SPEED)) {
      onClose();
    }
    moveTo(0);
  };

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label={picture?.label}
      // No image menu or text selection on iOS when the finger that opened the panel is still down on its picture.
      className="fixed inset-0 m-0 size-full max-h-none max-w-none flex-col justify-end bg-transparent p-0 text-neutral-900 select-none [-webkit-touch-callout:none] backdrop:bg-black/50 open:flex dark:text-neutral-100"
    >
      {/* The dialog covers the screen and is see-through: a tap beside the panel lands on it and closes it. */}
      {part && picture && toast}
      {part && picture && (
        <div
          ref={sheet}
          onPointerDown={startDrag}
          onPointerMove={dragDown}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="flex max-h-[90dvh] w-full animate-sheet-up touch-none flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] select-none motion-reduce:animate-none dark:bg-neutral-900"
        >
          {/* The handle shows that the panel can be dragged down, from anywhere on it. */}
          <div
            className="-mx-4 flex h-6 items-center justify-center"
            aria-hidden
          >
            <span className="h-1.5 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
          </div>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{picture.title}</p>
              {/* The count is under the picture, so the line holds only what the count does not say. */}
              <p className="flex items-center gap-1.5 text-sm text-neutral-500 tabular-nums dark:text-neutral-400">
                <ColorSwatch
                  rgb={part.color_rgb}
                  trans={part.is_trans}
                  className="size-3"
                />
                <span className="truncate">
                  {part.color_name} · {partNumber(part)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg dark:bg-neutral-800"
              aria-label={t("set.picture.close")}
              autoFocus
            >
              ✕
            </button>
          </div>
          {/* Pictures come with a white background, so their frame is white in both themes. */}
          <button
            type="button"
            onClick={() => onEnlarge(part.key)}
            className="h-[26dvh] w-full rounded-2xl bg-white ring-1 ring-neutral-200 dark:ring-neutral-800"
            aria-label={t("set.picture.enlarge", { label: picture.label })}
          >
            <PartImage
              src={part.img_url}
              alt=""
              // Ignores touch (the button around it takes the tap): iOS lifts a held picture out of the page.
              className="pointer-events-none size-full object-contain p-2"
            />
          </button>
          {canEdit && <PartCountControls part={part} onTap={onTap} />}
        </div>
      )}
    </dialog>
  );
}
