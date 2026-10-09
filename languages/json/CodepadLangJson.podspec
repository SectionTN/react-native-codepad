require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "CodepadLangJson"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/SectionTN/react-native-codepad.git", :tag => "v#{s.version}" }

  s.source_files = ["ios/*.{h,swift}", "grammar/src/parser.c"]
  s.public_header_files = "ios/*.h"
  s.preserve_paths = "grammar/**/*"
  s.compiler_flags = "-w"
  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => "\"$(PODS_TARGET_SRCROOT)/grammar/src\"",
    "GCC_OPTIMIZATION_LEVEL" => "1",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "SWIFT_OBJC_INTEROP_MODE" => "objcxx",
    "DEFINES_MODULE" => "YES",
  }

  s.dependency "Codepad"
end
