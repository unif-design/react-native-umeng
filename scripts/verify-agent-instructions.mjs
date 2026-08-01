import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const activeMarkdownEntries = [
  'AGENTS.md',
  'README.md',
  'CONTRIBUTING.md',
  'example/README.md',
  'website/docs',
];
const expectedDependencyRanges = {
  '@unif/react-native-design': '^0.20.0',
  'react-native-reanimated': '^4.5.3',
  'react-native-worklets': '^0.11.3',
};

async function collectMarkdownFiles(relativePath) {
  const absolutePath = resolve(repositoryRoot, relativePath);
  const entryStat = await stat(absolutePath);

  if (entryStat.isFile()) {
    return relativePath.endsWith('.md') ? [relativePath] : [];
  }

  const files = [];
  for (const entry of await readdir(absolutePath, { withFileTypes: true })) {
    const childPath = join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(childPath)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(childPath);
    }
  }
  return files;
}

function stripFencedCode(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '');
}

function markdownLinkTargets(markdown) {
  const targets = [];
  const linkPattern = /!?\[[^\]]*]\(([^)\n]+)\)/g;

  for (const match of stripFencedCode(markdown).matchAll(linkPattern)) {
    const rawTarget = match[1]?.trim();
    if (!rawTarget) {
      continue;
    }

    if (rawTarget.startsWith('<')) {
      const closingBracket = rawTarget.indexOf('>');
      if (closingBracket > 1) {
        targets.push(rawTarget.slice(1, closingBracket));
      }
      continue;
    }

    targets.push(rawTarget.split(/\s+["']/u, 1)[0]);
  }

  return targets;
}

function isExternalOrRouteTarget(target) {
  return (
    target.startsWith('#') ||
    target.startsWith('/') ||
    target.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/iu.test(target)
  );
}

async function localTargetExists(sourcePath, target) {
  let decodedTarget;
  try {
    decodedTarget = decodeURIComponent(target);
  } catch {
    return false;
  }

  const pathWithoutQuery = decodedTarget.split(/[?#]/u, 1)[0];
  if (!pathWithoutQuery) {
    return true;
  }

  const absoluteTarget = resolve(
    repositoryRoot,
    dirname(sourcePath),
    pathWithoutQuery
  );
  const candidates = [
    absoluteTarget,
    `${absoluteTarget}.md`,
    join(absoluteTarget, 'index.md'),
  ];

  for (const candidate of candidates) {
    try {
      await stat(candidate);
      return true;
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') {
        throw error;
      }
    }
  }

  return false;
}

async function main() {
  const failures = [];
  const claudeInstructions = await readFile(
    resolve(repositoryRoot, 'CLAUDE.md'),
    'utf8'
  );
  const agentsInstructions = await readFile(
    resolve(repositoryRoot, 'AGENTS.md'),
    'utf8'
  );

  if (!/^@AGENTS\.md\n?$/u.test(claudeInstructions)) {
    failures.push('CLAUDE.md must contain only @AGENTS.md and an optional final newline');
  }
  if (agentsInstructions.includes('@CLAUDE.md')) {
    failures.push('AGENTS.md must not delegate instructions back to CLAUDE.md');
  }
  if (!agentsInstructions.includes('umeng-share')) {
    failures.push('AGENTS.md must require the umeng-share Skill');
  }

  const manifest = JSON.parse(
    await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')
  );
  for (const [dependencyName, expectedRange] of Object.entries(
    expectedDependencyRanges
  )) {
    for (const section of ['peerDependencies', 'devDependencies']) {
      const actualRange = manifest[section]?.[dependencyName];
      if (actualRange !== expectedRange) {
        failures.push(
          `package.json#${section}.${dependencyName} must be ${expectedRange}, received ${actualRange ?? 'missing'}`
        );
      }
    }
  }

  const activeMarkdownFiles = (
    await Promise.all(
      activeMarkdownEntries.map((entry) => collectMarkdownFiles(entry))
    )
  )
    .flat()
    .sort();
  const activeMarkdown = new Map(
    await Promise.all(
      activeMarkdownFiles.map(async (relativePath) => [
        relativePath,
        await readFile(resolve(repositoryRoot, relativePath), 'utf8'),
      ])
    )
  );

  for (const [relativePath, markdown] of activeMarkdown) {
    if (markdown.includes('unif-umeng')) {
      failures.push(`${relativePath} references obsolete Skill name unif-umeng`);
    }

    for (const target of markdownLinkTargets(markdown)) {
      if (
        isExternalOrRouteTarget(target) ||
        target.includes('{') ||
        target.includes('}')
      ) {
        continue;
      }
      if (!(await localTargetExists(relativePath, target))) {
        failures.push(`${relativePath} has missing local Markdown link: ${target}`);
      }
    }
  }

  if (
    ![...activeMarkdown.values()].some((markdown) =>
      markdown.includes('skills/umeng-share')
    )
  ) {
    failures.push(
      'Active repository guidance must link to the skills/umeng-share path'
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `Agent instruction verification failed (${failures.length}):\n${failures
        .map((failure) => `- ${failure}`)
        .join('\n')}`
    );
  }

  console.log(
    `Agent instruction verification passed (${activeMarkdownFiles.length} active Markdown files, dependency ranges and local links checked).`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
