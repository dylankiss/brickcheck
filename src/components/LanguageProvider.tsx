import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LanguageContext, type LanguageState } from "../hooks/useLanguage";
import {
  createTranslator,
  formatDate,
  formatNumber,
  initialLanguage,
  loadMessages,
  setActiveLanguage,
  storeLanguage,
  type Language,
  type Messages,
} from "../lib/i18n";

interface Loaded {
  language: Language;
  messages: Messages;
}

function show(next: Loaded, set: (loaded: Loaded) => void) {
  // Before the render, so helpers outside React already use the new language.
  setActiveLanguage(next.language);
  document.documentElement.lang = next.language;
  set(next);
}

/** Holds the language in use and its texts; keeps `<html lang>` and lib/i18n's active language in step. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const language = initialLanguage();
    let cancelled = false;
    loadMessages(language)
      .then((messages) => ({ language, messages }))
      // The chunk is unavailable (offline before it was cached): English still works.
      .catch(async () => ({
        language: "en" as const,
        messages: await loadMessages("en"),
      }))
      .then((next) => {
        if (!cancelled) {
          show(next, setLoaded);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback(async (language: Language) => {
    // Load first, so the screen never shows a half-translated state.
    const messages = await loadMessages(language);
    storeLanguage(language);
    show({ language, messages }, setLoaded);
  }, []);

  const value = useMemo<LanguageState | null>(
    () =>
      loaded && {
        language: loaded.language,
        setLanguage,
        t: createTranslator(loaded.language, loaded.messages),
        date: (d, o) => formatDate(loaded.language, d, o),
        number: (v, o) => formatNumber(loaded.language, v, o),
      },
    [loaded, setLanguage],
  );

  // The texts of a saved or browser language are a small chunk, precached by
  // the service worker; wait for them rather than flash English.
  if (!value) {
    return null;
  }
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
