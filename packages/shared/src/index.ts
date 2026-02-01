/**
 * Shared types for Pi Web UI
 * Used by both server and client
 */

// ============================================================================
// Workspace Types (Multi-directory orchestration)
// ============================================================================

export interface DirectoryEntry {
  name: string;
  path: string;
  hasPiSessions: boolean;
}

export interface WorkspaceInfo {
  id: string;
  path: string;
  name: string;
  isActive: boolean;
  state: SessionState | null;
}

// ============================================================================
// WebSocket Messages (Client -> Server)
// ============================================================================

// Workspace management
export interface WsOpenWorkspaceMessage {
  type: 'openWorkspace';
  path: string;
}

export interface WsCloseWorkspaceMessage {
  type: 'closeWorkspace';
  workspaceId: string;
}

export interface WsListWorkspacesMessage {
  type: 'listWorkspaces';
}

export interface WsBrowseDirectoryMessage {
  type: 'browseDirectory';
  path?: string; // If not provided, returns allowed roots
}

// UI State persistence
export interface WsGetUIStateMessage {
  type: 'getUIState';
}

export interface WsSaveUIStateMessage {
  type: 'saveUIState';
  state: Partial<UIState>;
}

export interface WsSetThemeMessage {
  type: 'setTheme';
  themeId: string | null;
}

export interface WsSetSidebarWidthMessage {
  type: 'setSidebarWidth';
  width: number;
}

export interface WsSetDraftInputMessage {
  type: 'setDraftInput';
  workspacePath: string;
  value: string;
}

export interface WsSetActiveSessionMessage {
  type: 'setActiveSession';
  workspacePath: string;
  sessionId: string;
}

export interface WsSetActiveModelMessage {
  type: 'setActiveModel';
  workspacePath: string;
  provider: string;
  modelId: string;
}

export interface WsSetThinkingLevelPrefMessage {
  type: 'setThinkingLevelPref';
  workspacePath: string;
  level: ThinkingLevel;
}

// Base interface for workspace-scoped messages
interface WorkspaceScopedMessage {
  workspaceId: string;
}

export interface WsPromptMessage extends WorkspaceScopedMessage {
  type: 'prompt';
  message: string;
  images?: ImageAttachment[];
}

export interface WsSteerMessage extends WorkspaceScopedMessage {
  type: 'steer';
  message: string;
}

export interface WsFollowUpMessage extends WorkspaceScopedMessage {
  type: 'followUp';
  message: string;
}

export interface WsAbortMessage extends WorkspaceScopedMessage {
  type: 'abort';
}

export interface WsSetModelMessage extends WorkspaceScopedMessage {
  type: 'setModel';
  provider: string;
  modelId: string;
}

export interface WsSetThinkingLevelMessage extends WorkspaceScopedMessage {
  type: 'setThinkingLevel';
  level: ThinkingLevel;
}

export interface WsNewSessionMessage extends WorkspaceScopedMessage {
  type: 'newSession';
}

export interface WsSwitchSessionMessage extends WorkspaceScopedMessage {
  type: 'switchSession';
  sessionId: string;
}

export interface WsCompactMessage extends WorkspaceScopedMessage {
  type: 'compact';
  customInstructions?: string;
}

export interface WsGetStateMessage extends WorkspaceScopedMessage {
  type: 'getState';
}

export interface WsGetMessagesMessage extends WorkspaceScopedMessage {
  type: 'getMessages';
}

export interface WsGetSessionsMessage extends WorkspaceScopedMessage {
  type: 'getSessions';
}

export interface WsGetModelsMessage extends WorkspaceScopedMessage {
  type: 'getModels';
}

export interface WsGetCommandsMessage extends WorkspaceScopedMessage {
  type: 'getCommands';
}

// Session operations
export interface WsForkMessage extends WorkspaceScopedMessage {
  type: 'fork';
  entryId: string;
}

export interface WsGetForkMessagesMessage extends WorkspaceScopedMessage {
  type: 'getForkMessages';
}

