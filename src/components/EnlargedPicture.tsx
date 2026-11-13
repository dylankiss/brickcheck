import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { Part } from "../lib/parts";
import { setThumbnailUrl } from "../lib/images";
import { partPicture, type Picture } from "./pictures";
import { PartImage } from "./ui";

/** How many CSS pixels one picture pixel may take: more than that turns blurry. */
const MAX_UPSCALE = 2;

/**
 * A picture enlarged to fill the screen, to see its details. Tap the picture to
 * close it, or use the ✕. A native modal
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
  const { t } = useLanguage();
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
              aria-label={t("set.picture.close")}
              autoFocus
            >
              ✕
            </button>
          </div>
          <FittedPicture
            key={picture.key}
            src={picture.src}
            label={picture.label}
            onClose={onClose}
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
  const { t } = useLanguage();
  return (
    <EnlargedPicture picture={part && partPicture(part, t)} onClose={onClose} />
  );
}

/**
 * Fits the picture to the space, never larger than `MAX_UPSCALE` times its real
 * size, so it does not blur. A tap anywhere on it closes the view (and Enter or
 * Space, for the keyboard); there is no zoom.
 */
function FittedPicture({
  src,
  label,
  onClose,
}: {
  src: string | null;
  label: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  // The largest size the picture may show at, in CSS pixels.
  const [real, setReal] = useState<{ width: number; height: number } | null>(
    null,
  );
  const closeWithKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClose();
    }
  };
  return (
    // Pictures come with a white background, so the area is white in both themes.
    <div
      className="flex min-h-0 flex-1 cursor-pointer items-center justify-center overflow-hidden bg-white"
      role="button"
      tabIndex={0}
      aria-label={t("set.picture.closePicture", { label })}
      onClick={onClose}
      onKeyDown={closeWithKey}
    >
      <PartImage
        src={src}
        alt={label}
        onLoad={(e) =>
          setReal({
            width: e.currentTarget.naturalWidth * MAX_UPSCALE,
            height: e.currentTarget.naturalHeight * MAX_UPSCALE,
          })
        }
        className="size-full p-4"
        style={
          real
            ? {
                maxWidth: real.width + PADDING,
                maxHeight: real.height + PADDING,
              }
            : undefined
        }
      />
    </div>
  );
}

/** Room around the picture (`p-4`), both sides, in CSS pixels. */
const PADDING = 32;

/** A small picture that is itself the enlarge button; disabled when there is no picture. */
export function EnlargeableThumbnail({
  src,
  label,
  onEnlarge,
  className = "size-14 rounded-lg bg-white",
  resizeTo,
}: {
  src: string | null;
  label: string;
  onEnlarge: () => void;
  /** For a set picture: the picture's box in CSS pixels. A small copy is shown (see `lib/images.ts`), the original if that fails. */
  resizeTo?: number;
  /** Size and look of the picture. Position it with a wrapper: the button itself is `relative`. */
  className?: string;
}) {
  const { t } = useLanguage();
  const [noPicture, setNoPicture] = useState(!src);
  return (
    <button
      type="button"
      onClick={onEnlarge}
      disabled={noPicture}
      // Disabled (no picture): taps go through to whatever is underneath, also
      // when a pointer-events-none wrapper positions it on top of a card.
      className="pointer-events-auto relative shrink-0 rounded-lg disabled:pointer-events-none"
      aria-label={t("set.picture.enlarge", { label })}
    >
      <PartImage
        src={resizeTo ? setThumbnailUrl(src, resizeTo) : src}
        fallbackSrc={resizeTo ? src : null}
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
