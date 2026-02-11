import { useState, useRef, useEffect, useCallback, useMemo, useDeferredValue, memo } from 'react';
import type { SessionInfo, ImageAttachment, SlashCommand as BackendSlashCommand, ModelInfo, ThinkingLevel, ScopedModelInfo, ExtensionUIResponse, CustomUIInputEvent, SessionTreeNode } from '@pi-deck/shared';
import type { SessionSlotState } from '../hooks/useWorkspaces';
import { useSettings } from '../contexts/SettingsContext';
import { matchesHotkey } from '../hotkeys';
import { Star } from 'lucide-react';
import { MessageList } from './MessageList';
import { SlashCommand } from './SlashMenu';
import { ForkDialog } from './ForkDialog';
import { TreeMenu, flattenTree } from './TreeDialog';
import { QuestionnaireUI } from './QuestionnaireUI';
import { ExtensionUIDialog } from './ExtensionUIDialog';
import { CustomUIDialog } from './CustomUIDialog';

import { ChevronDown, Send, Square, ImagePlus } from 'lucide-react';
import { ActivePlanBanner } from './ActivePlanBanner';

interface SessionViewProps {
  slot: SessionSlotState | null;
  slotId: string;
  sessions: SessionInfo[];
  models: ModelInfo[];
  backendCommands: BackendSlashCommand[];
  onSendPrompt: (message: string, images?: ImageAttachment[]) => void;
  onSteer: (message: string, images?: ImageAttachment[]) => void;
  onAbort: () => void;
  onLoadSession: (sessionId: string) => void;
  onNewSession: () => void;
  onGetForkMessages: () => void;
  onFork: (entryId: string) => void;
  onSetModel: (provider: string, modelId: string) => void;
  onSetThinkingLevel: (level: ThinkingLevel) => void;
  onQuestionnaireResponse: (questionId: string, response: string) => void;
  onExtensionUIResponse: (response: ExtensionUIResponse) => void;
  onCustomUIInput: (input: CustomUIInputEvent) => void;
  onCompact: () => void;
  onOpenSettings: () => void;
  onExport: () => void;
  onRenameSession: (name: string) => void;
  onShowHotkeys: () => void;
  onFollowUp: (message: string) => void;
  onReload: () => void;
  onGetSessionTree: () => void;
  onNavigateTree: (targetId: string) => void;
  onCopyLastAssistant: () => void;
  onGetQueuedMessages: () => void;
  
  onListFiles: (query?: string, requestId?: string) => void;
  onExecuteBash: (command: string, excludeFromContext?: boolean) => void;
  onToggleAllToolsCollapsed: () => void;
  onToggleAllThinkingCollapsed: () => void;
  activePlan: import('@pi-deck/shared').ActivePlanState | null;
  onUpdatePlanTask: (planPath: string, line: number, done: boolean) => void;
  onDeactivatePlan: () => void;
}

// Built-in slash commands
const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: '/stop', desc: 'Stop the agent', action: 'stop' },
  { cmd: '/compact', desc: 'Compact conversation history', action: 'compact' },
  { cmd: '/model', desc: 'Select a model', action: 'model' },
  { cmd: '/settings', desc: 'Open settings', action: 'settings' },
  { cmd: '/export', desc: 'Export session to HTML', action: 'export' },
  { cmd: '/name', desc: 'Rename session', action: 'name' },
  { cmd: '/hotkeys', desc: 'Show keyboard shortcuts', action: 'hotkeys' },
  { cmd: '/reload', desc: 'Rebuild and restart the application', action: 'reload' },
  { cmd: '/tree', desc: 'Navigate session tree', action: 'tree' },
  { cmd: '/copy', desc: 'Copy last assistant response', action: 'copy' },
  { cmd: '/scoped-models', desc: 'Configure models for Ctrl+P cycling', action: 'scoped-models' },
  { cmd: '/jobs', desc: 'Open the jobs panel', action: 'jobs' },
  { cmd: '/jobs new', desc: 'Create a new job', action: 'jobs-new' },
];

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-pi-success',
  paused: 'bg-pi-warning',
  done: 'bg-pi-muted',
  idle: 'bg-pi-idle',
  error: 'bg-pi-error',
};

const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];

