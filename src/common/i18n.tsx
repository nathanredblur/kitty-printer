import { signal } from "@preact/signals";

// Simple i18n system that loads en-US.json
const translations = signal<Record<string, string>>({});
let isReady = false;
const readyCallbacks: (() => void)[] = [];

// Load translations from en-US.json
if (typeof window !== 'undefined') {
  // Client-side loading
  fetch('/lang/en-US.json')
    .then(response => response.json())
    .then((data: Record<string, string>) => {
      translations.value = data;
      isReady = true;
      // Execute all pending callbacks
      readyCallbacks.forEach(callback => callback());
      readyCallbacks.length = 0;
    })
    .catch(error => {
      console.error('Failed to load translations:', error);
      isReady = true; // Mark as ready even on error to avoid blocking
    });
}

/**
 * Simple translation function that returns the English translation
 * @param key Translation key
 * @param args Optional arguments for string interpolation - can be a single value, array, or multiple values
 * @returns Translated string or the key itself if not found
 */
export function _(key: string, ...args: (string | number | (string | number)[])[]): string {
  // Access the signal value to create reactive dependency
  let translation = translations.value[key] || key;

  // Flatten args if it's a single array argument
  const values: (string | number)[] = args.length === 1 && Array.isArray(args[0])
    ? args[0]
    : args as (string | number)[];

  // Handle template strings like "Preview {0}"
  values.forEach((arg, index) => {
    translation = translation.replace(`{${index}}`, String(arg));
  });

  return translation;
}

/**
 * Check if translations are ready or register a callback
 * @param callback Function to call when translations are loaded
 */
export function i18nReady(callback: () => void): void {
  if (isReady) {
    callback();
  } else {
    readyCallbacks.push(callback);
  }
}

/**
 * Alias for _ function (for consistency)
 */
export const __ = _;

