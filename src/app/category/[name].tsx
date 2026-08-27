import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';

import { useVideos } from '@/api/video-queries';
import { FocusAwareStatusBar, SafeAreaView, Text } from '@/components/ui';
import { VideoTile } from '@/components/video-tile';
import { flattenUniquePages } from '@/lib/flatten-pages';
import { useColumns } from '@/lib/hooks/use-columns';
import type { VideoListItem } from '@/lib/r34/types';

export default function CategoryPage(): React.ReactElement {
  const { name } = useLocalSearchParams<{ name: string }>();
  const numColumns = useColumns();

  const { data, isPending, isError, refetch, isRefetching } = useVideos({
    variables: { category: name },
  });

  const videos = React.useMemo(() => {
    return flattenUniquePages(data?.pages, (item) => item.id);
  }, [data]);

  const renderItem = React.useCallback(
    ({ item }: { item: VideoListItem }) => <VideoTile item={item} />,
    []
  );

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <Stack.Screen options={{ title: 'Error' }} />
        <FocusAwareStatusBar />
        <Text className="text-lg text-neutral-900 dark:text-white">Error loading category</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="mt-4 rounded-lg bg-primary-500 px-4 py-2"
        >
          <Text className="font-semibold text-white">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <Stack.Screen options={{ title: name ?? 'Category', headerShown: true }} />
      <FocusAwareStatusBar />

      {isPending && videos.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlashList
          key={numColumns}
          data={videos}
          numColumns={numColumns}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-24">
              <Text className="text-neutral-500 dark:text-neutral-400">
                No videos in this category
              </Text>
            </View>
          }
          onEndReachedThreshold={0.5}
        />
      )}
    </SafeAreaView>
  );
}
