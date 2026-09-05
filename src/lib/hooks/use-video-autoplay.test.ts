const mockMMKV = {
  value: undefined as boolean | undefined,
};

jest.mock('react-native-mmkv', () => ({
  // storage.tsx imports createMMKV from the same module — keep it available.
  createMMKV: jest.fn(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    getAllKeys: jest.fn(() => []),
    remove: jest.fn(),
  })),
  useMMKVBoolean: (_key: string, _storage: unknown) => [
    mockMMKV.value,
    (v: boolean) => {
      mockMMKV.value = v;
    },
  ],
}));

import { act, renderHook } from '@testing-library/react-native';

import { useVideoAutoplay } from './use-video-autoplay';

beforeEach(() => {
  mockMMKV.value = undefined;
});

describe('useVideoAutoplay', () => {
  it('defaults to on before the user ever touches the toggle', () => {
    const { result } = renderHook(() => useVideoAutoplay());

    expect(result.current.autoplayEnabled).toBe(true);
  });

  it('reflects the stored choice and updates it', () => {
    mockMMKV.value = false;
    const { result } = renderHook(() => useVideoAutoplay());

    expect(result.current.autoplayEnabled).toBe(false);

    act(() => result.current.setAutoplayEnabled(true));
    expect(mockMMKV.value).toBe(true);
  });
});
