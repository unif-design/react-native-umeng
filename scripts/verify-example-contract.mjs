import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { isDirectExecution } from './verification-utils.mjs';

const defaultRepositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..'
);
const androidDependencies = [
  'com.umeng.umsdk:share-wx:7.3.7',
  'com.tencent.mm.opensdk:wechat-sdk-android:6.8.34',
  'com.umeng.umsdk:share-dingding:7.3.7',
  'com.alibaba.android:ddsharesdk:1.2.2',
];
const markdownParser = unified().use(remarkParse);
const consumerGuideLinks = [
  './src/',
  './package.json',
  '../package.json',
  './ios/ReactNativeUmengExample/Info.plist',
  './ios/ReactNativeUmengExample/AppDelegate.swift',
  './ios/ReactNativeUmengExample/SceneDelegateFixture.swift',
  './ios/ReactNativeUmengExample/ReactNativeUmengExample.entitlements',
  '../website/docs/native-setup/ios.md',
  './android/app/src/main/java/unif/reactnativeumeng/example/wxapi/WXEntryActivity.kt',
  './android/app/src/main/java/unif/reactnativeumeng/example/ddshare/DDShareActivity.kt',
  './android/app/build.gradle',
  './android/gradle.properties',
  '../website/docs/native-setup/android.md',
];

function markdownText(node) {
  if (typeof node.value === 'string') {
    return node.value;
  }
  return Array.isArray(node.children)
    ? node.children.map(markdownText).join('')
    : '';
}

function visitMarkdown(node, callback) {
  callback(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      visitMarkdown(child, callback);
    }
  }
}

function consumerGuideNodes(markdown) {
  const tree = markdownParser.parse(markdown);
  const start = tree.children.findIndex(
    (node) =>
      node.type === 'heading' &&
      node.depth === 2 &&
      /复制到独立消费者 App/.test(markdownText(node))
  );
  if (start === -1) {
    return null;
  }

  const nodes = [];
  for (const node of tree.children.slice(start + 1)) {
    if (node.type === 'heading' && node.depth <= 2) {
      break;
    }
    nodes.push(node);
  }
  return nodes;
}

