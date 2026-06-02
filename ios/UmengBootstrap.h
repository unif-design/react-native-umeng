#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Umeng iOS 初始化共享单例 (ObjC++ 版)。
 *
 * 两步初始化对齐友盟 Android 推荐姿态:
 *   1. ensurePreInit:config:error: — 存 config + setPlaform 注册平台,
 *      可在 user 同意《隐私协议》之前调。**不调 UMConfigure.initWithAppkey,
 *      所以不上报数据**。
 *   2. ensureInit:error: — user 同意后调,真正 [UMConfigure
 *      initWithAppkey:channel:],开始统计上报。
 *
 * iOS 友盟公开 SDK 没有 preInit API,所以 preInit 阶段实际跑 setPlaform
 * (无上报副作用) + 缓存 config;真正的 initWithAppkey 推迟到 ensureInit。
 * 跟 Android UMConfigure.preInit + init 两步在 PIPL 合规上等价。
 */
@interface UmengBootstrap : NSObject

+ (instancetype)shared;

/**
 * 预初始化。idempotent — 重复调只执行一次。
 *
 * @param config NSDictionary 含字段:
 *   - appkey (NSString *, 必填)
 *   - channel (NSString *, 可选, 默认 "App Store")
 *   - wechatAppId (NSString *, 可选)
 *   - wechatAppSecret (NSString *, 可选, 跟 wechatAppId 配套)
 *   - wechatUniversalLink (NSString *, 可选, 微信 1.8.6+ 强制)
 *   - dingtalkAppId (NSString *, 可选)
 */
- (BOOL)ensurePreInit:(NSDictionary *)config error:(NSError **)error;

/**
 * 正式初始化。idempotent。`ensurePreInit:` 必须先调过(没调则 return NO
 * + error.code = -3)。
 */
- (BOOL)ensureInit:(NSError **)error;

- (BOOL)isInited;

/// 由宿主 App 的 `application:openURL:options:` 调
- (BOOL)handleOpenURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options;

/// 由宿主 App 的 `application:continueUserActivity:restorationHandler:` 调
/// (微信 Universal Link 必需)
- (BOOL)handleUniversalLink:(NSUserActivity *)userActivity;

@end

NS_ASSUME_NONNULL_END
