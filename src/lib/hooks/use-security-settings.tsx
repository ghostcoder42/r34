import { useMMKVBoolean, useMMKVNumber } from 'react-native-mmkv';

import type { TxKeyPath } from '@/lib/i18n';
import { storage } from '../storage';

const APP_LOCK_KEY = 'settings.app_lock';
const LOCK_TIMEOUT_KEY = 'settings.lock_timeout_ms';
const HIDE_PREVIEW_KEY = 'settings.hide_preview';

/** Default re-lock window after the app returns from background, in ms. */
export const DEFAULT_LOCK_TIMEOUT_MS = 5000;

/** Choices offered in the Settings picker. "0" means lock immediately. */
export const LOCK_TIMEOUT_OPTIONS: { tx: TxKeyPath; value: number }[] = [
  { tx: 'settings.seconds_5', value: 5000 },
  { tx: 'settings.seconds_30', value: 30000 },
  { tx: 'settings.minute_1', value: 60000 },
  { tx: 'settings.minutes_5', value: 300000 },
  { tx: 'settings.immediately', value: 0 },
];

export const useSecuritySettings = () => {
  const [appLock, setAppLock] = useMMKVBoolean(APP_LOCK_KEY, storage);
  const [lockTimeoutMs, setLockTimeoutMs] = useMMKVNumber(LOCK_TIMEOUT_KEY, storage);
  const [hidePreview, setHidePreview] = useMMKVBoolean(HIDE_PREVIEW_KEY, storage);

  return {
    appLock: appLock ?? false,
    setAppLock,
    lockTimeoutMs: lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS,
    setLockTimeoutMs,
    hidePreview: hidePreview ?? false,
    setHidePreview,
  };
};
