#import "UmengBootstrap.h"
#import <UMCommon/UMCommon.h>
#import <UMShare/UMShare.h>

@implementation UmengBootstrap {
  NSLock *_lock;
  BOOL _inited;
}

+ (instancetype)shared {
  static UmengBootstrap *s;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    s = [[UmengBootstrap alloc] init];
  });
  return s;
}

- (instancetype)init {
  if (self = [super init]) {
    _lock = [NSLock new];
    _inited = NO;
  }
  return self;
}

- (BOOL)ensureInit:(NSError **)error {
  [_lock lock];
  if (_inited) {
    [_lock unlock];
    return YES;
  }

  NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
  if (!info) {
    if (error) {
      *error = [NSError errorWithDomain:@"UmengBootstrap" code:-1
                              userInfo:@{NSLocalizedDescriptionKey: @"Info.plist not available"}];
    }
    [_lock unlock];
    return NO;
  }

  NSString *appkey = info[@"UMENG_APPKEY"];
  if (![appkey isKindOfClass:[NSString class]] || appkey.length == 0) {
    if (error) {
      *error = [NSError errorWithDomain:@"UmengBootstrap" code:-2
                              userInfo:@{NSLocalizedDescriptionKey: @"Info.plist key UMENG_APPKEY is required"}];
    }
    [_lock unlock];
    return NO;
  }

  NSString *channel = info[@"UMENG_CHANNEL"];
  if (![channel isKindOfClass:[NSString class]] || channel.length == 0) {
    channel = @"App Store";
  }

  NSString *wxId = info[@"UMENG_WECHAT_APPID"];
  NSString *wxSecret = info[@"UMENG_WECHAT_APPSECRET"];
  NSString *wxUL = info[@"UMENG_WECHAT_UNIVERSAL_LINK"];
  NSString *ddId = info[@"UMENG_DINGTALK_APPID"];

  [UMConfigure initWithAppkey:appkey channel:channel];

  if ([wxId isKindOfClass:[NSString class]] && wxId.length > 0 &&
      [wxSecret isKindOfClass:[NSString class]] && wxSecret.length > 0) {
    // 友盟 SDK 拼写遵循原始错误: setPlaform 少一个 t
    [[UMSocialManager defaultManager] setPlaform:UMSocialPlatformType_WechatSession
                                          appKey:wxId
                                       appSecret:wxSecret
                                     redirectURL:nil];

    if ([wxUL isKindOfClass:[NSString class]] && wxUL.length > 0) {
      // 微信 Universal Link 1.8.6+ 强制要求,key 必须 rawInt 不能枚举
      [UMSocialGlobal shareInstance].universalLinkDic = @{
        @(UMSocialPlatformType_WechatSession): wxUL
      };
    }
  }

  if ([ddId isKindOfClass:[NSString class]] && ddId.length > 0) {
    // 友盟枚举 UMSocialPlatformType_DingDing(驼峰 D-Ding 不是 D-ding)
    [[UMSocialManager defaultManager] setPlaform:UMSocialPlatformType_DingDing
                                          appKey:ddId
                                       appSecret:nil
                                     redirectURL:nil];
  }

  _inited = YES;
  [_lock unlock];
  return YES;
}

- (BOOL)isInited {
  [_lock lock];
  BOOL v = _inited;
  [_lock unlock];
  return v;
}

- (BOOL)handleOpenURL:(NSURL *)url
              options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options {
  return [[UMSocialManager defaultManager] handleOpenURL:url options:options];
}

- (BOOL)handleUniversalLink:(NSUserActivity *)userActivity {
  return [[UMSocialManager defaultManager] handleUniversalLink:userActivity options:nil];
}

@end
