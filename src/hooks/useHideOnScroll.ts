import { useCallback, useEffect, useState } from "react";

// How far you scroll down, without turning back, before the header hides.
const HIDE_AFTER_PX = 24;
// Near the top the header always stays.
const ALWAYS_SHOWN_ABOVE_PX = 80;
// While a text field has focus, a short scroll does not hide the header: the
// on-screen keyboard scrolls the page by itself. A longer, deliberate scroll
// does, so a field left focused cannot keep the header on screen for good.
const HIDE_WHILE_TYPING_AFTER_PX = 200;

/**
 * Hides a sticky header once the page is scrolled down, and keeps it hidden
 * however you scroll after that: looking for a piece means scrolling up and
 * down for a while, and a header that comes and goes with every turn is
 * distracting. It comes back by itself only near the top of the page or while a
 * text field has focus (and you only scroll a little); otherwise `show()` brings it back (a button), and the next
 * scroll down hides it again. Reading the scroll position never changes the
 * layout, so nothing on the page moves.
 */
export function useHideOnScroll(enabled: boolean): {
  hidden: boolean;
  show: () => void;
} {
  const [hidden, setHidden] = useState(false);
  const show = useCallback(() => setHidden(false), []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let last = window.scrollY;
    // Where the current run downwards began: the last turning point.
    let runStart = last;
    let direction = 0;
    const onScroll = () => {
      const y = window.scrollY;
      const step = Math.sign(y - last);
      last = y;
      if (step !== 0 && step !== direction) {
        direction = step;
        runStart = y - step;
      }
      // Selects keep focus after a choice, so only text fields count.
      const active = document.activeElement;
      const typing =
        active instanceof HTMLElement && active.matches("input, textarea");
      if (y < ALWAYS_SHOWN_ABOVE_PX) {
        setHidden(false);
      } else if (
        y - runStart >
        (typing ? HIDE_WHILE_TYPING_AFTER_PX : HIDE_AFTER_PX)
      ) {
        setHidden(true);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      setHidden(false);
    };
  }, [enabled]);

  return { hidden, show };
}
