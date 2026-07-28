import chalk from 'chalk';

/**
 * Simple logger utility using chalk for colored output.
 */
export const logger = {
  /**
   * Logs an informational message.
   * @param message The message to log.
   */
  info: (message: string) => {
    console.log(chalk.blue('ℹ INFO:'), message);
  },

  /**
   * Logs a success message.
   * @param message The message to log.
   */
  success: (message: string) => {
    console.log(chalk.green('✔ SUCCESS:'), message);
  },

  /**
   * Logs a warning message.
   * @param message The message to log.
   */
  warn: (message: string) => {
    console.log(chalk.yellow('⚠ WARNING:'), message);
  },

  /**
   * Logs an error message.
   * @param message The error message to log.
   * @param error Optional error object for stack traces.
   */
  error: (message: string, error?: unknown) => {
    console.error(chalk.red('✖ ERROR:'), message);
    if (error) {
      console.error(chalk.red(error));
    }
  },
};
