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
  # tag 必须跟 release workflow 实际打的 `v<version>` 一致 —— 少了 v 前缀,
  # `pod spec lint` / 从 git 装包都会解析不到 tag。
  s.source       = { :git => "https://github.com/unif-design/react-native-umeng.git", :tag => "v#{s.version}" }

  # 宿主 App 的 Swift AppDelegate 要 `import ReactNativeUmeng`,module 名必须固定,
  # 且 DEFINES_MODULE 必须开 —— 否则 CocoaPods 在 static library 集成下不生成
  # module map,Swift 侧只能靠 bridging header。
  s.module_name  = "ReactNativeUmeng"
  # 放在 install_modules_dependencies 之前:它读现有 hash 再合并,不会覆盖这里的 key。
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  # 只公开 UmengBootstrap.h —— 宿主 App 的 AppDelegate 要 import 它转发 openURL /
  # Universal Link 并触发授权后初始化。其余 header 要么引了 codegen spec,要么是
  # 内部 adapter / 测试注入入口,一律 private,不进 public umbrella。
  s.public_header_files = "ios/UmengBootstrap.h"
  s.private_header_files = [
    "ios/UmengAnalytics.h",
    "ios/UmengCommon.h",
    "ios/UmengShare.h",
    "ios/UmengSDKAdapters.h",
    "ios/UmengBootstrap+Testing.h",
  ]

  # 友盟基础 + 分享 (全 ObjC++ 实现,直接 #import <UMShare/UMShare.h>)
  s.dependency "UMCommon", "~> 7.5.10"
  s.dependency "UMDevice", "~> 3.6.0"
  s.dependency "UMShare/Core", "~> 6.11.1"
  s.dependency "UMShare/Social/WeChat", "~> 6.11.1"
  s.dependency "UMShare/Social/DingDing", "~> 6.11.1"

  install_modules_dependencies(s)
end
