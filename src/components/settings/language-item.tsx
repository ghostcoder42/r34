import * as React from 'react';

import type { OptionType } from '@/components/ui';
import { Options, useModal } from '@/components/ui';
import { useSelectedLanguage } from '@/lib';
import type { Language } from '@/lib/i18n/resources';

import { Item } from './item';

export const LanguageItem = () => {
  const { language, setLanguage } = useSelectedLanguage();
  const modal = useModal();
  const onSelect = React.useCallback(
    (option: OptionType) => {
      setLanguage(option.value as Language);
      modal.dismiss();
    },
    [setLanguage, modal]
  );

  // IMPORTANT: each label is the language's NATIVE name (e.g. "日本語", "简体中文"),
  // intentionally NOT localized via translate(). A language picker must show every
  // language in its own name so users can find theirs regardless of the app's
  // current language. Do NOT replace these literals with translate() calls.
  const langs = React.useMemo(
    () => [
      { label: 'English', value: 'en' },
      { label: '简体中文', value: 'zh' },
      { label: '繁體中文', value: 'zh-TW' },
      { label: '日本語', value: 'ja' },
      { label: '한국어', value: 'ko' },
      { label: 'Español', value: 'es' },
      { label: 'Português', value: 'pt' },
    ],
    []
  );

  const selectedLanguage = React.useMemo(
    () => langs.find((lang) => lang.value === language),
    [language, langs]
  );

  return (
    <>
      <Item text="settings.language" value={selectedLanguage?.label} onPress={modal.present} />
      <Options
        ref={modal.ref}
        options={langs}
        onSelect={onSelect}
        value={selectedLanguage?.value}
      />
    </>
  );
};