export interface WsSetSessionNameMessage extends WorkspaceScopedMessage {
  type: 'setSessionName';
  name: string;
}

export interface WsExportHtmlMessage extends WorkspaceScopedMessage {
  type: 'exportHtml';
  outputPath?: string;
}

// Model/Thinking cycling
export interface WsCycleModelMessage extends WorkspaceScopedMessage {
  type: 'cycleModel';
  direction?: 'forward' | 'backward';
}

export interface WsCycleThinkingLevelMessage extends WorkspaceScopedMessage {
  type: 'cycleThinkingLevel';
}

// Mode settings
export interface WsSetSteeringModeMessage extends WorkspaceScopedMessage {
  type: 'setSteeringMode';
  mode: 'all' | 'one-at-a-time';
}

export interface WsSetFollowUpModeMessage extends WorkspaceScopedMessage {
  type: 'setFollowUpMode';
  mode: 'all' | 'one-at-a-time';
}

export interface WsSetAutoCompactionMessage extends WorkspaceScopedMessage {
  type: 'setAutoCompaction';
  enabled: boolean;
}

export interface WsSetAutoRetryMessage extends WorkspaceScopedMessage {
  type: 'setAutoRetry';
  enabled: boolean;
}

export interface WsAbortRetryMessage extends WorkspaceScopedMessage {
  type: 'abortRetry';
}

// Bash execution
export interface WsBashMessage extends WorkspaceScopedMessage {
  type: 'bash';
  command: string;
}

export interface WsAbortBashMessage extends WorkspaceScopedMessage {
  type: 'abortBash';
}

// Stats
export interface WsGetSessionStatsMessage extends WorkspaceScopedMessage {
  type: 'getSessionStats';
}

export interface WsGetLastAssistantTextMessage extends WorkspaceScopedMessage {
  type: 'getLastAssistantText';
}

// Server management
export interface WsDeployMessage {
  type: 'deploy';
}

// Questionnaire response (user answered questions)
export interface WsQuestionnaireResponseMessage extends WorkspaceScopedMessage {
  type: 'questionnaireResponse';
  toolCallId: string;
  answers: QuestionnaireAnswer[];
  cancelled: boolean;
}

export type WsClientMessage =
  // Workspace management (not scoped to a workspace)
  | WsOpenWorkspaceMessage
  | WsCloseWorkspaceMessage
  | WsListWorkspacesMessage
  | WsBrowseDirectoryMessage
  // UI State persistence
  | WsGetUIStateMessage
  | WsSaveUIStateMessage
  | WsSetThemeMessage
  | WsSetSidebarWidthMessage
  | WsSetDraftInputMessage
  | WsSetActiveSessionMessage
  | WsSetActiveModelMessage
  | WsSetThinkingLevelPrefMessage
  // Workspace-scoped operations
  | WsPromptMessage
  | WsSteerMessage
  | WsFollowUpMessage
  | WsAbortMessage
  | WsSetModelMessage
  | WsSetThinkingLevelMessage
  | WsNewSessionMessage
  | WsSwitchSessionMessage
  | WsCompactMessage
  | WsGetStateMessage
  | WsGetMessagesMessage
  | WsGetSessionsMessage
  | WsGetModelsMessage
  | WsGetCommandsMessage
  // Session operations
  | WsForkMessage
  | WsGetForkMessagesMessage
  | WsSetSessionNameMessage
  | WsExportHtmlMessage
  // Model/Thinking cycling
  | WsCycleModelMessage
  | WsCycleThinkingLevelMessage
  // Mode settings
  | WsSetSteeringModeMessage
  | WsSetFollowUpModeMessage
  | WsSetAutoCompactionMessage
  | WsSetAutoRetryMessage
  | WsAbortRetryMessage
  // Bash execution
  | WsBashMessage
  | WsAbortBashMessage
  // Stats
  | WsGetSessionStatsMessage
  | WsGetLastAssistantTextMessage
  // Server management
  | WsDeployMessage
  // Questionnaire
  | WsQuestionnaireResponseMessage;

