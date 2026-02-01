import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChatMessage,
  DirectoryEntry,
  ModelInfo,
  QuestionnaireAnswer,
  SessionInfo,
  SessionState,
  SlashCommand,
  ThinkingLevel,
  UIState,
  WsClientMessage,
  WsServerEvent,
  ImageAttachment,
} from '@pi-web-ui/shared';

interface ToolExecution {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'running' | 'complete' | 'error';
  result?: string;
  isError?: boolean;
}

interface ForkMessage {
  entryId: string;
  text: string;
}

interface PendingSteer {
  id: string;
  text: string;
  timestamp: number;
}

interface WorkspaceState {
  id: string;
  path: string;
  name: string;
  state: SessionState | null;
  messages: ChatMessage[];
  sessions: SessionInfo[];
  models: ModelInfo[];
  commands: SlashCommand[];
  forkMessages: ForkMessage[];
  isStreaming: boolean;
  streamingText: string;
  streamingThinking: string;
  activeToolExecutions: ToolExecution[];
  pendingSteering: PendingSteer[];
}

interface UseWorkspacesReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;

  // Workspace management
  workspaces: WorkspaceState[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceState | null;
  allowedRoots: string[];

  // Directory browsing
  currentBrowsePath: string;
  directoryEntries: DirectoryEntry[];
  browseDirectory: (path?: string) => void;

  // Workspace actions
  openWorkspace: (path: string) => void;
  closeWorkspace: (workspaceId: string) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  setActiveWorkspaceByPath: (path: string) => void;

  // UI State (persisted to backend)
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  themeId: string | null;
  setThemeId: (themeId: string | null) => void;

  // Draft input persistence
  getDraftInput: (workspacePath: string) => string;
  setDraftInput: (workspacePath: string, value: string) => void;

  // Session actions (operate on active workspace)
  sendPrompt: (message: string, images?: ImageAttachment[]) => void;
  steer: (message: string) => void;
  followUp: (message: string) => void;
  abort: () => void;
  setModel: (provider: string, modelId: string) => void;
  setThinkingLevel: (level: ThinkingLevel) => void;
  newSession: () => void;
  switchSession: (sessionId: string) => void;
  compact: (customInstructions?: string) => void;
  refreshSessions: () => void;
  refreshModels: () => void;
  refreshCommands: () => void;

  // New session operations
  fork: (entryId: string) => void;
  getForkMessages: () => void;
  setSessionName: (name: string) => void;
  exportHtml: (outputPath?: string) => void;

  // Model/Thinking cycling
  cycleModel: (direction?: 'forward' | 'backward') => void;
  cycleThinkingLevel: () => void;

  // Mode settings
  setSteeringMode: (mode: 'all' | 'one-at-a-time') => void;
  setFollowUpMode: (mode: 'all' | 'one-at-a-time') => void;
  setAutoCompaction: (enabled: boolean) => void;
  setAutoRetry: (enabled: boolean) => void;
  abortRetry: () => void;

  // Bash execution
  executeBash: (command: string) => void;
  abortBash: () => void;

  // Stats
  getSessionStats: () => void;
  getLastAssistantText: () => void;

  // Server management
  deployStatus: 'idle' | 'building' | 'restarting' | 'error';
  deployMessage: string | null;
  deploy: () => void;

  // Questionnaire response (sends user's answers as a steer message)
  sendQuestionnaireResponse: (answers: QuestionnaireAnswer[], cancelled: boolean, toolCallId: string) => void;

  // Routing support
  restorationComplete: boolean;
  isWorkspaceOpen: (path: string) => boolean;
}

const DEFAULT_SIDEBAR_WIDTH = 224;

