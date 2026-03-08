/**
 * Environment variable utilities
 *
 * Provides type-safe access to environment variables with defaults.
 * Follows the pattern of avoiding direct process.env access.
 */
export declare class Env {
  /**
   * Get an environment variable value with optional default
   * @param key - Environment variable key
   * @param defaultValue - Default value if key is not set
   * @returns The environment variable value or default
   */
  static getValue<T extends string = string>(key: string, defaultValue?: T): T;
  /**
   * Get an environment variable as a number
   * @param key - Environment variable key
   * @param defaultValue - Default number value if key is not set
   * @returns The parsed number value or default
   */
  static getNumber(key: string, defaultValue?: number): number;
  /**
   * Get an environment variable as a boolean
   * @param key - Environment variable key
   * @param defaultValue - Default boolean value if key is not set
   * @returns The parsed boolean value or default
   */
  static getBoolean(key: string, defaultValue?: boolean): boolean;
}
