import { useState } from 'react';
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
} from '@unif/react-native-umeng';

export default function App() {
  return (
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
  const append = (line: string) =>
    setLog((prev) => `${line}\n${prev}`.slice(0, 1200));

  const runShare = async (label: string, fn: () => Promise<ShareResult>) => {
    try {
      const r = await fn();
      append(`✓ ${label}: ${r.code}@${r.platform}`);
    } catch (e) {
      const code = e instanceof UmengError ? e.code : 'E_UNKNOWN';
      append(`✗ ${label}: ${code} – ${(e as Error).message}`);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.h1}>@unif/react-native-umeng 验证矩阵</Text>

      <Section title="Common">
        <RNButton
          title="Common.preInit(config)（App 启动后立刻调）"
          onPress={async () => {
            try {
              await Common.preInit({
                appkey: 'YOUR_UMENG_APPKEY',
                channel: 'App Store',
                wechatAppId: 'wxXXXXXXXX',
                wechatAppSecret: 'XXXXXXXX',
                wechatUniversalLink: 'https://your.host/path/',
                dingtalkAppId: 'dingoaXXXXXXXX',
              });
              append('✓ Common.preInit OK');
            } catch (e) {
              append(`✗ Common.preInit: ${(e as Error).message}`);
            }
          }}
        />
        <RNButton
          title="Common.init()（同意后调，preInit 之后）"
          onPress={async () => {
            try {
              await Common.init();
              append('✓ Common.init OK');
            } catch (e) {
              append(`✗ Common.init: ${(e as Error).message}`);
            }
          }}
        />
        <RNButton
          title="Common.isInited()"
          onPress={async () => {
            const v = await Common.isInited();
            append(`Common.isInited → ${v}`);
          }}
        />
      </Section>

      <Section title="Share（命令式面板，主用例）">
        <RNButton
          title="openSheet · 链接"
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
          onPress={() =>
            runShare('openSheet(text)', () =>
              Share.openSheet({ type: 'text', text: 'Hello from Unif Umeng' })
            )
          }
        />
        <RNButton
          title="openSheet · 图片"
          onPress={() =>
            runShare('openSheet(image)', () =>
              Share.openSheet({
                type: 'image',
                image: 'https://example.com/x.png',
              })
            )
          }
        />
      </Section>

      <Section title="Share（底层直拉）">
        <RNButton
          title="shareLink → 微信会话（跳过面板）"
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

      <Section title="Analytics">
        <RNButton
          title="onEvent('demo_event', { source: 'btn' })"
          onPress={() => {
            Analytics.onEvent('demo_event', { source: 'btn', count: 1 });
            append('Analytics.onEvent fired');
          }}
        />
        <RNButton
          title="signIn('demo-user-123', 'WX')"
          onPress={() => {
            Analytics.signIn('demo-user-123', 'WX');
            append('Analytics.signIn fired');
          }}
        />
        <RNButton
          title="signOut()"
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
  section: { marginBottom: 16 },
  btns: { gap: 6 },
  log: { fontFamily: 'Menlo', fontSize: 11, color: '#444' },
});
