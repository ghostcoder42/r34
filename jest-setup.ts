import '@testing-library/react-native/extend-expect';

// react-hook form setup for testing
// @ts-ignore
global.window = {};
// @ts-ignore
global.window = global;

// Mock react-native-capture-protection (native module not available in jsdom)
jest.mock('react-native-capture-protection', () =>
  require('react-native-capture-protection/jest/capture-protection-mock')
);
