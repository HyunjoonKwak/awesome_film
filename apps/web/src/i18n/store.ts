"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "./messages";

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

// Persisted in localStorage as `cut.locale.v1`. Defaults to Korean since the
// project is bootstrapped in a Korean-speaking environment; users can flip
// to English from the top-bar selector.
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "ko",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "cut.locale.v1" },
  ),
);
