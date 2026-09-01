import * as FileSystem from 'expo-file-system/legacy';
import * as React from 'react';
import { useCallback, useState } from 'react';

import { downloadVideo } from '@/lib/download/download-video';
import { useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { baseIdOf } from '@/lib/stores/downloaded-store';

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

export const useVideoDownload = ({
  videoUrl,
  videoId,
  videoTitle,
  videoThumbnail,
  videoSlug,
  videoUploader,
  videoUploaderMemberId,
}: UseVideoDownloadProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const { downloadPath } = useDownloadSettings();

  const baseId = baseIdOf(videoId);
  const fileUri = `${FileSystem.documentDirectory}${downloadPath}/${videoId}.mp4`;

  React.useEffect(() => {
    const checkFile = async () => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        setIsDownloaded(fileInfo.exists);
      } catch (e) {
        console.error('Error checking file existence:', e);
      }
    };
    checkFile();
  }, [fileUri]);

  const handleDownload = useCallback(async () => {
    if (isDownloading || !videoUrl) return;
    if (useActiveDownloadsStore.getState().tasks[baseId]) return; // already active

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
      setError(null);
      setIsDownloading(true);

      await downloadVideo({
        videoUrl,
        videoId,
        title: videoTitle || `Video ${baseId}`,
        thumbnail: videoThumbnail || '',
        downloadPath,
        slug: videoSlug,
        uploader: videoUploader,
        uploaderMemberId: videoUploaderMemberId,
        onProgress: setDownloadProgress,
      });
      setIsDownloaded(true);
    } catch (e) {
      const task = useActiveDownloadsStore.getState().tasks[baseId];
      if (!task || task.status === 'cancelled') return; // cancelled -> silent
      const msg = e instanceof Error ? e.message : 'Download failed';
      if (task.status !== 'error') {
        useActiveDownloadsStore.getState().fail(baseId, msg);
      }
      setError(e instanceof Error ? e : new Error('Download failed'));
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [
    isDownloading,
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
