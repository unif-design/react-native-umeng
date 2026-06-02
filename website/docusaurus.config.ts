import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import pkg from '../package.json';

const config: Config = {
  title: 'Unif Umeng',
  tagline: '@unif/react-native-umeng · 友盟 RN 桥 (U-Share + U-App)',
  favicon: 'img/logo.png',

  // 部署到 GitHub Pages 默认域名:https://unif-design.github.io/react-native-umeng/
  // 后续接自定义域名只需把 url 改成新域名 + baseUrl 改为 '/' + 加 static/CNAME 文件。
  url: 'https://unif-design.github.io',
  baseUrl: '/react-native-umeng/',

  organizationName: 'unif-design',
  projectName: 'react-native-umeng',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl: undefined,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    // 让文档站直接 import `@unif/react-native-umeng` 源码并在浏览器渲染。
    // 通过 webpack alias 把 npm 包名映射到 ../src/index.ts,保持源码 hot reload。
    // 注意:Native 调用(NativeUmengCommon/Share/Analytics)在浏览器没有原生侧,
    // 仅用作类型 + ShareSheet UI 的视觉预览,真分享需要装好友盟/微信/钉钉 SDK。
    './src/plugins/docusaurus-rnw',
  ],

  clientModules: [
    // 在 React 树启动前给 window 上注入 `global = window`,
    // 让 @gorhom/bottom-sheet 等 RN 库的 lib/module/*.js 顶层 `global.X` 跑通。
    './src/clientModules/rn-globals.ts',
  ],

  themeConfig: {
    image: 'img/logo.png',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Unif Umeng',
      logo: {
        alt: 'Unif',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: '文档',
        },
        {
          type: 'html',
          position: 'right',
          value: `<span class="navbar-version">v${pkg.version}</span>`,
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: '文档',
          items: [
            { label: '简介', to: '/docs/intro' },
            { label: '快速上手', to: '/docs/getting-started/quick-start' },
            { label: '分享指南', to: '/docs/guides/sharing' },
            { label: '原生配置', to: '/docs/native-setup/ios' },
          ],
        },
        {
          title: '资源',
          items: [
            { label: 'npm', href: 'https://www.npmjs.com/package/@unif/react-native-umeng' },
            { label: 'GitHub', href: 'https://github.com/unif-design/react-native-umeng' },
          ],
        },
        {
          title: 'Unif 生态',
          items: [
            { label: '文档总站', href: 'https://unif.design' },
            { label: '设计系统 design', href: 'https://unif-design.github.io/react-native-design/' },
            { label: '相机 camera', href: 'https://unif-design.github.io/react-native-camera/' },
            { label: '华为扫码 hms-scan', href: 'https://unif-design.github.io/react-native-hms-scan/' },
          ],
        },
      ],
      copyright: '@unif/react-native-umeng · MIT',
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['bash', 'tsx', 'jsx', 'ruby', 'kotlin', 'swift'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
