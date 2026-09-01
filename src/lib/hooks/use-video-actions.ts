import { r34Client } from '@/api/common/r34';
import { downloadVideo } from '@/lib/download/download-video';
import type { Post } from '@/lib/r34/extractor';
import { buildVideoUrl } from '@/lib/r34/scraper';
import { useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import { useFavoritesStore } from '@/lib/stores/favorites-store';
import { useFollowingStore } from '@/lib/stores/following-store';
import { showMessage } from 'react-native-flash-message';

import { useDownloadSettings } from './use-download-settings';

/** Minimum tile fields needed to run quick actions without the post page. */
export type ActionableItem = {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  duration?: string;
  views?: string;
  /** Present when the caller already knows the uploader (e.g. download rows). */
  uploader?: string;
  uploaderMemberId?: string;
};

/**
 * Quick actions for a video tile: favorite (immediate), download + follow
 * (which need the full detail, fetched on demand). Used by the long-press
 * context menu so users can act without opening the post page.
 */
export function useVideoActions(item: ActionableItem) {
  const isFavorite = useFavoritesStore((s) => s.favorites.some((f) => f.id === item.id));
  const isDownloaded = useDownloadedStore((s) => s.downloadedBaseIds.has(item.id));
  const isActive = useActiveDownloadsStore((s) => Boolean(s.tasks[item.id]));
  const addFavorite = useFavoritesStore((s) => s.addFavorite);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);
  const { downloadPath } = useDownloadSettings();

  const toggleFavorite = () => {
    if (isFavorite) {
      removeFavorite(item.id);
      return;
    }
    const post: Post = {
      id: item.id,
      slug: item.slug,
      title: item.title,
      thumbnail: item.thumbnail,
      duration: item.duration ?? '',
      views: item.views ?? '',
      rating: '',
    };
    addFavorite(post);
  };

  const toggleDownload = async () => {
    if (isDownloaded || isActive) return;
    // Surface the download immediately (the active row + tile badge read this).
    useActiveDownloadsStore.getState().start({
      baseId: item.id,
      title: item.title,
      thumbnail: item.thumbnail,
      slug: item.slug,
      uploader: item.uploader,
      uploaderMemberId: item.uploaderMemberId,
    });
    try {
      const detail = await r34Client.getVideoDetail(buildVideoUrl(item.id, item.slug));
      const format = detail.formats.find((f) => f.quality === '720p') ?? detail.formats[0];
      if (!format) throw new Error('No downloadable format');
      await downloadVideo({
        videoUrl: format.url,
        videoId: `${item.id}_${format.quality}`,
        title: item.title,
        thumbnail: item.thumbnail,
        downloadPath,
        slug: item.slug,
        uploader: detail.uploader,
        uploaderMemberId: detail.uploaderMemberId,
      });
      showMessage({ message: 'Downloaded', type: 'success', position: 'top' });
    } catch (error) {
      const task = useActiveDownloadsStore.getState().tasks[item.id];
      // Cancelled (task removed or marked) -> stay silent.
      if (!task || task.status === 'cancelled') return;
      const msg = error instanceof Error ? error.message : 'Download failed';
      // Failure before downloadVideo ran (e.g. detail fetch) -> mark it failed here.
      if (task.status !== 'error') {
        useActiveDownloadsStore.getState().fail(item.id, msg);
      }
      showMessage({
        message: 'Download failed',
        description: msg,
        type: 'danger',
        position: 'top',
      });
    }
  };

  const toggleFollow = async () => {
    try {
      const detail = await r34Client.getVideoDetail(buildVideoUrl(item.id, item.slug));
      if (!detail.uploader || !detail.uploaderMemberId) {
        showMessage({ message: 'No author found', type: 'warning', position: 'top' });
        return;
      }
      const { isFollowing, follow, unfollow } = useFollowingStore.getState();
      if (isFollowing(detail.uploaderMemberId)) {
        unfollow(detail.uploaderMemberId);
        showMessage({ message: `Unfollowed ${detail.uploader}`, position: 'top' });
      } else {
        follow(detail.uploader, detail.uploaderMemberId);
        showMessage({
          message: `Following ${detail.uploader}`,
          type: 'success',
          position: 'top',
        });
      }
    } catch {
      showMessage({ message: 'Failed to load author', type: 'danger', position: 'top' });
    }
  };

  return { isFavorite, isDownloaded, isActive, toggleFavorite, toggleDownload, toggleFollow };
}
