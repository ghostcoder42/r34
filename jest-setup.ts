import '@testing-library/react-native/matchers';

// react-hook form setup for testing
global.window = { ...global, name: 'window' } as unknown as typeof global.window;

// Mock react-native-capture-protection (native module not available in jsdom)
jest.mock('react-native-capture-protection', () =>
  require('react-native-capture-protection/jest/capture-protection-mock')
);
