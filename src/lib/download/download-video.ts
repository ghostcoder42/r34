import * as FileSystem from 'expo-file-system/legacy';

import { r34Client } from '@/api/common/r34';
import { saveDownloadMetadata } from '@/lib/download';
import type { DownloadMetadata } from '@/lib/download';
import { getDownloadPath } from '@/lib/hooks/use-download-settings';
import { buildVideoUrl } from '@/lib/r34/scraper';
import { useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import type { ActiveDownload } from '@/lib/stores/active-downloads-store';
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
    // Remember where this task downloads from so it can be retried after a
    // failure (persisted with the task for retries across app restarts).
    useActiveDownloadsStore.getState().setSource(baseId, {
      videoUrl,
      videoId,
      quality: videoId.split('_').pop() || 'unknown',
    });
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

/** Removes a leftover partial file so the next attempt starts clean. */
async function deletePartialFile(fileUri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists) {
      await FileSystem.deleteAsync(fileUri);
    }
  } catch {
    // ignore — a partial file only wastes space, it doesn't block the retry
  }
}

/**
 * Resolves what a failed task should download: the stored direct URL when we
 * have one (it can outlive the video page), otherwise re-scrape the detail
 * page via the stored slug. Returns the composite videoId to save under.
 */
async function resolveRetrySource(
  task: Pick<ActiveDownload, 'baseId' | 'slug' | 'quality' | 'videoUrl' | 'videoId'>
): Promise<{ videoUrl: string; videoId: string }> {
  if (task.videoUrl && task.videoId) {
    return { videoUrl: task.videoUrl, videoId: task.videoId };
  }
  if (!task.slug) {
    throw new Error('No source info to retry this download');
  }
  const detail = await r34Client.getVideoDetail(buildVideoUrl(task.baseId, task.slug));
  const format =
    detail.formats.find((f) => f.quality === task.quality) ??
    detail.formats.find((f) => f.quality === '720p') ??
    detail.formats[0];
  if (!format) {
    throw new Error('No downloadable format');
  }
  return { videoUrl: format.url, videoId: `${task.baseId}_${format.quality}` };
}

/**
 * Retries a failed download from the Downloads tab (or anywhere else that has
 * the baseId). Only error tasks can be retried; the task keeps its row and
 * runs through the normal progress → complete/fail lifecycle again. Errors are
 * reported through the task state, not the returned promise.
 */
export async function retryDownload(baseId: string): Promise<void> {
  const task = useActiveDownloadsStore.getState().tasks[baseId];
  if (!task || task.status !== 'error') return;

  // Reset synchronously so a second tap (or the failure path below) always
  // sees a consistent task.
  useActiveDownloadsStore.getState().restart(baseId);

  const downloadPath = getDownloadPath();
  try {
    const source = await resolveRetrySource(task);
    await deletePartialFile(`${FileSystem.documentDirectory}${downloadPath}/${source.videoId}.mp4`);
    await downloadVideo({
      videoUrl: source.videoUrl,
      videoId: source.videoId,
      title: task.title,
      thumbnail: task.thumbnail,
      downloadPath,
      slug: task.slug,
      uploader: task.uploader,
      uploaderMemberId: task.uploaderMemberId,
    });
  } catch (error) {
    // resolveRetrySource failures don't pass through downloadVideo's own
    // error handling — mark the task failed so the UI keeps offering retry.
    const current = useActiveDownloadsStore.getState().tasks[baseId];
    if (current && current.status !== 'cancelled') {
      useActiveDownloadsStore
        .getState()
        .fail(baseId, error instanceof Error ? error.message : 'Download failed');
    }
  }
}
