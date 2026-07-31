#import "UmengShare.h"

#import "UmengBootstrap.h"
#import "UmengSDKAdapters.h"
#import "UmengShareRequestRegistry.h"

static NSString *const UmengShareNotInitializedCode = @"E_NOT_INITIALIZED";
static NSString *const UmengShareNotInitializedMessage = @"Umeng must be initialized before sharing";

@interface UmengShare ()

- (instancetype)initWithIsInitialized:(BOOL (^)(void))isInitialized
                              adapter:(id<UmengShareSDKAdapter>)adapter
                       mainDispatcher:(void (^)(dispatch_block_t block))mainDispatcher;
- (nullable NSUUID *)beginRequestForPlatform:(NSString *)platform
                                     resolve:(RCTPromiseResolveBlock)resolve
                                      reject:(RCTPromiseRejectBlock)reject;
- (void)invokeRequest:(NSUUID *)requestId
             platform:(NSString *)platform
                block:(void (^)(UmengShareSDKCompletion completion))adapterInvocation;

@end

@implementation UmengShare {
  BOOL (^_isInitialized)(void);
  id<UmengShareSDKAdapter> _adapter;
  void (^_mainDispatcher)(dispatch_block_t block);
  UmengShareRequestRegistry *_requestRegistry;
}

RCT_EXPORT_MODULE(UmengShare)

- (instancetype)init {
  return [self
      initWithIsInitialized:^BOOL {
        return [[UmengBootstrap shared] isInited];
      }
      adapter:[UmengProductionSDKAdapter new]
      mainDispatcher:^(dispatch_block_t block) {
        dispatch_async(dispatch_get_main_queue(), block);
      }];
}

- (instancetype)initWithIsInitialized:(BOOL (^)(void))isInitialized
                              adapter:(id<UmengShareSDKAdapter>)adapter
                       mainDispatcher:(void (^)(dispatch_block_t block))mainDispatcher {
  self = [super init];
  if (self) {
    _isInitialized = [isInitialized copy];
    _adapter = adapter;
    _mainDispatcher = [mainDispatcher copy];
    _requestRegistry = [UmengShareRequestRegistry new];
  }
  return self;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengShareSpecJSI>(params);
}

- (void)invalidate {
  [_requestRegistry invalidate];
}

- (void)shareText:(NSString *)platform
             text:(NSString *)text
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject {
  NSUUID *requestId = [self beginRequestForPlatform:platform resolve:resolve reject:reject];
  if (requestId == nil) {
    return;
  }
  id<UmengShareSDKAdapter> adapter = _adapter;
  [self invokeRequest:requestId
             platform:platform
                block:^(UmengShareSDKCompletion completion) {
                  [adapter shareText:text platform:platform completion:completion];
                }];
}

- (void)shareImage:(NSString *)platform
             image:(NSString *)image
             thumb:(NSString *)thumb
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
  NSUUID *requestId = [self beginRequestForPlatform:platform resolve:resolve reject:reject];
  if (requestId == nil) {
    return;
  }
  id<UmengShareSDKAdapter> adapter = _adapter;
  [self invokeRequest:requestId
             platform:platform
                block:^(UmengShareSDKCompletion completion) {
                  [adapter shareImage:image thumb:thumb platform:platform completion:completion];
                }];
}

- (void)shareLink:(NSString *)platform
            title:(NSString *)title
              url:(NSString *)url
      description:(NSString *)description
            thumb:(NSString *)thumb
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject {
  NSUUID *requestId = [self beginRequestForPlatform:platform resolve:resolve reject:reject];
  if (requestId == nil) {
    return;
  }
  id<UmengShareSDKAdapter> adapter = _adapter;
  [self invokeRequest:requestId
             platform:platform
                block:^(UmengShareSDKCompletion completion) {
                  [adapter shareLinkWithTitle:title
                                          url:url
                                  description:description
                                        thumb:thumb
                                     platform:platform
                                   completion:completion];
                }];
}

- (void)isInstalled:(NSString *)platform resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  NSUUID *requestId = [self beginRequestForPlatform:platform resolve:resolve reject:reject];
  if (requestId == nil) {
    return;
  }
  UmengShareRequestRegistry *registry = _requestRegistry;
  id<UmengShareSDKAdapter> adapter = _adapter;
  _mainDispatcher(^{
    if (![registry isActive:requestId]) {
      return;
    }
    @try {
      BOOL installed = [adapter isInstalledForPlatform:platform];
      [registry resolveRequest:requestId result:@(installed)];
    } @catch (NSException *exception) {
      [registry rejectRequest:requestId
                         code:@"E_UNKNOWN"
                      message:[NSString stringWithFormat:@"Unable to check platform installation: %@",
                                                         exception.reason ?: exception.name]
                        error:nil];
    }
  });
}

- (NSUUID *)beginRequestForPlatform:(NSString *)platform
                            resolve:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject {
  UmengShareRequestRegistry *registry = _requestRegistry;
  NSUUID *requestId = [registry registerResolve:resolve reject:reject];
  if (requestId == nil) {
    return nil;
  }
  if (!_isInitialized()) {
    [registry rejectRequest:requestId
                       code:UmengShareNotInitializedCode
                    message:UmengShareNotInitializedMessage
                      error:nil];
    return nil;
  }

  if (![platform isEqualToString:@"wechat_session"] && ![platform isEqualToString:@"dingtalk"]) {
    [registry rejectRequest:requestId
                       code:@"E_PLATFORM_NOT_SUPPORTED"
                    message:[NSString stringWithFormat:@"Platform '%@' is not supported", platform]
                      error:nil];
    return nil;
  }
  return requestId;
}

- (void)invokeRequest:(NSUUID *)requestId
             platform:(NSString *)platform
                block:(void (^)(UmengShareSDKCompletion completion))adapterInvocation {
  UmengShareRequestRegistry *registry = _requestRegistry;
  _mainDispatcher(^{
    if (![registry isActive:requestId]) {
      return;
    }

    __weak UmengShareRequestRegistry *weakRegistry = registry;
    UmengShareSDKCompletion completion = ^(NSError *error) {
      UmengShareRequestRegistry *strongRegistry = weakRegistry;
      if (strongRegistry == nil) {
        return;
      }
      if (error == nil) {
        [strongRegistry resolveRequest:requestId result:@{@"code" : @"success", @"platform" : platform}];
        return;
      }
      if (error.code == 2009) {
        [strongRegistry rejectRequest:requestId
                                 code:@"E_USER_CANCEL"
                              message:error.localizedDescription ?: @"Share cancelled"
                                error:error];
      } else if (error.code == 2008) {
        [strongRegistry rejectRequest:requestId
                                 code:@"E_PLATFORM_NOT_INSTALLED"
                              message:error.localizedDescription ?: @"Platform is not installed"
                                error:error];
      } else {
        [strongRegistry rejectRequest:requestId
                                 code:@"E_SHARE_FAILED"
                              message:error.localizedDescription ?: @"Share failed"
                                error:error];
      }
    };

    @try {
      adapterInvocation(completion);
    } @catch (NSException *exception) {
      [registry rejectRequest:requestId
                         code:@"E_SHARE_FAILED"
                      message:[NSString stringWithFormat:@"Share failed: %@", exception.reason ?: exception.name]
                        error:nil];
    }
  });
}

@end
