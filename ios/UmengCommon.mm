#import "UmengCommon.h"
#import "UmengBootstrap.h"

@implementation UmengCommon

RCT_EXPORT_MODULE(UmengCommon)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengCommonSpecJSI>(params);
}

- (void)initialize:(NSDictionary *)config resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [[UmengBootstrap shared] initialize:config
                           completion:^(NSError *_Nullable error) {
                             if (error == nil) {
                               resolve([NSNull null]);
                               return;
                             }

                             BOOL invalidOptions = [error.domain isEqualToString:UmengBootstrapErrorDomain] &&
                                                   (error.code == UmengBootstrapErrorCodeInvalidConfig ||
                                                    error.code == UmengBootstrapErrorCodeConfigChanged);
                             // restartRequired 留在 NSError.userInfo 里跟着 reject 过桥 ——
                             // JS 只把它原样存进 UmengError.nativeError,不解析 message 猜语义。
                             reject(invalidOptions ? @"E_INVALID_OPTIONS" : @"E_UNKNOWN",
                                    error.localizedDescription ?: @"Failed to initialize Umeng", error);
                           }];
}

- (void)isInited:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  resolve(@([[UmengBootstrap shared] isInited]));
}

@end
