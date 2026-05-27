import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

export default function Home(): React.JSX.Element {
  return (
    <Layout
      title="Unif Umeng"
      description="@unif/react-native-umeng — 友盟 RN 桥(U-Share 微信/钉钉 + U-App)"
    >
      <header className="unif-hero">
        <div className="unif-hero__inner">
          <span className="unif-hero__pill">@UNIF/REACT-NATIVE-UMENG · v0.1</span>
          <h1 className="unif-hero__title">Unif Umeng</h1>
          <p className="unif-hero__lede">
            友盟 U-Share(微信会话 / 钉钉)+ U-App 移动统计的 React Native 桥。命令式 ShareSheet,PIPL 合规默认就绪。
          </p>
          <div className="unif-hero__ctas">
            <Link to="/docs/intro" className="unif-hero__cta unif-hero__cta--primary">
              开始使用 →
            </Link>
            <Link to="/docs/share-sheet" className="unif-hero__cta unif-hero__cta--ghost">
              ShareSheet
            </Link>
          </div>
        </div>
      </header>
    </Layout>
  );
}
