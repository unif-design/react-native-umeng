#import "UmengBootstrap.h"

#import "UmengBootstrap+Testing.h"

NSString *const UmengBootstrapErrorDomain = @"com.unif.reactnativeumeng.bootstrap";
NSString *const UmengBootstrapRestartRequiredKey = @"restartRequired";

/// 友盟 iOS 文档给的默认渠道名。JS 侧 config 省略 channel 时用它。
static NSString *const UmengDefaultChannel = @"App Store";

/**
 * 已提交的初始化进度。
 *
 * 记录"已经成功跑完"的阶段,失败重试才能从断点继续 —— 平台注册在友盟内部是
 * 覆盖写 dict,重复调用虽然无害,但重复调用微信注册会重复触发 WXApi 注册,
 * 没有必要,也让"哪一步失败"的诊断变模糊。
 */
typedef NS_ENUM(NSInteger, UmengBootstrapStage) {
  UmengBootstrapStageNotStarted = 0,
  UmengBootstrapStageWeChatConfigured,
  UmengBootstrapStageDingTalkConfigured,
  UmengBootstrapStageInitialized,
};

static NSError *UmengBootstrapError(UmengBootstrapErrorCode code, NSString *message, BOOL restartRequired) {
  NSMutableDictionary *userInfo = [NSMutableDictionary dictionaryWithObject:message forKey:NSLocalizedDescriptionKey];
  if (restartRequired) {
    userInfo[UmengBootstrapRestartRequiredKey] = @YES;
  }
  return [NSError errorWithDomain:UmengBootstrapErrorDomain code:code userInfo:userInfo];
}

