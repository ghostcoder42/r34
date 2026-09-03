import * as React from 'react';

import { showFetchErrorToast } from '@/lib/r34/fetch-error';

/**
 * Toasts a classified fetch error while the screen keeps its already-loaded
 * content. `enabled` should reflect "content is on screen" — when there is
 * nothing to keep, the screen renders its full error state instead and the
 * toast would be noise. Call before any early returns (it's a hook).
 */
export function useFetchErrorToast(isError: boolean, error: unknown, enabled: boolean): void {
  React.useEffect(() => {
    if (isError && enabled) {
      showFetchErrorToast(error);
    }
  }, [isError, error, enabled]);
}