// ============================================================================
// WebSocket Messages (Server -> Client)
// ============================================================================

// Workspace management events
export interface WsWorkspaceOpenedEvent {
  type: 'workspaceOpened';
  workspace: WorkspaceInfo;
  state: SessionState;
  messages: ChatMessage[];
}

export interface WsWorkspaceClosedEvent {
  type: 'workspaceClosed';
  workspaceId: string;
}

export interface WsWorkspacesListEvent {
  type: 'workspacesList';
  workspaces: WorkspaceInfo[];
}

export interface WsDirectoryListEvent {
  type: 'directoryList';
  path: string;
  entries: DirectoryEntry[];
  allowedRoots?: string[];
}

export interface WsConnectedEvent {
  type: 'connected';
  workspaces: WorkspaceInfo[];
  allowedRoots: string[];
  uiState: UIState;
}

// UI State types
export interface UIState {
  openWorkspaces: string[];
  activeWorkspacePath: string | null;
  draftInputs: Record<string, string>;
  sidebarWidth: number;
  themeId: string | null;
  /** Maps workspace path to active session ID */
  activeSessions: Record<string, string>;
  /** Maps workspace path to selected model */
  activeModels: Record<string, { provider: string; modelId: string }>;
  /** Maps workspace path to thinking level */
  thinkingLevels: Record<string, ThinkingLevel>;
}

export interface WsUIStateEvent {
  type: 'uiState';
  state: UIState;
}

// ============================================================================
// Internal Session Events (emitted by PiSession, no workspaceId yet)
// ============================================================================

export interface SessionAgentStartEvent {
  type: 'agentStart';
}

export interface SessionAgentEndEvent {
  type: 'agentEnd';
}

export interface SessionMessageStartEvent {
  type: 'messageStart';
  message: ChatMessage;
}

export interface SessionMessageUpdateEvent {
  type: 'messageUpdate';
  messageId: string;
  update: MessageUpdate;
}

export interface SessionMessageEndEvent {
  type: 'messageEnd';
  message: ChatMessage;
}

