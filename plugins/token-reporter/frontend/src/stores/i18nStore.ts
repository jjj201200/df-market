import {create} from 'zustand';
import type {Locale} from '../i18n/types';

const STORAGE_KEY = 'token-reporter:locale';
const SUPPORTED: Locale[] = ['en', 'zh-CN'];

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored as Locale)) return stored as Locale;
  } catch {
    // localStorage may be unavailable
  }

  const langs = navigator.languages ?? [navigator.language];
  for (const lang of langs) {
    if (lang.startsWith('zh')) return 'zh-CN';
    if (lang.startsWith('en')) return 'en';
  }

  return 'en';
}

interface I18nStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nStore>((set) => ({
  locale: detectLocale(),
  setLocale: (locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }
    set({locale});
  },
}));
