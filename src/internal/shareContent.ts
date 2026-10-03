import type { ShareContent, ShareTarget } from '../types';
import { isHttpUrl } from './isHttpUrl';
import { invalidInput, requireObject, requireString } from './inputValidation';

export function isShareTarget(value: unknown): value is ShareTarget {
  return value === 'wechat_session' || value === 'dingtalk';
}
function requireHttpUrl(value: unknown, field: string): string {
  const text = requireString(value, field);
  if (isHttpUrl(text)) return text;
  return invalidInput(`${field} must be an absolute HTTP(S) URL with a host`);
}
export function snapshotContent(value: unknown): Readonly<ShareContent> {
  const content = requireObject(value, 'content');
  if (content.type === 'text')
    return Object.freeze({
      type: 'text',
      text: requireString(content.text, 'text'),
    });
  const thumbnailUrl =
    content.thumbnailUrl === undefined
      ? undefined
      : requireHttpUrl(content.thumbnailUrl, 'thumbnailUrl');
  if (content.type === 'image')
    return Object.freeze({
      type: 'image',
      imageUrl: requireHttpUrl(content.imageUrl, 'imageUrl'),
      ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
    });
  if (content.type === 'link') {
    if (
      content.description !== undefined &&
      typeof content.description !== 'string'
    )
      return invalidInput('description must be a string');
    return Object.freeze({
      type: 'link',
      title: requireString(content.title, 'title'),
      url: requireHttpUrl(content.url, 'url'),
      ...(content.description === undefined
        ? {}
        : { description: content.description }),
      ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
    });
  }
  return invalidInput('content.type must be text, image, or link');
}
