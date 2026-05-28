import * as FileSystem from 'expo-file-system/legacy';

import { saveDownloadMetadata } from '@/lib/download';
import type { DownloadMetadata } from '@/lib/download';
import { useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { baseIdOf, useDownloadedStore } from '@/lib/stores/downloaded-store';

export type DownloadVideoOptions = {
  videoUrl: string;
  /** Composite id, e.g. `${baseId}_${quality}`. */
  videoId: string;
  title: string;
  thumbnail: string;
  /** Folder under documentDirectory where the .mp4 is stored. */
  downloadPath: string;
  slug?: string;
  uploader?: string;
  uploaderMemberId?: string;
  /** Optional local progress callback (kept for the post-page button %). */
  onProgress?: (ratio: number) => void;
};

/** Active resumables so an in-flight download can be cancelled. Keyed by baseId. */
const activeResumables = new Map<
  string,
  { resumable: FileSystem.DownloadResumable; fileUri: string }
>();

/** Per-baseId throttle state for progress updates (avoids a render storm). */
const progressTick = new Map<string, number>();
const PROGRESS_INTERVAL_MS = 200;

function reportProgress(baseId: string, written: number, expected: number) {
  const now = Date.now();
  const last = progressTick.get(baseId);
  if (last && now - last < PROGRESS_INTERVAL_MS) return;
  progressTick.set(baseId, now);
  useActiveDownloadsStore
    .getState()
    .setProgress(baseId, written / Math.max(1, expected), written, expected);
}

/**
 * Downloads a single video to disk, persists its metadata, and keeps both the
 * reactive completed store and the active-downloads store in sync. Shared by the
 * post-page download button and the long-press context menu.
 *
 * Callers should add the task to the active-downloads store (start) BEFORE
 * calling this; downloadVideo then drives progress / complete / fail.
 */
export async function downloadVideo(opts: DownloadVideoOptions): Promise<DownloadMetadata> {
  const {
    videoUrl,
    videoId,
    title,
    thumbnail,
    downloadPath,
    slug,
    uploader,
    uploaderMemberId,
    onProgress,
  } = opts;
  const baseId = baseIdOf(videoId);

  const videosDir = `${FileSystem.documentDirectory}${downloadPath}/`;
  const fileUri = `${videosDir}${videoId}.mp4`;

  const dirInfo = await FileSystem.getInfoAsync(videosDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(videosDir, { intermediates: true });
  }

  const downloadResumable = FileSystem.createDownloadResumable(videoUrl, fileUri, {}, (dl) => {
    const written = dl.totalBytesWritten;
    const expected = dl.totalBytesExpectedToWrite;
    onProgress?.(expected > 0 ? written / expected : 0);
    reportProgress(baseId, written, expected);
  });
  activeResumables.set(baseId, { resumable: downloadResumable, fileUri });

  try {
    useActiveDownloadsStore.getState().setStatus(baseId, 'downloading');
    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      throw new Error('Download failed: no file produced');
    }
    // If the user cancelled during the final stretch, don't register; drop the file.
    if (useActiveDownloadsStore.getState().tasks[baseId]?.status === 'cancelled') {
      try {
        await FileSystem.deleteAsync(result.uri);
      } catch {
        // ignore
      }
      throw new Error('Download cancelled');
    }

    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    const size = (fileInfo as FileSystem.FileInfo & { size: number }).size || 0;
    const quality = videoId.split('_').pop() || 'unknown';

    const metadata: DownloadMetadata = {
      videoId,
      title,
      thumbnail,
      slug,
      uploader,
      uploaderMemberId,
      uri: result.uri,
      size,
      quality,
      downloadedAt: Date.now(),
    };

    await saveDownloadMetadata(metadata);
    // Keep the reactive store in sync so badges light up across the app.
    useDownloadedStore.getState().register(metadata);
    useActiveDownloadsStore.getState().complete(baseId);
    return metadata;
  } catch (error) {
    // If the task was already removed/marked cancelled, this was a user cancel,
    // not a failure — don't surface it as an error.
    const task = useActiveDownloadsStore.getState().tasks[baseId];
    if (task && task.status !== 'cancelled') {
      useActiveDownloadsStore
        .getState()
        .fail(baseId, error instanceof Error ? error.message : 'Download failed');
    }
    throw error;
  } finally {
    activeResumables.delete(baseId);
    progressTick.delete(baseId);
  }
}

/**
 * Cancels an in-flight download (from the active-downloads UI): cancels the
 * resumable, deletes the partial file, and removes the active task. If the
 * download already finished (not in the registry) this just clears the task.
 */
export async function cancelDownload(baseId: string): Promise<void> {
  const entry = activeResumables.get(baseId);
  // Signal cancellation first so the in-flight downloadVideo won't mark `fail`.
  useActiveDownloadsStore.getState().setStatus(baseId, 'cancelled');

  if (!entry) {
    useActiveDownloadsStore.getState().remove(baseId);
    return;
  }

  activeResumables.delete(baseId);
  progressTick.delete(baseId);
  try {
    await entry.resumable.cancelAsync();
  } catch {
    // ignore
  }
  try {
    const info = await FileSystem.getInfoAsync(entry.fileUri);
    if (info.exists) {
      await FileSystem.deleteAsync(entry.fileUri);
    }
  } catch {
    // ignore
  }
  useActiveDownloadsStore.getState().remove(baseId);
}
