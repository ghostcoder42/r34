import { create } from 'zustand';

import {
  clearAllDownloads,
  deleteDownload,
  getAllDownloads,
  reconcileDownloads,
} from '@/lib/download';
import type { DownloadMetadata } from '@/lib/download';

/**
 * Composite download keys are `${baseId}_${quality}` (e.g. `12345_720p`), built
 * in `useVideoDownload`. Strip the trailing `_<quality>` segment to get back the
 * raw video id — matches the `videoId.split('_').pop()` convention used there.
 */
export function baseIdOf(composite: string): string {
  const i = composite.lastIndexOf('_');
  return i > -1 ? composite.slice(0, i) : composite;
}

type DownloadedState = {
  /** Base video ids (one entry per video that has >= 1 downloaded quality). */
  downloadedBaseIds: Set<string>;
  /** Full metadata entries, for the Downloads list. */
  entries: DownloadMetadata[];
  loaded: boolean;
  hydrate: () => Promise<void>;
  register: (meta: DownloadMetadata) => void;
  remove: (compositeVideoId: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

export const useDownloadedStore = create<DownloadedState>((set) => ({
  downloadedBaseIds: new Set(),
  entries: [],
  loaded: false,

  hydrate: async () => {
    // Clean orphaned files (no metadata) before reading, so the list reflects
    // the true on-disk state.
    await reconcileDownloads();
    const all = await getAllDownloads();
    set({
      entries: all,
      downloadedBaseIds: new Set(all.map((d) => baseIdOf(d.videoId))),
      loaded: true,
    });
  },

  register: (meta) => {
    set((s) => {
      const entries = [meta, ...s.entries.filter((e) => e.videoId !== meta.videoId)];
      const downloadedBaseIds = new Set(s.downloadedBaseIds);
      downloadedBaseIds.add(baseIdOf(meta.videoId));
      return { entries, downloadedBaseIds };
    });
  },

  remove: async (compositeVideoId) => {
    await deleteDownload(compositeVideoId);
    set((s) => {
      const entries = s.entries.filter((e) => e.videoId !== compositeVideoId);
      const downloadedBaseIds = new Set(entries.map((e) => baseIdOf(e.videoId)));
      return { entries, downloadedBaseIds };
    });
  },

  clearAll: async () => {
    await clearAllDownloads();
    set({ entries: [], downloadedBaseIds: new Set(), loaded: true });
  },
}));
