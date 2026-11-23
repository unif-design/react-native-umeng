import { UmengError } from '../../UmengError';

export function unsupported(): UmengError {
  return new UmengError({
    reason: 'unsupported',
    message: 'Umeng is available only on iOS and Android',
  });
}
