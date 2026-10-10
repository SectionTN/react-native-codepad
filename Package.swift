// swift-tools-version: 6.0
// The pure layers build and test on macOS here; the pod compiles the same files plus view and nitro.
import Foundation
import PackageDescription

/// Every generated grammar's parser.c with the scanner.c beside it, the rule scripts/build-host-treesitter.sh
/// uses. A scanner that includes a header outside its src gets that src as a search path, so the header's own
/// tree_sitter/parser.h include resolves to the grammar's copy.
func grammarSources() -> (sources: [String], searchPaths: [String]) {
  let fm = FileManager.default
  let languages = URL(fileURLWithPath: Context.packageDirectory).appendingPathComponent("languages")
  var sources: [String] = []
  var searchPaths: [String] = []
  func walk(_ dir: URL, _ relative: String) {
    guard let names = try? fm.contentsOfDirectory(atPath: dir.path) else { return }
    for name in names.sorted() where !name.hasPrefix(".") && name != "node_modules" {
      let child = dir.appendingPathComponent(name)
      let path = relative.isEmpty ? name : relative + "/" + name
      var isDirectory: ObjCBool = false
      guard fm.fileExists(atPath: child.path, isDirectory: &isDirectory) else { continue }
      if isDirectory.boolValue {
        walk(child, path)
      } else if name == "parser.c" && dir.lastPathComponent == "src" && path.contains("/grammar/") {
        sources.append(path)
        let scanner = dir.appendingPathComponent("scanner.c")
        guard let text = try? String(contentsOf: scanner, encoding: .utf8) else { continue }
        sources.append(relative + "/scanner.c")
        if text.contains("#include \"../") { searchPaths.append(relative) }
      }
    }
  }
  walk(languages, "")
  return (sources, searchPaths)
}

let grammars = grammarSources()

let package = Package(
  name: "Codepad",
  platforms: [.iOS(.v17), .macOS(.v14)],
  targets: [
    .target(
      name: "CTreeSitter",
      path: "cpp/tree-sitter/lib",
      sources: ["src/lib.c"],
      publicHeadersPath: "include",
      cSettings: [.headerSearchPath("src")]
    ),
    .target(
      name: "CodepadHostGrammars",
      path: "languages",
      sources: grammars.sources,
      publicHeadersPath: "host/include",
      cSettings: grammars.searchPaths.map { .headerSearchPath($0) }
    ),
    .target(
      name: "Codepad",
      dependencies: ["CTreeSitter"],
      path: "ios/Codepad",
      exclude: ["nitro", "syntax/CPTreeSitter.h", "view"]
    ),
    .testTarget(
      name: "CodepadTests",
      dependencies: ["Codepad", "CodepadHostGrammars"],
      path: "tests/swift"
    ),
  ],
  swiftLanguageModes: [.v6]
)
