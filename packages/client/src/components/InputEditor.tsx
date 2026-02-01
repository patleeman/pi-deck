import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle, useMemo, useLayoutEffect } from 'react';
import { Image, Send, Square, Command, FileText, Wand2 } from 'lucide-react';
import type { ImageAttachment, SlashCommand } from '@pi-web-ui/shared';

interface InputEditorProps {
  isStreaming: boolean;
  initialValue?: string;
  onValueChange?: (value: string) => void;
  onSend: (message: string, images?: ImageAttachment[]) => void;
  onSteer: (message: string) => void;
  onFollowUp: (message: string) => void;
  onAbort: () => void;
  commands?: SlashCommand[];
  // Built-in command handlers
  onNewSession?: () => void;
  onFork?: () => void;
  onCompact?: () => void;
  onExportHtml?: () => void;
}

export interface InputEditorHandle {
  addImageFile: (file: File) => void;
}

// Built-in commands that the UI handles directly (not sent to agent)
const BUILTIN_COMMANDS: Record<string, { description: string }> = {
  'new': { description: 'Start a new session' },
  'fork': { description: 'Fork conversation from a previous message' },
  'compact': { description: 'Compact the conversation history' },
  'export': { description: 'Export session to HTML' },
};

export const InputEditor = forwardRef<InputEditorHandle, InputEditorProps>(function InputEditor({
  isStreaming,
  initialValue = '',
  onValueChange,
  onSend,
  onSteer,
  onFollowUp,
  onAbort,
  commands = [],
  onNewSession,
  onFork,
  onCompact,
  onExportHtml,
}, ref) {
  const [value, setValue] = useState(initialValue);
  const [showCommands, setShowCommands] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  
  // Debounce persisting value changes to avoid excessive localStorage writes
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onValueChangeRef.current?.(value);
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandsRef = useRef<HTMLDivElement>(null);

  // Calculate which slash command prefix is being typed
  const slashMatch = useMemo(() => {
    // Check if input starts with /
    if (!value.startsWith('/')) return null;
    // Extract the command being typed (up to first space or end)
    const spaceIndex = value.indexOf(' ');
    const prefix = spaceIndex === -1 ? value.slice(1) : value.slice(1, spaceIndex);
    return { prefix, hasSpace: spaceIndex !== -1 };
  }, [value]);

  // Filter commands based on prefix (includes built-in commands)
  const filteredCommands = useMemo(() => {
    if (!slashMatch || slashMatch.hasSpace) return [];
    const prefix = slashMatch.prefix.toLowerCase();
    
    // Start with built-in commands
    const builtinMatches: SlashCommand[] = Object.entries(BUILTIN_COMMANDS)
      .filter(([name, { description }]) =>
        name.toLowerCase().includes(prefix) ||
        description.toLowerCase().includes(prefix)
      )
      .map(([name, { description }]) => ({
        name,
        description,
        source: 'extension' as const, // Use extension icon for built-ins
      }));
    
    // Add extension/template/skill commands
    const otherMatches = commands.filter((cmd) =>
      cmd.name.toLowerCase().includes(prefix) ||
      cmd.description?.toLowerCase().includes(prefix)
    );
    
    return [...builtinMatches, ...otherMatches].slice(0, 10); // Limit to 10 results
  }, [commands, slashMatch]);

  // Show/hide commands popup
  useEffect(() => {
    if (slashMatch && !slashMatch.hasSpace && filteredCommands.length > 0) {
      setShowCommands(true);
      setSelectedCommandIndex(0);
    } else {
      setShowCommands(false);
    }
  }, [slashMatch, filteredCommands.length]);

  // Scroll selected command into view
  useEffect(() => {
    if (showCommands && commandsRef.current) {
      const selected = commandsRef.current.children[selectedCommandIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedCommandIndex, showCommands]);

  const insertCommand = useCallback((command: SlashCommand) => {
    setValue(`/${command.name} `);
    setShowCommands(false);
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [value]);

  // Mobile keyboard handling - ensure input stays visible above keyboard
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Check if we're on mobile (touch device)
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isMobile) return;

    // Use visualViewport API to detect keyboard and adjust position
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    let rafId: number | null = null;

    const handleViewportChange = () => {
      // Cancel any pending animation frame
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        // The difference between layout viewport and visual viewport
        // tells us how much the keyboard is taking up
        const keyboardHeight = window.innerHeight - visualViewport.height;
        
        // Get the root element to apply the offset
        const root = document.getElementById('root');
        if (!root) return;

        if (keyboardHeight > 100) {
          // Keyboard is open - move content up by setting a CSS variable
          // that the container can use for padding/transform
          root.style.height = `${visualViewport.height}px`;
          root.style.transform = `translateY(${visualViewport.offsetTop}px)`;
        } else {
          // Keyboard is closed - reset
          root.style.height = '';
          root.style.transform = '';
        }
      });
    };

    // Listen to both resize (height changes) and scroll (position changes on iOS)
    visualViewport.addEventListener('resize', handleViewportChange);
    visualViewport.addEventListener('scroll', handleViewportChange);

    // Cleanup
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      visualViewport.removeEventListener('resize', handleViewportChange);
      visualViewport.removeEventListener('scroll', handleViewportChange);
      
      // Reset styles
      const root = document.getElementById('root');
      if (root) {
        root.style.height = '';
        root.style.transform = '';
      }
    };
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed && images.length === 0) return;

    // Check for built-in commands
    if (trimmed.startsWith('/')) {
      const commandMatch = trimmed.match(/^\/(\w+)(?:\s+(.*))?$/);
      if (commandMatch) {
        const [, commandName] = commandMatch;
        const lowerCommand = commandName.toLowerCase();
        
        // Handle built-in commands
        if (lowerCommand === 'new' && onNewSession) {
          onNewSession();
          setValue('');
          onValueChange?.('');
          textareaRef.current?.focus();
          return;
        }
        if (lowerCommand === 'fork' && onFork) {
          onFork();
          setValue('');
          onValueChange?.('');
          textareaRef.current?.focus();
          return;
        }
        if (lowerCommand === 'compact' && onCompact) {
          onCompact();
          setValue('');
          onValueChange?.('');
          textareaRef.current?.focus();
          return;
        }
        if (lowerCommand === 'export' && onExportHtml) {
          onExportHtml();
          setValue('');
          onValueChange?.('');
          textareaRef.current?.focus();
          return;
        }
        // Other slash commands (skills, templates, extensions) are sent as prompts
      }
    }

    if (isStreaming) {
      // If streaming, use steer by default (interrupt)
      onSteer(trimmed);
    } else {
      onSend(trimmed, images.length > 0 ? images : undefined);
    }

    setValue('');
    onValueChange?.(''); // Clear persisted draft
    setImages([]);
    textareaRef.current?.focus();
  }, [value, images, isStreaming, onSend, onSteer, onValueChange, onNewSession, onFork, onCompact, onExportHtml]);

  const handleFollowUp = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || !isStreaming) return;

    onFollowUp(trimmed);
    setValue('');
    textareaRef.current?.focus();
  }, [value, isStreaming, onFollowUp]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle command selection keyboard navigation
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        insertCommand(filteredCommands[selectedCommandIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommands(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter: new line
        return;
      }
      if (e.altKey && isStreaming) {
        // Alt+Enter while streaming: follow up
        e.preventDefault();
        handleFollowUp();
        return;
      }
      // Enter: submit
      e.preventDefault();
      handleSubmit();
    }
  };

  const addImageFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setImages((prev) => [
        ...prev,
        {
          type: 'image',
          source: {
            type: 'base64',
            mediaType: file.type,
            data: base64,
          },
        },
      ]);
    };
    reader.readAsDataURL(file);
  }, []);

  // Expose addImageFile to parent via ref
  useImperativeHandle(ref, () => ({
    addImageFile,
  }), [addImageFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          addImageFile(file);
        }
        break;
      }
    }
  }, [addImageFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        addImageFile(file);
      }
    }
  }, [addImageFile]);

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper to get icon for command source
  const getCommandIcon = (source: SlashCommand['source']) => {
    switch (source) {
      case 'skill':
        return <Wand2 className="w-3.5 h-3.5" />;
      case 'template':
        return <FileText className="w-3.5 h-3.5" />;
      case 'extension':
        return <Command className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-pi-border bg-pi-surface px-[max(0.75rem,env(safe-area-inset-left))] md:px-3 py-2 md:py-1.5 font-mono text-base md:text-sm relative">
      {/* Slash command autocomplete popup */}
      {showCommands && filteredCommands.length > 0 && (
        <div
          ref={commandsRef}
          className="absolute bottom-full left-0 right-0 mb-1 mx-2 md:mx-3 max-h-64 overflow-y-auto bg-pi-bg border border-pi-border shadow-lg z-10 font-mono text-sm"
        >
          {filteredCommands.map((cmd, index) => (
            <button
              key={cmd.name}
              onClick={() => insertCommand(cmd)}
              onMouseEnter={() => setSelectedCommandIndex(index)}
              className={`w-full px-3 py-2 flex items-start gap-3 text-left hover:bg-pi-surface transition-colors ${
                index === selectedCommandIndex ? 'bg-pi-surface' : ''
              }`}
            >
              <span className="text-pi-muted mt-0.5 flex-shrink-0">
                {getCommandIcon(cmd.source)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-pi-accent">/{cmd.name}</span>
                  <span className="text-xs text-pi-muted opacity-60">{cmd.source}</span>
                </div>
                {cmd.description && (
                  <div className="text-pi-muted text-xs truncate mt-0.5">
                    {cmd.description}
                  </div>
                )}
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 text-xs text-pi-muted border-t border-pi-border flex items-center gap-4">
            <span>↑↓ navigate</span>
            <span>Tab/Enter select</span>
            <span>Esc close</span>
          </div>
        </div>
      )}

      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap items-center">
          <span className="text-pi-muted text-sm md:text-sm">attached:</span>
          {images.map((img, index) => (
            <div
              key={index}
              className="relative group w-12 h-12 md:w-10 md:h-10 overflow-hidden border border-pi-border"
            >
              <img
                src={`data:${img.source.mediaType};base64,${img.source.data}`}
                alt="Attachment"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute inset-0 bg-pi-bg/80 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center text-pi-error text-xl"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 md:gap-2 items-start">
        {/* Prompt indicator */}
        <span className="text-pi-accent py-2 md:py-1 text-base md:text-sm leading-none">&gt;</span>

        {/* Textarea */}
        <div
          className="flex-1 min-w-0"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isStreaming ? 'steer' : 'message'}
            rows={1}
            className={`w-full resize-none bg-transparent py-2 md:py-1 text-pi-text placeholder-pi-muted focus:outline-none text-base md:text-sm ${
              isStreaming ? 'border-b border-pi-warning/50' : ''
            }`}
            style={{ fontSize: '16px' }} // Prevents iOS zoom on focus
          />
        </div>

        {/* Image upload button - subtle on mobile, more visible on desktop */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-pi-muted hover:text-pi-accent active:text-pi-accent p-1.5 md:p-1 -m-0.5 opacity-50 md:opacity-100"
          title="Attach image"
        >
          <Image className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              addImageFile(file);
            }
            e.target.value = '';
          }}
        />

        {/* Send/Stop buttons */}
        {isStreaming ? (
          <>
            {/* Send steering button - show when there's text to steer */}
            {value.trim() && (
              <button
                onClick={handleSubmit}
                className="text-pi-warning hover:text-pi-warning/80 active:text-pi-warning/80 p-1.5 md:p-1 -m-0.5"
                title="Send steering message"
              >
                <Send className="w-5 h-5 md:w-4 md:h-4" />
              </button>
            )}
            {/* Stop button */}
            <button
              onClick={onAbort}
              className="text-pi-error hover:text-pi-error/80 active:text-pi-error/80 p-1.5 md:p-1 -m-0.5"
              title="Stop"
            >
              <Square className="w-5 h-5 md:w-4 md:h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!value.trim() && images.length === 0}
            className={`text-pi-accent hover:text-pi-accent-hover active:text-pi-accent-hover disabled:opacity-30 disabled:cursor-not-allowed p-1.5 md:p-1 -m-0.5 ${
              !value.trim() && images.length === 0 ? 'hidden md:block' : ''
            }`}
            title="Send"
          >
            <Send className="w-5 h-5 md:w-4 md:h-4" />
          </button>
        )}
      </div>
    </div>
  );
});
