import { UmengError } from '@unif/react-native-umeng';
import { classifyUmengError } from '../errors/classifyUmengError';
it('exposes safe reason-based feedback without raw SDK details', () => {
  expect(
    classifyUmengError(
      new UmengError({
        reason: 'configuration_locked',
        message: 'private-config',
      }),
      'init'
    )
  ).toEqual({
    tone: 'error',
    code: 'configuration_locked',
    message: '初始化已开始，修改配置需要重启 App',
    restartRequired: true,
  });
  expect(classifyUmengError(new Error('secret'), 'share')).toMatchObject({
    code: 'unrecognized',
    message: '发生未识别错误，请稍后重试',
  });
});

it.each(['invalid_input', 'not_installed'] as const)(
  'classifies %s as recoverable warning',
  (reason) => {
    expect(
      classifyUmengError(
        new UmengError({ reason, message: 'private vendor detail' }),
        'share'
      )
    ).toMatchObject({ tone: 'warning', code: reason, restartRequired: false });
  }
);
