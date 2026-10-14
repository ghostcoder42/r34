// Holder prefixed with `mock` so the jest.mock factory can reference it.
const mockFS = {
  progressCallback: null as
    | ((d: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void)
    | null,
  rejectDownload: null as ((e: unknown) => void) | null,
  downloadAsyncResult: { uri: 'file:///doc/videos/1_720p.mp4' } as { uri: string } | undefined,
  shouldThrow: false,
  lastResumeOffset: null as string | undefined | null,
};

jest.mock('expo-file-system/legacy', () => {
  const pendingDownload = () =>
    new Promise<{ uri: string } | undefined>((resolve, reject) => {
      mockFS.rejectDownload = reject;
      if (mockFS.shouldThrow) {
        reject(new Error('network down'));
        return;
      }
      if (mockFS.downloadAsyncResult) {
        resolve(mockFS.downloadAsyncResult);
      }
      // else: stays pending until cancelDownload rejects it
    });
  return {
    documentDirectory: 'file:///doc/',
    getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 100 }),
    makeDirectoryAsync: jest.fn(),
    deleteAsync: jest.fn(),
    createDownloadResumable: jest.fn((_url, _uri, _opts, cb) => {
      mockFS.progressCallback = cb;
      return {
        downloadAsync: jest.fn(() => pendingDownload()),
        // Pausing does NOT settle downloadAsync — the transfer is parked and
        // the promise only settles once the task completes or is cancelled.
        pauseAsync: jest.fn().mockResolvedValue(undefined),
        cancelAsync: jest.fn(() => {
          mockFS.rejectDownload?.(new Error('cancelled'));
        }),
      };
    }),
    // Rebuilt by retryDownload after an app restart to resume from the bytes
    // already on disk (the 5th arg is the resume offset).
    DownloadResumable: class {
      readonly resumeAsync: jest.Mock;
      constructor(
        _url: string,
        _uri: string,
        _opts: unknown,
        cb: (d: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
        resumeOffset?: string
      ) {
        mockFS.progressCallback = cb;
        mockFS.lastResumeOffset = resumeOffset;
        this.resumeAsync = jest.fn(() => pendingDownload());
      }
    },
  };
});

jest.mock('@/lib/download', () => ({
  saveDownloadMetadata: jest.fn().mockResolvedValue(undefined),
}));

// In-memory MMKV stand-in (active-downloads-store persists failures through it,
// and getDownloadPath reads the raw MMKV storage).
jest.mock('@/lib/storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    storage: {
      getString: (key: string) => (key in store ? store[key] : undefined),
      set: (key: string, value: string) => {
        store[key] = value;
      },
    },
    getItem: <T>(key: string): T | null => (key in store ? JSON.parse(store[key]) : null),
    setItem: (key: string, value: unknown) => {
      store[key] = JSON.stringify(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
});

import {
  cancelDownload,
  downloadVideo,
  pauseDownload,
  retryDownload,
} from '@/lib/download/download-video';
import {
  restoreUnfinishedDownloads,
  useActiveDownloadsStore,
} from '@/lib/stores/active-downloads-store';
import { useDownloadedStore } from '@/lib/stores/downloaded-store';

const opts = {
  videoUrl: 'https://example.com/v.mp4',
  videoId: '1_720p',
  title: 'My Video',
  thumbnail: '',
  downloadPath: 'videos',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFS.progressCallback = null;
  mockFS.rejectDownload = null;
  mockFS.downloadAsyncResult = { uri: 'file:///doc/videos/1_720p.mp4' };
  mockFS.shouldThrow = false;
  useActiveDownloadsStore.setState({ tasks: {} });
  useDownloadedStore.setState({
    entries: [],
    downloadedBaseIds: new Set(),
    loaded: true,
  });
});

describe('downloadVideo', () => {
  it('drives the active store through downloading -> complete and registers metadata', async () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'My Video', thumbnail: '' });

    await downloadVideo(opts);

    // Completed: active task removed, completed store has the entry.
    expect(useActiveDownloadsStore.getState().tasks['1']).toBeUndefined();
    expect(useDownloadedStore.getState().entries.some((e) => e.videoId === '1_720p')).toBe(true);
  });

  it('marks the active task as error when the download throws', async () => {
    mockFS.shouldThrow = true;
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'My Video', thumbnail: '' });

    await expect(downloadVideo(opts)).rejects.toThrow('network down');

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('error');
    expect(task?.error).toBe('network down');
  });
});

