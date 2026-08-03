import {
  EMPTY_CREDENTIAL_DRAFT,
  buildInitConfig,
  createInitialSetupState,
  setupReducer,
  type CredentialDraft,
} from '../state/setupState';

const validBase: CredentialDraft = {
  ...EMPTY_CREDENTIAL_DRAFT,
  appkey: 'app-key',
};

describe('buildInitConfig', () => {
  it('requires the Umeng AppKey', () => {
    expect(buildInitConfig(EMPTY_CREDENTIAL_DRAFT, 'android')).toEqual({
      ok: false,
      errors: { appkey: '请输入 Umeng AppKey' },
    });
  });

  it('omits disabled platform fields even when stale credentials remain in the draft', () => {
    expect(
      buildInitConfig(
        {
          ...validBase,
          wechatAppId: 'YOUR_WECHAT_APP_ID',
          wechatAppSecret: 'sensitive-wechat-secret',
          wechatUniversalLink: 'https://sensitive.example/path',
          dingtalkAppId: 'sensitive-dingtalk-app-id',
        },
        'android'
      )
    ).toEqual({ ok: true, config: { appkey: 'app-key' } });
  });

  it('requires complete WeChat credentials and an HTTPS Universal Link on iOS', () => {
    expect(
      buildInitConfig(
        {
          ...validBase,
          wechatEnabled: true,
          wechatAppId: 'YOUR_WECHAT_APP_ID',
          wechatAppSecret: ' ',
          wechatUniversalLink: 'http://example.com/path',
        },
        'ios'
      )
    ).toEqual({
      ok: false,
      errors: {
        wechatAppId: '请替换微信 App ID 占位值',
        wechatAppSecret: '请输入微信 App Secret',
        wechatUniversalLink: '请输入带 host 的绝对 HTTPS Universal Link',
      },
    });
  });

  it('allows an omitted Android Universal Link but validates it when supplied', () => {
    const androidDraft: CredentialDraft = {
      ...validBase,
      wechatEnabled: true,
      wechatAppId: 'wechat-app-id',
      wechatAppSecret: 'wechat-secret',
    };

    expect(buildInitConfig(androidDraft, 'android')).toEqual({
      ok: true,
      config: {
        appkey: 'app-key',
        wechatAppId: 'wechat-app-id',
        wechatAppSecret: 'wechat-secret',
      },
    });
    expect(
      buildInitConfig(
        { ...androidDraft, wechatUniversalLink: '   ' },
        'android'
      )
    ).toEqual({
      ok: false,
      errors: {
        wechatUniversalLink: 'Universal Link 不能只包含空格',
      },
    });
    expect(
      buildInitConfig(
        { ...androidDraft, wechatUniversalLink: 'https://' },
        'android'
      )
    ).toEqual({
      ok: false,
      errors: {
        wechatUniversalLink: '请输入带 host 的绝对 HTTPS Universal Link',
      },
    });
  });

  it('requires DingTalk credentials only when the platform is enabled', () => {
    expect(
      buildInitConfig(
        { ...validBase, dingtalkEnabled: true, dingtalkAppId: 'YOUR_DING_ID' },
        'android'
      )
    ).toEqual({
      ok: false,
      errors: { dingtalkAppId: '请替换钉钉 App ID 占位值' },
    });
  });

  it('trims accepted values and rejects whitespace-only optional fields', () => {
    expect(
      buildInitConfig({ ...validBase, channel: '   ' }, 'android')
    ).toEqual({
      ok: false,
      errors: { channel: 'Channel 不能只包含空格' },
    });

    expect(
      buildInitConfig(
        {
          ...validBase,
          appkey: '  app-key  ',
          channel: '  release  ',
          dingtalkEnabled: true,
          dingtalkAppId: '  ding-id  ',
        },
        'android'
      )
    ).toEqual({
      ok: true,
      config: {
        appkey: 'app-key',
        channel: 'release',
        dingtalkAppId: 'ding-id',
      },
    });
  });
});

describe('setupReducer', () => {
  it('follows the compliant happy-path phases and clears the displayed secret', () => {
    const editing = createInitialSetupState();
    const withCredentials = setupReducer(editing, {
      type: 'updateCredential',
      field: 'wechatAppSecret',
      value: 'sensitive-secret',
    });
    const preInitializing = setupReducer(withCredentials, {
      type: 'preInitializeStarted',
    });
    const snapshot = Object.freeze({
      appkey: 'app-key',
      wechatAppId: 'wechat-id',
      wechatAppSecret: 'sensitive-secret',
    });
    const awaitingConsent = setupReducer(preInitializing, {
      type: 'preInitializeSucceeded',
      configSnapshot: snapshot,
    });

    expect(preInitializing.phase).toBe('preInitializing');
    expect(awaitingConsent).toMatchObject({
      phase: 'awaitingConsent',
      consent: false,
      configSnapshot: snapshot,
      draft: { wechatAppSecret: '' },
    });

    const initializing = setupReducer(
      setupReducer(awaitingConsent, {
        type: 'setConsent',
        checked: true,
      }),
      { type: 'initializeStarted' }
    );
    expect(initializing.phase).toBe('initializing');
    expect(
      setupReducer(initializing, { type: 'initializeSucceeded' }).phase
    ).toBe('initialized');
  });

  it('returns to editing after preInit failure and locks the snapshot after init failure', () => {
    const preInitializing = setupReducer(createInitialSetupState(), {
      type: 'preInitializeStarted',
    });
    const editable = setupReducer(preInitializing, {
      type: 'preInitializeFailed',
      feedback: {
        tone: 'error',
        code: 'E_NON_UMENG',
        message: '发生未识别错误，请稍后重试',
        restartRequired: false,
      },
    });
    expect(editable.phase).toBe('editing');

    const snapshot = Object.freeze({ appkey: 'app-key' });
    const awaitingConsent = setupReducer(
      setupReducer(editable, { type: 'preInitializeStarted' }),
      { type: 'preInitializeSucceeded', configSnapshot: snapshot }
    );
    const initializing = setupReducer(
      setupReducer(awaitingConsent, {
        type: 'setConsent',
        checked: true,
      }),
      { type: 'initializeStarted' }
    );
    const failed = setupReducer(initializing, {
      type: 'initializeFailed',
      feedback: {
        tone: 'error',
        code: 'E_UNKNOWN',
        message: '初始化失败，可使用同一配置重试；若持续失败请重启 App',
        restartRequired: true,
      },
    });

    expect(failed).toMatchObject({
      phase: 'initFailedLocked',
      configSnapshot: snapshot,
    });
    expect(
      setupReducer(failed, {
        type: 'updateCredential',
        field: 'appkey',
        value: 'replacement',
      })
    ).toBe(failed);
    expect(setupReducer(failed, { type: 'initializeStarted' }).phase).toBe(
      'initializing'
    );
  });
});
