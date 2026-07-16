/**
 * Minimal leveled logger. No third-party telemetry (personal-use decision,
 * ARCHITECTURE §12). Redacts obviously sensitive values so tokens/emails
 * never end up in logs (SECURITY §5).
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const MIN_LEVEL: Level = __DEV__ ? 'debug' : 'warn';

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const JWT_RE = /\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g;

export function redact(value: string): string {
  return value.replace(JWT_RE, '[redacted-token]').replace(EMAIL_RE, '[redacted-email]');
}

function log(level: Level, tag: string, message: string, data?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const line = `[${tag}] ${redact(message)}`;
  const args: unknown[] = data === undefined ? [line] : [line, data];
  /* eslint-disable no-console -- the logger is the one sanctioned console user */
  if (level === 'error') console.error(...args);
  else if (level === 'warn') console.warn(...args);
  else console.log(...args);
  /* eslint-enable no-console */
}

export const logger = {
  debug: (tag: string, message: string, data?: unknown) => log('debug', tag, message, data),
  info: (tag: string, message: string, data?: unknown) => log('info', tag, message, data),
  warn: (tag: string, message: string, data?: unknown) => log('warn', tag, message, data),
  error: (tag: string, message: string, data?: unknown) => log('error', tag, message, data),
};
