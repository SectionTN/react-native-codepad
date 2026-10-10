#!/usr/bin/env bash
# Compiles the Codepad pod on its own, the quickest check that the Swift builds under CocoaPods.
set -euo pipefail
cd "$(dirname "$0")/.."
xcodebuild -project example/ios/Pods/Pods.xcodeproj -target Codepad -sdk iphonesimulator -configuration Debug -arch arm64 -quiet build
