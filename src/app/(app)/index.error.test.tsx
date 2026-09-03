jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    getAllKeys: jest.fn().mockReturnValue([]),
    remove: jest.fn(),
  })),
}));

jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

// FlashList → FlatList passthrough so list items actually render in tests.
// (The old '@shopify/flash-list/jestSetup' mocked it to a v1-only export that
// no longer exists in v2, i.e. undefined.)
jest.mock('@shopify/flash-list', () => {
  const React: typeof import('react') = jest.requireActual('react');
  const { FlatList } = jest.requireActual('react-native');
  const FlashList = (props: React.ComponentProps<typeof FlatList>) => <FlatList {...props} />;
  return { FlashList };
});

jest.mock('expo-router', () => ({
  Link: 'Link',
  useLocalSearchParams: jest.fn().mockReturnValue({}),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@react-native-menu/menu', () => {
  const React: typeof import('react') = jest.requireActual('react');
  const MenuView = ({ children }: { children?: React.ReactNode }) => children ?? null;
  return { MenuView };
});

jest.mock('@/lib/hooks/use-download-settings', () => ({
  useDownloadSettings: () => ({ downloadPath: 'videos' }),
}));

// Per-test state of the videos query.
const mockQueryState: {
  data: { pages: { data: unknown[] }[] } | undefined;
  isError: boolean;
  error: unknown;
} = {
  data: undefined,
  isError: false,
  error: null,
};

jest.mock('@/api/video-queries', () => ({
  useVideos: () => ({
    data: mockQueryState.data,
    isPending: false,
    isError: mockQueryState.isError,
    error: mockQueryState.error,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
    isRefetching: false,
  }),
}));

import { cleanup, render, screen } from '@/lib/test-utils';
import { showMessage } from 'react-native-flash-message';

import Home from './index';

const sampleVideo = {
  id: 'v1',
  slug: 'v-1',
  title: 'Loaded Video',
  thumbnail: '',
  duration: '1:00',
  views: '1',
  rating: '100%',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryState.data = undefined;
  mockQueryState.isError = false;
  mockQueryState.error = null;
});

afterEach(cleanup);

describe('Home screen — fetch error resilience', () => {
  it('keeps the loaded feed and toasts when a page fetch fails', async () => {
    // Pages 1-6 loaded; page 7 came back 502 (data is retained by the query).
    mockQueryState.data = { pages: [{ data: [sampleVideo] }] };
    mockQueryState.isError = true;
    const error = new Error(
      'Failed to fetch https://rule34video.com/latest-updates/7/: 502'
    ) as Error & { status?: number };
    error.status = 502;
    mockQueryState.error = error;

    render(<Home />);

    // The feed item is still on screen; the full error page is not.
    expect(await screen.findByText('Loaded Video')).toBeTruthy();
    expect(screen.queryByText('Error loading videos')).toBeNull();
    // The classified toast fired (en locale in tests).
    expect(showMessage).toHaveBeenCalledTimes(1);
    const call = (showMessage as jest.Mock).mock.calls[0][0];
    expect(call.message).toContain('502');
    expect(call.position).toBe('center');
  });

  it('shows the full error screen (no toast) when the feed never loaded', () => {
    mockQueryState.data = undefined;
    mockQueryState.isError = true;
    mockQueryState.error = new Error('Failed to fetch: 502');

    render(<Home />);

    expect(screen.getByText('Error loading videos')).toBeTruthy();
    expect(screen.queryByText('Loaded Video')).toBeNull();
    expect(showMessage).not.toHaveBeenCalled();
  });
});
