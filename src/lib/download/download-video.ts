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

/**
 * Live resumables, keyed by baseId. Kept on FAILURE too — that is what makes
 * a retry resumable: `resumeAsync()` continues from the bytes already on
 * disk. Entries are dropped on success, cancel and app restart (resume state
 * is in-memory only; after a restart the partial file's size is the offset).
 */
const activeResumables = new Map<
  string,
  { resumable: FileSystem.DownloadResumable; fileUri: string; opts: DownloadVideoOptions }
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

/** Shared success path for downloadAsync() and resumeAsync() results. */
async function finalizeDownload(
  opts: DownloadVideoOptions,
  result: FileSystem.FileSystemDownloadResult | undefined
): Promise<DownloadMetadata> {
  const { videoId, title, thumbnail, slug, uploader, uploaderMemberId } = opts;
  const baseId = baseIdOf(videoId);
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
}

/**
 * Downloads a single video to disk, persists its metadata, and keeps both the
 * reactive completed store and the active-downloads store in sync. Shared by the
 * post-page download button and the long-press context menu.
 *
 * Callers should add the task to the active-downloads store (start) BEFORE
 * calling this; downloadVideo then drives progress / complete / fail. This is
 * the from-scratch path — resume goes through retryDownload, which reuses the
 * resumable kept from the failed/paused attempt (or the partial file itself).
 */
export async function downloadVideo(opts: DownloadVideoOptions): Promise<DownloadMetadata> {
  const { videoUrl, videoId, downloadPath, onProgress } = opts;
  const baseId = baseIdOf(videoId);

  const videosDir = `${FileSystem.documentDirectory}${downloadPath}/`;
  const fileUri = `${videosDir}${videoId}.mp4`;

  const dirInfo = await FileSystem.getInfoAsync(videosDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(videosDir, { intermediates: true });
  }
  // Drop any partial file from an earlier interrupted attempt so this always
  // starts clean — this is the from-scratch path, resume goes through the
  // resumable kept from the failed attempt instead.
  try {
    const stale = await FileSystem.getInfoAsync(fileUri);
    if (stale.exists) await FileSystem.deleteAsync(fileUri, { idempotent: true });
  } catch {
    // ignore — worst case the resumable overwrites it
  }

  const downloadResumable = FileSystem.createDownloadResumable(videoUrl, fileUri, {}, (dl) => {
    const written = dl.totalBytesWritten;
    const expected = dl.totalBytesExpectedToWrite;
    onProgress?.(expected > 0 ? written / expected : 0);
    reportProgress(baseId, written, expected);
  });
  activeResumables.set(baseId, { resumable: downloadResumable, fileUri, opts });

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
    return await finalizeDownload(opts, result);
  } catch (error) {
    // If the task was already removed/marked cancelled/paused, this was user
    // action, not a failure — don't surface it as an error.
    const task = useActiveDownloadsStore.getState().tasks[baseId];
    if (task && task.status !== 'cancelled' && task.status !== 'paused') {
      useActiveDownloadsStore
        .getState()
        .fail(baseId, error instanceof Error ? error.message : 'Download failed');
    }
    throw error;
  } finally {
    // Keep the resumable (and its on-disk bytes) on failure AND pause so the
    // task can resume from where it stopped; drop it otherwise.
    const status = useActiveDownloadsStore.getState().tasks[baseId]?.status;
    if (status !== 'error' && status !== 'paused') activeResumables.delete(baseId);
    progressTick.delete(baseId);
  }
}

/**
 * Pauses an in-flight download (from the library row). pauseAsync stops the
 * native task at a clean boundary and captures the exact resume offset; the
 * task stays in the table as `paused` with its resumable kept for resuming.
 */
export async function pauseDownload(baseId: string): Promise<void> {
  const entry = activeResumables.get(baseId);
  const task = useActiveDownloadsStore.getState().tasks[baseId];
  if (!entry || !task || task.status !== 'downloading') return;

  // Mark first so the downloadAsync() rejection below is understood as a pause.
  useActiveDownloadsStore.getState().setStatus(baseId, 'paused');
  try {
    await entry.resumable.pauseAsync();
  } catch {
    // Pause failed (task already finishing, …) — the final stretch either
    // completes the download or the task stays paused for a disk-offset resume.
  }
}

/**
 * Removes a leftover partial file so the next attempt starts clean. Returns
 * the file's on-disk size when it exists (0 otherwise) — after a restart that
 * size is the resume offset for rebuilding a resumable.
 */
async function partialFileInfo(fileUri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    return info.exists && 'size' in info ? info.size : 0;
  } catch {
    return 0;
  }
}

