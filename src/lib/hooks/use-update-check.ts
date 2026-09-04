import * as React from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import i18n from '@/lib/i18n';
import { fetchErrorMessage } from '@/lib/r34/fetch-error';
import {
  type ReleaseInfo,
  fetchLatestRelease,
  getLastKnownRelease,
  isNewerVersion,
  recordLastUpdateCheck,
  saveLastKnownRelease,
} from '@/lib/updater';

type UseUpdateCheck = {
  /** True while a check is in flight (drives the row's spinner). */
  checking: boolean;
  /** The newer release, when one was found; null otherwise. */
  newerRelease: ReleaseInfo | null;
  /** Runs a check. Manual checks surface every outcome; automatic ones are
   *  silent unless a newer release is found (then only the row text changes). */
  runCheck: (manual: boolean) => Promise<void>;
  /** Release shown in the in-app update dialog (manual checks only). */
  pendingRelease: ReleaseInfo | null;
  dismissUpdateDialog: () => void;
  /** Opens the APK direct link on Android, the release page elsewhere. */
  openReleaseDownload: (release: ReleaseInfo) => void;
};

/**
 * Update check against the repo's latest GitHub release. Checking runs once
 * automatically on mount (i.e. every Settings visit); failures are silent in
 * that mode. Manual checks (tapping the version row) report every outcome:
 * a dialog for a new release or a failure, a toast when already up to date.
 *
 * The last successful check is persisted, so the "update available" hint is
 * seeded on mount and survives restarts even before the fresh fetch resolves.
 */
export function useUpdateCheck(currentVersion: string): UseUpdateCheck {
  const [checking, setChecking] = React.useState(false);
  const [pendingRelease, setPendingRelease] = React.useState<ReleaseInfo | null>(null);
  const [newerRelease, setNewerRelease] = React.useState<ReleaseInfo | null>(() => {
    // Only seed when the persisted find still beats the installed version —
    // after updating the app the stale hint must not come back.
    const known = getLastKnownRelease();
    return known && isNewerVersion(known.version, currentVersion) ? known : null;
  });
  const inFlight = React.useRef(false);

  const runCheck = React.useCallback(
    async (manual: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setChecking(true);
      try {
        const release = await fetchLatestRelease();
        recordLastUpdateCheck();
        // Persist every successful outcome (also clears a stale newer-hint
        // once the installed version catches up).
        saveLastKnownRelease(release);
        if (isNewerVersion(release.version, currentVersion)) {
          setNewerRelease(release);
          if (manual) {
            setPendingRelease(release);
          }
        } else {
          setNewerRelease(null);
          if (manual) {
            showMessage({
              message: translate('settings.up_to_date', { version: currentVersion }),
              type: 'success',
              position: 'center',
              duration: 2500,
            });
          }
        }
      } catch (error) {
        // Automatic checks stay silent — the next Settings visit retries.
        if (manual) {
          Alert.alert(translate('settings.update_check_failed'), fetchErrorMessage(error));
        }
      } finally {
        inFlight.current = false;
        setChecking(false);
      }
    },
    [currentVersion]
  );

  React.useEffect(() => {
    runCheck(false);
  }, [runCheck]);

  /**
   * Android prefers the release's direct APK asset (what EAS attaches);
   * everything else lands on the human-facing release page.
   */
  const openReleaseDownload = React.useCallback((release: ReleaseInfo) => {
    const url =
      Platform.OS === 'android' ? (release.apkUrl ?? release.releaseUrl) : release.releaseUrl;
    Linking.openURL(url).catch(() => {
      // Nothing sensible to do when no browser/installer picks it up.
    });
  }, []);

  return {
    checking,
    newerRelease,
    /** Release shown in the in-app dialog; set only by manual checks. */
    pendingRelease,
    runCheck,
    dismissUpdateDialog: () => setPendingRelease(null),
    openReleaseDownload,
  };
}

function translate(key: string, options?: Record<string, unknown>): string {
  const t = i18n.t.bind(i18n) as (key: string, options?: Record<string, unknown>) => string;
  return t(key, options ?? {});
}
