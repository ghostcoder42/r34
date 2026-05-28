import type { GetNextPageParamFunction, GetPreviousPageParamFunction } from '@tanstack/react-query';

export const DEFAULT_LIMIT = 10;

export function getQueryKey<T extends Record<string, unknown>>(key: string, params?: T) {
  return [key, ...(params ? [params] : [])];
}

export const getPreviousPageParam: GetNextPageParamFunction<
  unknown,
  { previous: string | null }
> = (page) => (page.previous ? new URL(page.previous).searchParams.get('offset') : null);

export const getNextPageParam: GetPreviousPageParamFunction<unknown, { next: string | null }> = (
  page
) => (page.next ? new URL(page.next).searchParams.get('offset') : null);
