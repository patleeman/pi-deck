import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BashResult,
  ChatMessage,
  ModelInfo,
  SessionInfo,
  SessionState,
  SessionStats,
  ThinkingLevel,
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

// Bash execution state
interface BashExecution {
  command: string;
  output: string;
  isRunning: boolean;
  result?: BashResult;
}

interface UseWebSocketReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;

  // Workspace state
  workspaceId: string | null;
  allowedRoots: string[];

  // Session state
  state: SessionState | null;
  messages: ChatMessage[];
  sessions: SessionInfo[];
  models: ModelInfo[];

  // Streaming state
  isStreaming: boolean;
  streamingText: string;
  streamingThinking: string;
  activeToolExecutions: ToolExecution[];

  // Bash execution state
  bashExecution: BashExecution | null;

  // Fork messages (for fork UI)
  forkMessages: Array<{ entryId: string; text: string }>;

  // Session stats
  sessionStats: SessionStats | null;

  // Last assistant text
  lastAssistantText: string | null;

  // Actions
  openWorkspace: (path: string) => void;
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
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [allowedRoots, setAllowedRoots] = useState<string[]>([]);

  const [state, setState] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [activeToolExecutions, setActiveToolExecutions] = useState<ToolExecution[]>([]);

  // New state for additional features
  const [bashExecution, setBashExecution] = useState<BashExecution | null>(null);
  const [forkMessages, setForkMessages] = useState<Array<{ entryId: string; text: string }>>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [lastAssistantText, setLastAssistantText] = useState<string | null>(null);

  // Ref to track current workspaceId for use in callbacks
  const workspaceIdRef = useRef<string | null>(null);
  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  const send = useCallback((message: WsClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const handleEvent = useCallback((event: WsServerEvent) => {
    switch (event.type) {
      case 'connected':
        setAllowedRoots(event.allowedRoots);
        // Auto-open first allowed root as default workspace
        if (event.allowedRoots.length > 0) {
          send({ type: 'openWorkspace', path: event.allowedRoots[0] });
        }
        break;

      case 'workspaceOpened':
        setWorkspaceId(event.workspace.id);
        setState(event.state);
        setMessages(event.messages);
        // Now fetch sessions and models for this workspace
        send({ type: 'getSessions', workspaceId: event.workspace.id });
        send({ type: 'getModels', workspaceId: event.workspace.id });
        break;

      case 'state':
        if (event.workspaceId === workspaceIdRef.current) {
          setState(event.state);
        }
        break;

      case 'messages':
        if (event.workspaceId === workspaceIdRef.current) {
          setMessages(event.messages);
        }
        break;

      case 'sessions':
        if (event.workspaceId === workspaceIdRef.current) {
          setSessions(event.sessions);
        }
        break;

      case 'models':
        if (event.workspaceId === workspaceIdRef.current) {
          setModels(event.models);
        }
        break;

      case 'agentStart':
        if (event.workspaceId === workspaceIdRef.current) {
          setIsStreaming(true);
          setStreamingText('');
          setStreamingThinking('');
        }
        break;

      case 'agentEnd':
        if (event.workspaceId === workspaceIdRef.current) {
          setIsStreaming(false);
          setStreamingText('');
          setStreamingThinking('');
          setActiveToolExecutions([]);
          if (workspaceIdRef.current) {
            send({ type: 'getState', workspaceId: workspaceIdRef.current });
          }
        }
        break;

      case 'messageStart':
        if (event.workspaceId === workspaceIdRef.current) {
          setMessages((prev) => [...prev, event.message]);
        }
        break;

      case 'messageUpdate':
        if (event.workspaceId === workspaceIdRef.current) {
          if (event.update.type === 'textDelta' && event.update.delta) {
            setStreamingText((prev) => prev + event.update.delta);
          } else if (event.update.type === 'thinkingDelta' && event.update.delta) {
            setStreamingThinking((prev) => prev + event.update.delta);
          }
        }
        break;

      case 'messageEnd':
        if (event.workspaceId === workspaceIdRef.current) {
          setMessages((prev) =>
            prev.map((m) => (m.id === event.message.id ? event.message : m))
          );
          setStreamingText('');
          setStreamingThinking('');
        }
        break;

      case 'toolStart':
        if (event.workspaceId === workspaceIdRef.current) {
          setActiveToolExecutions((prev) => [
            ...prev,
            {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args: event.args,
              status: 'running',
            },
          ]);
        }
        break;

      case 'toolUpdate':
        if (event.workspaceId === workspaceIdRef.current) {
          setActiveToolExecutions((prev) =>
            prev.map((t) =>
              t.toolCallId === event.toolCallId
                ? { ...t, result: event.partialResult }
                : t
            )
          );
        }
        break;

      case 'toolEnd':
        if (event.workspaceId === workspaceIdRef.current) {
          // Remove completed tools from active executions - they'll be shown
          // in the finalized message content via MessageBubble
          setActiveToolExecutions((prev) =>
            prev.filter((t) => t.toolCallId !== event.toolCallId)
          );
        }
        break;

      case 'compactionStart':
        // Could show a loading indicator
        break;

      case 'compactionEnd':
        if (event.workspaceId === workspaceIdRef.current && workspaceIdRef.current) {
          send({ type: 'getMessages', workspaceId: workspaceIdRef.current });
          send({ type: 'getState', workspaceId: workspaceIdRef.current });
        }
        break;

      case 'error':
        setError(event.message);
        break;

      // New event handlers
      case 'forkResult':
        if (event.workspaceId === workspaceIdRef.current) {
          if (!event.success) {
            setError(event.error || 'Fork failed');
          }
          // State and messages are refreshed automatically by the server
        }
        break;

      case 'forkMessages':
        if (event.workspaceId === workspaceIdRef.current) {
          setForkMessages(event.messages);
        }
        break;

      case 'exportHtmlResult':
        if (event.workspaceId === workspaceIdRef.current) {
          if (!event.success) {
            setError(event.error || 'Export failed');
          }
          // Could show success notification with path
        }
        break;

      case 'sessionStats':
        if (event.workspaceId === workspaceIdRef.current) {
          setSessionStats(event.stats);
        }
        break;

      case 'lastAssistantText':
        if (event.workspaceId === workspaceIdRef.current) {
          setLastAssistantText(event.text);
        }
        break;

      case 'bashStart':
        if (event.workspaceId === workspaceIdRef.current) {
          setBashExecution({
            command: event.command,
            output: '',
            isRunning: true,
          });
        }
        break;

      case 'bashOutput':
        if (event.workspaceId === workspaceIdRef.current) {
          setBashExecution((prev) =>
            prev ? { ...prev, output: prev.output + event.chunk } : null
          );
        }
        break;

      case 'bashEnd':
        if (event.workspaceId === workspaceIdRef.current) {
          setBashExecution((prev) =>
            prev ? { ...prev, isRunning: false, result: event.result } : null
          );
        }
        break;
    }
  }, [send]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

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
      setIsConnected(false);
      setIsConnecting(false);
      wsRef.current = null;

      // Attempt to reconnect after 2 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
    };

    ws.onmessage = (event) => {
      try {
        const data: WsServerEvent = JSON.parse(event.data);
        handleEvent(data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };
  }, [url, handleEvent]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    isConnected,
    isConnecting,
    error,
    workspaceId,
    allowedRoots,
    state,
    messages,
    sessions,
    models,
    isStreaming,
    streamingText,
    streamingThinking,
    activeToolExecutions,
    bashExecution,
    forkMessages,
    sessionStats,
    lastAssistantText,

    openWorkspace: (path: string) => {
      send({ type: 'openWorkspace', path });
    },
    sendPrompt: (message: string, images?: ImageAttachment[]) => {
      if (workspaceId) {
        send({ type: 'prompt', workspaceId, message, images });
      }
    },
    steer: (message: string) => {
      if (workspaceId) {
        send({ type: 'steer', workspaceId, message });
      }
    },
    followUp: (message: string) => {
      if (workspaceId) {
        send({ type: 'followUp', workspaceId, message });
      }
    },
    abort: () => {
      if (workspaceId) {
        send({ type: 'abort', workspaceId });
      }
    },
    setModel: (provider: string, modelId: string) => {
      if (workspaceId) {
        send({ type: 'setModel', workspaceId, provider, modelId });
      }
    },
    setThinkingLevel: (level: ThinkingLevel) => {
      if (workspaceId) {
        send({ type: 'setThinkingLevel', workspaceId, level });
      }
    },
    newSession: () => {
      if (workspaceId) {
        send({ type: 'newSession', workspaceId });
      }
    },
    switchSession: (sessionId: string) => {
      if (workspaceId) {
        send({ type: 'switchSession', workspaceId, sessionId });
      }
    },
    compact: (customInstructions?: string) => {
      if (workspaceId) {
        send({ type: 'compact', workspaceId, customInstructions });
      }
    },
    refreshSessions: () => {
      if (workspaceId) {
        send({ type: 'getSessions', workspaceId });
      }
    },
    refreshModels: () => {
      if (workspaceId) {
        send({ type: 'getModels', workspaceId });
      }
    },

    // New session operations
    fork: (entryId: string) => {
      if (workspaceId) {
        send({ type: 'fork', workspaceId, entryId });
      }
    },
    getForkMessages: () => {
      if (workspaceId) {
        send({ type: 'getForkMessages', workspaceId });
      }
    },
    setSessionName: (name: string) => {
      if (workspaceId) {
        send({ type: 'setSessionName', workspaceId, name });
      }
    },
    exportHtml: (outputPath?: string) => {
      if (workspaceId) {
        send({ type: 'exportHtml', workspaceId, outputPath });
      }
    },

    // Model/Thinking cycling
    cycleModel: (direction?: 'forward' | 'backward') => {
      if (workspaceId) {
        send({ type: 'cycleModel', workspaceId, direction });
      }
    },
    cycleThinkingLevel: () => {
      if (workspaceId) {
        send({ type: 'cycleThinkingLevel', workspaceId });
      }
    },

    // Mode settings
    setSteeringMode: (mode: 'all' | 'one-at-a-time') => {
      if (workspaceId) {
        send({ type: 'setSteeringMode', workspaceId, mode });
      }
    },
    setFollowUpMode: (mode: 'all' | 'one-at-a-time') => {
      if (workspaceId) {
        send({ type: 'setFollowUpMode', workspaceId, mode });
      }
    },
    setAutoCompaction: (enabled: boolean) => {
      if (workspaceId) {
        send({ type: 'setAutoCompaction', workspaceId, enabled });
      }
    },
    setAutoRetry: (enabled: boolean) => {
      if (workspaceId) {
        send({ type: 'setAutoRetry', workspaceId, enabled });
      }
    },
    abortRetry: () => {
      if (workspaceId) {
        send({ type: 'abortRetry', workspaceId });
      }
    },

    // Bash execution
    executeBash: (command: string) => {
      if (workspaceId) {
        send({ type: 'bash', workspaceId, command });
      }
    },
    abortBash: () => {
      if (workspaceId) {
        send({ type: 'abortBash', workspaceId });
      }
    },

    // Stats
    getSessionStats: () => {
      if (workspaceId) {
        send({ type: 'getSessionStats', workspaceId });
      }
    },
    getLastAssistantText: () => {
      if (workspaceId) {
        send({ type: 'getLastAssistantText', workspaceId });
      }
    },
  };
}
