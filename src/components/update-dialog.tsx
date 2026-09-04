import type * as React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { useTranslate } from '@/lib/i18n';
import type { ReleaseInfo } from '@/lib/updater';

type UpdateDialogProps = {
  /** Release to present; null keeps the dialog closed. */
  release: ReleaseInfo | null;
  currentVersion: string;
  onClose: () => void;
  onDownload: (release: ReleaseInfo) => void;
};

/**
 * In-app "new version" card. The system Alert can't cap its height and
 * GitHub release notes grow without bound, so this dialog clamps to 80% of
 * the screen with the body scrolling inside. The card itself is a Pressable
 * without onPress (tap sink) — only the backdrop dismisses, while scrolls
 * and buttons inside keep working.
 */
export function UpdateDialog({
  release,
  currentVersion,
  onClose,
  onDownload,
}: UpdateDialogProps): React.ReactElement | null {
  const t = useTranslate();
  if (!release) return null;

  // np names releases after the tag; only show the title when it says
  // something the version number doesn't.
  const showName =
    !!release.title && release.title !== `v${release.version}` && release.title !== release.version;

  const meta: string[] = [];
  if (release.publishedAt) {
    // ISO string slice — no Intl/Date formatting needed (Hermes-safe).
    meta.push(`${t('settings.release_date')} ${release.publishedAt.slice(0, 10)}`);
  }
  if (release.apkSize) {
    meta.push(`APK ≈ ${(release.apkSize / 1024 / 1024).toFixed(1)} MB`);
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 items-center justify-center bg-black/60 px-6"
        onPress={onClose}
        testID="update-dialog-backdrop"
      >
        <Pressable
          className="w-full max-w-md rounded-2xl bg-white p-5 dark:bg-neutral-900"
          style={{ maxHeight: '80%' }}
        >
          <Text className="text-lg font-semibold text-neutral-900 dark:text-white">
            {t('settings.update_available_title', { version: release.version })}
          </Text>
          <ScrollView className="mt-2" showsVerticalScrollIndicator={false}>
            <Text className="text-sm leading-5 text-neutral-800 dark:text-neutral-200">
              {t('settings.update_available_msg', {
                version: release.version,
                current: currentVersion,
              })}
            </Text>
            {meta.length > 0 ? (
              <Text className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                {meta.join(' · ')}
              </Text>
            ) : null}
            {showName ? (
              <Text className="mt-3 text-sm font-medium text-neutral-900 dark:text-white">
                {release.title}
              </Text>
            ) : null}
            {release.notes ? (
              <Text className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                {t('settings.release_notes')}
                {'\n'}
                {release.notes}
              </Text>
            ) : null}
          </ScrollView>
          <View className="mt-4 flex-row justify-end gap-2">
            <Pressable
              onPress={onClose}
              className="rounded-full bg-neutral-200 px-4 py-2 dark:bg-neutral-700"
              accessibilityRole="button"
              testID="update-dialog-cancel"
            >
              <Text className="text-neutral-900 dark:text-white">{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onDownload(release)}
              className="rounded-full bg-primary-500 px-4 py-2"
              accessibilityRole="button"
              testID="update-dialog-download"
            >
              <Text className="font-semibold text-white">{t('settings.update_now')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
