/**
 * FlashList 2.x omits `estimatedItemSize` from its TypeScript props even though
 * the prop is supported at runtime. Augment the interface once here so we can
 * use it everywhere without per-call-site `@ts-ignore` comments.
 */
declare module '@shopify/flash-list' {
  interface FlashListProps<TItem> {
    estimatedItemSize?: number;
  }
}

export {};
