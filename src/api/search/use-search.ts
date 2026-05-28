import { useInfiniteQuery } from '@tanstack/react-query';

import { r34Client } from '../common/r34';

export function useSearch(query: string) {
  return useInfiniteQuery({
    queryKey: ['search', query],
    queryFn: ({ pageParam }) => r34Client.search({ query, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: query.length > 0,
  });
}

export function useTagVideos(tag: string) {
  return useInfiniteQuery({
    queryKey: ['tagVideos', tag],
    queryFn: ({ pageParam }) => r34Client.getByTag({ tag, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: tag.length > 0,
  });
}
