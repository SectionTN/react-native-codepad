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
| iOS | 17.0 at runtime, Xcode 16 or newer (the pod compiles in Swift 6 language mode) |

The component is a Nitro View, which needs Fabric. The legacy renderer is not supported and there is no plan to support it.

:::caution[Not on npm yet]
The packages below publish with `0.1.0`, after a hardening pass over both platforms. Until then, clone the [repository](https://github.com/SectionTN/react-native-codepad) and run the example app; the [contributing](/react-native-codepad/internals/contributing/) page has the loop.
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

Every language package is `react-native-codepad-lang-<id>` and pins the core version it was generated with. The [language packages](/react-native-codepad/reference/languages/) page lists all fifteen and the [languages guide](/react-native-codepad/guides/languages/) explains injections and aliases. Install only what you need: each package carries its grammar's parser, a native library per ABI on Android and a pod compiled from the same C on iOS, from under 100 KB for json to a few megabytes for kotlin and swift.

## Android

Autolinking picks up the core and every language package. Nothing to add to Gradle and no ProGuard rule to write: each package ships its own consumer rule for the class the registry loads by reflection. The first build after adding a package compiles its parser from C, about a minute for all fifteen on a recent laptop.

Rebuild the app after adding or removing a language package. Metro cannot load native code.

## Expo

Works in a development build and through `npx expo prebuild`. No config plugin is needed for the library: autolinking does the whole job. The one setting is the iOS deployment target, 17.0 through `expo-build-properties` (`ios.deploymentTarget`). Expo Go cannot load the library, like any package with native code.

## iOS

Autolinking adds the `Codepad` pod and one pod per language package; run `pod install` in `ios/` after adding or removing a package and rebuild. Each language pod compiles its parser from C, which the first build pays once. Nothing else to configure: no bridging header, no build setting.

The library requires iOS 17.0, because its selection UI is built on `UITextSelectionDisplayInteraction`, so the app's deployment target has to be 17.0 or higher: `platform :ios, '17.0'` in the Podfile in place of React Native's `min_ios_version_supported`, and the same target in the Xcode project. CocoaPods refuses the install otherwise and names the target that is too low.

Next: the [quick start](/react-native-codepad/start/quick-start/).
