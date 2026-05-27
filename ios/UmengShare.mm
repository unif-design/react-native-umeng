#import "UmengShare.h"
#import <UIKit/UIKit.h>
#import <UMShare/UMShare.h>

@implementation UmengShare

RCT_EXPORT_MODULE(UmengShare)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengShareSpecJSI>(params);
}

// MARK: - helpers

static BOOL mapPlatform(NSString *p,
                        UMSocialPlatformType *out,
                        RCTPromiseRejectBlock reject) {
  if ([p isEqualToString:@"wechat_session"]) {
    *out = UMSocialPlatformType_WechatSession;
    return YES;
  }
  if ([p isEqualToString:@"dingtalk"]) {
    *out = UMSocialPlatformType_DingDing;
    return YES;
  }
  reject(@"E_PLATFORM_NOT_SUPPORTED",
         [NSString stringWithFormat:@"Platform '%@' is not supported", p],
         nil);
  return NO;
}

- (void)runShareWithPlatform:(NSString *)platform
                  umPlatform:(UMSocialPlatformType)umPlatform
                     message:(UMSocialMessageObject *)message
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject {
  [[UMSocialManager defaultManager] shareToPlatform:umPlatform
                                      messageObject:message
                              currentViewController:nil
                                         completion:^(id data, NSError *error) {
    if (error) {
      // 友盟错误码: 2009 = cancel; 2008 = NotInstall; 其他 = failed
      NSInteger code = error.code;
      if (code == 2009) {
        resolve(@{@"code": @"cancel", @"platform": platform});
      } else if (code == 2008) {
        resolve(@{
          @"code": @"failed",
          @"message": @"platform not installed",
          @"platform": platform
        });
      } else {
        resolve(@{
          @"code": @"failed",
          @"message": error.localizedDescription ?: @"unknown error",
          @"platform": platform
        });
      }
      return;
    }
    resolve(@{@"code": @"success", @"platform": platform});
  }];
}

// MARK: - turbo module API

- (void)shareText:(NSString *)platform
             text:(NSString *)text
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject {
  UMSocialPlatformType umPlatform;
  if (!mapPlatform(platform, &umPlatform, reject)) return;

  __weak UmengShare *weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    UMSocialMessageObject *msg = [UMSocialMessageObject new];
    msg.text = text;
    [weakSelf runShareWithPlatform:platform
                        umPlatform:umPlatform
                           message:msg
                           resolve:resolve
                            reject:reject];
  });
}

- (void)shareImage:(NSString *)platform
             image:(NSString *)image
             thumb:(NSString *)thumb
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
  UMSocialPlatformType umPlatform;
  if (!mapPlatform(platform, &umPlatform, reject)) return;

  __weak UmengShare *weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    UMShareImageObject *img = [UMShareImageObject new];
    img.shareImage = image;
    if (thumb.length > 0) {
      img.thumbImage = thumb;
    }
    UMSocialMessageObject *msg = [UMSocialMessageObject new];
    msg.shareObject = img;
    [weakSelf runShareWithPlatform:platform
                        umPlatform:umPlatform
                           message:msg
                           resolve:resolve
                            reject:reject];
  });
}

- (void)shareLink:(NSString *)platform
            title:(NSString *)title
              url:(NSString *)url
      description:(NSString *)description
            thumb:(NSString *)thumb
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject {
  UMSocialPlatformType umPlatform;
  if (!mapPlatform(platform, &umPlatform, reject)) return;

  __weak UmengShare *weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    UMShareWebpageObject *web =
        [UMShareWebpageObject shareObjectWithTitle:title
                                             descr:description ?: @""
                                         thumImage:thumb];
    web.webpageUrl = url;
    UMSocialMessageObject *msg = [UMSocialMessageObject new];
    msg.shareObject = web;
    [weakSelf runShareWithPlatform:platform
                        umPlatform:umPlatform
                           message:msg
                           resolve:resolve
                            reject:reject];
  });
}

- (void)isInstalled:(NSString *)platform
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject {
  NSString *scheme = nil;
  if ([platform isEqualToString:@"wechat_session"]) {
    scheme = @"weixin://";
  } else if ([platform isEqualToString:@"dingtalk"]) {
    scheme = @"dingtalk://";
  } else {
    reject(@"E_PLATFORM_NOT_SUPPORTED",
           [NSString stringWithFormat:@"Platform '%@' is not supported", platform],
           nil);
    return;
  }

  NSString *finalScheme = scheme;
  dispatch_async(dispatch_get_main_queue(), ^{
    NSURL *url = [NSURL URLWithString:finalScheme];
    resolve(@([[UIApplication sharedApplication] canOpenURL:url]));
  });
}

@end
