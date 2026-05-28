import NativeUmengCommon from './NativeUmengCommon';
import { UmengError, type UmengInitConfig } from './types';

let preInitPromise: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;

/**
 * 预初始化友盟 SDK (可在 user 同意《隐私协议》之前调,推荐 App 启动后立刻调)。
 *
 * 行为:存 config + 注册微信/钉钉平台,**不上报数据**。详见 NativeUmengCommon.ts。
 *
 * idempotent — 重复调只触发一次。
 */
export function preInit(config: UmengInitConfig): Promise<void> {
  if (!config?.appkey) {
    return Promise.reject(
      new UmengError(
        'E_INVALID_OPTIONS',
        '`appkey` is required for Common.preInit'
      )
    );
  }
  if (preInitPromise === null) {
    preInitPromise = NativeUmengCommon.preInit(
      config as unknown as object
    ).catch((err) => {
      preInitPromise = null;
      throw err;
    });
  }
  return preInitPromise;
}

/**
 * 正式启动数据采集 (user 同意《隐私协议》之后调)。`preInit(config)` 必须先调过。
 *
 * idempotent — 重复调只触发一次。
 */
export function init(): Promise<void> {
  if (initPromise === null) {
    initPromise = NativeUmengCommon.init().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/** 查询是否已完成 init。 */
export function isInited(): Promise<boolean> {
  return NativeUmengCommon.isInited();
}

/** @internal 仅给 jest 用 */
export function __resetForTests(): void {
  preInitPromise = null;
  initPromise = null;
}
