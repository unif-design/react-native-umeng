#import <XCTest/XCTest.h>

#import "UmengBootstrap+Testing.h"

@interface RecordingUmengSDKAdapter : NSObject <UmengSDKAdapter>

@property(nonatomic, readonly) NSArray<NSString *> *calls;
@property(nonatomic, readonly) BOOL allCallsWereOnMainThread;
@property(nonatomic) BOOL weChatResult;
@property(nonatomic) BOOL dingTalkResult;
@property(nonatomic, copy, nullable) NSString *exceptionCall;
@property(nonatomic, copy, nullable) void (^onInitialize)(void);

@end

@implementation RecordingUmengSDKAdapter {
  NSMutableArray<NSString *> *_mutableCalls;
  BOOL _allCallsWereOnMainThread;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _mutableCalls = [NSMutableArray array];
    _allCallsWereOnMainThread = YES;
    _weChatResult = YES;
    _dingTalkResult = YES;
  }
  return self;
}

- (NSArray<NSString *> *)calls {
  return [_mutableCalls copy];
}

- (BOOL)allCallsWereOnMainThread {
  return _allCallsWereOnMainThread;
}

- (void)configureWeChatUniversalLink:(NSString *)universalLink {
  [self record:@"universalLink"];
}

- (BOOL)configureWeChatWithAppId:(NSString *)appId appSecret:(NSString *)appSecret {
  [self record:@"wechat"];
  return self.weChatResult;
}

- (BOOL)configureDingTalkWithAppId:(NSString *)appId {
  [self record:@"dingtalk"];
  return self.dingTalkResult;
}

- (void)initializeWithAppkey:(NSString *)appkey channel:(NSString *)channel {
  [self record:@"initialize"];
  if (self.onInitialize != nil) {
    self.onInitialize();
  }
}

- (BOOL)handleOpenURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options {
  [self record:@"openURL"];
  return YES;
}

- (BOOL)handleUniversalLink:(NSUserActivity *)userActivity {
  [self record:@"universalLinkCallback"];
  return YES;
}

- (void)record:(NSString *)call {
  _allCallsWereOnMainThread = _allCallsWereOnMainThread && [NSThread isMainThread];
  [_mutableCalls addObject:call];
  if ([call isEqualToString:self.exceptionCall]) {
    @throw [NSException exceptionWithName:@"FakeVendorException" reason:call userInfo:nil];
  }
}

@end

@interface UmengBootstrapTests : XCTestCase
@end

@implementation UmengBootstrapTests

- (void)testConstructionAndHandlersBeforeInitializationDoNotCallVendor {
  RecordingUmengSDKAdapter *adapter = [RecordingUmengSDKAdapter new];
  UmengBootstrap *bootstrap = [[UmengBootstrap alloc] initWithAdapter:adapter];

  BOOL handledURL = [bootstrap handleOpenURL:[NSURL URLWithString:@"example://callback"] options:@{}];
  NSUserActivity *activity = [[NSUserActivity alloc] initWithActivityType:NSUserActivityTypeBrowsingWeb];
  activity.webpageURL = [NSURL URLWithString:@"https://example.com/wechat/callback"];
  BOOL handledUniversalLink = [bootstrap handleUniversalLink:activity];

  XCTAssertFalse(handledURL);
  XCTAssertFalse(handledUniversalLink);
  XCTAssertEqualObjects(adapter.calls, (@[]));
  XCTAssertFalse([bootstrap isInited]);
}

- (void)testInitializeRunsEveryVendorCallOnMainThreadInRequiredOrder {
  RecordingUmengSDKAdapter *adapter = [RecordingUmengSDKAdapter new];
  UmengBootstrap *bootstrap = [[UmengBootstrap alloc] initWithAdapter:adapter];

  NSError *error = [self initializeBootstrap:bootstrap config:[self completeConfig]];

  XCTAssertNil(error);
  XCTAssertEqualObjects(adapter.calls, (@[ @"universalLink", @"wechat", @"dingtalk", @"initialize" ]));
  XCTAssertTrue(adapter.allCallsWereOnMainThread);
  XCTAssertTrue([bootstrap isInited]);
}

