// In-memory stand-in for MMKV so persistence assertions don't touch the real store.
const mockStorage = new Map<string, string>();

jest.mock('@/lib/storage', () => ({
  getItem: (key: string) => {
    const value = mockStorage.get(key);
    return value ? JSON.parse(value) : null;
  },
  setItem: (key: string, value: unknown) => {
    mockStorage.set(key, JSON.stringify(value));
  },
  removeItem: (key: string) => {
    mockStorage.delete(key);
  },
}));

import {
  type ActiveDownload,
  restoreUnfinishedDownloads,
  useActiveDownloadsStore,
} from './active-downloads-store';

const UNFINISHED_KEY = 'download_unfinished_tasks';

const persistedTasks = (): Record<string, ActiveDownload> =>
  mockStorage.has(UNFINISHED_KEY) ? JSON.parse(mockStorage.get(UNFINISHED_KEY) as string) : {};

beforeEach(() => {
  useActiveDownloadsStore.setState({ tasks: {} });
  mockStorage.clear();
});

describe('useActiveDownloadsStore', () => {
  it('start creates a preparing task keyed by baseId', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'T', thumbnail: '' });

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task).toBeDefined();
    expect(task?.status).toBe('preparing');
    expect(task?.progress).toBe(0);
    expect(task?.startedAt).toBeGreaterThan(0);
  });

  it('setProgress flips to downloading and clamps the ratio', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore.getState().setProgress('1', 0.5, 50, 100);

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('downloading');
    expect(task?.progress).toBe(0.5);
  });

  it('marks progress indeterminate (-1) when total size is unknown', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore.getState().setProgress('1', 0, 10, 0);

    expect(useActiveDownloadsStore.getState().tasks['1']?.progress).toBe(-1);
  });

  it('complete removes the task', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore.getState().complete('1');

    expect(useActiveDownloadsStore.getState().tasks['1']).toBeUndefined();
  });

  it('fail marks the task as error with a message', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore.getState().fail('1', 'network down');

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('error');
    expect(task?.error).toBe('network down');
  });

  it('setProgress / complete / fail are no-ops for unknown baseId', () => {
    expect(() => {
      useActiveDownloadsStore.getState().setProgress('nope', 0.5, 1, 2);
      useActiveDownloadsStore.getState().complete('nope');
      useActiveDownloadsStore.getState().fail('nope', 'x');
    }).not.toThrow();
    expect(useActiveDownloadsStore.getState().tasks.nope).toBeUndefined();
  });

  it('setSource records the retry fields on the task', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore
      .getState()
      .setSource('1', { videoUrl: 'https://cdn/v.mp4', videoId: '1_720p', quality: '720p' });

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.videoUrl).toBe('https://cdn/v.mp4');
    expect(task?.videoId).toBe('1_720p');
    expect(task?.quality).toBe('720p');
  });

  it('restart resets a failed task to preparing with a clean slate', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore.getState().fail('1', 'flaky');
    useActiveDownloadsStore.getState().restart('1');

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('preparing');
    expect(task?.progress).toBe(0);
    expect(task?.error).toBeUndefined();
  });
});

describe('unfinished-download persistence', () => {
  it('persists error AND in-flight tasks, but not cancelled ones', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'Failing', thumbnail: '' });
    useActiveDownloadsStore.getState().start({ baseId: '2', title: 'InFlight', thumbnail: '' });
    useActiveDownloadsStore.getState().start({ baseId: '3', title: 'Cancelled', thumbnail: '' });
    useActiveDownloadsStore.getState().fail('1', 'network down');
    useActiveDownloadsStore.getState().setStatus('2', 'downloading');
    // In-flight tasks persist too — an app kill must leave a retryable record.
    useActiveDownloadsStore.getState().setStatus('3', 'cancelled');

    expect(Object.keys(persistedTasks()).sort()).toEqual(['1', '2']);
    expect(persistedTasks()['1'].error).toBe('network down');
    expect(persistedTasks()['2'].status).toBe('downloading');
  });

  it('keeps the source fields so the failure stays retryable after a restart', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore
      .getState()
      .setSource('1', { videoUrl: 'https://cdn/v.mp4', videoId: '1_480p', quality: '480p' });
    useActiveDownloadsStore.getState().fail('1', 'timeout');

    const saved = persistedTasks()['1'];
    expect(saved.videoUrl).toBe('https://cdn/v.mp4');
    expect(saved.videoId).toBe('1_480p');
  });

  it('clears the persisted failure when the task completes or is removed', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore.getState().fail('1', 'x');
    expect(Object.keys(persistedTasks())).toEqual(['1']);

    useActiveDownloadsStore.getState().remove('1');
    expect(persistedTasks()).toEqual({});

    useActiveDownloadsStore.getState().start({ baseId: '2', title: 'T', thumbnail: '' });
    useActiveDownloadsStore.getState().fail('2', 'x');
    useActiveDownloadsStore.getState().complete('2');
    expect(persistedTasks()).toEqual({});
  });

  it('restores an interrupted in-flight task as a retryable "Interrupted" error', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore
      .getState()
      .setSource('1', { videoUrl: 'https://cdn/v.mp4', videoId: '1_720p', quality: '720p' });
    useActiveDownloadsStore.getState().setProgress('1', 0.47, 47, 100);
    // Simulate the app being killed mid-download: store resets, storage keeps
    // the in-flight snapshot.
    useActiveDownloadsStore.setState({ tasks: {} });

    restoreUnfinishedDownloads();

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('error');
    expect(task?.error).toBe('Interrupted');
    expect(task?.videoUrl).toBe('https://cdn/v.mp4');
    // The stale progress of the dead transfer must not leak into the row.
    expect(task?.progress).toBe(0);
  });

  it('restores persisted failures as error tasks on app start', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore
      .getState()
      .setSource('1', { videoUrl: 'https://cdn/v.mp4', videoId: '1_720p', quality: '720p' });
    useActiveDownloadsStore.getState().fail('1', 'network down');
    // Simulate a restart: fresh in-memory store, storage still populated.
    useActiveDownloadsStore.setState({ tasks: {} });

    restoreUnfinishedDownloads();

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('error');
    expect(task?.videoUrl).toBe('https://cdn/v.mp4');
    expect(task?.error).toBe('network down'); // original message kept
  });

  it('drops persisted entries without any way to resolve a source, keeps slug-only ones', () => {
    mockStorage.set(
      UNFINISHED_KEY,
      JSON.stringify({
        '1': {
          baseId: '1',
          title: 'no source',
          thumbnail: '',
          progress: 0,
          status: 'error',
          startedAt: 1,
        },
        '2': {
          baseId: '2',
          title: 'retryable via slug',
          thumbnail: '',
          progress: 0,
          status: 'error',
          startedAt: 1,
          slug: 'some-video',
        },
      })
    );

    restoreUnfinishedDownloads();

    // '1' has neither videoUrl nor slug -> dropped; '2' can re-scrape -> kept.
    expect(Object.keys(useActiveDownloadsStore.getState().tasks)).toEqual(['2']);
  });

  it('does not overwrite live tasks when rehydrating', () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'Live', thumbnail: '' });
    mockStorage.set(
      UNFINISHED_KEY,
      JSON.stringify({
        '1': {
          baseId: '1',
          title: 'Stale',
          thumbnail: '',
          progress: 0,
          status: 'error',
          startedAt: 1,
          videoUrl: 'https://cdn/v.mp4',
          videoId: '1_720p',
        },
      })
    );

    restoreUnfinishedDownloads();

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('preparing');
    expect(task?.title).toBe('Live');
  });
});
