import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: '快速开始',
      collapsed: false,
      items: ['getting-started/installation', 'getting-started/quick-start'],
    },
    {
      type: 'category',
      label: '指南',
      collapsed: false,
      items: ['guides/sharing', 'guides/analytics', 'guides/privacy-pipl'],
    },
    {
      type: 'category',
      label: '原生配置',
      collapsed: false,
      items: ['native-setup/ios', 'native-setup/android'],
    },
    {
      type: 'category',
      label: 'API 参考',
      collapsed: false,
      items: [
        'api/common',
        'api/share',
        'api/analytics',
        'api/platform-sharesheethost',
      ],
    },
    'testing',
    'troubleshooting',
  ],
};

export default sidebars;
