const path = require('node:path');
const { getConfig } = require('react-native-builder-bob/babel-config');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');

// babel-preset-expo wraps the React Native preset, adds the worklets plugin and inlines EXPO_OS for @expo/ui.
module.exports = getConfig(
  {
    presets: ['babel-preset-expo'],
  },
  { root, pkg },
);
