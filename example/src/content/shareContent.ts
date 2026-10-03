import {
  type ShareTarget,
  UmengError,
  type ShareImageContent,
  type ShareLinkContent,
  type ShareContent,
  type ShareRequest,
} from '@unif/react-native-umeng';

export type ShareContentType = ShareContent['type'];

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

  throw new UmengError({
    reason: 'invalid_input',
    message: HTTPS_ERROR_MESSAGE,
  });
}

function optionalText(value: string): string | undefined {
  return value.trim().length > 0 ? value : undefined;
}

function optionalHttpsUrl(value: string): string | undefined {
  return value.trim().length > 0 ? requireHttpsUrl(value) : undefined;
}

type ImageContent = Omit<ShareImageContent, 'type'>;

function buildImageContent(draft: ShareContentDraft): ImageContent {
  const thumb = optionalHttpsUrl(draft.thumb);
  return {
    imageUrl: requireHttpsUrl(draft.image),
    ...(thumb === undefined ? {} : { thumbnailUrl: thumb }),
  };
}

type LinkContent = Omit<ShareLinkContent, 'type'>;

function buildLinkContent(draft: ShareContentDraft): LinkContent {
  const description = optionalText(draft.description);
  const thumb = optionalHttpsUrl(draft.thumb);
  return {
    title: draft.title,
    url: requireHttpsUrl(draft.url),
    ...(description === undefined ? {} : { description }),
    ...(thumb === undefined ? {} : { thumbnailUrl: thumb }),
  };
}

export function buildSheetPayload(draft: SheetPayloadDraft): ShareContent {
  switch (draft.type) {
    case 'text':
      return { type: 'text', text: draft.text };
    case 'image':
      return { type: 'image', ...buildImageContent(draft) };
    case 'link':
      return { type: 'link', ...buildLinkContent(draft) };
  }
}

export function buildDirectOptions(
  type: ShareContentType,
  target: ShareTarget,
  draft: ShareContentDraft
): ShareRequest {
  return { target, content: buildSheetPayload({ ...draft, type }) };
}
