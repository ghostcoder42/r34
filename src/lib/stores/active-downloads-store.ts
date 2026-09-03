import { create } from 'zustand';

import { getItem, setItem } from '@/lib/storage';

export type ActiveDownloadStatus = 'preparing' | 'downloading' | 'error' | 'cancelled';

export type ActiveDownload = {
  baseId: string;
  title: string;
  thumbnail: string;
  slug?: string;
  uploader?: string;
  uploaderMemberId?: string;
  /**
   * Source fields captured when the transfer starts, so a failed task can be
   * retried later — including after an app restart. `videoId` is the composite
   * `${baseId}_${quality}`.
   */
  videoUrl?: string;
  videoId?: string;
  quality?: string;
  /** Download progress 0..1, or -1 when the total size is unknown (indeterminate). */
  progress: number;
  status: ActiveDownloadStatus;
  error?: string;
  startedAt: number;
  totalBytesWritten?: number;
  totalBytesExpected?: number;
};

type StartInput = {
  baseId: string;
  title: string;
  thumbnail: string;
  slug?: string;
  uploader?: string;
  uploaderMemberId?: string;
};

type ActiveDownloadsState = {
  /** Keyed by base video id so an entry can be created the instant a download is requested. */
  tasks: Record<string, ActiveDownload>;
  start: (input: StartInput) => void;
  setProgress: (baseId: string, ratio: number, written: number, expected: number) => void;
  setStatus: (baseId: string, status: ActiveDownloadStatus, error?: string) => void;
  /** Records where a task downloads from, so it can be retried after a failure. */
  setSource: (
    baseId: string,
    source: { videoUrl: string; videoId: string; quality: string }
  ) => void;
  /** Resets a failed task back to `preparing` so the same row can be retried. */
  restart: (baseId: string) => void;
  complete: (baseId: string) => void;
  fail: (baseId: string, error: string) => void;
  remove: (baseId: string) => void;
};

/**
 * Unfinished tasks are persisted so a flaky network or an app kill doesn't
 * lose the download: after a restart they reappear in the Downloads tab and
 * can be retried. Everything except `cancelled` is kept — `error` failures as
 * they died, and in-flight (`preparing`/`downloading`) tasks as "interrupted":
 * no transfer can survive a restart, since it ran inside the JS context.
 */
const UNFINISHED_TASKS_KEY = 'download_unfinished_tasks';

function persistUnfinished(tasks: Record<string, ActiveDownload>): void {
  const unfinished = Object.fromEntries(
    Object.entries(tasks).filter(([, task]) => task.status !== 'cancelled')
  );
  setItem(UNFINISHED_TASKS_KEY, unfinished);
}

/**
 * Restores persisted tasks into the store (no-op when there are none). Called
 * once on app start, before the Downloads tab can be shown. Error tasks come
 * back with their message; in-flight tasks come back marked "Interrupted" and
 * reset, ready for Retry. Tasks without any way to resolve a download source
 * (neither a stored URL nor a slug) are dropped.
 */
export function restoreUnfinishedDownloads(): void {
  const saved = getItem<Record<string, ActiveDownload>>(UNFINISHED_TASKS_KEY) ?? {};
  const tasks = Object.fromEntries(
    Object.entries(saved)
      .filter(([, task]) => task?.baseId && (task.videoUrl || task.slug))
      .map(([id, task]): [string, ActiveDownload] =>
        task.status === 'error'
          ? [id, task]
          : [
              id,
              {
                ...task,
                status: 'error',
                error: 'Interrupted',
                progress: 0,
                totalBytesWritten: undefined,
                totalBytesExpected: undefined,
              },
            ]
      )
  );
  if (Object.keys(tasks).length === 0) return;
  useActiveDownloadsStore.setState((s) => ({ tasks: { ...tasks, ...s.tasks } }));
}

export const useActiveDownloadsStore = create<ActiveDownloadsState>((set) => ({
  tasks: {},

  start: (input) =>
    set((s) => {
      const tasks: Record<string, ActiveDownload> = {
        ...s.tasks,
        [input.baseId]: { ...input, progress: 0, status: 'preparing', startedAt: Date.now() },
      };
      persistUnfinished(tasks);
      return { tasks };
    }),

  setProgress: (baseId, ratio, written, expected) =>
    set((s) => {
      const t = s.tasks[baseId];
      if (!t) return {};
      const indeterminate = !expected || expected <= 0;
      return {
        tasks: {
          ...s.tasks,
          [baseId]: {
            ...t,
            status: 'downloading',
            progress: indeterminate ? -1 : Math.min(1, Math.max(0, ratio)),
            totalBytesWritten: written,
            totalBytesExpected: expected,
          },
        },
      };
    }),

  setStatus: (baseId, status, error) =>
    set((s) => {
      const t = s.tasks[baseId];
      if (!t) return {};
      const tasks: Record<string, ActiveDownload> = {
        ...s.tasks,
        [baseId]: { ...t, status, error },
      };
      persistUnfinished(tasks);
      return { tasks };
    }),

  setSource: (baseId, source) =>
    set((s) => {
      const t = s.tasks[baseId];
      if (!t) return {};
      const tasks: Record<string, ActiveDownload> = { ...s.tasks, [baseId]: { ...t, ...source } };
      persistUnfinished(tasks);
      return { tasks };
    }),

  restart: (baseId) =>
    set((s) => {
      const t = s.tasks[baseId];
      if (!t) return {};
      const tasks: Record<string, ActiveDownload> = {
        ...s.tasks,
        [baseId]: {
          ...t,
          status: 'preparing',
          progress: 0,
          error: undefined,
          totalBytesWritten: undefined,
          totalBytesExpected: undefined,
          startedAt: Date.now(),
        },
      };
      persistUnfinished(tasks);
      return { tasks };
    }),

  complete: (baseId) =>
    set((s) => {
      const rest = { ...s.tasks };
      delete rest[baseId];
      persistUnfinished(rest);
      return { tasks: rest };
    }),

  fail: (baseId, error) =>
    set((s) => {
      const t = s.tasks[baseId];
      if (!t) return {};
      const tasks: Record<string, ActiveDownload> = {
        ...s.tasks,
        [baseId]: { ...t, status: 'error', error },
      };
      persistUnfinished(tasks);
      return { tasks };
    }),

  remove: (baseId) =>
    set((s) => {
      const rest = { ...s.tasks };
      delete rest[baseId];
      persistUnfinished(rest);
      return { tasks: rest };
    }),
}));

/** Subscribe to a single video's active download (undefined when none). */
export function useActiveDownload(baseId: string): ActiveDownload | undefined {
  return useActiveDownloadsStore((s) => s.tasks[baseId]);
}
