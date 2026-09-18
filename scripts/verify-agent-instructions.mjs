import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import {
  dirname,
  extname,
  isAbsolute,
  join,
  matchesGlob,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { isDirectExecution } from './verification-utils.mjs';

const defaultRepositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..'
);
const activeMarkdownEntries = [
  'AGENTS.md',
  'README.md',
  'CONTRIBUTING.md',
  'example/README.md',
  'example/INTEGRATION.md',
  'website/docs',
];
/**
 * 关键依赖的 range 契约。值有两种写法:
 *   - 字符串:peer 与 dev 同值
 *   - `{ peer, dev }`:两者分开 —— 语义本就不同。peer 是已声明的支持范围，dev 是实际验证基线。
 *     新版本按其目标支持矩阵同步本表、manifest 与消费验证，不继承旧下限。
 */
const expectedDependencyRanges = {
  '@sbaiahmed1/react-native-blur': { peer: '>=4', dev: '6.0.1' },
  '@unif/react-native-design': { peer: '>=0.26.0', dev: '^0.30.1' },
  'react-native-reanimated': {
    peer: '>=4.5.3 <4.7.0',
    dev: '^4.6.0',
  },
  'react-native-worklets': {
    peer: '>=0.11.3 <0.13.0',
    dev: '^0.12.1',
  },
};
const requiredInstructionRoutes = [
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
const requiredJavaScriptValidationInputs = [
  'example/src/App.tsx',
  'example/jest.config.js',
  'example/jest.setup.ts',
];
const markdownExtensions = new Set(['.md', '.mdx']);
const markdownParser = unified().use(remarkParse);
const mdxParser = unified().use(remarkParse).use(remarkMdx);

function normalizeRelativePath(relativePath) {
  return relativePath.split(sep).join('/');
}

function isInside(root, candidate) {
  const relativePath = relative(root, candidate);
  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${sep}`) &&
      !relativePath.startsWith('../') &&
      !isAbsolute(relativePath))
  );
}

async function assertCanonicalPathInside(
  repositoryRoot,
  canonicalRepositoryRoot,
  candidate,
  label
) {
  if (!isInside(repositoryRoot, candidate)) {
    throw new Error(`${label} escapes repository root: ${candidate}`);
  }

  const canonicalCandidate = await realpath(candidate);
  if (!isInside(canonicalRepositoryRoot, canonicalCandidate)) {
    throw new Error(
      `${label} escapes repository root through a symlink: ${candidate} -> ${canonicalCandidate}`
    );
  }
}

async function collectMarkdownFiles(
  repositoryRoot,
  canonicalRepositoryRoot,
  relativePath
) {
  const absolutePath = resolve(repositoryRoot, relativePath);
  await assertCanonicalPathInside(
    repositoryRoot,
    canonicalRepositoryRoot,
    absolutePath,
    `active Markdown entry ${relativePath}`
  );
  const entryStat = await stat(absolutePath);

  if (entryStat.isFile()) {
    return markdownExtensions.has(extname(relativePath).toLowerCase())
      ? [normalizeRelativePath(relativePath)]
      : [];
  }

  const files = [];
  for (const entry of await readdir(absolutePath, { withFileTypes: true })) {
    const childPath = join(relativePath, entry.name);
    const childAbsolutePath = resolve(repositoryRoot, childPath);
    const childStat = entry.isSymbolicLink()
      ? await stat(childAbsolutePath)
      : undefined;

    if (entry.isDirectory() || childStat?.isDirectory()) {
      files.push(
        ...(await collectMarkdownFiles(
          repositoryRoot,
          canonicalRepositoryRoot,
          childPath
        ))
      );
    } else if (
      (entry.isFile() || childStat?.isFile()) &&
      markdownExtensions.has(extname(entry.name).toLowerCase())
    ) {
      await assertCanonicalPathInside(
        repositoryRoot,
        canonicalRepositoryRoot,
        childAbsolutePath,
        `active Markdown file ${childPath}`
      );
      files.push(normalizeRelativePath(childPath));
    }
  }
  return files;
}

function visit(node, callback) {
  callback(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      visit(child, callback);
    }
  }
}

function parseMarkdown(markdown, sourcePath) {
  const parser =
    extname(sourcePath).toLowerCase() === '.mdx' ? mdxParser : markdownParser;
  return parser.parse(markdown);
}

function linkNodes(markdown, sourcePath) {
  const links = [];
  const definitions = new Map();
  const references = [];

  visit(parseMarkdown(markdown, sourcePath), (node) => {
    if (
      (node.type === 'link' || node.type === 'image') &&
      typeof node.url === 'string'
    ) {
      links.push({ type: node.type, url: node.url });
    } else if (
      node.type === 'definition' &&
      typeof node.identifier === 'string' &&
      typeof node.url === 'string' &&
      !definitions.has(node.identifier)
    ) {
      definitions.set(node.identifier, node.url);
    } else if (
      (node.type === 'linkReference' || node.type === 'imageReference') &&
      typeof node.identifier === 'string'
    ) {
      references.push({
        identifier: node.identifier,
        type: node.type === 'linkReference' ? 'link' : 'image',
      });
    }
  });

  for (const { identifier, type } of references) {
    const url = definitions.get(identifier);
    if (url) {
      links.push({ type, url });
    }
  }

  return links;
}

function proseBlocks(markdown, sourcePath) {
  const blocks = [];
  visit(parseMarkdown(markdown, sourcePath), (node) => {
    if (node.type !== 'paragraph' && node.type !== 'heading') {
      return;
    }

    let value = '';
    visit(node, (child) => {
      if (
        child !== node &&
        (child.type === 'text' || child.type === 'inlineCode') &&
        typeof child.value === 'string'
      ) {
        value += child.value;
      }
    });
    blocks.push(value);
  });
  return blocks;
}

function positivelyRequiresSkill(markdown, skillName) {
  const canonicalDirective = `必须使用 ${skillName}。`;

  return proseBlocks(markdown, 'AGENTS.md').some(
    (block) =>
      block.trim().replace(/^\d+(?:[.)、]|：)\s*/u, '') === canonicalDirective
  );
}

function isExternalOrRouteTarget(target) {
  return (
    target.startsWith('#') ||
    target.startsWith('/') ||
    target.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/iu.test(target)
  );
}

function linksToDevelopmentSkills(links) {
  return links.some(({ type, url }) => {
    if (type === 'image') {
      return false;
    }
    const targetWithoutQuery = url.split(/[?#]/u, 1)[0].replace(/\/+$/u, '');
    return (
      targetWithoutQuery ===
      'https://github.com/unif-skill/unif-portal-dev-skills'
    );
  });
}

async function localTargetExists({
  canonicalRepositoryRoot,
  repositoryRoot,
  sourcePath,
  target,
}) {
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
  if (!isInside(repositoryRoot, absoluteTarget)) {
    throw new Error(`${sourcePath} link escapes repository root: ${target}`);
  }

  const candidates = [
    absoluteTarget,
    `${absoluteTarget}.md`,
    `${absoluteTarget}.mdx`,
    join(absoluteTarget, 'index.md'),
    join(absoluteTarget, 'index.mdx'),
  ];

  for (const candidate of candidates) {
    try {
      await stat(candidate);
      await assertCanonicalPathInside(
        repositoryRoot,
        canonicalRepositoryRoot,
        candidate,
        `${sourcePath} link ${target}`
      );
      return true;
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') {
        throw error;
      }
    }
  }

  return false;
}

function pathFilterRoutes(workflow, filterName) {
  const lines = workflow.split(/\r?\n/u);
  const routes = [];
  let filtersIndent;
  let currentFilter;

  for (const line of lines) {
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    if (filtersIndent === undefined) {
      if (trimmed === 'filters: |') {
        filtersIndent = indent;
      }
      continue;
    }

    if (trimmed && indent <= filtersIndent) {
      break;
    }
    if (!trimmed) {
      continue;
    }

    const relativeLine = line.slice(filtersIndent + 2);
    const filterMatch = relativeLine.match(/^([\w-]+):\s*$/u);
    if (filterMatch) {
      currentFilter = filterMatch[1];
      continue;
    }

    if (currentFilter === filterName) {
      const routeMatch = relativeLine.match(
        /^\s+-\s+(['"]?)(.+?)\1(?:\s+#.*)?$/u
      );
      if (routeMatch?.[2]) {
        routes.push(routeMatch[2]);
      }
    }
  }

  return routes;
}

export async function verifyAgentInstructions(
  repositoryRoot = defaultRepositoryRoot
) {
  repositoryRoot = resolve(repositoryRoot);
  const failures = [];
  const canonicalRepositoryRoot = await realpath(repositoryRoot);
  const claudeInstructions = await readFile(
    resolve(repositoryRoot, 'CLAUDE.md'),
    'utf8'
  );
  const agentsInstructions = await readFile(
    resolve(repositoryRoot, 'AGENTS.md'),
    'utf8'
  );

  if (!/^@AGENTS\.md(?:\r?\n)?$/u.test(claudeInstructions)) {
    failures.push(
      'CLAUDE.md must contain only @AGENTS.md and an optional final newline'
    );
  }
  if (/CLAUDE\.md/iu.test(agentsInstructions)) {
    failures.push('AGENTS.md must not reference CLAUDE.md');
  }
  if (
    !positivelyRequiresSkill(
      agentsInstructions,
      'unif-portal-dev-skills:code-development'
    )
  ) {
    failures.push(
      'AGENTS.md must positively require the unif-portal-dev-skills:code-development Skill'
    );
  }

  const manifest = JSON.parse(
    await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')
  );
  for (const [dependencyName, expected] of Object.entries(
    expectedDependencyRanges
  )) {
    const expectedBySection =
      typeof expected === 'string'
        ? { peerDependencies: expected, devDependencies: expected }
        : { peerDependencies: expected.peer, devDependencies: expected.dev };
    for (const section of ['peerDependencies', 'devDependencies']) {
      const expectedRange = expectedBySection[section];
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
      activeMarkdownEntries.map((entry) =>
        collectMarkdownFiles(repositoryRoot, canonicalRepositoryRoot, entry)
      )
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

  let hasSkillLink = false;
  for (const [relativePath, markdown] of activeMarkdown) {
    if (markdown.includes('unif-umeng')) {
      failures.push(
        `${relativePath} references obsolete Skill name unif-umeng`
      );
    }

    const links = linkNodes(markdown, relativePath);
    hasSkillLink ||= linksToDevelopmentSkills(links);
    for (const { url: target } of links) {
      if (isExternalOrRouteTarget(target)) {
        continue;
      }
      try {
        if (
          !(await localTargetExists({
            canonicalRepositoryRoot,
            repositoryRoot,
            sourcePath: relativePath,
            target,
          }))
        ) {
          failures.push(
            `${relativePath} has missing local Markdown link: ${target}`
          );
        }
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  if (!hasSkillLink) {
    failures.push(
      'Active repository guidance must hyperlink to the unif-portal-dev-skills repository'
    );
  }

  const validationWorkflow = await readFile(
    resolve(repositoryRoot, '.github/workflows/project-validation.yml'),
    'utf8'
  );
  const sharedAction = await readFile(
    resolve(repositoryRoot, '.github/actions/changes/action.yml'),
    'utf8'
  );
  if (
    !/id: scope\n\s+uses: \.\/\.github\/actions\/changes/u.test(
      validationWorkflow
    )
  ) {
    failures.push(
      'project-validation must call the shared classification action'
    );
  }
  for (const name of ['instructions', 'example']) {
    if (!validationWorkflow.includes(`steps.scope.outputs.${name} == 'true'`)) {
      failures.push(`project-validation must consume shared ${name} output`);
    }
    if (
      !sharedAction.includes('value: ${{ steps.paths.outputs.' + name + ' }}')
    ) {
      failures.push(`shared action must expose the ${name} path result`);
    }
  }
  const instructionRoutes = new Set(
    pathFilterRoutes(sharedAction, 'instructions')
  );
  for (const requiredRoute of requiredInstructionRoutes) {
    if (!instructionRoutes.has(requiredRoute)) {
      failures.push(
        `project-validation instructions filter must include ${requiredRoute}`
      );
    }
  }
  const javascriptRoutes = pathFilterRoutes(sharedAction, 'example');
  for (const requiredInput of requiredJavaScriptValidationInputs) {
    const included = javascriptRoutes
      .filter((route) => !route.startsWith('!'))
      .some((route) => matchesGlob(requiredInput, route));
    const excluded = javascriptRoutes
      .filter((route) => route.startsWith('!'))
      .some((route) => matchesGlob(requiredInput, route.slice(1)));
    if (!included || excluded) {
      failures.push(
        `project-validation javascript filter must cover ${requiredInput}`
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Agent instruction verification failed (${failures.length}):\n${failures
        .map((failure) => `- ${failure}`)
        .join('\n')}`
    );
  }

  return { activeMarkdownFiles };
}

async function main() {
  const result = await verifyAgentInstructions();
  console.log(
    `Agent instruction verification passed (${result.activeMarkdownFiles.length} active Markdown/MDX files, dependency ranges, local links and CI routes checked).`
  );
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
