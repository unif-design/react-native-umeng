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

                             NSString *code = @"E_UNKNOWN";
                             if ([error.domain isEqualToString:UmengBootstrapErrorDomain]) {
                               if (error.code == UmengBootstrapErrorCodeInvalidConfig)
                                 code = @"E_INVALID_OPTIONS";
                               if (error.code == UmengBootstrapErrorCodeConfigChanged)
                                 code = @"E_CONFIGURATION_LOCKED";
                             }
                             reject(code, error.localizedDescription ?: @"Failed to initialize Umeng", error);
                           }];
}

- (void)isInited:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  resolve(@([[UmengBootstrap shared] isInited]));
}

- (void)getConfiguredShareTargets:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  NSArray<NSString *> *targets = [[UmengBootstrap shared] configuredShareTargets];
  if (targets == nil) {
    reject(@"E_NOT_INITIALIZED", @"Umeng must be initialized before querying share targets", nil);
    return;
  }
  resolve(targets);
}

@end
