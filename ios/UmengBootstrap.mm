#import "UmengBootstrap.h"
#import <UMCommon/UMCommon.h>
#import <UMShare/UMShare.h>

@implementation UmengBootstrap {
  NSLock *_lock;
  BOOL _preInited;
  BOOL _inited;
  // 缓存 preInit 时传的 appkey + channel,init 时用
  NSString *_appkey;
  NSString *_channel;
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
    _preInited = NO;
    _inited = NO;
  }
  return self;
}

- (BOOL)ensurePreInit:(NSDictionary *)config error:(NSError **)error {
  [_lock lock];
  if (_preInited) {
    [_lock unlock];
    return YES;
  }

  NSString *appkey = config[@"appkey"];
  if (![appkey isKindOfClass:[NSString class]] || appkey.length == 0) {
    if (error) {
      *error = [NSError errorWithDomain:@"UmengBootstrap"
                                   code:-1
                               userInfo:@{NSLocalizedDescriptionKey : @"`appkey` is required"}];
    }
    [_lock unlock];
    return NO;
  }

  NSString *channel = config[@"channel"];
  if (![channel isKindOfClass:[NSString class]] || channel.length == 0) {
    channel = @"App Store";
  }

  // 缓存给 ensureInit 用
  _appkey = appkey;
  _channel = channel;

  NSString *wxId = config[@"wechatAppId"];
  NSString *wxSecret = config[@"wechatAppSecret"];
  NSString *wxUL = config[@"wechatUniversalLink"];
  NSString *ddId = config[@"dingtalkAppId"];

  // iOS 友盟 SDK 没 preInit API,这里跑 setPlaform — 友盟文档原文:
  // "setPlaform 必须在 init 之前调",preInit 阶段调正合适,且 setPlaform
  // 只更新 SDK 内部 dict[platform→appKey],无上报副作用。
  if ([wxId isKindOfClass:[NSString class]] && wxId.length > 0 && [wxSecret isKindOfClass:[NSString class]] &&
      wxSecret.length > 0) {
    // 友盟 SDK 拼写遵循原始错误: setPlaform 少一个 t
    [[UMSocialManager defaultManager] setPlaform:UMSocialPlatformType_WechatSession
                                          appKey:wxId
                                       appSecret:wxSecret
                                     redirectURL:nil];

    if ([wxUL isKindOfClass:[NSString class]] && wxUL.length > 0) {
      // 微信 Universal Link 1.8.6+ 强制要求,key 必须 rawInt 不能枚举
      [UMSocialGlobal shareInstance].universalLinkDic = @{@(UMSocialPlatformType_WechatSession) : wxUL};
    }
  }

  if ([ddId isKindOfClass:[NSString class]] && ddId.length > 0) {
    // 友盟枚举 UMSocialPlatformType_DingDing (驼峰 D-Ding 不是 D-ding)
    [[UMSocialManager defaultManager] setPlaform:UMSocialPlatformType_DingDing
                                          appKey:ddId
                                       appSecret:nil
                                     redirectURL:nil];
  }

  _preInited = YES;
  [_lock unlock];
  return YES;
}

- (BOOL)ensureInit:(NSError **)error {
  [_lock lock];
  if (_inited) {
    [_lock unlock];
    return YES;
  }
  if (!_preInited) {
    if (error) {
      *error = [NSError
          errorWithDomain:@"UmengBootstrap"
                     code:-3
                 userInfo:@{
                   NSLocalizedDescriptionKey : @"`Common.preInit(config)` must be called before `Common.init()`"
                 }];
    }
    [_lock unlock];
    return NO;
  }

  // 真正开始上报
  [UMConfigure initWithAppkey:_appkey channel:_channel];

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

- (BOOL)handleOpenURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options {
  return [[UMSocialManager defaultManager] handleOpenURL:url options:options];
}

- (BOOL)handleUniversalLink:(NSUserActivity *)userActivity {
  return [[UMSocialManager defaultManager] handleUniversalLink:userActivity options:nil];
}

@end
