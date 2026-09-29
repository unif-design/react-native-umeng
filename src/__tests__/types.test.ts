import { UmengError } from '../UmengError';
import type { ShareResult, ShareContent, UmengConfiguration } from '../index';
it('supports explicit results and grouped configuration', () => {
  const config: UmengConfiguration = {
    appKey: 'app',
    dingtalk: { appId: 'ding' },
  };
  const content: ShareContent = {
    type: 'image',
    imageUrl: 'https://example.com/image.png',
  };
  const result: ShareResult = { status: 'cancelled' };
  expect(config.dingtalk?.appId).toBe('ding');
  expect(content.type).toBe('image');
  expect(result).not.toHaveProperty('target');
  expect(new UmengError({ reason: 'busy', message: 'pending' })).toBeInstanceOf(
    Error
  );
});
export function negativeContracts() {
  // @ts-expect-error a successful receipt requires its target
  const success: ShareResult = { status: 'success' };
  const image: ShareContent = {
    type: 'image',
    // @ts-expect-error image content uses imageUrl
    image: 'https://example.com/a.png',
  };
  // @ts-expect-error SDK config uses appKey
  const config: UmengConfiguration = { appkey: 'app' };
  return [success, image, config];
}
