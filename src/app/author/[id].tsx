import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';

import { useMemberVideos } from '@/api/video-queries';
import { FocusAwareStatusBar, SafeAreaView, Text } from '@/components/ui';
import { VideoTile } from '@/components/video-tile';
import { flattenUniquePages } from '@/lib/flatten-pages';
import { useColumns } from '@/lib/hooks/use-columns';
import type { VideoListItem } from '@/lib/r34/types';
import { useFollowingStore } from '@/lib/stores/following-store';

export default function AuthorPage(): React.ReactElement {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { isFollowing, follow, unfollow } = useFollowingStore();
  const followed = isFollowing(id);
  const numColumns = useColumns();

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMemberVideos({ variables: { memberId: id } });

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
    <SafeAreaView className="bg-white dark:bg-neutral-900 flex-1">
      <Stack.Screen
        options={{
          title: name ?? id,
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                if (followed) {
                  unfollow(id);
                } else {
                  follow(name ?? id, id);
                }
              }}
              className="mr-2 rounded-full px-3 py-1"
              style={{ backgroundColor: followed ? '#6366f1' : '#e5e5e5' }}
            >
              <Text className="text-xs font-medium" style={{ color: followed ? 'white' : '#333' }}>
                {followed ? '✓ Following' : '+ Follow'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
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
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-24">
              <Text className="text-neutral-500 dark:text-neutral-400">No videos</Text>
            </View>
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
        />
      )}
    </SafeAreaView>
  );
}