describe('cancelDownload', () => {
  it('cancels the in-flight download, deletes the partial file and removes the task', async () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'My Video', thumbnail: '' });
    // downloadAsync hangs (pending) until cancel rejects it.
    mockFS.downloadAsyncResult = undefined; // force the pending branch
    const pending = downloadVideo(opts);
    // Let downloadVideo reach the hanging downloadAsync (registers the resumable).
    await new Promise((r) => setTimeout(r, 50));

    await cancelDownload('1');

    expect(useActiveDownloadsStore.getState().tasks['1']).toBeUndefined();
    // The in-flight download rejects (cancelled) and does not register.
    await expect(pending).rejects.toThrow('cancelled');
    expect(useDownloadedStore.getState().entries).toHaveLength(0);
  }, 15000);
});

describe('retryDownload', () => {
  const failedTaskWithSource = () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'My Video', thumbnail: '' });
    useActiveDownloadsStore.getState().setSource('1', {
      videoUrl: 'https://example.com/v.mp4',
      videoId: '1_720p',
      quality: '720p',
    });
    useActiveDownloadsStore.getState().fail('1', 'network down');
  };

  it('resumes a failed task from its stored source and completes', async () => {
    failedTaskWithSource();

    await retryDownload('1');

    // Completed: task removed and metadata registered again.
    expect(useActiveDownloadsStore.getState().tasks['1']).toBeUndefined();
    expect(useDownloadedStore.getState().entries.some((e) => e.videoId === '1_720p')).toBe(true);
  });

  it('resumes from the partial file on disk instead of restarting from zero', async () => {
    failedTaskWithSource();
    const { getInfoAsync } = jest.requireMock('expo-file-system/legacy');
    // The mocked getInfoAsync reports a 100-byte partial file for the task.

    const restarted = await retryDownload('1');

    // A resumable was rebuilt with the on-disk size as the resume offset.
    expect(getInfoAsync).toHaveBeenCalledWith('file:///doc/videos/1_720p.mp4');
    expect(mockFS.lastResumeOffset).toBe('100');
    expect(restarted).toBe(true);
  });

  it('pauses an in-flight download and keeps the task paused (not failed)', async () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'My Video', thumbnail: '' });
    mockFS.downloadAsyncResult = undefined; // keep the transfer in flight
    void downloadVideo(opts); // settles only after resume+completion or cancel
    await new Promise((r) => setTimeout(r, 50));
    useActiveDownloadsStore.getState().setProgress('1', 0.5, 50, 100);

    await pauseDownload('1');

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('paused');
    // The pause kept the progress so the row/bar resume where they stopped.
    expect(task?.progress).toBe(0.5);
  });

  it('pauseDownload is a no-op for tasks that are not downloading', async () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'My Video', thumbnail: '' });
    useActiveDownloadsStore.getState().fail('1', 'network down');

    await expect(pauseDownload('1')).resolves.toBeUndefined();

    expect(useActiveDownloadsStore.getState().tasks['1']?.status).toBe('error');
  });

  it('is a no-op unless the task is in the error state', async () => {
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'My Video', thumbnail: '' });

    await retryDownload('1');

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('preparing'); // untouched, not restarted
  });

  it('marks the task failed again when no source can be resolved', async () => {
    // Failure happened before the source was captured and there is no slug to
    // re-scrape — retry can't proceed, so the task stays retry-able/dismissable.
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'My Video', thumbnail: '' });
    useActiveDownloadsStore.getState().fail('1', 'network down');

    await retryDownload('1');

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('error');
    expect(task?.error).toBe('No source info to retry this download');
  });
});

describe('interrupted downloads (app killed mid-transfer)', () => {
  it('restores an interrupted task and retries it to completion', async () => {
    // A download was in flight when the app died.
    useActiveDownloadsStore.getState().start({ baseId: '1', title: 'My Video', thumbnail: '' });
    useActiveDownloadsStore.getState().setSource('1', {
      videoUrl: 'https://example.com/v.mp4',
      videoId: '1_720p',
      quality: '720p',
    });
    useActiveDownloadsStore.getState().setProgress('1', 0.4, 40, 100);
    useActiveDownloadsStore.setState({ tasks: {} }); // app restart

    restoreUnfinishedDownloads();
    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('error');
    expect(task?.error).toBe('Interrupted');

    await retryDownload('1');

    expect(useActiveDownloadsStore.getState().tasks['1']).toBeUndefined();
    expect(useDownloadedStore.getState().entries.some((e) => e.videoId === '1_720p')).toBe(true);
  });
});
