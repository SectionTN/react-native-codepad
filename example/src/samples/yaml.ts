export const yaml = `# CI matrix for the example app.
name: build
on:
  push:
    branches: [main]
  pull_request:

env:
  NODE_VERSION: "24"
  GRADLE_OPTS: -Dorg.gradle.jvmargs=-Xmx4g

jobs:
  android:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    strategy:
      matrix:
        abi: [arm64-v8a, x86_64]
        api: [24, 36]
    steps:
      - uses: actions/checkout@v5
      - name: Build
        run: |
          yarn install --immutable
          yarn example build:android
      - name: Upload
        if: \${{ matrix.abi == 'arm64-v8a' && success() }}
        uses: actions/upload-artifact@v4
`;