- (void)testSameConfigIsIdempotentAndDifferentConfigIsRejectedWithoutVendorCalls {
  RecordingUmengSDKAdapter *adapter = [RecordingUmengSDKAdapter new];
  UmengBootstrap *bootstrap = [[UmengBootstrap alloc] initWithAdapter:adapter];
  NSDictionary *config = [self completeConfig];

  XCTAssertNil([self initializeBootstrap:bootstrap config:config]);
  XCTAssertNil([self initializeBootstrap:bootstrap config:[config copy]]);
  NSMutableDictionary *differentConfig = [config mutableCopy];
  differentConfig[@"channel"] = @"other";
  NSError *error = [self initializeBootstrap:bootstrap config:differentConfig];

  XCTAssertNotNil(error);
  XCTAssertTrue([error.localizedDescription containsString:@"cannot change"]);
  XCTAssertEqualObjects(adapter.calls, (@[ @"universalLink", @"wechat", @"dingtalk", @"initialize" ]));
}

- (void)testInvalidConfigIsRejectedBeforeAnyVendorCall {
  NSArray<NSDictionary *> *invalidConfigs = @[
    @{},
    @{@"appkey" : @" "},
    @{@"appkey" : @"app-key", @"channel" : @""},
    @{@"appkey" : @"app-key", @"dingtalkAppId" : @42},
    @{@"appkey" : @"app-key", @"wechatAppId" : @"wechat-id"},
    @{
      @"appkey" : @"app-key",
      @"wechatAppId" : @"wechat-id",
      @"wechatAppSecret" : @"wechat-secret",
      @"wechatUniversalLink" : @"http://example.com/wechat/"
    },
  ];

  for (NSDictionary *config in invalidConfigs) {
    RecordingUmengSDKAdapter *adapter = [RecordingUmengSDKAdapter new];
    UmengBootstrap *bootstrap = [[UmengBootstrap alloc] initWithAdapter:adapter];

    NSError *error = [self initializeBootstrap:bootstrap config:config];

    XCTAssertNotNil(error, @"config should be rejected: %@", config);
    XCTAssertEqualObjects(adapter.calls, (@[]));
    XCTAssertFalse([bootstrap isInited]);
  }
}

- (void)testFalseWeChatRegistrationStopsBeforeDingTalkAndInitialization {
  RecordingUmengSDKAdapter *adapter = [RecordingUmengSDKAdapter new];
  adapter.weChatResult = NO;
  UmengBootstrap *bootstrap = [[UmengBootstrap alloc] initWithAdapter:adapter];

  NSError *error = [self initializeBootstrap:bootstrap config:[self completeConfig]];

  XCTAssertNotNil(error);
  XCTAssertNil(error.userInfo[@"restartRequired"]);
  XCTAssertEqualObjects(adapter.calls, (@[ @"universalLink", @"wechat" ]));
  XCTAssertFalse([bootstrap isInited]);
}

- (void)testRetryResumesAfterSuccessfulPlatformStages {
  RecordingUmengSDKAdapter *adapter = [RecordingUmengSDKAdapter new];
  adapter.dingTalkResult = NO;
  UmengBootstrap *bootstrap = [[UmengBootstrap alloc] initWithAdapter:adapter];
  NSDictionary *config = [self completeConfig];

  NSError *firstError = [self initializeBootstrap:bootstrap config:config];
  adapter.dingTalkResult = YES;
  NSError *secondError = [self initializeBootstrap:bootstrap config:config];

  XCTAssertNotNil(firstError);
  XCTAssertNil(secondError);
  XCTAssertEqualObjects(adapter.calls, (@[ @"universalLink", @"wechat", @"dingtalk", @"dingtalk", @"initialize" ]));
  XCTAssertTrue([bootstrap isInited]);
}

