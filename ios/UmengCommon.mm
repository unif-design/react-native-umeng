#import "UmengCommon.h"
#import "UmengBootstrap.h"

@implementation UmengCommon

RCT_EXPORT_MODULE(UmengCommon)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengCommonSpecJSI>(params);
}

- (void)init:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject {
  NSError *error = nil;
  BOOL ok = [[UmengBootstrap shared] ensureInit:&error];
  if (ok) {
    resolve([NSNull null]);
  } else {
    reject(@"E_UNKNOWN",
           error.localizedDescription ?: @"init failed",
           error);
  }
}

- (void)isInited:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject {
  resolve(@([[UmengBootstrap shared] isInited]));
}

@end
