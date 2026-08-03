#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * 友盟 / 微信 / 钉钉 SDK 的窄适配层。
 *
 * 所有第三方 SDK 调用只能经过这个 protocol —— 测试注入 fake 实现就能断言
 * "用户同意《隐私协议》前零 vendor 调用"、精确调用顺序与主线程约束,
 * 不需要在 XCTest 里链接真实友盟 SDK。
 */
@protocol UmengSDKAdapter <NSObject>

/**
 * 写入微信 Universal Link。
 *
 * 必须早于 `configureWeChatWithAppId:appSecret:` —— 友盟在注册微信平台时才把
 * `UMSocialGlobal.universalLinkDic` 读进 WXApi,顺序反了微信 1.8.6+ 不回跳。
 */
- (void)configureWeChatUniversalLink:(NSString *)universalLink;

/// 注册微信平台。返回 NO 表示友盟拒绝了这次注册(可重试,无副作用)。
- (BOOL)configureWeChatWithAppId:(NSString *)appId appSecret:(NSString *)appSecret;

/// 注册钉钉平台。返回 NO 表示友盟拒绝了这次注册(可重试,无副作用)。
- (BOOL)configureDingTalkWithAppId:(NSString *)appId;

/// 真正开始采集上报。只允许在用户同意《隐私协议》之后调用。
- (void)initializeWithAppkey:(NSString *)appkey channel:(NSString *)channel;

- (BOOL)handleOpenURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options;

- (BOOL)handleUniversalLink:(NSUserActivity *)userActivity;

@end

@protocol UmengAnalyticsSDKAdapter <NSObject>

- (void)trackEvent:(NSString *)eventId attributes:(nullable NSDictionary<NSString *, NSString *> *)attributes;
- (void)signInWithUserId:(NSString *)userId provider:(nullable NSString *)provider;
- (void)signOut;

@end

typedef void (^UmengShareSDKCompletion)(NSError *_Nullable error);

@protocol UmengShareSDKAdapter <NSObject>

- (void)shareText:(NSString *)text platform:(NSString *)platform completion:(UmengShareSDKCompletion)completion;
- (void)shareImage:(NSString *)image
             thumb:(NSString *_Nullable)thumb
          platform:(NSString *)platform
        completion:(UmengShareSDKCompletion)completion;
- (void)shareLinkWithTitle:(NSString *)title
                       url:(NSString *)url
               description:(NSString *_Nullable)description
                     thumb:(NSString *_Nullable)thumb
                  platform:(NSString *)platform
                completion:(UmengShareSDKCompletion)completion;
- (BOOL)isInstalledForPlatform:(NSString *)platform;

@end

/**
 * 直接调用友盟 SDK 的生产实现。
 *
 * 构造本身不触碰任何 vendor API —— 授权前 `UmengBootstrap` 可以安全持有它。
 */
@interface UmengProductionSDKAdapter : NSObject <UmengSDKAdapter, UmengAnalyticsSDKAdapter, UmengShareSDKAdapter>
@end

NS_ASSUME_NONNULL_END