- (void)testVendorExceptionBecomesStableTerminalFailureRequiringRestart {
  RecordingUmengSDKAdapter *adapter = [RecordingUmengSDKAdapter new];
  adapter.exceptionCall = @"dingtalk";
  UmengBootstrap *bootstrap = [[UmengBootstrap alloc] initWithAdapter:adapter];
  NSDictionary *config = [self completeConfig];

  NSError *firstError = [self initializeBootstrap:bootstrap config:config];
  NSError *secondError = [self initializeBootstrap:bootstrap config:config];
  NSMutableDictionary *differentConfig = [config mutableCopy];
  differentConfig[@"channel"] = @"other";
  NSError *differentConfigError = [self initializeBootstrap:bootstrap config:differentConfig];

  XCTAssertNotNil(firstError);
  XCTAssertEqualObjects(firstError.userInfo[@"restartRequired"], @YES);
  XCTAssertEqualObjects(secondError.userInfo[@"restartRequired"], @YES);
  XCTAssertEqualObjects(differentConfigError.userInfo[@"restartRequired"], @YES);
  XCTAssertEqualObjects(firstError.localizedDescription, secondError.localizedDescription);
  XCTAssertEqualObjects(adapter.calls, (@[ @"universalLink", @"wechat", @"dingtalk" ]));
  XCTAssertFalse([bootstrap isInited]);
}

- (void)testConcurrentInitializeCallsShareOneVendorAttempt {
  RecordingUmengSDKAdapter *adapter = [RecordingUmengSDKAdapter new];
  UmengBootstrap *bootstrap = [[UmengBootstrap alloc] initWithAdapter:adapter];
  NSDictionary *config = [self completeConfig];
  XCTestExpectation *first = [self expectationWithDescription:@"first"];
  XCTestExpectation *second = [self expectationWithDescription:@"second"];
  __block NSError *firstError = nil;
  __block NSError *secondError = nil;

  adapter.onInitialize = ^{
    [bootstrap initialize:config
               completion:^(NSError *_Nullable error) {
                 secondError = error;
                 [second fulfill];
               }];
  };
  [bootstrap initialize:config
             completion:^(NSError *_Nullable error) {
               firstError = error;
               [first fulfill];
             }];

  [self waitForExpectations:@[ first, second ] timeout:2];
  XCTAssertNil(firstError);
  XCTAssertNil(secondError);
  XCTAssertEqualObjects(adapter.calls, (@[ @"universalLink", @"wechat", @"dingtalk", @"initialize" ]));
}

- (void)testInitializedHandlersInvokeVendorOnMainThread {
  RecordingUmengSDKAdapter *adapter = [RecordingUmengSDKAdapter new];
  UmengBootstrap *bootstrap = [[UmengBootstrap alloc] initWithAdapter:adapter];
  XCTAssertNil([self initializeBootstrap:bootstrap config:[self completeConfig]]);
  XCTestExpectation *callback = [self expectationWithDescription:@"callback"];
  __block BOOL handledURL = NO;

  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    handledURL = [bootstrap handleOpenURL:[NSURL URLWithString:@"example://callback"] options:@{}];
    [callback fulfill];
  });

  [self waitForExpectations:@[ callback ] timeout:2];
  XCTAssertTrue(handledURL);
  XCTAssertEqualObjects(adapter.calls.lastObject, @"openURL");
  XCTAssertTrue(adapter.allCallsWereOnMainThread);
}

- (NSError *)initializeBootstrap:(UmengBootstrap *)bootstrap config:(NSDictionary *)config {
  XCTestExpectation *completion = [self expectationWithDescription:@"initialize"];
  __block NSError *capturedError = nil;
  [bootstrap initialize:config
             completion:^(NSError *_Nullable error) {
               capturedError = error;
               [completion fulfill];
             }];
  [self waitForExpectations:@[ completion ] timeout:2];
  return capturedError;
}

- (NSDictionary *)completeConfig {
  return @{
    @"appkey" : @"app-key",
    @"channel" : @"release",
    @"wechatAppId" : @"wechat-id",
    @"wechatAppSecret" : @"wechat-secret",
    @"wechatUniversalLink" : @"https://example.com/wechat/",
    @"dingtalkAppId" : @"ding-id",
  };
}

@end
