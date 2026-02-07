/**
 * Sync Integration Layer
 * 
 * Bridges the existing event-based architecture with the new sync-based state.
 * This allows gradual migration without rewriting everything at once.
 */

import { EventEmitter } from 'events';
import type { WebSocket } from 'ws';
import { SyncManager, type SyncMessage } from './SyncManager.js';
import type { SessionInfo as SyncSessionInfo } from './SyncState.js';
import type { ActiveJobState, ActivePlanState, JobInfo, PaneTabPageState, PlanInfo, SessionEvent } from '@pi-web-ui/shared';

export class SyncIntegration extends EventEmitter {
  private syncManager: SyncManager;
  private clientWsMap = new Map<string, WebSocket>();

  constructor(dbPath: string) {
    super();
    this.syncManager = new SyncManager(dbPath);
    
    // Forward sync events to WebSocket clients
    this.syncManager.on('stateChanged', ({ workspaceId, version, mutation }) => {
      this.emit('syncStateChanged', { workspaceId, version, mutation });
    });
  }

  /**
   * Register a WebSocket client for sync
   */
  registerClient(ws: WebSocket, workspaceId: string, clientId?: string): string {
    const id = clientId || this.syncManager.registerClient(ws, workspaceId);
    this.clientWsMap.set(id, ws);
    
    // Handle sync messages from client
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as SyncMessage & { type: string };
        if (msg.type === 'sync' || msg.type === 'mutate' || msg.type === 'ack') {
          // Forward to sync manager
          this.handleClientSyncMessage(id, msg);
        }
      } catch {
        // Not a sync message, ignore
      }
    });

    // Send initial sync
    this.syncManager.sendInitialSync(id);
    
    return id;
  }

  /**
   * Convert a session event to a state mutation
   */
  handleSessionEvent(workspaceId: string, slotId: string, event: SessionEvent): void {
    switch (event.type) {
      case 'messageStart': {
        this.syncManager.mutate({
          type: 'messagesAppend',
          workspaceId,
          slotId,
          messages: [event.message],
        });
        break;
      }
      
      case 'messageUpdate': {
        // Update streaming text - could be optimized
        break;
      }
      
      case 'messageEnd': {
        // Message complete - update with final content
        break;
      }
      
      case 'toolStart': {
        this.syncManager.mutate({
          type: 'toolExecutionStart',
          workspaceId,
          slotId,
          execution: {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            status: 'running',
            args: event.args,
            startedAt: Date.now(),
          },
        });
        break;
      }
      
      case 'toolEnd': {
        this.syncManager.mutate({
          type: 'toolExecutionEnd',
          workspaceId,
          slotId,
          toolCallId: event.toolCallId,
          result: event.result,
          error: event.isError,
        });
        break;
      }
      
      case 'agentStart': {
        this.syncManager.mutate({
          type: 'slotUpdate',
          workspaceId,
          slotId,
          updates: { isStreaming: true },
        });
        break;
      }
      
      case 'agentEnd': {
        this.syncManager.mutate({
          type: 'slotUpdate',
          workspaceId,
          slotId,
          updates: { isStreaming: false },
        });
        break;
      }
      
      case 'compactionStart': {
        this.syncManager.mutate({
          type: 'slotUpdate',
          workspaceId,
          slotId,
          updates: { isCompacting: true },
        });
        break;
      }
      
      case 'compactionEnd': {
        this.syncManager.mutate({
          type: 'slotUpdate',
          workspaceId,
          slotId,
          updates: { isCompacting: false },
        });
        break;
      }
    }
  }

  /**
   * Set pending questionnaire UI
   */
  setPendingQuestionnaire(workspaceId: string, slotId: string, toolCallId: string, questions: unknown[]): void {
    this.syncManager.mutate({
      type: 'pendingUISet',
      workspaceId,
      slotId,
      pendingUI: {
        type: 'questionnaire',
        id: toolCallId,
        data: { toolCallId, questions },
        createdAt: Date.now(),
      },
    });
  }

  /**
   * Clear pending UI (questionnaire answered)
   */
  clearPendingUI(workspaceId: string, slotId: string): void {
    this.syncManager.mutate({
      type: 'pendingUISet',
      workspaceId,
      slotId,
      pendingUI: null,
    });
  }

  /**
   * Sync sessions list for a workspace.
   */
  setSessions(workspaceId: string, sessions: SyncSessionInfo[]): void {
    this.syncManager.mutate({
      type: 'sessionsUpdate',
      workspaceId,
      sessions,
    });
  }

  /**
   * Sync plans list for a workspace.
   */
  setPlans(workspaceId: string, plans: PlanInfo[]): void {
    this.syncManager.mutate({
      type: 'plansUpdate',
      workspaceId,
      plans,
    });
  }

  /**
   * Sync jobs list for a workspace.
   */
  setJobs(workspaceId: string, jobs: JobInfo[]): void {
    this.syncManager.mutate({
      type: 'jobsUpdate',
      workspaceId,
      jobs,
    });
  }

  /**
   * Sync active plan state for a workspace.
   */
  setActivePlan(workspaceId: string, activePlan: ActivePlanState | null): void {
    this.syncManager.mutate({
      type: 'activePlanUpdate',
      workspaceId,
      activePlan,
    });
  }

  /**
   * Sync active job states for a workspace.
   */
  setActiveJobs(workspaceId: string, activeJobs: ActiveJobState[]): void {
    this.syncManager.mutate({
      type: 'activeJobsUpdate',
      workspaceId,
      activeJobs,
    });
  }

  /**
   * Get workspace state from sync
   */
  getWorkspaceState(workspaceId: string) {
    return this.syncManager.getWorkspaceState(workspaceId);
  }

  /**
   * Create workspace in sync state
   */
  createWorkspace(workspaceId: string, path: string): void {
    this.syncManager.mutate({
      type: 'workspaceCreate',
      workspaceId,
      path,
    });
  }

  /**
   * Create slot in sync state
   */
  createSlot(workspaceId: string, slotId: string): void {
    this.syncManager.mutate({
      type: 'slotCreate',
      workspaceId,
      slotId,
    });
  }

  /**
   * Delete slot in sync state.
   */
  deleteSlot(workspaceId: string, slotId: string): void {
    this.syncManager.mutate({
      type: 'slotDelete',
      workspaceId,
      slotId,
    });
  }

  /**
   * Sync workspace UI state used by multi-tab web UI.
   */
  setWorkspaceUI(
    workspaceId: string,
    workspacePath: string,
    rightPaneOpen: boolean,
    paneTabs: PaneTabPageState[],
    activePaneTab: string | null,
  ): void {
    this.syncManager.mutate({
      type: 'workspaceUIUpdate',
      workspaceId,
      workspacePath,
      rightPaneOpen,
      paneTabs,
      activePaneTab,
    });
  }

  /**
   * Sync queued steering/follow-up messages for a slot.
   */
  setQueuedMessages(
    workspaceId: string,
    slotId: string,
    queuedMessages: { steering: string[]; followUp: string[] },
  ): void {
    this.syncManager.mutate({
      type: 'queuedMessagesUpdate',
      workspaceId,
      slotId,
      queuedMessages,
    });
  }

  /**
   * Mark workspace closed in sync state.
   */
  closeWorkspace(workspaceId: string): void {
    this.syncManager.mutate({
      type: 'workspaceClose',
      workspaceId,
    });
  }

  private handleClientSyncMessage(clientId: string, message: SyncMessage): void {
    // Handle sync-related messages
    if (message.type === 'sync') {
      this.syncManager.sendInitialSync(clientId, message.sinceVersion);
    }
  }

  dispose(): void {
    this.syncManager.dispose();
    this.clientWsMap.clear();
    this.removeAllListeners();
  }
}
