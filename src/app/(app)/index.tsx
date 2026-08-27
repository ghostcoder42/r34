import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';

import { useVideos } from '@/api/video-queries';
import { SafeAreaView, Text } from '@/components/ui';
import { VideoTile } from '@/components/video-tile';
import { flattenUniquePages } from '@/lib/flatten-pages';
import { useColumns } from '@/lib/hooks/use-columns';
import type { VideoListItem } from '@/lib/r34/types';

export default function Home(): React.ReactElement {
  const params = useLocalSearchParams<{ search?: string }>();
  const numColumns = useColumns();

  const {
    data,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useVideos({
    variables: {
      search: params.search,
    },
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
        <Text className="text-lg text-neutral-900 dark:text-neutral-100">Error loading videos</Text>
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
      <FlashList
        key={numColumns}
        data={videos}
        numColumns={numColumns}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
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
