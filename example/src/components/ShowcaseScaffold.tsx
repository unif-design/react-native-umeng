import {
  NavBar,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import type { ReactNode } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ShowcaseScaffoldProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly onBack?: () => void;
  readonly right?: ReactNode;
  readonly children: ReactNode;
  readonly contentStyle?: StyleProp<ViewStyle>;
};

const makeStyles = (colors: ColorTokens) => ({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 16,
  },
});

export function ShowcaseScaffold({
  title,
  subtitle,
  onBack,
  right,
  children,
  contentStyle,
}: ShowcaseScaffoldProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <NavBar
        title={title}
        subtitle={subtitle}
        left={
          onBack
            ? {
                icon: 'arrow-left',
                onPress: onBack,
                accessibilityLabel: '返回',
              }
            : undefined
        }
        right={right}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
