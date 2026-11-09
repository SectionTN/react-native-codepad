require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "CodepadLangKvLite"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"] || "https://reactnativecodepad.pages.dev/guides/custom-languages/"
  s.license      = package["license"]
  s.authors      = package["author"] || "unknown"
  s.platforms    = { :ios => "17.0" }
  s.source       = { :git => "" }

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
