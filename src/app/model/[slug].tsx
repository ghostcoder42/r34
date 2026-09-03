import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';

import { useModelVideos } from '@/api/video-queries';
import { FocusAwareStatusBar, SafeAreaView, Text } from '@/components/ui';
import { VideoTile } from '@/components/video-tile';
import { flattenUniquePages } from '@/lib/flatten-pages';
import { useColumns } from '@/lib/hooks/use-columns';
import { useFetchErrorToast } from '@/lib/hooks/use-fetch-error-toast';
import type { VideoListItem } from '@/lib/r34/types';

export default function ModelPage(): React.ReactElement {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const numColumns = useColumns();

  const {
    data,
    isPending,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useModelVideos({
    variables: { modelSlug: slug },
  });

  const videos = React.useMemo(() => {
    return flattenUniquePages(data?.pages, (item) => item.id);
  }, [data]);

  // Keep loaded videos on fetch errors; toast says what went wrong.
  useFetchErrorToast(isError, error, videos.length > 0);

  const renderItem = React.useCallback(
    ({ item }: { item: VideoListItem }) => <VideoTile item={item} />,
    []
  );

  const ListHeaderComponent = React.useCallback(
    () => (
      <View className="border-b border-neutral-200 bg-white px-4 py-6 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
          {slug?.replace(/-/g, ' ') || 'Model'}
        </Text>
        <Text className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {videos.length} videos
        </Text>
      </View>
    ),
    [slug, videos.length]
  );

  if (isError && videos.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <Stack.Screen options={{ title: 'Error' }} />
        <FocusAwareStatusBar />
        <Text className="text-lg text-neutral-900 dark:text-white">Error loading videos</Text>
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
      <Stack.Screen options={{ title: slug?.replace(/-/g, ' ') || 'Model' }} />
      <FocusAwareStatusBar />
      <FlashList
        key={numColumns}
        data={videos}
        numColumns={numColumns}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          isPending ? (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" />
            </View>
          ) : (
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-neutral-500 dark:text-neutral-400">No videos found</Text>
            </View>
          )
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshing={isRefetching}
        onRefresh={refetch}
      />
    </SafeAreaView>
  );
}
