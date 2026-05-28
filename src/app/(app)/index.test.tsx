jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    getAllKeys: jest.fn().mockReturnValue([]),
    remove: jest.fn(),
  })),
}));

jest.mock('@/api/video-queries', () => ({
  useVideos: jest.fn().mockReturnValue({
    data: { pages: [{ data: [] }] },
    isPending: false,
    isError: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
    isRefetching: false,
  }),
}));

jest.mock('expo-router', () => ({
  Link: 'Link',
  useLocalSearchParams: jest.fn().mockReturnValue({}),
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: 'FlashList',
}));

import Home from './index';

describe('Home screen', () => {
  it('can import without errors', () => {
    expect(Home).toBeDefined();
    expect(typeof Home).toBe('function');
  });
});
