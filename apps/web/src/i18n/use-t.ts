"use client";

import { useCallback } from "react";
import { MESSAGES, type MessageKey } from "./messages";
import { useLocaleStore } from "./store";

// Replace {name} placeholders in a message template with the supplied vars.
const interpolate = (
  template: string,
  vars?: Record<string, string | number>,
): string => {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
  );
};

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const useT = (): Translate => {
  const locale = useLocaleStore((s) => s.locale);
  return useCallback<Translate>(
    (key, vars) => {
      const cat = MESSAGES[locale] ?? MESSAGES.en;
      const raw = cat[key] ?? MESSAGES.en[key] ?? String(key);
      return interpolate(raw, vars);
    },
    [locale],
  );
};

// Imperative variant for non-React code paths (e.g. toast inside hooks).
export const t = (key: MessageKey, vars?: Record<string, string | number>): string => {
  const locale = useLocaleStore.getState().locale;
  const cat = MESSAGES[locale] ?? MESSAGES.en;
  const raw = cat[key] ?? MESSAGES.en[key] ?? String(key);
  return interpolate(raw, vars);
};