static NSString *_Nullable UmengNormalizedString(id _Nullable value) {
  if (![value isKindOfClass:[NSString class]]) {
    return nil;
  }
  NSString *trimmed =
      [(NSString *)value stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  return trimmed.length > 0 ? trimmed : nil;
}

static BOOL UmengIsAbsoluteHTTPSURL(NSString *link) {
  NSURLComponents *components = [NSURLComponents componentsWithString:link];
  return components != nil && [components.scheme.lowercaseString isEqualToString:@"https"] &&
         components.host.length > 0;
}

/**
 * 把 JS 传来的 config 规范化成只含 NSString 的固定字段字典。
 *
 * JS 侧 `normalizeInitConfig` 已经校验过一遍,这里仍然完整复校:凭据要跨 native
 * 边界并直接喂给友盟,不能假设调用方一定是本仓的 JS。
 * 校验全部发生在第一次 vendor 调用之前 —— 非法 config 必须零副作用地失败。
 */
static NSDictionary<NSString *, NSString *> *_Nullable UmengNormalizeConfig(NSDictionary *config, NSError **error) {
  if (![config isKindOfClass:[NSDictionary class]]) {
    *error = UmengBootstrapError(UmengBootstrapErrorCodeInvalidConfig, @"`config` must be an object", NO);
    return nil;
  }

  NSString *appkey = UmengNormalizedString(config[@"appkey"]);
  if (appkey == nil) {
    *error = UmengBootstrapError(UmengBootstrapErrorCodeInvalidConfig, @"`appkey` is required", NO);
    return nil;
  }

  NSMutableDictionary<NSString *, NSString *> *normalized = [NSMutableDictionary dictionaryWithCapacity:6];
  normalized[@"appkey"] = appkey;

  for (NSString *field in
       @[ @"channel", @"wechatAppId", @"wechatAppSecret", @"wechatUniversalLink", @"dingtalkAppId" ]) {
    id rawValue = config[field];
    if (rawValue == nil) {
      continue;
    }
    NSString *value = UmengNormalizedString(rawValue);
    if (value == nil) {
      *error = UmengBootstrapError(UmengBootstrapErrorCodeInvalidConfig,
                                   [NSString stringWithFormat:@"`%@` must be a non-empty string", field], NO);
      return nil;
    }
    normalized[field] = value;
  }

  BOOL hasAnyWeChatField = normalized[@"wechatAppId"] != nil || normalized[@"wechatAppSecret"] != nil ||
                           normalized[@"wechatUniversalLink"] != nil;
  if (hasAnyWeChatField) {
    if (normalized[@"wechatAppId"] == nil || normalized[@"wechatAppSecret"] == nil ||
        normalized[@"wechatUniversalLink"] == nil) {
      *error = UmengBootstrapError(
          UmengBootstrapErrorCodeInvalidConfig,
          @"`wechatAppId`, `wechatAppSecret` and `wechatUniversalLink` must be provided together on iOS", NO);
      return nil;
    }
    if (!UmengIsAbsoluteHTTPSURL(normalized[@"wechatUniversalLink"])) {
      *error = UmengBootstrapError(UmengBootstrapErrorCodeInvalidConfig,
                                   @"`wechatUniversalLink` must be an absolute HTTPS URL with a host", NO);
      return nil;
    }
  }

  return [normalized copy];
}

/**
 * 在主线程按固定顺序跑剩余 vendor 阶段。
 *
 * 写成自由函数而不是方法:它只依赖入参快照,不读写状态机字段,天然不会在主线程
 * 上碰 state queue 拥有的数据。
 *
 * `reachedStage` 回填"已确认成功"的阶段;返回 NO 时 `error` 必被赋值,
 * `terminal` 表示副作用不可判定(vendor 抛异常),此后只能重启进程。
 */
static BOOL UmengRunVendorStages(id<UmengSDKAdapter> adapter, NSDictionary<NSString *, NSString *> *config,
                                 UmengBootstrapStage fromStage, UmengBootstrapStage *reachedStage, BOOL *terminal,
                                 NSError **error) {
  UmengBootstrapStage stage = fromStage;
  *terminal = NO;

  @try {
    if (stage < UmengBootstrapStageWeChatConfigured) {
      NSString *wechatAppId = config[@"wechatAppId"];
      if (wechatAppId != nil) {
        // Universal Link 必须先于 setPlaform 写入,否则微信注册拿不到 UL。
        [adapter configureWeChatUniversalLink:config[@"wechatUniversalLink"]];
        if (![adapter configureWeChatWithAppId:wechatAppId appSecret:config[@"wechatAppSecret"]]) {
          *reachedStage = stage;
          *error = UmengBootstrapError(UmengBootstrapErrorCodePlatformRegistrationFailed,
                                       @"Umeng rejected the WeChat platform registration", NO);
          return NO;
        }
      }
      stage = UmengBootstrapStageWeChatConfigured;
    }

    if (stage < UmengBootstrapStageDingTalkConfigured) {
      NSString *dingtalkAppId = config[@"dingtalkAppId"];
      if (dingtalkAppId != nil) {
        if (![adapter configureDingTalkWithAppId:dingtalkAppId]) {
          *reachedStage = stage;
          *error = UmengBootstrapError(UmengBootstrapErrorCodePlatformRegistrationFailed,
                                       @"Umeng rejected the DingTalk platform registration", NO);
          return NO;
        }
      }
      stage = UmengBootstrapStageDingTalkConfigured;
    }

    if (stage < UmengBootstrapStageInitialized) {
      [adapter initializeWithAppkey:config[@"appkey"] channel:config[@"channel"] ?: UmengDefaultChannel];
      stage = UmengBootstrapStageInitialized;
    }
  } @catch (NSException *exception) {
    // vendor 抛异常时无法判断它改了多少全局状态,重试可能叠加副作用 ——
    // 只能钉死成 terminal,要求宿主重启进程。
    *reachedStage = stage;
    *terminal = YES;
    *error = UmengBootstrapError(UmengBootstrapErrorCodeTerminalFailure,
                                 [NSString stringWithFormat:@"Umeng initialization failed irrecoverably: %@",
                                                            exception.reason ?: exception.name],
                                 YES);
    return NO;
  }

  *reachedStage = stage;
  return YES;
}

static BOOL UmengRunLifecycleHandlerSafely(BOOL (^block)(void)) {
  @try {
    return block();
  } @catch (NSException *exception) {
    // UIApplication / UIScene lifecycle 边界不能被第三方 SDK 异常击穿。
    NSLog(@"[ReactNativeUmeng] Failed to forward lifecycle callback (%@): %@", exception.name, exception.reason);
    return NO;
  }
}

/// 在主线程同步取一个 BOOL。已在主线程时直接执行 —— 否则 dispatch_sync 自死锁。
static BOOL UmengRunBoolOnMainThread(BOOL (^block)(void)) {
  if ([NSThread isMainThread]) {
    return UmengRunLifecycleHandlerSafely(block);
  }
  __block BOOL result = NO;
  dispatch_sync(dispatch_get_main_queue(), ^{
    result = UmengRunLifecycleHandlerSafely(block);
  });
  return result;
}

@implementation UmengBootstrap {
  /// 构造后不再改写,可从任意线程读。
  id<UmengSDKAdapter> _adapter;
  /// 下面所有字段只允许在 _stateQueue 上读写。
  dispatch_queue_t _stateQueue;
  UmengBootstrapStage _stage;
  NSDictionary<NSString *, NSString *> *_Nullable _config;
  NSError *_Nullable _terminalError;
  BOOL _attemptInFlight;
  NSMutableArray<void (^)(NSError *_Nullable)> *_waiters;
}

+ (instancetype)shared {
  static UmengBootstrap *shared;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    shared = [[UmengBootstrap alloc] init];
  });
  return shared;
}

- (instancetype)init {
  // 生产 adapter 的构造不触碰任何 vendor API,授权前持有它是安全的。
  return [self initWithAdapter:[UmengProductionSDKAdapter new]];
}

