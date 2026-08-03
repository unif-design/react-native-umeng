#import <XCTest/XCTest.h>

#import "UmengAnalytics.h"

@interface UmengAnalytics (Testing)

- (instancetype)initWithIsInitialized:(BOOL (^)(void))isInitialized adapter:(id)adapter;

@end

@interface RecordingAnalyticsAdapter : NSObject

@property(nonatomic, readonly) NSArray<NSDictionary *> *calls;

@end

@implementation RecordingAnalyticsAdapter {
  NSMutableArray<NSDictionary *> *_mutableCalls;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _mutableCalls = [NSMutableArray array];
  }
  return self;
}

- (NSArray<NSDictionary *> *)calls {
  return [_mutableCalls copy];
}

- (void)trackEvent:(NSString *)eventId attributes:(NSDictionary<NSString *, NSString *> *)attributes {
  [_mutableCalls addObject:@{
    @"method" : @"event",
    @"eventId" : eventId,
    @"attributes" : attributes ?: [NSNull null],
  }];
}

- (void)signInWithUserId:(NSString *)userId provider:(NSString *)provider {
  [_mutableCalls addObject:@{
    @"method" : @"signIn",
    @"userId" : userId,
    @"provider" : provider ?: [NSNull null],
  }];
}

- (void)signOut {
  [_mutableCalls addObject:@{@"method" : @"signOut"}];
}

@end

@interface UmengAnalyticsTests : XCTestCase
@end

@implementation UmengAnalyticsTests

- (void)testConstructionDoesNotCallVendorAdapter {
  RecordingAnalyticsAdapter *adapter = [RecordingAnalyticsAdapter new];

  __unused UmengAnalytics *module = [[UmengAnalytics alloc]
      initWithIsInitialized:^BOOL {
        return NO;
      }
                    adapter:adapter];

  XCTAssertEqualObjects(adapter.calls, (@[]));
}

- (void)testAllEntrypointsAreNoOpsBeforeInitialization {
  RecordingAnalyticsAdapter *adapter = [RecordingAnalyticsAdapter new];
  UmengAnalytics *module = [[UmengAnalytics alloc]
      initWithIsInitialized:^BOOL {
        return NO;
      }
                    adapter:adapter];

  [module onEvent:@"purchase" params:@{@"amount" : @42}];
  [module signIn:@"user-1" provider:@"wechat"];
  [module signOut];

  XCTAssertEqualObjects(adapter.calls, (@[]));
}

- (void)testInitializedEntrypointsForwardNormalizedValues {
  RecordingAnalyticsAdapter *adapter = [RecordingAnalyticsAdapter new];
  UmengAnalytics *module = [[UmengAnalytics alloc]
      initWithIsInitialized:^BOOL {
        return YES;
      }
                    adapter:adapter];

  [module onEvent:@"purchase" params:@{@"amount" : @42, @"currency" : @"CNY"}];
  [module onEvent:@"empty" params:@{}];
  [module signIn:@"user-1" provider:@"wechat"];
  [module signIn:@"user-2" provider:@""];
  [module signOut];

  XCTAssertEqualObjects(adapter.calls, (@[
                          @{
                            @"method" : @"event",
                            @"eventId" : @"purchase",
                            @"attributes" : @{@"amount" : @"42", @"currency" : @"CNY"},
                          },
                          @{
                            @"method" : @"event",
                            @"eventId" : @"empty",
                            @"attributes" : [NSNull null],
                          },
                          @{
                            @"method" : @"signIn",
                            @"userId" : @"user-1",
                            @"provider" : @"wechat",
                          },
                          @{
                            @"method" : @"signIn",
                            @"userId" : @"user-2",
                            @"provider" : [NSNull null],
                          },
                          @{@"method" : @"signOut"},
                        ]));
}

@end
