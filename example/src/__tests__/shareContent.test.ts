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
      imageUrl: 'https://host/image.png',
      thumbnailUrl: 'https://host/thumb.png',
    });
  });

  it('omits blank optional image fields instead of emitting empty strings', () => {
    expect(
      buildSheetPayload({ type: 'image', ...validDraft, thumb: '   ' })
    ).toEqual({
      type: 'image',
      imageUrl: 'https://host/image.png',
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
      thumbnailUrl: 'https://host/thumb.png',
    });
  });

  it.each(['wechat_session', 'dingtalk'] as const)(
    'builds public requests for %s',
    (target) => {
      expect(buildDirectOptions('text', target, validDraft)).toEqual({
        target,
        content: { type: 'text', text: '一段分享文字' },
      });
      expect(buildDirectOptions('image', target, validDraft)).toEqual({
        target,
        content: {
          type: 'image',
          imageUrl: 'https://host/image.png',
          thumbnailUrl: 'https://host/thumb.png',
        },
      });
      expect(buildDirectOptions('link', target, validDraft)).toEqual({
        target,
        content: {
          type: 'link',
          title: '分享标题',
          url: 'https://host/page',
          description: '分享说明',
          thumbnailUrl: 'https://host/thumb.png',
        },
      });
    }
  );

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
        buildDirectOptions('image', 'dingtalk', {
          ...validDraft,
          image: 'http://host/image.png',
        }),
    ],
    [
      'direct link',
      () =>
        buildDirectOptions('link', 'wechat_session', {
          ...validDraft,
          url: 'not-a-url',
        }),
    ],
    [
      'direct image thumb over HTTP',
      () =>
        buildDirectOptions('image', 'dingtalk', {
          ...validDraft,
          thumb: 'http://host/thumb.png',
        }),
    ],
    [
      'direct link thumb without a host',
      () =>
        buildDirectOptions('link', 'wechat_session', {
          ...validDraft,
          thumb: 'https:///',
        }),
    ],
  ])('rejects non-HTTPS or malformed URLs for %s', (_label, build) => {
    expect(build).toThrow(
      expect.objectContaining({
        reason: 'invalid_input',
        message: '分享素材必须使用带域名的绝对 HTTPS URL',
      })
    );
  });
});
