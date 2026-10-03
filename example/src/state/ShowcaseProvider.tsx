import {
  initializeUmeng,
  isUmengInitialized,
  getShareTargets,
  share,
  useShareSheet,
  trackEvent as handOffEvent,
  bindAnalyticsUser,
  clearAnalyticsUser,
  type ShareTarget,
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

type AnalyticsMethod =
  | 'trackEvent'
  | 'bindAnalyticsUser'
  | 'clearAnalyticsUser';

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
  trackEvent: 'JS 已调用 trackEvent',
  bindAnalyticsUser: 'JS 已调用 bindAnalyticsUser',
  clearAnalyticsUser: 'JS 已调用 clearAnalyticsUser',
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
    new Error('isUmengInitialized returned false'),
    'init'
  );
}

function platformNotInstalledFeedback(): OperationFeedback {
  return classifyUmengError(
    new UmengError({
      reason: 'not_installed',
      message: 'Target is not installed',
    }),
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
  target: ShareTarget,
  draft: ShareContentDraft
): Promise<ShareResult> {
  return share(buildDirectOptions(type, target, draft));
}

export function ShowcaseProvider({
  children,
}: PropsWithChildren): ReactElement {
  const [sheetController, sheetHost] = useShareSheet();
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

  const reviewConfiguration = useCallback(async (): Promise<void> => {
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
    dispatchSetup({ type: 'reviewConfigurationStarted' });

    try {
      dispatchSetup({
        type: 'reviewConfigurationSucceeded',
        configSnapshot,
      });
      appendSafeLog(
        'setup',
        'info',
        `确认配置成功；微信${
          configSnapshot.wechat === undefined ? '未配置' : '已配置'
        }；钉钉${configSnapshot.dingtalk === undefined ? '未配置' : '已配置'}`
      );
    } catch (error) {
      const operationFeedback = classifyUmengError(
        error,
        'reviewConfiguration'
      );
      dispatchSetup({
        type: 'reviewConfigurationFailed',
        feedback: operationFeedback,
      });
      appendSafeLog(
        'setup',
        'error',
        `确认配置失败（${operationFeedback.code}）`
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
      const items = await getShareTargets();
      if (platformsRef.current.activeRefreshRequestId !== requestId) {
        return;
      }
      dispatchPlatform({ type: 'refreshSucceeded', requestId, items });
      appendSafeLog('target', 'info', '平台列表已刷新');
    } catch (error) {
      if (platformsRef.current.activeRefreshRequestId !== requestId) {
        return;
      }
      const operationFeedback = classifyUmengError(error, 'target');
      dispatchPlatform({
        type: 'refreshFailed',
        requestId,
        feedback: operationFeedback,
      });
      appendSafeLog(
        'target',
        feedbackLogLevel(operationFeedback),
        `平台列表刷新失败（${operationFeedback.code}）`
      );
    }
  }, [appendSafeLog, dispatchPlatform, nextPlatformRequestId]);

  const queryPlatform = useCallback(
    async (target: ShareTarget): Promise<PlatformQueryResult> => {
      const requestId = nextPlatformRequestId();
      dispatchPlatform({ type: 'checkStarted', requestId, target });
      try {
        const targets = await getShareTargets();
        const configured = targets.find((item) => item.target === target);
        if (!configured)
          throw new UmengError({
            reason: 'not_initialized',
            message: 'Target has not been configured',
          });
        const installed = configured.installed;
        if (platformsRef.current.latestRequestIds[target] !== requestId) {
          return { kind: 'stale' };
        }
        dispatchPlatform({
          type: 'checkSucceeded',
          requestId,
          target,
          installed,
        });
        appendSafeLog(
          'target',
          'info',
          `平台安装状态已更新：${target}=${
            installed ? 'installed' : 'not-installed'
          }`
        );
        return { kind: 'success', installed };
      } catch (error) {
        if (platformsRef.current.latestRequestIds[target] !== requestId) {
          return { kind: 'stale' };
        }
        const operationFeedback = classifyUmengError(error, 'target');
        dispatchPlatform({
          type: 'checkFailed',
          requestId,
          target,
          feedback: operationFeedback,
        });
        appendSafeLog(
          'target',
          feedbackLogLevel(operationFeedback),
          `平台检测失败（${operationFeedback.code}）`
        );
        return { kind: 'feedback', feedback: operationFeedback };
      }
    },
    [appendSafeLog, dispatchPlatform, nextPlatformRequestId]
  );

  const checkPlatform = useCallback<ShowcaseActions['checkPlatform']>(
    async (target) => {
      if (setupRef.current.phase !== 'initialized') {
        return;
      }
      await queryPlatform(target);
    },
    [queryPlatform]
  );

  const executeInitialize = useCallback(async (): Promise<void> => {
    dispatchSetup({ type: 'initializeStarted' });
    if (setupRef.current.phase !== 'initializing') {
      return;
    }

    try {
      const config = setupRef.current.configSnapshot;
      if (config === null) return;
      await initializeUmeng(config);
      const initialized = await isUmengInitialized();
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
      appendSafeLog('setup', 'info', '初始化成功；isUmengInitialized=true');
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
    async (type, target, draft) => {
      if (setupRef.current.phase !== 'initialized') {
        return;
      }

      const operationRequestId = beginOperation('direct');
      const knownPlatform = platformsRef.current.items.find(
        (item) => item.target === target
      );
      let installed: boolean;
      if (knownPlatform === undefined || knownPlatform.freshness === 'stale') {
        const queryResult = await queryPlatform(target);
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
        const result = await invokeDirectShare(type, target, draft);
        if (result.status !== 'success') {
          recordShareFeedback(
            'direct',
            operationRequestId,
            result.status === 'cancelled'
              ? {
                  tone: 'neutral',
                  code: 'cancelled',
                  message: '已取消分享',
                  restartRequired: false,
                }
              : classifyUmengError(new UmengError(result.error), 'share')
          );
          return;
        }
        const message = `success@${result.target}`;
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
        const result = await sheetController.open(
          buildSheetPayload(draft),
          buildShareSheetOptions(draft)
        );
        if (result.status !== 'success') {
          recordShareFeedback(
            'sheet',
            operationRequestId,
            result.status === 'cancelled'
              ? {
                  tone: 'neutral',
                  code: 'cancelled',
                  message: '已取消分享',
                  restartRequired: false,
                }
              : classifyUmengError(new UmengError(result.error), 'share')
          );
          return;
        }
        const message = `success@${result.target}`;
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
    [
      appendSafeLog,
      beginOperation,
      finishOperation,
      recordShareFeedback,
      sheetController,
    ]
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
            `${method} 调用失败（${operationFeedback.code}）`
          );
        }
      }
    },
    [appendSafeLog, beginOperation, finishOperation]
  );

  const trackEvent = useCallback<ShowcaseActions['trackEvent']>(
    (eventId, params) => {
      runAnalytics('trackEvent', () => {
        handOffEvent({ name: eventId, attributes: params });
      });
    },
    [runAnalytics]
  );

  const signIn = useCallback<ShowcaseActions['signIn']>(
    (userId, provider) => {
      runAnalytics('bindAnalyticsUser', () => {
        bindAnalyticsUser({ userId, provider });
      });
    },
    [runAnalytics]
  );

  const signOut = useCallback<ShowcaseActions['signOut']>(() => {
    runAnalytics('clearAnalyticsUser', () => {
      clearAnalyticsUser();
    });
  }, [runAnalytics]);

  const actions = useMemo<ShowcaseActions>(
    () => ({
      updateCredential,
      reviewConfiguration,
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
      reviewConfiguration,
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
      {sheetHost}
    </ShowcaseContext.Provider>
  );
}
