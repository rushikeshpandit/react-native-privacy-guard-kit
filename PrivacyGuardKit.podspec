require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name            = "PrivacyGuardKit"
  s.version         = package["version"]
  s.summary         = package["description"]
  s.homepage        = package["homepage"]
  s.license         = package["license"]
  s.authors         = package["author"]
  s.platforms       = { :ios => "13.0" }
  s.source          = { :git => package["repository"]["url"], :tag => "#{s.version}" }

  # Include Swift files — PrivacyGuardKit.swift defines the main
  # @objc(PrivacyGuardKit) class the linker needs for _OBJC_CLASS_$_PrivacyGuardKit
  s.source_files        = "ios/**/*.{swift,h,m,mm}"
  s.public_header_files = "ios/**/*.h"

  s.pod_target_xcconfig = {
    "DEFINES_MODULE"             => "YES",
    "SWIFT_VERSION"              => "5.0",
    "CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER" => "NO",
  }

  install_modules_dependencies(s)
end
