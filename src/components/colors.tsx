import type React from 'react';

import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';

type ColorName = keyof typeof colors;

export function Colors(): React.ReactElement {
  return (
    <>
      {(Object.keys(colors) as ColorName[]).map((name) => (
        <Color name={name} key={name} />
      ))}
    </>
  );
}

function Color({ name }: { name: ColorName }): React.ReactElement | null {
  if (typeof colors[name] === 'string') return null;
  return (
    <View className="pt-2">
      <Text className="font-medium">{name.toUpperCase()}</Text>
      <View className="flex-row flex-wrap content-between justify-around">
        {Object.entries(colors[name]).map(([key, value]) => (
          <ColorCard key={`${name}-${key}`} value={key} color={value} />
        ))}
      </View>
    </View>
  );
}

function ColorCard({ color, value }: { value: string; color: string }): React.ReactElement {
  return (
    <View className="flex-1">
      <View className="h-14 w-full rounded-sm" style={{ backgroundColor: color }} />
      <Text className="text-sm">{value}</Text>
    </View>
  );
}
