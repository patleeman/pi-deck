/**
 * Sync module exports
 */

export { SyncState, type StateMutation, type GlobalState, type WorkspaceState, type SlotState, type PendingUI, type ToolExecution, type SessionInfo } from './SyncState.js';
export { SQLiteStore, type StoredSnapshot, type StoredDelta, type StoredClient } from './SQLiteStore.js';
export { SyncManager, type SyncClient, type SyncMessage } from './SyncManager.js';
export { SyncIntegration } from './SyncIntegration.js';
export { ScopedFileWatcher, type FileWatcherEvent, type FileWatcherOptions } from './FileWatcher.js';
export { PlanJobWatcher, type PlanJobWatcherEvent, type PlanJobWatcherOptions } from './PlanJobWatcher.js';
