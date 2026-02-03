import { useState, useEffect, useCallback } from 'react';
import { X, GitBranch, ChevronRight, ChevronDown, MessageSquare, Zap, FileText } from 'lucide-react';
import type { SessionTreeNode } from '@pi-web-ui/shared';

interface TreeDialogProps {
  isOpen: boolean;
  tree: SessionTreeNode[];
  currentLeafId: string | null;
  onNavigate: (targetId: string, summarize?: boolean) => void;
  onClose: () => void;
}

function TreeNodeView({ 
  node, 
  currentLeafId, 
  depth = 0, 
  selectedId,
  onSelect 
}: { 
  node: SessionTreeNode; 
  currentLeafId: string | null;
  depth?: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isCurrent = node.id === currentLeafId;
  const isSelected = node.id === selectedId;

  const icon = node.role === 'user' ? (
    <MessageSquare className="w-3 h-3 text-pi-accent" />
  ) : node.role === 'assistant' ? (
    <Zap className="w-3 h-3 text-pi-success" />
  ) : node.type === 'compaction' ? (
    <FileText className="w-3 h-3 text-pi-warning" />
  ) : (
    <div className="w-3 h-3" />
  );

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-pi-surface rounded text-[13px] ${
          isSelected ? 'bg-pi-surface ring-1 ring-pi-accent' : ''
        } ${isCurrent ? 'text-pi-accent' : 'text-pi-text'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 hover:bg-pi-border rounded"
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-pi-muted" />
            ) : (
              <ChevronRight className="w-3 h-3 text-pi-muted" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}
        {icon}
        <span className="truncate flex-1">{node.text || `[${node.type}]`}</span>
        {node.label && (
          <span className="text-[10px] text-pi-warning bg-pi-warning/10 px-1 rounded">{node.label}</span>
        )}
        {isCurrent && (
          <span className="text-[10px] text-pi-accent">●</span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNodeView 
              key={child.id} 
              node={child} 
              currentLeafId={currentLeafId}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeDialog({ isOpen, tree, currentLeafId, onNavigate, onClose }: TreeDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(currentLeafId);

  // Reset selection when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedId(currentLeafId);
    }
  }, [isOpen, currentLeafId]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (selectedId && selectedId !== currentLeafId) {
          onNavigate(selectedId);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, selectedId, currentLeafId, onNavigate, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[70vh] bg-pi-bg border border-pi-border rounded z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-pi-border flex-shrink-0">
          <div className="flex items-center gap-2 text-pi-text">
            <GitBranch className="w-4 h-4" />
            <span className="text-[14px]">Session Tree</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-pi-muted hover:text-pi-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tree view */}
        <div className="flex-1 overflow-y-auto p-2">
          {tree.length === 0 ? (
            <div className="p-4 text-pi-muted text-[14px] text-center">
              No session history
            </div>
          ) : (
            tree.map(node => (
              <TreeNodeView
                key={node.id}
                node={node}
                currentLeafId={currentLeafId}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-pi-border flex items-center justify-between">
          <div className="text-[11px] text-pi-muted">
            Click to select • Enter to navigate • Esc to cancel
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 text-[12px] text-pi-muted hover:text-pi-text border border-pi-border rounded"
            >
              Cancel
            </button>
            <button
              onClick={() => selectedId && onNavigate(selectedId)}
              disabled={!selectedId || selectedId === currentLeafId}
              className="px-3 py-1 text-[12px] text-pi-bg bg-pi-accent hover:bg-pi-accent-hover rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Navigate
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
