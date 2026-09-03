import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const turbo = JSON.parse(
  readFileSync(new URL('../../turbo.json', import.meta.url), 'utf8')
);

const requiredExclusions = [
  '!$TURBO_ROOT$/src/__tests__/**',
  '!$TURBO_ROOT$/src/**/__tests__/**',
  '!$TURBO_ROOT$/src/*.test.*',
  '!$TURBO_ROOT$/src/**/*.test.*',
  '!$TURBO_ROOT$/example/src/__tests__/**',
  '!$TURBO_ROOT$/example/src/**/__tests__/**',
  '!$TURBO_ROOT$/example/src/*.test.*',
  '!$TURBO_ROOT$/example/src/**/*.test.*',
];

test('Turbo native build cache excludes tests and opposite-platform sources', () => {
  for (const platform of ['android', 'ios']) {
    const taskName = `@unif/react-native-umeng-example#build:${platform}`;
    const inputs = turbo.tasks[taskName]?.inputs;
    assert.ok(Array.isArray(inputs), `${taskName} must define inputs`);

    for (const exclusion of requiredExclusions) {
      assert.ok(inputs.includes(exclusion), `${taskName} missing ${exclusion}`);
    }

    const oppositePlatform = platform === 'android' ? 'ios' : 'android';
    assert.equal(
      inputs.some(
        (input) =>
          !input.startsWith('!') &&
          (input.includes(`$TURBO_ROOT$/${oppositePlatform}/`) ||
            input.includes(`$TURBO_ROOT$/example/${oppositePlatform}/`))
      ),
      false,
      `${taskName} must not include ${oppositePlatform} sources`
    );
  }
});
