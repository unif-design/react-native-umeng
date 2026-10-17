#import "UmengAnalytics.h"
#import "UmengBootstrap+Testing.h"
#import "UmengCommon.h"
#import "UmengShare.h"
#import "UmengShareRequestRegistry.h"
#import <UMCommon/MobClick.h>
#import <UMCommon/UMCommon.h>
#import <UMShare/UMShare.h>
#import <XCTest/XCTest.h>

@interface UmengShare (RuntimeTesting)
- (instancetype)initWithIsInitialized:(BOOL (^)(void))isInitialized
                              adapter:(id<UmengShareSDKAdapter>)adapter
                       mainDispatcher:(void (^)(dispatch_block_t))dispatcher;
- (void)invalidate;
@end
@interface UmengNativeRuntimeTests : XCTestCase
@end
@implementation UmengNativeRuntimeTests
- (NSDictionary *)config {
  return @{
    @"appkey" : @"app",
    @"wechatAppId" : @"wx",
    @"wechatAppSecret" : @"secret",
    @"wechatUniversalLink" : @"https://example.com",
    @"dingtalkAppId" : @"ding"
  };
}
- (NSString *)initialize:(UmengCommon *)common config:(NSDictionary *)config {
  XCTestExpectation *done = [self expectationWithDescription:@"common settled"];
  __block NSString *result = nil;
  [common initialize:config
      resolve:^(id value) {
        XCTAssertEqualObjects(value, [NSNull null]);
        [done fulfill];
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        result = code;
        XCTAssertNotNil(error);
        XCTAssertTrue(message.length > 0);
        [done fulfill];
      }];
  [self waitForExpectations:@[ done ] timeout:2];
  return result;
}
- (void)testProduction {
  UmengCommon *common = [UmengCommon new];
  UmengAnalytics *analytics = [UmengAnalytics new];
  UmengShare *share = [UmengShare new];
  for (Class type in @[ [UmengCommon class], [UmengAnalytics class], [UmengShare class] ]) {
    XCTAssertNotNil([type performSelector:@selector(moduleName)]);
  }
  facebook::react::ObjCTurboModule::InitParams params;
  XCTAssertTrue([common getTurboModule:params] != nullptr);
  XCTAssertTrue([analytics getTurboModule:params] != nullptr);
  XCTAssertTrue([share getTurboModule:params] != nullptr);
  __block id state;
  [common
      isInited:^(id value) {
        state = value;
      }
        reject:nil];
  XCTAssertEqualObjects(state, @NO);
  __block NSString *targetError;
  [common
      getConfiguredShareTargets:^(id value) {
        XCTFail(@"unexpected targets");
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        targetError = code;
      }];
  XCTAssertEqualObjects(targetError, @"E_NOT_INITIALIZED");
  [analytics onEvent:@"before" params:nil];
  [analytics signIn:@"before" provider:nil];
  [analytics signOut];
  XCTAssertEqual([MobClick calls].count, 0);
  XCTestExpectation *notReady = [self expectationWithDescription:@"share not ready"];
  [share shareText:@"wechat_session"
      text:@"before"
      resolve:^(id value) {
        XCTFail(@"unexpected share");
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        XCTAssertEqualObjects(code, @"E_NOT_INITIALIZED");
        [notReady fulfill];
      }];
  [self waitForExpectations:@[ notReady ] timeout:2];
  XCTAssertEqualObjects([self initialize:common config:@{}], @"E_INVALID_OPTIONS");
  [UMSocialManager defaultManager].configured = NO;
  XCTAssertEqualObjects([self initialize:common config:[self config]], @"E_UNKNOWN");
  [UMSocialManager defaultManager].configured = YES;
  XCTAssertNil([self initialize:common config:[self config]]);
  XCTAssertEqualObjects([UMSocialGlobal shareInstance].universalLinkDic, (@{@1 : @"https://example.com"}));
  XCTAssertEqualObjects([UMConfigure calls].lastObject, (@[ @"app", @"App Store" ]));
  XCTAssertEqualObjects([self initialize:common config:@{@"appkey" : @"changed"}], @"E_CONFIGURATION_LOCKED");
  [common
      isInited:^(id value) {
        state = value;
      }
        reject:nil];
  XCTAssertEqualObjects(state, @YES);
  [common
      getConfiguredShareTargets:^(id value) {
        state = value;
      }
                         reject:nil];
  XCTAssertEqualObjects(state, (@[ @"wechat_session", @"dingtalk" ]));
  [analytics onEvent:@"empty" params:nil];
  [analytics onEvent:@"purchase" params:@{@"amount" : @12, @"currency" : @"CNY"}];
  [analytics signIn:@"user1" provider:nil];
  [analytics signIn:@"user2" provider:@"wechat"];
  [analytics signOut];
  XCTAssertEqualObjects(
      [MobClick calls], (@[
        @[ @"event", @"empty" ], @[ @"event", @"purchase", @{@"amount" : @"12", @"currency" : @"CNY"} ],
        @[ @"user", @"user1" ], @[ @"user", @"user2", @"wechat" ], @[ @"clear" ]
      ]));
  NSURL *url = [NSURL URLWithString:@"test://callback"];
  XCTAssertTrue([[UmengBootstrap shared] handleOpenURL:url options:@{}]);
  NSUserActivity *activity = [[NSUserActivity alloc] initWithActivityType:@"web"];
  XCTAssertTrue([[UmengBootstrap shared] handleUniversalLink:activity]);
  [UMSocialManager defaultManager].lifecycleFailure = [NSException exceptionWithName:@"vendor-lifecycle"
                                                                              reason:@"failed"
                                                                            userInfo:nil];
  XCTAssertFalse([[UmengBootstrap shared] handleOpenURL:url options:@{}]);
  XCTestExpectation *background = [self expectationWithDescription:@"background SDK lifecycle failure stays contained"];
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    XCTAssertFalse([[UmengBootstrap shared] handleUniversalLink:activity]);
    [background fulfill];
  });
  [self waitForExpectations:@[ background ] timeout:2];
  [UMSocialManager defaultManager].lifecycleFailure = nil;
  UmengProductionSDKAdapter *adapter = [UmengProductionSDKAdapter new];
  UIApplication.sharedApplication.canOpen = YES;
  XCTAssertTrue([adapter isInstalledForPlatform:@"wechat_session"]);
  UIApplication.sharedApplication.canOpen = NO;
  XCTAssertFalse([adapter isInstalledForPlatform:@"dingtalk"]);
  XCTAssertEqualObjects([UIApplication.sharedApplication.openedURLs valueForKey:@"absoluteString"],
                        (@[ @"weixin://", @"dingtalk://" ]));
  __block NSInteger callbacks = 0;
  UmengShareSDKCompletion completed = ^(NSError *error) {
    XCTAssertNil(error);
    callbacks++;
  };
  [adapter shareText:@"hello" platform:@"wechat_session" completion:completed];
  [adapter shareImage:@"https://image" thumb:@"https://thumb" platform:@"dingtalk" completion:completed];
  [adapter shareLinkWithTitle:@"title"
                          url:@"https://target"
                  description:@"desc"
                        thumb:@"https://thumb"
                     platform:@"wechat_session"
                   completion:completed];
  NSArray *calls = [UMSocialManager defaultManager].calls;
  NSArray *last = [calls subarrayWithRange:NSMakeRange(calls.count - 3, 3)];
  UMSocialMessageObject *text = last[0][2], *image = last[1][2], *link = last[2][2];
  XCTAssertEqualObjects(text.text, @"hello");
  XCTAssertEqualObjects(last[1][1], @2);
  XCTAssertEqualObjects([image.shareObject valueForKey:@"shareImage"], @"https://image");
  XCTAssertEqualObjects([image.shareObject valueForKey:@"thumbImage"], @"https://thumb");
  XCTAssertEqualObjects([link.shareObject valueForKey:@"descr"], @"desc");
  XCTAssertEqualObjects([link.shareObject valueForKey:@"webpageUrl"], @"https://target");
  for (void (^callback)(id, NSError *) in [[UMSocialManager defaultManager].completions copy])
    callback(nil, nil);
  XCTAssertEqual(callbacks, 3);
  XCTestExpectation *queued = [self expectationWithDescription:@"default main dispatcher"];
  [share isInstalled:@"wechat_session"
             resolve:^(id value) {
               XCTAssertEqualObjects(value, @NO);
               [queued fulfill];
             }
              reject:nil];
  [self waitForExpectations:@[ queued ] timeout:2];
}
- (void)testTerminal {
  [UMConfigure setFailure:[NSException exceptionWithName:@"vendor" reason:nil userInfo:nil]];
  XCTAssertEqualObjects([self initialize:[UmengCommon new] config:[self config]], @"E_UNKNOWN");
  XCTAssertEqualObjects([self initialize:[UmengCommon new] config:@{}], @"E_UNKNOWN");
}
- (void)testValidationAndMissingCompletion {
  NSArray *cases = @[
    (id) @"not-an-object", @{@"appkey" : @"app", @"wechatAppSecret" : @"secret"},
    @{@"appkey" : @"app", @"wechatUniversalLink" : @"https://example.com"},
    @{@"appkey" : @"app", @"wechatAppId" : @"wx", @"wechatAppSecret" : @"secret"}
  ];
  for (id config in cases) {
    UmengBootstrap *b = [UmengBootstrap new];
    XCTestExpectation *done = [self expectationWithDescription:@"invalid"];
    [b initialize:config
        completion:^(NSError *error) {
          XCTAssertEqual(error.code, UmengBootstrapErrorCodeInvalidConfig);
          [done fulfill];
        }];
    [self waitForExpectations:@[ done ] timeout:2];
  }
  for (NSString *url in @[ @"https://[", @"https:/path" ]) {
    NSMutableDictionary *config = [[self config] mutableCopy];
    config[@"wechatUniversalLink"] = url;
    UmengBootstrap *b = [UmengBootstrap new];
    XCTestExpectation *done = [self expectationWithDescription:@"invalid link"];
    [b initialize:config
        completion:^(NSError *error) {
          XCTAssertEqual(error.code, UmengBootstrapErrorCodeInvalidConfig);
          [done fulfill];
        }];
    [self waitForExpectations:@[ done ] timeout:2];
  }
  UmengBootstrap *b = [UmengBootstrap new];
  [b initialize:@{@"appkey" : @"only"} completion:nil];
  XCTestExpectation *done = [self expectationWithDescription:@"null completion does not block next caller"];
  [b initialize:@{@"appkey" : @"only"}
      completion:^(NSError *error) {
        XCTAssertNil(error);
        [done fulfill];
      }];
  [self waitForExpectations:@[ done ] timeout:2];
}
- (void)testRegistryLifetime {
  UmengShareRequestRegistry *registry = [UmengShareRequestRegistry new];
  __block NSInteger settled = 0;
  NSUUID *request = [registry
      registerResolve:^(id value) {
        settled++;
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        settled++;
      }];
  XCTAssertTrue([registry resolveRequest:request result:nil]);
  XCTAssertFalse([registry isActive:request]);
  [registry invalidate];
  [registry invalidate];
  XCTAssertEqual(settled, 1);
  UmengProductionSDKAdapter *adapter = [UmengProductionSDKAdapter new];
  __block NSInteger callbacks = 0;
  @autoreleasepool {
    UmengShare *module = [[UmengShare alloc]
        initWithIsInitialized:^BOOL {
          return YES;
        }
        adapter:adapter
        mainDispatcher:^(dispatch_block_t block) {
          block();
        }];
    [module shareText:@"wechat_session"
        text:@"orphan"
        resolve:^(id value) {
          callbacks++;
        }
        reject:^(NSString *code, NSString *message, NSError *error) {
          callbacks++;
        }];
  }
  void (^late)(id, NSError *) = [UMSocialManager defaultManager].completions.lastObject;
  late(nil, nil);
  XCTAssertEqual(callbacks, 0);
}
@end
