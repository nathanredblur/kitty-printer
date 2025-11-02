/**
 * Async utilities for Astro
 * Replaces Deno std/async utilities
 */

/**
 * Delay execution for a specified number of milliseconds
 * Replaces Deno's std/async/delay
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

