import { UmengError, type ErrorCode } from '@unif/react-native-umeng';

import {
  classifyUmengError,
  type OperationFeedback,
  type OperationScope,
} from '../errors/classifyUmengError';

describe('classifyUmengError', () => {
  it.each<
    readonly [ErrorCode, OperationScope, Omit<OperationFeedback, 'code'>]
  >([
    [
      'E_USER_CANCEL',
      'share',
      {
        tone: 'neutral',
        message: '已取消分享',
        restartRequired: false,
      },
    ],
    [
      'E_PLATFORM_NOT_INSTALLED',
      'share',
      {
        tone: 'warning',
        message: '目标平台未安装，请安装后重试',
        restartRequired: false,
      },
    ],
    [
      'E_INVALID_OPTIONS',
      'preInit',
      {
        tone: 'warning',
        message: '请检查输入后重试',
        restartRequired: false,
      },
    ],
    [
      'E_SHARE_FAILED',
      'share',
      {
        tone: 'error',
        message: '分享失败，请重试',
        restartRequired: false,
      },
    ],
    [
      'E_PLATFORM_NOT_SUPPORTED',
      'share',
      {
        tone: 'error',
        message: '当前分享平台不受支持',
        restartRequired: false,
      },
    ],
    [
      'E_NOT_INITIALIZED',
      'platform',
      {
        tone: 'warning',
        message: '请先完成初始化',
        restartRequired: false,
      },
    ],
    [
      'E_UNKNOWN',
      'share',
      {
        tone: 'error',
        message: '发生未知错误，请稍后重试',
        restartRequired: false,
      },
    ],
  ])('classifies public code %s in %s scope', (code, scope, expected) => {
    expect(
      classifyUmengError(new UmengError(code, 'native detail'), scope)
    ).toEqual({ code, ...expected });
  });

  it('requires restart when init rejects a configuration change', () => {
    expect(
      classifyUmengError(
        new UmengError('E_INVALID_OPTIONS', 'different config'),
        'init'
      )
    ).toEqual({
      tone: 'warning',
      code: 'E_INVALID_OPTIONS',
      message: '初始化已开始，修改配置需要重启 App',
      restartRequired: true,
    });
  });

  it('marks an unknown init failure as restart-required without parsing private metadata', () => {
    expect(
      classifyUmengError(
        new UmengError('E_UNKNOWN', 'vendor failed', {
          restartRequired: false,
        }),
        'init'
      )
    ).toEqual({
      tone: 'error',
      code: 'E_UNKNOWN',
      message: '初始化失败，可使用同一配置重试；若持续失败请重启 App',
      restartRequired: true,
    });
  });

  it('classifies a non-Umeng error without exposing its message', () => {
    expect(
      classifyUmengError(new Error('https://host/path?appkey=secret'), 'share')
    ).toEqual({
      tone: 'error',
      code: 'E_NON_UMENG',
      message: '发生未识别错误，请稍后重试',
      restartRequired: false,
    });
  });
});
