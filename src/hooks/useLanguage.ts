import { createContext, useContext } from "react";
import {
  createTranslator,
  DEFAULT_LANGUAGE,
  formatDate,
  formatNumber,
  type Language,
  type Translate,
} from "../lib/i18n";
import { en } from "../lib/messages/en";

export interface LanguageState {
  language: Language;
  /** Changes the language everywhere at once and remembers it on this device. */
  setLanguage: (language: Language) => Promise<void>;
  t: Translate;
  date: (date: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
}

export const LanguageContext = createContext<LanguageState>({
  language: DEFAULT_LANGUAGE,
  setLanguage: async () => {},
  t: createTranslator(DEFAULT_LANGUAGE, en),
  date: (d, o) => formatDate(DEFAULT_LANGUAGE, d, o),
  number: (v, o) => formatNumber(DEFAULT_LANGUAGE, v, o),
});

/** The translator and the language-aware formatters; re-renders when the language changes. */
export function useLanguage(): LanguageState {
  return useContext(LanguageContext);
}
