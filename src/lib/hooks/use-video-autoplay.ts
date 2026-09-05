import { useMMKVBoolean } from 'react-native-mmkv';

import { storage } from '@/lib/storage';

const VIDEO_AUTOPLAY_KEY = 'settings.video_autoplay';

/** Autoplay is on until the user explicitly turns it off. */
export const VIDEO_AUTOPLAY_DEFAULT = true;

/**
 * Whether video pages start playing on open. MMKV-backed so the choice
 * survives restarts.
 */
export function useVideoAutoplay() {
  const [enabled, setEnabled] = useMMKVBoolean(VIDEO_AUTOPLAY_KEY, storage);

  return {
    autoplayEnabled: enabled ?? VIDEO_AUTOPLAY_DEFAULT,
    setAutoplayEnabled: (value: boolean) => setEnabled(value),
  };
}
