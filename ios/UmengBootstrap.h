#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/// `UmengBootstrap` 产生的全部 `NSError` 都用这个 domain。
extern NSString *const UmengBootstrapErrorDomain;

/// terminal failure 会在 `NSError.userInfo` 里带 `@YES`:进程内已无法恢复,
/// 只能重启 App 重来。私有约定,不属于公共 JS 错误契约。
extern NSString *const UmengBootstrapRestartRequiredKey;

typedef NS_ENUM(NSInteger, UmengBootstrapErrorCode) {
  /// config 本身非法(缺字段 / 类型错 / Universal Link 不是带 host 的 HTTPS)。
  UmengBootstrapErrorCodeInvalidConfig = 1,
  /// 初始化已经开始后又换了一份 config。
  UmengBootstrapErrorCodeConfigChanged = 2,
  /// 友盟明确拒绝了平台注册(返回 NO)。没有副作用,可以修好后重试。
  UmengBootstrapErrorCodePlatformRegistrationFailed = 3,
  /// vendor 调用抛异常,副作用不可判定 —— 进入需要重启的 terminal state。
  UmengBootstrapErrorCodeTerminalFailure = 4,
};

/**
 * Umeng iOS 初始化状态机(ObjC++)。
 *
 * 合规核心:用户同意《隐私协议》之前,本类不持有 appkey、不注册平台、不上报。
 * 构造实例、转发 URL / Universal Link 回调都不会触碰友盟 SDK。
 *
 * `initialize:completion:` 是授权后的唯一入口,内部按固定顺序执行:
 * Universal Link → 微信 `setPlaform` → 钉钉 `setPlaform` → `UMConfigure initWithAppkey`。
 * 全部 vendor 调用都在主线程;状态读写走 private serial queue,两者不会互相阻塞。
 */
@interface UmengBootstrap : NSObject

+ (instancetype)shared;

/**
 * 授权后初始化。幂等 —— 同一份 config 重复调只真正执行一次。
 *
 * `config` 由 JS 侧 `toNativeInitConfig` 产生,native 仍然完整复校:
 *   - `appkey`(NSString,必填非空)
 *   - `channel`(NSString,可选;缺省用友盟 iOS 默认渠道 "App Store")
 *   - `wechatAppId` / `wechatAppSecret` / `wechatUniversalLink`
 *     (iOS 三者必须同时出现,Universal Link 必须是带 host 的绝对 HTTPS URL)
 *   - `dingtalkAppId`(NSString,可选非空)
 *
 * `completion` 在主线程回调;`error` 为 nil 表示已完成初始化。
 * 初始化开始后换 config 会得到 `UmengBootstrapErrorCodeConfigChanged`。
 */
- (void)initialize:(NSDictionary *)config completion:(void (^)(NSError *_Nullable error))completion;

- (BOOL)isInited;

/// 由宿主 App 的 `application:openURL:options:` 调。未初始化时返回 NO 且不触碰 SDK。
- (BOOL)handleOpenURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options;

/// 由宿主 App 的 `application:continueUserActivity:restorationHandler:` 调
/// (微信 Universal Link 必需)。未初始化时返回 NO 且不触碰 SDK。
- (BOOL)handleUniversalLink:(NSUserActivity *)userActivity;

@end

NS_ASSUME_NONNULL_END
