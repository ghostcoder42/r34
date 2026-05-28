import en from '@/translations/en.json';
import es from '@/translations/es.json';
import ja from '@/translations/ja.json';
import ko from '@/translations/ko.json';
import pt from '@/translations/pt.json';
import zhTW from '@/translations/zh-TW.json';
import zh from '@/translations/zh.json';

export const resources = {
  en: {
    translation: en,
  },
  zh: {
    translation: zh,
  },
  'zh-TW': {
    translation: zhTW,
  },
  ja: {
    translation: ja,
  },
  ko: {
    translation: ko,
  },
  es: {
    translation: es,
  },
  pt: {
    translation: pt,
  },
};

export type Language = keyof typeof resources;
