// Per-device display preferences, kept in localStorage like the theme. They are
// not part of the account: another device keeps its own.

export type CardSize = "compact" | "large";

export interface Preferences {
  /** How big the part cards are on the Set page: 3 per row on a phone, or 2. */
  cardSize: CardSize;
  /** Whether the Set page starts with found parts hidden. */
  hideFound: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  cardSize: "compact",
  hideFound: true,
};

const PREFIX = "pref.";

/** Reads a stored text back into a valid value, or the default when it is not one. */
export function parsePreference<K extends keyof Preferences>(
  key: K,
  stored: string | null,
): Preferences[K] {
  const fallback = DEFAULT_PREFERENCES[key];
  if (stored === null) {
    return fallback;
  }
  if (key === "cardSize") {
    return (
      stored === "compact" || stored === "large" ? stored : fallback
    ) as Preferences[K];
  }
  return (
    stored === "1" ? true : stored === "0" ? false : fallback
  ) as Preferences[K];
}

const listeners = new Set<() => void>();

export function getPreference<K extends keyof Preferences>(
  key: K,
): Preferences[K] {
  try {
    return parsePreference(key, localStorage.getItem(PREFIX + key));
  } catch {
    // Storage blocked (private mode): the default.
    return DEFAULT_PREFERENCES[key];
  }
}

export function setPreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K],
): void {
  try {
    localStorage.setItem(
      PREFIX + key,
      typeof value === "boolean" ? (value ? "1" : "0") : value,
    );
  } catch {
    // Nothing to keep it in: it lasts until the page reloads.
  }
  for (const listener of listeners) {
    listener();
  }
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab of the app changed one.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PREFIX)) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
