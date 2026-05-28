import preset from 'nativewind/preset';
import type { Config } from 'tailwindcss';

import colors from './src/components/ui/colors';

export default {
  // NOTE: Update this to include the paths to all of your component files.
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [preset],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter'],
      },
      colors,
    },
  },
  plugins: [],
} satisfies Config;
