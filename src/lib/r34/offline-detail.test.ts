import type { DownloadMetadata } from '@/lib/download';

import { toOfflineDetail } from './offline-detail';

const meta = (overrides: Partial<DownloadMetadata> = {}): DownloadMetadata => ({
  videoId: '123_720p',
  title: 'Test Video',
  thumbnail: 'https://example.com/t.jpg',
  uri: 'file:///videos/123_720p.mp4',
  size: 1024,
  quality: '720p',
  downloadedAt: 1000,
  ...overrides,
});

describe('toOfflineDetail', () => {
  it('maps the downloaded item onto a minimal VideoDetail', () => {
    const detail = toOfflineDetail(meta({ slug: 'test-video' }), '123');

    expect(detail.id).toBe('123');
    expect(detail.slug).toBe('test-video');
    expect(detail.title).toBe('Test Video');
    expect(detail.thumbnail).toBe('https://example.com/t.jpg');
    expect(detail.formats).toEqual([
      { url: 'file:///videos/123_720p.mp4', quality: '720p', ext: 'mp4' },
    ]);
  });

  it('falls back to an empty slug when the record has none (old downloads)', () => {
    const detail = toOfflineDetail(meta({ slug: undefined }), '123');

    expect(detail.slug).toBe('');
  });

  it('omits rich metadata that is unavailable offline', () => {
    const detail = toOfflineDetail(meta(), '123');

    expect(detail.tags).toEqual([]);
    expect(detail.categories).toEqual([]);
    expect(detail.artists).toEqual([]);
    expect(detail.uploader).toBeUndefined();
    expect(detail.description).toBeUndefined();
  });
});
