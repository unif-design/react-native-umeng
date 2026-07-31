#import <XCTest/XCTest.h>

#import <ReactCommon/RCTTurboModule.h>

#import "RCTModuleProviders.h"

/**
 * Codegen 只在 package.json#codegenConfig.ios.modulesProvider 有映射时才把模块写进
 * RCTModuleProviders。这里直接查运行时 provider(而不是 NSClassFromString 猜类名),
 * 生成内容和实际注册两层同时被覆盖。
 */
@interface TurboModuleRegistrationTests : XCTestCase
@end

@implementation TurboModuleRegistrationTests

- (void)testGeneratedProvidersResolveAllUmengModules {
  NSDictionary *providers = [RCTModuleProviders moduleProviders];

  for (NSString *moduleName in @[ @"UmengCommon", @"UmengAnalytics", @"UmengShare" ]) {
    id provider = providers[moduleName];
    XCTAssertNotNil(provider, @"module provider missing: %@", moduleName);
    XCTAssertTrue([provider respondsToSelector:@selector(getTurboModule:)],
                  @"module provider does not conform to RCTModuleProvider: %@", moduleName);
  }
}

@end
