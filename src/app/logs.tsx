import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { FocusAwareStatusBar, SafeAreaView, Text } from '@/components/ui';
import { useTranslate } from '@/lib/i18n';
import { clearErrorLog, readErrorLog } from '@/lib/logs/error-log';

/**
 * Viewer for the plain-text error log (one line per classified network
 * failure). The content is a single selectable <Text> — long-press and use
 * the system copy menu to copy any range; Share sends the whole file.
 */
export default function Logs(): React.ReactElement {
  const t = useTranslate();
  // null = not loaded yet, '' = empty log.
  const [log, setLog] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void readErrorLog().then(setLog);
    }, [])
  );

  const clear = async () => {
    await clearErrorLog();
    setLog('');
    showMessage({ message: t('logs.cleared'), type: 'success', position: 'top', duration: 1500 });
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <Stack.Screen options={{ title: t('logs.title') }} />
      <FocusAwareStatusBar />
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {t('logs.title')}
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => void Share.share({ title: t('logs.title'), message: log ?? '' })}
            disabled={!log}
            className={`rounded-full px-3 py-1.5 ${log ? 'bg-neutral-100 dark:bg-neutral-800' : 'bg-neutral-100/50 dark:bg-neutral-800/50'}`}
          >
            <Text className="text-xs text-neutral-600 dark:text-neutral-300">
              {t('logs.share')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void clear()}
            disabled={!log}
            className="rounded-full bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800"
          >
            <Text className="text-xs text-red-500 dark:text-red-400">{t('logs.clear')}</Text>
          </Pressable>
        </View>
      </View>

      <Text
        className="px-4 pb-2 text-xs leading-4 text-neutral-500 dark:text-neutral-400"
        tx="logs.copy_hint"
      />

      {log === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3b82f6" />
        </View>
      ) : log === '' ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-neutral-500 dark:text-neutral-400" tx="logs.empty" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <Text
            selectable
            className="px-4 text-xs leading-5 text-neutral-900 dark:text-neutral-100"
          >
            {log}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
