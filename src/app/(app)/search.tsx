import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';

import { useSearch } from '@/api/search';
import { FocusAwareStatusBar, SafeAreaView, Text } from '@/components/ui';
import { VideoTile } from '@/components/video-tile';
import { useTranslate } from '@/lib';
import { flattenUniquePages } from '@/lib/flatten-pages';
import { useColumns } from '@/lib/hooks/use-columns';
import { useSearchHistory } from '@/lib/hooks/use-search-history';
import type { Post } from '@/lib/r34/extractor';
import { useTagStore } from '@/lib/stores/tag-store';

const HOT_TAGS = [
  'blender',
  '3d',
  'animation',
  'source filmmaker',
  'unity',
  'overwatch',
  'genshin impact',
  'honkai star rail',
  'fortnite',
  'futa',
  'anal',
  'big breasts',
  'sole female',
];

export default function SearchScreen() {
  const t = useTranslate();
  // Deep links (site /search/{query}/ URLs, see src/app/search/[query].tsx)
  // arrive with the query pre-filled via the `q` param.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const initialQuery = q ?? '';
  const [query, setQuery] = React.useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = React.useState(initialQuery);

  // Re-seed when a new deep link arrives while this tab is already mounted.
  React.useEffect(() => {
    if (q) {
      setQuery(q);
      setSubmittedQuery(q);
    }
  }, [q]);

  const { getHistory, addHistory, removeHistory, clearHistory } = useSearchHistory();
  const { favoriteTags } = useTagStore();

  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSearch(submittedQuery);
  const numColumns = useColumns();

  const posts = React.useMemo(() => {
    return flattenUniquePages(data?.pages, (item) => item.id);
  }, [data]);

  const [history, setHistory] = React.useState<string[]>(getHistory());

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (trimmed) {
      addHistory(trimmed);
      setSubmittedQuery(trimmed);
      setHistory(getHistory());
    }
  };

  const handleTagPress = (tag: string) => {
    setQuery(tag);
    setSubmittedQuery(tag);
    addHistory(tag);
    setHistory(getHistory());
  };

  const handleRemoveHistory = (h: string) => {
    removeHistory(h);
    setHistory(getHistory());
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const renderItem = React.useCallback(({ item }: { item: Post }) => <VideoTile item={item} />, []);

  const showResults = submittedQuery.length > 0;

  return (
    <SafeAreaView className="bg-white dark:bg-neutral-900 flex-1">
      <FocusAwareStatusBar />
      <View className="border-neutral-200 dark:border-neutral-800 px-4 py-3">
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSubmit}
          placeholder={t('search.placeholder')}
          placeholderTextColor="#9ca3af"
          returnKeyType="search"
          className="rounded-lg bg-neutral-100 dark:bg-neutral-800 px-4 py-2.5 text-base text-neutral-900 dark:text-neutral-100"
          autoFocus
        />
      </View>

      {showResults ? (
        isPending && !posts.length ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" />
            <Text className="mt-2 text-neutral-500">{t('search.searching')}</Text>
          </View>
        ) : (
          <FlashList
            key={numColumns}
            data={posts}
            numColumns={numColumns}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View className="items-center justify-center py-20">
                <Text className="text-neutral-500">{t('search.no_results')}</Text>
              </View>
            }
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
          />
        )
      ) : (
        <ScrollView className="flex-1 px-4 pt-2">
          {history.length > 0 && (
            <View className="mb-6">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-neutral-900 dark:text-neutral-100 text-sm font-semibold uppercase tracking-wider">
                  {t('search.history')}
                </Text>
                <TouchableOpacity onPress={handleClearHistory}>
                  <Text className="text-primary-500 text-xs">{t('search.clear_history')}</Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {history.map((h) => (
                  <View
                    key={h}
                    className="flex-row items-center rounded-full bg-neutral-100 dark:bg-neutral-800"
                  >
                    <TouchableOpacity onPress={() => handleTagPress(h)} className="px-3 py-1.5">
                      <Text className="text-neutral-900 dark:text-neutral-100 text-sm">{h}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemoveHistory(h)} className="pr-2">
                      <Text className="text-neutral-400 text-xs">✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View className="mb-6">
            <Text className="text-neutral-900 dark:text-neutral-100 mb-2 text-sm font-semibold uppercase tracking-wider">
              {t('search.hot_tags')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {favoriteTags.map((tag) => (
                <TouchableOpacity
                  key={`fav-${tag}`}
                  onPress={() => handleTagPress(tag)}
                  className="rounded-full bg-primary-100 px-3 py-1.5 dark:bg-primary-900/30"
                >
                  <Text className="text-sm font-medium text-primary-700 dark:text-primary-300">
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
              {HOT_TAGS.filter((tag) => !favoriteTags.includes(tag)).map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => handleTagPress(tag)}
                  className="rounded-full bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800"
                >
                  <Text className="text-neutral-900 dark:text-neutral-100 text-sm">{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
