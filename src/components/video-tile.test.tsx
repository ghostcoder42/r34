import { endVideoOpen, resetOpenGuard } from '@/lib/navigation/open-guard';
import { useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
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
    actions?: { id: string; title: string; attributes?: { disabled?: boolean } }[];
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

const mockRetryDownload = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/download/download-video', () => ({
  downloadVideo: jest.fn(),
  cancelDownload: jest.fn(),
  pauseDownload: jest.fn(),
  retryDownload: (...args: unknown[]) => mockRetryDownload(...args),
}));

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
  useActiveDownloadsStore.setState({ tasks: {} });
  mockRetryDownload.mockClear();
  resetOpenGuard();
});

describe('VideoTile — rendering', () => {
  it('renders title, duration and views', async () => {
    const { getByText } = await render(<VideoTile item={item} />);

    expect(getByText('My Video')).toBeTruthy();
    expect(getByText('2:30')).toBeTruthy();
    expect(getByText('10 views')).toBeTruthy();
  });

  it('omits duration/views when not provided', async () => {
    const { getByText, queryByText } = await render(
      <VideoTile item={{ id: '1', slug: 's', title: 'No Meta', thumbnail: '' }} />
    );

    expect(getByText('No Meta')).toBeTruthy();
    expect(queryByText(/views/)).toBeNull();
  });

  it('shows no status badges when not favorited or downloaded', async () => {
    const { queryByTestId } = await render(
      <VideoTile item={{ id: '1', slug: 's', title: 'Plain', thumbnail: '' }} />
    );

    expect(queryByTestId('video-tile-fav')).toBeNull();
    expect(queryByTestId('video-tile-downloaded')).toBeNull();
  });

  it('shows the favorite badge when the item is favorited', async () => {
    useFavoritesStore.setState({
      favorites: [{ id: '1', slug: 's', title: 't', url: '', thumbnail: '', addedAt: 0 }],
    });

    const { getByTestId, queryByTestId } = await render(
      <VideoTile item={{ id: '1', slug: 's', title: 'Fav', thumbnail: '' }} />
    );

    expect(getByTestId('video-tile-fav')).toBeTruthy();
    expect(queryByTestId('video-tile-downloaded')).toBeNull();
  });

  it('shows the downloaded badge when the item has a completed download', async () => {
    useDownloadedStore.setState({ downloadedBaseIds: new Set(['1']) });

    const { getByTestId, queryByTestId } = await render(
      <VideoTile item={{ id: '1', slug: 's', title: 'Dl', thumbnail: '' }} />
    );

    expect(getByTestId('video-tile-downloaded')).toBeTruthy();
    expect(queryByTestId('video-tile-fav')).toBeNull();
  });
});

