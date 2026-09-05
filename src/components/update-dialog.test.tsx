jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

import { cleanup, fireEvent, render, screen } from '@/lib/test-utils';
import type { ReleaseInfo } from '@/lib/updater';

import { UpdateDialog } from './update-dialog';

const release: ReleaseInfo = {
  version: '0.4.0',
  title: 'v0.4.0',
  notes: "What's Changed\n• fix one\n• feat two",
  releaseUrl: 'https://github.com/ghostcoder42/r34/releases/tag/v0.4.0',
  apkUrl: 'https://github.com/ghostcoder42/r34/releases/download/v0.4.0/r34-0.4.0.apk',
  apkSize: 44040192, // 42 MB
  publishedAt: '2026-09-05T10:00:00Z',
};

const noop = () => {};

afterEach(cleanup);

describe('UpdateDialog', () => {
  it('renders nothing without a release', () => {
    render(<UpdateDialog release={null} currentVersion="0.3.0" onClose={noop} onDownload={noop} />);

    expect(screen.queryByText(/0\.4\.0/)).toBeNull();
  });

  it('shows version, message, meta line and notes', () => {
    render(
      <UpdateDialog release={release} currentVersion="0.3.0" onClose={noop} onDownload={noop} />
    );

    // Title carries the new version; the message mentions the current one.
    expect(screen.getAllByText(/0\.4\.0/).length).toBeGreaterThan(0);
    expect(screen.getByText(/0\.3\.0/)).toBeTruthy();
    // Meta: release date (ISO slice, no Intl) and APK size.
    expect(screen.getByText(/2026-09-05/)).toBeTruthy();
    expect(screen.getByText(/42\.0 MB/)).toBeTruthy();
    // Notes render (getByText matches across newlines in one Text node).
    expect(screen.getByText(/What's Changed/)).toBeTruthy();
    expect(screen.getByText(/• fix one/)).toBeTruthy();
  });

  it('hides the meta line and notes when absent', () => {
    const minimal: ReleaseInfo = {
      version: '0.4.0',
      title: 'v0.4.0',
      notes: '',
      releaseUrl: release.releaseUrl,
      apkUrl: null,
    };

    render(
      <UpdateDialog release={minimal} currentVersion="0.3.0" onClose={noop} onDownload={noop} />
    );

    expect(screen.queryByText(/MB/)).toBeNull();
    expect(screen.queryByText(/What's new:/)).toBeNull();
  });

  it('invokes onClose and onDownload from the buttons and backdrop', () => {
    const onClose = jest.fn();
    const onDownload = jest.fn();

    render(
      <UpdateDialog
        release={release}
        currentVersion="0.3.0"
        onClose={onClose}
        onDownload={onDownload}
      />
    );

    fireEvent.press(screen.getByTestId('update-dialog-download'));
    expect(onDownload).toHaveBeenCalledWith(release);

    fireEvent.press(screen.getByTestId('update-dialog-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('update-dialog-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
