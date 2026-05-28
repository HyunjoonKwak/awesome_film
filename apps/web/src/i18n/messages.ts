// Locale registry + assembled catalog. Translation strings live in
// `messages.en.ts` and `messages.ko.ts`; this module wires them up and
// derives the MessageKey type from the canonical English source.

import { en } from "./messages.en";
import { ko } from "./messages.ko";

export type Locale = "ko" | "en";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
];

export const MESSAGES: Record<Locale, Record<string, string>> = { en, ko };

// The English catalog is the source of truth for the key set; new keys must
// be added there first so callers stay typed. The `(string & {})` tail keeps
// the literal-union autocomplete while still accepting computed keys such as
// `text.preset.${variant}` produced by template-literal lookups.
export type MessageKey = keyof typeof en | (string & {});
