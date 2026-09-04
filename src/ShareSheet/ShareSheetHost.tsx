import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  View,
  Text,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import { Cell, Button, useThemedStyles } from '@unif/react-native-design';
import type { ColorTokens } from '@unif/react-native-design';
import {
  PLATFORM_DEFAULT_SUBTITLES,
  UmengError,
  type ShareSheetOptions,
  type ShareSheetPayload,
  type ShareResult,
  type PlatformInfo,
} from '../types';
import * as Share from '../share';
import { normalizeError } from '../internal/errors';
import { shareSheetController } from './ShareSheetController';
import { PlatformLeading } from './PlatformLeading';

interface SheetState {
  sessionId: number | null;
  phase: 'closed' | 'loadingPlatforms' | 'ready' | 'sharing';
  payload: ShareSheetPayload | null;
  options: ShareSheetOptions;
  platforms: PlatformInfo[];
}

const INITIAL_STATE: SheetState = {
  sessionId: null,
  phase: 'closed',
  payload: null,
  options: {},
  platforms: [],
};

/**
 * 分享面板宿主 —— state-driven(shareSheetController 订阅 show/dismiss)。
 * 默认使用原生 RN `Modal`(transparent + slide 底部弹出)；floating 模式
 * 则作为根层浮层渲染，不提供遮罩，面板外触摸直接穿透给下层内容。
 */
