import { unsupported } from '../internal/errors/unsupported';
import type { UmengConfiguration } from '../types';

export function initializeUmeng(
  _config: Readonly<UmengConfiguration>
): Promise<void> {
  return Promise.reject(unsupported());
}
export function isUmengInitialized(): Promise<boolean> {
  return Promise.reject(unsupported());
}
