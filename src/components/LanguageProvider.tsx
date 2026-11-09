import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Spinner } from "./ui";
import { LanguageContext, type LanguageState } from "../hooks/useLanguage";
import {
  createTranslator,
  formatDate,
  formatDayMonth,
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

// Counts the choices made (the first load counts too): only the latest load
// may apply, so the last choice wins.
let choices = 0;

/** How long a first visit waits for the language chunk before it shows English. */
export const CHUNK_TIMEOUT_MS = 4000;

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
    const mine = ++choices;
    const apply = (next: Loaded) => {
      if (choices === mine) {
        show(next, setLoaded);
      }
    };
    const english = () =>
      loadMessages("en").then((messages) => ({
        language: "en" as const,
        messages,
      }));
    // Never hang on a slow connection: after a while show English. The saved
    // choice stays, so the next visit tries the language again.
    const timer = setTimeout(() => {
      if (language !== "en") {
        // A new turn: the late chunk no longer applies, the English texts do.
        const fallback = ++choices;
        english().then((next) => {
          if (choices === fallback) {
            show(next, setLoaded);
          }
        });
      }
    }, CHUNK_TIMEOUT_MS);
    loadMessages(language)
      .then((messages) => ({ language, messages }))
      // The chunk is unavailable (offline before it was cached): English still works.
      .catch(english)
      .then((next) => {
        clearTimeout(timer);
        apply(next);
      });
    return () => {
      clearTimeout(timer);
      choices++;
    };
  }, []);

  /** Resolves when the language is applied, or when a later choice replaced this one; rejects (the language stays) when its texts cannot load. */
  const setLanguage = useCallback(async (language: Language) => {
    const mine = ++choices;
    // Load first, so the screen never shows a half-translated state.
    const messages = await loadMessages(language);
    if (choices !== mine) {
      return;
    }
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
        dayMonth: (d) => formatDayMonth(loaded.language, d),
        number: (v, o) => formatNumber(loaded.language, v, o),
      },
    [loaded, setLanguage],
  );

  // The texts of a saved or browser language are a small chunk, precached by
  // the service worker; wait for them rather than flash English. Until then a
  // neutral shell, labelled in both languages because none is known yet.
  if (!value) {
    return <Spinner label="Loading / Laden" />;
  }
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
