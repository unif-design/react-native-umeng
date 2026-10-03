import { StyleSheet } from 'react-native';
import type { ColorTokens } from '@unif/react-native-design';

export const makeSheetStyles = (c: ColorTokens) =>
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

export const platformLeadingStyles = StyleSheet.create({
  wechat: { backgroundColor: '#07C160' },
  container: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
