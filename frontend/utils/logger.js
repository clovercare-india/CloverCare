// Simple logger utility for React Native
// Production ready - no external dependencies needed

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

const isDevelopment = __DEV__; // Expo built-in variable

const shouldLog = (level) => {
  if (!isDevelopment) {
    return level === LOG_LEVELS.ERROR || level === LOG_LEVELS.WARN;
  }
  return true;
};

const formatLog = (level, context, message, data) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  const contextStr = context ? `[${context}]` : '';
  
  if (data) {
    return `${prefix} ${contextStr} ${message}`, data;
  }
  return `${prefix} ${contextStr} ${message}`;
};

const logger = {
  error: (context, message, data) => {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(formatLog(LOG_LEVELS.ERROR, context, message, data), data || '');
    }
  },

  warn: (context, message, data) => {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(formatLog(LOG_LEVELS.WARN, context, message, data), data || '');
    }
  },

  info: (context, message) => {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(formatLog(LOG_LEVELS.INFO, context, message));
    }
  },

  debug: (context, message, data) => {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(formatLog(LOG_LEVELS.DEBUG, context, message, data), data || '');
    }
  },
};

export default logger;
