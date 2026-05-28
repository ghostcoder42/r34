import type { DownloadMetadata } from '@/lib/download';

import type { VideoDetail } from './types';

/**
 * Build a minimal VideoDetail from a downloaded item so the post page can
 * render (and play the local file) with no network. Rich metadata
 * (tags/categories/artist) is unavailable offline by design.
 */
export function toOfflineDetail(meta: DownloadMetadata, id: string): VideoDetail {
  return {
    id,
    slug: meta.slug ?? '',
    title: meta.title,
    thumbnail: meta.thumbnail,
    duration: '',
    views: '',
    rating: '',
    formats: [{ url: meta.uri, quality: meta.quality, ext: 'mp4' }],
    tags: [],
    categories: [],
  };
}
