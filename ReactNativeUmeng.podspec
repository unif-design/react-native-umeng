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
  # 只公开 UmengBootstrap.h —— 宿主 App 的 AppDelegate 要 import 它转发 openURL /
  # 调初始化(纯 ObjC,Swift 自动 bridge,无需 bridging header)。其余 TurboModule
  # 实现 header 引了 codegen spec,保持 private 不外泄。
  s.public_header_files = "ios/UmengBootstrap.h"
  s.private_header_files = "ios/Umeng{Analytics,Common,Share}.h"

  # 友盟基础 + 分享 (全 ObjC++ 实现,直接 #import <UMShare/UMShare.h> 无需
  # modular_headers / DEFINES_MODULE 等 hack)
  s.dependency "UMCommon", "~> 7.5.10"
  s.dependency "UMDevice", "~> 3.6.0"
  s.dependency "UMShare/Core", "~> 6.11.1"
  s.dependency "UMShare/Social/WeChat", "~> 6.11.1"
  s.dependency "UMShare/Social/DingDing", "~> 6.11.1"

  install_modules_dependencies(s)
end
