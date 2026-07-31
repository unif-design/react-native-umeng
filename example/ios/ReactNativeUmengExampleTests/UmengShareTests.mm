#import <XCTest/XCTest.h>

#import "UmengShare.h"

typedef void (^TestShareCompletion)(NSError *_Nullable error);

@interface UmengShare (Testing)

- (instancetype)initWithIsInitialized:(BOOL (^)(void))isInitialized
                              adapter:(id)adapter
                       mainDispatcher:(void (^)(dispatch_block_t block))mainDispatcher;
- (void)invalidate;

@end

@interface RecordingShareAdapter : NSObject

@property(nonatomic, readonly) NSArray<NSDictionary *> *calls;
@property(nonatomic) BOOL installed;
@property(nonatomic) BOOL throwOnIsInstalled;
@property(nonatomic) BOOL throwOnShare;
@property(nonatomic) BOOL completeSynchronously;
@property(nonatomic, strong, nullable) NSError *completionError;
@property(nonatomic, copy, nullable) TestShareCompletion pendingCompletion;

@end

@implementation RecordingShareAdapter {
  NSMutableArray<NSDictionary *> *_mutableCalls;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _mutableCalls = [NSMutableArray array];
    _installed = YES;
  }
  return self;
}

- (NSArray<NSDictionary *> *)calls {
  return [_mutableCalls copy];
}

- (void)shareText:(NSString *)text platform:(NSString *)platform completion:(TestShareCompletion)completion {
  [self recordShare:@{
    @"method" : @"text",
    @"platform" : platform,
    @"text" : text,
  }
         completion:completion];
}

- (void)shareImage:(NSString *)image
             thumb:(NSString *)thumb
          platform:(NSString *)platform
        completion:(TestShareCompletion)completion {
  [self recordShare:@{
    @"method" : @"image",
    @"platform" : platform,
    @"image" : image,
    @"thumb" : thumb,
  }
         completion:completion];
}

- (void)shareLinkWithTitle:(NSString *)title
                       url:(NSString *)url
               description:(NSString *)description
                     thumb:(NSString *)thumb
                  platform:(NSString *)platform
                completion:(TestShareCompletion)completion {
  [self recordShare:@{
    @"method" : @"link",
    @"platform" : platform,
    @"title" : title,
    @"url" : url,
    @"description" : description,
    @"thumb" : thumb,
  }
         completion:completion];
}

- (BOOL)isInstalledForPlatform:(NSString *)platform {
  [_mutableCalls addObject:@{
    @"method" : @"isInstalled",
    @"platform" : platform,
  }];
  if (self.throwOnIsInstalled) {
    @throw [NSException exceptionWithName:@"FakeVendorException" reason:@"isInstalled" userInfo:nil];
  }
  return self.installed;
}

- (void)recordShare:(NSDictionary *)call completion:(TestShareCompletion)completion {
  [_mutableCalls addObject:call];
  if (self.throwOnShare) {
    @throw [NSException exceptionWithName:@"FakeVendorException" reason:@"share" userInfo:nil];
  }
  self.pendingCompletion = completion;
  if (self.completeSynchronously) {
    completion(self.completionError);
  }
}

@end

@interface UmengShareTests : XCTestCase
@end

@implementation UmengShareTests

- (void)testConstructionDoesNotCallVendorAdapter {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];

  __unused UmengShare *module = [self moduleWithInitialized:NO adapter:adapter];

  XCTAssertEqualObjects(adapter.calls, (@[]));
}

