import { matchesGlob } from 'node:path';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) =>
  readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const project = read('.github/workflows/project-validation.yml');
function selected(name, scope) {
  const expression = project.match(
    new RegExp('^      ' + name + ': \\$\\{\\{ (.*) \\}\\}$', 'm')
  )?.[1];
  assert.ok(expression, name);
  return expression.split(' || ').some((part) => {
    const key = /^steps\.scope\.outputs\.([a-z_]+) == 'true'$/.exec(part)?.[1];
    assert.ok(key, part);
    return scope[key] === true;
  });
}

test('ordinary unit tests do not select example or consumer build work', () => {
  assert.equal(selected('javascript', { code: true }), false);
  assert.equal(selected('consumer', { code: true }), false);
});
test('docs keep documentation checks without selecting example or package builds', () => {
  const scope = { website: true, instructions: true };
  assert.equal(selected('javascript', scope), false);
  assert.equal(selected('consumer', scope), false);
  assert.equal(selected('website', scope), true);
  assert.equal(selected('instructions', scope), true);
});
test('shared runtime and verification tooling keep their actual consumers', () => {
  for (const scope of [{ shared: true }, { js: true }, { tooling: true }]) {
    assert.equal(selected('javascript', scope), true);
    assert.equal(selected('consumer', scope), true);
  }
  assert.equal(selected('consumer', { ios: true }), true);
  assert.equal(selected('consumer', { android: true }), true);
  assert.equal(selected('javascript', { ios: true }), false);
});
test('PR title edits retain publish-level verification without restarting Project Validation', () => {
  assert.doesNotMatch(project, /- edited/);
  const title = read('.github/workflows/publish-title.yml');
  assert.match(title, /types: \[edited\]/);
  assert.match(title, /if: github\.event\.changes\.title != null/);
  assert.match(title, /fetch-depth: 0/);
  assert.match(title, /yarn verify:publish-contract --squash-title/);
  assert.doesNotMatch(
    title,
    /yarn prepare|build:ios|build:android|verify:consumers/
  );
  assert.match(project, /yarn verify:publish-contract --squash-title/);
});
test('native obligations execute in standard required jobs even on a Turbo hit', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.doesNotMatch(project, /^ {2}(ios|android):/m);
  assert.doesNotMatch(project, /build:ios|assembleRelease|xcodebuild test/);
  for (const platform of ['ios', 'android']) {
    const job = ci
      .split('  build-' + platform + ':')[1]
      .split(/^ {2}[a-z-]+:/m)[0];
    assert.ok(
      job.includes(
        "if: env.turbo_cache_hit != 1 || hashFiles('.github/ci/" +
          platform +
          ".sh') != ''"
      )
    );
    assert.ok(job.includes('run: bash .github/ci/' + platform + '.sh'));
    assert.match(read('.github/ci/' + platform + '.sh'), /set -euo pipefail/);
  }
  const ios = read('.github/ci/ios.sh');
  for (const input of [
    '--platform ios',
    'xcodebuild test',
    'RCTModuleProviders.mm',
    'UmengCommon',
    'UmengAnalytics',
    'UmengShare',
  ])
    assert.ok(ios.includes(input), input);
  assert.doesNotMatch(ios, /turbo run build:ios/);
  const android = read('.github/ci/android.sh');
  for (const input of [
    '--platform android',
    'testDebugUnitTest',
    ':app:assembleRelease',
    ':app:processReleaseMainManifest',
    'fileprovider',
    'WXEntryActivity',
    'DDShareActivity',
    'react_native_umeng_file_paths',
    'android:enabled="false"',
  ])
    assert.ok(android.includes(input), input);
});

test('changing the shared action selects the real instructions validator', () => {
  const action = read('.github/actions/changes/action.yml');
  const block = action.match(/\n {10}instructions:\n((?: {12}- .*\n)+)/)?.[1];
  assert.ok(block);
  const patterns = [...block.matchAll(/- '([^']+)'/g)].map((match) => match[1]);
  const file = '.github/actions/changes/action.yml';
  const included = patterns
    .filter((pattern) => !pattern.startsWith('!'))
    .some((pattern) => matchesGlob(file, pattern));
  const excluded = patterns
    .filter((pattern) => pattern.startsWith('!'))
    .some((pattern) => matchesGlob(file, pattern.slice(1)));
  assert.equal(
    selected('instructions', { instructions: included && !excluded }),
    true
  );
});
