/**
 * Runtime utilities for Astro
 * Replaces Deno Fresh runtime checks
 */

/**
 * Check if we're running in the browser
 * In Astro, during SSR import.meta.env.SSR is true
 */
export const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

