#import <XCTest/XCTest.h>
int main(int argc, const char **argv) {
  @autoreleasepool {
    XCTestSuite *suite = [XCTestSuite testSuiteWithName:@"Owned Umeng native behavior"];
    Class runtime = NSClassFromString(@"UmengNativeRuntimeTests");
    if (argc > 1) {
      [suite addTest:[runtime testCaseWithSelector:NSSelectorFromString(@"testTerminal")]];
    } else {
      for (NSString *name in @[ @"UmengAnalyticsTests", @"UmengBootstrapTests", @"UmengShareTests" ]) {
        Class type = NSClassFromString(name);
        [suite addTest:[type defaultTestSuite]];
      }
      for (NSString *name in @[ @"testProduction", @"testValidationAndMissingCompletion", @"testRegistryLifetime" ])
        [suite addTest:[runtime testCaseWithSelector:NSSelectorFromString(name)]];
    }
    [suite runTest];
    return suite.testRun.totalFailureCount ? 1 : 0;
  }
}
