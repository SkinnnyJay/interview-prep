/**
 * Environment variable utilities
 *
 * Provides type-safe access to environment variables with defaults.
 * Follows the pattern of avoiding direct process.env access.
 */

export class Env {
  /**
   * Get an environment variable value with optional default
   * @param key - Environment variable key
   * @param defaultValue - Default value if key is not set
   * @returns The environment variable value or default
   */
  static getValue<T extends string = string>(key: string, defaultValue?: T): T {
    const value = process.env[key];
    if (value === undefined || value === "") {
      if (defaultValue === undefined) {
        throw new Error(`Environment variable ${key} is required but not set`);
      }
      return defaultValue;
    }
    return value as T;
  }

  /**
   * Get an environment variable as a number
   * @param key - Environment variable key
   * @param defaultValue - Default number value if key is not set
   * @returns The parsed number value or default
   */
  static getNumber(key: string, defaultValue?: number): number {
    const value = this.getValue(key, defaultValue?.toString());
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      if (defaultValue === undefined) {
        throw new Error(`Environment variable ${key} must be a valid number`);
      }
      return defaultValue;
    }
    return parsed;
  }

  /**
   * Get an environment variable as a boolean
   * @param key - Environment variable key
   * @param defaultValue - Default boolean value if key is not set
   * @returns The parsed boolean value or default
   */
  static getBoolean(key: string, defaultValue?: boolean): boolean {
    const value = this.getValue(key, defaultValue?.toString());
    const lowerValue = value.toLowerCase();
    if (lowerValue === "true" || lowerValue === "1" || lowerValue === "yes") {
      return true;
    }
    if (lowerValue === "false" || lowerValue === "0" || lowerValue === "no") {
      return false;
    }
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} must be a valid boolean`);
    }
    return defaultValue;
  }
}