/**
 * Continue a failed OR paused download task (library row / watch button /
 * tile menu). Resumes from the bytes already on disk — either through the
 * resumable kept from the failed/paused attempt, or (after an app restart) by
 * rebuilding one from the partial file's size. Falls back to a fresh download
 * with a re-resolved source when resuming is not possible; returns false when
 * no source can be resolved — the task stays errored and the caller should
 * offer deletion instead.
 */
export async function retryDownload(baseId: string): Promise<boolean> {
  const task = useActiveDownloadsStore.getState().tasks[baseId];
  if (!task || (task.status !== 'error' && task.status !== 'paused')) return false;

  // A resumed task is no longer paused.
  if (task.status === 'paused') {
    useActiveDownloadsStore.getState().setStatus(baseId, 'downloading');
  }

  // 1) Resume an interrupted transfer where it stopped.
  let entry = activeResumables.get(baseId);
  if (!entry && task.videoUrl && task.videoId) {
    // After an app restart there is no live resumable, but the partial file
    // IS the resume point: its on-disk size is the byte offset (the native
    // side truncates to it and sends `Range: bytes=<size>-`). A too-low
    // offset is safe; the file simply resumes from slightly earlier.
    const fileUri = `${FileSystem.documentDirectory}${getDownloadPath()}/${task.videoId}.mp4`;
    const partial = await partialFileInfo(fileUri);
    if (partial > 0) {
      const opts: DownloadVideoOptions = {
        videoUrl: task.videoUrl,
        videoId: task.videoId,
        title: task.title,
        thumbnail: task.thumbnail,
        downloadPath: getDownloadPath(),
        slug: task.slug,
        uploader: task.uploader,
        uploaderMemberId: task.uploaderMemberId,
      };
      const resumable = new FileSystem.DownloadResumable(
        task.videoUrl,
        fileUri,
        {},
        (dl) => reportProgress(baseId, dl.totalBytesWritten, dl.totalBytesExpectedToWrite),
        String(partial)
      );
      entry = { resumable, fileUri, opts };
      activeResumables.set(baseId, entry);
    }
  }

  if (entry) {
    useActiveDownloadsStore.getState().setStatus(baseId, 'downloading');
    try {
      const result = await entry.resumable.resumeAsync();
      await finalizeDownload(entry.opts, result);
      activeResumables.delete(baseId);
      return true;
    } catch (error) {
      // Resume didn't work (expired source URL, range rejected, …). Fall
      // through to a fresh download; mark the failure so the row stays
      // actionable if that path also dies immediately.
      const current = useActiveDownloadsStore.getState().tasks[baseId];
      if (current && current.status !== 'cancelled' && current.status !== 'paused') {
        useActiveDownloadsStore
          .getState()
          .fail(baseId, error instanceof Error ? error.message : 'Download failed');
      }
      activeResumables.delete(baseId);
    }
  }

  // 2) Fresh download, preferring a newly resolved source URL.
  const downloadPath = getDownloadPath();
  // Reset synchronously so a second tap (or the failure path below) always
  // sees a consistent task.
  useActiveDownloadsStore.getState().restart(baseId);
  try {
    const source = await resolveRetrySource(task);
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
    return true;
  } catch (error) {
    // resolveRetrySource failures don't pass through downloadVideo's own
    // error handling — mark the task failed so the UI keeps offering retry.
    const current = useActiveDownloadsStore.getState().tasks[baseId];
    if (current && current.status !== 'cancelled' && current.status !== 'paused') {
      useActiveDownloadsStore
        .getState()
        .fail(baseId, error instanceof Error ? error.message : 'Download failed');
    }
    return false;
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
 * Cancels an in-flight download (from the active-downloads UI): cancels the
 * resumable, deletes the partial file, and removes the active task. When there
 * is no resumable (already errored/paused) the partial file is still deleted —
 * this is also the "remove failed/paused task" path.
 */
export async function cancelDownload(baseId: string): Promise<void> {
  const entry = activeResumables.get(baseId);
  // Signal cancellation first so the in-flight downloadVideo won't mark `fail`.
  useActiveDownloadsStore.getState().setStatus(baseId, 'cancelled');

  if (!entry) {
    // No resumable (task already errored/paused): still clear its partial file.
    const task = useActiveDownloadsStore.getState().tasks[baseId];
    if (task?.videoId) {
      const fileUri = `${FileSystem.documentDirectory}${getDownloadPath()}/${task.videoId}.mp4`;
      try {
        const info = await FileSystem.getInfoAsync(fileUri);
        if (info.exists) await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch {
        // ignore
      }
    }
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
