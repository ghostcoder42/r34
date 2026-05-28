import type * as React from 'react';
import { useEffect } from 'react';
import { CaptureProtection } from 'react-native-capture-protection';

import { useSecuritySettings } from '@/lib/hooks/use-security-settings';

/**
 * Hides the app's real content in the app switcher / recents preview (and
 * blocks screenshots + screen recording) when "Hide Preview" is on.
 *
 * Uses `react-native-capture-protection` which applies FLAG_SECURE on Android
 * (blanks the recents snapshot — a JS overlay loses that race — and blocks
 * screenshots/recording) and the native app-switcher protection on iOS.
 * The previous JS overlay approach was unreliable on Android.
 */
export function PrivacyShield({ children }: { children: React.ReactNode }) {
  const { hidePreview } = useSecuritySettings();

  useEffect(() => {
    if (hidePreview) {
      void CaptureProtection.prevent({
        screenshot: true,
        record: true,
        appSwitcher: true,
      });
    } else {
      void CaptureProtection.allow();
    }
  }, [hidePreview]);

  return children;
}
