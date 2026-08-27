import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';

import { useTagVideos } from '@/api/search';
import { FocusAwareStatusBar, SafeAreaView, Text } from '@/components/ui';
import { VideoTile } from '@/components/video-tile';
import { flattenUniquePages } from '@/lib/flatten-pages';
import { useColumns } from '@/lib/hooks/use-columns';
import type { Post } from '@/lib/r34/extractor';
import { useTagStore } from '@/lib/stores/tag-store';

export default function TagPage(): React.ReactElement {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { isFavorite, addTag, removeTag } = useTagStore();
  const favorited = isFavorite(name ?? id);
  const numColumns = useColumns();

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTagVideos(id);

  const posts = React.useMemo(() => {
    return flattenUniquePages(data?.pages, (item) => item.id);
  }, [data]);

  const renderItem = React.useCallback(({ item }: { item: Post }) => <VideoTile item={item} />, []);

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <Stack.Screen options={{ title: 'Error' }} />
        <FocusAwareStatusBar />
        <Text className="text-lg text-neutral-900 dark:text-white">Error loading tag</Text>
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
          title: name ? `#${name}` : '#tag',
          headerShown: true,
          headerRight: () => (
            <View className="mr-2 flex-row items-center">
              <TouchableOpacity
                onPress={() => {
                  if (favorited) {
                    removeTag(name ?? id);
                  } else {
                    addTag(name ?? id);
                  }
                }}
              >
                <Text className="text-lg">{favorited ? '⭐' : '☆'}</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <FocusAwareStatusBar />

      {isPending && posts.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlashList
          key={numColumns}
          data={posts}
          numColumns={numColumns}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-24">
              <Text className="text-neutral-500 dark:text-neutral-400">No videos for this tag</Text>
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
