export type DemoLogLevel = 'info' | 'warning' | 'error';

export type DemoLogScope = 'setup' | 'platform' | 'share' | 'analytics';

export type DemoLog = {
  readonly id: string;
  readonly timestamp: string;
  readonly level: DemoLogLevel;
  readonly scope: DemoLogScope;
  readonly message: string;
};

export type AppendLogInput = {
  readonly now: Date;
  readonly level: DemoLogLevel;
  readonly scope: DemoLogScope;
  readonly message: string;
};

const MAX_LOGS = 100;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function formatLocalTimestamp(now: Date): string {
  return [
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}.${pad(now.getMilliseconds(), 3)}`,
  ].join(' ');
}

export function appendLog(
  logs: readonly DemoLog[],
  { now, level, scope, message }: AppendLogInput
): readonly DemoLog[] {
  const idPrefix = `log-${now.getTime()}-`;
  const largestSameInstantSequence = logs.reduce((largest, log) => {
    if (!log.id.startsWith(idPrefix)) {
      return largest;
    }

    const sequence = Number(log.id.slice(idPrefix.length));
    return Number.isSafeInteger(sequence)
      ? Math.max(largest, sequence)
      : largest;
  }, 0);
  const next: DemoLog = {
    id: `${idPrefix}${largestSameInstantSequence + 1}`,
    timestamp: formatLocalTimestamp(now),
    level,
    scope,
    message,
  };

  return [next, ...logs].slice(0, MAX_LOGS);
}

export function clearLogs(): readonly [] {
  return [];
}
