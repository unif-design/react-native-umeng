/// <reference types="jest" />
import type {
  ErrorCode,
  PlatformInfo,
  ShareCode,
  ShareImageOptions,
  ShareLinkOptions,
  ShareResult,
  ShareSheetOptions,
  ShareSheetPayload,
  ShareTextOptions,
  UmengInitConfig,
} from '../index';

jest.mock('../NativeUmengCommon', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn().mockResolvedValue(undefined),
    isInited: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../NativeUmengShare', () => ({
  __esModule: true,
  default: {
    shareText: jest.fn(),
    shareImage: jest.fn(),
    shareLink: jest.fn(),
    isInstalled: jest.fn(),
  },
}));

jest.mock('../NativeUmengAnalytics', () => ({
  __esModule: true,
  default: {
    onEvent: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}));

jest.mock('@unif/react-native-design', () => ({
  Button: () => null,
  Cell: () => null,
  useTheme: () => ({ colors: { surfaceContainer: '#ffffff' } }),
  useThemedStyles: () => ({}),
}));

import {
  Analytics,
  Common,
  Platform,
  PLATFORM_BRAND_COLORS,
  PLATFORM_DEFAULT_SUBTITLES,
  PLATFORM_DISPLAY_NAMES,
  Share,
  ShareSheetHost,
  SUPPORTED_PLATFORMS,
  UmengError,
} from '../index';

type PublicTypes = [
  ErrorCode,
  PlatformInfo,
  ShareCode,
  ShareImageOptions,
  ShareLinkOptions,
  ShareResult,
  ShareSheetOptions,
  ShareSheetPayload,
  ShareTextOptions,
  UmengInitConfig,
];

describe('public API', () => {
  it('exports the three public namespaces without test-only Common helpers', () => {
    expect(Common).toEqual(
      expect.objectContaining({
        preInit: expect.any(Function),
        init: expect.any(Function),
        isInited: expect.any(Function),
      })
    );
    expect(Common).not.toHaveProperty('__resetForTests');
    expect(Share).toEqual(
      expect.objectContaining({
        shareText: expect.any(Function),
        shareImage: expect.any(Function),
        shareLink: expect.any(Function),
      })
    );
    expect(Analytics).toEqual(
      expect.objectContaining({
        onEvent: expect.any(Function),
        signIn: expect.any(Function),
        signOut: expect.any(Function),
      })
    );
  });

  it('keeps the host, values, error, and public types importable', () => {
    const typeContract: PublicTypes | undefined = undefined;

    expect(typeContract).toBeUndefined();
    expect(ShareSheetHost).toEqual(expect.any(Function));
    expect(Platform).toBeDefined();
    expect(SUPPORTED_PLATFORMS).toBeDefined();
    expect(PLATFORM_DISPLAY_NAMES).toBeDefined();
    expect(PLATFORM_DEFAULT_SUBTITLES).toBeDefined();
    expect(PLATFORM_BRAND_COLORS).toBeDefined();
    expect(UmengError).toEqual(expect.any(Function));
  });
});
