/**
 * Auto-mock for @expo/vector-icons (root __mocks__ applies to node_modules
 * packages without jest.mock). The real icon sets load font assets through
 * expo-asset's registry, which doesn't exist under jest — render every set
 * as a plain <Icon> host element instead.
 */
import React from 'react';

const MockIcon = (props: Record<string, unknown>) =>
  React.createElement('Icon' as string, props);

module.exports = new Proxy(
  {},
  {
    get: (_target: Record<string, unknown>, prop: string | symbol) => {
      if (prop === 'createIconSet') return () => MockIcon;
      if (prop === '__esModule') return false;
      return MockIcon;
    },
  }
);
