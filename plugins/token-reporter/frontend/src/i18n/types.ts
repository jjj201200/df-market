import type {en} from './locales/en';

export type Locale = 'en' | 'zh-CN';

/** Recursively flatten a nested object type into dot-separated union keys. */
type FlattenKeys<T, Prefix extends string = ''> = T extends string
  ? Prefix
  : {
      [K in keyof T & string]: FlattenKeys<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>;
    }[keyof T & string];

export type TranslationKey = FlattenKeys<typeof en>;
