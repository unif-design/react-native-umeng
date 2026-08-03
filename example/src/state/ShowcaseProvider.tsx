import { Common } from '@unif/react-native-umeng';
import {
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from 'react';
import { Platform } from 'react-native';

import {
  classifyUmengError,
  type OperationFeedback,
} from '../errors/classifyUmengError';
import {
  navigationReducer,
  type NavigationAction,
  type RouteId,
} from '../navigation';
import { appendLog, type DemoLog, type DemoLogLevel } from './logs';
import {
  buildInitConfig,
  createInitialSetupState,
  setupReducer,
  type SetupAction,
  type SetupOS,
} from './setupState';
import {
  ShowcaseContext,
  type SetupActions,
  type ShowcaseContextValue,
} from './useShowcase';

const SETUP_ROUTE: RouteId = 'setup';
const HOME_ROUTE: RouteId = 'home';

function runtimeOS(): SetupOS {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

function falseInitializationFeedback(): OperationFeedback {
  return classifyUmengError(
    new Error('Common.isInited returned false'),
    'init'
  );
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
  const [navigation, dispatchNavigation] = useReducer(navigationReducer, {
    stack: [SETUP_ROUTE],
  });
  const [logs, setLogs] = useState<readonly DemoLog[]>([]);

  const dispatchSetup = useCallback((action: SetupAction): void => {
    setupRef.current = setupReducer(setupRef.current, action);
    rawDispatchSetup(action);
  }, []);

  const appendSetupLog = useCallback(
    (level: DemoLogLevel, message: string): void => {
      setLogs((existing) =>
        appendLog(existing, {
          now: new Date(),
          level,
          scope: 'setup',
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

  const updateCredential = useCallback<SetupActions['updateCredential']>(
    (field, value) => {
      dispatchSetup({ type: 'updateCredential', field, value });
    },
    [dispatchSetup]
  );

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
      appendSetupLog('warning', '配置校验未通过');
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
      appendSetupLog(
        'info',
        `预初始化成功；微信${
          configSnapshot.wechatAppId === undefined ? '未配置' : '已配置'
        }；钉钉${
          configSnapshot.dingtalkAppId === undefined ? '未配置' : '已配置'
        }`
      );
    } catch (error) {
      const feedback = classifyUmengError(error, 'preInit');
      dispatchSetup({ type: 'preInitializeFailed', feedback });
      appendSetupLog('error', `预初始化失败（${feedback.code}）`);
    }
  }, [appendSetupLog, dispatchSetup]);

  const setConsent = useCallback<SetupActions['setConsent']>(
    (checked) => {
      dispatchSetup({ type: 'setConsent', checked });
    },
    [dispatchSetup]
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
        const feedback = falseInitializationFeedback();
        dispatchSetup({ type: 'initializeFailed', feedback });
        appendSetupLog('error', `初始化失败（${feedback.code}）`);
        return;
      }

      dispatchSetup({ type: 'initializeSucceeded' });
      resetNavigation(HOME_ROUTE);
      appendSetupLog('info', '初始化成功；Common.isInited=true');
    } catch (error) {
      const feedback = classifyUmengError(error, 'init');
      dispatchSetup({ type: 'initializeFailed', feedback });
      appendSetupLog('error', `初始化失败（${feedback.code}）`);
    }
  }, [appendSetupLog, dispatchSetup, resetNavigation]);

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

  const actions = useMemo<SetupActions>(
    () => ({
      updateCredential,
      preInitialize,
      setConsent,
      initialize,
      retryInitialize,
    }),
    [initialize, preInitialize, retryInitialize, setConsent, updateCredential]
  );
  const value = useMemo<ShowcaseContextValue>(
    () => ({
      state: { setup, navigation, logs },
      actions,
    }),
    [actions, logs, navigation, setup]
  );

  return (
    <ShowcaseContext.Provider value={value}>
      {children}
    </ShowcaseContext.Provider>
  );
}
