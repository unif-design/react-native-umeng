#import "UmengCommon.h"
#import "react_native_umeng-Swift.h"

@implementation UmengCommon

RCT_EXPORT_MODULE(UmengCommon)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengCommonSpecJSI>(params);
}

- (void)init:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject {
  [[UmengCommonImpl new] initResolve:resolve reject:reject];
}

- (void)isInited:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject {
  [[UmengCommonImpl new] isInitedResolve:resolve reject:reject];
}

@end
