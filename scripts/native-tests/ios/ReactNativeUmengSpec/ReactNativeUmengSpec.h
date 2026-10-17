#import <React/RCTBridgeModule.h>
#include <memory>
namespace facebook::react {
struct TurboModule {
  virtual ~TurboModule() = default;
};
struct ObjCTurboModule {
  struct InitParams {};
};
struct NativeUmengCommonSpecJSI : TurboModule {
  explicit NativeUmengCommonSpecJSI(const ObjCTurboModule::InitParams &p) {}
};
struct NativeUmengAnalyticsSpecJSI : TurboModule {
  explicit NativeUmengAnalyticsSpecJSI(const ObjCTurboModule::InitParams &p) {}
};
struct NativeUmengShareSpecJSI : TurboModule {
  explicit NativeUmengShareSpecJSI(const ObjCTurboModule::InitParams &p) {}
};
} // namespace facebook::react
@protocol NativeUmengCommonSpec <NSObject>
- (void)initialize:(NSDictionary *)config resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)isInited:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)getConfiguredShareTargets:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params;
@end
@protocol NativeUmengAnalyticsSpec <NSObject>
- (void)onEvent:(NSString *)eventId params:(NSDictionary *)params;
- (void)signIn:(NSString *)userId provider:(NSString *)provider;
- (void)signOut;
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params;
@end
@protocol NativeUmengShareSpec <NSObject>
- (void)shareText:(NSString *)platform
             text:(NSString *)text
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject;
- (void)shareImage:(NSString *)platform
             image:(NSString *)image
             thumb:(NSString *)thumb
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject;
- (void)shareLink:(NSString *)platform
            title:(NSString *)title
              url:(NSString *)url
      description:(NSString *)description
            thumb:(NSString *)thumb
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject;
- (void)isInstalled:(NSString *)platform resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params;
@end
