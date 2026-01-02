import pino from 'pino';

const isProd = import.meta.env.MODE === 'production';

const logger = pino({
  level: isProd ? 'info' : 'debug',
  base: undefined, // no pid/hostname
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

export default logger;
