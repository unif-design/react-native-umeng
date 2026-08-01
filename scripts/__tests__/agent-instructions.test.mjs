import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { verifyAgentInstructions } from '../verify-agent-instructions.mjs';

const expectedRanges = {
  '@unif/react-native-design': '^0.20.0',
  'react-native-reanimated': '^4.5.3',
  'react-native-worklets': '^0.11.3',
};

async function write(relativeRoot, relativePath, content) {
  const absolutePath = join(relativeRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

function workflowWithInstructionRoutes(routes) {
  return `jobs:
  changes:
    steps:
      - uses: dorny/paths-filter@example
        with:
          filters: |
            instructions:
${routes.map((route) => `              - '${route}'`).join('\n')}
`;
}

async function createValidRepository() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'umeng-instructions-'));
  const packageJson = {
    peerDependencies: expectedRanges,
    devDependencies: expectedRanges,
  };

  await Promise.all([
    write(fixtureRoot, 'CLAUDE.md', '@AGENTS.md\r\n'),
    write(
      fixtureRoot,
      'AGENTS.md',
      '开始任何任务前，读取并使用 `umeng-share` Skill。\n'
    ),
    write(
      fixtureRoot,
      'README.md',
      '[umeng-share Skill](https://github.com/unif-design/skills/tree/main/skills/umeng-share)\n'
    ),
    write(fixtureRoot, 'CONTRIBUTING.md', '# Contributing\n'),
    write(fixtureRoot, 'example/README.md', '# Example\n'),
    write(
      fixtureRoot,
      'website/docs/guide.mdx',
      [
        '[括号路径][guide]',
        '',
        '[guide]: ./guide_(v2).md',
        '',
        '~~~md',
        '[代码示例不参与检查](./missing-in-code.md)',
        '~~~',
        '',
      ].join('\n')
    ),
    write(fixtureRoot, 'website/docs/guide_(v2).md', '# Existing\n'),
    write(fixtureRoot, 'package.json', `${JSON.stringify(packageJson)}\n`),
    write(
      fixtureRoot,
      '.github/workflows/project-validation.yml',
      workflowWithInstructionRoutes([
        'AGENTS.md',
        'CLAUDE.md',
        'README.md',
        'CONTRIBUTING.md',
        'example/README.md',
        'website/docs/**',
        'package.json',
        'scripts/verify-agent-instructions.mjs',
      ])
    ),
  ]);

  return fixtureRoot;
}

test('accepts CRLF, MDX, reference links, balanced parentheses, and fenced examples', async () => {
  const fixtureRoot = await createValidRepository();
  try {
    const result = await verifyAgentInstructions(fixtureRoot);
    assert.equal(result.activeMarkdownFiles.length, 6);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('rejects reverse CLAUDE delegation and negated Skill guidance', async () => {
  const fixtureRoot = await createValidRepository();
  try {
    await write(
      fixtureRoot,
      'AGENTS.md',
      '规范统一见 [CLAUDE.md](./CLAUDE.md)。\n读取并使用 `umeng-share` Skill。\n'
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /must not reference CLAUDE\.md/
    );

    await write(
      fixtureRoot,
      'AGENTS.md',
      'Do not use the `umeng-share` Skill.\n'
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /must positively require the umeng-share Skill/
    );

    await write(
      fixtureRoot,
      'AGENTS.md',
      'Agents may use the `umeng-share` Skill if desired.\n'
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /must positively require the umeng-share Skill/
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('requires a real Skill hyperlink target instead of ordinary text', async () => {
  const fixtureRoot = await createValidRepository();
  try {
    await write(
      fixtureRoot,
      'README.md',
      '`skills/umeng-share` is text, while [skills](https://github.com/unif-design/skills) is generic.\n'
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /must hyperlink to the skills\/umeng-share path/
    );

    await write(
      fixtureRoot,
      'README.md',
      '[unused]: https://github.com/unif-design/skills/tree/main/skills/umeng-share\n'
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /must hyperlink to the skills\/umeng-share path/
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('does not skip broken local links that contain braces', async () => {
  const fixtureRoot = await createValidRepository();
  try {
    await write(
      fixtureRoot,
      'README.md',
      [
        '[umeng-share Skill](https://github.com/unif-design/skills/tree/main/skills/umeng-share)',
        '[broken](./{missing}.md)',
        '',
      ].join('\n')
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /missing local Markdown link: \.\/\{missing\}\.md/
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('rejects lexical and symlink link escapes outside the repository', async () => {
  const fixtureRoot = await createValidRepository();
  const outsideRoot = await mkdtemp(
    join(dirname(fixtureRoot), 'umeng-instructions-outside-')
  );
  const outsideFile = join(outsideRoot, 'outside-instructions.md');
  try {
    await writeFile(outsideFile, '# Outside\n');
    await write(
      fixtureRoot,
      'README.md',
      [
        '[umeng-share Skill](https://github.com/unif-design/skills/tree/main/skills/umeng-share)',
        '[escape](../outside-instructions.md)',
        '',
      ].join('\n')
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /escapes repository root/
    );

    await write(
      fixtureRoot,
      'README.md',
      [
        '[umeng-share Skill](https://github.com/unif-design/skills/tree/main/skills/umeng-share)',
        '[symlink](./website/docs/outside-link.md)',
        '',
      ].join('\n')
    );
    await symlink(outsideFile, join(fixtureRoot, 'website/docs/outside-link.md'));
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /escapes repository root/
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

test('requires CI instruction routes for every scanned input group', async () => {
  const fixtureRoot = await createValidRepository();
  try {
    await write(
      fixtureRoot,
      '.github/workflows/project-validation.yml',
      workflowWithInstructionRoutes([
        'AGENTS.md',
        'CLAUDE.md',
        'README.md',
        'CONTRIBUTING.md',
        'example/README.md',
        'package.json',
        'scripts/verify-agent-instructions.mjs',
      ])
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /instructions filter must include website\/docs\/\*\*/
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