- (void)testAllEntrypointsRejectBeforeInitializationWithoutCallingAdapter {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];
  UmengShare *module = [self moduleWithInitialized:NO adapter:adapter];
  NSMutableArray<NSString *> *codes = [NSMutableArray array];
  NSMutableArray<NSString *> *messages = [NSMutableArray array];
  RCTPromiseResolveBlock unexpectedResolve = ^(id result) {
    XCTFail(@"unexpected resolve: %@", result);
  };
  RCTPromiseRejectBlock captureReject = ^(NSString *code, NSString *message, NSError *error) {
    [codes addObject:code];
    [messages addObject:message];
  };

  [module shareText:@"wechat_session" text:@"hello" resolve:unexpectedResolve reject:captureReject];
  [module shareImage:@"wechat_session"
               image:@"https://example.com/image.png"
               thumb:@""
             resolve:unexpectedResolve
              reject:captureReject];
  [module shareLink:@"dingtalk"
              title:@"title"
                url:@"https://example.com"
        description:@"description"
              thumb:@""
            resolve:unexpectedResolve
             reject:captureReject];
  [module isInstalled:@"wechat_session" resolve:unexpectedResolve reject:captureReject];

  XCTAssertEqualObjects(codes,
                        (@[ @"E_NOT_INITIALIZED", @"E_NOT_INITIALIZED", @"E_NOT_INITIALIZED", @"E_NOT_INITIALIZED" ]));
  XCTAssertEqualObjects(messages, (@[
                          @"Umeng must be initialized before sharing",
                          @"Umeng must be initialized before sharing",
                          @"Umeng must be initialized before sharing",
                          @"Umeng must be initialized before sharing",
                        ]));
  XCTAssertEqualObjects(adapter.calls, (@[]));
}

- (void)testUnsupportedPlatformRejectsAfterInitializationWithoutCallingAdapter {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];
  UmengShare *module = [self moduleWithInitialized:YES adapter:adapter];
  __block NSString *rejectedCode = nil;

  [module shareText:@"unknown"
      text:@"hello"
      resolve:^(id result) {
        XCTFail(@"unexpected resolve: %@", result);
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        rejectedCode = code;
      }];

  XCTAssertEqualObjects(rejectedCode, @"E_PLATFORM_NOT_SUPPORTED");
  XCTAssertEqualObjects(adapter.calls, (@[]));
}

- (void)testIsInstalledResolvesAdapterValue {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];
  adapter.installed = NO;
  UmengShare *module = [self moduleWithInitialized:YES adapter:adapter];
  __block id resolvedValue = nil;

  [module isInstalled:@"dingtalk"
      resolve:^(id result) {
        resolvedValue = result;
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        XCTFail(@"unexpected reject: %@", code);
      }];

  XCTAssertEqualObjects(resolvedValue, @NO);
  XCTAssertEqualObjects(adapter.calls, (@[ @{@"method" : @"isInstalled", @"platform" : @"dingtalk"} ]));
}

- (void)testIsInstalledSynchronousExceptionRejectsUnknown {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];
  adapter.throwOnIsInstalled = YES;
  UmengShare *module = [self moduleWithInitialized:YES adapter:adapter];
  __block NSString *rejectedCode = nil;

  [module isInstalled:@"wechat_session"
      resolve:^(id result) {
        XCTFail(@"unexpected resolve: %@", result);
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        rejectedCode = code;
      }];

  XCTAssertEqualObjects(rejectedCode, @"E_UNKNOWN");
}

