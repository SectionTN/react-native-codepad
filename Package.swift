// swift-tools-version: 6.0
// The pure layers build and test on macOS here; the pod compiles the same files plus view and nitro.
import PackageDescription

let package = Package(
  name: "Codepad",
  platforms: [.iOS(.v17), .macOS(.v14)],
  targets: [
    .target(
      name: "Codepad",
      path: "ios/Codepad",
      exclude: ["nitro"]
    ),
    .testTarget(
      name: "CodepadTests",
      dependencies: ["Codepad"],
      path: "tests/swift"
    ),
  ],
  swiftLanguageModes: [.v6]
)
