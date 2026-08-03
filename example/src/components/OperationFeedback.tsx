import {
  Card,
  StatusDot,
  Tag,
  useThemedStyles,
  type ColorTokens,
  type TagVariant,
} from '@unif/react-native-design';
import { Text, View } from 'react-native';

import type { OperationFeedback as OperationFeedbackValue } from '../errors/classifyUmengError';

type OperationFeedbackProps = {
  readonly feedback?: OperationFeedbackValue | null;
  readonly successMessage?: string | null;
};

const makeStyles = (colors: ColorTokens) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  message: {
    color: colors.foreground,
    fontSize: 13,
    lineHeight: 19,
  },
  code: {
    color: colors.foregroundMuted,
    fontSize: 11,
  },
});

function feedbackPresentation(feedback: OperationFeedbackValue): {
  readonly status: 'done' | 'active' | 'error';
  readonly variant: TagVariant;
  readonly label: string;
} {
  switch (feedback.tone) {
    case 'neutral':
      return { status: 'done', variant: 'neutral', label: '已结束' };
    case 'warning':
      return { status: 'active', variant: 'info', label: '请注意' };
    case 'error':
      return { status: 'error', variant: 'error', label: '操作失败' };
  }
}

export function OperationFeedback({
  feedback,
  successMessage,
}: OperationFeedbackProps) {
  const styles = useThemedStyles(makeStyles);

  if (feedback == null && successMessage == null) {
    return null;
  }

  if (feedback == null) {
    return (
      <Card variant="plain">
        <View style={styles.row}>
          <StatusDot status="done" accessibilityLabel="操作成功" />
          <View style={styles.body}>
            <Tag label="操作成功" variant="success" />
            <Text style={styles.message}>{successMessage}</Text>
          </View>
        </View>
      </Card>
    );
  }

  const presentation = feedbackPresentation(feedback);
  return (
    <Card variant="plain">
      <View style={styles.row}>
        <StatusDot
          status={presentation.status}
          accessibilityLabel={presentation.label}
        />
        <View style={styles.body}>
          <Tag label={presentation.label} variant={presentation.variant} />
          <Text style={styles.message}>{feedback.message}</Text>
          <Text style={styles.code}>{feedback.code}</Text>
        </View>
      </View>
    </Card>
  );
}
