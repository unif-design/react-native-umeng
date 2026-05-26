#import "UmengShare.h"
#import "react_native_umeng-Swift.h"

@implementation UmengShare

RCT_EXPORT_MODULE(UmengShare)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengShareSpecJSI>(params);
}

- (void)shareText:(NSString *)platform
              text:(NSString *)text
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
  [[UmengShareImpl new] shareTextWithPlatform:platform
                                          text:text
                                       resolve:resolve
                                        reject:reject];
}

- (void)shareImage:(NSString *)platform
              image:(NSString *)image
              thumb:(NSString *)thumb
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject {
  [[UmengShareImpl new] shareImageWithPlatform:platform
                                           image:image
                                           thumb:thumb
                                         resolve:resolve
                                          reject:reject];
}

- (void)shareLink:(NSString *)platform
             title:(NSString *)title
               url:(NSString *)url
       description:(NSString *)description
             thumb:(NSString *)thumb
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
  [[UmengShareImpl new] shareLinkWithPlatform:platform
                                          title:title
                                            url:url
                                    description:description
                                          thumb:thumb
                                        resolve:resolve
                                         reject:reject];
}

- (void)isInstalled:(NSString *)platform
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject {
  [[UmengShareImpl new] isInstalledWithPlatform:platform
                                          resolve:resolve
                                           reject:reject];
}

@end
