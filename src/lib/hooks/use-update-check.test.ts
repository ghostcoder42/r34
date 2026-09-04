jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

jest.mock('@/lib/r34/fetch-error', () => ({
  fetchErrorMessage: jest.fn(() => 'classified network message'),
}));

const mockUpdater = {
  release: { version: '0.4.0', title: 'v0.4.0', notes: "What's Changed\n* fix x" },
  error: null as Error | null,
  fetchLatestRelease: jest.fn(),
  recordLastUpdateCheck: jest.fn(),
};

jest.mock('@/lib/updater', () => ({
  fetchLatestRelease: (...args: unknown[]) => mockUpdater.fetchLatestRelease(...args),
  isNewerVersion: (latest: string, current: string) => latest !== current && latest > current,
  recordLastUpdateCheck: (...args: unknown[]) => mockUpdater.recordLastUpdateCheck(...args),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { useUpdateCheck } from './use-update-check';

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdater.error = null;
  mockUpdater.fetchLatestRelease.mockImplementation(async () => {
    if (mockUpdater.error) throw mockUpdater.error;
    return mockUpdater.release;
  });
});

describe('useUpdateCheck', () => {
  it('checks automatically on mount and only flags the row (no dialogs)', async () => {
    const { result } = renderHook(() => useUpdateCheck('0.3.0'));

    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.newerRelease?.version).toBe('0.4.0');
    expect(mockUpdater.recordLastUpdateCheck).toHaveBeenCalledTimes(1);
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

  it('manual check announces a new release with a dialog (title + notes)', async () => {
    const { result } = renderHook(() => useUpdateCheck('0.3.0'));
    await waitFor(() => expect(result.current.checking).toBe(false));

    await act(async () => {
      await result.current.runCheck(true);
    });

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, body] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toContain('0.4.0');
    expect(body).toContain("What's Changed");
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
