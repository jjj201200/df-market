import {useCallback} from 'react';
import {useI18nStore} from '../stores/i18nStore';
import {en} from './locales/en';
import {zhCN} from './locales/zh-CN';
import type {TranslationKey} from './types';
import type {Translation} from './locales/en';

const translations: Record<string, Translation> = {en, 'zh-CN': zhCN};

function getNestedValue(obj: unknown, path: string): string | undefined {
  let current: unknown = obj;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [k, v] of Object.entries(params)) {
    result = result.split(`{${k}}`).join(String(v));
  }
  return result;
}

export function useI18n() {
  const locale = useI18nStore((s) => s.locale);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[locale] ?? translations['en']!;
      const value = getNestedValue(dict, key) ?? getNestedValue(translations['en'], key) ?? key;
      return params ? interpolate(value, params) : value;
    },
    [locale]
  );

  return {t, locale};
}

/** Standalone t function for use outside React components (e.g. in utility functions). */
export function createT(locale: string) {
  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    const dict = translations[locale] ?? translations['en']!;
    const value = getNestedValue(dict, key) ?? getNestedValue(translations['en'], key) ?? key;
    return params ? interpolate(value, params) : value;
  };
}

export type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;
