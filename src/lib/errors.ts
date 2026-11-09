import { getActiveLanguage, type Language } from "./i18n";
import { errors as enErrors } from "./messages/en/errors";
import { errors as nlErrors } from "./messages/nl/errors";

// Server messages are English. The English text of every "errors." key is
// a message the server or this app raises (word for word, but for the final full
// stop that a sentence text has and the server leaves off), so that list is the
// lookup: a message that matches a text shows the text of the same key in the
// language in use (English too, so the texts decide the punctuation), and
// anything else shows as it came. A text with
// {placeholders} matches any value there (a set number, a part number).
// Only the Dutch error texts are imported (statically, a few lines): `fail()`
// is synchronous and must not wait for the language chunk.
const DUTCH: Record<string, string> = nlErrors;
const TEXTS: Record<Language, Record<string, string>> = {
  en: enErrors,
  nl: DUTCH,
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Known {
  key: keyof typeof enErrors;
  pattern: RegExp;
  /** The placeholder names, in the order they appear in the message. */
  names: string[];
}

const KNOWN: Known[] = (
  Object.entries(enErrors) as [keyof typeof enErrors, string][]
).map(([key, text]) => {
  const names: string[] = [];
  // A message matches with or without its own final full stop.
  const source = text
    .replace(/\.$/, "")
    .split(/(\{\w+\})/)
    .map((part) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      if (name === undefined) {
        return escape(part);
      }
      names.push(name);
      return "(.+)";
    })
    .join("");
  return { key, pattern: new RegExp(`^${source}$`), names };
});

/**
 * The message in `language`: the text of the known server message it matches
 * (English included, so the texts decide the punctuation: a sentence ends with
 * a full stop, a fragment such as "Invalid delta" does not), else the message
 * as it came. An empty message is the generic text of the language, never blank.
 */
export function translateError(
  message: string,
  language: Language = getActiveLanguage(),
): string {
  if (!message) {
    return TEXTS[language]["errors.generic"] || enErrors["errors.generic"];
  }
  // A message matches with or without a final full stop of its own.
  const bare = message.replace(/\.$/, "");
  for (const { key, pattern, names } of KNOWN) {
    const match = pattern.exec(bare);
    const text = match && TEXTS[language][key];
    if (match && text) {
      return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
        const at = names.indexOf(name);
        return at === -1 ? whole : (match[at + 1] ?? whole);
      });
    }
  }
  return message;
}

/**
 * What data access throws, so the UI can show `message` as is. The message is
 * translated here, when it is thrown, into the language in use. A screen that
 * keeps the message in state while the language can change (the Account page)
 * drops it on a change, so it is never shown in the old language.
 */
export class ApiError extends Error {
  constructor(message: string) {
    super(translateError(message));
  }
}

export function fail(error: { message: string } | null): never {
  throw new ApiError(error?.message ?? enErrors["errors.generic"]);
}
