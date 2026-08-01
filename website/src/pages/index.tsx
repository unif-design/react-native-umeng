import React, { useState } from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import '@unif/react-native-design/docs-home.css';

import {
  IconShare,
  IconChart,
  IconShield,
  IconClose,
  IconChevronRight,
  IconArrowRight,
  IconCopy,
  IconCheck,
  WeChatGlyph,
  DingTalkGlyph,
} from '../components/home/icons';

/* ─── Code Window ─── */
type CodeLine = React.ReactNode;

interface CodeWindowProps {
  file: string;
  tag: string;
  hl: number;
  lines: CodeLine[];
}

function CodeWindow({
  file,
  tag,
  hl,
  lines,
}: CodeWindowProps): React.JSX.Element {
  return (
    <div className="hp-code compact">
      <div className="hp-code-bar">
        <span className="hp-code-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="hp-code-file">{file}</span>
        <span className="hp-code-tag">{tag}</span>
      </div>
      <div className="hp-code-body">
        <pre>
          {lines.map((node, i) => (
            <div key={i} className={'hp-cl' + (hl === i + 1 ? ' hl' : '')}>
              <span className="ln">{i + 1}</span>
              {node}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

/* ─── Phone Mockup ─── */
function Phone({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="hp-phone">
      <div className="hp-screen">
        <div className="hp-notch" />
        {children}
      </div>
    </div>
  );
}

/* ─── Share Screen (umeng social share sheet over a 拜访总结 backdrop) ─── */
const SHARE_TARGETS = [
  { Glyph: WeChatGlyph, label: '微信', sub: '发送给好友或群' },
  { Glyph: DingTalkGlyph, label: '钉钉', sub: '发送至工作群' },
] as const;

function ShareScreen(): React.JSX.Element {
  return (
    <div className="hp-share">
      <div className="hp-share-bg">
        <div className="hp-sb-nav">
          <span>拜访总结</span>
          <span className="hp-sb-share">
            <IconShare s={16} />
          </span>
        </div>
        <div className="hp-sb-card">
          <div className="hp-sb-eyebrow">AI 总结</div>
          <div className="hp-sb-title">东方便利店 · 北苑店</div>
          <div className="hp-sb-line" />
          <div className="hp-sb-line short" />
        </div>
      </div>
      <div className="hp-share-scrim" />
      <div className="hp-sheet">
        <span className="hp-sheet-grab" />
        <div className="hp-sheet-head">
          <span className="hp-sheet-title">分享至</span>
          <span className="hp-sheet-x">
            <IconClose s={13} />
          </span>
        </div>
        <div className="hp-sheet-list">
          {SHARE_TARGETS.map((t, i) => (
            <div className="hp-sheet-cell" key={i}>
              <t.Glyph size={36} />
              <div className="hp-sheet-body">
                <div className="t">{t.label}</div>
                <div className="s">{t.sub}</div>
              </div>
              <IconChevronRight s={16} />
            </div>
          ))}
        </div>
        <div className="hp-sheet-cancel">取消</div>
      </div>
    </div>
  );
}

/* ─── Install command ─── */
const INSTALL_COMMAND = [
  'yarn add @unif/react-native-umeng',
  "'@sbaiahmed1/react-native-blur@>=4'",
  "'@unif/react-native-design@^0.20.0'",
  "'react-native-gesture-handler@>=3.0.0 <4.0.0'",
  "'react-native-reanimated@^4.5.3'",
  "'react-native-reanimated-carousel@>=5.0.0 <6.0.0'",
  "'react-native-safe-area-context@>=5'",
  "'react-native-svg@>=15'",
  "'react-native-worklets@^0.11.3'",
].join(' ');

function InstallBlock(): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(INSTALL_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="hp-install">
      <span className="dollar">$</span>
      <span>
        yarn add <span className="pkg">@unif/react-native-umeng</span> …（8
        peers）
      </span>
      <button
        className={'hp-install-copy' + (copied ? ' copied' : '')}
        title="复制完整 Yarn 安装命令（含全部 peers）"
        aria-label="复制完整 Yarn 安装命令（含全部 peers）"
        onClick={handleCopy}
      >
        {copied ? <IconCheck s={15} /> : <IconCopy s={15} />}
      </button>
    </div>
  );
}

/* ─── Syntax token helpers ─── */
const K = (kw: string) => <span className="tok-kw">{kw}</span>;
const ST = (s: string) => <span className="tok-str">{s}</span>;
const FN = (s: string) => <span className="tok-fn">{s}</span>;

// shareVisit.ts — public barrel 可直接复制的 openSheet 示例
const CODE_LINES: CodeLine[] = [
  <>
    {K('import')} <span className="tok-id">{'{ Share }'}</span> {K('from')}{' '}
    {ST("'@unif/react-native-umeng'")}
  </>,
  <> </>,
  <>
    {K('await')} <span className="tok-id">Share</span>.{FN('openSheet')}({'{'}
  </>,
  <>
    {'  '}type: {ST("'link'")},
  </>,
  <>
    {'  '}title: {ST("'拜访总结'")},
  </>,
  <>
    {'  '}url: <span className="tok-id">visit</span>.url,
  </>,
  <>{'}'})</>,
];

/* ─── Feature card data ─── */
interface Feature {
  Icon: React.ComponentType<{ s?: number }>;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    Icon: IconShare,
    title: '社会化分享',
    desc: '一次调用唤起微信会话 / 钉钉分享，支持链接 · 图片 · 文本；成功 resolve，取消 / 失败 reject UmengError。',
  },
  {
    Icon: IconChart,
    title: '友盟移动统计',
    desc: 'U-App 页面与自定义事件埋点，会话 / 渠道分析打通友盟后台数据看板。',
  },
  {
    Icon: IconShield,
    title: '合规初始化',
    desc: 'preInit 只保存 JS 配置快照；用户同意隐私协议后，无参 init 才进入 native/vendor 并开始采集。',
  },
];

/* ─── Page ─── */
export default function Home(): React.JSX.Element {
  return (
    <Layout
      title="Unif Umeng — 社会化分享 微信·钉钉·统计"
      description="@unif/react-native-umeng — 友盟+ U-Share + U-App 的 React Native 封装：微信会话 / 钉钉分享，叠加友盟移动统计，内置合规初始化与隐私授权时机控制。"
    >
      <main className="unif-home">
        {/* ── Hero ── */}
        <section className="hp-hero">
          <div className="hp-hero-split hp-hero-final">
            {/* Copy side */}
            <div className="hp-hero-copy">
              <span className="hp-eyebrow">@unif/react-native-umeng</span>
              <h1 className="hp-title">
                社会化分享，
                <br />
                <span className="accent">微信 · 钉钉 · 统计</span>
              </h1>
              <p className="hp-tagline">
                友盟+ U-Share + U-App 的 React Native 封装：微信会话 /
                钉钉分享，叠加友盟移动统计，内置合规初始化与隐私授权时机控制。
              </p>
              <div className="hp-cta-row">
                <Link to="/docs/intro" className="hp-btn hp-btn-primary">
                  开始使用{' '}
                  <span className="hp-arrow">
                    <IconArrowRight s={18} />
                  </span>
                </Link>
                <Link
                  to="/docs/getting-started/quick-start"
                  className="hp-btn hp-btn-outline"
                >
                  快速开始
                </Link>
              </div>
              <InstallBlock />
              <div className="hp-meta-row">
                <span className="hp-chip">
                  <span className="dot" />
                  U-Share
                </span>
                <span className="hp-chip">U-App 统计</span>
                <span className="hp-chip">合规初始化</span>
              </div>
            </div>

            {/* Combo side: code window + phone mockup */}
            <div className="hp-combo">
              <div className="hp-combo-code">
                <CodeWindow
                  file="shareVisit.ts"
                  tag="UMShare"
                  hl={4}
                  lines={CODE_LINES}
                />
              </div>
              <div className="hp-combo-phone">
                <Phone>
                  <ShareScreen />
                </Phone>
              </div>
              <span className="hp-combo-badge">
                <span className="dot" />
                原生分享面板
              </span>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="hp-features">
          <div className="hp-sec-label">核心能力</div>
          <div
            className="hp-feature-grid"
            style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
          >
            {FEATURES.map((f, i) => (
              <div className="hp-feature" key={i}>
                <div className="hp-feat-icon">
                  <f.Icon s={24} />
                </div>
                <h3 className="hp-feat-title">{f.title}</h3>
                <p className="hp-feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}
