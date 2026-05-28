import * as React from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Pure column-count calc, exported for unit testing.
 */
export function computeColumns(width: number, minTileWidth = 220, max = 6): number {
  return Math.max(1, Math.min(max, Math.floor(width / minTileWidth)));
}

/**
 * Responsive column count for a FlashList grid, based on the available window
 * width and a minimum desired tile width. Recomputes on rotation/resize.
 */
export function useColumns(minTileWidth = 220, max = 6): number {
  const { width } = useWindowDimensions();
  return React.useMemo(() => computeColumns(width, minTileWidth, max), [width, minTileWidth, max]);
}