function verifyConsumerGuide({ failures, source }) {
  const readmePath = 'example/README.md';
  const nodes = consumerGuideNodes(source(readmePath));
  if (nodes === null) {
    failures.push(
      `${readmePath}: independent consumer copy guide section is missing`
    );
    return;
  }

  const prose = nodes.map(markdownText).join('\n');
  const codeBlocks = nodes
    .filter((node) => node.type === 'code')
    .map((node) => node.value);
  const links = new Set();
  for (const node of nodes) {
    visitMarkdown(node, (candidate) => {
      if (candidate.type === 'link' && typeof candidate.url === 'string') {
        links.add(candidate.url);
      }
    });
  }

  let rootManifest;
  try {
    rootManifest = JSON.parse(source('package.json'));
  } catch {
    failures.push('package.json: cannot derive consumer peer dependencies');
    rootManifest = { peerDependencies: {} };
  }

  const installBlock = codeBlocks.find(
    (block) =>
      /\byarn add\b/.test(block) &&
      block.includes('@unif/react-native-umeng')
  );
  if (installBlock === undefined) {
    failures.push(
      `${readmePath}: consumer yarn add command must install the public @unif/react-native-umeng package`
    );
  } else {
    if (installBlock.includes('workspace:*')) {
      failures.push(
        `${readmePath}: consumer yarn add command must not use workspace:*`
      );
    }
    for (const [name, range] of Object.entries(
      rootManifest.peerDependencies ?? {}
    )) {
      if (name === 'react' || name === 'react-native') {
        continue;
      }
      if (!installBlock.includes(`${name}@${range}`)) {
        failures.push(
          `${readmePath}: consumer yarn add command is missing peer ${name}@${range}`
        );
      }
    }
  }

  if (
    !codeBlocks.some(
      (block) =>
        /\bcp\s+-R\b/.test(block) &&
        block.includes('/example/src/.') &&
        block.includes('src/umeng-showcase/')
    )
  ) {
    failures.push(
      `${readmePath}: copy command must copy only example/src/. to src/umeng-showcase/`
    );
  }

  const requiredProse = [
    ['workspace:* is repository-only', /workspace:\*[\s\S]*仅用于本仓/],
    [
      'host provides React and React Native',
      /React 与 React Native 由消费者宿主提供/,
    ],
    [
      'monorepo manifests must not be copied',
      /不要复制[\s\S]*example\/package\.json[\s\S]*metro\.config\.js[\s\S]*react-native\.config\.js/,
    ],
    [
      'Worklets Babel plugin must be last',
      /react-native-worklets\/plugin[\s\S]*(最后一项|末尾)/,
    ],
    ['Android callback package follows applicationId', /applicationId[\s\S]*\.wxapi[\s\S]*\.ddshare/],
    ['library callback manifest must not be duplicated', /不要重复声明[\s\S]*callback Activity/],
    ['AASA Associated Domain uses applinks host only', /applinks:[A-Za-z0-9.-]+[\s\S]*(不含|不要包含)[\s\S]*(scheme|path)/i],
    ['AASA endpoint must not redirect', /apple-app-site-association[\s\S]*(不得|不能|不允许)重定向/],
    ['AASA appID format', /TEAM_ID\.BUNDLE_ID/],
    ['AASA path and domain align with Universal Link', /wechatUniversalLink[\s\S]*(path|路径)[\s\S]*(domain|域名|host)[\s\S]*(一致|对齐)/i],
    ['real callbacks require devices and online domain', /真实[\s\S]*(回包|回调)[\s\S]*真机[\s\S]*线上域名/],
  ];
  for (const [label, pattern] of requiredProse) {
    if (!pattern.test(prose)) {
      failures.push(`${readmePath}: consumer guide is missing ${label}`);
    }
  }

  for (const dependency of androidDependencies) {
    if (!prose.includes(dependency)) {
      failures.push(
        `${readmePath}: consumer guide is missing Android dependency ${dependency}`
      );
    }
  }
  if (!prose.includes('android.enableJetifier=true')) {
    failures.push(
      `${readmePath}: consumer guide is missing android.enableJetifier=true`
    );
  }
  if (!prose.includes('bundle exec pod install')) {
    failures.push(
      `${readmePath}: consumer guide is missing bundle exec pod install`
    );
  }

  for (const link of consumerGuideLinks) {
    if (!links.has(link)) {
      failures.push(
        `${readmePath}: consumer guide is missing link ${link}`
      );
    }
  }
}

