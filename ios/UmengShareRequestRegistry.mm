#import "UmengShareRequestRegistry.h"

static NSString *const UmengShareInvalidatedCode = @"E_SHARE_FAILED";
static NSString *const UmengShareInvalidatedMessage = @"Share request was invalidated";

@interface UmengPendingShareRequest : NSObject

@property(nonatomic, copy) RCTPromiseResolveBlock resolve;
@property(nonatomic, copy) RCTPromiseRejectBlock reject;

@end

@implementation UmengPendingShareRequest
@end

@interface UmengShareRequestRegistry ()

- (nullable UmengPendingShareRequest *)takeRequest:(NSUUID *)requestId;

@end

@implementation UmengShareRequestRegistry {
  NSLock *_lock;
  NSMutableDictionary<NSUUID *, UmengPendingShareRequest *> *_requests;
  BOOL _terminal;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _lock = [NSLock new];
    _requests = [NSMutableDictionary dictionary];
  }
  return self;
}

- (NSUUID *)registerResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  NSUUID *requestId = [NSUUID UUID];
  UmengPendingShareRequest *request = [UmengPendingShareRequest new];
  request.resolve = resolve;
  request.reject = reject;

  [_lock lock];
  BOOL terminal = _terminal;
  if (!terminal) {
    _requests[requestId] = request;
  }
  [_lock unlock];

  if (terminal) {
    reject(UmengShareInvalidatedCode, UmengShareInvalidatedMessage, nil);
    return nil;
  }
  return requestId;
}

- (BOOL)isActive:(NSUUID *)requestId {
  [_lock lock];
  BOOL active = !_terminal && _requests[requestId] != nil;
  [_lock unlock];
  return active;
}

- (BOOL)resolveRequest:(NSUUID *)requestId result:(id)result {
  UmengPendingShareRequest *request = [self takeRequest:requestId];
  if (request == nil) {
    return NO;
  }
  request.resolve(result);
  return YES;
}

- (BOOL)rejectRequest:(NSUUID *)requestId code:(NSString *)code message:(NSString *)message error:(NSError *)error {
  UmengPendingShareRequest *request = [self takeRequest:requestId];
  if (request == nil) {
    return NO;
  }
  request.reject(code, message, error);
  return YES;
}

- (void)invalidate {
  [_lock lock];
  if (_terminal) {
    [_lock unlock];
    return;
  }
  _terminal = YES;
  NSArray<UmengPendingShareRequest *> *requests = _requests.allValues;
  [_requests removeAllObjects];
  [_lock unlock];

  for (UmengPendingShareRequest *request in requests) {
    request.reject(UmengShareInvalidatedCode, UmengShareInvalidatedMessage, nil);
  }
}

- (UmengPendingShareRequest *)takeRequest:(NSUUID *)requestId {
  [_lock lock];
  UmengPendingShareRequest *request = _requests[requestId];
  if (request != nil) {
    [_requests removeObjectForKey:requestId];
  }
  [_lock unlock];
  return request;
}

@end
