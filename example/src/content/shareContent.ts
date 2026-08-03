import {
  Platform,
  UmengError,
  type ShareImageOptions,
  type ShareLinkOptions,
  type ShareSheetPayload,
  type ShareTextOptions,
} from '@unif/react-native-umeng';

export type ShareContentType = ShareSheetPayload['type'];

export type ShareContentDraft = {
  readonly text: string;
  readonly image: string;
  readonly title: string;
  readonly url: string;
  readonly description: string;
  readonly thumb: string;
};

export type SheetPayloadDraft = ShareContentDraft & {
  readonly type: ShareContentType;
};

export const DEFAULT_SHARE_CONTENT: Readonly<ShareContentDraft> = Object.freeze(
  {
    text: '体验 @unif/react-native-umeng 分享能力',
    image: 'https://unif-design.github.io/react-native-umeng/img/logo.png',
    title: '@unif/react-native-umeng',
    url: 'https://unif-design.github.io/react-native-umeng/',
    description: '合规初始化、微信会话与钉钉分享示例',
    thumb: 'https://unif-design.github.io/react-native-umeng/img/logo.png',
  }
);

const HTTPS_ERROR_MESSAGE = '分享素材必须使用带域名的绝对 HTTPS URL';

function requireHttpsUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' && parsed.hostname.length > 0) {
      return value;
    }
  } catch {
    // 统一落入不含原始 URL 的安全错误，避免把 query/凭据带入反馈与日志。
  }

  throw new UmengError('E_INVALID_OPTIONS', HTTPS_ERROR_MESSAGE);
}

function optionalText(value: string): string | undefined {
  return value.trim().length > 0 ? value : undefined;
}

function optionalHttpsUrl(value: string): string | undefined {
  return value.trim().length > 0 ? requireHttpsUrl(value) : undefined;
}

export function buildSheetPayload(draft: SheetPayloadDraft): ShareSheetPayload {
  switch (draft.type) {
    case 'text':
      return { type: 'text', text: draft.text };
    case 'image': {
      const thumb = optionalHttpsUrl(draft.thumb);
      return {
        type: 'image',
        image: requireHttpsUrl(draft.image),
        ...(thumb === undefined ? {} : { thumb }),
      };
    }
    case 'link': {
      const description = optionalText(draft.description);
      const thumb = optionalHttpsUrl(draft.thumb);
      return {
        type: 'link',
        title: draft.title,
        url: requireHttpsUrl(draft.url),
        ...(description === undefined ? {} : { description }),
        ...(thumb === undefined ? {} : { thumb }),
      };
    }
  }
}

export function buildDirectOptions(
  type: 'text',
  platform: Platform,
  draft: ShareContentDraft
): ShareTextOptions;
export function buildDirectOptions(
  type: 'image',
  platform: Platform,
  draft: ShareContentDraft
): ShareImageOptions;
export function buildDirectOptions(
  type: 'link',
  platform: Platform,
  draft: ShareContentDraft
): ShareLinkOptions;
export function buildDirectOptions(
  type: ShareContentType,
  platform: Platform,
  draft: ShareContentDraft
): ShareTextOptions | ShareImageOptions | ShareLinkOptions;
export function buildDirectOptions(
  type: ShareContentType,
  platform: Platform,
  draft: ShareContentDraft
): ShareTextOptions | ShareImageOptions | ShareLinkOptions {
  switch (type) {
    case 'text':
      return { platform, text: draft.text };
    case 'image': {
      const thumb = optionalHttpsUrl(draft.thumb);
      return {
        platform,
        image: requireHttpsUrl(draft.image),
        ...(thumb === undefined ? {} : { thumb }),
      };
    }
    case 'link': {
      const description = optionalText(draft.description);
      const thumb = optionalHttpsUrl(draft.thumb);
      return {
        platform,
        title: draft.title,
        url: requireHttpsUrl(draft.url),
        ...(description === undefined ? {} : { description }),
        ...(thumb === undefined ? {} : { thumb }),
      };
    }
  }
}
