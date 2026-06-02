#import "UmengAnalytics.h"
#import <UMCommon/MobClick.h>

@implementation UmengAnalytics

RCT_EXPORT_MODULE(UmengAnalytics)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengAnalyticsSpecJSI>(params);
}

- (void)onEvent:(NSString *)eventId params:(NSDictionary *)params {
  if (params.count > 0) {
    // MobClick event:attributes: 要求 value 是 NSString。JS 层 src/analytics.ts
    // 已经 stringify(num→string),这里再兜底一次保证类型。
    NSMutableDictionary<NSString *, NSString *> *attrs = [NSMutableDictionary new];
    for (NSString *k in params) {
      id v = params[k];
      attrs[k] = [v isKindOfClass:[NSString class]] ? (NSString *)v : [NSString stringWithFormat:@"%@", v];
    }
    [MobClick event:eventId attributes:attrs];
  } else {
    [MobClick event:eventId];
  }
}

- (void)signIn:(NSString *)userId provider:(NSString *)provider {
  if (provider.length > 0) {
    [MobClick profileSignInWithPUID:userId provider:provider];
  } else {
    [MobClick profileSignInWithPUID:userId];
  }
}

- (void)signOut {
  [MobClick profileSignOff];
}

@end
