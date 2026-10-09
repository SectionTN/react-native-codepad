---
title: Installation
description: Requirements, packages and the Expo story.
sidebar:
  order: 2
---

## Requirements

| Requirement | Minimum |
| --- | --- |
| React Native | 0.81, New Architecture only |
| React | 19 |
| react-native-nitro-modules | 0.37 |
| Android | API 24 at runtime, `compileSdk` 36 |
| iOS | Builds and links; the editor renders in a later release |

The component is a Nitro View, which needs Fabric. The legacy renderer is not supported and there is no plan to support it.

:::caution[Not on npm yet]
The packages below publish with `0.1.0`, which ships together with the iOS editor. Until then, clone the [repository](https://github.com/SectionTN/react-native-codepad) and run the example app; the [contributing](/react-native-codepad/internals/contributing/) page has the loop.
:::

## Packages

Install the core, Nitro Modules and one package per language you want highlighted:

```sh
yarn add react-native-codepad react-native-nitro-modules react-native-codepad-lang-javascript
```

Or with npm:

```sh
npm install react-native-codepad react-native-nitro-modules react-native-codepad-lang-javascript
```

Every language package is `react-native-codepad-lang-<id>` and pins the core version it was generated with. The [language packages](/react-native-codepad/reference/languages/) page lists all fifteen and the [languages guide](/react-native-codepad/guides/languages/) explains injections and aliases. Install only what you need: each package ships a native parser per ABI, from under 100 KB for json to a few megabytes for kotlin and swift.

## Android

Autolinking picks up the core and every language package. Nothing to add to Gradle and no ProGuard rule to write: each package ships its own consumer rule for the class the registry loads by reflection. The first build after adding a package compiles its parser from C, about a minute for all fifteen on a recent laptop.

Rebuild the app after adding or removing a language package. Metro cannot load native code.

## Expo

Works in a development build and through `npx expo prebuild`. No config plugin is needed: autolinking does the whole job. Expo Go cannot load the library, like any package with native code.

## iOS

The core and the language packages install as pods and the example app builds and launches on the simulator, but the view is a stub until the Swift editor lands: it renders nothing and ref methods operate on an empty document. Keep the editor behind a platform check if you ship a cross platform app today.

Next: the [quick start](/react-native-codepad/start/quick-start/).
