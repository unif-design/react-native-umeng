import { Platform } from 'react-native';
import NativeUmengCommon from './NativeUmengCommon';
import { normalizeError, unavailable } from './internal/errors';
import {
  areInitConfigsEqual,
  normalizeInitConfig,
  toNativeInitConfig,
  type NormalizedUmengInitConfig,
} from './internal/initConfig';
import { UmengError } from './UmengError';
import type { UmengConfiguration } from './types';

let configSnapshot: Readonly<NormalizedUmengInitConfig> | null = null;
let initPromise: Promise<void> | null = null;

/** Call only after the application has obtained consent. Native owns SDK readiness. */
export function initializeUmeng(
  config: Readonly<UmengConfiguration>
): Promise<void> {
  try {
    if (!NativeUmengCommon) throw unavailable();
    const snapshot = normalizeInitConfig(
      config,
      Platform.OS === 'ios' ? 'ios' : 'android'
    );
    if (
      configSnapshot !== null &&
      !areInitConfigsEqual(configSnapshot, snapshot)
    ) {
      throw new UmengError({
        reason: 'configuration_locked',
        message:
          'Umeng configuration cannot change after initialization starts',
      });
    }
    if (initPromise !== null) return initPromise;
    configSnapshot = snapshot;
    initPromise = NativeUmengCommon.initialize(
      toNativeInitConfig(snapshot)
    ).catch((error: unknown) => {
      initPromise = null;
      throw normalizeError(error, 'sdk_failed', 'Failed to initialize Umeng');
    });
    return initPromise;
  } catch (error) {
    return Promise.reject(
      normalizeError(error, 'sdk_failed', 'Failed to initialize Umeng')
    );
  }
}

export async function isUmengInitialized(): Promise<boolean> {
  try {
    if (!NativeUmengCommon) throw unavailable();
    const result: unknown = await NativeUmengCommon.isInited();
    if (typeof result !== 'boolean')
      throw new UmengError({
        reason: 'invalid_response',
        message: 'Native returned invalid Umeng readiness',
      });
    return result;
  } catch (error) {
    throw normalizeError(
      error,
      'sdk_failed',
      'Failed to query Umeng readiness'
    );
  }
}
