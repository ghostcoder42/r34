import * as FileSystem from 'expo-file-system/legacy';
import * as React from 'react';

import { getItem, removeItem, setItem } from '@/lib/storage';

const DOWNLOAD_METADATA_KEY = 'download_metadata';

type DownloadMetadata = {
  videoId: string;
  title: string;
  thumbnail: string;
  uri: string;
  size: number;
  quality: string;
  downloadedAt: number;
  slug?: string;
  uploader?: string;
  uploaderMemberId?: string;
};

type DownloadStore = {
  [videoId: string]: DownloadMetadata;
};

function getDownloadStore(): DownloadStore {
  return getItem<DownloadStore>(DOWNLOAD_METADATA_KEY) || {};
}

async function saveDownloadStore(store: DownloadStore): Promise<void> {
  await setItem(DOWNLOAD_METADATA_KEY, store);
}

export async function getAllDownloads(): Promise<DownloadMetadata[]> {
  const store = getDownloadStore();
  return Object.values(store).sort((a, b) => b.downloadedAt - a.downloadedAt);
}

/**
 * Deletes video files on disk that have no matching metadata entry ("orphans",
 * e.g. from past interrupted downloads or a metadata reset). Returns the number
 * of files removed. Best-effort: missing dir / unreadable files are ignored.
 */
export async function reconcileDownloads(downloadPath = 'videos'): Promise<number> {
  const store = getDownloadStore();
  const entries = Object.values(store);
  const firstUri = entries[0]?.uri;
  const dir = firstUri
    ? firstUri.slice(0, firstUri.lastIndexOf('/') + 1)
    : `${FileSystem.documentDirectory}${downloadPath}/`;
  const expected = new Set(entries.map((e) => e.uri.split('/').pop()));

  let removed = 0;
  try {
    const files = await FileSystem.readDirectoryAsync(dir);
    for (const file of files) {
      if (expected.has(file)) continue;
      try {
        await FileSystem.deleteAsync(`${dir}${file}`);
        removed += 1;
      } catch {
        // ignore individual file failures
      }
    }
  } catch {
    // directory missing / unreadable — nothing to reconcile
  }
  return removed;
}

export async function getDownloadByVideoId(videoId: string): Promise<DownloadMetadata | null> {
  const store = getDownloadStore();
  return store[videoId] || null;
}

export async function saveDownloadMetadata(metadata: DownloadMetadata): Promise<void> {
  const store = getDownloadStore();
  store[metadata.videoId] = metadata;
  await saveDownloadStore(store);
}

export async function deleteDownload(videoId: string): Promise<void> {
  const store = getDownloadStore();
  const metadata = store[videoId];

  if (metadata) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(metadata.uri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(metadata.uri);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    delete store[videoId];
    await saveDownloadStore(store);
  }
}

export async function clearAllDownloads(): Promise<void> {
  const store = getDownloadStore();

  for (const metadata of Object.values(store)) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(metadata.uri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(metadata.uri);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  await removeItem(DOWNLOAD_METADATA_KEY);
}

export function useDownloads(): {
  downloads: DownloadMetadata[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  removeDownload: (videoId: string) => Promise<void>;
  clearAll: () => Promise<void>;
} {
  const [downloads, setDownloads] = React.useState<DownloadMetadata[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const allDownloads = await getAllDownloads();
      setDownloads(allDownloads);
    } catch (error) {
      console.error('Error loading downloads:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeDownload = React.useCallback(
    async (videoId: string) => {
      await deleteDownload(videoId);
      await refresh();
    },
    [refresh]
  );

  const clearAll = React.useCallback(async () => {
    await clearAllDownloads();
    await refresh();
  }, [refresh]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    downloads,
    isLoading,
    refresh,
    removeDownload,
    clearAll,
  };
}

export type { DownloadMetadata };