// Convert file to base64 image attachment
async function fileToImageAttachment(file: File): Promise<ImageAttachment | null> {
  if (!file.type.startsWith('image/')) return null;
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve({
        type: 'image',
        source: {
          type: 'base64',
          mediaType: file.type,
          data: base64,
        },
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export const SessionView = memo(function SessionView({
  slot,
  slotId,
  sessions,
  models,
  backendCommands,
  onSendPrompt,
  onSteer,
  onAbort,
  onLoadSession,
  onNewSession,
  onGetForkMessages,
  onFork,
  onSetModel,
  onSetThinkingLevel,
  onQuestionnaireResponse,
  onExtensionUIResponse,
  onCustomUIInput,
  onCompact,
  onOpenSettings,
  onExport,
  onRenameSession,
  onShowHotkeys,
  onFollowUp,
  onReload,
  onGetSessionTree,
  onNavigateTree,
  onCopyLastAssistant,
  onGetQueuedMessages,
  
  onListFiles,
  onExecuteBash,
  onToggleAllToolsCollapsed,
  onToggleAllThinkingCollapsed,
  activePlan,
  onUpdatePlanTask,
  onDeactivatePlan,
}: SessionViewProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(0);
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Draft input persistence (per slot - localStorage based)
  const draftKey = `pi-draft-${slotId}`;
  const [draftLoaded, setDraftLoaded] = useState(false);
  const prevDraftKeyRef = useRef<string | null>(null);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [modelFilter, setModelFilter] = useState('');
  const [modelHighlight, setModelHighlight] = useState(0);
  const modelFilterRef = useRef<HTMLInputElement>(null);
  const [showThinkingMenu, setShowThinkingMenu] = useState(false);
  const [streamingInputMode, setStreamingInputMode] = useState<'steer' | 'followUp'>('steer');
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [_fileFilter, setFileFilter] = useState('');
  const [fileList, setFileList] = useState<Array<{ path: string; name: string }>>([]);
  const [pendingFollowUps, setPendingFollowUps] = useState<string[]>([]);
  const [scopedModels, setScopedModels] = useState<ScopedModelInfo[]>([]);
  const [showForkMenu, setShowForkMenu] = useState(false);
  const [forkMessages, setForkMessages] = useState<Array<{ entryId: string; text: string }>>([]);
  const [forkSelectedIdx, setForkSelectedIdx] = useState(0);
  const [showTreeMenu, setShowTreeMenu] = useState(false);
  const [treeData, setTreeData] = useState<SessionTreeNode[]>([]);
  const [treeCurrentLeafId, setTreeCurrentLeafId] = useState<string | null>(null);
  const [treeSelectedIdx, setTreeSelectedIdx] = useState(0);
  const [altHeld, setAltHeld] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileListRequestIdRef = useRef<string | null>(null);
  const userScrolledUpRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const lastEscapeTimeRef = useRef(0);
  const { settings, openSettings } = useSettings();
  const hk = settings.hotkeyOverrides;

  // Get slot data
  const messages = slot?.messages || [];
  const isStreaming = slot?.isStreaming || false;
  const streamingText = slot?.streamingText || '';
  const streamingThinking = slot?.streamingThinking || '';
  const deferredStreamingText = useDeferredValue(streamingText);
  const deferredStreamingThinking = useDeferredValue(streamingThinking);
  const state = slot?.state;
  const activeToolExecutions = slot?.activeToolExecutions || [];
  const questionnaireRequest = slot?.questionnaireRequest ?? state?.questionnaireRequest;
  const extensionUIRequest = slot?.extensionUIRequest ?? null;
  const customUIState = slot?.customUIState ?? null;
  const activeExtensionRequest = extensionUIRequest?.method === 'notify' ? null : extensionUIRequest;
  const hasInlineDialog = Boolean(questionnaireRequest || activeExtensionRequest || customUIState);
  const bashExecution = slot?.bashExecution ?? null;
  const queuedSteering = slot?.queuedMessages?.steering || [];
  const queuedFollowUp = slot?.queuedMessages?.followUp || [];
  
  const [optimisticQueueClear, setOptimisticQueueClear] = useState(false);
  

  const sessionId = state?.sessionId;
  const prevSessionIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevSessionIdRef.current !== undefined && prevSessionIdRef.current !== sessionId) {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = 0;
      }
      userScrolledUpRef.current = false;
    }
    prevSessionIdRef.current = sessionId;
  }, [sessionId]);
  
  useEffect(() => {
    if (optimisticQueueClear && (queuedSteering.length > 0 || queuedFollowUp.length > 0)) {
      setOptimisticQueueClear(false);
    }
  }, [queuedSteering.length, queuedFollowUp.length]);

  useEffect(() => {
    if (prevDraftKeyRef.current !== null && prevDraftKeyRef.current !== draftKey) {
      setDraftLoaded(false);
    }
    
    if (draftLoaded) return;
    
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.text && !inputValue) {
          setInputValue(draft.text);
        }
        if (draft.images && draft.images.length > 0 && attachedImages.length === 0) {
          setAttachedImages(draft.images);
          const previews = draft.images.map((img: ImageAttachment) => {
            if (img.source.type === 'base64') {
              return `data:${img.source.mediaType};base64,${img.source.data}`;
            }
            return '';
          });
          setImagePreviews(previews);
        }
      }
    } catch (e) {
      console.warn('[SessionView] Failed to load draft:', e);
    }
    prevDraftKeyRef.current = draftKey;
    setDraftLoaded(true);
  }, [draftKey, draftLoaded]);

  const currentModel = state?.model;
  const currentThinking = state?.thinkingLevel || 'off';
  const contextPercent = state?.contextWindowPercent ?? 0;
  const sessionStatus = isStreaming ? 'running' : (state?.sessionId ? 'idle' : 'idle');

  const sessionTitle = state?.sessionName
    || messages.find(m => m.role === 'user')?.content
      .find(c => c.type === 'text')?.text?.slice(0, 50)
    || 'New conversation';

  const allCommands = useMemo(() => {
    const cmds: SlashCommand[] = [...SLASH_COMMANDS];
    
    for (const bc of backendCommands) {
      cmds.push({
        cmd: `/${bc.name}`,
        desc: bc.description || bc.source,
        action: `backend:${bc.name}`,
      });
    }
    
    if (sessions.length > 0) {
      cmds.push({
        cmd: '/resume',
        desc: 'Resume a previous session',
        action: 'resume',
      });
    }
    
    cmds.push(
      { cmd: '/new', desc: 'Start a new session', action: 'new' },
      { cmd: '/fork', desc: 'Fork from a previous message', action: 'fork' }
    );
    
    return cmds;
  }, [backendCommands, sessions.length]);

  const filteredCommands = useMemo(() => {
    if (!slashFilter || slashFilter === '/') return allCommands;
    
    const query = slashFilter.startsWith('/') ? slashFilter.slice(1).toLowerCase() : slashFilter.toLowerCase();
    if (!query) return allCommands;
    
    const prefixMatches: SlashCommand[] = [];
    const substringMatches: SlashCommand[] = [];
    
    for (const c of allCommands) {
      const cmdName = (c.cmd.startsWith('/') ? c.cmd.slice(1) : c.cmd).toLowerCase();
      
      if (cmdName.startsWith(query)) {
        prefixMatches.push(c);
      } else if (cmdName.includes(query)) {
        substringMatches.push(c);
      }
    }
    
    return [...prefixMatches, ...substringMatches];
  }, [allCommands, slashFilter]);

  const [showResumeMenu, setShowResumeMenu] = useState(false);
  const [resumeFilter, setResumeFilter] = useState('');
  const filteredSessions = useMemo(() => {
    if (!resumeFilter) return sessions;
    const lower = resumeFilter.toLowerCase();
    return sessions.filter(s => 
      s.name?.toLowerCase().includes(lower) ||
      s.firstMessage?.toLowerCase().includes(lower) ||
      s.id.toLowerCase().includes(lower)
    );
  }, [sessions, resumeFilter]);

  const handleMessagesScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    userScrolledUpRef.current = !isAtBottom;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    isProgrammaticScrollRef.current = true;
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, smooth ? 300 : 100);
    });
  }, []);

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  const toolResultsFingerprint = useMemo(() => {
    return activeToolExecutions.map(t => `${t.toolCallId}:${t.status}:${(t.result?.length || 0)}`).join('|');
  }, [activeToolExecutions]);

  const lastMessageFingerprint = useMemo(() => {
    if (messages.length === 0) return '';
    const lastMsg = messages[messages.length - 1];
    return `${lastMsg.id}:${JSON.stringify(lastMsg.content).length}`;
  }, [messages]);

  useEffect(() => {
    if (!isStreaming) return;
    
    if (userScrolledUpRef.current) {
      const container = messagesContainerRef.current;
      if (container) {
        const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distFromBottom < 300) {
          userScrolledUpRef.current = false;
        }
      }
    }
    
    if (!userScrolledUpRef.current) {
      scrollToBottom(false);
    }
  }, [isStreaming, deferredStreamingText, deferredStreamingThinking, toolResultsFingerprint, lastMessageFingerprint, scrollToBottom]);

  useEffect(() => {
    if (bashExecution && !userScrolledUpRef.current) {
      scrollToBottom(false);
    }
  }, [bashExecution?.output, bashExecution?.isRunning, scrollToBottom]);

  useEffect(() => {
    if (bashExecution?.isRunning) {
      const container = messagesContainerRef.current;
      if (container) {
        const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distFromBottom < 300) {
          userScrolledUpRef.current = false;
          scrollToBottom(false);
        }
      }
    }
  }, [bashExecution?.command, scrollToBottom]);

  const prevIsStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevIsStreamingRef.current && !isStreaming && pendingFollowUps.length > 0) {
      pendingFollowUps.forEach((msg, i) => {
        setTimeout(() => {
          onSendPrompt(msg);
        }, i * 100);
      });
      setPendingFollowUps([]);
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming, pendingFollowUps, onSendPrompt]);

  useEffect(() => {
    if (!hasInlineDialog) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [hasInlineDialog]);

  useEffect(() => {
    if (inputValue === '' && inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [inputValue]);

  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!draftLoaded) return;
    
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        const draft = {
          text: inputValue,
          images: attachedImages,
          timestamp: Date.now(),
        };
        if (inputValue.trim() || attachedImages.length > 0) {
          localStorage.setItem(draftKey, JSON.stringify(draft));
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch (e) {
        console.warn('[SessionView] Failed to save draft:', e);
      }
    }, 500);
    
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [draftKey, inputValue, attachedImages, draftLoaded]);

  useEffect(() => {
    const handleFileList = (e: CustomEvent<{ files: Array<{ path: string; name: string }>; requestId?: string }>) => {
      if (fileListRequestIdRef.current && e.detail.requestId !== fileListRequestIdRef.current) {
        return;
      }
      setFileList(e.detail.files);
    };
    window.addEventListener('pi:fileList', handleFileList as EventListener);
    return () => window.removeEventListener('pi:fileList', handleFileList as EventListener);
  }, []);

  useEffect(() => {
    const handleForkMessages = (e: CustomEvent<{ sessionSlotId?: string; messages: Array<{ entryId: string; text: string }> }>) => {
      if (e.detail.sessionSlotId === slotId) {
        setForkMessages(e.detail.messages);
        setForkSelectedIdx(e.detail.messages.length - 1);
        setShowForkMenu(true);
        setShowTreeMenu(false);
      }
    };
    window.addEventListener('pi:forkMessages', handleForkMessages as EventListener);
    return () => window.removeEventListener('pi:forkMessages', handleForkMessages as EventListener);
  }, [slotId]);

  useEffect(() => {
    const handleSessionTree = (e: CustomEvent<{ sessionSlotId?: string; tree: SessionTreeNode[]; currentLeafId: string | null }>) => {
      if (e.detail.sessionSlotId === slotId) {
        setTreeData(e.detail.tree);
        setTreeCurrentLeafId(e.detail.currentLeafId);
        const items = flattenTree(e.detail.tree, e.detail.currentLeafId);
        const currentIdx = items.findIndex(i => i.isCurrent);
        setTreeSelectedIdx(currentIdx >= 0 ? currentIdx : items.length - 1);
        setShowTreeMenu(true);
        setShowForkMenu(false);
      }
    };
    window.addEventListener('pi:sessionTree', handleSessionTree as EventListener);
    return () => window.removeEventListener('pi:sessionTree', handleSessionTree as EventListener);
  }, [slotId]);

  useEffect(() => {
    const handleCopyResult = (e: CustomEvent<{ sessionSlotId: string; success: boolean; text?: string; error?: string }>) => {
      if (e.detail.sessionSlotId !== slotId) return;
      
      if (e.detail.success && e.detail.text) {
        navigator.clipboard.writeText(e.detail.text).catch(() => {});
      } else if (e.detail.error) {
        console.error('Copy failed:', e.detail.error);
      }
    };
    window.addEventListener('pi:copyResult', handleCopyResult as EventListener);
    return () => window.removeEventListener('pi:copyResult', handleCopyResult as EventListener);
  }, [slotId]);

  useEffect(() => {
    const handleScopedModels = (e: CustomEvent<{ sessionSlotId: string; models: ScopedModelInfo[] }>) => {
      if (e.detail.sessionSlotId !== slotId) return;
      setScopedModels(e.detail.models);
    };
    window.addEventListener('pi:scopedModels', handleScopedModels as EventListener);
    return () => window.removeEventListener('pi:scopedModels', handleScopedModels as EventListener);
  }, [slotId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && isStreaming) {
        setAltHeld(true);
        setStreamingInputMode('followUp');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltHeld(false);
        setStreamingInputMode('steer');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isStreaming]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    for (const file of imageFiles) {
      const attachment = await fileToImageAttachment(file);
      if (attachment) {
        setAttachedImages(prev => [...prev, attachment]);
        const previewUrl = URL.createObjectURL(file);
        setImagePreviews(prev => [...prev, previewUrl]);
      }
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    
    if (imageItems.length === 0) return;
    
    e.preventDefault();
    
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (file) {
        const attachment = await fileToImageAttachment(file);
        if (attachment) {
          setAttachedImages(prev => [...prev, attachment]);
          const previewUrl = URL.createObjectURL(file);
          setImagePreviews(prev => [...prev, previewUrl]);
        }
      }
    }
  }, []);

  const removeImage = useCallback((index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    for (const file of imageFiles) {
      const attachment = await fileToImageAttachment(file);
      if (attachment) {
        setAttachedImages(prev => [...prev, attachment]);
        const previewUrl = URL.createObjectURL(file);
        setImagePreviews(prev => [...prev, previewUrl]);
      }
    }
    e.target.value = '';
  }, []);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() && attachedImages.length === 0) return;

    const trimmedMessage = inputValue.trim();
    if (trimmedMessage.startsWith('!!')) {
      const command = trimmedMessage.slice(2).trim();
      if (command) {
        onExecuteBash(command, true);
      }
      setInputValue('');
      return;
    }

    if (trimmedMessage.startsWith('!') && !trimmedMessage.startsWith('!!')) {
      const command = trimmedMessage.slice(1).trim();
      if (command) {
        onExecuteBash(command, false);
      }
      setInputValue('');
      return;
    }
    
    userScrolledUpRef.current = false;
    
    const effectiveMode = altHeld ? 'followUp' : streamingInputMode;
    
    if (isStreaming) {
      if (effectiveMode === 'steer') {
        onSteer(trimmedMessage, attachedImages.length > 0 ? attachedImages : undefined);
      } else {
        setPendingFollowUps(prev => [...prev, trimmedMessage]);
      }
    } else {
      onSendPrompt(trimmedMessage, attachedImages.length > 0 ? attachedImages : undefined);
    }
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    setAttachedImages([]);
    setImagePreviews([]);
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [inputValue, attachedImages, imagePreviews, isStreaming, streamingInputMode, altHeld, onSteer, onSendPrompt, onExecuteBash]);

  const fileListTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestFileList = useCallback((query?: string) => {
    if (fileListTimerRef.current) clearTimeout(fileListTimerRef.current);
    fileListTimerRef.current = setTimeout(() => {
      const requestId = `session-${slotId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      fileListRequestIdRef.current = requestId;
      onListFiles(query, requestId);
    }, 150);
  }, [onListFiles, slotId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (val.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashFilter(val);
      setSelectedCmdIdx(0);
      setShowResumeMenu(false);
      setShowFileMenu(false);
    } else if (val.includes('@')) {
      const lastAtIndex = val.lastIndexOf('@');
      const charBefore = lastAtIndex > 0 ? val[lastAtIndex - 1] : ' ';
      if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
        setShowSlashMenu(false);
        setShowResumeMenu(false);
        setShowFileMenu(true);
        setFileFilter(val.slice(lastAtIndex + 1));
        setSelectedCmdIdx(0);
        requestFileList(val.slice(lastAtIndex + 1));
      }
    } else {
      setShowSlashMenu(false);
      setShowResumeMenu(false);
      setShowFileMenu(false);
    }
  };

  const executeCommand = (action: string) => {
    switch (action) {
      case 'new':
        onNewSession();
        break;
      case 'stop':
        onAbort();
        break;
      case 'fork':
        onGetForkMessages();
        break;
      case 'compact':
        onCompact();
        break;
      case 'model':
        setShowSlashMenu(false);
        setShowModelMenu(true);
        setModelFilter('');
        setModelHighlight(0);
        setTimeout(() => modelFilterRef.current?.focus(), 0);
        setShowThinkingMenu(false);
        setInputValue('');
        return;
      case 'settings':
        onOpenSettings();
        break;
      case 'export':
        onExport();
        break;
      case 'name':
        const newName = window.prompt('Enter session name:');
        if (newName) {
          onRenameSession(newName);
        }
        break;
      case 'hotkeys':
        onShowHotkeys();
        break;
      case 'reload':
        onReload();
        break;
      case 'resume':
        setShowSlashMenu(false);
        setShowResumeMenu(true);
        setResumeFilter('');
        setSelectedCmdIdx(0);
        setInputValue('');
        return;
      case 'tree':
        onGetSessionTree();
        break;
      case 'copy':
        onCopyLastAssistant();
        break;
      case 'scoped-models':
        openSettings('models');
        break;
      case 'jobs':
        window.dispatchEvent(new CustomEvent('pi:openJobs', { detail: { mode: 'list' } }));
        break;
      case 'jobs-new':
        window.dispatchEvent(new CustomEvent('pi:openJobs', { detail: { mode: 'create' } }));
        break;
      default:
        if (action.startsWith('backend:')) {
          const cmdName = action.slice(8);
          onSendPrompt(`/${cmdName}`);
        }
        break;
    }
    setShowSlashMenu(false);
    setShowResumeMenu(false);
    setInputValue('');
  };

  const selectSession = (sessionId: string) => {
    onLoadSession(sessionId);
    setShowResumeMenu(false);
    setInputValue('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const key = e.key;
    
    if (showResumeMenu && filteredSessions.length > 0) {
      if (key === 'ArrowDown' || key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCmdIdx(i => (i + 1) % filteredSessions.length);
        return;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCmdIdx(i => (i - 1 + filteredSessions.length) % filteredSessions.length);
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        selectSession(filteredSessions[selectedCmdIdx].path);
        return;
      }
      if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowResumeMenu(false);
        setInputValue('');
        return;
      }
    }

    if (showForkMenu && forkMessages.length > 0) {
      if (key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setForkSelectedIdx(i => Math.min(forkMessages.length - 1, i + 1));
        return;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setForkSelectedIdx(i => Math.max(0, i - 1));
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onFork(forkMessages[forkSelectedIdx].entryId);
        setShowForkMenu(false);
        setForkMessages([]);
        return;
      }
      if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowForkMenu(false);
        setForkMessages([]);
        return;
      }
    }

    if (showTreeMenu) {
      const treeItems = flattenTree(treeData, treeCurrentLeafId);
      if (key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setTreeSelectedIdx(i => Math.min(treeItems.length - 1, i + 1));
        return;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setTreeSelectedIdx(i => Math.max(0, i - 1));
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (treeItems[treeSelectedIdx]) {
          onNavigateTree(treeItems[treeSelectedIdx].id);
        }
        setShowTreeMenu(false);
        return;
      }
      if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowTreeMenu(false);
        return;
      }
    }

    if (showSlashMenu && filteredCommands.length > 0) {
      if (key === 'ArrowDown' || key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCmdIdx(i => (i + 1) % filteredCommands.length);
        return;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCmdIdx(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        executeCommand(filteredCommands[selectedCmdIdx].action);
        return;
      }
      if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowSlashMenu(false);
        setInputValue('');
        return;
      }
    }

    if (key === 'Escape') {
      e.preventDefault();

      if (isStreaming) {
        onAbort();
        onGetQueuedMessages();
        return;
      }

      if (bashExecution?.isRunning) {
        onAbort();
        return;
      }

      if (inputValue.trim()) {
        setInputValue('');
        return;
      }

      if (settings.doubleEscapeAction !== 'none') {
        const now = Date.now();
        if (now - lastEscapeTimeRef.current < 500) {
          lastEscapeTimeRef.current = 0;
          if (settings.doubleEscapeAction === 'tree') {
            onGetSessionTree();
          } else {
            onGetForkMessages();
          }
          return;
        }
        lastEscapeTimeRef.current = now;
      }

      setInputValue('');
      return;
    }

    if (key === 'c' && e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const input = e.target as HTMLTextAreaElement;
      const hasSelection = input.selectionStart !== input.selectionEnd;
      if (!hasSelection) {
        e.preventDefault();
        setInputValue('');
        return;
      }
    }

    if (key === 'u' && e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      const input = e.target as HTMLTextAreaElement;
      const pos = input.selectionStart || 0;
      setInputValue(inputValue.slice(pos));
      setTimeout(() => input.setSelectionRange(0, 0), 0);
      return;
    }

    if (key === 'k' && e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      const input = e.target as HTMLTextAreaElement;
      const pos = input.selectionStart || 0;
      setInputValue(inputValue.slice(0, pos));
      return;
    }

    if (matchesHotkey(e, 'modelSelector', hk)) {
      e.preventDefault();
      setShowModelMenu(true);
      setModelFilter('');
      setModelHighlight(0);
      setTimeout(() => modelFilterRef.current?.focus(), 0);
      setShowThinkingMenu(false);
      return;
    }

    if (matchesHotkey(e, 'cycleThinking', hk) && !showSlashMenu && !showResumeMenu) {
      e.preventDefault();
      const currentIdx = THINKING_LEVELS.indexOf(currentThinking);
      const nextIdx = (currentIdx + 1) % THINKING_LEVELS.length;
      onSetThinkingLevel(THINKING_LEVELS[nextIdx]);
      return;
    }

    if (key === 'Tab' && !e.shiftKey && !showSlashMenu && !showResumeMenu && !showFileMenu && !showModelMenu && !showThinkingMenu) {
      const input = e.target as HTMLTextAreaElement;
      const cursorPos = input.selectionStart || 0;
      const textBeforeCursor = inputValue.slice(0, cursorPos);
      
      const lastSpaceOrNewline = Math.max(textBeforeCursor.lastIndexOf(' '), textBeforeCursor.lastIndexOf('\n'));
      const wordStart = lastSpaceOrNewline + 1;
      const currentWord = textBeforeCursor.slice(wordStart);
      
      if (currentWord && (currentWord.startsWith('@') || currentWord.startsWith('.') || currentWord.startsWith('/') || currentWord.startsWith('~') || currentWord.includes('/'))) {
        e.preventDefault();
        const query = currentWord.startsWith('@') ? currentWord.slice(1) : currentWord;
        requestFileList(query);
        setShowFileMenu(true);
        setFileFilter(query);
        setSelectedCmdIdx(0);
        return;
      }
    }

    if (matchesHotkey(e, 'nextModel', hk)) {
      e.preventDefault();
      const enabledScoped = scopedModels.filter(m => m.enabled);
      const cycleModels = enabledScoped.length > 0 
        ? enabledScoped.map(sm => ({ provider: sm.provider, id: sm.modelId, thinkingLevel: sm.thinkingLevel }))
        : models.map(m => ({ provider: m.provider, id: m.id }));
      
      if (cycleModels.length > 0 && currentModel) {
        const currentIdx = cycleModels.findIndex(m => m.id === currentModel.id && m.provider === currentModel.provider);
        const nextIdx = (currentIdx + 1) % cycleModels.length;
        const nextModel = cycleModels[nextIdx];
        onSetModel(nextModel.provider, nextModel.id);
        if ('thinkingLevel' in nextModel && nextModel.thinkingLevel) {
          onSetThinkingLevel(nextModel.thinkingLevel as ThinkingLevel);
        }
      }
      return;
    }

    if (matchesHotkey(e, 'prevModel', hk)) {
      e.preventDefault();
      const enabledScoped = scopedModels.filter(m => m.enabled);
      const cycleModels = enabledScoped.length > 0 
        ? enabledScoped.map(sm => ({ provider: sm.provider, id: sm.modelId, thinkingLevel: sm.thinkingLevel }))
        : models.map(m => ({ provider: m.provider, id: m.id }));
      
      if (cycleModels.length > 0 && currentModel) {
        const currentIdx = cycleModels.findIndex(m => m.id === currentModel.id && m.provider === currentModel.provider);
        const prevIdx = (currentIdx - 1 + cycleModels.length) % cycleModels.length;
        const prevModel = cycleModels[prevIdx];
        onSetModel(prevModel.provider, prevModel.id);
        if ('thinkingLevel' in prevModel && prevModel.thinkingLevel) {
          onSetThinkingLevel(prevModel.thinkingLevel as ThinkingLevel);
        }
      }
      return;
    }

    if (matchesHotkey(e, 'toggleTools', hk)) {
      e.preventDefault();
      onToggleAllToolsCollapsed();
      return;
    }

    if (matchesHotkey(e, 'toggleThinking', hk)) {
      e.preventDefault();
      onToggleAllThinkingCollapsed();
      return;
    }

    if (matchesHotkey(e, 'retrieveQueued', hk)) {
      e.preventDefault();
      onGetQueuedMessages();
      return;
    }

    if (matchesHotkey(e, 'queueFollowUp', hk) && inputValue.trim()) {
      e.preventDefault();
      onFollowUp(inputValue.trim());
      setInputValue('');
      return;
    }

    if (showFileMenu && fileList.length > 0) {
      if (key === 'ArrowDown' || key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCmdIdx(i => (i + 1) % fileList.length);
        return;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCmdIdx(i => (i - 1 + fileList.length) % fileList.length);
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const lastAtIndex = inputValue.lastIndexOf('@');
        const newValue = inputValue.slice(0, lastAtIndex) + '@' + fileList[selectedCmdIdx].path + ' ';
        setInputValue(newValue);
        setShowFileMenu(false);
        setFileList([]);
        return;
      }
      if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowFileMenu(false);
        return;
      }
    }

    if (key === 'Enter' && !e.shiftKey && !e.altKey && (inputValue.trim() || attachedImages.length > 0)) {
      e.preventDefault();
      const trimmed = inputValue.trim();
      
      if (trimmed.startsWith('!!')) {
        const command = trimmed.slice(2).trim();
        if (command) {
          onExecuteBash(command, true);
        }
        setInputValue('');
        return;
      }
      
      if (trimmed.startsWith('!') && !trimmed.startsWith('!!')) {
        const command = trimmed.slice(1).trim();
        if (command) {
          onExecuteBash(command, false);
        }
        setInputValue('');
        return;
      }
      
      userScrolledUpRef.current = false;
      
      if (isStreaming) {
        if (streamingInputMode === 'steer') {
          onSteer(trimmed, attachedImages.length > 0 ? attachedImages : undefined);
        } else {
          onFollowUp(trimmed);
        }
      } else {
        onSendPrompt(trimmed, attachedImages.length > 0 ? attachedImages : undefined);
      }
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      setAttachedImages([]);
      setImagePreviews([]);
      setInputValue('');
    }
  };

  const hasSession = state?.sessionId != null;
  const modelDisplay = currentModel ? `${currentModel.name || currentModel.id}` : 'No model';

  const handlePaneClick = useCallback(() => {
    const selection = window.getSelection();
    const hasTextSelection = selection && selection.toString().length > 0;
    if (!hasInlineDialog && !hasTextSelection) {
      inputRef.current?.focus();
    }
  }, [hasInlineDialog]);

  return (
    <div
      onClick={handlePaneClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex-1 flex flex-col bg-pi-surface overflow-hidden min-w-0 min-h-0 relative"
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-pi-bg/90 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border border-dashed border-pi-accent p-4 text-pi-accent text-[14px]">
            Drop images to attach
          </div>
        </div>
      )}

      <div className="px-3 py-[7px] border-b border-pi-border flex items-center justify-between gap-3 sm:gap-2 text-[12px]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[sessionStatus]} ${
              sessionStatus === 'running' ? 'status-running' : ''
            }`}
          />
          <span className="text-pi-text truncate">
            {hasSession ? sessionTitle : 'No session'}
          </span>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => { const next = !showModelMenu; setShowModelMenu(next); if (next) { setModelFilter(''); setModelHighlight(0); setTimeout(() => modelFilterRef.current?.focus(), 0); } setShowThinkingMenu(false); }}
              className="flex items-center gap-1.5 sm:gap-1 p-2 sm:p-0 -m-2 sm:m-0 text-pi-muted hover:text-pi-text transition-colors"
            >
              <span className="text-pi-accent">⚡</span>
              <span className="max-w-[120px] truncate">{modelDisplay}</span>
              <ChevronDown className="w-4 h-4 sm:w-3 sm:h-3" />
            </button>
            
            {showModelMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] max-w-[90vw] bg-pi-bg border border-pi-border rounded shadow-lg overflow-hidden">
                <div className="p-2 border-b border-pi-border">
                  <input
                    ref={modelFilterRef}
                    value={modelFilter}
                    onChange={(e) => { setModelFilter(e.target.value); setModelHighlight(0); }}
                    placeholder="Filter models..."
                    className="w-full bg-transparent text-pi-text text-[12px] outline-none placeholder:text-pi-muted"
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {models.filter(m => !modelFilter || m.name.toLowerCase().includes(modelFilter.toLowerCase())).map((m, i) => (
                    <button
                      key={`${m.provider}:${m.id}`}
                      onClick={() => { onSetModel(m.provider, m.id); setShowModelMenu(false); inputRef.current?.focus(); }}
                      className={`w-full px-3 py-2 text-left text-[12px] transition-colors ${
                        i === modelHighlight ? 'bg-pi-accent/20 text-pi-accent' : 'text-pi-text hover:bg-pi-surface'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {m.provider === 'anthropic' && <Star className="w-3 h-3 text-pi-accent" />}
                        <span className="truncate">{m.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => onSetThinkingLevel(THINKING_LEVELS[(THINKING_LEVELS.indexOf(currentThinking) + 1) % THINKING_LEVELS.length])}
            className="px-2 py-1 text-[11px] font-medium rounded bg-pi-surface border border-pi-border text-pi-muted hover:text-pi-text transition-colors"
          >
            {currentThinking === 'off' ? 'Off' : currentThinking}
          </button>
        </div>
      </div>

      {activePlan && (
        <ActivePlanBanner
          activePlan={activePlan}
          onToggleTask={onUpdatePlanTask}
          onDeactivate={onDeactivatePlan}
        />
      )}

      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
      >
        <MessageList
          keyPrefix={slotId}
          messages={messages}
          streamingText={deferredStreamingText}
          streamingThinking={deferredStreamingThinking}
          isStreaming={isStreaming}
          activeToolExecutions={activeToolExecutions}
        />
        <div ref={messagesEndRef} />
      </div>

      {questionnaireRequest && (
        <QuestionnaireUI
          request={questionnaireRequest}
          onResponse={onQuestionnaireResponse}
        />
      )}

      {activeExtensionRequest && (
        <ExtensionUIDialog
          request={activeExtensionRequest}
          onResponse={onExtensionUIResponse}
        />
      )}

      {customUIState && (
        <CustomUIDialog
          state={customUIState}
          onInput={onCustomUIInput}
          onClose={() => {}}
        />
      )}

      <div className="border-t border-pi-border bg-pi-surface">
        {attachedImages.length > 0 && (
          <div className="flex gap-2 p-2 overflow-x-auto">
            {attachedImages.map((_img, i) => (
              <div key={i} className="relative flex-shrink-0">
                <img
                  src={imagePreviews[i]}
                  alt="Attached"
                  className="h-16 w-16 object-cover rounded border border-pi-border"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-pi-error text-white rounded-full flex items-center justify-center text-[10px]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          {showSlashMenu && filteredCommands.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-pi-bg border border-pi-border rounded shadow-lg z-50 max-h-[200px] overflow-y-auto">
              {filteredCommands.map((cmd, i) => (
                <button
                  key={cmd.cmd}
                  onClick={() => executeCommand(cmd.action)}
                  className={`w-full px-3 py-2 text-left text-[12px] transition-colors ${
                    i === selectedCmdIdx ? 'bg-pi-accent/20 text-pi-accent' : 'text-pi-text hover:bg-pi-surface'
                  }`}
                >
                  <span className="font-mono text-pi-accent">{cmd.cmd}</span>
                  <span className="ml-2 text-pi-muted">{cmd.desc}</span>
                </button>
              ))}
            </div>
          )}

          {showResumeMenu && filteredSessions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-pi-bg border border-pi-border rounded shadow-lg z-50 max-h-[200px] overflow-y-auto">
              {filteredSessions.map((session, i) => (
                <button
                  key={session.id}
                  onClick={() => selectSession(session.path)}
                  className={`w-full px-3 py-2 text-left text-[12px] transition-colors ${
                    i === selectedCmdIdx ? 'bg-pi-accent/20 text-pi-accent' : 'text-pi-text hover:bg-pi-surface'
                  }`}
                >
                  <div className="truncate">{session.name || session.firstMessage || session.id}</div>
                </button>
              ))}
            </div>
          )}

          {showFileMenu && fileList.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-pi-bg border border-pi-border rounded shadow-lg z-50 max-h-[200px] overflow-y-auto">
              {fileList.map((file, i) => (
                <button
                  key={file.path}
                  onClick={() => {
                    const lastAtIndex = inputValue.lastIndexOf('@');
                    const newValue = inputValue.slice(0, lastAtIndex) + '@' + file.path + ' ';
                    setInputValue(newValue);
                    setShowFileMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-[12px] transition-colors ${
                    i === selectedCmdIdx ? 'bg-pi-accent/20 text-pi-accent' : 'text-pi-text hover:bg-pi-surface'
                  }`}
                >
                  <div className="truncate">{file.name}</div>
                  <div className="text-pi-muted text-[10px]">{file.path}</div>
                </button>
              ))}
            </div>
          )}

          {showForkMenu && forkMessages.length > 0 && (
            <ForkDialog
              messages={forkMessages}
              selectedIndex={forkSelectedIdx}
              onSelect={(entryId) => {
                onFork(entryId);
                setShowForkMenu(false);
              }}
            />
          )}

          {showTreeMenu && treeData.length > 0 && (
            <TreeMenu
              tree={treeData}
              currentLeafId={treeCurrentLeafId}
              selectedIndex={treeSelectedIdx}
              onSelect={(targetId) => {
                onNavigateTree(targetId);
                setShowTreeMenu(false);
              }}
            />
          )}

          <div className="flex items-end gap-2 p-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-pi-muted hover:text-pi-text transition-colors flex-shrink-0"
            >
              <ImagePlus className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={isStreaming ? (altHeld ? "Follow-up (Alt held)..." : "Steer the agent...") : "Type a message..."}
              className="flex-1 min-h-[40px] max-h-[200px] bg-transparent text-pi-text text-[14px] resize-none outline-none placeholder:text-pi-muted py-2"
              rows={1}
              style={{ height: 'auto' }}
            />

            {isStreaming ? (
              <button
                onClick={onAbort}
                className="p-2 text-pi-error hover:text-pi-error/80 transition-colors flex-shrink-0"
              >
                <Square className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() && attachedImages.length === 0}
                className="p-2 text-pi-accent hover:text-pi-accent/80 transition-colors disabled:opacity-30 flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {contextPercent > 50 && (
          <div className="px-3 py-1 text-[10px] text-pi-muted border-t border-pi-border">
            Context: {contextPercent.toFixed(0)}%
          </div>
        )}
      </div>
    </div>
  );
});
