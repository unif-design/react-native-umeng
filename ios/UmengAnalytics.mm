#import "UmengAnalytics.h"

#import "UmengBootstrap.h"
#import "UmengSDKAdapters.h"

@interface UmengAnalytics ()

- (instancetype)initWithIsInitialized:(BOOL (^)(void))isInitialized adapter:(id<UmengAnalyticsSDKAdapter>)adapter;

@end

@implementation UmengAnalytics {
  BOOL (^_isInitialized)(void);
  id<UmengAnalyticsSDKAdapter> _adapter;
}

RCT_EXPORT_MODULE(UmengAnalytics)

- (instancetype)init {
  return [self
      initWithIsInitialized:^BOOL {
        return [[UmengBootstrap shared] isInited];
      }
                    adapter:[UmengProductionSDKAdapter new]];
}

- (instancetype)initWithIsInitialized:(BOOL (^)(void))isInitialized adapter:(id<UmengAnalyticsSDKAdapter>)adapter {
  self = [super init];
  if (self) {
    _isInitialized = [isInitialized copy];
    _adapter = adapter;
  }
  return self;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengAnalyticsSpecJSI>(params);
}

- (void)onEvent:(NSString *)eventId params:(NSDictionary *)params {
  if (!_isInitialized()) {
    return;
  }

  NSDictionary<NSString *, NSString *> *attributes = nil;
  if (params.count > 0) {
    NSMutableDictionary<NSString *, NSString *> *attrs = [NSMutableDictionary new];
    for (NSString *k in params) {
      id v = params[k];
      attrs[k] = [v isKindOfClass:[NSString class]] ? (NSString *)v : [NSString stringWithFormat:@"%@", v];
    }
    attributes = [attrs copy];
  }
  [_adapter trackEvent:eventId attributes:attributes];
}

- (void)signIn:(NSString *)userId provider:(NSString *)provider {
  if (!_isInitialized()) {
    return;
  }
  [_adapter signInWithUserId:userId provider:provider.length > 0 ? provider : nil];
}

- (void)signOut {
  if (!_isInitialized()) {
    return;
  }
  [_adapter signOut];
}

@end
