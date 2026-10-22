const { View } = require('react-native');

// Chainable no-op gesture builder: every config/callback method returns the
// same object, so composition (Exclusive/Simultaneous) also works.
const makeGesture = () => {
  const g: Record<string, unknown> = {};
  const methods = [
    'minDistance',
    'maxDistance',
    'maxDuration',
    'maxDelay',
    'numberOfTaps',
    'minPointers',
    'minDuration',
    'onBegin',
    'onStart',
    'onUpdate',
    'onEnd',
    'onFinalize',
  ];
  for (const m of methods) g[m] = () => g;
  return g;
};

const Gesture = {
  Pan: makeGesture,
  Tap: makeGesture,
  LongPress: makeGesture,
  Exclusive: makeGesture,
  Simultaneous: makeGesture,
};

// Render-through: gestures are no-ops in tests.
const GestureDetector = ({ children }: { children: React.ReactNode }) => children;

module.exports = {
  Gesture,
  GestureDetector,
  GestureHandlerRootView: View,
};
