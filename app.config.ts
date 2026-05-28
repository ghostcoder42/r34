/* eslint-disable max-lines-per-function */
import type { ConfigContext, ExpoConfig } from '@expo/config';
import type { AppIconBadgeConfig } from 'app-icon-badge/types';

import { ClientEnv, Env } from './env';

// Sensitive values — provided via env (e.g. .env.development locally, GitHub
// secrets in CI). Never committed.
const EAS_PROJECT_ID: string = process.env.EAS_PROJECT_ID ?? '';
const EXPO_ACCOUNT_OWNER: string = process.env.EXPO_ACCOUNT_OWNER ?? '';

const appIconBadgeConfig: AppIconBadgeConfig = {
  enabled: Env.APP_ENV !== 'production',
  badges: [
    {
      text: Env.APP_ENV,
      type: 'banner',
      color: 'white',
    },
    {
      text: Env.VERSION.toString(),
      type: 'ribbon',
      color: 'white',
    },
  ],
};

export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    name: Env.NAME,
    description: `${Env.NAME} Mobile App`,
    owner: EXPO_ACCOUNT_OWNER || undefined,
    scheme: Env.SCHEME,
    slug: 'r34',
    version: Env.VERSION.toString(),
    orientation: 'default',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: Env.BUNDLE_ID,
      config: {
        usesNonExemptEncryption: false, // Avoid the export compliance warning on the app store
      },
      infoPlist: {
        NSFaceIDUsageDescription: 'Unlock the app and confirm sensitive actions.',
      },
    },
    experiments: {
      typedRoutes: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#2E3C4B',
      },
      package: Env.PACKAGE,
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      [
        'expo-splash-screen',
        {
          backgroundColor: '#2E3C4B',
          image: './assets/splash-icon.png',
          imageWidth: 150,
        },
      ],
      [
        'expo-font',
        {
          fonts: ['./assets/fonts/Inter.ttf'],
        },
      ],
      'expo-localization',
      'expo-router',
      'expo-image',
      'expo-status-bar',
      'expo-video',
      'expo-local-authentication',
      ['react-native-capture-protection', { captureType: 'base' }],
      ['app-icon-badge', appIconBadgeConfig],
      ['react-native-edge-to-edge'],
      [
        'expo-build-properties',
        {
          ios: {
            deploymentTarget: '16.4',
          },
          android: {
            abiFilters: ['arm64-v8a'],
          },
        },
      ],
      './plugins/with-app-icons',
      './plugins/with-android-no-lint',
      './plugins/with-gradle-build-cache',
    ],
    extra: {
      ...ClientEnv,
      eas: {
        projectId: EAS_PROJECT_ID || undefined,
      },
    },
  }) as ExpoConfig;
