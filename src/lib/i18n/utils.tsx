import i18n from 'i18next';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMMKVString } from 'react-native-mmkv';

import { storage } from '../storage';
import type { Language, resources } from './resources';
import type { RecursiveKeyOf } from './types';

type DefaultLocale = typeof resources.en.translation;
export type TxKeyPath = RecursiveKeyOf<DefaultLocale>;

export const LOCAL = 'local';

export const getLanguage = () => storage.getString(LOCAL);

type TranslateOptions = Record<string, string | number>;

/**
 * Reactive, type-safe translate hook. Components MUST use this (not a plain
 * function) so they re-render when the language changes — switching language is
 * instant, with no app reload. Backed by react-i18next's useTranslation.
 */
export function useTranslate() {
  const { t } = useTranslation();
  const tt = t as (key: string, options?: TranslateOptions) => string;
  return useCallback((key: TxKeyPath, options?: TranslateOptions) => tt(key, options ?? {}), [tt]);
}

export const changeLanguage = (lang: Language) => {
  storage.set(LOCAL, lang);
  // react-i18next re-renders every component using useTranslate() on change —
  // no app reload needed.
  void i18n.changeLanguage(lang);
};

export const useSelectedLanguage = () => {
  const [language, setLang] = useMMKVString(LOCAL);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLang(lang);
      if (lang !== undefined) changeLanguage(lang as Language);
    },
    [setLang]
  );

  return { language: language as Language, setLanguage };
};
