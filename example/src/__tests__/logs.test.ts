import { appendLog, clearLogs, type DemoLog } from '../state/logs';

describe('showcase logs', () => {
  it('formats a selected safe message without retaining extra input objects', () => {
    const logs = appendLog([], {
      now: new Date(2026, 7, 3, 10, 20, 30, 123),
      level: 'info',
      scope: 'analytics',
      message: 'JS 已调用 Analytics.onEvent',
      // 日志 API 不接受任意 config/payload；运行时也不得把额外字段扩散到日志。
      // @ts-expect-error payload 不是安全日志输入的一部分。
      payload: { appkey: 'secret' },
    });

    expect(logs).toEqual([
      {
        id: expect.stringMatching(/^log-\d+-1$/),
        timestamp: '2026-08-03 10:20:30.123',
        level: 'info',
        scope: 'analytics',
        message: 'JS 已调用 Analytics.onEvent',
      },
    ]);
    expect(JSON.stringify(logs)).not.toContain('secret');
  });

  it('keeps the newest 100 entries in newest-first order', () => {
    let logs: readonly DemoLog[] = clearLogs();

    for (let index = 0; index < 101; index += 1) {
      logs = appendLog(logs, {
        now: new Date(2026, 0, 1, 0, 0, index),
        level: 'info',
        scope: 'setup',
        message: `安全日志 ${index}`,
      });
    }

    expect(logs).toHaveLength(100);
    expect(logs[0]?.message).toBe('安全日志 100');
    expect(logs[99]?.message).toBe('安全日志 1');
    expect(logs.some((log) => log.message === '安全日志 0')).toBe(false);
  });

  it('keeps all retained IDs unique after 102 entries share one instant', () => {
    let logs: readonly DemoLog[] = clearLogs();
    const now = new Date('2026-08-03T10:20:30.123Z');

    for (let index = 0; index < 102; index += 1) {
      logs = appendLog(logs, {
        now,
        level: 'info',
        scope: 'analytics',
        message: `同毫秒日志 ${index}`,
      });
    }

    expect(logs).toHaveLength(100);
    expect(new Set(logs.map((log) => log.id)).size).toBe(100);
  });

  it('appends to a frozen non-empty collection without mutating it', () => {
    const previous = Object.freeze([
      Object.freeze({
        id: 'log-1-1',
        timestamp: '2026-08-03 10:20:30.122',
        level: 'warning' as const,
        scope: 'setup' as const,
        message: '既有安全日志',
      }),
    ]);

    const next = appendLog(previous, {
      now: new Date('2026-08-03T10:20:30.123Z'),
      level: 'info',
      scope: 'analytics',
      message: '新增安全日志',
    });

    expect(previous).toEqual([
      {
        id: 'log-1-1',
        timestamp: '2026-08-03 10:20:30.122',
        level: 'warning',
        scope: 'setup',
        message: '既有安全日志',
      },
    ]);
    expect(next).not.toBe(previous);
    expect(next).toHaveLength(2);
  });

  it('clears logs without changing the previous collection', () => {
    const previous = appendLog([], {
      now: new Date(2026, 7, 3, 10, 20, 30, 123),
      level: 'warning',
      scope: 'setup',
      message: '请检查输入',
    });

    expect(clearLogs()).toEqual([]);
    expect(previous).toHaveLength(1);
  });
});
