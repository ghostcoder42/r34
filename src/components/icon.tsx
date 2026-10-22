import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IconProps = ComponentProps<typeof Ionicons>;

/** Thin Ionicons wrapper so icon usage stays swappable. */
export function Icon(props: IconProps) {
  return <Ionicons {...props} />;
}
