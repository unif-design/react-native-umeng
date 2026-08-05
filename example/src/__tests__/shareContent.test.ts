import { Platform } from '@unif/react-native-umeng';

import {
  DEFAULT_SHARE_CONTENT,
  buildDirectOptions,
  buildSheetPayload,
  type ShareContentDraft,
} from '../content/shareContent';

const validDraft: ShareContentDraft = {
  text: '一段分享文字',
  image: 'https://host/image.png',
  title: '分享标题',
  url: 'https://host/page',
  description: '分享说明',
  thumb: 'https://host/thumb.png',
};

describe('share content builders', () => {
  it('provides editable defaults backed only by the showcase HTTPS assets', () => {
    expect(DEFAULT_SHARE_CONTENT).toEqual({
      text: '体验 @unif/react-native-umeng 分享能力',
      image: 'https://unif-design.github.io/react-native-umeng/img/logo.png',
      title: '@unif/react-native-umeng',
      url: 'https://unif-design.github.io/react-native-umeng/',
      description: '合规初始化、微信会话与钉钉分享示例',
      thumb: 'https://unif-design.github.io/react-native-umeng/img/logo.png',
    });
  });

  it('builds only the text fields for a sheet text payload', () => {
    expect(buildSheetPayload({ type: 'text', ...validDraft })).toEqual({
      type: 'text',
      text: '一段分享文字',
    });
  });

  it('builds the image and optional thumb for a sheet image payload', () => {
    expect(buildSheetPayload({ type: 'image', ...validDraft })).toEqual({
      type: 'image',
      image: 'https://host/image.png',
      thumb: 'https://host/thumb.png',
    });
  });

  it('omits blank optional image fields instead of emitting empty strings', () => {
    expect(
      buildSheetPayload({ type: 'image', ...validDraft, thumb: '   ' })
    ).toEqual({
      type: 'image',
      image: 'https://host/image.png',
    });
  });

  it('builds only the link fields for a sheet link payload', () => {
    expect(
      buildSheetPayload({
        type: 'link',
        text: '忽略',
        image: 'https://host/image.png',
        title: '标题',
        url: 'https://host/page',
        description: '说明',
        thumb: 'https://host/thumb.png',
      })
    ).toEqual({
      type: 'link',
      title: '标题',
      url: 'https://host/page',
      description: '说明',
      thumb: 'https://host/thumb.png',
    });
  });

  it.each([
    [
      'text',
      Platform.WECHAT_SESSION,
      {
        platform: Platform.WECHAT_SESSION,
        text: '一段分享文字',
      },
    ],
    [
      'text',
      Platform.DINGTALK,
      {
        platform: Platform.DINGTALK,
        text: '一段分享文字',
      },
    ],
    [
      'image',
      Platform.WECHAT_SESSION,
      {
        platform: Platform.WECHAT_SESSION,
        image: 'https://host/image.png',
        thumb: 'https://host/thumb.png',
      },
    ],
    [
      'image',
      Platform.DINGTALK,
      {
        platform: Platform.DINGTALK,
        image: 'https://host/image.png',
        thumb: 'https://host/thumb.png',
      },
    ],
    [
      'link',
      Platform.WECHAT_SESSION,
      {
        platform: Platform.WECHAT_SESSION,
        title: '分享标题',
        url: 'https://host/page',
        description: '分享说明',
        thumb: 'https://host/thumb.png',
      },
    ],
    [
      'link',
      Platform.DINGTALK,
      {
        platform: Platform.DINGTALK,
        title: '分享标题',
        url: 'https://host/page',
        description: '分享说明',
        thumb: 'https://host/thumb.png',
      },
    ],
  ] as const)('builds %s direct options for %s', (type, platform, expected) => {
    expect(buildDirectOptions(type, platform, validDraft)).toEqual(expected);
  });

  it.each([
    [
      'sheet image',
      () =>
        buildSheetPayload({
          type: 'image',
          ...validDraft,
          image: 'http://host/image.png',
        }),
    ],
    [
      'sheet link',
      () =>
        buildSheetPayload({
          type: 'link',
          ...validDraft,
          url: 'http://host/page',
        }),
    ],
    [
      'sheet thumb',
      () =>
        buildSheetPayload({
          type: 'link',
          ...validDraft,
          thumb: 'http://host/thumb.png',
        }),
    ],
    [
      'direct image',
      () =>
        buildDirectOptions('image', Platform.DINGTALK, {
          ...validDraft,
          image: 'http://host/image.png',
        }),
    ],
    [
      'direct link',
      () =>
        buildDirectOptions('link', Platform.WECHAT_SESSION, {
          ...validDraft,
          url: 'not-a-url',
        }),
    ],
    [
      'direct image thumb over HTTP',
      () =>
        buildDirectOptions('image', Platform.DINGTALK, {
          ...validDraft,
          thumb: 'http://host/thumb.png',
        }),
    ],
    [
      'direct link thumb without a host',
      () =>
        buildDirectOptions('link', Platform.WECHAT_SESSION, {
          ...validDraft,
          thumb: 'https:///',
        }),
    ],
  ])('rejects non-HTTPS or malformed URLs for %s', (_label, build) => {
    expect(build).toThrow(
      expect.objectContaining({
        code: 'E_INVALID_OPTIONS',
        message: '分享素材必须使用带域名的绝对 HTTPS URL',
      })
    );
  });
});
