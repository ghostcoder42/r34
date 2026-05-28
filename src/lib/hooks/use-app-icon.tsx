import * as React from 'react';
import { useMMKVString } from 'react-native-mmkv';

import { APP_ICON_OPTIONS, setAppIcon } from '../../../modules/app-icon';
import { storage } from '../storage';

const APP_ICON_KEY = 'APP_ICON';

export function useAppIcon() {
  const [stored, setStored] = useMMKVString(APP_ICON_KEY, storage);
  const [switching, setSwitching] = React.useState(false);

  const selected = stored && APP_ICON_OPTIONS.some((o) => o.name === stored) ? stored : 'default';

  const changeIcon = React.useCallback(
    async (name: string) => {
      setSwitching(true);
      try {
        const ok = await setAppIcon(name);
        if (ok) setStored(name);
        return ok;
      } finally {
        setSwitching(false);
      }
    },
    [setStored]
  );

  return { selected, setStored, changeIcon, switching, options: APP_ICON_OPTIONS };
}
