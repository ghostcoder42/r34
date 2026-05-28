import React from 'react';

import type { OptionType } from '@/components/ui';
import { Options, Pressable, Text, View, useModal } from '@/components/ui';
import { useAppIcon } from '@/lib/hooks/use-app-icon';
import { isAppIconSupported, setAppIcon } from '../../../modules/app-icon';

export const AppIconItem = () => {
  const { selected, setStored, switching, options } = useAppIcon();
  const modal = useModal();
  const supported = isAppIconSupported();

  const onSelect = React.useCallback(
    async (option: OptionType) => {
      modal.dismiss();
      const ok = await setAppIcon(option.value as string);
      if (ok) setStored(option.value as string);
    },
    [modal, setStored]
  );

  const opts: OptionType[] = React.useMemo(
    () => options.map((o) => ({ label: o.label, value: o.name })),
    [options]
  );
  const current = options.find((o) => o.name === selected);

  return (
    <>
      <Pressable
        onPress={supported ? modal.present : undefined}
        pointerEvents={supported ? 'auto' : 'none'}
        className="flex-1 flex-row items-center justify-between px-4 py-2"
      >
        <Text>App Icon</Text>
        <View className="flex-row items-center">
          <Text className="text-neutral-500 dark:text-neutral-400">
            {!supported ? 'Unavailable' : switching ? 'Switching…' : current?.label}
          </Text>
        </View>
      </Pressable>
      <Options ref={modal.ref} options={opts} onSelect={onSelect} value={selected} />
    </>
  );
};
