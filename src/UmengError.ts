import type { UmengFailure } from './types';

export class UmengError extends Error implements UmengFailure {
  readonly reason: UmengFailure['reason'];
  readonly sourceCode?: string;
  constructor(error: Readonly<UmengFailure>) {
    super(error.message);
    this.name = 'UmengError';
    this.reason = error.reason;
    this.sourceCode = error.sourceCode;
  }
}
