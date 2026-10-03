import { UmengError } from '@unif/react-native-umeng';
import type { OperationScope, OperationFeedback } from './types';
import { FAILURE_MESSAGES } from './constants';
export type { OperationScope, OperationFeedback } from './types';

export function classifyUmengError(
  error: unknown,
  scope: OperationScope
): OperationFeedback {
  const reason = error instanceof UmengError ? error.reason : 'unrecognized';
  return {
    tone:
      reason === 'invalid_input' || reason === 'not_installed'
        ? 'warning'
        : 'error',
    code: reason,
    message:
      reason === 'unrecognized'
        ? '发生未识别错误，请稍后重试'
        : FAILURE_MESSAGES[reason],
    restartRequired: reason === 'configuration_locked' || scope === 'init',
  };
}