export function useWorkspaces(url: string): UseWorkspacesReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const hasRestoredWorkspacesRef = useRef(false);
  // Connection ID to track which connection session is current (handles React Strict Mode)
  const connectionIdRef = useRef(0);
  
  // Store the persisted UI state from the server
  const persistedUIStateRef = useRef<UIState | null>(null);
  // Track how many workspaces we're expecting to open (to avoid saving empty state during restoration)
  const pendingWorkspaceCountRef = useRef(0);
  // Track if initial restoration is fully complete (all workspaces opened)
  const [restorationComplete, setRestorationComplete] = useState(false);
  // Track which workspaces have had their sessions restored (to avoid restoring twice)
  const restoredSessionsRef = useRef<Set<string>>(new Set());

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<WorkspaceState[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [allowedRoots, setAllowedRoots] = useState<string[]>([]);
  const [draftInputs, setDraftInputs] = useState<Record<string, string>>({});
  const [sidebarWidth, setSidebarWidthState] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [themeId, setThemeIdState] = useState<string | null>(null);
  
  // Cache messages by workspace path + session file to avoid refetching on reconnection
  // Key format: "workspacePath::sessionFile"
  const messagesCacheRef = useRef<Map<string, ChatMessage[]>>(new Map());
  
  // Helper to generate cache key
  const getCacheKey = (workspacePath: string, sessionFile: string | null | undefined) => 
    `${workspacePath}::${sessionFile || 'default'}`;
  
  // Refs to access latest state in event handlers (avoids stale closure issues)
  const workspacesRef = useRef<WorkspaceState[]>([]);
  const restorationCompleteRef = useRef(false);
  
  // Keep refs in sync with state
  useEffect(() => { workspacesRef.current = workspaces; }, [workspaces]);
  useEffect(() => { restorationCompleteRef.current = restorationComplete; }, [restorationComplete]);

  const [currentBrowsePath, setCurrentBrowsePath] = useState('/');
  const [directoryEntries, setDirectoryEntries] = useState<DirectoryEntry[]>([]);
  const [deployStatus, setDeployStatus] = useState<'idle' | 'building' | 'restarting' | 'error'>('idle');
  const [deployMessage, setDeployMessage] = useState<string | null>(null);

  const send = useCallback((message: WsClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Persist open workspaces to backend when they change
  // Only save after initial restoration is complete
  useEffect(() => {
    if (!restorationComplete || !isConnected) return;
    const paths = workspaces.map((ws) => ws.path);
    send({ type: 'saveUIState', state: { openWorkspaces: paths } });
  }, [workspaces, isConnected, restorationComplete, send]);

  // Persist active workspace to backend when it changes
  useEffect(() => {
    if (!restorationComplete || !isConnected) return;
    const activeWs = workspaces.find((ws) => ws.id === activeWorkspaceId);
    if (activeWs) {
      send({ type: 'saveUIState', state: { activeWorkspacePath: activeWs.path } });
    }
  }, [activeWorkspaceId, workspaces, isConnected, restorationComplete, send]);

  const updateWorkspace = useCallback(
    (workspaceId: string, updates: Partial<WorkspaceState>) => {
      setWorkspaces((prev) =>
        prev.map((ws) => (ws.id === workspaceId ? { ...ws, ...updates } : ws))
      );
    },
    []
  );

  const handleEvent = useCallback(
    (event: WsServerEvent) => {
      switch (event.type) {
        case 'connected': {
          setAllowedRoots(event.allowedRoots);
          
          // Store persisted UI state from server
          const uiState = event.uiState;
          persistedUIStateRef.current = uiState;
          
          // Apply UI state
          setDraftInputs(uiState?.draftInputs || {});
          setSidebarWidthState(uiState?.sidebarWidth || DEFAULT_SIDEBAR_WIDTH);
          setThemeIdState(uiState?.themeId ?? null);
          
          // Request directory listing for initial view
          send({ type: 'browseDirectory' });
          
          // Restore previously open workspaces (only once per session)
          if (!hasRestoredWorkspacesRef.current) {
            hasRestoredWorkspacesRef.current = true;
            // Deduplicate paths in case of legacy state with duplicates
            const openWorkspaces = [...new Set(uiState?.openWorkspaces || [])];
            // Track how many workspaces we're waiting for
            pendingWorkspaceCountRef.current = openWorkspaces.length;
            if (openWorkspaces.length > 0) {
              openWorkspaces.forEach((path) => {
                send({ type: 'openWorkspace', path });
              });
            } else {
              // No workspaces to restore, mark restoration complete immediately
              setRestorationComplete(true);
            }
          }
          break;
        }

        case 'uiState': {
          // Update local state when server confirms UI state changes
          const uiState = event.state;
          persistedUIStateRef.current = uiState;
          setDraftInputs(uiState.draftInputs || {});
          setSidebarWidthState(uiState.sidebarWidth || DEFAULT_SIDEBAR_WIDTH);
          setThemeIdState(uiState.themeId);
          break;
        }

        case 'workspaceOpened': {
          // Decrement pending count (for initial restoration tracking)
          if (pendingWorkspaceCountRef.current > 0) {
            pendingWorkspaceCountRef.current--;
            // Mark restoration complete when all workspaces are opened
            if (pendingWorkspaceCountRef.current === 0) {
              setRestorationComplete(true);
            }
          }
          
          // Use cached messages if available and server returned fewer messages
          // (indicates a reconnection scenario where we have more recent data)
          // Cache key includes session file to avoid mixing messages from different sessions
          const cacheKey = getCacheKey(event.workspace.path, event.state.sessionFile);
          const cachedMessages = messagesCacheRef.current.get(cacheKey);
          const shouldUseCache = cachedMessages && 
            cachedMessages.length > 0 && 
            event.messages.length <= cachedMessages.length;
          const messages = shouldUseCache ? cachedMessages : event.messages;
          
          // Update cache with latest messages
          messagesCacheRef.current.set(cacheKey, messages);
          
          const newWorkspace: WorkspaceState = {
            id: event.workspace.id,
            path: event.workspace.path,
            name: event.workspace.name,
            state: event.state,
            messages,
            sessions: [],
            models: [],
            commands: [],
            forkMessages: [],
            isStreaming: false,
            streamingText: '',
            streamingThinking: '',
            activeToolExecutions: [],
            pendingSteering: [],
          };
          setWorkspaces((prev) => {
            // Don't add if already exists
            if (prev.some((ws) => ws.id === newWorkspace.id)) {
              return prev.map((ws) =>
                ws.id === newWorkspace.id ? newWorkspace : ws
              );
            }
            return [...prev, newWorkspace];
          });
          
          // Set as active if:
          // 1. There's no active workspace yet
          // 2. During restoration: it matches the persisted active workspace
          // 3. After restoration: always switch to newly opened workspace (user action)
          const activeWorkspacePath = persistedUIStateRef.current?.activeWorkspacePath;
          setActiveWorkspaceId((current) => {
            if (current === null) {
              return event.workspace.id;
            }
            // During restoration, only switch if it matches persisted active
            if (!restorationCompleteRef.current) {
              if (event.workspace.path === activeWorkspacePath) {
                return event.workspace.id;
              }
              return current;
            }
            // After restoration, always switch to newly opened workspace
            return event.workspace.id;
          });
          
          // Fetch sessions, models, and commands for this workspace
          send({ type: 'getSessions', workspaceId: event.workspace.id });
          send({ type: 'getModels', workspaceId: event.workspace.id });
          send({ type: 'getCommands', workspaceId: event.workspace.id });
          break;
        }

        case 'workspaceClosed': {
          const closedId = event.workspaceId;
          console.log('[workspaceClosed] Received close event for:', closedId);
          setWorkspaces((prev) => {
            console.log('[workspaceClosed] Before filter:', prev.map(ws => ({ id: ws.id, name: ws.name })));
            // Only remove the workspace with the exact matching ID
            const filtered = prev.filter((ws) => ws.id !== closedId);
            console.log('[workspaceClosed] After filter:', filtered.map(ws => ({ id: ws.id, name: ws.name })));
            // Sanity check: we should have removed exactly one workspace
            if (filtered.length !== prev.length - 1 && prev.length > 0) {
              console.warn(
                `[workspaceClosed] Unexpected filter result: removed ${prev.length - filtered.length} workspaces (expected 1) for ID: ${closedId}`
              );
            }
            return filtered;
          });
          setActiveWorkspaceId((current) =>
            current === closedId ? null : current
          );
          break;
        }

        case 'workspacesList':
          // Update workspace info (doesn't include full state)
          break;

        case 'directoryList':
          setCurrentBrowsePath(event.path);
          setDirectoryEntries(event.entries);
          if (event.allowedRoots) {
            setAllowedRoots(event.allowedRoots);
          }
          break;

        case 'state': {
          // Use ref to get latest workspaces (avoid stale closure)
          const workspace = workspacesRef.current.find((ws) => ws.id === event.workspaceId);
          const previousSessionFile = workspace?.state?.sessionFile;
          const newSessionFile = event.state.sessionFile;
          
          // Check if this is a session change (new/different session file)
          const isSessionChange = workspace && newSessionFile && previousSessionFile !== newSessionFile;
          
          // If session changed, clear messages immediately to avoid showing stale data
          // The actual messages will arrive shortly in a separate 'messages' event
          // Note: We don't need to clear the cache since cache keys now include session file
          if (isSessionChange) {
            updateWorkspace(event.workspaceId, { state: event.state, messages: [] });
          } else {
            updateWorkspace(event.workspaceId, { state: event.state });
          }
          
          // Persist session change (but only after initial restoration is complete)
          // We save sessionFile (path) because that's what switchSession expects
          if (restorationCompleteRef.current && isSessionChange && workspace) {
            send({ type: 'setActiveSession', workspacePath: workspace.path, sessionId: newSessionFile });
          }
          break;
        }

        case 'messages': {
          updateWorkspace(event.workspaceId, { messages: event.messages });
          // Update cache (key includes session file to avoid mixing sessions)
          const ws = workspacesRef.current.find((w) => w.id === event.workspaceId);
          if (ws) {
            const cacheKey = getCacheKey(ws.path, ws.state?.sessionFile);
            messagesCacheRef.current.set(cacheKey, event.messages);
          }
          break;
        }

        case 'sessions': {
          updateWorkspace(event.workspaceId, { sessions: event.sessions });
          
          // Restore saved active session for this workspace (only once per workspace)
          // Use refs to get latest state (avoid stale closure)
          if (persistedUIStateRef.current && !restoredSessionsRef.current.has(event.workspaceId)) {
            const workspace = workspacesRef.current.find((ws) => ws.id === event.workspaceId);
            if (workspace) {
              // Mark this workspace as having attempted session restore
              restoredSessionsRef.current.add(event.workspaceId);
              
              const activeSessions = persistedUIStateRef.current.activeSessions || {};
              const savedSessionPath = activeSessions[workspace.path];
              const currentSessionFile = workspace.state?.sessionFile;
              
              // If we have a saved session that's different from current, and it exists in the sessions list
              // Note: We save/restore by path since that's what switchSession expects
              if (savedSessionPath && savedSessionPath !== currentSessionFile) {
                const sessionExists = event.sessions.some((s) => s.path === savedSessionPath);
                if (sessionExists) {
                  send({ type: 'switchSession', workspaceId: event.workspaceId, sessionId: savedSessionPath });
                }
              }
            }
          }
          break;
        }

        case 'models': {
          updateWorkspace(event.workspaceId, { models: event.models });
          
          // Restore saved model and thinking level for this workspace (only once per workspace)
          // We use a simple check: only restore if we haven't restored sessions yet
          // (models event comes before or around the same time as sessions)
          if (persistedUIStateRef.current && !restoredSessionsRef.current.has(event.workspaceId)) {
            const workspace = workspacesRef.current.find((ws) => ws.id === event.workspaceId);
            if (workspace) {
              // Restore model
              const activeModels = persistedUIStateRef.current.activeModels || {};
              const savedModel = activeModels[workspace.path];
              if (savedModel) {
                const modelExists = event.models.some(
                  (m) => m.provider === savedModel.provider && m.id === savedModel.modelId
                );
                if (modelExists) {
                  const currentModel = workspace.state?.model;
                  if (!currentModel || currentModel.provider !== savedModel.provider || currentModel.id !== savedModel.modelId) {
                    send({ type: 'setModel', workspaceId: event.workspaceId, provider: savedModel.provider, modelId: savedModel.modelId });
                  }
                }
              }
              
              // Restore thinking level
              const thinkingLevels = persistedUIStateRef.current.thinkingLevels || {};
              const savedThinkingLevel = thinkingLevels[workspace.path];
              if (savedThinkingLevel && savedThinkingLevel !== workspace.state?.thinkingLevel) {
                send({ type: 'setThinkingLevel', workspaceId: event.workspaceId, level: savedThinkingLevel });
              }
            }
          }
          break;
        }

        case 'commands':
          updateWorkspace(event.workspaceId, { commands: event.commands });
          break;

        case 'forkMessages':
          updateWorkspace(event.workspaceId, { forkMessages: event.messages });
          break;

        case 'forkResult':
          // Fork completed - state and messages will be sent separately
          if (!event.success && event.error) {
            setError(event.error);
          }
          break;

        case 'agentStart':
          updateWorkspace(event.workspaceId, {
            isStreaming: true,
            streamingText: '',
            streamingThinking: '',
          });
          break;

        case 'agentEnd':
          updateWorkspace(event.workspaceId, {
            isStreaming: false,
            streamingText: '',
            streamingThinking: '',
            activeToolExecutions: [],
            pendingSteering: [], // Clear any remaining pending steering
          });
          send({ type: 'getState', workspaceId: event.workspaceId });
          // Refresh sessions list - the session metadata (firstMessage, updatedAt) may have changed
          send({ type: 'getSessions', workspaceId: event.workspaceId });
          break;

        case 'messageStart': {
          setWorkspaces((prev) =>
            prev.map((ws) => {
              if (ws.id !== event.workspaceId) return ws;
              
              // If this is a user message, check if it matches a pending steer
              let updatedPendingSteering = ws.pendingSteering;
              if (event.message.role === 'user') {
                // Extract text from the message content
                const messageText = event.message.content
                  .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
                  .map((c) => c.text)
                  .join('');
                
                // Find and remove matching pending steer (first match by text)
                const matchIndex = ws.pendingSteering.findIndex(
                  (p) => p.text === messageText
                );
                if (matchIndex !== -1) {
                  updatedPendingSteering = [
                    ...ws.pendingSteering.slice(0, matchIndex),
                    ...ws.pendingSteering.slice(matchIndex + 1),
                  ];
                }
              }
              
              return {
                ...ws,
                messages: [...ws.messages, event.message],
                pendingSteering: updatedPendingSteering,
              };
            })
          );
          break;
        }

        case 'messageUpdate':
          setWorkspaces((prev) =>
            prev.map((ws) => {
              if (ws.id !== event.workspaceId) return ws;
              if (event.update.type === 'textDelta' && event.update.delta) {
                return {
                  ...ws,
                  streamingText: ws.streamingText + event.update.delta,
                };
              } else if (
                event.update.type === 'thinkingDelta' &&
                event.update.delta
              ) {
                return {
                  ...ws,
                  streamingThinking: ws.streamingThinking + event.update.delta,
                };
              }
              return ws;
            })
          );
          break;

        case 'messageEnd':
          setWorkspaces((prev) => {
            const updated = prev.map((ws) =>
              ws.id === event.workspaceId
                ? {
                    ...ws,
                    messages: ws.messages.map((m) =>
                      m.id === event.message.id ? event.message : m
                    ),
                    streamingText: '',
                    streamingThinking: '',
                  }
                : ws
            );
            // Update cache with the new messages (key includes session file)
            const ws = updated.find((w) => w.id === event.workspaceId);
            if (ws) {
              const cacheKey = getCacheKey(ws.path, ws.state?.sessionFile);
              messagesCacheRef.current.set(cacheKey, ws.messages);
            }
            return updated;
          });
          break;

        case 'toolStart':
          setWorkspaces((prev) =>
            prev.map((ws) =>
              ws.id === event.workspaceId
                ? {
                    ...ws,
                    activeToolExecutions: [
                      ...ws.activeToolExecutions,
                      {
                        toolCallId: event.toolCallId,
                        toolName: event.toolName,
                        args: event.args,
                        status: 'running' as const,
                      },
                    ],
                  }
                : ws
            )
          );
          break;

        case 'toolUpdate':
          setWorkspaces((prev) =>
            prev.map((ws) =>
              ws.id === event.workspaceId
                ? {
                    ...ws,
                    activeToolExecutions: ws.activeToolExecutions.map((t) =>
                      t.toolCallId === event.toolCallId
                        ? { ...t, result: event.partialResult }
                        : t
                    ),
                  }
                : ws
            )
          );
          break;

        case 'toolEnd':
          // Remove completed tools from active executions - they'll be shown
          // in the finalized message content via MessageBubble
          setWorkspaces((prev) =>
            prev.map((ws) =>
              ws.id === event.workspaceId
                ? {
                    ...ws,
                    activeToolExecutions: ws.activeToolExecutions.filter(
                      (t) => t.toolCallId !== event.toolCallId
                    ),
                  }
                : ws
            )
          );
          break;

        case 'compactionStart':
          // Could show a loading indicator
          break;

        case 'compactionEnd':
          send({ type: 'getMessages', workspaceId: event.workspaceId });
          send({ type: 'getState', workspaceId: event.workspaceId });
          break;

        case 'error':
          setError(event.message);
          break;

        case 'deployStatus':
          setDeployStatus(event.status);
          setDeployMessage(event.message || null);
          break;
      }
    },
    [send, updateWorkspace]
  );

  const connect = useCallback(() => {
    // Prevent duplicate connections
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Increment connection ID to invalidate any pending events from old connections
    connectionIdRef.current++;
    const thisConnectionId = connectionIdRef.current;
    
    setIsConnecting(true);
    setError(null);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
    };

    ws.onclose = () => {
      // Only handle if this is still the current WebSocket
      if (wsRef.current !== ws) {
        return;
      }
      
      setIsConnected(false);
      setIsConnecting(false);
      wsRef.current = null;

      // Clear workspaces since server-side sessions are gone
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      
      // Reset restoration flags for reconnect
      hasRestoredWorkspacesRef.current = false;
      restoredSessionsRef.current = new Set();
      setRestorationComplete(false);

      // Attempt to reconnect after 2 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
    };

    ws.onmessage = (event) => {
      // Ignore events from stale connections (handles React Strict Mode)
      if (connectionIdRef.current !== thisConnectionId) {
        console.log('[useWorkspaces] Ignoring event from stale connection');
        return;
      }
      try {
        const data: WsServerEvent = JSON.parse(event.data);
        handleEvent(data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };
  }, [url, handleEvent]);

  useEffect(() => {
    // Use a flag to handle React Strict Mode double-mounting
    let mounted = true;
    
    const doConnect = () => {
      if (!mounted) return;
      connect();
    };
    
    doConnect();

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // Only close if we're actually connected
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      // Reset state for potential remount
      hasRestoredWorkspacesRef.current = false;
      restoredSessionsRef.current = new Set();
    };
  }, [connect]);

  const activeWorkspace =
    workspaces.find((ws) => ws.id === activeWorkspaceId) || null;

  // Helper to require active workspace for actions
  const withActiveWorkspace = useCallback(
    (action: (workspaceId: string) => void) => {
      if (!activeWorkspaceId) {
        setError('No active workspace');
        return;
      }
      action(activeWorkspaceId);
    },
    [activeWorkspaceId]
  );

  // Sidebar width setter with backend persistence
  const setSidebarWidth = useCallback((width: number) => {
    setSidebarWidthState(width);
    send({ type: 'setSidebarWidth', width });
  }, [send]);

  // Theme setter with backend persistence
  const setThemeId = useCallback((id: string | null) => {
    setThemeIdState(id);
    send({ type: 'setTheme', themeId: id });
  }, [send]);

  // Draft input setter with backend persistence
  const setDraftInput = useCallback((workspacePath: string, value: string) => {
    setDraftInputs((prev) => ({ ...prev, [workspacePath]: value }));
    send({ type: 'setDraftInput', workspacePath, value });
  }, [send]);

  return {
    isConnected,
    isConnecting,
    error,

    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    allowedRoots,

    currentBrowsePath,
    directoryEntries,
    browseDirectory: (path?: string) => send({ type: 'browseDirectory', path }),

    openWorkspace: (path: string) => send({ type: 'openWorkspace', path }),
    closeWorkspace: (workspaceId: string) => {
      if (!workspaceId) {
        console.error('[closeWorkspace] Invalid workspaceId:', workspaceId);
        return;
      }
      send({ type: 'closeWorkspace', workspaceId });
    },
    setActiveWorkspace: setActiveWorkspaceId,
    setActiveWorkspaceByPath: (path: string) => {
      const ws = workspaces.find((w) => w.path === path);
      if (ws) {
        setActiveWorkspaceId(ws.id);
      }
    },

    // UI State
    sidebarWidth,
    setSidebarWidth,
    themeId,
    setThemeId,

    getDraftInput: (workspacePath: string) => draftInputs[workspacePath] || '',
    setDraftInput,

    sendPrompt: (message: string, images?: ImageAttachment[]) =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'prompt', workspaceId, message, images })
      ),
    steer: (message: string) =>
      withActiveWorkspace((workspaceId) => {
        // Add to pending steering list for UI display
        const pendingId = `steer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        setWorkspaces((prev) =>
          prev.map((ws) =>
            ws.id === workspaceId
              ? {
                  ...ws,
                  pendingSteering: [
                    ...ws.pendingSteering,
                    { id: pendingId, text: message, timestamp: Date.now() },
                  ],
                }
              : ws
          )
        );
        send({ type: 'steer', workspaceId, message });
      }),
    followUp: (message: string) =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'followUp', workspaceId, message })
      ),
    abort: () =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'abort', workspaceId })
      ),
    setModel: (provider: string, modelId: string) =>
      withActiveWorkspace((workspaceId) => {
        send({ type: 'setModel', workspaceId, provider, modelId });
        // Persist the model selection for this workspace
        const workspace = workspaces.find((ws) => ws.id === workspaceId);
        if (workspace) {
          send({ type: 'setActiveModel', workspacePath: workspace.path, provider, modelId });
        }
      }),
    setThinkingLevel: (level: ThinkingLevel) =>
      withActiveWorkspace((workspaceId) => {
        send({ type: 'setThinkingLevel', workspaceId, level });
        // Persist the thinking level for this workspace
        const workspace = workspaces.find((ws) => ws.id === workspaceId);
        if (workspace) {
          send({ type: 'setThinkingLevelPref', workspacePath: workspace.path, level });
        }
      }),
    newSession: () =>
      withActiveWorkspace((workspaceId) => {
        send({ type: 'newSession', workspaceId });
        // Note: The new session ID will be persisted when we receive the state update
        // We'll handle that by tracking when a new session was just created
      }),
    switchSession: (sessionId: string) =>
      withActiveWorkspace((workspaceId) => {
        send({ type: 'switchSession', workspaceId, sessionId });
        // Persist the active session for this workspace
        const workspace = workspaces.find((ws) => ws.id === workspaceId);
        if (workspace) {
          send({ type: 'setActiveSession', workspacePath: workspace.path, sessionId });
        }
      }),
    compact: (customInstructions?: string) =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'compact', workspaceId, customInstructions })
      ),
    refreshSessions: () =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'getSessions', workspaceId })
      ),
    refreshModels: () =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'getModels', workspaceId })
      ),
    refreshCommands: () =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'getCommands', workspaceId })
      ),

    // New session operations
    fork: (entryId: string) =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'fork', workspaceId, entryId })
      ),
    getForkMessages: () =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'getForkMessages', workspaceId })
      ),
    setSessionName: (name: string) =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'setSessionName', workspaceId, name })
      ),
    exportHtml: (outputPath?: string) =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'exportHtml', workspaceId, outputPath })
      ),

    // Model/Thinking cycling
    cycleModel: (direction?: 'forward' | 'backward') =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'cycleModel', workspaceId, direction })
      ),
    cycleThinkingLevel: () =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'cycleThinkingLevel', workspaceId })
      ),

    // Mode settings
    setSteeringMode: (mode: 'all' | 'one-at-a-time') =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'setSteeringMode', workspaceId, mode })
      ),
    setFollowUpMode: (mode: 'all' | 'one-at-a-time') =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'setFollowUpMode', workspaceId, mode })
      ),
    setAutoCompaction: (enabled: boolean) =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'setAutoCompaction', workspaceId, enabled })
      ),
    setAutoRetry: (enabled: boolean) =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'setAutoRetry', workspaceId, enabled })
      ),
    abortRetry: () =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'abortRetry', workspaceId })
      ),

    // Bash execution
    executeBash: (command: string) =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'bash', workspaceId, command })
      ),
    abortBash: () =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'abortBash', workspaceId })
      ),

    // Stats
    getSessionStats: () =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'getSessionStats', workspaceId })
      ),
    getLastAssistantText: () =>
      withActiveWorkspace((workspaceId) =>
        send({ type: 'getLastAssistantText', workspaceId })
      ),

    // Server management
    deployStatus,
    deployMessage,
    deploy: () => send({ type: 'deploy' }),

    // Questionnaire response - format answers and send as steer message
    sendQuestionnaireResponse: (answers: QuestionnaireAnswer[], cancelled: boolean, _toolCallId: string) =>
      withActiveWorkspace((workspaceId) => {
        if (cancelled) {
          // Send cancellation as a steer message
          send({ type: 'steer', workspaceId, message: 'User cancelled the questionnaire.' });
        } else {
          // Format answers as a readable message
          const answerLines = answers.map((a) => {
            if (a.wasCustom) {
              return `${a.id}: (custom) ${a.label}`;
            }
            return `${a.id}: ${a.index ? `${a.index}. ` : ''}${a.label}`;
          });
          const message = `Questionnaire answers:\n${answerLines.join('\n')}`;
          send({ type: 'steer', workspaceId, message });
        }
      }),

    // Routing support
    restorationComplete,
    isWorkspaceOpen: (path: string) => workspaces.some((ws) => ws.path === path),
  };
}