- (instancetype)initWithAdapter:(id<UmengSDKAdapter>)adapter {
  if (self = [super init]) {
    _adapter = adapter;
    _stateQueue = dispatch_queue_create("com.unif.reactnativeumeng.bootstrap.state", DISPATCH_QUEUE_SERIAL);
    _stage = UmengBootstrapStageNotStarted;
    _waiters = [NSMutableArray array];
  }
  return self;
}

// MARK: - public API

- (void)initialize:(NSDictionary *)config completion:(void (^)(NSError *_Nullable))completion {
  void (^resolvedCompletion)(NSError *_Nullable) = completion ?: ^(NSError *_Nullable error) {
  };
  dispatch_async(_stateQueue, ^{
    [self enqueueInitializeWithConfig:config completion:resolvedCompletion];
  });
}

- (BOOL)isInited {
  __block BOOL inited = NO;
  // state queue 永远不会同步等主线程,所以这里从主线程 dispatch_sync 也不会死锁。
  dispatch_sync(_stateQueue, ^{
    inited = self->_stage == UmengBootstrapStageInitialized;
  });
  return inited;
}

- (BOOL)handleOpenURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options {
  if (![self isInited]) {
    return NO;
  }
  id<UmengSDKAdapter> adapter = _adapter;
  return UmengRunBoolOnMainThread(^BOOL {
    return [adapter handleOpenURL:url options:options];
  });
}

- (BOOL)handleUniversalLink:(NSUserActivity *)userActivity {
  if (![self isInited]) {
    return NO;
  }
  id<UmengSDKAdapter> adapter = _adapter;
  return UmengRunBoolOnMainThread(^BOOL {
    return [adapter handleUniversalLink:userActivity];
  });
}

// MARK: - state machine (all on _stateQueue)

- (void)enqueueInitializeWithConfig:(NSDictionary *)config completion:(void (^)(NSError *_Nullable))completion {
  // terminal 判定必须排在 config 校验和比较之前:副作用已不可判定,换 config
  // 也救不回来,任何请求都要拿到同一个稳定错误。
  if (_terminalError != nil) {
    [self finishOnMainThread:completion error:_terminalError];
    return;
  }

  NSError *validationError = nil;
  NSDictionary<NSString *, NSString *> *normalized = UmengNormalizeConfig(config, &validationError);
  if (normalized == nil) {
    [self finishOnMainThread:completion error:validationError];
    return;
  }

  if (_config != nil && ![_config isEqualToDictionary:normalized]) {
    [self finishOnMainThread:completion
                       error:UmengBootstrapError(UmengBootstrapErrorCodeConfigChanged,
                                                 @"Umeng configuration cannot change after initialization has started",
                                                 NO)];
    return;
  }

  if (_stage == UmengBootstrapStageInitialized) {
    [self finishOnMainThread:completion error:nil];
    return;
  }

  _config = normalized;
  [_waiters addObject:completion];
  if (_attemptInFlight) {
    // 已有一次 vendor 尝试在飞,复用它的结果 —— 不重复调用友盟。
    return;
  }
  _attemptInFlight = YES;
  [self startVendorAttempt];
}

- (void)startVendorAttempt {
  UmengBootstrapStage stage = _stage;
  NSDictionary<NSString *, NSString *> *config = _config;
  id<UmengSDKAdapter> adapter = _adapter;

  // 友盟要求全部初始化调用在主线程;这里用 async 而不是 sync,state queue 因此
  // 永远不会阻塞在主线程上(否则 isInited 从主线程同步读就会死锁)。
  dispatch_async(dispatch_get_main_queue(), ^{
    UmengBootstrapStage reachedStage = stage;
    BOOL terminal = NO;
    NSError *error = nil;
    UmengRunVendorStages(adapter, config, stage, &reachedStage, &terminal, &error);

    dispatch_async(self->_stateQueue, ^{
      [self commitAttemptWithReachedStage:reachedStage terminal:terminal error:error];
    });
  });
}

- (void)commitAttemptWithReachedStage:(UmengBootstrapStage)reachedStage
                             terminal:(BOOL)terminal
                                error:(NSError *_Nullable)error {
  _stage = reachedStage;
  if (terminal && _terminalError == nil) {
    _terminalError = error;
  }
  _attemptInFlight = NO;

  NSArray<void (^)(NSError *_Nullable)> *waiters = [_waiters copy];
  [_waiters removeAllObjects];
  for (void (^waiter)(NSError *_Nullable) in waiters) {
    [self finishOnMainThread:waiter error:error];
  }
}

/// completion 统一回到主线程,调用方不会在 state queue 上跑自己的逻辑并把它堵死。
- (void)finishOnMainThread:(void (^)(NSError *_Nullable))completion error:(NSError *_Nullable)error {
  dispatch_async(dispatch_get_main_queue(), ^{
    completion(error);
  });
}

@end