- (void)testSharePayloadsForwardAndOnlySuccessResolves {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];
  adapter.completeSynchronously = YES;
  UmengShare *module = [self moduleWithInitialized:YES adapter:adapter];
  NSMutableArray *results = [NSMutableArray array];
  RCTPromiseResolveBlock captureResolve = ^(id result) {
    [results addObject:result];
  };
  RCTPromiseRejectBlock unexpectedReject = ^(NSString *code, NSString *message, NSError *error) {
    XCTFail(@"unexpected reject: %@", code);
  };

  [module shareText:@"wechat_session" text:@"hello" resolve:captureResolve reject:unexpectedReject];
  [module shareImage:@"dingtalk"
               image:@"image-data"
               thumb:@"thumb-data"
             resolve:captureResolve
              reject:unexpectedReject];
  [module shareLink:@"wechat_session"
              title:@"title"
                url:@"https://example.com"
        description:@"description"
              thumb:@"thumb"
            resolve:captureResolve
             reject:unexpectedReject];

  XCTAssertEqualObjects(adapter.calls, (@[
                          @{
                            @"method" : @"text",
                            @"platform" : @"wechat_session",
                            @"text" : @"hello",
                          },
                          @{
                            @"method" : @"image",
                            @"platform" : @"dingtalk",
                            @"image" : @"image-data",
                            @"thumb" : @"thumb-data",
                          },
                          @{
                            @"method" : @"link",
                            @"platform" : @"wechat_session",
                            @"title" : @"title",
                            @"url" : @"https://example.com",
                            @"description" : @"description",
                            @"thumb" : @"thumb",
                          },
                        ]));
  XCTAssertEqualObjects(results, (@[
                          @{@"code" : @"success", @"platform" : @"wechat_session"},
                          @{@"code" : @"success", @"platform" : @"dingtalk"},
                          @{@"code" : @"success", @"platform" : @"wechat_session"},
                        ]));
}

- (void)testShareErrorsRejectWithStableCodes {
  NSArray<NSDictionary *> *cases = @[
    @{@"vendorCode" : @2009, @"expectedCode" : @"E_USER_CANCEL"},
    @{@"vendorCode" : @2008, @"expectedCode" : @"E_PLATFORM_NOT_INSTALLED"},
    @{@"vendorCode" : @2003, @"expectedCode" : @"E_SHARE_FAILED"},
  ];

  for (NSDictionary *testCase in cases) {
    RecordingShareAdapter *adapter = [RecordingShareAdapter new];
    adapter.completeSynchronously = YES;
    adapter.completionError = [NSError errorWithDomain:@"vendor"
                                                  code:[testCase[@"vendorCode"] integerValue]
                                              userInfo:@{NSLocalizedDescriptionKey : @"vendor failed"}];
    UmengShare *module = [self moduleWithInitialized:YES adapter:adapter];
    __block NSString *rejectedCode = nil;

    [module shareText:@"wechat_session"
        text:@"hello"
        resolve:^(id result) {
          XCTFail(@"unexpected resolve: %@", result);
        }
        reject:^(NSString *code, NSString *message, NSError *error) {
          rejectedCode = code;
        }];

    XCTAssertEqualObjects(rejectedCode, testCase[@"expectedCode"]);
  }
}

- (void)testShareSynchronousExceptionRejectsShareFailed {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];
  adapter.throwOnShare = YES;
  UmengShare *module = [self moduleWithInitialized:YES adapter:adapter];
  __block NSString *rejectedCode = nil;

  [module shareText:@"wechat_session"
      text:@"hello"
      resolve:^(id result) {
        XCTFail(@"unexpected resolve: %@", result);
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        rejectedCode = code;
      }];

  XCTAssertEqualObjects(rejectedCode, @"E_SHARE_FAILED");
}

- (void)testSynchronousAndDuplicateCallbacksSettleOnce {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];
  adapter.completeSynchronously = YES;
  UmengShare *module = [self moduleWithInitialized:YES adapter:adapter];
  __block NSInteger resolveCount = 0;
  __block NSInteger rejectCount = 0;

  [module shareText:@"wechat_session"
      text:@"hello"
      resolve:^(id result) {
        resolveCount += 1;
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        rejectCount += 1;
      }];
  adapter.pendingCompletion(nil);

  XCTAssertEqual(resolveCount, 1);
  XCTAssertEqual(rejectCount, 0);
}

