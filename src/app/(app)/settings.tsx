import { Env } from '@env';
import { Image } from 'expo-image';
import * as LocalAuthentication from 'expo-local-authentication';
import type * as React from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, TouchableOpacity } from 'react-native';

import { AppIconItem } from '@/components/settings/app-icon-item';
import { ItemsContainer } from '@/components/settings/items-container';
import { LanguageItem } from '@/components/settings/language-item';
import { ThemeItem } from '@/components/settings/theme-item';
import { FocusAwareStatusBar, SafeAreaView, ScrollView, Text, View, colors } from '@/components/ui';
import { Trash } from '@/components/ui/icons';
import { UpdateDialog } from '@/components/update-dialog';
import { LOCK_TIMEOUT_OPTIONS, useSecuritySettings } from '@/lib/hooks/use-security-settings';
import { useUpdateCheck } from '@/lib/hooks/use-update-check';
import { useTranslate } from '@/lib/i18n';
import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import { ORIENTATIONS, useOrientationStore } from '@/lib/stores/orientation-store';
import { useTabConfigStore } from '@/lib/stores/tab-config-store';
import { useColorScheme } from 'nativewind';

import { openAppLinkSettings } from '@/lib/open-app-link-settings';

const SITE_DOMAIN = 'rule34video.com';

/**
 * A plain-text settings row. `label` is a pre-translated string passed in by
 * the caller (build it via useTranslate() with a settings.* translation key).
 * `loading` swaps the value for a spinner (used by the update check).
 */
function Row({
  label,
  value,
  icon,
  onPress,
  loading,
}: {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  loading?: boolean;
}) {
  const actionable = onPress !== undefined;
  return (
    <Pressable
      onPress={onPress}
      pointerEvents={actionable ? 'auto' : 'none'}
      className="flex-1 flex-row items-center justify-between px-4 py-3"
    >
      <View className="flex-row items-center">
        {icon ? <View className="pr-2">{icon}</View> : null}
        <Text className="text-neutral-900 dark:text-neutral-100">{label}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" />
      ) : value ? (
        <Text className="text-neutral-500 dark:text-neutral-400">{value}</Text>
      ) : null}
    </Pressable>
  );
}

