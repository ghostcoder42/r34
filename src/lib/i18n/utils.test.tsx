// In-memory stand-in for the MMKV string hook (mirrors the global
// react-native-mmkv manual mock, plus useMMKVString).
const mockMMKVStrings = new Map<string, string>();

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    set: jest.fn(),
    getString: jest.fn(() => undefined),
    getAllKeys: jest.fn(() => []),
    remove: jest.fn(),
  })),
  useMMKVString: (key: string) => [
    mockMMKVStrings.get(key),
    (value: string) => {
      mockMMKVStrings.set(key, value);
    },
  ],
}));

import { renderHook } from '@testing-library/react-native';

import i18n from './index';
import { LOCAL, useSelectedLanguage } from './utils';

beforeEach(() => {
  mockMMKVStrings.clear();
});

describe('useSelectedLanguage', () => {
  it('falls back to the language i18n is actually rendering before any pick', () => {
    // Fresh install: nothing stored under the LOCAL key — the selector must
    // still highlight what the bootstrap detected (i18n.language), not nothing.
    const { result } = renderHook(() => useSelectedLanguage());

    expect(result.current.language).toBe(i18n.language);
  });

  it('prefers the stored language once the user has picked one', async () => {
    const { result } = renderHook(() => useSelectedLanguage());

    result.current.setLanguage('ja');

    // The stored pick wins on the next mount (and i18n switched too).
    expect(i18n.language).toBe('ja');
    expect(mockMMKVStrings.get(LOCAL)).toBe('ja');
    const { result: again } = renderHook(() => useSelectedLanguage());
    expect(again.current.language).toBe('ja');

    // Restore the default for other suites sharing the i18n singleton.
    await i18n.changeLanguage('en');
    mockMMKVStrings.set(LOCAL, 'en');
  });
});
