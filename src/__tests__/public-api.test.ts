jest.mock('@unif/react-native-design', () => ({
  useThemedStyles: () => ({}),
  useTheme: () => ({ colors: {} }),
  Button: () => null,
  Cell: () => null,
}));
import * as api from '../index';
import { UmengError as WebUmengError } from '../index.web';
import { UmengError as MockUmengError } from '../mock';
it('exports independent operations without old namespaces or presentation internals', () => {
  expect(Object.keys(api).sort()).toEqual(
    [
      'UmengError',
      'bindAnalyticsUser',
      'clearAnalyticsUser',
      'getShareTargets',
      'initializeUmeng',
      'isUmengInitialized',
      'share',
      'trackEvent',
      'useShareSheet',
    ].sort()
  );
  expect(api.UmengError).toBe(WebUmengError);
  expect(api.UmengError).toBe(MockUmengError);
});
