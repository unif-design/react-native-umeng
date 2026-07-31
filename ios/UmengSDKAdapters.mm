#import "UmengSDKAdapters.h"

#import <UMCommon/MobClick.h>
#import <UMCommon/UMCommon.h>
#import <UMShare/UMShare.h>

static UMSocialPlatformType UmengVendorPlatform(NSString *platform) {
  if ([platform isEqualToString:@"wechat_session"]) {
    return UMSocialPlatformType_WechatSession;
  }
  return UMSocialPlatformType_DingDing;
}

@interface UmengProductionSDKAdapter ()

- (void)shareMessage:(UMSocialMessageObject *)message
            platform:(NSString *)platform
          completion:(UmengShareSDKCompletion)completion;

@end

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

- (void)trackEvent:(NSString *)eventId attributes:(NSDictionary<NSString *, NSString *> *)attributes {
  if (attributes != nil) {
    [MobClick event:eventId attributes:attributes];
  } else {
    [MobClick event:eventId];
  }
}

- (void)signInWithUserId:(NSString *)userId provider:(NSString *)provider {
  if (provider != nil) {
    [MobClick profileSignInWithPUID:userId provider:provider];
  } else {
    [MobClick profileSignInWithPUID:userId];
  }
}

- (void)signOut {
  [MobClick profileSignOff];
}

- (void)shareText:(NSString *)text platform:(NSString *)platform completion:(UmengShareSDKCompletion)completion {
  UMSocialMessageObject *message = [UMSocialMessageObject new];
  message.text = text;
  [self shareMessage:message platform:platform completion:completion];
}

- (void)shareImage:(NSString *)image
             thumb:(NSString *)thumb
          platform:(NSString *)platform
        completion:(UmengShareSDKCompletion)completion {
  UMShareImageObject *imageObject = [UMShareImageObject new];
  imageObject.shareImage = image;
  if (thumb.length > 0) {
    imageObject.thumbImage = thumb;
  }
  UMSocialMessageObject *message = [UMSocialMessageObject new];
  message.shareObject = imageObject;
  [self shareMessage:message platform:platform completion:completion];
}

- (void)shareLinkWithTitle:(NSString *)title
                       url:(NSString *)url
               description:(NSString *)description
                     thumb:(NSString *)thumb
                  platform:(NSString *)platform
                completion:(UmengShareSDKCompletion)completion {
  UMShareWebpageObject *webpage = [UMShareWebpageObject shareObjectWithTitle:title descr:description thumImage:thumb];
  webpage.webpageUrl = url;
  UMSocialMessageObject *message = [UMSocialMessageObject new];
  message.shareObject = webpage;
  [self shareMessage:message platform:platform completion:completion];
}

- (BOOL)isInstalledForPlatform:(NSString *)platform {
  NSString *scheme = [platform isEqualToString:@"wechat_session"] ? @"weixin://" : @"dingtalk://";
  return [[UIApplication sharedApplication] canOpenURL:[NSURL URLWithString:scheme]];
}

- (void)shareMessage:(UMSocialMessageObject *)message
            platform:(NSString *)platform
          completion:(UmengShareSDKCompletion)completion {
  [[UMSocialManager defaultManager] shareToPlatform:UmengVendorPlatform(platform)
                                      messageObject:message
                              currentViewController:nil
                                         completion:^(id data, NSError *error) {
                                           completion(error);
                                         }];
}

@end
