#import "UmengSDKAdapters.h"

#import <UMCommon/UMCommon.h>
#import <UMShare/UMShare.h>

@implementation UmengProductionSDKAdapter

- (void)configureWeChatUniversalLink:(NSString *)universalLink {
  // key 必须是包装过 rawValue 的 NSNumber —— 友盟按 @(UMSocialPlatformType) 取值,
  // 直接放枚举常量会被当成非法 key 静默丢弃。
  [UMSocialGlobal shareInstance].universalLinkDic = @{@(UMSocialPlatformType_WechatSession) : universalLink};
}

- (BOOL)configureWeChatWithAppId:(NSString *)appId appSecret:(NSString *)appSecret {
  // setPlaform 少一个 t 是友盟公开 API 的原始拼写,不能"顺手修正"。
  return [[UMSocialManager defaultManager] setPlaform:UMSocialPlatformType_WechatSession
                                               appKey:appId
                                            appSecret:appSecret
                                          redirectURL:nil];
}

- (BOOL)configureDingTalkWithAppId:(NSString *)appId {
  // 钉钉只有 AppKey / Client ID,没有 secret 与 redirectURL。
  return [[UMSocialManager defaultManager] setPlaform:UMSocialPlatformType_DingDing
                                               appKey:appId
                                            appSecret:nil
                                          redirectURL:nil];
}

- (void)initializeWithAppkey:(NSString *)appkey channel:(NSString *)channel {
  [UMConfigure initWithAppkey:appkey channel:channel];
}

- (BOOL)handleOpenURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options {
  return [[UMSocialManager defaultManager] handleOpenURL:url options:options];
}

- (BOOL)handleUniversalLink:(NSUserActivity *)userActivity {
  return [[UMSocialManager defaultManager] handleUniversalLink:userActivity options:nil];
}

@end
