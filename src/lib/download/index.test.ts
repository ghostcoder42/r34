import {
  clearAllDownloads,
  deleteDownload,
  getAllDownloads,
  getDownloadByVideoId,
  saveDownloadMetadata,
} from './index';

jest.mock('@/lib/storage', () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => {
      const value = store[key];
      return value ? JSON.parse(value) : null;
    },
    setItem: (key: string, value: unknown) => {
      store[key] = JSON.stringify(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    storage: {
      set: (key: string, value: string) => {
        store[key] = value;
      },
      getString: (key: string) => store[key],
      getAllKeys: () => Object.keys(store),
      remove: (key: string) => {
        delete store[key];
      },
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockMetadata = {
  videoId: '123',
  title: 'Test Video',
  thumbnail: 'https://example.com/thumb.jpg',
  uri: 'file:///downloads/test.mp4',
  size: 1024,
  quality: '720p',
  downloadedAt: Date.now(),
  slug: 'test-video',
  uploader: 'TestUser',
  uploaderMemberId: '99999',
};

describe('download', () => {
  beforeEach(async () => {
    await clearAllDownloads();
  });

  describe('getAllDownloads', () => {
    it('returns empty array initially', async () => {
      const downloads = await getAllDownloads();

      expect(downloads).toEqual([]);
    });

    it('returns saved downloads sorted by date', async () => {
      await saveDownloadMetadata({ ...mockMetadata, downloadedAt: 1000 });
      await saveDownloadMetadata({
        ...mockMetadata,
        videoId: '456',
        downloadedAt: 2000,
      });

      const downloads = await getAllDownloads();

      expect(downloads.length).toBe(2);
      expect(downloads[0].videoId).toBe('456');
    });
  });

  describe('saveDownloadMetadata', () => {
    it('saves metadata', async () => {
      await saveDownloadMetadata(mockMetadata);

      const download = await getDownloadByVideoId('123');

      expect(download).toEqual(mockMetadata);
    });
  });

  describe('getDownloadByVideoId', () => {
    it('returns null for unknown videoId', async () => {
      const download = await getDownloadByVideoId('unknown');

      expect(download).toBeNull();
    });
  });

  describe('deleteDownload', () => {
    it('deletes download metadata', async () => {
      await saveDownloadMetadata(mockMetadata);
      await deleteDownload('123');

      const download = await getDownloadByVideoId('123');

      expect(download).toBeNull();
    });
  });

  describe('clearAllDownloads', () => {
    it('clears all downloads', async () => {
      await saveDownloadMetadata(mockMetadata);
      await saveDownloadMetadata({ ...mockMetadata, videoId: '456' });
      await clearAllDownloads();

      const downloads = await getAllDownloads();

      expect(downloads).toEqual([]);
    });
  });
});
