import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const jest = require.resolve('jest/bin/jest');
const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
// The library and the executable example use distinct official Jest presets.
// Forward CI flags to both and fail as soon as either strict gate fails.
for (const config of ['package.json', 'example/jest.config.js']) {
  const result = spawnSync(
    process.execPath,
    [jest, '--config', config, ...args],
    {
      cwd: root,
      stdio: 'inherit',
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
