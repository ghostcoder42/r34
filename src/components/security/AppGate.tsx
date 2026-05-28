import * as LocalAuthentication from 'expo-local-authentication';
import { SplashScreen } from 'expo-router';
import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { Image, Text } from '@/components/ui';
import { useSecuritySettings } from '@/lib/hooks/use-security-settings';

/**
 * Gates the app behind biometric / device-passcode authentication when the user
 * has enabled "App Lock" in Settings. Re-prompts after the app returns from
 * background if more than `lockTimeoutMs` has elapsed.
 *
 * Renders children only once unlocked; otherwise shows a privacy overlay so the
 * app's real content is never visible behind the system prompt.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { appLock, lockTimeoutMs } = useSecuritySettings();
  const [locked, setLocked] = useState(appLock);
  const lastBackgroundedAt = useRef<number | null>(null);
  const unlockedOnce = useRef(false);

  const authenticate = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      // No biometrics on this device — fail open so the app stays usable.
      setLocked(false);
      unlockedOnce.current = true;
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock app',
      disableDeviceFallback: false,
    });
    if (result.success) {
      setLocked(false);
      unlockedOnce.current = true;
    }
  }, []);

  // Initial lock check.
  useEffect(() => {
    if (!appLock) {
      setLocked(false);
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    void authenticate();
  }, [appLock, authenticate]);

  // Re-lock when returning from background past the configured timeout.
  useEffect(() => {
    if (!appLock) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        lastBackgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active') return;
      const bgAt = lastBackgroundedAt.current;
      lastBackgroundedAt.current = null;
      if (bgAt === null) return;
      const elapsed = Date.now() - bgAt;
      if (elapsed >= lockTimeoutMs) {
        setLocked(true);
      }
    });
    return () => subscription.remove();
  }, [appLock, lockTimeoutMs]);

  if (!locked) return <>{children}</>;

  return (
    <View
      className="absolute inset-0 items-center justify-center bg-[#0f172a]"
      accessibilityLabel="App locked"
    >
      <View className="items-center">
        <Image
          source={require('../../../assets/icon.png')}
          className="mb-4 size-[88px] rounded-[20px]"
          contentFit="contain"
        />
        <Text className="text-lg font-semibold text-white">Locked</Text>
        <Text className="mt-1 text-[13px] text-[#94a3b8]">Authenticate to continue</Text>
        <Text className="mt-6 text-sm text-[#60a5fa]" onPress={() => void authenticate()}>
          Try again
        </Text>
      </View>
    </View>
  );
}
