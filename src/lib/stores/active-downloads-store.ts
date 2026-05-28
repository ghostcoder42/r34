import { create } from 'zustand';

export type ActiveDownloadStatus = 'preparing' | 'downloading' | 'error' | 'cancelled';

export type ActiveDownload = {
  baseId: string;
  title: string;
  thumbnail: string;
  slug?: string;
  uploader?: string;
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
};

type ActiveDownloadsState = {
  /** Keyed by base video id so an entry can be created the instant a download is requested. */
  tasks: Record<string, ActiveDownload>;
  start: (input: StartInput) => void;
  setProgress: (baseId: string, ratio: number, written: number, expected: number) => void;
  setStatus: (baseId: string, status: ActiveDownloadStatus, error?: string) => void;
  complete: (baseId: string) => void;
  fail: (baseId: string, error: string) => void;
  remove: (baseId: string) => void;
};

export const useActiveDownloadsStore = create<ActiveDownloadsState>((set) => ({
  tasks: {},

  start: (input) =>
    set((s) => ({
      tasks: {
        ...s.tasks,
        [input.baseId]: { ...input, progress: 0, status: 'preparing', startedAt: Date.now() },
      },
    })),

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
      return { tasks: { ...s.tasks, [baseId]: { ...t, status, error } } };
    }),

  complete: (baseId) =>
    set((s) => {
      const rest = { ...s.tasks };
      delete rest[baseId];
      return { tasks: rest };
    }),

  fail: (baseId, error) =>
    set((s) => {
      const t = s.tasks[baseId];
      if (!t) return {};
      return { tasks: { ...s.tasks, [baseId]: { ...t, status: 'error', error } } };
    }),

  remove: (baseId) =>
    set((s) => {
      const rest = { ...s.tasks };
      delete rest[baseId];
      return { tasks: rest };
    }),
}));

/** Subscribe to a single video's active download (undefined when none). */
export function useActiveDownload(baseId: string): ActiveDownload | undefined {
  return useActiveDownloadsStore((s) => s.tasks[baseId]);
}
