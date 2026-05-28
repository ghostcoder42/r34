import type { TextProps } from 'react-native';
import { I18nManager, Text as NNText } from 'react-native';
import { twMerge } from 'tailwind-merge';

import type { TxKeyPath } from '@/lib/i18n';
import { useTranslate } from '@/lib/i18n';

interface Props extends TextProps {
  className?: string;
  tx?: TxKeyPath;
}

export const Text = ({ className = '', style, tx, children, ...props }: Props) => {
  const t = useTranslate();
  const textStyle = twMerge(
    'text-base text-black dark:text-white font-inter font-normal',
    className
  );

  return (
    <NNText
      className={textStyle}
      style={[{ writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr' }, style]}
      {...props}
    >
      {tx ? t(tx) : children}
    </NNText>
  );
};
