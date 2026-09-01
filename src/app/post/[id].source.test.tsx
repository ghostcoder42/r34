// Player-source selection tests for the post screen. The download hook is
// mocked with the same contract as the real one: `isDownloaded`/`fileUri`
// reflect whether `${videoId}.mp4` exists on disk for the composite id the
// component asks about.
const mockDownloadState = {
  existingFiles: new Set<string>(),
};

// Captured from the useFocusEffect mock so tests can drive the focus
// lifecycle manually (not used for source assertions, but the component
// registers the effect on mount).

jest.mock('expo-router', () => ({
  Link: () => null,
  Stack: { Screen: () => null },
  useLocalSearchParams: jest.fn().mockReturnValue({ id: 'v1', slug: 'my-video' }),
  useFocusEffect: (_cb: () => (() => void) | undefined) => undefined,
}));

const mockPlayer = {
  playing: false,
  loop: false,
  play: jest.fn(),
  pause: jest.fn(),
};

jest.mock('expo-video', () => ({
  VideoView: () => null,
  useVideoPlayer: jest.fn((_source: string, setup?: (p: typeof mockPlayer) => void) => {
    setup?.(mockPlayer);
    return mockPlayer;
  }),
}));

jest.mock('expo-image', () => ({ Image: 'Image' }));

jest.mock('react-native-safe-area-context', () => {
  const React: typeof import('react') = jest.requireActual('react');
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
    SafeAreaView: ({ children }: { children?: React.ReactNode }) => children ?? null,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('react-native-edge-to-edge', () => ({
  edgeToEdge: jest.fn(),
  SystemBars: () => null,
}));

jest.mock('expo', () => ({
  useEvent: (_player: unknown, _event: string, initial: { isPlaying: boolean }) => initial,
}));

// Per-test network detail returned by useVideoDetail.
const mockDetailState = {
  data: null as object | null,
};

jest.mock('@/api/video-queries', () => ({
  useVideoDetail: () => ({ data: mockDetailState.data, isPending: false }),
}));

jest.mock('@/lib/hooks', () => ({
  useVideoDownload: (props: { videoId: string }) => ({
    isDownloading: false,
    downloadProgress: 0,
    isDownloaded: mockDownloadState.existingFiles.has(props.videoId),
    handleDownload: jest.fn(),
    fileUri: `file:///documents/videos/${props.videoId}.mp4`,
    error: null,
  }),
}));

import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import { useFavoritesStore } from '@/lib/stores/favorites-store';
import { useHistoryStore } from '@/lib/stores/history-store';
import { act, cleanup, screen, setup, waitFor } from '@/lib/test-utils';
import { useVideoPlayer } from 'expo-video';

import Post from './[id]';

const LOCAL_480P = 'file:///documents/videos/v1_480p.mp4';

const NETWORK_FORMATS = [
  { quality: '360p', url: 'https://example.com/v1_360p.mp4' },
  { quality: '480p', url: 'https://example.com/v1_480p.mp4' },
  { quality: '720p', url: 'https://example.com/v1_720p.mp4' },
];

const seedDownload = (quality: string) => {
  useDownloadedStore.setState({
    entries: [
      {
        videoId: `v1_${quality}`,
        title: 'Test Video',
        thumbnail: '',
        uri: LOCAL_480P,
        size: 1,
        quality,
        downloadedAt: 1,
        slug: 'my-video',
      },
    ],
    downloadedBaseIds: new Set(['v1']),
    loaded: true,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.playing = false;
  mockDownloadState.existingFiles = new Set<string>();
  useHistoryStore.setState({ history: [] });
  useFavoritesStore.setState({ favorites: [] });
  useDownloadedStore.setState({ entries: [], downloadedBaseIds: new Set(), loaded: true });
  mockDetailState.data = {
    id: 'v1',
    slug: 'my-video',
    title: 'Test Video',
    thumbnail: '',
    formats: NETWORK_FORMATS,
    tags: [],
    categories: [],
  };
});

afterEach(cleanup);

const lastPlayerSource = () => (useVideoPlayer as jest.Mock).mock.calls.at(-1)?.[0];

describe('Post screen — player source selection', () => {
  it('plays the downloaded file even when the network default quality differs', async () => {
    // Downloaded copy is 480p; the network default (and first paint without a
    // download) would pick 720p.
    mockDownloadState.existingFiles.add('v1_480p');
    seedDownload('480p');

    setup(<Post />);

    await waitFor(() => expect(lastPlayerSource()).toBe(LOCAL_480P));
  });

  it('switches to the local file when the download store hydrates after the network detail', async () => {
    // Store starts empty (e.g. hydrate still in flight) so the player first
    // streams the network 720p URL…
    setup(<Post />);
    await waitFor(() => expect(lastPlayerSource()).toBe('https://example.com/v1_720p.mp4'));

    // …then the downloaded entry appears and must take over the player.
    mockDownloadState.existingFiles.add('v1_480p');
    act(() => {
      seedDownload('480p');
    });

    await waitFor(() => expect(lastPlayerSource()).toBe(LOCAL_480P));
  });

  it('still plays the local file when the network detail resolves without formats (removed video)', async () => {
    mockDownloadState.existingFiles.add('v1_360p');
    seedDownload('360p');
    mockDetailState.data = {
      id: 'v1',
      slug: 'my-video',
      title: 'Test Video',
      thumbnail: '',
      formats: [],
      tags: [],
      categories: [],
    };

    setup(<Post />);

    await waitFor(() => expect(lastPlayerSource()).toBe('file:///documents/videos/v1_360p.mp4'));
  });

  it('keeps the local file across network refreshes — the download owns the default', async () => {
    mockDownloadState.existingFiles.add('v1_480p');
    seedDownload('480p');

    const { rerender } = setup(<Post />);
    await waitFor(() => expect(lastPlayerSource()).toBe(LOCAL_480P));

    // A later network refresh delivering new format objects must not move the
    // player back to a network URL.
    act(() => {
      mockDetailState.data = {
        ...(mockDetailState.data as object),
        formats: NETWORK_FORMATS,
      };
    });
    rerender(<Post />);

    expect(lastPlayerSource()).toBe(LOCAL_480P);
  });

  it('honors an explicit quality pick by switching to that network source', async () => {
    mockDownloadState.existingFiles.add('v1_480p');
    seedDownload('480p');

    const { user } = setup(<Post />);
    await waitFor(() => expect(lastPlayerSource()).toBe(LOCAL_480P));

    await user.press(screen.getByText('720p'));

    await waitFor(() => expect(lastPlayerSource()).toBe('https://example.com/v1_720p.mp4'));
  });
});
