import { useState, useEffect, useCallback, useRef } from 'react';
import { X, GitBranch } from 'lucide-react';

interface ForkMessage {
  entryId: string;
  text: string;
}

interface ForkDialogProps {
  isOpen: boolean;
  messages: ForkMessage[];
  onFork: (entryId: string) => void;
  onClose: () => void;
  onRefresh: () => void;
}

export function ForkDialog({ isOpen, messages, onFork, onClose, onRefresh }: ForkDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Refresh messages when dialog opens
  useEffect(() => {
    if (isOpen) {
      onRefresh();
      setSelectedIndex(0);
    }
  }, [isOpen, onRefresh]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, messages.length]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, messages.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (messages[selectedIndex]) {
          onFork(messages[selectedIndex].entryId);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, messages, selectedIndex, onFork, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-pi-bg border border-pi-border shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col font-mono">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-pi-border">
          <div className="flex items-center gap-2 text-pi-text">
            <GitBranch className="w-4 h-4" />
            <span className="text-sm font-medium">Fork from message</span>
          </div>
          <button
            onClick={onClose}
            className="text-pi-muted hover:text-pi-text p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message list */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="p-4 text-center text-pi-muted text-sm">
              No messages available to fork from
            </div>
          ) : (
            messages.map((msg, index) => (
              <button
                key={msg.entryId}
                onClick={() => {
                  onFork(msg.entryId);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full px-4 py-3 text-left border-b border-pi-border last:border-b-0 transition-colors ${
                  index === selectedIndex
                    ? 'bg-pi-surface'
                    : 'hover:bg-pi-surface/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-pi-accent flex-shrink-0">&gt;</span>
                  <span className="text-sm text-pi-text line-clamp-3">
                    {msg.text}
                  </span>
                </div>
                <div className="mt-1 text-xs text-pi-muted pl-4">
                  ID: {msg.entryId.slice(0, 8)}...
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="px-4 py-2 border-t border-pi-border text-xs text-pi-muted flex items-center gap-4">
          <span>↑↓ navigate</span>
          <span>Enter select</span>
          <span>Esc cancel</span>
        </div>
      </div>
    </div>
  );
}
