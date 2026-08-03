import {
  Analytics,
  Common,
  Platform,
  Share,
  UmengError,
  type ShareResult,
} from '@unif/react-native-umeng';
import {
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from 'react';
import { Platform as ReactNativePlatform } from 'react-native';

import {
  buildDirectOptions,
  buildSheetPayload,
  type ShareContentDraft,
} from '../content/shareContent';
import {
  classifyUmengError,
  type OperationFeedback,
} from '../errors/classifyUmengError';
import {
  navigationReducer,
  type NavigationAction,
  type RouteId,
} from '../navigation';
import {
  appendLog,
  clearLogs as createEmptyLogs,
  type DemoLog,
  type DemoLogLevel,
  type DemoLogScope,
} from './logs';
import {
  buildShareSheetOptions,
  createInitialPlatformState,
  platformReducer,
  type DirectShareType,
  type PlatformAction,
  type SheetDraft,
} from './operations';
import {
  buildInitConfig,
  createInitialSetupState,
  setupReducer,
  type SetupAction,
  type SetupOS,
} from './setupState';
import {
  ShowcaseContext,
  type ShowcaseActions,
  type ShowcaseContextValue,
  type ShowcaseOperationResult,
  type ShowcaseResults,
  type ShowcaseResultScope,
} from './useShowcase';

const SETUP_ROUTE: RouteId = 'setup';
const HOME_ROUTE: RouteId = 'home';

type AnalyticsMethod = 'onEvent' | 'signIn' | 'signOut';

type PlatformQueryResult =
  | {
      readonly kind: 'success';
      readonly installed: boolean;
    }
  | {
      readonly kind: 'feedback';
      readonly feedback: OperationFeedback;
    }
  | {
      readonly kind: 'stale';
    };

const ANALYTICS_SUCCESS_LOG: Readonly<Record<AnalyticsMethod, string>> = {
  onEvent: 'JS 已调用 Analytics.onEvent',
  signIn: 'JS 已调用 Analytics.signIn',
  signOut: 'JS 已调用 Analytics.signOut',
};

const INITIAL_RESULTS: ShowcaseResults = {
  sheet: null,
  direct: null,
  analytics: null,
};

function runtimeOS(): SetupOS {
  return ReactNativePlatform.OS === 'ios' ? 'ios' : 'android';
}

function falseInitializationFeedback(): OperationFeedback {
  return classifyUmengError(
    new Error('Common.isInited returned false'),
    'init'
  );
}

function platformNotInstalledFeedback(): OperationFeedback {
  return classifyUmengError(
    new UmengError(
      'E_PLATFORM_NOT_INSTALLED',
      'Target platform is not installed'
    ),
    'share'
  );
}

function feedbackLogLevel(feedback: OperationFeedback): DemoLogLevel {
  switch (feedback.tone) {
    case 'neutral':
      return 'info';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
  }
}

async function invokeDirectShare(
  type: DirectShareType,
  platform: Platform,
  draft: ShareContentDraft
): Promise<ShareResult> {
  switch (type) {
    case 'text':
      return Share.shareText(buildDirectOptions('text', platform, draft));
    case 'image':
      return Share.shareImage(buildDirectOptions('image', platform, draft));
    case 'link':
      return Share.shareLink(buildDirectOptions('link', platform, draft));
  }
}

export function ShowcaseProvider({
  children,
}: PropsWithChildren): ReactElement {
  const [setup, rawDispatchSetup] = useReducer(
    setupReducer,
    undefined,
    createInitialSetupState
  );
  const setupRef = useRef(setup);
  const [platforms, rawDispatchPlatform] = useReducer(
    platformReducer,
    undefined,
    createInitialPlatformState
  );
  const platformsRef = useRef(platforms);
  const platformRequestSequenceRef = useRef(0);
  const operationRequestSequenceRef = useRef(0);
  const latestOperationRequestIdsRef = useRef<
    Partial<Record<ShowcaseResultScope, number>>
  >({});
  const [navigation, dispatchNavigation] = useReducer(navigationReducer, {
    stack: [SETUP_ROUTE],
  });
  const [results, setResults] = useState<ShowcaseResults>(INITIAL_RESULTS);
  const [logs, setLogs] = useState<readonly DemoLog[]>([]);

  const dispatchSetup = useCallback((action: SetupAction): void => {
    setupRef.current = setupReducer(setupRef.current, action);
    rawDispatchSetup(action);
  }, []);

  const dispatchPlatform = useCallback((action: PlatformAction): void => {
    platformsRef.current = platformReducer(platformsRef.current, action);
    rawDispatchPlatform(action);
  }, []);

  const nextPlatformRequestId = useCallback((): number => {
    platformRequestSequenceRef.current += 1;
    return platformRequestSequenceRef.current;
  }, []);

  const beginOperation = useCallback((scope: ShowcaseResultScope): number => {
    operationRequestSequenceRef.current += 1;
    const requestId = operationRequestSequenceRef.current;
    latestOperationRequestIdsRef.current[scope] = requestId;
    setResults((current) =>
      current[scope] === null
        ? current
        : {
            ...current,
            [scope]: null,
          }
    );
    return requestId;
  }, []);

  const finishOperation = useCallback(
    (
      scope: ShowcaseResultScope,
      requestId: number,
      result: ShowcaseOperationResult
    ): boolean => {
      if (latestOperationRequestIdsRef.current[scope] !== requestId) {
        return false;
      }
      setResults((current) => ({
        ...current,
        [scope]: result,
      }));
      return true;
    },
    []
  );

  const appendSafeLog = useCallback(
    (scope: DemoLogScope, level: DemoLogLevel, message: string): void => {
      setLogs((existing) =>
        appendLog(existing, {
          now: new Date(),
          level,
          scope,
          message,
        })
      );
    },
    []
  );

  const resetNavigation = useCallback((route: RouteId): void => {
    const action: NavigationAction = { type: 'reset', route };
    dispatchNavigation(action);
  }, []);

  const updateCredential = useCallback<ShowcaseActions['updateCredential']>(
    (field, value) => {
      dispatchSetup({ type: 'updateCredential', field, value });
    },
    [dispatchSetup]
  );

  const navigate = useCallback<ShowcaseActions['navigate']>((route) => {
    if (setupRef.current.phase !== 'initialized' || route === SETUP_ROUTE) {
      return;
    }
    dispatchNavigation({ type: 'navigate', route });
  }, []);

  const back = useCallback<ShowcaseActions['back']>(() => {
    if (setupRef.current.phase !== 'initialized') {
      return;
    }
    dispatchNavigation({ type: 'back' });
  }, []);

  const clearLogs = useCallback<ShowcaseActions['clearLogs']>(() => {
    setLogs(createEmptyLogs());
  }, []);

  const preInitialize = useCallback(async (): Promise<void> => {
    if (setupRef.current.phase !== 'editing') {
      return;
    }

    const validation = buildInitConfig(setupRef.current.draft, runtimeOS());
    if (!validation.ok) {
      dispatchSetup({
        type: 'validationFailed',
        errors: validation.errors,
      });
      appendSafeLog('setup', 'warning', '配置校验未通过');
      return;
    }

    const configSnapshot = Object.freeze({ ...validation.config });
    dispatchSetup({ type: 'preInitializeStarted' });

    try {
      await Common.preInit(configSnapshot);
      dispatchSetup({
        type: 'preInitializeSucceeded',
        configSnapshot,
      });
      appendSafeLog(
        'setup',
        'info',
        `预初始化成功；微信${
          configSnapshot.wechatAppId === undefined ? '未配置' : '已配置'
        }；钉钉${
          configSnapshot.dingtalkAppId === undefined ? '未配置' : '已配置'
        }`
      );
    } catch (error) {
      const operationFeedback = classifyUmengError(error, 'preInit');
      dispatchSetup({
        type: 'preInitializeFailed',
        feedback: operationFeedback,
      });
      appendSafeLog(
        'setup',
        'error',
        `预初始化失败（${operationFeedback.code}）`
      );
    }
  }, [appendSafeLog, dispatchSetup]);

  const setConsent = useCallback<ShowcaseActions['setConsent']>(
    (checked) => {
      dispatchSetup({ type: 'setConsent', checked });
    },
    [dispatchSetup]
  );

  const refreshPlatforms = useCallback<
    ShowcaseActions['refreshPlatforms']
  >(async () => {
    if (setupRef.current.phase !== 'initialized') {
      return;
    }

    const requestId = nextPlatformRequestId();
    dispatchPlatform({ type: 'refreshStarted', requestId });
    try {
      const items = await Share.listPlatforms();
      if (platformsRef.current.activeRefreshRequestId !== requestId) {
        return;
      }
      dispatchPlatform({ type: 'refreshSucceeded', requestId, items });
      appendSafeLog('platform', 'info', '平台列表已刷新');
    } catch (error) {
      if (platformsRef.current.activeRefreshRequestId !== requestId) {
        return;
      }
      const operationFeedback = classifyUmengError(error, 'platform');
      dispatchPlatform({
        type: 'refreshFailed',
        requestId,
        feedback: operationFeedback,
      });
      appendSafeLog(
        'platform',
        feedbackLogLevel(operationFeedback),
        `平台列表刷新失败（${operationFeedback.code}）`
      );
    }
  }, [appendSafeLog, dispatchPlatform, nextPlatformRequestId]);

  const queryPlatform = useCallback(
    async (platform: Platform): Promise<PlatformQueryResult> => {
      const requestId = nextPlatformRequestId();
      dispatchPlatform({ type: 'checkStarted', requestId, platform });
      try {
        const installed = await Share.isInstalled(platform);
        if (platformsRef.current.latestRequestIds[platform] !== requestId) {
          return { kind: 'stale' };
        }
        dispatchPlatform({
          type: 'checkSucceeded',
          requestId,
          platform,
          installed,
        });
        appendSafeLog(
          'platform',
          'info',
          `平台安装状态已更新：${platform}=${
            installed ? 'installed' : 'not-installed'
          }`
        );
        return { kind: 'success', installed };
      } catch (error) {
        if (platformsRef.current.latestRequestIds[platform] !== requestId) {
          return { kind: 'stale' };
        }
        const operationFeedback = classifyUmengError(error, 'platform');
        dispatchPlatform({
          type: 'checkFailed',
          requestId,
          platform,
          feedback: operationFeedback,
        });
        appendSafeLog(
          'platform',
          feedbackLogLevel(operationFeedback),
          `平台检测失败（${operationFeedback.code}）`
        );
        return { kind: 'feedback', feedback: operationFeedback };
      }
    },
    [appendSafeLog, dispatchPlatform, nextPlatformRequestId]
  );

  const checkPlatform = useCallback<ShowcaseActions['checkPlatform']>(
    async (platform) => {
      if (setupRef.current.phase !== 'initialized') {
        return;
      }
      await queryPlatform(platform);
    },
    [queryPlatform]
  );

  const executeInitialize = useCallback(async (): Promise<void> => {
    dispatchSetup({ type: 'initializeStarted' });
    if (setupRef.current.phase !== 'initializing') {
      return;
    }

    try {
      await Common.init();
      const initialized = await Common.isInited();
      if (!initialized) {
        const operationFeedback = falseInitializationFeedback();
        dispatchSetup({
          type: 'initializeFailed',
          feedback: operationFeedback,
        });
        appendSafeLog(
          'setup',
          'error',
          `初始化失败（${operationFeedback.code}）`
        );
        return;
      }

      dispatchSetup({ type: 'initializeSucceeded' });
      resetNavigation(HOME_ROUTE);
      appendSafeLog('setup', 'info', '初始化成功；Common.isInited=true');
      await refreshPlatforms();
    } catch (error) {
      const operationFeedback = classifyUmengError(error, 'init');
      dispatchSetup({
        type: 'initializeFailed',
        feedback: operationFeedback,
      });
      appendSafeLog(
        'setup',
        'error',
        `初始化失败（${operationFeedback.code}）`
      );
    }
  }, [appendSafeLog, dispatchSetup, refreshPlatforms, resetNavigation]);

  const initialize = useCallback(async (): Promise<void> => {
    if (
      setupRef.current.phase !== 'awaitingConsent' ||
      !setupRef.current.consent
    ) {
      return;
    }
    await executeInitialize();
  }, [executeInitialize]);

  const retryInitialize = useCallback(async (): Promise<void> => {
    if (setupRef.current.phase !== 'initFailedLocked') {
      return;
    }
    await executeInitialize();
  }, [executeInitialize]);

  const recordShareFeedback = useCallback(
    (
      scope: Extract<ShowcaseResultScope, 'sheet' | 'direct'>,
      requestId: number,
      operationFeedback: OperationFeedback
    ): void => {
      if (
        !finishOperation(scope, requestId, {
          kind: 'feedback',
          feedback: operationFeedback,
        })
      ) {
        return;
      }
      appendSafeLog(
        'share',
        feedbackLogLevel(operationFeedback),
        `分享操作结束（${operationFeedback.code}）`
      );
    },
    [appendSafeLog, finishOperation]
  );

  const shareDirect = useCallback<ShowcaseActions['shareDirect']>(
    async (type, platform, draft) => {
      if (setupRef.current.phase !== 'initialized') {
        return;
      }

      const operationRequestId = beginOperation('direct');
      const knownPlatform = platformsRef.current.items.find(
        (item) => item.platform === platform
      );
      let installed: boolean;
      if (knownPlatform === undefined || knownPlatform.freshness === 'stale') {
        const queryResult = await queryPlatform(platform);
        if (
          latestOperationRequestIdsRef.current.direct !== operationRequestId
        ) {
          return;
        }
        if (queryResult.kind === 'stale') {
          return;
        }
        if (queryResult.kind === 'feedback') {
          recordShareFeedback(
            'direct',
            operationRequestId,
            queryResult.feedback
          );
          return;
        }
        installed = queryResult.installed;
      } else {
        installed = knownPlatform.installed;
      }
      if (!installed) {
        recordShareFeedback(
          'direct',
          operationRequestId,
          platformNotInstalledFeedback()
        );
        return;
      }

      try {
        const result = await invokeDirectShare(type, platform, draft);
        const message = `success@${result.platform}`;
        if (
          finishOperation('direct', operationRequestId, {
            kind: 'success',
            message,
          })
        ) {
          appendSafeLog('share', 'info', message);
        }
      } catch (error) {
        recordShareFeedback(
          'direct',
          operationRequestId,
          classifyUmengError(error, 'share')
        );
      }
    },
    [
      appendSafeLog,
      beginOperation,
      finishOperation,
      queryPlatform,
      recordShareFeedback,
    ]
  );

  const openShareSheet = useCallback<ShowcaseActions['openShareSheet']>(
    async (draft: SheetDraft) => {
      if (setupRef.current.phase !== 'initialized') {
        return;
      }

      const operationRequestId = beginOperation('sheet');
      try {
        const result = await Share.openSheet(
          buildSheetPayload(draft),
          buildShareSheetOptions(draft)
        );
        const message = `success@${result.platform}`;
        if (
          finishOperation('sheet', operationRequestId, {
            kind: 'success',
            message,
          })
        ) {
          appendSafeLog('share', 'info', message);
        }
      } catch (error) {
        recordShareFeedback(
          'sheet',
          operationRequestId,
          classifyUmengError(error, 'share')
        );
      }
    },
    [appendSafeLog, beginOperation, finishOperation, recordShareFeedback]
  );

  const runAnalytics = useCallback(
    (method: AnalyticsMethod, invoke: () => void): void => {
      if (setupRef.current.phase !== 'initialized') {
        return;
      }

      const operationRequestId = beginOperation('analytics');
      try {
        invoke();
        const message = ANALYTICS_SUCCESS_LOG[method];
        if (
          finishOperation('analytics', operationRequestId, {
            kind: 'success',
            message,
          })
        ) {
          appendSafeLog('analytics', 'info', message);
        }
      } catch (error) {
        const operationFeedback = classifyUmengError(error, 'analytics');
        if (
          finishOperation('analytics', operationRequestId, {
            kind: 'feedback',
            feedback: operationFeedback,
          })
        ) {
          appendSafeLog(
            'analytics',
            feedbackLogLevel(operationFeedback),
            `Analytics.${method} 调用失败（${operationFeedback.code}）`
          );
        }
      }
    },
    [appendSafeLog, beginOperation, finishOperation]
  );

  const trackEvent = useCallback<ShowcaseActions['trackEvent']>(
    (eventId, params) => {
      runAnalytics('onEvent', () => {
        Analytics.onEvent(eventId, params);
      });
    },
    [runAnalytics]
  );

  const signIn = useCallback<ShowcaseActions['signIn']>(
    (userId, provider) => {
      runAnalytics('signIn', () => {
        Analytics.signIn(userId, provider);
      });
    },
    [runAnalytics]
  );

  const signOut = useCallback<ShowcaseActions['signOut']>(() => {
    runAnalytics('signOut', () => {
      Analytics.signOut();
    });
  }, [runAnalytics]);

  const actions = useMemo<ShowcaseActions>(
    () => ({
      updateCredential,
      preInitialize,
      setConsent,
      initialize,
      retryInitialize,
      navigate,
      back,
      clearLogs,
      refreshPlatforms,
      checkPlatform,
      openShareSheet,
      shareDirect,
      trackEvent,
      signIn,
      signOut,
    }),
    [
      back,
      checkPlatform,
      clearLogs,
      initialize,
      navigate,
      openShareSheet,
      preInitialize,
      refreshPlatforms,
      retryInitialize,
      setConsent,
      shareDirect,
      signIn,
      signOut,
      trackEvent,
      updateCredential,
    ]
  );
  const value = useMemo<ShowcaseContextValue>(
    () => ({
      state: { setup, navigation, platforms, results, logs },
      actions,
    }),
    [actions, logs, navigation, platforms, results, setup]
  );

  return (
    <ShowcaseContext.Provider value={value}>
      {children}
    </ShowcaseContext.Provider>
  );
}
