// Single source of truth for alternate app icons, shared by:
//  - the runtime module (this package's index.ts)
//  - the config plugin (plugins/with-app-icons.js reads this via require)
//
// `asset` is relative to the project root. The "default" icon reuses the main
// app icon and is the fallback when no alternate is chosen.
export type AppIconDef = {
  name: string;
  label: string;
  asset: string;
  /** iOS fills the icon with a background color; used for the adaptive icon. */
  backgroundColor: string;
};

export const DEFAULT_ICON = 'default';

export const APP_ICONS: AppIconDef[] = [
  {
    name: 'default',
    label: 'Default',
    asset: './assets/icon.png',
    backgroundColor: '#2E3C4B',
  },
  {
    name: 'sunset',
    label: 'Sunset',
    asset: './assets/app-icons/icon-sunset.png',
    backgroundColor: '#F97316',
  },
  {
    name: 'ocean',
    label: 'Ocean',
    asset: './assets/app-icons/icon-ocean.png',
    backgroundColor: '#0EA5E9',
  },
  {
    name: 'forest',
    label: 'Forest',
    asset: './assets/app-icons/icon-forest.png',
    backgroundColor: '#059669',
  },
  {
    name: 'violet',
    label: 'Violet',
    asset: './assets/app-icons/icon-violet.png',
    backgroundColor: '#7C3AED',
  },
  {
    name: 'rose',
    label: 'Rose',
    asset: './assets/app-icons/icon-rose.png',
    backgroundColor: '#E11D48',
  },
];
