import NativeUmengCommon from './NativeUmengCommon';

let initPromise: Promise<void> | null = null;

/** 启动友盟数据采集（用户同意《隐私协议》后调）。
 *  idempotent — 重复调只触发一次原生 init。失败后允许重试（清缓存）。 */
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
  initPromise = null;
}
