import { useRef, type MouseEvent, type PointerEvent } from "react";

/** How long to hold before it counts as a long press. */
export const LONG_PRESS_MS = 400;
/** How far a finger may drift before the hold turns into a scroll. */
const MOVE_TOLERANCE_PX = 8;

/**
 * Handlers that call `onLongPress` after a hold (touch, pen or the primary mouse
 * button) or on a right-click / the system's long-press menu. A touch or pen hold
 * fires while the finger is down. A mouse hold fires when the button is let go:
 * opening a modal under a pressed mouse button makes the page inert before the
 * button-up arrives, and the browser can be left thinking the button is still
 * down, so the wheel no longer scrolls. The click that
 * ends a hold is swallowed, so holding a card never also ticks it. Spread the
 * result on the element; `className` stops iOS from selecting text or showing
 * its image menu during the hold.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  // A mouse hold that has lasted long enough, waiting for the button to be let go.
  const heldLongEnough = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
    heldLongEnough.current = false;
  };

  return {
    className: "select-none [-webkit-touch-callout:none]",
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) {
        return;
      }
      fired.current = false;
      heldLongEnough.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      const mouse = e.pointerType === "mouse";
      timer.current = setTimeout(() => {
        if (mouse) {
          heldLongEnough.current = true;
          return;
        }
        fired.current = true;
        start.current = null;
        navigator.vibrate?.(10);
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const from = start.current;
      if (
        from &&
        Math.hypot(e.clientX - from.x, e.clientY - from.y) > MOVE_TOLERANCE_PX
      ) {
        cancel();
      }
    },
    onPointerUp: () => {
      const fire = heldLongEnough.current;
      cancel();
      if (fire) {
        fired.current = true;
        onLongPress();
      }
    },
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      cancel();
      if (fired.current) {
        return;
      }
      // On macOS the menu comes on the button press: wait for the button to
      // be let go before opening a modal (see above), but not for long.
      fired.current = true;
      let opened = false;
      const open = () => {
        if (!opened) {
          opened = true;
          window.removeEventListener("pointerup", open);
          // A right-click has no click after it to swallow.
          fired.current = false;
          onLongPress();
        }
      };
      window.addEventListener("pointerup", open, { once: true });
      setTimeout(open, 400);
    },
    /** True once, for the click that follows a long press. */
    swallowClick: () => {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
