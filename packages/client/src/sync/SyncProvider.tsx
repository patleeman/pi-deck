/**
 * Sync Provider - Integrates sync protocol with existing useWorkspaces
 * 
 * Wraps the WebSocket connection and handles sync protocol messages:
 * - Sends acks for received versions
 * - Handles delta messages from server
 * - Handles snapshot messages on reconnect
 * - Broadcasts state changes to all connected tabs (via BroadcastChannel)
 */

import { useEffect, useRef } from 'react';

export interface SyncMessage {
  type: 'sync' | 'mutate' | 'ack' | 'snapshot' | 'delta';
  clientId?: string;
  workspaceId?: string;
  version?: number;
  sinceVersion?: number;
  mutation?: StateMutation;
  state?: Record<string, WorkspaceState>;
  deltas?: StateDelta[];
}

export interface StateDelta {
  version: number;
  workspaceId: string;
  mutation: StateMutation;
}

export type StateMutation =
  | { type: 'workspaceCreate'; workspaceId: string; path: string }
  | { type: 'workspaceClose'; workspaceId: string }
  | { type: 'slotCreate'; workspaceId: string; slotId: string }
  | { type: 'slotUpdate'; workspaceId: string; slotId: string; updates: Partial<SlotState> }
  | { type: 'slotDelete'; workspaceId: string; slotId: string }
  | { type: 'messagesAppend'; workspaceId: string; slotId: string; messages: unknown[] }
  | { type: 'pendingUISet'; workspaceId: string; slotId: string; pendingUI: PendingUI | null }
  | { type: 'toolExecutionStart'; workspaceId: string; slotId: string; execution: ToolExecution }
  | { type: 'toolExecutionEnd'; workspaceId: string; slotId: string; toolCallId: string; result: unknown; error?: boolean }
  | { type: 'paneUpdate'; workspaceId: string; updates: Partial<PaneState> }
  | { type: 'sessionsUpdate'; workspaceId: string; sessions: unknown[] }
  | { type: 'plansUpdate'; workspaceId: string; plans: unknown[] }
  | { type: 'jobsUpdate'; workspaceId: string; jobs: unknown[] }
  | { type: 'activePlanUpdate'; workspaceId: string; activePlan: unknown | null }
  | { type: 'activeJobsUpdate'; workspaceId: string; activeJobs: unknown[] }
  | { type: 'workspaceUIUpdate'; workspaceId: string; workspacePath: string; rightPaneOpen: boolean; paneTabs: unknown[]; activePaneTab: string | null }
  | { type: 'queuedMessagesUpdate'; workspaceId: string; slotId: string; queuedMessages: { steering: string[]; followUp: string[] } };

export interface WorkspaceState {
  id: string;
  path: string;
  active: boolean;
  slots: Record<string, SlotState>;
  panes: PaneState;
  sessions?: unknown[];
  plans?: unknown[];
  jobs?: unknown[];
  activePlan?: unknown | null;
  activeJobs?: unknown[];
}

export interface SlotState {
  id: string;
  sessionId: string | null;
  messages: unknown[];
  isStreaming: boolean;
  isCompacting: boolean;
  pendingUI: PendingUI | null;
  activeTools: ToolExecution[];
}

export interface PaneState {
  tabs: string[];
  activeTab: string | null;
  splitView: boolean;
}

export interface PendingUI {
  type: 'questionnaire' | 'extensionDialog' | 'customUI';
  id: string;
  data: unknown;
}

export interface ToolExecution {
  toolCallId: string;
  toolName: string;
  status: 'running' | 'completed' | 'error';
  args: Record<string, unknown>;
  result?: unknown;
}

interface SyncCallbacks {
  onDelta: (delta: StateDelta) => void;
  onSnapshot: (snapshot: { version: number; workspaces: Record<string, WorkspaceState> }) => void;
  onWorkspaceUpdate: (workspaceId: string, updates: Partial<WorkspaceState>) => void;
  onSlotUpdate: (workspaceId: string, slotId: string, updates: Partial<SlotState>) => void;
}

export class SyncClient {
  private ws: globalThis.WebSocket | null = null;
  private lastSyncVersion = 0;
  private pendingAcks = new Set<number>();
  private callbacks: SyncCallbacks;
  private reconnectTimeout: number | null = null;
  private isReconnecting = false;

  // BroadcastChannel for multi-tab sync
  private bc: BroadcastChannel | null = null;

