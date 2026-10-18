const path = require('node:path');
const { getDefaultConfig } = require('@expo/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');

const root = path.resolve(__dirname, '..');

// Expo's Metro defaults plus the workspace wiring, so the example resolves the library's source.
module.exports = withMetroConfig(getDefaultConfig(__dirname), {
  root,
  dirname: __dirname,
  conditions: ['react-native-codepad-source'],
});
