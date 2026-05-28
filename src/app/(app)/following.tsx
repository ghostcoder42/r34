import { FlashList } from '@shopify/flash-list';
import { Link } from 'expo-router';
import type * as React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { FocusAwareStatusBar, SafeAreaView } from '@/components/ui';
import { useFollowingStore } from '@/lib/stores/following-store';

export default function FollowingScreen(): React.ReactElement {
  const { following, unfollow } = useFollowingStore();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <FocusAwareStatusBar />
      {following.length === 0 ? (
        <View className="flex-1 items-center justify-center py-20">
          <Text className="text-neutral-500 dark:text-neutral-400">Not following anyone</Text>
        </View>
      ) : (
        <FlashList
          data={following}
          renderItem={({ item }) => (
            <Link
              href={{ pathname: '/author/[id]', params: { id: item.slug, name: item.name } }}
              asChild
            >
              <TouchableOpacity className="flex-row items-center justify-between px-4 py-3">
                <View className="flex-row items-center">
                  <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
                    <Text className="text-xs font-bold">{item.name[0]}</Text>
                  </View>
                  <Text className="text-neutral-900 dark:text-neutral-100 font-medium">
                    {item.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    unfollow(item.slug);
                  }}
                  className="rounded-full bg-neutral-200 px-3 py-1 dark:bg-neutral-700"
                >
                  <Text className="text-xs">Unfollow</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </Link>
          )}
          keyExtractor={(item) => item.slug}
          estimatedItemSize={56}
        />
      )}
    </SafeAreaView>
  );
}
