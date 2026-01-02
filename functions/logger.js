/**
 * Firebase Cloud Functions Logger
 * Simple logging utility for production-grade Cloud Functions
 */

const functions = require("firebase-functions");

const logger = {
  /**
   * Log critical errors only in production
   * @param {string} context - Function context
   * @param {string} message - Log message
   * @param {Error} error - Error object
   */
  error: (context, message, error = null) => {
    const logData = {
      level: "ERROR",
      context,
      message,
      timestamp: new Date().toISOString(),
    };

    if (error) {
      logData.errorMessage = error.message;
      logData.errorStack = error.stack;
    }

    functions.logger.error(logData);
  },

  /**
   * Log warnings for important events
   * @param {string} context - Function context
   * @param {string} message - Log message
   */
  warn: (context, message) => {
    functions.logger.warn({
      level: "WARN",
      context,
      message,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log important info (only in development)
   * @param {string} context - Function context
   * @param {string} message - Log message
   */
  info: (context, message) => {
    if (process.env.NODE_ENV !== "production") {
      functions.logger.info({
        level: "INFO",
        context,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  },

  /**
   * Log debug info (only in development)
   * @param {string} context - Function context
   * @param {string} message - Log message
   * @param {object} data - Additional data
   */
  debug: (context, message, data = null) => {
    if (process.env.NODE_ENV !== "production") {
      const logData = {
        level: "DEBUG",
        context,
        message,
        timestamp: new Date().toISOString(),
      };
      if (data) {
        logData.data = data;
      }
      functions.logger.debug(logData);
    }
  },
};

module.exports = logger;
