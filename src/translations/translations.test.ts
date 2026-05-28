import en from './en.json';
import es from './es.json';
import ja from './ja.json';
import ko from './ko.json';
import pt from './pt.json';
import zhTW from './zh-TW.json';
import zh from './zh.json';

type Dict = Record<string, unknown>;

/** Flatten a nested object into dot-notation key → value pairs. */
function flatten(obj: Dict, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = `${prefix}${key}`;
    if (value !== null && typeof value === 'object') {
      Object.assign(out, flatten(value as Dict, `${path}.`));
    } else {
      out[path] = String(value);
    }
  }
  return out;
}

const flatEn = flatten(en);
const enKeys = Object.keys(flatEn).sort();
const locales: Record<string, Record<string, string>> = {
  zh: flatten(zh),
  'zh-TW': flatten(zhTW),
  ja: flatten(ja),
  ko: flatten(ko),
  es: flatten(es),
  pt: flatten(pt),
};

describe('translations', () => {
  it('English has no empty values', () => {
    for (const [, value] of Object.entries(flatEn)) {
      expect(value.length).toBeGreaterThan(0);
    }
  });

  // Every locale must expose exactly the same key set as English (catches
  // missing/extra keys when a new string is added), with no empty values.
  for (const [locale, flat] of Object.entries(locales)) {
    describe(locale, () => {
      it('matches the English key set', () => {
        expect(Object.keys(flat).sort()).toEqual(enKeys);
      });

      it('has no empty values', () => {
        for (const [, value] of Object.entries(flat)) {
          expect(value.length).toBeGreaterThan(0);
        }
      });
    });
  }
});
