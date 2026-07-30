import { Platform as ReactNativePlatform } from 'react-native';
import NativeUmengCommon from './NativeUmengCommon';
import { normalizeError } from './internal/errors';
import {
  areInitConfigsEqual,
  normalizeInitConfig,
  toNativeInitConfig,
  type NormalizedUmengInitConfig,
} from './internal/initConfig';
import { UmengError, type UmengInitConfig } from './types';

let configSnapshot: Readonly<NormalizedUmengInitConfig> | null = null;
let nativeStarted = false;
let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * 预初始化友盟 SDK (可在 user 同意《隐私协议》之前调,推荐 App 启动后立刻调)。
 *
 * 仅在 JS 校验并保存不可变配置快照，不调用 native。
 */
export function preInit(config: UmengInitConfig): Promise<void> {
  try {
    const normalizedConfig = normalizeInitConfig(
      config,
      ReactNativePlatform.OS === 'ios' ? 'ios' : 'android'
    );

    if (
      configSnapshot !== null &&
      areInitConfigsEqual(configSnapshot, normalizedConfig)
    ) {
      return Promise.resolve();
    }
    if (nativeStarted) {
      return Promise.reject(
        new UmengError(
          'E_INVALID_OPTIONS',
          'Common.preInit config cannot change after Common.init has started'
        )
      );
    }

    configSnapshot = normalizedConfig;
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * 正式启动数据采集 (user 同意《隐私协议》之后调)。`preInit(config)` 必须先调过。
 *
 * idempotent — 重复调只触发一次。
 */
export function init(): Promise<void> {
  if (initialized) {
    return Promise.resolve();
  }
  if (initPromise !== null) {
    return initPromise;
  }
  if (configSnapshot === null) {
    return Promise.reject(
      new UmengError(
        'E_NOT_INITIALIZED',
        'Common.preInit must be called before Common.init'
      )
    );
  }

  nativeStarted = true;
  try {
    initPromise = NativeUmengCommon.initialize(
      toNativeInitConfig(configSnapshot)
    )
      .then(() => {
        initialized = true;
      })
      .catch((error: unknown) => {
        initPromise = null;
        throw normalizeError(error, 'E_UNKNOWN', 'Failed to initialize Umeng');
      });
    return initPromise;
  } catch (error) {
    initPromise = null;
    return Promise.reject(
      normalizeError(error, 'E_UNKNOWN', 'Failed to initialize Umeng')
    );
  }
}

/** 查询 native 是否已完成 init。 */
export async function isInited(): Promise<boolean> {
  const fallbackMessage = 'Failed to query Umeng initialization state';

  try {
    const result: unknown = await NativeUmengCommon.isInited();
    if (typeof result !== 'boolean') {
      throw new UmengError('E_UNKNOWN', fallbackMessage, result);
    }
    return result;
  } catch (error) {
    throw normalizeError(error, 'E_UNKNOWN', fallbackMessage);
  }
}
