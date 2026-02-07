import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/pi-session.js', () => {
  class MockPiSession {
    private initialized = false;
    private readonly sessionFile = '/tmp/active-empty.jsonl';
    private listeners = new Map<string, Set<(payload: unknown) => void>>();

    on(event: string, handler: (payload: unknown) => void): this {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event)!.add(handler);
      return this;
    }

    off(event: string, handler: (payload: unknown) => void): this {
      this.listeners.get(event)?.delete(handler);
      return this;
    }

    async initialize(): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, 30));
      this.initialized = true;
    }

    async getState(): Promise<any> {
      if (!this.initialized) {
        throw new Error('Session not initialized');
      }
      return {
        sessionId: 'mock-session',
        sessionFile: this.sessionFile,
        isStreaming: false,
      };
    }

    getMessages(): any[] {
      return [];
    }

    hasPendingQuestionnaire(): boolean {
      return false;
    }

    isActive(): boolean {
      return false;
    }

    dispose(): void {
      // no-op
    }

    getSessionFile(): string {
      return this.sessionFile;
    }

    async listSessions(): Promise<any[]> {
      return [
        {
          id: 'stale-empty',
          path: '/tmp/stale-empty.jsonl',
          name: 'stale-empty',
          firstMessage: '',
          messageCount: 0,
          updatedAt: Date.now(),
          cwd: '/tmp',
        },
        {
          id: 'active-empty',
          path: '/tmp/active-empty.jsonl',
          name: 'active-empty',
          firstMessage: '',
          messageCount: 0,
          updatedAt: Date.now(),
          cwd: '/tmp',
        },
        {
          id: 'has-messages',
          path: '/tmp/has-messages.jsonl',
          name: 'has-messages',
          firstMessage: 'hello',
          messageCount: 2,
          updatedAt: Date.now(),
          cwd: '/tmp',
        },
      ];
    }
  }

  return { PiSession: MockPiSession };
});

import { SessionOrchestrator } from '../../src/session-orchestrator.js';

describe('SessionOrchestrator', () => {
  it('waits for slot initialization when createSlot is called concurrently', async () => {
    const orchestrator = new SessionOrchestrator('/tmp/project');

    const first = orchestrator.createSlot('default');
    const second = orchestrator.createSlot('default');

    await expect(first).resolves.toMatchObject({ slotId: 'default' });
    await expect(second).resolves.toMatchObject({ slotId: 'default' });
  });

  it('filters stale empty sessions from the list', async () => {
    const orchestrator = new SessionOrchestrator('/tmp/project');

    await orchestrator.createSlot('default');

    const sessions = await orchestrator.listSessions();
    const paths = sessions.map((session) => session.path);

    expect(paths).toContain('/tmp/active-empty.jsonl');
    expect(paths).toContain('/tmp/has-messages.jsonl');
    expect(paths).not.toContain('/tmp/stale-empty.jsonl');
  });
});
