import type { UmengFailure } from '@unif/react-native-umeng';

export type OperationScope =
  | 'reviewConfiguration'
  | 'init'
  | 'target'
  | 'share'
  | 'analytics';
export interface OperationFeedback {
  tone: 'neutral' | 'warning' | 'error';
  code: UmengFailure['reason'] | 'unrecognized' | 'cancelled';
  message: string;
  restartRequired: boolean;
}
