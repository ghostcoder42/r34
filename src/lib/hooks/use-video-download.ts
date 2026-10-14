import * as FileSystem from 'expo-file-system/legacy';
import { useCallback } from 'react';

import { downloadVideo, retryDownload } from '@/lib/download/download-video';
import { useActiveDownload, useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { baseIdOf, useDownloadedStore } from '@/lib/stores/downloaded-store';

import { useDownloadSettings } from './use-download-settings';

type UseVideoDownloadProps = {
  videoUrl: string;
  videoId: string;
  videoTitle?: string;
  videoThumbnail?: string;
  videoSlug?: string;
  videoUploader?: string;
  videoUploaderMemberId?: string;
};

/**
 * Post-page download button state. Everything reactive (progress, error,
 * in-flight) is derived from the active-downloads store so the button, the
 * library row and the tile badges all tell the same story — including a retry
 * resuming mid-file.
 */
export const useVideoDownload = ({
  videoUrl,
  videoId,
  videoTitle,
  videoThumbnail,
  videoSlug,
  videoUploader,
  videoUploaderMemberId,
}: UseVideoDownloadProps) => {
  const { downloadPath } = useDownloadSettings();

  const baseId = baseIdOf(videoId);
  const fileUri = `${FileSystem.documentDirectory}${downloadPath}/${videoId}.mp4`;
  const isDownloaded = useDownloadedStore((s) => s.downloadedBaseIds.has(baseId));
  const active = useActiveDownload(baseId);

  const isDownloading =
    !!active && (active.status === 'downloading' || active.status === 'preparing');
  const downloadProgress = active
    ? active.progress < 0
      ? 0
      : active.progress
    : isDownloaded
      ? 1
      : 0;
  const error = active?.status === 'error' ? new Error(active.error ?? 'Download failed') : null;

  const handleDownload = useCallback(async () => {
    if (!videoUrl) return;
    const existing = useActiveDownloadsStore.getState().tasks[baseId];
    if (existing && existing.status !== 'error' && existing.status !== 'paused') {
      return; // already active
    }
    // An errored or paused task continues (resuming from the bytes already
    // on disk when the previous attempt stopped mid-transfer).
    if (existing) {
      await retryDownload(baseId);
      return;
    }

    // Surface immediately so the active-downloads list / tile badge light up now.
    // The full source (url/quality/uploader) is captured by downloadVideo so a
    // failure stays retryable.
    useActiveDownloadsStore.getState().start({
      baseId,
      title: videoTitle || `Video ${baseId}`,
      thumbnail: videoThumbnail || '',
      slug: videoSlug,
      uploader: videoUploader,
      uploaderMemberId: videoUploaderMemberId,
    });

    try {
      await downloadVideo({
        videoUrl,
        videoId,
        title: videoTitle || `Video ${baseId}`,
        thumbnail: videoThumbnail || '',
        downloadPath,
        slug: videoSlug,
        uploader: videoUploader,
        uploaderMemberId: videoUploaderMemberId,
      });
    } catch (e) {
      const task = useActiveDownloadsStore.getState().tasks[baseId];
      // Cancelled or paused (by the user) -> user action, not a failure.
      // On some Android versions pauseAsync settles downloadAsync without a
      // result; that rejection must not relabel the paused task as errored.
      if (!task || task.status === 'cancelled' || task.status === 'paused') return;
      const msg = e instanceof Error ? e.message : 'Download failed';
      if (task.status !== 'error') {
        useActiveDownloadsStore.getState().fail(baseId, msg);
      }
    }
  }, [
    videoUrl,
    videoId,
    baseId,
    videoTitle,
    videoThumbnail,
    downloadPath,
    videoSlug,
    videoUploader,
    videoUploaderMemberId,
  ]);

  return {
    isDownloading,
    downloadProgress,
    isDownloaded,
    handleDownload,
    fileUri,
    error,
  };
};
