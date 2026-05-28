import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import { useFavoritesStore } from '@/lib/stores/favorites-store';
import { cleanup, fireEvent, render } from '@/lib/test-utils';
import { Platform } from 'react-native';

import { VideoTile } from './video-tile';

// Capture the props passed to the (mocked) MenuView so we can assert on the
// actions array and the onPressAction dispatcher. Prefixed with `mock` so
// jest's mock factory can reference it.
const mockMenu = {
  lastProps: {} as {
    actions?: { id: string; title: string }[];
    onPressAction?: (e: { nativeEvent: { event: string } }) => void;
  },
};

jest.mock('@react-native-menu/menu', () => {
  const React: typeof import('react') = jest.requireActual('react');
  const MenuView = ({ children, ...props }: { children?: React.ReactNode }) => {
    mockMenu.lastProps = props as typeof mockMenu.lastProps;
    return children ?? null;
  };
  return { MenuView };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/hooks/use-download-settings', () => ({
  useDownloadSettings: () => ({ downloadPath: 'videos' }),
}));

jest.mock('react-native-flash-message', () => ({ showMessage: jest.fn() }));

const setPlatform = (os: 'android' | 'ios') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });

const item = {
  id: '1',
  slug: 's',
  title: 'My Video',
  thumbnail: '',
  duration: '2:30',
  views: '10',
};

afterEach(() => {
  cleanup();
  mockPush.mockClear();
});

beforeEach(() => {
  setPlatform('android');
  useFavoritesStore.setState({ favorites: [] });
  useDownloadedStore.setState({
    downloadedBaseIds: new Set(),
    entries: [],
    loaded: false,
  });
});

describe('VideoTile — rendering', () => {
  it('renders title, duration and views', () => {
    const { getByText } = render(<VideoTile item={item} />);

    expect(getByText('My Video')).toBeTruthy();
    expect(getByText('2:30')).toBeTruthy();
    expect(getByText('10 views')).toBeTruthy();
  });

  it('omits duration/views when not provided', () => {
    const { getByText, queryByText } = render(
      <VideoTile item={{ id: '1', slug: 's', title: 'No Meta', thumbnail: '' }} />
    );

    expect(getByText('No Meta')).toBeTruthy();
    expect(queryByText(/views/)).toBeNull();
  });

  it('shows no status badges when not favorited or downloaded', () => {
    const { queryByTestId } = render(
      <VideoTile item={{ id: '1', slug: 's', title: 'Plain', thumbnail: '' }} />
    );

    expect(queryByTestId('video-tile-fav')).toBeNull();
    expect(queryByTestId('video-tile-downloaded')).toBeNull();
  });

  it('shows the favorite badge when the item is favorited', () => {
    useFavoritesStore.setState({
      favorites: [{ id: '1', slug: 's', title: 't', url: '', thumbnail: '', addedAt: 0 }],
    });

    const { getByTestId, queryByTestId } = render(
      <VideoTile item={{ id: '1', slug: 's', title: 'Fav', thumbnail: '' }} />
    );

    expect(getByTestId('video-tile-fav')).toBeTruthy();
    expect(queryByTestId('video-tile-downloaded')).toBeNull();
  });

  it('shows the downloaded badge when the item has a completed download', () => {
    useDownloadedStore.setState({ downloadedBaseIds: new Set(['1']) });

    const { getByTestId, queryByTestId } = render(
      <VideoTile item={{ id: '1', slug: 's', title: 'Dl', thumbnail: '' }} />
    );

    expect(getByTestId('video-tile-downloaded')).toBeTruthy();
    expect(queryByTestId('video-tile-fav')).toBeNull();
  });
});

describe('VideoTile — gestures', () => {
  it('navigates to the video detail on short tap', () => {
    const { getByTestId } = render(<VideoTile item={item} />);

    fireEvent(getByTestId('video-tile'), 'press');

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/post/[id]',
      params: { id: '1', slug: 's' },
    });
  });

  it('long-press handler does not call the navigation function (wiring guard)', () => {
    const { getByTestId } = render(<VideoTile item={item} />);

    fireEvent(getByTestId('video-tile'), 'longPress');

    // Regression guard: if someone accidentally wires onLongPress to openDetail,
    // this fails. Note: this does NOT verify RN's native press suppression or
    // the native menu — those are verified on device, not in jsdom.
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('VideoTile — context menu actions', () => {
  it('offers Favorite / Download / Follow by default', () => {
    render(<VideoTile item={item} />);

    const ids = mockMenu.lastProps.actions?.map((a) => a.id);
    expect(ids).toEqual(['favorite', 'download', 'follow']);
    const titles = mockMenu.lastProps.actions?.map((a) => a.title);
    expect(titles).toEqual(['Favorite', 'Download', 'Follow author']);
  });

  it('reflects favorited state in the Favorite action', () => {
    useFavoritesStore.setState({
      favorites: [{ id: '1', slug: 's', title: 't', url: '', thumbnail: '', addedAt: 0 }],
    });

    render(<VideoTile item={{ id: '1', slug: 's', title: 'Fav', thumbnail: '' }} />);

    const favoriteAction = mockMenu.lastProps.actions?.find((a) => a.id === 'favorite');
    expect(favoriteAction?.title).toBe('Unfavorite');
  });

  it("adds the item to favorites when the 'favorite' action is dispatched", () => {
    render(<VideoTile item={item} />);

    mockMenu.lastProps.onPressAction?.({ nativeEvent: { event: 'favorite' } });

    expect(useFavoritesStore.getState().favorites.some((f) => f.id === '1')).toBe(true);
  });
});
