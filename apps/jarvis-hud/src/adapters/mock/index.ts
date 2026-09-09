/**
 * Mock-only runtime.
 *
 * Kept as a thin wrapper over `createRuntime` so tests and the mock fallback
 * take exactly the same path the real assembly does — with every integration
 * pinned to `mock`, so no probe and no network activity happens.
 */

import { createRuntime, createMockRuntimeConfig, type RuntimeOptions } from '../index';
import type { JarvisRuntime } from '../../kernel/jarvisRuntime';

export type MockRuntimeOptions = Omit<RuntimeOptions, 'integrations' | 'credentials'>;

export function createMockRuntime(options: MockRuntimeOptions = {}): Promise<JarvisRuntime> {
  return createRuntime({ ...options, integrations: createMockRuntimeConfig() });
}

export { BAR_COUNT, mockTranscript, sampleLevels, silentLevels, voiceLabel } from './mockVoice';
