/**
 * Cache storage using localStorage for demo purposes.
 */

import type { SessionCache } from './types';

const CACHE_PREFIX = 'safesf_cache_';
const CACHE_INDEX_KEY = 'safesf_cache_index';

/**
 * Generate a simple hash from a string.
 */
export function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if cache is enabled.
 */
export function isCacheEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return process.env.NEXT_PUBLIC_CACHE_ENABLED === 'true';
}

/**
 * Get cached session by prompt.
 */
export function getCache(prompt: string): SessionCache | null {
  if (typeof window === 'undefined') return null;

  const hash = hashPrompt(prompt.toLowerCase().trim());
  const key = CACHE_PREFIX + hash;

  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const session = JSON.parse(cached) as SessionCache;

    // Validate cache
    if (!session.isComplete || !session.events || session.events.length === 0) {
      return null;
    }

    console.log(`[Cache] Hit for "${prompt.slice(0, 30)}..." (${session.events.length} events)`);
    return session;
  } catch (error) {
    console.error('[Cache] Error reading cache:', error);
    return null;
  }
}

/**
 * Save session cache.
 */
export function saveCache(cache: SessionCache): void {
  if (typeof window === 'undefined') return;

  const key = CACHE_PREFIX + cache.promptHash;

  try {
    localStorage.setItem(key, JSON.stringify(cache));

    // Update index
    const indexStr = localStorage.getItem(CACHE_INDEX_KEY);
    const index: string[] = indexStr ? JSON.parse(indexStr) : [];
    if (!index.includes(cache.promptHash)) {
      index.push(cache.promptHash);
      localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
    }

    console.log(`[Cache] Saved "${cache.prompt.slice(0, 30)}..." (${cache.events.length} events)`);
  } catch (error) {
    console.error('[Cache] Error saving cache:', error);
  }
}

/**
 * Clear all cached sessions.
 */
export function clearAllCache(): void {
  if (typeof window === 'undefined') return;

  try {
    const indexStr = localStorage.getItem(CACHE_INDEX_KEY);
    const index: string[] = indexStr ? JSON.parse(indexStr) : [];

    index.forEach(hash => {
      localStorage.removeItem(CACHE_PREFIX + hash);
    });

    localStorage.removeItem(CACHE_INDEX_KEY);
    console.log('[Cache] Cleared all cached sessions');
  } catch (error) {
    console.error('[Cache] Error clearing cache:', error);
  }
}

/**
 * List all cached prompts.
 */
export function listCachedPrompts(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const indexStr = localStorage.getItem(CACHE_INDEX_KEY);
    const index: string[] = indexStr ? JSON.parse(indexStr) : [];

    return index.map(hash => {
      const cached = localStorage.getItem(CACHE_PREFIX + hash);
      if (cached) {
        const session = JSON.parse(cached) as SessionCache;
        return session.prompt;
      }
      return '';
    }).filter(Boolean);
  } catch {
    return [];
  }
}
