import React from 'react';

import type { OptionType } from '@/components/ui';
import { Options, useModal } from '@/components/ui';
import type { ColorSchemeType } from '@/lib';
import { useSelectedTheme, useTranslate } from '@/lib';

import { Item } from './item';

export const ThemeItem = () => {
  const { selectedTheme, setSelectedTheme } = useSelectedTheme();
  const t = useTranslate();
  const modal = useModal();

  const onSelect = React.useCallback(
    (option: OptionType) => {
      setSelectedTheme(option.value as ColorSchemeType);
      modal.dismiss();
    },
    [setSelectedTheme, modal]
  );

  const themes = React.useMemo(
    () => [
      { label: `${t('settings.theme.dark')} 🌙`, value: 'dark' },
      { label: `${t('settings.theme.light')} 🌞`, value: 'light' },
      { label: `${t('settings.theme.system')} ⚙️`, value: 'system' },
    ],
    [t]
  );

  const theme = React.useMemo(
    () => themes.find((t) => t.value === selectedTheme),
    [selectedTheme, themes]
  );

  return (
    <>
      <Item text="settings.theme.title" value={theme?.label} onPress={modal.present} />
      <Options ref={modal.ref} options={themes} onSelect={onSelect} value={theme?.value} />
    </>
  );
};
