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
} from './useShowcase';

const SETUP_ROUTE: RouteId = 'setup';
const HOME_ROUTE: RouteId = 'home';

type AnalyticsMethod = 'onEvent' | 'signIn' | 'signOut';

const ANALYTICS_SUCCESS_LOG: Readonly<Record<AnalyticsMethod, string>> = {
  onEvent: 'JS 已调用 Analytics.onEvent',
  signIn: 'JS 已调用 Analytics.signIn',
  signOut: 'JS 已调用 Analytics.signOut',
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
  const [navigation, dispatchNavigation] = useReducer(navigationReducer, {
    stack: [SETUP_ROUTE],
  });
  const [feedback, setFeedback] = useState<OperationFeedback | null>(null);
  const [logs, setLogs] = useState<readonly DemoLog[]>([]);

  const dispatchSetup = useCallback((action: SetupAction): void => {
    setupRef.current = setupReducer(setupRef.current, action);
    rawDispatchSetup(action);
  }, []);

  const dispatchPlatform = useCallback((action: PlatformAction): void => {
    platformsRef.current = platformReducer(platformsRef.current, action);
    rawDispatchPlatform(action);
  }, []);

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

    setFeedback(null);
    dispatchPlatform({ type: 'refreshStarted' });
    try {
      const items = await Share.listPlatforms();
      dispatchPlatform({ type: 'refreshSucceeded', items });
      appendSafeLog('platform', 'info', '平台列表已刷新');
    } catch (error) {
      const operationFeedback = classifyUmengError(error, 'platform');
      dispatchPlatform({
        type: 'refreshFailed',
        feedback: operationFeedback,
      });
      setFeedback(operationFeedback);
      appendSafeLog(
        'platform',
        feedbackLogLevel(operationFeedback),
        `平台列表刷新失败（${operationFeedback.code}）`
      );
    }
  }, [appendSafeLog, dispatchPlatform]);

  const queryPlatform = useCallback(
    async (platform: Platform): Promise<boolean | null> => {
      setFeedback(null);
      dispatchPlatform({ type: 'checkStarted', platform });
      try {
        const installed = await Share.isInstalled(platform);
        dispatchPlatform({ type: 'checkSucceeded', platform, installed });
        appendSafeLog(
          'platform',
          'info',
          `平台安装状态已更新：${platform}=${
            installed ? 'installed' : 'not-installed'
          }`
        );
        return installed;
      } catch (error) {
        const operationFeedback = classifyUmengError(error, 'platform');
        dispatchPlatform({
          type: 'checkFailed',
          platform,
          feedback: operationFeedback,
        });
        setFeedback(operationFeedback);
        appendSafeLog(
          'platform',
          feedbackLogLevel(operationFeedback),
          `平台检测失败（${operationFeedback.code}）`
        );
        return null;
      }
    },
    [appendSafeLog, dispatchPlatform]
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
    (operationFeedback: OperationFeedback): void => {
      setFeedback(operationFeedback);
      appendSafeLog(
        'share',
        feedbackLogLevel(operationFeedback),
        `分享操作结束（${operationFeedback.code}）`
      );
    },
    [appendSafeLog]
  );

  const shareDirect = useCallback<ShowcaseActions['shareDirect']>(
    async (type, platform, draft) => {
      if (setupRef.current.phase !== 'initialized') {
        return;
      }

      const knownPlatform = platformsRef.current.items.find(
        (item) => item.platform === platform
      );
      const installed =
        knownPlatform === undefined || knownPlatform.freshness === 'stale'
          ? await queryPlatform(platform)
          : knownPlatform.installed;
      if (installed === null) {
        return;
      }
      if (!installed) {
        recordShareFeedback(platformNotInstalledFeedback());
        return;
      }

      setFeedback(null);
      try {
        const result = await invokeDirectShare(type, platform, draft);
        appendSafeLog('share', 'info', `success@${result.platform}`);
      } catch (error) {
        recordShareFeedback(classifyUmengError(error, 'share'));
      }
    },
    [appendSafeLog, queryPlatform, recordShareFeedback]
  );

  const openShareSheet = useCallback<ShowcaseActions['openShareSheet']>(
    async (draft: SheetDraft) => {
      if (setupRef.current.phase !== 'initialized') {
        return;
      }

      setFeedback(null);
      try {
        const result = await Share.openSheet(
          buildSheetPayload(draft),
          buildShareSheetOptions(draft)
        );
        appendSafeLog('share', 'info', `success@${result.platform}`);
      } catch (error) {
        recordShareFeedback(classifyUmengError(error, 'share'));
      }
    },
    [appendSafeLog, recordShareFeedback]
  );

  const runAnalytics = useCallback(
    (method: AnalyticsMethod, invoke: () => void): void => {
      if (setupRef.current.phase !== 'initialized') {
        return;
      }

      try {
        invoke();
        setFeedback(null);
        appendSafeLog('analytics', 'info', ANALYTICS_SUCCESS_LOG[method]);
      } catch (error) {
        const operationFeedback = classifyUmengError(error, 'analytics');
        setFeedback(operationFeedback);
        appendSafeLog(
          'analytics',
          feedbackLogLevel(operationFeedback),
          `Analytics.${method} 调用失败（${operationFeedback.code}）`
        );
      }
    },
    [appendSafeLog]
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
      state: { setup, navigation, platforms, feedback, logs },
      actions,
    }),
    [actions, feedback, logs, navigation, platforms, setup]
  );

  return (
    <ShowcaseContext.Provider value={value}>
      {children}
    </ShowcaseContext.Provider>
  );
}
