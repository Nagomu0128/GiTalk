type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type Logger = {
  readonly debug: (message: string, data?: unknown) => void;
  readonly info: (message: string, data?: unknown) => void;
  readonly warn: (message: string, data?: unknown) => void;
  readonly error: (message: string | Error | unknown, data?: unknown) => void;
};

const formatMessage = (level: LogLevel, context: string, message: string, data?: unknown): string =>
  JSON.stringify({
    level,
    context,
    message,
    ...(data !== undefined ? { data } : {}),
    timestamp: new Date().toISOString(),
  });

export const appLogger = (context: string): Logger => ({
  debug: (message, data) => console.debug(formatMessage('debug', context, message, data)),
  info: (message, data) => console.info(formatMessage('info', context, message, data)),
  warn: (message, data) => console.warn(formatMessage('warn', context, message, data)),
  error: (message, data) => {
    const msg = message instanceof Error ? message.message : String(message);
    console.error(formatMessage('error', context, msg, data));
  },
});
