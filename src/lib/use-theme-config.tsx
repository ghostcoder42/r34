import { useColorScheme } from 'nativewind';
import { Platform } from 'react-native';

import colors from '@/components/ui/colors';

// react-navigation v7 themes require a fonts map; use the platform system
// font for every weight (same defaults @react-navigation uses).
const systemFontFamily = Platform.select({ ios: 'System', default: 'sans-serif' });
const fonts = {
  regular: { fontFamily: systemFontFamily, fontWeight: 'normal' },
  medium: { fontFamily: systemFontFamily, fontWeight: '500' },
  semibold: { fontFamily: systemFontFamily, fontWeight: '600' },
  bold: { fontFamily: systemFontFamily, fontWeight: 'bold' },
  heavy: { fontFamily: systemFontFamily, fontWeight: '800' },
  light: { fontFamily: systemFontFamily, fontWeight: '300' },
  ultraLight: { fontFamily: systemFontFamily, fontWeight: '200' },
  thin: { fontFamily: systemFontFamily, fontWeight: '200' },
  roman: { fontFamily: systemFontFamily, fontWeight: 'normal' },
} as const;

const DarkTheme = {
  dark: true,
  fonts,
  colors: {
    primary: colors.primary[200],
    background: colors.charcoal[950],
    card: colors.charcoal[850],
    text: colors.charcoal[100],
    border: colors.charcoal[500],
    notification: colors.primary[200],
  },
};

const LightTheme = {
  dark: false,
  fonts,
  colors: {
    primary: colors.primary[400],
    background: colors.white,
    card: '#fff',
    text: '#000',
    border: '#ddd',
    notification: colors.primary[400],
  },
};

export type Theme = typeof LightTheme;

export function useThemeConfig() {
  const { colorScheme } = useColorScheme();

  if (colorScheme === 'dark') return DarkTheme;

  return LightTheme;
}
