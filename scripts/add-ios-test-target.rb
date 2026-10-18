#!/usr/bin/env ruby
# Adds the CodepadTests unit test bundle to the example project, hosted by the app, and syncs its sources
# with example/ios/CodepadTests. Re-run after adding a suite, then pod install.
# Usage: cd example && bundle exec ruby ../scripts/add-ios-test-target.rb
require "xcodeproj"

ios = File.expand_path("../example/ios", __dir__)
project = Xcodeproj::Project.open(File.join(ios, "CodepadExample.xcodeproj"))
app = project.targets.find { |t| t.name == "CodepadExample" } or abort("no CodepadExample target")
tests = project.targets.find { |t| t.name == "CodepadTests" }
unless tests
  tests = project.new_target(:unit_test_bundle, "CodepadTests", :ios, "17.0", nil, :swift)
  tests.add_dependency(app)
end

# The Swift version matches the app: CocoaPods refuses to share pods without a swift_version across two modes.
tests.build_configurations.each do |config|
  config.build_settings.merge!(
    "BUNDLE_LOADER" => "$(TEST_HOST)",
    "CODE_SIGN_STYLE" => "Automatic",
    "CURRENT_PROJECT_VERSION" => "1",
    "GENERATE_INFOPLIST_FILE" => "YES",
    "HEADER_SEARCH_PATHS" => "$(inherited) \"${PODS_ROOT}/Headers/Private/NitroModules\"",
    "IPHONEOS_DEPLOYMENT_TARGET" => "17.0",
    "MARKETING_VERSION" => "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER" => "me.sectiontn.codepad.example.tests",
    "PRODUCT_NAME" => "$(TARGET_NAME)",
    "SWIFT_OBJC_INTEROP_MODE" => "objcxx",
    "SWIFT_VERSION" => "5.0",
    "TARGETED_DEVICE_FAMILY" => "1,2",
    "TEST_HOST" => "$(BUILT_PRODUCTS_DIR)/CodepadExample.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/CodepadExample",
  )
end

group = project.main_group["CodepadTests"] || project.main_group.new_group("CodepadTests", "CodepadTests")
known = group.files.map { |f| f.real_path.to_s }
added = Dir[File.join(ios, "CodepadTests", "*.swift")].sort.reject { |path| known.include?(path) }
tests.add_file_references(added.map { |path| group.new_file(path) })
project.save

scheme_path = (Xcodeproj::XCScheme.shared_data_dir(project.path) + "CodepadExample.xcscheme").to_s
scheme = Xcodeproj::XCScheme.new(scheme_path)
scheme.test_action.testables = [Xcodeproj::XCScheme::TestAction::TestableReference.new(tests)]
scheme.save!
puts "CodepadTests: #{added.size} file(s) added, #{group.files.size} in the target"
