#import "UmengAnalytics.h"
#import "react_native_umeng-Swift.h"

@implementation UmengAnalytics

RCT_EXPORT_MODULE(UmengAnalytics)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengAnalyticsSpecJSI>(params);
}

- (void)onEvent:(NSString *)eventId params:(NSDictionary *)params {
  [[UmengAnalyticsImpl new] onEventWithEventId:eventId params:params];
}

- (void)signIn:(NSString *)userId provider:(NSString *)provider {
  [[UmengAnalyticsImpl new] signInWithUserId:userId provider:provider];
}

- (void)signOut {
  [[UmengAnalyticsImpl new] signOut];
}

@end
