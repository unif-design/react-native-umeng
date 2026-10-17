import { isHttpUrl } from '../internal/isHttpUrl';

it.each([
  ['https://[::ffff:192.0.2]/image', false],
  ['https://[::ffff:256.0.2.1]/image', false],
  ['https://[::1::2]/image', false],
  ['https://[1:2:3:4:5:6:7:8]/image', true],
  ['https://[1:2:3:4:5:6:7]/image', false],
  ['https://host\u007f/image', false],
  ['https://host\u0001/image', false],
  ['https://bad%/image', false],
  ['https://bad%7fhost/image', false],
  ['https://bad%01host/image', false],
  ['https://bad%2fhost/image', false],
  ['https://user:password@example.com/image', true],
  ['https://[::]/image', true],
])('validates HTTP authority %s', (value, expected) => {
  expect(isHttpUrl(value)).toBe(expected);
});

it('returns false when the platform URL parser rejects an otherwise valid authority', () => {
  const original = globalThis.URL;
  try {
    globalThis.URL = class {
      constructor() {
        throw new TypeError('URL parser failure');
      }
    } as unknown as typeof URL;
    expect(isHttpUrl('https://example.com/image')).toBe(false);
  } finally {
    globalThis.URL = original;
  }
});