export default function Settings() {
  const t = useTranslate();
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? colors.neutral[400] : colors.neutral[500];
  const { tabs, setTab } = useTabConfigStore();
  const clearDownloads = useDownloadedStore((s) => s.clearAll);
  const orientation = useOrientationStore((s) => s.selectedIds);
  const toggleOrientation = useOrientationStore((s) => s.toggle);
  const clearOrientation = useOrientationStore((s) => s.clear);
  const { appLock, setAppLock, lockTimeoutMs, setLockTimeoutMs, hidePreview, setHidePreview } =
    useSecuritySettings();
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const {
    checking,
    newerRelease,
    pendingRelease,
    runCheck,
    dismissUpdateDialog,
    openReleaseDownload,
  } = useUpdateCheck(Env.VERSION);

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then((has) => {
      setBiometricsAvailable(has);
    });
  }, []);

  const handleLockTimeoutPress = () => {
    const buttons = LOCK_TIMEOUT_OPTIONS.map((opt) => ({
      text: t(opt.tx),
      onPress: () => setLockTimeoutMs(opt.value),
    }));
    buttons.push({ text: t('common.cancel'), onPress: () => {} });
    Alert.alert(t('settings.auto_lock_after'), undefined, buttons);
  };

  const handleClearCache = () => {
    Image.clearDiskCache()
      .then(() => Alert.alert(t('common.done'), t('settings.cache_cleared')))
      .catch(() => Alert.alert(t('common.error'), t('settings.clear_cache_failed')));
  };

  const handleClearDownloads = () => {
    Alert.alert(t('settings.clear_downloads_title'), t('settings.clear_downloads_msg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.clear'),
        style: 'destructive',
        onPress: () => {
          clearDownloads().catch(() =>
            Alert.alert(t('common.error'), t('settings.clear_downloads_failed'))
          );
        },
      },
    ]);
  };

  const toggleTabs: {
    key: 'search' | 'following' | 'library';
    tx: 'tabs.search' | 'tabs.following' | 'tabs.library';
  }[] = [
    { key: 'search', tx: 'tabs.search' },
    { key: 'following', tx: 'tabs.following' },
    { key: 'library', tx: 'tabs.library' },
  ];

  return (
    <>
      <FocusAwareStatusBar />
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
        <ScrollView className="flex-1">
          <View className="flex-1 px-4 py-4">
            {/* Preferences */}
            <ItemsContainer title="settings.general">
              <LanguageItem />
              <ThemeItem />
              <AppIconItem />
            </ItemsContainer>

            {/* Privacy & Security */}
            <View className="pt-2">
              <Text
                className="text-neutral-900 dark:text-neutral-100 pb-1 text-lg"
                tx="settings.privacy_security"
              />
              <View className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
                {biometricsAvailable ? (
                  <View className="flex-row items-center justify-between px-4 py-3">
                    <Text
                      className="text-neutral-900 dark:text-neutral-100"
                      tx="settings.app_lock"
                    />
                    <TouchableOpacity
                      onPress={() => setAppLock(!appLock)}
                      testID="app-lock-toggle"
                      className={`h-6 w-11 rounded-full ${appLock ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}
                    >
                      <View
                        className={`mt-0.5 h-5 w-5 rounded-full bg-white ${appLock ? 'ml-5' : 'ml-0.5'}`}
                      />
                    </TouchableOpacity>
                  </View>
                ) : null}
                {biometricsAvailable && appLock ? (
                  <Pressable
                    onPress={handleLockTimeoutPress}
                    className="flex-row items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-700"
                  >
                    <Text
                      className="text-neutral-900 dark:text-neutral-100"
                      tx="settings.auto_lock_after"
                    />
                    <Text className="text-neutral-500 dark:text-neutral-400">
                      {t(
                        LOCK_TIMEOUT_OPTIONS.find((o) => o.value === lockTimeoutMs)?.tx ??
                          'settings.seconds_5'
                      )}
                    </Text>
                  </Pressable>
                ) : null}
                <View className="flex-row items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-700">
                  <View className="flex-1 pr-2">
                    <Text
                      className="text-neutral-900 dark:text-neutral-100"
                      tx="settings.hide_preview"
                    />
                    <Text
                      className="text-neutral-500 dark:text-neutral-400 mt-0.5 text-xs"
                      tx="settings.hide_preview_desc"
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => setHidePreview(!hidePreview)}
                    testID="hide-preview-toggle"
                    className={`h-6 w-11 rounded-full ${hidePreview ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}
                  >
                    <View
                      className={`mt-0.5 h-5 w-5 rounded-full bg-white ${hidePreview ? 'ml-5' : 'ml-0.5'}`}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Bottom tabs visibility */}
            <View className="pt-2">
              <Text
                className="text-neutral-900 dark:text-neutral-100 pb-1 text-lg"
                tx="settings.bottom_tabs"
              />
              <View className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
                {toggleTabs.map((t) => (
                  <View key={t.key} className="flex-row items-center justify-between px-4 py-3">
                    <Text className="text-neutral-900 dark:text-neutral-100" tx={t.tx} />
                    <TouchableOpacity
                      onPress={() => setTab(t.key, !tabs[t.key])}
                      className={`h-6 w-11 rounded-full ${tabs[t.key] ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}
                    >
                      <View
                        className={`mt-0.5 h-5 w-5 rounded-full bg-white ${tabs[t.key] ? 'ml-5' : 'ml-0.5'}`}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <Text
                className="text-neutral-500 dark:text-neutral-400 mt-1 px-1 text-xs"
                tx="settings.bottom_tabs_desc"
              />
            </View>

            {/* Content orientation (multi-select, applied via the flag1 URL param) */}
            <View className="pt-2">
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-neutral-900 dark:text-neutral-100 pb-1 text-lg"
                  tx="settings.orientation"
                />
                {orientation.length > 0 ? (
                  <TouchableOpacity onPress={clearOrientation} className="pb-1">
                    <Text className="text-primary-500 text-xs" tx="settings.show_all" />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
                {ORIENTATIONS.map((o) => {
                  const selected = orientation.includes(o.id);
                  return (
                    <TouchableOpacity
                      key={o.id}
                      onPress={() => toggleOrientation(o.id)}
                      className="flex-row items-center justify-between px-4 py-3"
                    >
                      <Text className="text-neutral-900 dark:text-neutral-100">{o.label}</Text>
                      <View
                        className={`h-5 w-5 items-center justify-center rounded border-2 ${selected ? 'border-primary-500 bg-primary-500' : 'border-neutral-300 dark:border-neutral-600'}`}
                      >
                        {selected ? <Text className="text-xs font-bold text-white">✓</Text> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text
                className="text-neutral-500 dark:text-neutral-400 mt-1 px-1 text-xs"
                tx="settings.orientation_desc"
              />
            </View>

            {/* Open site links in-app (Android): domain needs manual approval */}
            {Platform.OS === 'android' ? (
              <View className="pt-2">
                <Text
                  className="text-neutral-900 dark:text-neutral-100 pb-1 text-lg"
                  tx="settings.open_links"
                />
                <View className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
                  <Pressable
                    android_ripple={{ color: '#00000020' }}
                    onPress={() => void openAppLinkSettings()}
                    className="flex-row items-center justify-between px-4 py-3"
                  >
                    <Text className="text-neutral-900 dark:text-neutral-100">{SITE_DOMAIN}</Text>
                    <Text className="text-primary-500">{t('settings.manage_links')}</Text>
                  </Pressable>
                </View>
                <Text
                  className="text-neutral-500 dark:text-neutral-400 mt-1 px-1 text-xs"
                  tx="settings.open_links_desc"
                />
              </View>
            ) : null}

            {/* Data & Storage */}
            <ItemsContainer title="settings.data_storage">
              <Row
                label={t('settings.clear_cache')}
                icon={<Trash color={iconColor} />}
                onPress={handleClearCache}
              />
              <Row
                label={t('settings.clear_downloaded')}
                icon={<Trash color={iconColor} />}
                onPress={handleClearDownloads}
              />
            </ItemsContainer>

            {/* About */}
            <ItemsContainer title="settings.about">
              <Row label={t('settings.app_name')} value={Env.NAME} />
              <Row
                label={newerRelease ? t('settings.update_available') : t('settings.version')}
                value={newerRelease ? `v${newerRelease.version}` : Env.VERSION}
                loading={checking}
                onPress={() => runCheck(true)}
              />
            </ItemsContainer>

            <View className="h-8" />
          </View>
        </ScrollView>
      </SafeAreaView>

      <UpdateDialog
        release={pendingRelease}
        currentVersion={Env.VERSION}
        onClose={dismissUpdateDialog}
        onDownload={openReleaseDownload}
      />
    </>
  );
}
