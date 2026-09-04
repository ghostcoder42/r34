import * as React from 'react';
import { Alert } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import i18n from '@/lib/i18n';
import { fetchErrorMessage } from '@/lib/r34/fetch-error';
import {
  type ReleaseInfo,
  fetchLatestRelease,
  isNewerVersion,
  recordLastUpdateCheck,
} from '@/lib/updater';

type UseUpdateCheck = {
  /** True while a check is in flight (drives the row's spinner). */
  checking: boolean;
  /** The newer release, when one was found; null otherwise. */
  newerRelease: ReleaseInfo | null;
  /** Runs a check. Manual checks surface every outcome; automatic ones are
   *  silent unless a newer release is found (then only the row text changes). */
  runCheck: (manual: boolean) => Promise<void>;
};

/**
 * Update check against the repo's latest GitHub release. Checking runs once
 * automatically on mount (i.e. every Settings visit); failures are silent in
 * that mode. Manual checks (tapping the version row) report every outcome:
 * a dialog for a new release or a failure, a toast when already up to date.
 */
export function useUpdateCheck(currentVersion: string): UseUpdateCheck {
  const [checking, setChecking] = React.useState(false);
  const [newerRelease, setNewerRelease] = React.useState<ReleaseInfo | null>(null);
  const inFlight = React.useRef(false);

  const runCheck = React.useCallback(
    async (manual: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setChecking(true);
      try {
        const release = await fetchLatestRelease();
        recordLastUpdateCheck();
        if (isNewerVersion(release.version, currentVersion)) {
          setNewerRelease(release);
          if (manual) {
            announceNewRelease(release);
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

  return { checking, newerRelease, runCheck };
}

function translate(key: string, options?: Record<string, unknown>): string {
  const t = i18n.t.bind(i18n) as (key: string, options?: Record<string, unknown>) => string;
  return t(key, options ?? {});
}

function announceNewRelease(release: ReleaseInfo): void {
  const body = [release.title, release.notes].filter(Boolean).join('\n\n');
  Alert.alert(translate('settings.update_available_title', { version: release.version }), body);
}
