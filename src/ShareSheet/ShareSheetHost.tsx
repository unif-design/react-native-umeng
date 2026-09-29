import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  View,
  Text,
  type LayoutChangeEvent,
} from 'react-native';
import { Cell, Button, useThemedStyles } from '@unif/react-native-design';
import type { ShareContent, ShareTargetInfo } from '../types';
import { getShareTargets, share } from '../share';
import { toFailure } from '../internal/errors';
import { SHARE_TARGET_SUBTITLES } from '../internal/shareTargets';
import { PlatformLeading } from './PlatformLeading';

import type { ShareSheetHostProps, SheetState } from './types';
import { INITIAL_SHEET_STATE } from './constants';
import { makeSheetStyles } from './styles';

/**
 * 分享面板宿主 —— state-driven(controller 订阅 show/dismiss)。
 * 默认使用原生 RN `Modal`(transparent + slide 底部弹出)；floating 模式
 * 则作为根层浮层渲染，不提供遮罩，面板外触摸直接穿透给下层内容。
 */
export const ShareSheetHost = ({ controller }: ShareSheetHostProps) => {
  // 延迟到 Host 真正渲染时加载，避免仅导入库 barrel 的 Jest 消费者解析 RNGH ESM。
  const { GestureHandlerRootView } =
    require('react-native-gesture-handler') as typeof import('react-native-gesture-handler');
  const styles = useThemedStyles(makeSheetStyles);
  const [state, setState] = useState<SheetState>(INITIAL_SHEET_STATE);
  const presentedSessionRef = useRef<number | null>(null);
  const floatingSessionRef = useRef<number | null>(null);

  const notifyDismissed = useCallback(
    (sessionId: number | null) => {
      if (sessionId === null) return;
      if (presentedSessionRef.current === sessionId) {
        presentedSessionRef.current = null;
      }
      if (floatingSessionRef.current === sessionId) {
        floatingSessionRef.current = null;
      }
      controller.completeDismiss(sessionId);
    },
    [controller]
  );

  useEffect(() => {
    const registration = controller.attach((e) => {
      if (e.kind === 'show') {
        const { sessionId } = e;
        floatingSessionRef.current =
          e.options.presentation === 'floating' ? sessionId : null;
        setState({
          sessionId,
          phase: 'loadingPlatforms',
          content: e.content,
          options: e.options,
          platforms: [],
        });

        const openWithPlatforms = async () => {
          try {
            const platforms = await getShareTargets();
            if (!controller.markReady(sessionId)) return;

            setState((current) =>
              current.sessionId === sessionId &&
              current.phase === 'loadingPlatforms'
                ? { ...current, phase: 'ready', platforms }
                : current
            );
          } catch (error) {
            controller.settle(sessionId, {
              status: 'failed',
              error: toFailure(error, 'Failed to query share targets'),
            });
          }
        };
        openWithPlatforms();
      } else if (e.kind === 'dismiss') {
        const isFloating = floatingSessionRef.current === e.sessionId;
        setState((current) =>
          current.sessionId === e.sessionId
            ? { ...current, phase: 'closed' }
            : current
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
    return registration;
  }, [controller, notifyDismissed]);

  const handlePlatformPress = useCallback(
    (
      sessionId: number,
      content: Readonly<ShareContent>,
      info: ShareTargetInfo
    ) => {
      if (!controller.beginSharing(sessionId)) return;
      // The original operation owns its receipt after the presentation ends.
      share({ target: info.target, content }).then((result) =>
        controller.settle(sessionId, result)
      );
    },
    [controller]
  );

  const handleCancel = useCallback(() => {
    if (state.sessionId !== null) {
      controller.dismiss(state.sessionId);
    }
  }, [controller, state.sessionId]);

  const handleSheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!controller.isPresenting(state.sessionId)) return;
      try {
        state.options.onLayout?.(event.nativeEvent.layout.height);
      } catch {
        /* Observer failure cannot interrupt presentation. */
      }
    },
    [controller, state.options, state.sessionId]
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
            key={info.target}
            testID={`umeng-share-cell-${info.target}`}
            title={info.label}
            desc={`${subtitles[info.target] ?? SHARE_TARGET_SUBTITLES[info.target]} · ${info.installed ? '已安装' : '未安装'}`}
            // Design 0.21 起 Cell.leading 是 `IconName | { kind:'display'; node }` ——
            // 平台 logo 是品牌图形(微信绿底白 glyph / 钉钉多色),不在 Icon 目录里,
            // 故走 display 分支显式标注。
            leading={{
              kind: 'display',
              node: <PlatformLeading platform={info.target} />,
            }}
            arrow
            onPress={() => {
              if (state.sessionId !== null && state.content !== null) {
                handlePlatformPress(state.sessionId, state.content, info);
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
    if (state.phase !== 'ready') return null;

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
        if (controller.isPresenting(state.sessionId))
          presentedSessionRef.current = state.sessionId;
      }}
      onDismiss={() => notifyDismissed(state.sessionId)}
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
