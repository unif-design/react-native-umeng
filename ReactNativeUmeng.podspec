require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ReactNativeUmeng"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/unif-design/react-native-umeng.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.private_header_files = "ios/**/*.h"

  # 友盟基础 + 分享
  s.dependency "UMCommon", "~> 7.5.10"
  s.dependency "UMDevice", "~> 3.6.0"
  s.dependency "UMShare/Core", "~> 6.11.1"
  s.dependency "UMShare/Social/WeChat", "~> 6.11.1"
  s.dependency "UMShare/Social/DingDing", "~> 6.11.1"

  install_modules_dependencies(s)
end