function decodeXmlText(value) {
  const entities = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
  };

  return value.replace(
    /&(?:(#)(x)?([0-9a-f]+)|([a-z]+));/gi,
    (entity, numeric, hexadecimal, digits, named) => {
      if (numeric) {
        const radix = hexadecimal ? 16 : 10;
        return String.fromCodePoint(Number.parseInt(digits, radix));
      }
      return entities[named] ?? entity;
    }
  );
}

function attachPlistValue(frame, value) {
  if (frame.type === 'root') {
    if (frame.value !== undefined) {
      throw new Error('plist contains more than one root value');
    }
    frame.value = value;
    return;
  }

  if (frame.type === 'array') {
    frame.value.push(value);
    return;
  }

  if (frame.pendingKey === undefined) {
    throw new Error('plist dict value does not have a key');
  }
  frame.value[frame.pendingKey] = value;
  frame.pendingKey = undefined;
}

export function parsePlist(xml) {
  const stack = [{ type: 'root', value: undefined }];
  const tokenPattern =
    /<!--[\s\S]*?-->|<(dict|array)\b[^>]*>|<\/(dict|array)\s*>|<(key|string|integer|real|data|date)>([\s\S]*?)<\/\3\s*>|<(true|false)\s*\/>/g;

  for (const match of xml.matchAll(tokenPattern)) {
    if (match[0].startsWith('<!--')) {
      continue;
    }

    const openingContainer = match[1];
    const closingContainer = match[2];
    const scalarType = match[3];
    const scalarText = match[4];
    const booleanType = match[5];

    if (openingContainer) {
      const value = openingContainer === 'dict' ? {} : [];
      attachPlistValue(stack.at(-1), value);
      stack.push({
        pendingKey: undefined,
        type: openingContainer,
        value,
      });
      continue;
    }

    if (closingContainer) {
      const frame = stack.pop();
      if (frame?.type !== closingContainer) {
        throw new Error(`plist closes ${closingContainer} out of order`);
      }
      if (frame.pendingKey !== undefined) {
        throw new Error(`plist key ${frame.pendingKey} does not have a value`);
      }
      continue;
    }

    const frame = stack.at(-1);
    if (scalarType === 'key') {
      if (frame.type !== 'dict') {
        throw new Error('plist key appears outside a dict');
      }
      if (frame.pendingKey !== undefined) {
        throw new Error(`plist key ${frame.pendingKey} does not have a value`);
      }
      frame.pendingKey = decodeXmlText(scalarText.trim());
      continue;
    }

    if (scalarType) {
      attachPlistValue(frame, decodeXmlText(scalarText.trim()));
      continue;
    }

    if (booleanType) {
      attachPlistValue(frame, booleanType === 'true');
    }
  }

  if (stack.length !== 1) {
    throw new Error('plist contains an unclosed container');
  }
  if (stack[0].value === undefined) {
    throw new Error('plist does not contain a root value');
  }

  return stack[0].value;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function parseXmlStartTags(xml, elementName) {
  const tags = [];
  const source = xml.replace(/<!--[\s\S]*?-->/g, '');
  const startTagPattern = new RegExp(`<${elementName}\\b([^>]*)>`, 'g');

  for (const match of source.matchAll(startTagPattern)) {
    const attributes = {};
    const attributePattern =
      /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    for (const attribute of match[1].matchAll(attributePattern)) {
      attributes[attribute[1]] = decodeXmlText(
        attribute[2] ?? attribute[3] ?? ''
      );
    }
    tags.push(attributes);
  }

  return tags;
}

function findClosingDelimiter(source, openingIndex, opening, closing) {
  let depth = 0;
  for (let index = openingIndex; index < source.length; index += 1) {
    if (source[index] === opening) {
      depth += 1;
    } else if (source[index] === closing) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function swiftFunctions(source, functionName) {
  const functions = [];
  const pattern = new RegExp(`\\bfunc\\s+${functionName}\\s*\\(`, 'g');

  for (const match of source.matchAll(pattern)) {
    const openingParenthesis = source.indexOf('(', match.index);
    const closingParenthesis = findClosingDelimiter(
      source,
      openingParenthesis,
      '(',
      ')'
    );
    if (closingParenthesis === -1) {
      continue;
    }

    const openingBrace = source.indexOf('{', closingParenthesis);
    if (openingBrace === -1) {
      continue;
    }
    const closingBrace = findClosingDelimiter(source, openingBrace, '{', '}');
    if (closingBrace === -1) {
      continue;
    }

    functions.push({
      body: source.slice(openingBrace + 1, closingBrace),
      signature: source.slice(match.index, openingBrace),
    });
  }

  return functions;
}

function matches(source, pattern) {
  return [...source.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))];
}

function normalizeSwift(source) {
  return stripComments(source).replace(/\s+/g, ' ').trim();
}

function swiftInvocations(source, pattern) {
  const invocations = [];
  for (const match of matches(source, pattern)) {
    const openingParenthesis = match.index + match[0].lastIndexOf('(');
    const closingParenthesis = findClosingDelimiter(
      source,
      openingParenthesis,
      '(',
      ')'
    );
    invocations.push({
      arguments:
        closingParenthesis === -1
          ? undefined
          : normalizeSwift(
              source.slice(openingParenthesis + 1, closingParenthesis)
            ),
      handler: match[1],
      index: match.index,
    });
  }
  return invocations;
}

function expectHandlerPairs({
  body,
  combination,
  expectedPairs,
  failures,
  label,
}) {
  const uncommented = stripComments(body);
  const assignedUmengPattern =
    /\blet\s+umengHandled\s*=\s*UmengBootstrap\.shared\(\)\.(handleOpen|handleUniversalLink)\s*\(/;
  const rawUmengPattern =
    /\bUmengBootstrap\.shared\(\)\.(handleOpen|handleUniversalLink)\s*\(/;
  const assignedReactPattern =
    /\blet\s+reactHandled\s*=\s*RCTLinkingManager\.application\s*\(/;
  const rawReactPattern = /\bRCTLinkingManager\.application\s*\(/;
  const combinationPattern =
    combination === 'return'
      ? /\breturn\s+umengHandled\s*\|\|\s*reactHandled\b/
      : /_\s*=\s*umengHandled\s*\|\|\s*reactHandled\b/;

  const assignedUmeng = swiftInvocations(uncommented, assignedUmengPattern);
  const rawUmeng = matches(uncommented, rawUmengPattern);
  const assignedReact = swiftInvocations(uncommented, assignedReactPattern);
  const rawReact = matches(uncommented, rawReactPattern);
  const combinations = matches(uncommented, combinationPattern);
  const actualHandlers = assignedUmeng.map(({ handler }) => handler);
  const expectedHandlers = expectedPairs.map(({ handler }) => handler);

  if (
    actualHandlers.length !== expectedHandlers.length ||
    actualHandlers.some((handler, index) => handler !== expectedHandlers[index])
  ) {
    failures.push(
      `${label}: expected ordered Umeng handlers ${expectedHandlers.join(
        ', '
      )}; received ${actualHandlers.join(', ') || 'none'}`
    );
    return;
  }

  if (
    rawUmeng.length !== expectedHandlers.length ||
    rawReact.length !== expectedHandlers.length ||
    assignedReact.length !== expectedHandlers.length ||
    combinations.length !== expectedHandlers.length
  ) {
    failures.push(
      `${label}: every Umeng callback must assign both handlers before combining their booleans`
    );
    return;
  }

  for (let index = 0; index < assignedUmeng.length; index += 1) {
    const segmentEnd = assignedUmeng[index + 1]?.index ?? uncommented.length;
    const umengIndex = assignedUmeng[index].index;
    const reactInvocation = assignedReact.find(
      (match) => match.index > umengIndex && match.index < segmentEnd
    );
    const combinationIndex = combinations.find(
      (match) => match.index > umengIndex && match.index < segmentEnd
    )?.index;

    if (
      reactInvocation === undefined ||
      combinationIndex === undefined ||
      reactInvocation.index > combinationIndex
    ) {
      failures.push(
        `${label}: handler pair ${index + 1} must evaluate Umeng and RCTLinking separately before ${combination}`
      );
      continue;
    }

    const expectedPair = expectedPairs[index];
    if (assignedUmeng[index].arguments !== expectedPair.umengArguments) {
      failures.push(
        `${label}: handler pair ${index + 1} must bind Umeng arguments to ${expectedPair.umengArguments}`
      );
    }
    if (reactInvocation.arguments !== expectedPair.reactArguments) {
      failures.push(
        `${label}: handler pair ${index + 1} must bind RCTLinking arguments to ${expectedPair.reactArguments}`
      );
    }

    const segmentStart =
      index === 0
        ? 0
        : combinations[index - 1].index + combinations[index - 1][0].length;
    const prelude = normalizeSwift(uncommented.slice(segmentStart, umengIndex));
    if (
      expectedPair.requiredPrelude?.some(
        (requiredSource) => !prelude.includes(requiredSource)
      )
    ) {
      failures.push(
        `${label}: handler pair ${index + 1} must bind its current context before invoking Umeng`
      );
    }
  }
}

function findSingleFunction(functions, predicate, label, failures) {
  const matching = functions.filter(({ signature }) => predicate(signature));
  if (matching.length !== 1) {
    failures.push(
      `${label}: expected exactly one callback, found ${matching.length}`
    );
    return undefined;
  }
  return matching[0];
}

function verifyIos({ failures, source }) {
  const infoPlistPath = 'example/ios/ReactNativeUmengExample/Info.plist';
  const infoPlist = source(infoPlistPath);
  let plist;
  try {
    plist = parsePlist(infoPlist);
  } catch (error) {
    failures.push(`${infoPlistPath}: ${error.message}`);
  }

  if (plist) {
    const urlTypes = Array.isArray(plist.CFBundleURLTypes)
      ? plist.CFBundleURLTypes
      : [];
    const entrySchemes = (entry) =>
      Array.isArray(entry?.CFBundleURLSchemes)
        ? entry.CFBundleURLSchemes.filter(
            (scheme) => typeof scheme === 'string'
          )
        : [];
    const allUrlSchemes = urlTypes.flatMap(entrySchemes);
    const schemesFor = (name) =>
      urlTypes
        .filter((entry) => entry?.CFBundleURLName === name)
        .flatMap(entrySchemes);
    const wechatSchemes = schemesFor('wechat');
    const dingTalkSchemes = schemesFor('dingtalk');

    if (!wechatSchemes.includes('YOUR_WECHAT_APP_ID')) {
      failures.push(
        `${infoPlistPath}: WeChat URL scheme must use raw placeholder YOUR_WECHAT_APP_ID`
      );
    }
    if (allUrlSchemes.some((scheme) => /^wxYOUR/i.test(scheme))) {
      failures.push(
        `${infoPlistPath}: WeChat URL scheme placeholder must not have a wx prefix`
      );
    }
    if (!dingTalkSchemes.includes('YOUR_DINGTALK_APP_KEY_OR_CLIENT_ID')) {
      failures.push(
        `${infoPlistPath}: DingTalk URL scheme must use raw placeholder YOUR_DINGTALK_APP_KEY_OR_CLIENT_ID`
      );
    }
    if (allUrlSchemes.some((scheme) => /^ding(?:oa)?YOUR/i.test(scheme))) {
      failures.push(
        `${infoPlistPath}: DingTalk URL scheme placeholder must not have a vendor prefix`
      );
    }
  }

  const appDelegatePath =
    'example/ios/ReactNativeUmengExample/AppDelegate.swift';
  const appDelegate = source(appDelegatePath);
  const applicationFunctions = swiftFunctions(appDelegate, 'application');
  const appOpen = findSingleFunction(
    applicationFunctions,
    (signature) =>
      /\b_\s+application:\s*UIApplication\b/.test(signature) &&
      /\bopen\s+url:\s*URL\b/.test(signature) &&
      /\boptions:\s*\[UIApplication\.OpenURLOptionsKey:\s*Any\]\s*=\s*\[:\]/.test(
        signature
      ),
    `${appDelegatePath} URL callback`,
    failures
  );
  const appUniversalLink = findSingleFunction(
    applicationFunctions,
    (signature) =>
      /\b_\s+application:\s*UIApplication\b/.test(signature) &&
      /\bcontinue\s+userActivity:\s*NSUserActivity\b/.test(signature) &&
      /\brestorationHandler:\s*@escaping\s*\(\[UIUserActivityRestoring\]\?\)\s*->\s*Void/.test(
        signature
      ),
    `${appDelegatePath} Universal Link callback`,
    failures
  );

  if (appOpen) {
    expectHandlerPairs({
      body: appOpen.body,
      combination: 'return',
      expectedPairs: [
        {
          handler: 'handleOpen',
          reactArguments: 'application, open: url, options: options',
          umengArguments: 'url, options: options',
        },
      ],
      failures,
      label: `${appDelegatePath} URL callback`,
    });
  }
  if (appUniversalLink) {
    expectHandlerPairs({
      body: appUniversalLink.body,
      combination: 'return',
      expectedPairs: [
        {
          handler: 'handleUniversalLink',
          reactArguments:
            'application, continue: userActivity, restorationHandler: restorationHandler',
          umengArguments: 'userActivity',
        },
      ],
      failures,
      label: `${appDelegatePath} Universal Link callback`,
    });
  }

  const sceneDelegatePath =
    'example/ios/ReactNativeUmengExample/SceneDelegateFixture.swift';
  const sceneDelegate = source(sceneDelegatePath);
  const sceneFunctions = swiftFunctions(sceneDelegate, 'scene');
  const sceneOpen = findSingleFunction(
    sceneFunctions,
    (signature) =>
      /\b_\s+scene:\s*UIScene\b/.test(signature) &&
      /\bopenURLContexts\s+URLContexts:\s*Set<UIOpenURLContext>/.test(
        signature
      ),
    `${sceneDelegatePath} URL callback`,
    failures
  );
  const sceneUniversalLink = findSingleFunction(
    sceneFunctions,
    (signature) =>
      /\b_\s+scene:\s*UIScene\b/.test(signature) &&
      /\bcontinue\s+userActivity:\s*NSUserActivity\b/.test(signature),
    `${sceneDelegatePath} Universal Link callback`,
    failures
  );
  const sceneConnection = findSingleFunction(
    sceneFunctions,
    (signature) =>
      /\b_\s+scene:\s*UIScene\b/.test(signature) &&
      /\bwillConnectTo\s+session:\s*UISceneSession\b/.test(signature) &&
      /\boptions\s+connectionOptions:\s*UIScene\.ConnectionOptions\b/.test(
        signature
      ),
    `${sceneDelegatePath} connection callback`,
    failures
  );

  if (sceneOpen) {
    expectHandlerPairs({
      body: sceneOpen.body,
      combination: 'discard',
      expectedPairs: [
        {
          handler: 'handleOpen',
          reactArguments:
            'UIApplication.shared, open: context.url, options: options',
          requiredPrelude: [
            'for context in URLContexts {',
            'let options = applicationOptions(for: context)',
          ],
          umengArguments: 'context.url, options: options',
        },
      ],
      failures,
      label: `${sceneDelegatePath} URL callback`,
    });
  }
  if (sceneUniversalLink) {
    expectHandlerPairs({
      body: sceneUniversalLink.body,
      combination: 'discard',
      expectedPairs: [
        {
          handler: 'handleUniversalLink',
          reactArguments:
            'UIApplication.shared, continue: userActivity, restorationHandler: { _ in }',
          umengArguments: 'userActivity',
        },
      ],
      failures,
      label: `${sceneDelegatePath} Universal Link callback`,
    });
  }
  if (sceneConnection) {
    expectHandlerPairs({
      body: sceneConnection.body,
      combination: 'discard',
      expectedPairs: [
        {
          handler: 'handleOpen',
          reactArguments:
            'UIApplication.shared, open: context.url, options: options',
          requiredPrelude: [
            'for context in connectionOptions.urlContexts {',
            'let options = applicationOptions(for: context)',
          ],
          umengArguments: 'context.url, options: options',
        },
        {
          handler: 'handleUniversalLink',
          reactArguments:
            'UIApplication.shared, continue: userActivity, restorationHandler: { _ in }',
          requiredPrelude: [
            'for userActivity in connectionOptions.userActivities {',
          ],
          umengArguments: 'userActivity',
        },
      ],
      failures,
      label: `${sceneDelegatePath} connection callback`,
    });
  }
}

function verifyCallbackClass({
  className,
  expectedBaseClass,
  expectedImport,
  expectedPackage,
  failures,
  path,
  source,
}) {
  const kotlin = stripComments(source(path));
  const packageMatch = /^\s*package\s+([A-Za-z_][\w.]*)\s*$/m.exec(kotlin);
  if (packageMatch?.[1] !== expectedPackage) {
    failures.push(`${path}: package must be ${expectedPackage}`);
  }

  const imports = new Set(
    [...kotlin.matchAll(/^\s*import\s+([A-Za-z_][\w.]*)\s*$/gm)].map(
      (match) => match[1]
    )
  );
  if (!imports.has(expectedImport)) {
    failures.push(`${path}: import must include ${expectedImport}`);
  }

  const classPattern = new RegExp(
    `\\bclass\\s+${className}\\s*:\\s*${expectedBaseClass}\\s*\\(\\s*\\)`
  );
  if (!classPattern.test(kotlin)) {
    failures.push(`${path}: ${className} must extend ${expectedBaseClass}`);
  }
}

function parseGradleStringProperty({
  buildGradle,
  failures,
  path,
  property,
}) {
  const pattern = new RegExp(
    `^\\s*${property}\\s*(?:=\\s*)?(["'])([^"']+)\\1\\s*$`,
    'gm'
  );
  const values = [...buildGradle.matchAll(pattern)].map((match) => match[2]);
  if (values.length !== 1) {
    failures.push(
      `${path}: ${property} must be exactly one string literal`
    );
    return '';
  }
  return values[0];
}

function normalizeAndroidComponentName(name, { applicationId, namespace }) {
  if (typeof name !== 'string') {
    return name;
  }

  const expanded = name.replaceAll('${applicationId}', applicationId);
  return expanded.startsWith('.') ? `${namespace}${expanded}` : expanded;
}

function verifyAndroid({ failures, source }) {
  const buildGradlePath = 'example/android/app/build.gradle';
  const buildGradle = stripComments(source(buildGradlePath));
  const namespace = parseGradleStringProperty({
    buildGradle,
    failures,
    path: buildGradlePath,
    property: 'namespace',
  });
  const applicationId = parseGradleStringProperty({
    buildGradle,
    failures,
    path: buildGradlePath,
    property: 'applicationId',
  });
  const manifestPath = 'example/android/app/src/main/AndroidManifest.xml';
  const manifest = source(manifestPath);
  const activityNames = parseXmlStartTags(manifest, 'activity').map(
    (attributes) => attributes['android:name']
  );
  const normalizedActivityNames = activityNames.map((name) => ({
    name,
    normalized: normalizeAndroidComponentName(name, {
      applicationId,
      namespace,
    }),
  }));

  if (
    !normalizedActivityNames.some(
      ({ normalized }) => normalized === `${namespace}.MainActivity`
    )
  ) {
    failures.push(`${manifestPath}: MainActivity must remain declared`);
  }
  for (const duplicateName of [
    `${applicationId}.wxapi.WXEntryActivity`,
    `${applicationId}.ddshare.DDShareActivity`,
  ]) {
    const duplicate = normalizedActivityNames.find(
      ({ normalized }) => normalized === duplicateName
    );
    if (duplicate !== undefined) {
      failures.push(
        `${manifestPath}: duplicate callback Activity ${duplicate.name} resolves to ${duplicateName} and must be removed`
      );
    }
  }

  verifyCallbackClass({
    className: 'WXEntryActivity',
    expectedBaseClass: 'WXCallbackActivity',
    expectedImport: 'com.umeng.socialize.weixin.view.WXCallbackActivity',
    expectedPackage: `${applicationId}.wxapi`,
    failures,
    path: 'example/android/app/src/main/java/unif/reactnativeumeng/example/wxapi/WXEntryActivity.kt',
    source,
  });
  verifyCallbackClass({
    className: 'DDShareActivity',
    expectedBaseClass: 'DingCallBack',
    expectedImport: 'com.umeng.socialize.media.DingCallBack',
    expectedPackage: `${applicationId}.ddshare`,
    failures,
    path: 'example/android/app/src/main/java/unif/reactnativeumeng/example/ddshare/DDShareActivity.kt',
    source,
  });

  const compileDependencies = new Set(
    [
      ...buildGradle.matchAll(
        /^\s*implementation\s*\(\s*(["'])([^"']+)\1\s*\)\s*$/gm
      ),
    ].map((match) => match[2])
  );
  for (const dependency of androidDependencies) {
    if (!compileDependencies.has(dependency)) {
      failures.push(
        `${buildGradlePath}: compile dependency ${dependency} is missing`
      );
    }
  }
}

function createSourceReader(repositoryRoot, failures) {
  return (relativePath) => {
    try {
      return readFileSync(resolve(repositoryRoot, relativePath), 'utf8');
    } catch {
      failures.push(`${relativePath}: file is missing`);
      return '';
    }
  };
}

export function collectExampleDocsContractFailures({
  repositoryRoot = defaultRepositoryRoot,
} = {}) {
  const failures = [];
  verifyConsumerGuide({
    failures,
    source: createSourceReader(repositoryRoot, failures),
  });
  return failures;
}

export function collectExampleContractFailures({
  platform = 'all',
  repositoryRoot = defaultRepositoryRoot,
} = {}) {
  if (!['all', 'android', 'ios'].includes(platform)) {
    throw new Error(`unsupported example contract platform: ${platform}`);
  }

  const failures = [];
  const source = createSourceReader(repositoryRoot, failures);

  if (platform === 'all' || platform === 'android') {
    verifyAndroid({ failures, source });
  }
  if (platform === 'all' || platform === 'ios') {
    verifyIos({ failures, source });
  }
  if (platform === 'all') {
    verifyConsumerGuide({ failures, source });
  }

  return failures;
}

function reportExampleContract(platform = 'all') {
  const failures = collectExampleContractFailures({ platform });
  if (failures.length > 0) {
    console.error(`Example contract verification failed (${failures.length}):`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Example contract verification passed (${platform}).`);
}

if (isDirectExecution(import.meta.url)) {
  reportExampleContract();
}
