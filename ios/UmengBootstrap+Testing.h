#import "UmengBootstrap.h"
#import "UmengSDKAdapters.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * 只给 XCTest 用的注入入口。
 *
 * 生产代码一律走 `+shared`(内部固定用 `UmengProductionSDKAdapter`);测试用 fake
 * adapter 才能在不链接友盟 SDK 的情况下断言授权前零调用与精确调用顺序。
 * 本 header 是 Pod private header,不会进 public umbrella。
 */
@interface UmengBootstrap (Testing)

- (instancetype)initWithAdapter:(id<UmengSDKAdapter>)adapter;

@end

NS_ASSUME_NONNULL_END