describe('VideoTile — gestures', () => {
  it('navigates to the video detail on short tap', async () => {
    const { getByTestId } = await render(<VideoTile item={item} />);

    await fireEvent(getByTestId('video-tile'), 'press');

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/post/[id]',
      params: { id: '1', slug: 's' },
    });
  });

  it('long-press handler does not call the navigation function (wiring guard)', async () => {
    const { getByTestId } = await render(<VideoTile item={item} />);

    await fireEvent(getByTestId('video-tile'), 'longPress');

    // Regression guard: if someone accidentally wires onLongPress to openDetail,
    // this fails. Note: this does NOT verify RN's native press suppression or
    // the native menu — those are verified on device, not in jsdom.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('pushes only once for rapid repeat taps on the same card', async () => {
    const { getByTestId } = await render(<VideoTile item={item} />);

    for (let i = 0; i < 6; i++) {
      await fireEvent(getByTestId('video-tile'), 'press');
    }

    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('opens the same video again once the pushed screen has focused', async () => {
    const { getByTestId } = await render(<VideoTile item={item} />);

    await fireEvent(getByTestId('video-tile'), 'press');
    // The post screen reports focus — the open completed.
    endVideoOpen();
    await fireEvent(getByTestId('video-tile'), 'press');

    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it('still navigates for a different card while another open is in flight', async () => {
    const other = { ...item, id: '2' };
    const { getAllByTestId } = await render(
      <>
        <VideoTile item={item} />
        <VideoTile item={other} />
      </>
    );

    const tiles = getAllByTestId('video-tile');
    await fireEvent(tiles[0], 'press');
    await fireEvent(tiles[1], 'press');

    expect(mockPush).toHaveBeenCalledTimes(2);
  });
});

describe('VideoTile — context menu actions', () => {
  it('offers Favorite / Download / Follow by default', async () => {
    await render(<VideoTile item={item} />);

    const ids = mockMenu.lastProps.actions?.map((a) => a.id);
    expect(ids).toEqual(['favorite', 'download', 'follow']);
    const titles = mockMenu.lastProps.actions?.map((a) => a.title);
    expect(titles).toEqual(['Favorite', 'Download', 'Follow author']);
  });

  it('reflects favorited state in the Favorite action', async () => {
    useFavoritesStore.setState({
      favorites: [{ id: '1', slug: 's', title: 't', url: '', thumbnail: '', addedAt: 0 }],
    });

    await render(<VideoTile item={{ id: '1', slug: 's', title: 'Fav', thumbnail: '' }} />);

    const favoriteAction = mockMenu.lastProps.actions?.find((a) => a.id === 'favorite');
    expect(favoriteAction?.title).toBe('Unfavorite');
  });

  it("adds the item to favorites when the 'favorite' action is dispatched", async () => {
    await render(<VideoTile item={item} />);

    mockMenu.lastProps.onPressAction?.({ nativeEvent: { event: 'favorite' } });

    expect(useFavoritesStore.getState().favorites.some((f) => f.id === '1')).toBe(true);
  });

  it('swallows a tap landing right after a menu action (popup-dismiss ghost)', async () => {
    // Reproduces the device bug: choosing a menu item starts the popup's
    // dismiss animation; while it plays the popup is visible but not
    // touchable, so a fast follow-up tap falls through onto a tile and used
    // to open its video.
    const { getByTestId } = await render(<VideoTile item={item} />);

    mockMenu.lastProps.onPressAction?.({ nativeEvent: { event: 'favorite' } });
    await fireEvent.press(getByTestId('video-tile'));
    expect(mockPush).not.toHaveBeenCalled();

    // After the shield window the same tap navigates again.
    const nowSpy = jest.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(Date.now() + 700);
      await fireEvent.press(getByTestId('video-tile'));
      expect(mockPush).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('shields a NEIGHBORING tile too — the ghost lands under the menu', async () => {
    const first = await render(<VideoTile item={item} />);
    const second = await render(<VideoTile item={{ ...item, id: '2' }} />);

    // Menu interaction on tile 1…
    mockMenu.lastProps.onPressAction?.({ nativeEvent: { event: 'favorite' } });
    // …ghost tap falls through onto tile 2 (a different instance).
    await fireEvent.press(second.getByTestId('video-tile'));
    expect(mockPush).not.toHaveBeenCalled();

    // Sanity: tile 1's own tree is unaffected by the shield's expiry reset.
    expect(first.getByTestId('video-tile')).toBeTruthy();
  });

  it('offers Resume download (enabled) when the task is errored or paused', async () => {
    useActiveDownloadsStore.setState({
      tasks: {
        '1': {
          baseId: '1',
          title: 'My Video',
          thumbnail: '',
          progress: 0.4,
          status: 'error',
          startedAt: 0,
        },
      },
    });
    await render(<VideoTile item={item} />);
    const errored = mockMenu.lastProps.actions?.find((a) => a.id === 'download');
    expect(errored?.title).toBe('Resume download');
    expect(errored?.attributes?.disabled).toBeUndefined();

    useActiveDownloadsStore.setState({
      tasks: {
        '1': {
          baseId: '1',
          title: 'My Video',
          thumbnail: '',
          progress: 0.4,
          status: 'paused',
          startedAt: 0,
        },
      },
    });
    await render(<VideoTile item={item} />);
    const paused = mockMenu.lastProps.actions?.find((a) => a.id === 'download');
    expect(paused?.title).toBe('Resume download');
    expect(paused?.attributes?.disabled).toBeUndefined();
  });

  it('disables Download while the task is actively downloading', async () => {
    useActiveDownloadsStore.setState({
      tasks: {
        '1': {
          baseId: '1',
          title: 'My Video',
          thumbnail: '',
          progress: 0.4,
          status: 'downloading',
          startedAt: 0,
        },
      },
    });
    await render(<VideoTile item={item} />);

    const downloadAction = mockMenu.lastProps.actions?.find((a) => a.id === 'download');
    expect(downloadAction?.title).toBe('Downloading…');
    expect(downloadAction?.attributes?.disabled).toBe(true);
  });

  it("resumes (retries) instead of starting fresh when a paused task's download is dispatched", async () => {
    useActiveDownloadsStore.setState({
      tasks: {
        '1': {
          baseId: '1',
          title: 'My Video',
          thumbnail: '',
          progress: 0.4,
          status: 'paused',
          startedAt: 0,
        },
      },
    });
    await render(<VideoTile item={item} />);

    mockMenu.lastProps.onPressAction?.({ nativeEvent: { event: 'download' } });

    expect(mockRetryDownload).toHaveBeenCalledWith('1');
  });
});
