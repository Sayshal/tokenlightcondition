/**
 * Custom logger with caller context information for Token Light Condition
 */

import { MODULE, SETTINGS } from './constants.mjs';

/**
 * Custom logger with caller context information and configurable log levels
 * @param {number} level - Log level (1=error, 2=warning, 3=verbose)
 * @param {...any} args - Content to log to console
 */
export function log(level, ...args) {
  try {
    // Extract caller information from stack trace
    const stack = new Error().stack.split('\n');
    let callerInfo = '';

    if (stack.length > 2) {
      const callerLine = stack[2].trim();
      const callerMatch = callerLine.match(/at\s+([^.]+)\.(\w+)/);
      if (callerMatch) {
        callerInfo = `[${callerMatch[1]}.${callerMatch[2]}] : `;
      }
    }

    // Add caller info to first argument or prepend it
    if (typeof args[0] === 'string') {
      args[0] = callerInfo + args[0];
    } else {
      args.unshift(callerInfo);
    }

    // Create timestamp for log entry
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    // Create log entry for storage
    const logEntry = {
      type: level === 1 ? 'error' : level === 2 ? 'warn' : 'debug',
      timestamp,
      level,
      content: args
    };

    // Store log entry in global array (limit to 2000 entries)
    if (!window.console_logs) window.console_logs = [];
    if (window.console_logs.length > 2000) window.console_logs.shift();
    window.console_logs.push(logEntry);

    // Get configured log level and output if appropriate
    const configuredLogLevel = MODULE.LOG_LEVEL;
    if (configuredLogLevel > 0 && level <= configuredLogLevel) {
      switch (level) {
        case 1:
          console.error(`${MODULE.SHORT} |`, ...args);
          break;
        case 2:
          console.warn(`${MODULE.SHORT} |`, ...args);
          break;
        case 3:
        default:
          console.debug(`${MODULE.SHORT} |`, ...args);
          break;
      }
    }
  } catch (error) {
    // Fallback logging if logger fails
    console.error(`${MODULE.SHORT} | Logger error:`, error);
    console.error(`${MODULE.SHORT} | Original log:`, ...args);
  }
}

/**
 * Initialize the logger with current settings
 * Called during module setup to configure logging level
 */
export function initializeLogger() {
  try {
    // Get logging level from game settings
    const logLevel = game.settings.get(MODULE.ID, SETTINGS.LOGGING_LEVEL);
    MODULE.LOG_LEVEL = parseInt(logLevel) || 0;
    log(3, `Logger initialized with level ${MODULE.LOG_LEVEL}`);
  } catch (error) {
    // Fall back to error-only logging if initialization fails
    console.error(`${MODULE.SHORT} | Error initializing logger:`, error);
    MODULE.LOG_LEVEL = 1;
  }
}
