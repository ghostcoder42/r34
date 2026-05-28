import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import { type Language, resources } from './resources';
import { getLanguage } from './utils';
export * from './utils';

/**
 * Resolve the active language: stored preference wins, otherwise detect from
 * the device locale. Traditional Chinese (zh-TW) is distinguished from
 * Simplified Chinese (zh) via the locale's region/script tag.
 */
function detectLanguage(): Language {
  const stored = getLanguage();
  if (stored && stored in resources) return stored as Language;

  const locale = getLocales()[0];
  if (locale) {
    const code = locale.languageCode ?? '';
    const tag = locale.languageTag ?? '';
    if (code === 'zh') {
      return /^zh-(TW|Hant)/i.test(tag) ? 'zh-TW' : 'zh';
    }
    if (code in resources) return code as Language;
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'en',
  compatibilityJSON: 'v4', // By default React Native projects does not support Intl

  // allows integrating dynamic values into translations.
  interpolation: {
    escapeValue: false, // escape passed in values to avoid XSS injections
  },
});

// Is it a RTL language?
export const isRTL: boolean = i18n.dir() === 'rtl';

I18nManager.allowRTL(isRTL);
I18nManager.forceRTL(isRTL);

export default i18n;
