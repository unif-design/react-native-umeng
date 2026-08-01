'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const b = require('./build-llms.js');

const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

test('parseFrontmatter 解析 description', () => {
  const pf = b.parseFrontmatter(
    '---\ntitle: T\ndescription: D 描述\n---\nbody'
  );
  assert.strictEqual(pf.description, 'D 描述');
});

test('多行 LiveDemo 转为 tsx 代码块并保留后文', () => {
  const output = b.stripMdxNoise(
    '## 预览\r\n<LiveDemo>\r\n  <Button variant="primary" />\r\n</LiveDemo>\r\n## 后文\r\n正文\r\n'
  );
  assert(output.includes('```tsx'), 'LiveDemo 应转成 tsx 代码块');
  assert(output.includes('<Button variant="primary" />'), '应保留组件用法');
  assert(!output.includes('<LiveDemo'), '不应保留 LiveDemo wrapper');
  assert(output.includes('## 后文\r\n正文'), '不得吞掉 CRLF 后文');
});

test('同一行闭合的 LiveDemo 不会吞掉后文', () => {
  const output = b.stripMdxNoise(
    '<LiveDemo><Button variant="primary" /></LiveDemo>\n\n## 后文\n正文\n'
  );
  assert(output.includes('<Button variant="primary" />'), '应保留组件用法');
  assert(!output.includes('<LiveDemo'), '不应保留 LiveDemo wrapper');
  assert(output.includes('```\n\n## 后文\n正文'), '后文必须位于代码块之后');
});

test('自闭合 LiveDemo 被移除且不会吞掉后文', () => {
  const output = b.stripMdxNoise('<LiveDemo />\n\n## 后文\n正文\n');
  assert(!output.includes('LiveDemo'), '应移除自闭合组件噪音');
  assert(output.includes('## 后文\n正文'), '不得吞掉自闭合组件后的正文');
  assert(!output.includes('```tsx'), '无组件用法时不应生成空代码块');
});

test('formatIndexLine 正确处理 description', () => {
  assert.strictEqual(
    b.formatIndexLine({
      title: 'Button 按钮',
      mdPath: '/react-native-umeng/md/components/button.md',
      description: '主/次',
    }),
    '- [Button 按钮](/react-native-umeng/md/components/button.md) — 主/次'
  );
  assert.strictEqual(
    b.formatIndexLine({
      title: 'X',
      mdPath: '/react-native-umeng/md/x.md',
      description: null,
    }),
    '- [X](/react-native-umeng/md/x.md)'
  );
});

test('概览 section 排在最前', () => {
  assert.deepStrictEqual(b.sortSections(['components', '概览', 'design']), [
    '概览',
    'components',
    'design',
  ]);
});

test('全文目录包含标题', () => {
  assert(b.buildToc(['A', 'B']).startsWith('## 目录'));
  assert(b.buildToc(['A', 'B']).includes('- A'));
});

test('main 生成带 baseUrl 的索引与当前 Common/Share 契约', () => {
  const websiteRoot = path.join(__dirname, '..');
  execFileSync(process.execPath, [path.join(__dirname, 'build-llms.js')], {
    cwd: websiteRoot,
    stdio: 'pipe',
  });

  const llms = fs.readFileSync(
    path.join(websiteRoot, 'static/llms.txt'),
    'utf8'
  );
  const full = fs.readFileSync(
    path.join(websiteRoot, 'static/llms-full.txt'),
    'utf8'
  );

  assert(llms.startsWith('# Unif Umeng\n'), 'llms.txt 标题应来自站点配置');
  assert(
    full.startsWith('# Unif Umeng — 全文文档聚合\n'),
    'llms-full.txt 标题应来自站点配置'
  );
  assert(
    llms.includes('](/react-native-umeng/md/intro.md)'),
    '索引链接必须包含 Docusaurus baseUrl'
  );
  assert(!llms.includes('](/md/'), '索引中不得出现部署后失效的根路径链接');
  assert(
    full.includes('Common.preInit(config)'),
    '全文应包含 Common.preInit 契约'
  );
  assert(full.includes('E_NOT_INITIALIZED'), '全文应包含初始化门禁错误码');
  assert(full.includes('Share.openSheet'), '全文应包含公开 Share API');
  assert(
    full.includes("code: 'success'"),
    '全文应说明 ShareResult 只有 success'
  );
});

if (failures.length > 0) {
  console.error(`\n${failures.length} TEST(S) FAILED`);
  process.exitCode = 1;
} else {
  console.log('\nALL PASS');
}