export interface SessionToolStartEvent {
  type: 'toolStart';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface SessionToolUpdateEvent {
  type: 'toolUpdate';
  toolCallId: string;
  partialResult: string;
}

export interface SessionToolEndEvent {
  type: 'toolEnd';
  toolCallId: string;
  result: string;
  isError: boolean;
}

export interface SessionCompactionStartEvent {
  type: 'compactionStart';
}

export interface SessionCompactionEndEvent {
  type: 'compactionEnd';
  summary: string;
}

export type SessionEvent =
  | SessionAgentStartEvent
  | SessionAgentEndEvent
  | SessionMessageStartEvent
  | SessionMessageUpdateEvent
  | SessionMessageEndEvent
  | SessionToolStartEvent
  | SessionToolUpdateEvent
  | SessionToolEndEvent
  | SessionCompactionStartEvent
  | SessionCompactionEndEvent;

// ============================================================================
// Workspace-Scoped Server Events (sent over WebSocket with workspaceId)
// ============================================================================

export interface WsStateEvent {
  type: 'state';
  workspaceId: string;
  state: SessionState;
}

export interface WsMessagesEvent {
  type: 'messages';
  workspaceId: string;
  messages: ChatMessage[];
}

export interface WsSessionsEvent {
  type: 'sessions';
  workspaceId: string;
  sessions: SessionInfo[];
}

export interface WsModelsEvent {
  type: 'models';
  workspaceId: string;
  models: ModelInfo[];
}

export interface WsCommandsEvent {
  type: 'commands';
  workspaceId: string;
  commands: SlashCommand[];
}

export interface WsAgentStartEvent {
  type: 'agentStart';
  workspaceId: string;
}

export interface WsAgentEndEvent {
  type: 'agentEnd';
  workspaceId: string;
}

export interface WsMessageStartEvent {
  type: 'messageStart';
  workspaceId: string;
  message: ChatMessage;
}

export interface WsMessageUpdateEvent {
  type: 'messageUpdate';
  workspaceId: string;
  messageId: string;
  update: MessageUpdate;
}

export interface WsMessageEndEvent {
  type: 'messageEnd';
  workspaceId: string;
  message: ChatMessage;
}

export interface WsToolStartEvent {
  type: 'toolStart';
  workspaceId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface WsToolUpdateEvent {
  type: 'toolUpdate';
  workspaceId: string;
  toolCallId: string;
  partialResult: string;
}

export interface WsToolEndEvent {
  type: 'toolEnd';
  workspaceId: string;
  toolCallId: string;
  result: string;
  isError: boolean;
}

export interface WsCompactionStartEvent {
  type: 'compactionStart';
  workspaceId: string;
}

export interface WsCompactionEndEvent {
  type: 'compactionEnd';
  workspaceId: string;
  summary: string;
}

export interface WsErrorEvent {
  type: 'error';
  message: string;
  code?: string;
  workspaceId?: string; // Optional - errors can be global or workspace-scoped
}

export interface WsDeployStatusEvent {
  type: 'deployStatus';
  status: 'building' | 'restarting' | 'error';
  message?: string;
}

// Fork response
export interface WsForkResultEvent {
  type: 'forkResult';
  workspaceId: string;
  success: boolean;
  text?: string;
  error?: string;
}

// Fork messages response
export interface WsForkMessagesEvent {
  type: 'forkMessages';
  workspaceId: string;
  messages: Array<{ entryId: string; text: string }>;
}

// Export HTML response
export interface WsExportHtmlResultEvent {
  type: 'exportHtmlResult';
  workspaceId: string;
  success: boolean;
  path?: string;
  error?: string;
}

// Session stats response
export interface WsSessionStatsEvent {
  type: 'sessionStats';
  workspaceId: string;
  stats: SessionStats;
}

// Last assistant text response
export interface WsLastAssistantTextEvent {
  type: 'lastAssistantText';
  workspaceId: string;
  text: string | null;
}

// Bash execution events
export interface WsBashStartEvent {
  type: 'bashStart';
  workspaceId: string;
  command: string;
}

export interface WsBashOutputEvent {
  type: 'bashOutput';
  workspaceId: string;
  chunk: string;
}

export interface WsBashEndEvent {
  type: 'bashEnd';
  workspaceId: string;
  result: BashResult;
}

// Questionnaire request (tool needs user input)
export interface WsQuestionnaireRequestEvent {
  type: 'questionnaireRequest';
  workspaceId: string;
  toolCallId: string;
  questions: QuestionnaireQuestion[];
}

export type WsServerEvent =
  // Connection & workspace management
  | WsConnectedEvent
  | WsWorkspaceOpenedEvent
  | WsWorkspaceClosedEvent
  | WsWorkspacesListEvent
  | WsDirectoryListEvent
  // UI State
  | WsUIStateEvent
  // Workspace-scoped events
  | WsStateEvent
  | WsMessagesEvent
  | WsSessionsEvent
  | WsModelsEvent
  | WsCommandsEvent
  | WsAgentStartEvent
  | WsAgentEndEvent
  | WsMessageStartEvent
  | WsMessageUpdateEvent
  | WsMessageEndEvent
  | WsToolStartEvent
  | WsToolUpdateEvent
  | WsToolEndEvent
  | WsCompactionStartEvent
  | WsCompactionEndEvent
  | WsErrorEvent
  | WsDeployStatusEvent
  // New events
  | WsForkResultEvent
  | WsForkMessagesEvent
  | WsExportHtmlResultEvent
  | WsSessionStatsEvent
  | WsLastAssistantTextEvent
  | WsBashStartEvent
  | WsBashOutputEvent
  | WsBashEndEvent
  // Questionnaire
  | WsQuestionnaireRequestEvent;

// ============================================================================
// Data Types
// ============================================================================

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface GitInfo {
  branch: string | null;
  changedFiles: number;
}

export interface SessionState {
  sessionId: string;
  sessionName?: string;
  sessionFile?: string;
  model: ModelInfo | null;
  thinkingLevel: ThinkingLevel;
  isStreaming: boolean;
  isCompacting: boolean;
  autoCompactionEnabled: boolean;
  autoRetryEnabled: boolean;
  steeringMode: 'all' | 'one-at-a-time';
  followUpMode: 'all' | 'one-at-a-time';
  messageCount: number;
  tokens: TokenUsage;
  contextWindowPercent: number; // 0-100
  git: GitInfo;
}

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  reasoning: boolean;
  contextWindow: number;
}

export interface SessionInfo {
  id: string;
  path: string;
  name?: string;
  firstMessage?: string;
  messageCount: number;
  updatedAt: number;
  cwd: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'toolResult';
  timestamp: number;
  content: MessageContent[];
  // For assistant messages
  model?: string;
  provider?: string;
  usage?: TokenUsage;
  // For tool results
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
}

export type MessageContent =
  | TextContent
  | ThinkingContent
  | ToolCallContent
  | ImageContent;

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}

