require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "Codepad"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/SectionTN/react-native-codepad.git", :tag => "#{s.version}" }

  s.source_files = [
    "ios/**/*.{swift}",
    "ios/**/*.{m,mm}",
    "cpp/**/*.{hpp,cpp}",
    "cpp/tree-sitter/lib/src/lib.c",
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
