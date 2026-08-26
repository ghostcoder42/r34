import * as ApplicationNS from 'expo-application';
import { ActivityAction, startActivityAsync } from 'expo-intent-launcher';

const { applicationId } = ApplicationNS;

/**
 * Management entry for the site domain's link handling: opens the system
 * screen where the user approves which hosts this app may open. The domain
 * can't pass server-side verification (we don't own it), so it must be
 * enabled by hand — Android 12+ silently routes unverified/unselected links
 * to the browser without asking.
 * Tries the direct "Open by default" screen (Android 12+), falls back to
 * the app details screen where that entry lives.
 */
export async function openAppLinkSettings(): Promise<void> {
  const params = { data: `package:${applicationId}` };
  try {
    await startActivityAsync(ActivityAction.APP_OPEN_BY_DEFAULT_SETTINGS, params);
  } catch {
    await startActivityAsync(ActivityAction.APPLICATION_DETAILS_SETTINGS, params);
  }
}