export interface ToolCallContent {
  type: 'toolCall';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'running' | 'complete' | 'error';
  result?: string;
}

export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    mediaType: string;
    data: string;
  };
}

export interface ImageAttachment {
  type: 'image';
  source: {
    type: 'base64';
    mediaType: string;
    data: string;
  };
}

export interface MessageUpdate {
  type: 'textDelta' | 'thinkingDelta' | 'toolCallUpdate';
  // For text/thinking deltas
  delta?: string;
  contentIndex?: number;
  // For tool call updates
  toolCallId?: string;
  status?: 'pending' | 'running' | 'complete' | 'error';
  result?: string;
}

// ============================================================================
// Session Stats
// ============================================================================

export interface SessionStats {
  sessionFile: string | undefined;
  sessionId: string;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  totalMessages: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost: number;
}

// ============================================================================
// Bash Execution
// ============================================================================

export interface BashResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  truncated: boolean;
}

// ============================================================================
// Slash Commands
// ============================================================================

export interface SlashCommand {
  /** Command name (without leading slash) */
  name: string;
  /** Human-readable description */
  description?: string;
  /** What kind of command this is */
  source: 'extension' | 'template' | 'skill';
  /** File path to the command source (if available) */
  path?: string;
}

// ============================================================================
// Questionnaire Types
// ============================================================================

export interface QuestionnaireOption {
  /** The value returned when selected */
  value: string;
  /** Display label for the option */
  label: string;
  /** Optional description shown below label */
  description?: string;
}

export interface QuestionnaireQuestion {
  /** Unique identifier for this question */
  id: string;
  /** Short contextual label for tab bar (defaults to Q1, Q2) */
  label?: string;
  /** The full question text to display */
  prompt: string;
  /** Available options to choose from */
  options: QuestionnaireOption[];
  /** Allow 'Type something' option (default: true) */
  allowOther?: boolean;
}

export interface QuestionnaireAnswer {
  /** Question ID */
  id: string;
  /** Selected or typed value */
  value: string;
  /** Display label for the answer */
  label: string;
  /** Whether the answer was a custom text input */
  wasCustom: boolean;
  /** 1-based index of selected option (if not custom) */
  index?: number;
}

export interface QuestionnaireRequest {
  /** Tool call ID that requested the questionnaire */
  toolCallId: string;
  /** Questions to present to the user */
  questions: QuestionnaireQuestion[];
}

export interface QuestionnaireResponse {
  /** Tool call ID this response is for */
  toolCallId: string;
  /** User's answers */
  answers: QuestionnaireAnswer[];
  /** Whether the user cancelled */
  cancelled: boolean;
}
