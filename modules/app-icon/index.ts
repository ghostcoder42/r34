import { requireNativeModule } from 'expo-modules-core';

import { APP_ICONS, DEFAULT_ICON } from './icons.config';

export type AppIconOption = {
  name: string;
  label: string;
};

export const APP_ICON_OPTIONS: AppIconOption[] = APP_ICONS;

export function getAppIcon(name: string | null | undefined): string {
  return name && APP_ICONS.some((i) => i.name === name) ? name : DEFAULT_ICON;
}

// The native module is only available once the local `app-icon` Expo module is
// compiled into the app. Resolve lazily and tolerate its absence so importing
// this file never crashes (e.g. settings screen must still open on builds that
// didn't include the module).
let nativeModule: { setAppIcon?: (name: string | null) => Promise<boolean> } | null = null;
function getNativeModule() {
  if (nativeModule !== null) return nativeModule;
  try {
    nativeModule = requireNativeModule('AppIcon');
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

export function isAppIconSupported(): boolean {
  return getNativeModule() !== null;
}

export async function setAppIcon(name: string): Promise<boolean> {
  const mod = getNativeModule();
  if (!mod?.setAppIcon) return false;
  const result = await mod.setAppIcon(name === DEFAULT_ICON ? null : name);
  return Boolean(result);
}
