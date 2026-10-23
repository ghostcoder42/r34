// Captured from the useFocusEffect mock so tests can drive the focus
// lifecycle manually: calling each effect simulates screen focus and calling
// its returned cleanup simulates a blur (navigate away). Multiple effects
// register (screen + player hook) — ALL are driven together.
// Prefixed with `mock` so jest's mock factory hoisting can reference it.
let mockEffectCallbacks: Array<() => (() => void) | undefined> = [];

jest.mock('expo-router', () => ({
  Link: () => null,
  Stack: { Screen: () => null },
  useLocalSearchParams: jest.fn().mockReturnValue({ id: 'v1', slug: 'my-video' }),
  useFocusEffect: (cb: () => (() => void) | undefined) => {
    // useCallback-stable callbacks re-register on re-render; dedupe.
    if (!mockEffectCallbacks.includes(cb)) mockEffectCallbacks.push(cb);
  },
  useNavigation: () => ({
    addListener: jest.fn(() => jest.fn()),
    setOptions: jest.fn(),
  }),
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

// SDK 58: transitively loaded modules (e.g. expo-localization via i18n) pull
// requireNativeModule from 'expo' at import time — the mock must provide it.
jest.mock('expo', () => ({
  useEvent: (_player: unknown, _event: string, initial: { isPlaying: boolean }) => initial,
  requireOptionalNativeModule: () => null,
  requireNativeModule: () =>
    new Proxy(
      {},
      {
        get: (_target, prop) =>
          prop === 'getLocales'
            ? () => []
            : () => {
                throw new Error(`native module method ${String(prop)} unavailable in tests`);
              },
      }
    ),
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

jest.mock('@/lib/hooks/use-video-autoplay', () => ({
  useVideoAutoplay: () => ({ autoplayEnabled: false, setAutoplayEnabled: jest.fn() }),
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

// Drive the focus lifecycle like expo-router does: focusing runs every
// registered effect body, blurring runs (only) the cleanups they returned.
let activeCleanups: Array<() => void> = [];
const focus = () => {
  activeCleanups = mockEffectCallbacks.map((cb) => cb()).filter(Boolean) as Array<() => void>;
};
const blur = () => {
  for (const cleanup of activeCleanups) cleanup();
  activeCleanups = [];
};

beforeEach(() => {
  mockEffectCallbacks = [];
  jest.clearAllMocks();
  mockPlayer.playing = false;
  useHistoryStore.setState({ history: [] });
  useFavoritesStore.setState({ favorites: [] });
  useDownloadedStore.setState({ entries: [], downloadedBaseIds: new Set(), loaded: false });
});

afterEach(cleanup);

describe('Post screen — pause on blur', () => {
  it('pauses the player when the screen loses focus', async () => {
    await render(<Post />);
    focus();
    mockPlayer.playing = true;

    blur();

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('resumes playback when regaining focus if the video was playing', async () => {
    await render(<Post />);
    focus();
    mockPlayer.playing = true;
    blur(); // navigate away — paused
    expect(mockPlayer.play).not.toHaveBeenCalled();

    focus(); // navigate back

    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('does not resume when regaining focus if the video was already paused', async () => {
    await render(<Post />);
    focus();
    mockPlayer.playing = false;
    blur(); // navigate away

    focus(); // navigate back

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('keeps the recorded state across multiple blur/focus cycles', async () => {
    await render(<Post />);
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

  it('swallows errors when the player is already released on unmount', async () => {
    await render(<Post />);
    focus();
    mockPlayer.pause = jest.fn(() => {
      throw new Error('player released');
    });

    expect(() => blur()).not.toThrow();
  });
});
