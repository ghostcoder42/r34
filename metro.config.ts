/* eslint-env node */
// CommonJS form: `eas build --local` loads this via Node, and Node ESM can't
// resolve the bare specifiers (expo/metro-config, nativewind/metro). Using
// require/module.exports makes Node parse it as CJS, where require resolves.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Exclude test files from expo-router file-based routing
config.resolver.blockList = [/.*\.test\.tsx?$/, /.*\.spec\.tsx?$/, /__tests__\/.*/];

module.exports = withNativeWind(config, { input: './global.css' });
