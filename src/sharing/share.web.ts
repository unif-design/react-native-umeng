import { unsupported } from '../internal/errors/unsupported';
import type { ShareRequest, ShareResult, ShareTargetInfo } from '../types';

export function getShareTargets(): Promise<readonly ShareTargetInfo[]> {
  return Promise.reject(unsupported());
}
export function share(_input: Readonly<ShareRequest>): Promise<ShareResult> {
  return Promise.resolve({
    status: 'failed',
    error: { reason: 'unsupported', message: unsupported().message },
  });
}
