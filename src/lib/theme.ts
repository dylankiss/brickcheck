// Light/dark theme: follows the system unless the user picked one. The choice
// is a per-device preference in localStorage; index.html applies it before
// the first paint, this module keeps it applied afterwards.

export type Theme = "system" | "light" | "dark";

const KEY = "theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();
let current: Theme = getTheme();

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // Storage blocked (private mode): fall back to the system.
  }
  return "system";
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === "system") {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, theme);
    }
  } catch {
    // Still applies for this visit.
  }
  current = theme;
  apply();
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function apply() {
  const dark = current === "dark" || (current === "system" && media.matches);
  document.documentElement.classList.toggle("dark", dark);
}

export const currentTheme = () => current;

media.addEventListener("change", apply);
// Another tab of the app changed the theme.
window.addEventListener("storage", (event) => {
  if (event.key !== KEY && event.key !== null) {
    return;
  }
  current = getTheme();
  apply();
  for (const listener of listeners) {
    listener();
  }
});
apply();
