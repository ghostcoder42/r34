import { View } from 'react-native';
import { CaptureProtection } from 'react-native-capture-protection';

import { useSecuritySettings } from '@/lib/hooks/use-security-settings';
import { cleanup, render } from '@/lib/test-utils';

import { PrivacyShield } from './PrivacyShield';

jest.mock('@/lib/hooks/use-security-settings', () => ({
  useSecuritySettings: jest.fn(),
}));

afterEach(cleanup);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PrivacyShield', () => {
  it('calls CaptureProtection.prevent when hidePreview is on', () => {
    (useSecuritySettings as jest.Mock).mockReturnValue({ hidePreview: true });

    render(
      <PrivacyShield>
        <View />
      </PrivacyShield>
    );

    expect(CaptureProtection.prevent).toHaveBeenCalledWith({
      screenshot: true,
      record: true,
      appSwitcher: true,
    });
    expect(CaptureProtection.allow).not.toHaveBeenCalled();
  });

  it('calls CaptureProtection.allow when hidePreview is off', () => {
    (useSecuritySettings as jest.Mock).mockReturnValue({ hidePreview: false });

    render(
      <PrivacyShield>
        <View />
      </PrivacyShield>
    );

    expect(CaptureProtection.allow).toHaveBeenCalled();
    expect(CaptureProtection.prevent).not.toHaveBeenCalled();
  });
});
