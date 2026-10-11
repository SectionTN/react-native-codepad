require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "Codepad"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "17.0" }
  s.swift_version = "6.0"
  s.source       = { :git => "https://github.com/SectionTN/react-native-codepad.git", :tag => "#{s.version}" }

  s.source_files = [
    "ios/**/*.{swift}",
    "ios/**/*.{h,m,mm}",
    "cpp/**/*.{hpp,cpp}",
    "cpp/tree-sitter/lib/include/tree_sitter/api.h",
  ]
  # The runtime compiles at -O2 whatever the app's configuration, as the Android CMake build does: at the
  # Debug -O0 the query cursor walk behind every keystroke runs four times slower.
  s.subspec "TreeSitter" do |ss|
    ss.source_files = "cpp/tree-sitter/lib/src/lib.c"
    ss.compiler_flags = "-O2"
  end
  # The pod's Swift reads the tree-sitter API through CPTreeSitter.h in the umbrella header; api.h ships
  # beside it because the public headers directory is flat.
  s.public_header_files = [
    "ios/Codepad/syntax/CPTreeSitter.h",
    "cpp/tree-sitter/lib/include/tree_sitter/api.h",
  ]
  s.preserve_paths = ["cpp/tree-sitter/lib/**/*"]
  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => "\"$(PODS_TARGET_SRCROOT)/cpp/tree-sitter/lib/include\" \"$(PODS_TARGET_SRCROOT)/cpp/tree-sitter/lib/src\"",
    "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) TREE_SITTER_HIDE_SYMBOLS=1",
  }

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'

  load 'nitrogen/generated/ios/Codepad+autolinking.rb'
  add_nitrogen_files(s)

  install_modules_dependencies(s)
end
