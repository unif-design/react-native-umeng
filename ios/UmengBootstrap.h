#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Umeng iOS 初始化共享单例(ObjC++ 版,继承自原 UmengBootstrap.swift)。
 *
 * 友盟 iOS 公开 SDK 没有 preInit。PIPL 解法:用户同意《隐私协议》前完全不调
 * 任何友盟 API。`ensureInit:` 由 `UmengCommon.init` 触发,读 Info.plist 配置,
 * 跑 UMConfigure initWithAppkey + setPlaform(拼写遵循友盟 SDK 原始错误,
 * 少一个 t)。
 *
 * 选 ObjC++ 而非 Swift 是因为:
 * 1. RN 官方推荐 turbo-module 用 ObjC++ (.mm),Swift 需要 bridging header 等
 *    一堆 hack,而 library framework 不支持 bridging header
 * 2. 友盟 UMShare 用旧式 .framework 不带 modulemap,Swift `import UMShare`
 *    在 CocoaPods 严格模式下找不到 module,要 `:modular_headers => true` 兜底
 * 3. 友盟官方对 Swift 集成的唯一支持是 App 级 bridging header,**没考虑
 *    library 场景** —— 67 个 RN 友盟桥库全用 ObjC 是有原因的
 */
@interface UmengBootstrap : NSObject

+ (instancetype)shared;

- (BOOL)ensureInit:(NSError **)error;
- (BOOL)isInited;

/// 由宿主 App 的 `application:openURL:options:` 调
- (BOOL)handleOpenURL:(NSURL *)url
              options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options;

/// 由宿主 App 的 `application:continueUserActivity:restorationHandler:` 调
/// (微信 Universal Link 必需)
- (BOOL)handleUniversalLink:(NSUserActivity *)userActivity;

@end

NS_ASSUME_NONNULL_END
