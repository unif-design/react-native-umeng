import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function expectHandlerPairs({
  body,
  combination,
  expectedHandlers,
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

  const assignedUmeng = matches(uncommented, assignedUmengPattern);
  const rawUmeng = matches(uncommented, rawUmengPattern);
  const assignedReact = matches(uncommented, assignedReactPattern);
  const rawReact = matches(uncommented, rawReactPattern);
  const combinations = matches(uncommented, combinationPattern);
  const actualHandlers = assignedUmeng.map((match) => match[1]);

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
    const reactIndex = assignedReact.find(
      (match) => match.index > umengIndex && match.index < segmentEnd
    )?.index;
    const combinationIndex = combinations.find(
      (match) => match.index > umengIndex && match.index < segmentEnd
    )?.index;

    if (
      reactIndex === undefined ||
      combinationIndex === undefined ||
      reactIndex > combinationIndex
    ) {
      failures.push(
        `${label}: handler pair ${index + 1} must evaluate Umeng and RCTLinking separately before ${combination}`
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
    const schemesFor = (name) => {
      const entry = urlTypes.find(
        (candidate) => candidate?.CFBundleURLName === name
      );
      return Array.isArray(entry?.CFBundleURLSchemes)
        ? entry.CFBundleURLSchemes
        : [];
    };
    const wechatSchemes = schemesFor('wechat');
    const dingTalkSchemes = schemesFor('dingtalk');

    if (!wechatSchemes.includes('YOUR_WECHAT_APP_ID')) {
      failures.push(
        `${infoPlistPath}: WeChat URL scheme must use raw placeholder YOUR_WECHAT_APP_ID`
      );
    }
    if (wechatSchemes.some((scheme) => /^wxYOUR/i.test(scheme))) {
      failures.push(
        `${infoPlistPath}: WeChat URL scheme placeholder must not have a wx prefix`
      );
    }
    if (!dingTalkSchemes.includes('YOUR_DINGTALK_APP_KEY_OR_CLIENT_ID')) {
      failures.push(
        `${infoPlistPath}: DingTalk URL scheme must use raw placeholder YOUR_DINGTALK_APP_KEY_OR_CLIENT_ID`
      );
    }
    if (dingTalkSchemes.some((scheme) => /^ding(?:oa)?YOUR/i.test(scheme))) {
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
    (signature) => /\bopen\s+url:\s*URL\b/.test(signature),
    `${appDelegatePath} URL callback`,
    failures
  );
  const appUniversalLink = findSingleFunction(
    applicationFunctions,
    (signature) =>
      /\bcontinue\s+userActivity:\s*NSUserActivity\b/.test(signature),
    `${appDelegatePath} Universal Link callback`,
    failures
  );

  if (appOpen) {
    expectHandlerPairs({
      body: appOpen.body,
      combination: 'return',
      expectedHandlers: ['handleOpen'],
      failures,
      label: `${appDelegatePath} URL callback`,
    });
  }
  if (appUniversalLink) {
    expectHandlerPairs({
      body: appUniversalLink.body,
      combination: 'return',
      expectedHandlers: ['handleUniversalLink'],
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
    (signature) => /\bopenURLContexts\s+URLContexts:/.test(signature),
    `${sceneDelegatePath} URL callback`,
    failures
  );
  const sceneUniversalLink = findSingleFunction(
    sceneFunctions,
    (signature) =>
      /\bcontinue\s+userActivity:\s*NSUserActivity\b/.test(signature),
    `${sceneDelegatePath} Universal Link callback`,
    failures
  );
  const sceneConnection = findSingleFunction(
    sceneFunctions,
    (signature) => /\bwillConnectTo\s+session:/.test(signature),
    `${sceneDelegatePath} connection callback`,
    failures
  );

  if (sceneOpen) {
    expectHandlerPairs({
      body: sceneOpen.body,
      combination: 'discard',
      expectedHandlers: ['handleOpen'],
      failures,
      label: `${sceneDelegatePath} URL callback`,
    });
  }
  if (sceneUniversalLink) {
    expectHandlerPairs({
      body: sceneUniversalLink.body,
      combination: 'discard',
      expectedHandlers: ['handleUniversalLink'],
      failures,
      label: `${sceneDelegatePath} Universal Link callback`,
    });
  }
  if (sceneConnection) {
    expectHandlerPairs({
      body: sceneConnection.body,
      combination: 'discard',
      expectedHandlers: ['handleOpen', 'handleUniversalLink'],
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

function verifyAndroid({ failures, source }) {
  const manifestPath = 'example/android/app/src/main/AndroidManifest.xml';
  const manifest = source(manifestPath);
  const activityNames = parseXmlStartTags(manifest, 'activity').map(
    (attributes) => attributes['android:name']
  );

  if (!activityNames.includes('.MainActivity')) {
    failures.push(`${manifestPath}: MainActivity must remain declared`);
  }
  for (const duplicateName of [
    '.wxapi.WXEntryActivity',
    '.ddshare.DDShareActivity',
  ]) {
    if (activityNames.includes(duplicateName)) {
      failures.push(
        `${manifestPath}: duplicate callback Activity ${duplicateName} must be removed`
      );
    }
  }

  verifyCallbackClass({
    className: 'WXEntryActivity',
    expectedBaseClass: 'WXCallbackActivity',
    expectedImport: 'com.umeng.socialize.weixin.view.WXCallbackActivity',
    expectedPackage: 'unif.reactnativeumeng.example.wxapi',
    failures,
    path: 'example/android/app/src/main/java/unif/reactnativeumeng/example/wxapi/WXEntryActivity.kt',
    source,
  });
  verifyCallbackClass({
    className: 'DDShareActivity',
    expectedBaseClass: 'DingCallBack',
    expectedImport: 'com.umeng.socialize.media.DingCallBack',
    expectedPackage: 'unif.reactnativeumeng.example.ddshare',
    failures,
    path: 'example/android/app/src/main/java/unif/reactnativeumeng/example/ddshare/DDShareActivity.kt',
    source,
  });

  const buildGradlePath = 'example/android/app/build.gradle';
  const buildGradle = stripComments(source(buildGradlePath));
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

export function collectExampleContractFailures({
  platform = 'all',
  repositoryRoot = defaultRepositoryRoot,
} = {}) {
  if (!['all', 'android', 'ios'].includes(platform)) {
    throw new Error(`unsupported example contract platform: ${platform}`);
  }

  const failures = [];
  const source = (relativePath) => {
    try {
      return readFileSync(resolve(repositoryRoot, relativePath), 'utf8');
    } catch {
      failures.push(`${relativePath}: file is missing`);
      return '';
    }
  };

  if (platform === 'all' || platform === 'android') {
    verifyAndroid({ failures, source });
  }
  if (platform === 'all' || platform === 'ios') {
    verifyIos({ failures, source });
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
