#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * 每个 native Share Promise 的线程安全 settle guard。
 *
 * registry 从不持锁执行 Promise block。`invalidate` 原子进入 terminal 后会
 * reject 当前全部 request；后续注册也立即 reject。
 */
@interface UmengShareRequestRegistry : NSObject

- (nullable NSUUID *)registerResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (BOOL)isActive:(NSUUID *)requestId;
- (BOOL)resolveRequest:(NSUUID *)requestId result:(id)result;
- (BOOL)rejectRequest:(NSUUID *)requestId
                 code:(NSString *)code
              message:(NSString *)message
                error:(nullable NSError *)error;
- (void)invalidate;

@end

NS_ASSUME_NONNULL_END