- (void)testInvalidateRejectsPendingAndIgnoresLateCallback {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];
  UmengShare *module = [self moduleWithInitialized:YES adapter:adapter];
  __block NSInteger resolveCount = 0;
  __block NSInteger rejectCount = 0;
  __block NSString *rejectedCode = nil;

  [module shareText:@"wechat_session"
      text:@"hello"
      resolve:^(id result) {
        resolveCount += 1;
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        rejectCount += 1;
        rejectedCode = code;
      }];
  TestShareCompletion callback = adapter.pendingCompletion;
  [module invalidate];
  callback(nil);

  XCTAssertEqual(resolveCount, 0);
  XCTAssertEqual(rejectCount, 1);
  XCTAssertEqualObjects(rejectedCode, @"E_SHARE_FAILED");
}

- (void)testInvalidateBeforeQueuedInvocationPreventsVendorCall {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];
  __block dispatch_block_t queuedBlock = nil;
  UmengShare *module = [[UmengShare alloc]
      initWithIsInitialized:^BOOL {
        return YES;
      }
      adapter:adapter
      mainDispatcher:^(dispatch_block_t block) {
        queuedBlock = [block copy];
      }];
  __block NSString *rejectedCode = nil;

  [module shareText:@"wechat_session"
      text:@"hello"
      resolve:^(id result) {
        XCTFail(@"unexpected resolve: %@", result);
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        rejectedCode = code;
      }];
  [module invalidate];
  queuedBlock();

  XCTAssertEqualObjects(rejectedCode, @"E_SHARE_FAILED");
  XCTAssertEqualObjects(adapter.calls, (@[]));
}

- (void)testNewRequestAfterInvalidateRejectsWithoutVendorCall {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];
  UmengShare *module = [self moduleWithInitialized:YES adapter:adapter];
  __block NSString *rejectedCode = nil;
  [module invalidate];

  [module shareText:@"wechat_session"
      text:@"hello"
      resolve:^(id result) {
        XCTFail(@"unexpected resolve: %@", result);
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        rejectedCode = code;
      }];

  XCTAssertEqualObjects(rejectedCode, @"E_SHARE_FAILED");
  XCTAssertEqualObjects(adapter.calls, (@[]));
}

- (void)testInvalidateTerminalTakesPrecedenceOverInitializationGate {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];
  UmengShare *module = [self moduleWithInitialized:NO adapter:adapter];
  __block NSString *rejectedCode = nil;
  [module invalidate];

  [module shareText:@"wechat_session"
      text:@"hello"
      resolve:^(id result) {
        XCTFail(@"unexpected resolve: %@", result);
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        rejectedCode = code;
      }];

  XCTAssertEqualObjects(rejectedCode, @"E_SHARE_FAILED");
  XCTAssertEqualObjects(adapter.calls, (@[]));
}

- (void)testCallbackAndInvalidateRaceSettlesExactlyOnce {
  RecordingShareAdapter *adapter = [RecordingShareAdapter new];
  UmengShare *module = [self moduleWithInitialized:YES adapter:adapter];
  NSObject *counterLock = [NSObject new];
  __block NSInteger settleCount = 0;

  [module shareText:@"wechat_session"
      text:@"hello"
      resolve:^(id result) {
        @synchronized(counterLock) {
          settleCount += 1;
        }
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        @synchronized(counterLock) {
          settleCount += 1;
        }
      }];
  TestShareCompletion callback = adapter.pendingCompletion;
  dispatch_group_t group = dispatch_group_create();
  dispatch_queue_t queue = dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0);
  dispatch_group_async(group, queue, ^{
    [module invalidate];
  });
  dispatch_group_async(group, queue, ^{
    callback(nil);
  });
  XCTAssertEqual(dispatch_group_wait(group, dispatch_time(DISPATCH_TIME_NOW, NSEC_PER_SEC)), 0);

  XCTAssertEqual(settleCount, 1);
}

- (UmengShare *)moduleWithInitialized:(BOOL)initialized adapter:(RecordingShareAdapter *)adapter {
  return [[UmengShare alloc]
      initWithIsInitialized:^BOOL {
        return initialized;
      }
      adapter:adapter
      mainDispatcher:^(dispatch_block_t block) {
        block();
      }];
}

@end
