jest.mock('expo-intent-launcher', () => ({
  ActivityAction: {
    APP_OPEN_BY_DEFAULT_SETTINGS: 'android.settings.APP_OPEN_BY_DEFAULT_SETTINGS',
    APPLICATION_DETAILS_SETTINGS: 'android.settings.APPLICATION_DETAILS_SETTINGS',
  },
  startActivityAsync: jest.fn(),
}));

jest.mock('expo-application', () => ({ applicationId: 'app.r34.test' }));

import { ActivityAction, startActivityAsync } from 'expo-intent-launcher';

import { openAppLinkSettings } from './open-app-link-settings';

const launch = startActivityAsync as unknown as jest.Mock;

describe('openAppLinkSettings', () => {
  beforeEach(() => launch.mockReset());

  it('opens the dedicated "Open by default" screen for this package', async () => {
    launch.mockResolvedValueOnce(undefined);

    await openAppLinkSettings();

    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith(ActivityAction.APP_OPEN_BY_DEFAULT_SETTINGS, {
      data: 'package:app.r34.test',
    });
  });

  it('falls back to the app details screen when the direct one is unavailable', async () => {
    launch.mockRejectedValueOnce(new Error('no activity'));

    await openAppLinkSettings();

    expect(launch).toHaveBeenCalledTimes(2);
    expect(launch).toHaveBeenLastCalledWith(ActivityAction.APPLICATION_DETAILS_SETTINGS, {
      data: 'package:app.r34.test',
    });
  });
});