export const ShareSheetHost: React.FC = () => {
  // 延迟到 Host 真正渲染时加载，避免仅导入库 barrel 的 Jest 消费者解析 RNGH ESM。
  const { GestureHandlerRootView } =
    require('react-native-gesture-handler') as typeof import('react-native-gesture-handler');
  const styles = useThemedStyles(makeStyles);
  const [state, setState] = useState<SheetState>(INITIAL_STATE);
  const presentedSessionRef = useRef<number | null>(null);
  const floatingSessionRef = useRef<number | null>(null);

  const notifyDismissed = useCallback((sessionId: number | null) => {
    if (sessionId === null) return;
    if (presentedSessionRef.current === sessionId) {
      presentedSessionRef.current = null;
    }
    if (floatingSessionRef.current === sessionId) {
      floatingSessionRef.current = null;
    }
    shareSheetController.completeDismiss(sessionId);
  }, []);

  useEffect(() => {
    const registration = shareSheetController.registerHost((e) => {
      if (e.kind === 'show') {
        const { sessionId } = e;
        floatingSessionRef.current =
          e.options.presentation === 'floating' ? sessionId : null;
        setState({
          sessionId,
          phase: 'loadingPlatforms',
          payload: e.payload,
          options: e.options,
          platforms: [],
        });

        const openWithPlatforms = async () => {
          try {
            const platforms = await Share.listPlatforms();
            if (!shareSheetController.markReady(sessionId)) return;

            setState((current) =>
              current.sessionId === sessionId &&
              current.phase === 'loadingPlatforms'
                ? { ...current, phase: 'ready', platforms }
                : current
            );
          } catch (error) {
            shareSheetController.settleError(
              sessionId,
              normalizeError(
                error,
                'E_UNKNOWN',
                'Failed to query installed share platforms'
              )
            );
          }
        };
        openWithPlatforms();
      } else if (e.kind === 'dismiss') {
        const isFloating = floatingSessionRef.current === e.sessionId;
        setState((current) =>
          current.sessionId === e.sessionId ? INITIAL_STATE : current
        );
        if (
          isFloating ||
          Platform.OS !== 'ios' ||
          presentedSessionRef.current !== e.sessionId
        ) {
          notifyDismissed(e.sessionId);
        }
      }
    });
    return registration.unregister;
  }, [notifyDismissed]);

  const handlePlatformPress = useCallback(
    (sessionId: number, payload: ShareSheetPayload, info: PlatformInfo) => {
      if (!shareSheetController.beginSharing(sessionId)) return;

      setState((current) =>
        current.sessionId === sessionId
          ? { ...current, phase: 'sharing' }
          : current
      );

      if (!info.installed) {
        shareSheetController.settleError(
          sessionId,
          new UmengError(
            'E_PLATFORM_NOT_INSTALLED',
            `${info.displayName} 未安装`
          )
        );
        return;
      }

      const runShare = async () => {
        try {
          let result: ShareResult;
          if (payload.type === 'text') {
            result = await Share.shareText({
              platform: info.platform,
              text: payload.text,
            });
          } else if (payload.type === 'image') {
            result = await Share.shareImage({
              platform: info.platform,
              image: payload.image,
              thumb: payload.thumb,
            });
          } else {
            result = await Share.shareLink({
              platform: info.platform,
              title: payload.title,
              url: payload.url,
              description: payload.description,
              thumb: payload.thumb,
            });
          }
          shareSheetController.settle(sessionId, result);
        } catch (error) {
          shareSheetController.settleError(
            sessionId,
            normalizeError(error, 'E_UNKNOWN', 'Failed to share')
          );
        }
      };
      runShare();
    },
    []
  );

  const handleCancel = useCallback(() => {
    if (state.sessionId !== null) {
      shareSheetController.dismiss(state.sessionId);
    }
  }, [state.sessionId]);

  const handleSheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      state.options.onSheetLayout?.(event.nativeEvent.layout.height);
    },
    [state.options]
  );

  const title = state.options.title ?? '分享至';
  const cancelText = state.options.cancelText ?? '取消';
  const subtitles = state.options.subtitles ?? {};
  const hideUninstalled = state.options.hideUninstalled ?? false;

  const visiblePlatforms = state.platforms.filter(
    (p) => !hideUninstalled || p.installed
  );
  const floating = state.options.presentation === 'floating';

  const sheetContent = (
    <>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View>
        {visiblePlatforms.map((info) => (
          <Cell
            key={info.platform}
            testID={`umeng-share-cell-${info.platform}`}
            title={info.displayName}
            desc={
              subtitles[info.platform] ??
              PLATFORM_DEFAULT_SUBTITLES[info.platform]
            }
            // Design 0.21 起 Cell.leading 是 `IconName | { kind:'display'; node }` ——
            // 平台 logo 是品牌图形(微信绿底白 glyph / 钉钉多色),不在 Icon 目录里,
            // 故走 display 分支显式标注。
            leading={{
              kind: 'display',
              node: <PlatformLeading platform={info.platform} />,
            }}
            arrow
            onPress={() => {
              if (state.sessionId !== null && state.payload !== null) {
                handlePlatformPress(state.sessionId, state.payload, info);
              }
            }}
          />
        ))}
      </View>
      <Button
        testID="umeng-share-cancel"
        variant="secondary"
        size="lg"
        block
        label={cancelText}
        style={styles.cancel}
        onPress={handleCancel}
      />
    </>
  );

  if (floating) {
    if (state.phase !== 'ready' && state.phase !== 'sharing') return null;

    return (
      <View
        testID="umeng-share-floating-root"
        pointerEvents="box-none"
        accessibilityViewIsModal
        style={styles.floatingRoot}
      >
        <View
          testID="umeng-share-sheet"
          style={styles.sheet}
          onLayout={handleSheetLayout}
        >
          {sheetContent}
        </View>
      </View>
    );
  }

  return (
    <Modal
      visible={state.phase === 'ready'}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancel}
      onShow={() => {
        presentedSessionRef.current = state.sessionId;
      }}
      onDismiss={() => notifyDismissed(presentedSessionRef.current)}
    >
      <GestureHandlerRootView style={styles.root}>
        {/* backdrop 点击取消；内层 sheet 的空 onPress 用来拦截冒泡。 */}
        <Pressable
          style={styles.backdrop}
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="关闭"
        >
          <Pressable
            testID="umeng-share-sheet"
            style={styles.sheet}
            onPress={() => {}}
            onLayout={handleSheetLayout}
          >
            {sheetContent}
          </Pressable>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
};

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1 },
    floatingRoot: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      justifyContent: 'flex-end',
      zIndex: 1100,
      elevation: 1100,
    },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim },
    sheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 12,
      // 固定底部留白覆盖 home indicator(umeng 不引 safe-area-context 依赖)
      paddingBottom: 34,
      backgroundColor: c.surface,
    },
    head: { paddingHorizontal: 4, paddingTop: 6, paddingBottom: 4 },
    title: {
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.1,
      color: c.foreground,
    },
    cancel: { marginTop: 14 },
  });
