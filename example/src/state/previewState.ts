import type { ShareContentDraft } from '../content/shareContent';
import type { DirectShareType } from './operations';

export type PreviewResolution = 'ready' | 'error';

export type PreviewResolutionByKey = Readonly<
  Record<string, PreviewResolution>
>;

export type PreviewDescriptor = {
  readonly key: string;
  readonly url: string;
  readonly accessibilityLabel: string;
};

function optionalDescriptor(
  type: 'image' | 'link',
  field: 'thumb',
  value: string,
  accessibilityLabel: string
): PreviewDescriptor | null {
  return value.trim().length === 0
    ? null
    : {
        key: `${type}:${field}:${value}`,
        url: value,
        accessibilityLabel,
      };
}

export function requiredPreviews(
  type: DirectShareType,
  draft: ShareContentDraft
): readonly PreviewDescriptor[] {
  switch (type) {
    case 'text':
      return [];
    case 'image': {
      const thumb = optionalDescriptor(
        'image',
        'thumb',
        draft.thumb,
        '图片缩略图预览'
      );
      return [
        {
          key: `image:image:${draft.image}`,
          url: draft.image,
          accessibilityLabel: '分享图片预览',
        },
        ...(thumb == null ? [] : [thumb]),
      ];
    }
    case 'link': {
      const thumb = optionalDescriptor(
        'link',
        'thumb',
        draft.thumb,
        '分享缩略图预览'
      );
      return thumb == null ? [] : [thumb];
    }
  }
}

export function isPreviewReady(
  type: DirectShareType,
  draft: ShareContentDraft,
  resolutions: PreviewResolutionByKey
): boolean {
  return requiredPreviews(type, draft).every(
    (preview) => resolutions[preview.key] === 'ready'
  );
}
