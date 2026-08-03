import { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Button as RNButton,
  StyleSheet,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@unif/react-native-design';
import {
  Common,
  Share,
  Analytics,
  Platform,
  ShareSheetHost,
  UmengError,
  type ShareResult,
  type UmengInitConfig,
} from '@unif/react-native-umeng';

// 仅用于接线演示；真机验证前必须替换为开放平台登记的测试凭据。
const UMENG_CONFIG: UmengInitConfig = {
  appkey: 'YOUR_UMENG_APPKEY',
  wechatAppId: 'YOUR_WECHAT_APP_ID',
  wechatAppSecret: 'YOUR_WECHAT_APP_SECRET',
  wechatUniversalLink: 'https://your.host/path/',
  dingtalkAppId: 'YOUR_DINGTALK_APP_ID',
};

type InitState =
  | 'preparing'
  | 'awaitingConsent'
  | 'initializing'
  | 'initialized'
  | 'failed';

export default function App() {
  return (
    // 外层 root 服务于 App 其它 RNGH UI；ShareSheetHost 的 Modal 内已有自己的 root。
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <DemoScreen />
        <ShareSheetHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function DemoScreen() {
  const [log, setLog] = useState<string>('—');
  const [initState, setInitState] = useState<InitState>('preparing');
  const append = (line: string) =>
    setLog((prev) => `${line}\n${prev}`.slice(0, 1200));

  useEffect(() => {
    let active = true;

    // App 启动、用户授权前执行：Common.preInit 只保存 JS 配置快照。
    Common.preInit(UMENG_CONFIG)
      .then(() => {
        if (!active) return;
        setInitState('awaitingConsent');
        append('✓ preInit 完成：等待用户同意，尚未触达 native/vendor');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setInitState('failed');
        append(`✗ Common.preInit: ${(error as Error).message}`);
      });

    return () => {
      active = false;
    };
  }, []);

  const initializeAfterConsent = async () => {
    setInitState('initializing');
    try {
      // 只有用户明确同意后才调用；config 已由 preInit 保存，因此 init 无参。
      await Common.init();
      setInitState('initialized');
      append('✓ Common.init OK：native/vendor 已初始化');
    } catch (error) {
      setInitState('failed');
      const code = error instanceof UmengError ? error.code : 'E_UNKNOWN';
      append(`✗ Common.init: ${code} – ${(error as Error).message}`);
    }
  };

  const runShare = async (label: string, fn: () => Promise<ShareResult>) => {
    try {
      const result = await fn();
      append(`✓ ${label}: ${result.code}@${result.platform}`);
    } catch (error) {
      const code = error instanceof UmengError ? error.code : 'E_UNKNOWN';
      append(`✗ ${label}: ${code} – ${(error as Error).message}`);
    }
  };

  const initialized = initState === 'initialized';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.h1}>@unif/react-native-umeng 验证矩阵</Text>

      <Section title="PIPL 初始化">
        <Text style={styles.status}>当前状态：{initState}</Text>
        <RNButton
          title="我已同意隐私协议并初始化"
          disabled={initState !== 'awaitingConsent'}
          onPress={() => initializeAfterConsent()}
        />
        <RNButton
          title="Common.isInited()"
          onPress={() => {
            Common.isInited()
              .then((value) => append(`Common.isInited → ${value}`))
              .catch((error: unknown) =>
                append(`✗ Common.isInited: ${(error as Error).message}`)
              );
          }}
        />
      </Section>

      <Section title="Share（命令式面板，主用例）">
        <RNButton
          title="openSheet · 链接"
          disabled={!initialized}
          onPress={() =>
            runShare('openSheet(link)', () =>
              Share.openSheet({
                type: 'link',
                title: 'Unif Umeng 示例',
                url: 'https://example.com',
                description: '从 RN 桥发起的链接卡片',
                thumb: 'https://example.com/thumb.png',
              })
            )
          }
        />
        <RNButton
          title="openSheet · 文本"
          disabled={!initialized}
          onPress={() =>
            runShare('openSheet(text)', () =>
              Share.openSheet({ type: 'text', text: 'Hello from Unif Umeng' })
            )
          }
        />
        <RNButton
          title="openSheet · 图片"
          disabled={!initialized}
          onPress={() =>
            runShare('openSheet(image)', () =>
              Share.openSheet({
                type: 'image',
                image: 'https://example.com/image.png',
              })
            )
          }
        />
      </Section>

      <Section title="Share（底层直拉）">
        <RNButton
          title="shareLink → 微信会话（跳过面板）"
          disabled={!initialized}
          onPress={() =>
            runShare('shareLink', () =>
              Share.shareLink({
                platform: Platform.WECHAT_SESSION,
                title: 'Direct call',
                url: 'https://example.com',
                description: '不走面板的直拉',
              })
            )
          }
        />
      </Section>

      <Section title="Analytics（同步 void）">
        <RNButton
          title="onEvent('demo_event', { source: 'btn' })"
          disabled={!initialized}
          onPress={() => {
            Analytics.onEvent('demo_event', { source: 'btn', count: 1 });
            append('Analytics.onEvent fired');
          }}
        />
        <RNButton
          title="signIn('demo-user-123', 'WX')"
          disabled={!initialized}
          onPress={() => {
            Analytics.signIn('demo-user-123', 'WX');
            append('Analytics.signIn fired');
          }}
        />
        <RNButton
          title="signOut()"
          disabled={!initialized}
          onPress={() => {
            Analytics.signOut();
            append('Analytics.signOut fired');
          }}
        />
      </Section>

      <Section title="日志">
        <Text style={styles.log}>{log}</Text>
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{title}</Text>
      <View style={styles.btns}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 60 },
  h1: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  h2: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#666' },
  status: { fontSize: 12, color: '#444', marginBottom: 6 },
  section: { marginBottom: 16 },
  btns: { gap: 6 },
  log: { fontFamily: 'Menlo', fontSize: 11, color: '#444' },
});
