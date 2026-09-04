jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

jest.mock('@/lib/r34/fetch-error', () => ({
  fetchErrorMessage: jest.fn(() => 'classified network message'),
}));

// Controllable throttle store (real logic covered in update-check-store.test).
const mockCheckStore = {
  autoCheckDue: true,
  recordCheckAt: jest.fn(),
};

jest.mock('@/lib/stores/update-check-store', () => ({
  shouldAutoCheck: () => mockCheckStore.autoCheckDue,
  recordCheckAt: (...args: unknown[]) => mockCheckStore.recordCheckAt(...args),
}));

const defaultRelease: import('@/lib/updater').ReleaseInfo = {
  version: '0.4.0',
  title: 'v0.4.0',
  notes: "What's Changed\n* fix x",
  releaseUrl: 'https://github.com/ghostcoder42/r34/releases/tag/v0.4.0',
  apkUrl: null,
};

const mockUpdater = {
  release: defaultRelease,
  error: null as Error | null,
  persisted: null as Record<string, unknown> | null,
  fetchLatestRelease: jest.fn(),
  saveLastKnownRelease: jest.fn(),
};

jest.mock('@/lib/updater', () => ({
  fetchLatestRelease: (...args: unknown[]) => mockUpdater.fetchLatestRelease(...args),
  isNewerVersion: (latest: string, current: string) => latest !== current && latest > current,
  saveLastKnownRelease: (...args: unknown[]) => mockUpdater.saveLastKnownRelease(...args),
  getLastKnownRelease: () => mockUpdater.persisted,
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert, Linking, Platform } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { useUpdateCheck } from './use-update-check';

jest.spyOn(Alert, 'alert').mockImplementation(() => {});
jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
const setPlatform = (os: 'android' | 'ios') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckStore.autoCheckDue = true;
  mockUpdater.release = defaultRelease;
  mockUpdater.error = null;
  mockUpdater.persisted = null;
  mockUpdater.fetchLatestRelease.mockImplementation(async () => {
    if (mockUpdater.error) throw mockUpdater.error;
    return mockUpdater.release;
  });
});

describe('useUpdateCheck', () => {
  it('seeds the hint from the persisted last check so it survives restarts', () => {
    mockUpdater.persisted = { version: '0.4.0', title: 'v0.4.0', notes: '' };
    // The automatic fetch never resolves — the seed alone must light the row.
    mockUpdater.fetchLatestRelease.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useUpdateCheck('0.3.0'));

    expect(result.current.newerRelease?.version).toBe('0.4.0');
  });

  it('does not seed a persisted hint that no longer beats the installed version', () => {
    // User already updated past the persisted find (e.g. installed manually).
    mockUpdater.persisted = { version: '0.3.0', title: 'v0.3.0', notes: '' };
    mockUpdater.fetchLatestRelease.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useUpdateCheck('0.3.0'));

    expect(result.current.newerRelease).toBeNull();
  });

  it('persists every successful check, up to date or not', async () => {
    const { result } = renderHook(() => useUpdateCheck('0.4.0')); // same as latest
    await waitFor(() => expect(result.current.checking).toBe(false));

    expect(mockUpdater.saveLastKnownRelease).toHaveBeenCalledWith(mockUpdater.release);
  });

  it('skips the automatic check when the daily throttle is not due', async () => {
    mockCheckStore.autoCheckDue = false;

    const { result } = renderHook(() => useUpdateCheck('0.3.0'));

    expect(mockUpdater.fetchLatestRelease).not.toHaveBeenCalled();
    expect(result.current.checking).toBe(false);
  });

  it('checks automatically on mount and only flags the row (no dialogs)', async () => {
    const { result } = renderHook(() => useUpdateCheck('0.3.0'));

    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.newerRelease?.version).toBe('0.4.0');
    expect(mockCheckStore.recordCheckAt).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(showMessage).not.toHaveBeenCalled();
  });

  it('stays completely silent when the automatic check fails', async () => {
    mockUpdater.error = new Error('Network request failed');

    const { result } = renderHook(() => useUpdateCheck('0.3.0'));

    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.newerRelease).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(showMessage).not.toHaveBeenCalled();
  });

  it('manual check with a new release opens the in-app dialog, not an Alert', async () => {
    const { result } = renderHook(() => useUpdateCheck('0.3.0'));
    await waitFor(() => expect(result.current.checking).toBe(false));

    await act(async () => {
      await result.current.runCheck(true);
    });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(result.current.pendingRelease?.version).toBe('0.4.0');

    act(() => result.current.dismissUpdateDialog());
    expect(result.current.pendingRelease).toBeNull();
  });

  it('opens the APK direct link on Android and the release page on iOS', async () => {
    mockUpdater.release = {
      version: '0.4.0',
      title: 'v0.4.0',
      notes: '',
      releaseUrl: 'https://github.com/ghostcoder42/r34/releases/tag/v0.4.0',
      apkUrl: 'https://github.com/ghostcoder42/r34/releases/download/v0.4.0/r34-0.4.0.apk',
    };
    const { result } = renderHook(() => useUpdateCheck('0.3.0'));
    await waitFor(() => expect(result.current.checking).toBe(false));

    setPlatform('android');
    result.current.openReleaseDownload(mockUpdater.release);
    expect(Linking.openURL).toHaveBeenLastCalledWith(mockUpdater.release.apkUrl);

    setPlatform('ios');
    result.current.openReleaseDownload(mockUpdater.release);
    expect(Linking.openURL).toHaveBeenLastCalledWith(mockUpdater.release.releaseUrl);
  });

  it('manual check toasts when already up to date', async () => {
    // Same version installed as the latest release.
    const { result } = renderHook(() => useUpdateCheck('0.4.0'));
    await waitFor(() => expect(result.current.checking).toBe(false));

    await act(async () => {
      await result.current.runCheck(true);
    });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(showMessage).toHaveBeenCalledTimes(1);
    expect((showMessage as jest.Mock).mock.calls[0][0].message).toContain('0.4.0');
  });

  it('manual check shows a failure dialog with the classified cause', async () => {
    const { result } = renderHook(() => useUpdateCheck('0.3.0'));
    await waitFor(() => expect(result.current.checking).toBe(false));
    mockUpdater.error = new Error('Failed to fetch release info: 503');

    await act(async () => {
      await result.current.runCheck(true);
    });

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, message] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBeTruthy();
    expect(message).toBe('classified network message');
  });

  it('ignores concurrent triggers while a check is in flight', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    mockUpdater.fetchLatestRelease.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const { result } = renderHook(() => useUpdateCheck('0.3.0'));
    // Mount fired the automatic check; tapping while it runs must not start
    // a second one.
    await act(async () => {
      await result.current.runCheck(true);
    });

    expect(mockUpdater.fetchLatestRelease).toHaveBeenCalledTimes(1);
    resolveFetch(mockUpdater.release);
    await waitFor(() => expect(result.current.checking).toBe(false));
  });
});
