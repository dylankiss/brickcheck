// Translations without a library. English is the source: its files in
// messages/en define every key. Other languages live in messages/<lang> and
// load as one chunk each, on demand. See ARCHITECTURE.md, Frontend conventions.

import { en } from "./messages/en";

export type MessageKey = keyof typeof en;
/** Plural forms of one text, by Intl.PluralRules category; `other` is required. */
export type PluralMessage = { other: string } & Partial<
  Record<Intl.LDMLPluralRule, string>
>;
export type Message = string | PluralMessage;
/** One language: every key has a text. A Dutch file that misses a key fails to compile. */
export type Messages = Record<MessageKey, Message>;
export type Params = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: Params) => string;

/** Each language is named in itself, so the picker is readable in any language. */
export const LANGUAGES = {
  en: "English",
  nl: "Nederlands",
} as const;
export type Language = keyof typeof LANGUAGES;
export const DEFAULT_LANGUAGE: Language = "en";

const isLanguage = (value: unknown): value is Language =>
  typeof value === "string" && Object.hasOwn(LANGUAGES, value);

/** Loads the texts of a language: English is in the main bundle, the others are a chunk each. */
export async function loadMessages(language: Language): Promise<Messages> {
  switch (language) {
    case "nl":
      return (await import("./messages/nl")).nl;
    case "en":
      return en;
  }
}

/** A saved choice wins; otherwise the first browser language we have, with a regional variant counting (nl-BE is nl). */
export function resolveLanguage(
  saved: string | null,
  browserLanguages: readonly string[],
): Language {
  if (isLanguage(saved)) {
    return saved;
  }
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLanguage(base)) {
      return base;
    }
  }
  return DEFAULT_LANGUAGE;
}

const STORAGE_KEY = "language";

export function getStoredLanguage(): Language | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLanguage(saved) ? saved : null;
  } catch {
    // Storage blocked (private mode): follow the browser.
    return null;
  }
}

export function storeLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Still applies for this visit.
  }
}

/** The language for this device: the saved choice, else the browser's. */
export function initialLanguage(): Language {
  const browser =
    typeof navigator === "undefined"
      ? []
      : (navigator.languages ?? [navigator.language]);
  return resolveLanguage(getStoredLanguage(), browser);
}

/** Fills the {placeholders}; a number is formatted for the language (1,234 / 1.234), a string stays as it is. */
function fill(language: Language, text: string, params?: Params): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params?.[name];
    if (value === undefined) {
      return whole;
    }
    return typeof value === "number" ? formatNumber(language, value) : value;
  });
}

/**
 * The `t` function of a language. A plural text needs `count` in the params.
 * A key missing from `messages` shows the English text; a key missing from
 * both (the types prevent it) shows the key, never nothing.
 */
export function createTranslator(
  language: Language,
  messages: Messages,
  source: Messages = en,
): Translate {
  const rules = new Intl.PluralRules(language);
  return (key, params) => {
    const message = messages[key] ?? source[key];
    if (message === undefined) {
      return key;
    }
    if (typeof message === "string") {
      return fill(language, message, params);
    }
    const form = rules.select(Number(params?.count ?? 0));
    return fill(language, message[form] ?? message.other, params);
  };
}

// English follows the browser's locale (undefined), so a US reader gets 11/3/2026;
// Dutch is always nl-NL.
const LOCALES: Record<Language, string | undefined> = {
  en: undefined,
  nl: "nl-NL",
};

export function formatDate(
  language: Language,
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(LOCALES[language], options).format(
    new Date(date),
  );
}

/** "3 Nov" / "3 nov": the day-first label that must read the same for any English reader. */
export function formatDayMonth(
  language: Language,
  date: string | Date,
): string {
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "nl-NL", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

export function formatNumber(
  language: Language,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(LOCALES[language], options).format(value);
}

// The language in use, for code outside React (pure helpers in lib/). The
// LanguageProvider keeps it in step; React code reads it from the context.
let active: Language = DEFAULT_LANGUAGE;
export const getActiveLanguage = () => active;
export function setActiveLanguage(language: Language): void {
  active = language;
}
