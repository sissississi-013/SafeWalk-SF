/**
 * Cache recorder - captures events during live sessions.
 */

import type { CacheRecorder, CacheEvent, CacheEventType, SessionCache } from './types';
import { hashPrompt, saveCache } from './storage';

/**
 * Create a new cache recorder.
 */
export function createRecorder(prompt: string): CacheRecorder {
  const now = Date.now();
  return {
    promptHash: hashPrompt(prompt.toLowerCase().trim()),
    prompt,
    events: [],
    startTime: now,
    lastEventTime: now,
    isFinalized: false,
  };
}

/**
 * Record an event to the cache.
 */
export function recordEvent(
  recorder: CacheRecorder,
  type: CacheEventType,
  data: Record<string, unknown>
): void {
  if (recorder.isFinalized) {
    console.warn('[CacheRecorder] Cannot record to finalized recorder');
    return;
  }

  const now = Date.now();
  const delay = now - recorder.lastEventTime;

  const event: CacheEvent = {
    type,
    data,
    timestamp: now,
    delay,
  };

  recorder.events.push(event);
  recorder.lastEventTime = now;

  console.log(`[CacheRecorder] Recorded ${type} (delay: ${delay}ms)`);
}

/**
 * Finalize and save the recording.
 */
export function finalizeRecording(recorder: CacheRecorder): SessionCache {
  recorder.isFinalized = true;

  const cache: SessionCache = {
    promptHash: recorder.promptHash,
    prompt: recorder.prompt,
    events: recorder.events,
    recordedAt: new Date().toISOString(),
    totalDuration: Date.now() - recorder.startTime,
    isComplete: true,
  };

  // Save to localStorage
  saveCache(cache);

  console.log(`[CacheRecorder] Finalized recording (${cache.events.length} events, ${cache.totalDuration}ms)`);

  return cache;
}
