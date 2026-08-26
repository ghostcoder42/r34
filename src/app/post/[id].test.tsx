// Captured from the useFocusEffect mock so tests can drive the focus
// lifecycle manually: calling the effect simulates screen focus and calling
// its returned cleanup simulates a blur (navigate away).
// Prefixed with `mock` so jest's mock factory hoisting can reference it.
let mockEffectCallback: (() => (() => void) | undefined) | undefined;

jest.mock('expo-router', () => ({
  Link: () => null,
  Stack: { Screen: () => null },
  useLocalSearchParams: jest.fn().mockReturnValue({ id: 'v1', slug: 'my-video' }),
  useFocusEffect: (cb: () => (() => void) | undefined) => {
    mockEffectCallback = cb;
  },
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

jest.mock('@/api/video-queries', () => ({
  useVideoDetail: jest.fn().mockReturnValue({
    data: {
      id: 'v1',
      slug: 'my-video',
      title: 'Test Video',
      thumbnail: '',
      formats: [{ quality: '720p', url: 'https://example.com/v.mp4' }],
      tags: [],
      categories: [],
    },
    isPending: false,
  }),
}));

jest.mock('@/lib/hooks', () => ({
  useVideoDownload: jest.fn().mockReturnValue({
    isDownloading: false,
    downloadProgress: 0,
    isDownloaded: false,
    handleDownload: jest.fn(),
    fileUri: null,
    error: null,
  }),
}));

import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import { useFavoritesStore } from '@/lib/stores/favorites-store';
import { useHistoryStore } from '@/lib/stores/history-store';
import { cleanup, render } from '@/lib/test-utils';

import Post from './[id]';

// Drive the focus lifecycle like expo-router does: focusing runs the effect
// body, blurring runs (only) the cleanup it returned.
let activeCleanup: (() => void) | undefined;
const focus = () => {
  activeCleanup = mockEffectCallback?.();
};
const blur = () => {
  activeCleanup?.();
  activeCleanup = undefined;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.playing = false;
  useHistoryStore.setState({ history: [] });
  useFavoritesStore.setState({ favorites: [] });
  useDownloadedStore.setState({ entries: [], downloadedBaseIds: new Set(), loaded: false });
});

afterEach(cleanup);

describe('Post screen — pause on blur', () => {
  it('pauses the player when the screen loses focus', () => {
    render(<Post />);
    focus();
    mockPlayer.playing = true;

    blur();

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('resumes playback when regaining focus if the video was playing', () => {
    render(<Post />);
    focus();
    mockPlayer.playing = true;
    blur(); // navigate away — paused
    expect(mockPlayer.play).not.toHaveBeenCalled();

    focus(); // navigate back

    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('does not resume when regaining focus if the video was already paused', () => {
    render(<Post />);
    focus();
    mockPlayer.playing = false;
    blur(); // navigate away

    focus(); // navigate back

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('keeps the recorded state across multiple blur/focus cycles', () => {
    render(<Post />);
    focus();
    mockPlayer.playing = true;
    blur();
    focus();
    mockPlayer.playing = false; // user paused on return
    blur();
    focus();

    expect(mockPlayer.play).toHaveBeenCalledTimes(1); // only the first cycle
    expect(mockPlayer.pause).toHaveBeenCalledTimes(2);
  });

  it('swallows errors when the player is already released on unmount', () => {
    render(<Post />);
    focus();
    mockPlayer.pause = jest.fn(() => {
      throw new Error('player released');
    });

    expect(() => blur()).not.toThrow();
  });
});
