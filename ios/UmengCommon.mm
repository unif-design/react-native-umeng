#import "UmengCommon.h"
#import "UmengBootstrap.h"

@implementation UmengCommon

RCT_EXPORT_MODULE(UmengCommon)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengCommonSpecJSI>(params);
}

- (void)preInit:(NSDictionary *)config
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject {
  NSError *error = nil;
  BOOL ok = [[UmengBootstrap shared] ensurePreInit:config error:&error];
  if (ok) {
    resolve([NSNull null]);
  } else {
    reject(@"E_INVALID_OPTIONS",
           error.localizedDescription ?: @"preInit failed",
           error);
  }
}

- (void)init:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject {
  NSError *error = nil;
  BOOL ok = [[UmengBootstrap shared] ensureInit:&error];
  if (ok) {
    resolve([NSNull null]);
  } else {
    NSString *code = error.code == -3 ? @"E_INVALID_OPTIONS" : @"E_UNKNOWN";
    reject(code,
           error.localizedDescription ?: @"init failed",
           error);
  }
}

- (void)isInited:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject {
  resolve(@([[UmengBootstrap shared] isInited]));
}

@end
