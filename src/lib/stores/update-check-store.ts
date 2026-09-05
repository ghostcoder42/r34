import { create } from 'zustand';

import { getItem, setItem } from '@/lib/storage';

const LAST_CHECK_AT_KEY = 'update.last_check_at';

/** Automatic checks run at most once per day; manual checks always run. */
export const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

type UpdateCheckState = {
  /** Epoch ms of the last completed successful check (null before the first). */
  lastCheckedAt: number | null;
  recordCheck: (checkedAt: number) => void;
};

/**
 * Tracks when the update check last ran, persisted to MMKV so the daily
 * throttle survives restarts (the store seeds from storage on creation).
 */
export const useUpdateCheckStore = create<UpdateCheckState>((set) => ({
  lastCheckedAt: getItem<number>(LAST_CHECK_AT_KEY) ?? null,

  recordCheck: (checkedAt) => {
    setItem(LAST_CHECK_AT_KEY, checkedAt);
    set({ lastCheckedAt: checkedAt });
  },
}));

/** True when the last check is missing or older than the daily interval. */
export function shouldAutoCheck(now: number = Date.now()): boolean {
  const { lastCheckedAt } = useUpdateCheckStore.getState();
  return lastCheckedAt === null || now - lastCheckedAt >= AUTO_CHECK_INTERVAL_MS;
}

/** Records a completed check from non-react callers (e.g. the check hook). */
export function recordCheckAt(checkedAt: number): void {
  useUpdateCheckStore.getState().recordCheck(checkedAt);
}