  constructor(callbacks: SyncCallbacks) {
    this.callbacks = callbacks;
    
    // Set up BroadcastChannel for cross-tab communication
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.bc = new BroadcastChannel('pi-web-ui-sync');
      this.bc.onmessage = (event) => {
        const msg = event.data as { type: string; delta?: StateDelta; workspaceId?: string };
        if (msg.type === 'sync-delta' && msg.delta) {
          // Another tab received a delta, apply it locally too
          this.callbacks.onDelta(msg.delta);
        }
      };
    }
  }

  attach(ws: globalThis.WebSocket): void {
    this.ws = ws;
    this.isReconnecting = false;

    // Send initial sync request
    this.sendSyncRequest();

    // Handle incoming messages
    const originalOnMessage = ws.onmessage;
    ws.onmessage = (event) => {
      // Process sync messages first
      try {
        const data = JSON.parse(event.data as string) as SyncMessage & { type: string };
        if (this.handleSyncMessage(data)) {
          // Sync message handled, don't pass to original handler
          return;
        }
      } catch {
        // Not JSON or not a sync message, pass through
      }

      // Pass to original handler
      if (originalOnMessage) {
        originalOnMessage.call(ws, event);
      }
    };

    // Handle reconnect
    const originalOnClose = ws.onclose;
    ws.onclose = (event) => {
      if (!this.isReconnecting) {
        this.isReconnecting = true;
        this.scheduleReconnect();
      }
      if (originalOnClose) {
        originalOnClose.call(ws, event);
      }
    };
  }

  detach(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.ws = null;
  }

  dispose(): void {
    this.detach();
    this.bc?.close();
  }

  private handleSyncMessage(data: SyncMessage): boolean {
    switch (data.type) {
      case 'delta': {
        if (data.deltas && data.deltas.length > 0) {
          for (const delta of data.deltas) {
            this.applyDelta(delta);
          }
          // Send ack for the latest version
          const latestVersion = data.deltas[data.deltas.length - 1].version;
          this.sendAck(latestVersion);
        }
        return true;
      }

      case 'snapshot': {
        if (data.state) {
          this.callbacks.onSnapshot({
            version: data.version || 0,
            workspaces: data.state as Record<string, WorkspaceState>,
          });
          this.lastSyncVersion = data.version || 0;
          this.sendAck(this.lastSyncVersion);
        }
        return true;
      }

      default:
        return false;
    }
  }

  private applyDelta(delta: StateDelta): void {
    // Apply the delta
    this.callbacks.onDelta(delta);

    // Track version
    this.lastSyncVersion = Math.max(this.lastSyncVersion, delta.version);

    // Broadcast to other tabs
    if (this.bc) {
      this.bc.postMessage({ type: 'sync-delta', delta });
    }
  }

  private sendSyncRequest(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg: SyncMessage = {
      type: 'sync',
      sinceVersion: this.lastSyncVersion,
    };
    this.ws.send(JSON.stringify(msg));
  }

  private sendAck(version: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg: SyncMessage = {
      type: 'ack',
      version,
    };
    this.ws.send(JSON.stringify(msg));
    this.pendingAcks.delete(version);
  }

  private scheduleReconnect(): void {
    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, this.pendingAcks.size), 30000);
    this.reconnectTimeout = window.setTimeout(() => {
      if (this.ws) {
        this.sendSyncRequest();
      }
    }, delay);
  }

  // Public method to apply mutations locally (optimistic updates)
  applyOptimisticMutation(mutation: StateMutation): void {
    // Apply to local state immediately
    const delta: StateDelta = {
      version: -1, // Optimistic, no server version yet
      workspaceId: this.getWorkspaceIdFromMutation(mutation),
      mutation,
    };
    this.callbacks.onDelta(delta);

    // Broadcast to other tabs
    if (this.bc) {
      this.bc.postMessage({ type: 'sync-delta', delta });
    }
  }

  private getWorkspaceIdFromMutation(mutation: StateMutation): string {
    return (mutation as { workspaceId: string }).workspaceId;
  }
}

// React hook for using sync
export function useSync(ws: globalThis.WebSocket | null, callbacks: SyncCallbacks): void {
  const syncClientRef = useRef<SyncClient | null>(null);

  useEffect(() => {
    if (!ws) return;

    // Create sync client if not exists
    if (!syncClientRef.current) {
      syncClientRef.current = new SyncClient(callbacks);
    }

    // Attach to WebSocket
    syncClientRef.current.attach(ws);

    return () => {
      syncClientRef.current?.detach();
    };
  }, [ws, callbacks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      syncClientRef.current?.dispose();
      syncClientRef.current = null;
    };
  }, []);
}
