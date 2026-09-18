import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { verifyAgentInstructions } from '../verify-agent-instructions.mjs';

// 刻意不从 verify-agent-instructions 的契约推导:那样测试会自证,契约被改坏也照过。
// design 的 peer 与 dev 分段 —— peer 是对外兼容范围,dev 是本仓验证基线。
const expectedPeerRanges = {
  '@sbaiahmed1/react-native-blur': '>=4',
  '@unif/react-native-design': '>=0.26.0',
  'react-native-reanimated': '>=4.5.3 <4.7.0',
  'react-native-worklets': '>=0.11.3 <0.13.0',
};
const expectedDevRanges = {
  '@sbaiahmed1/react-native-blur': '6.0.1',
  '@unif/react-native-design': '^0.30.1',
  'react-native-reanimated': '^4.6.0',
  'react-native-worklets': '^0.12.1',
};

async function write(relativeRoot, relativePath, content) {
  const absolutePath = join(relativeRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

function workflowWithInstructionRoutes(
  routes,
  javascriptRoutes = ['example/**']
) {
  return `jobs:
  changes:
    steps:
      - uses: dorny/paths-filter@example
        with:
          filters: |
            javascript:
${javascriptRoutes.map((route) => `              - '${route}'`).join('\n')}
            instructions:
${routes.map((route) => `              - '${route}'`).join('\n')}
`;
}

async function createValidRepository() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'umeng-instructions-'));
  const packageJson = {
    peerDependencies: expectedPeerRanges,
    devDependencies: expectedDevRanges,
  };

  await Promise.all([
    write(fixtureRoot, 'CLAUDE.md', '@AGENTS.md\r\n'),
    write(
      fixtureRoot,
      'AGENTS.md',
      '必须使用 `unif-portal-dev-skills:code-development`。\n'
    ),
    write(
      fixtureRoot,
      'README.md',
      '[unif-portal-dev-skills:code-development Skill](https://github.com/unif-skill/unif-portal-dev-skills)\n'
    ),
    write(fixtureRoot, 'CONTRIBUTING.md', '# Contributing\n'),
    write(fixtureRoot, 'example/README.md', '# Example\n'),
    write(fixtureRoot, 'example/INTEGRATION.md', '# Integration\n'),
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
        'example/INTEGRATION.md',
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
    assert.equal(result.activeMarkdownFiles.length, 7);
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
      '规范统一见 [CLAUDE.md](./CLAUDE.md)。\n读取并使用 `unif-portal-dev-skills:code-development` Skill。\n'
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /must not reference CLAUDE\.md/
    );

    await write(
      fixtureRoot,
      'AGENTS.md',
      'Do not use the `unif-portal-dev-skills:code-development` Skill.\n'
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /must positively require the unif-portal-dev-skills:code-development Skill/
    );

    await write(
      fixtureRoot,
      'AGENTS.md',
      'Agents may use the `unif-portal-dev-skills:code-development` Skill if desired.\n'
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /must positively require the unif-portal-dev-skills:code-development Skill/
    );

    await write(
      fixtureRoot,
      'AGENTS.md',
      'Agents might use the `unif-portal-dev-skills:code-development` Skill.\n'
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /must positively require the unif-portal-dev-skills:code-development Skill/
    );

    await write(
      fixtureRoot,
      'AGENTS.md',
      'Agent 可使用 `unif-portal-dev-skills:code-development` Skill。\n'
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /must positively require the unif-portal-dev-skills:code-development Skill/
    );

    for (const optionalGuidance of [
      'Use the `unif-portal-dev-skills:code-development` Skill only if you feel like it.\n',
      'Use cases for the `unif-portal-dev-skills:code-development` Skill are documented here.\n',
      '使用场景：`unif-portal-dev-skills:code-development` Skill。\n',
      '本仓不强制使用 `unif-portal-dev-skills:code-development` Skill。\n',
      '是否必须使用 `unif-portal-dev-skills:code-development` Skill？\n',
      'Must agents use the `unif-portal-dev-skills:code-development` Skill?\n',
      'It is unclear whether the `unif-portal-dev-skills:code-development` Skill is required.\n',
      'The `unif-portal-dev-skills:code-development` Skill is required only by legacy projects.\n',
      'No agent must use the `unif-portal-dev-skills:code-development` Skill.\n',
    ]) {
      await write(fixtureRoot, 'AGENTS.md', optionalGuidance);
      await assert.rejects(
        verifyAgentInstructions(fixtureRoot),
        /must positively require the unif-portal-dev-skills:code-development Skill/
      );
    }
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
      '`skills/unif-portal-dev-skills:code-development` is text, while [skills](https://github.com/unif-skill) is generic.\n'
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /must hyperlink to the unif-portal-dev-skills repository/
    );

    await write(
      fixtureRoot,
      'README.md',
      '[unused]: https://github.com/unif-skill/unif-portal-dev-skills\n'
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /must hyperlink to the unif-portal-dev-skills repository/
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
        '[unif-portal-dev-skills:code-development Skill](https://github.com/unif-skill/unif-portal-dev-skills)',
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
        '[unif-portal-dev-skills:code-development Skill](https://github.com/unif-skill/unif-portal-dev-skills)',
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
        '[unif-portal-dev-skills:code-development Skill](https://github.com/unif-skill/unif-portal-dev-skills)',
        '[symlink](./website/docs/outside-link.md)',
        '',
      ].join('\n')
    );
    await symlink(
      outsideFile,
      join(fixtureRoot, 'website/docs/outside-link.md')
    );
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
        'example/INTEGRATION.md',
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

test('requires JavaScript validation routes for example tests and contracts', async () => {
  const fixtureRoot = await createValidRepository();
  const instructionRoutes = [
    'AGENTS.md',
    'CLAUDE.md',
    'README.md',
    'CONTRIBUTING.md',
    'example/README.md',
    'example/INTEGRATION.md',
    'website/docs/**',
    'package.json',
    'scripts/verify-agent-instructions.mjs',
  ];

  try {
    await write(
      fixtureRoot,
      '.github/workflows/project-validation.yml',
      workflowWithInstructionRoutes(instructionRoutes, ['example/src/**'])
    );
    await assert.rejects(verifyAgentInstructions(fixtureRoot), (error) => {
      assert.match(
        error.message,
        /javascript filter must cover example\/jest\.config\.js/
      );
      assert.match(
        error.message,
        /javascript filter must cover example\/jest\.setup\.ts/
      );
      return true;
    });

    await write(
      fixtureRoot,
      '.github/workflows/project-validation.yml',
      workflowWithInstructionRoutes(instructionRoutes, [
        'example/jest.config.js',
        'example/jest.setup.ts',
      ])
    );
    await assert.rejects(
      verifyAgentInstructions(fixtureRoot),
      /javascript filter must cover example\/src\/App\.tsx/
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
