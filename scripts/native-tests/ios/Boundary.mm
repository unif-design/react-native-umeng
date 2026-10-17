#import <React/RCTLog.h>
#import <UIKit/UIKit.h>
#import <UMCommon/MobClick.h>
#import <UMCommon/UMCommon.h>
#import <UMShare/UMShare.h>
@implementation UIApplication
+ (instancetype)sharedApplication {
  static UIApplication *v;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    v = [UIApplication new];
    v.openedURLs = [NSMutableArray new];
  });
  return v;
}
- (BOOL)canOpenURL:(NSURL *)url {
  [_openedURLs addObject:url];
  return _canOpen;
}
@end
static RCTLogFunction activeLog;
void RCTPerformBlockWithLogFunction(dispatch_block_t block, RCTLogFunction logger) {
  RCTLogFunction previous = activeLog;
  activeLog = logger;
  @try {
    block();
  } @finally {
    activeLog = previous;
  }
}
void RCTLogInfo(NSString *message, ...) {
  if (activeLog)
    activeLog(RCTLogLevelInfo, 0, nil, nil, message);
}
@implementation MobClick
+ (NSMutableArray *)calls {
  static NSMutableArray *v;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    v = [NSMutableArray new];
  });
  return v;
}
+ (void)event:(NSString *)event {
  [[self calls] addObject:@[ @"event", event ]];
}
+ (void)event:(NSString *)event attributes:(NSDictionary *)attributes {
  [[self calls] addObject:@[ @"event", event, attributes ]];
}
+ (void)profileSignInWithPUID:(NSString *)user {
  [[self calls] addObject:@[ @"user", user ]];
}
+ (void)profileSignInWithPUID:(NSString *)user provider:(NSString *)provider {
  [[self calls] addObject:@[ @"user", user, provider ]];
}
+ (void)profileSignOff {
  [[self calls] addObject:@[ @"clear" ]];
}
@end
static NSException *configurationFailure;
@implementation UMConfigure
+ (void)setFailure:(NSException *)failure {
  configurationFailure = failure;
}
+ (NSMutableArray *)calls {
  static NSMutableArray *v;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    v = [NSMutableArray new];
  });
  return v;
}
+ (void)initWithAppkey:(NSString *)key channel:(NSString *)channel {
  [[self calls] addObject:@[ key, channel ]];
  if (configurationFailure)
    @throw configurationFailure;
}
@end
@implementation UMSocialGlobal
+ (instancetype)shareInstance {
  static UMSocialGlobal *v;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    v = [UMSocialGlobal new];
  });
  return v;
}
@end
@implementation UMSocialMessageObject
@end
@implementation UMShareImageObject
@end
@implementation UMShareWebpageObject
+ (instancetype)shareObjectWithTitle:(NSString *)title descr:(NSString *)descr thumImage:(id)thumb {
  UMShareWebpageObject *v = [self new];
  v.title = title;
  v.descr = descr;
  v.thumbImage = thumb;
  return v;
}
@end
@implementation UMSocialManager
+ (instancetype)defaultManager {
  static UMSocialManager *v;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    v = [UMSocialManager new];
    v.calls = [NSMutableArray new];
    v.completions = [NSMutableArray new];
    v.configured = YES;
    v.handled = YES;
  });
  return v;
}
- (BOOL)setPlaform:(UMSocialPlatformType)platform
            appKey:(NSString *)key
         appSecret:(NSString *)secret
       redirectURL:(NSString *)url {
  [_calls addObject:@[ @"configure", @(platform), key, secret ?: [NSNull null], url ?: [NSNull null] ]];
  return _configured;
}
- (BOOL)handleOpenURL:(NSURL *)url options:(NSDictionary *)options {
  [_calls addObject:@[ @"url", url, options ]];
  if (_lifecycleFailure)
    @throw _lifecycleFailure;
  return _handled;
}
- (BOOL)handleUniversalLink:(NSUserActivity *)activity options:(NSDictionary *)options {
  [_calls addObject:@[ @"link", activity, options ?: [NSNull null] ]];
  if (_lifecycleFailure)
    @throw _lifecycleFailure;
  return _handled;
}
- (void)shareToPlatform:(UMSocialPlatformType)platform
            messageObject:(UMSocialMessageObject *)message
    currentViewController:(id)controller
               completion:(void (^)(id, NSError *))completion {
  [_calls addObject:@[ @"share", @(platform), message, controller ?: [NSNull null] ]];
  [_completions addObject:[completion copy]];
}
@end
