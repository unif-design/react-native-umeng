/// <reference types="jest" />
import {
  Platform,
  SUPPORTED_PLATFORMS,
  PLATFORM_DISPLAY_NAMES,
  PLATFORM_DEFAULT_SUBTITLES,
  PLATFORM_BRAND_COLORS,
  UmengError,
} from '../types';

describe('types', () => {
  it('Platform enum values are stable', () => {
    expect(Platform.WECHAT_SESSION).toBe('wechat_session');
    expect(Platform.DINGTALK).toBe('dingtalk');
  });

  it('SUPPORTED_PLATFORMS contains exactly two entries in render order', () => {
    expect(SUPPORTED_PLATFORMS).toEqual([
      Platform.WECHAT_SESSION,
      Platform.DINGTALK,
    ]);
  });

  it('every supported platform has a display name and default subtitle', () => {
    for (const p of SUPPORTED_PLATFORMS) {
      expect(PLATFORM_DISPLAY_NAMES[p]).toBeTruthy();
      expect(PLATFORM_DEFAULT_SUBTITLES[p]).toBeTruthy();
    }
  });

  it('every supported platform has a brand color (#RRGGBB)', () => {
    for (const p of SUPPORTED_PLATFORMS) {
      expect(PLATFORM_BRAND_COLORS[p]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('UmengError carries code and message', () => {
    const e = new UmengError('E_USER_CANCEL', 'cancelled');
    expect(e.code).toBe('E_USER_CANCEL');
    expect(e.message).toBe('cancelled');
    expect(e.name).toBe('UmengError');
    expect(e).toBeInstanceOf(Error);
  });
});
