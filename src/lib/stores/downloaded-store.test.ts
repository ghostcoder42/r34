jest.mock('@/lib/download', () => ({
  clearAllDownloads: jest.fn(),
  deleteDownload: jest.fn(),
  getAllDownloads: jest.fn(),
  reconcileDownloads: jest.fn().mockResolvedValue(0),
}));

import type { DownloadMetadata } from '@/lib/download';
import { clearAllDownloads, deleteDownload, getAllDownloads } from '@/lib/download';

import { baseIdOf, useDownloadedStore } from './downloaded-store';

const makeMeta = (videoId: string): DownloadMetadata => ({
  videoId,
  title: `Title ${videoId}`,
  thumbnail: '',
  uri: `file:///videos/${videoId}.mp4`,
  size: 1000,
  quality: videoId.split('_').pop() ?? 'unknown',
  downloadedAt: 0,
});

beforeEach(() => {
  jest.clearAllMocks();
  useDownloadedStore.setState({
    downloadedBaseIds: new Set(),
    entries: [],
    loaded: false,
  });
});

describe('baseIdOf', () => {
  it('strips the trailing quality segment', () => {
    expect(baseIdOf('12345_720p')).toBe('12345');
  });

  it('preserves underscores in the base id', () => {
    expect(baseIdOf('a_b_1080p')).toBe('a_b');
  });

  it('returns the id unchanged when there is no underscore', () => {
    expect(baseIdOf('12345')).toBe('12345');
  });
});

describe('useDownloadedStore', () => {
  it('hydrates entries and base ids from getAllDownloads', async () => {
    (getAllDownloads as jest.Mock).mockResolvedValue([makeMeta('1_720p'), makeMeta('2_1080p')]);

    await useDownloadedStore.getState().hydrate();

    const state = useDownloadedStore.getState();
    expect(state.downloadedBaseIds).toEqual(new Set(['1', '2']));
    expect(state.entries).toHaveLength(2);
    expect(state.loaded).toBe(true);
  });

  it('register adds the base id and dedupes the entry', () => {
    useDownloadedStore.getState().register(makeMeta('1_720p'));
    useDownloadedStore.getState().register(makeMeta('1_720p'));

    expect(useDownloadedStore.getState().downloadedBaseIds.has('1')).toBe(true);
    expect(useDownloadedStore.getState().entries).toHaveLength(1);
  });

  it('remove deletes via deleteDownload and recomputes base ids', async () => {
    useDownloadedStore.setState({
      entries: [makeMeta('1_720p'), makeMeta('1_1080p')],
      downloadedBaseIds: new Set(['1']),
      loaded: true,
    });

    await useDownloadedStore.getState().remove('1_720p');
    expect(deleteDownload).toHaveBeenCalledWith('1_720p');
    // base '1' still present because '1_1080p' remains
    expect(useDownloadedStore.getState().downloadedBaseIds.has('1')).toBe(true);
    expect(useDownloadedStore.getState().entries).toHaveLength(1);

    await useDownloadedStore.getState().remove('1_1080p');
    // last quality removed → base id gone
    expect(useDownloadedStore.getState().downloadedBaseIds.has('1')).toBe(false);
    expect(useDownloadedStore.getState().entries).toHaveLength(0);
  });

  it('clearAll deletes every file and empties the store', async () => {
    useDownloadedStore.setState({
      entries: [makeMeta('1_720p'), makeMeta('2_1080p')],
      downloadedBaseIds: new Set(['1', '2']),
      loaded: true,
    });

    await useDownloadedStore.getState().clearAll();

    expect(clearAllDownloads).toHaveBeenCalled();
    const state = useDownloadedStore.getState();
    expect(state.entries).toHaveLength(0);
    expect(state.downloadedBaseIds.size).toBe(0);
    expect(state.loaded).toBe(true);
  });
});
