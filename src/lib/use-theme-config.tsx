import { useColorScheme } from 'nativewind';

import colors from '@/components/ui/colors';

const DarkTheme = {
  dark: true,
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
