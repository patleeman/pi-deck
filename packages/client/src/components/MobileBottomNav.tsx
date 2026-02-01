import { useState, useEffect } from 'react';
import { Menu, Plus, Settings, Layers, FolderOpen, X } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

// Debug: Track render count
let renderCount = 0;

interface WorkspaceTab {
  id: string;
  name: string;
  path: string;
  isStreaming: boolean;
  needsAttention?: boolean;
}

interface MobileBottomNavProps {
  onToggleSidebar: () => void;
  onNewSession: () => void;
  hasActiveWorkspace: boolean;
  workspaces: WorkspaceTab[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onCloseWorkspace: (id: string) => void;
  onOpenBrowser: () => void;
}

export function MobileBottomNav({ 
  onToggleSidebar, 
  onNewSession,
  hasActiveWorkspace,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCloseWorkspace,
  onOpenBrowser,
}: MobileBottomNavProps) {
  const { openSettings } = useSettings();
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  
  // Debug: Log when workspaces change
  useEffect(() => {
    renderCount++;
    console.log(`[MobileBottomNav] Render #${renderCount}, workspaces:`, 
      workspaces.map(w => ({ id: w.id, name: w.name, path: w.path }))
    );
  }, [workspaces]);

  return (
    <>
      {/* Workspace menu overlay */}
      {showWorkspaceMenu && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowWorkspaceMenu(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-pi-bg border-t border-pi-border rounded-t-xl max-h-[60vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-pi-border">
              <h3 className="font-mono text-pi-text">Workspaces</h3>
              <button
                onClick={() => setShowWorkspaceMenu(false)}
                className="p-1 text-pi-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Workspace list */}
            <div className="flex-1 overflow-y-auto">
              {workspaces.length === 0 ? (
                <div className="px-4 py-8 text-center text-pi-muted font-mono text-sm">
                  No workspaces open
                </div>
              ) : (
                workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-pi-border ${
                      ws.id === activeWorkspaceId ? 'bg-pi-surface' : ''
                    }`}
                  >
                    <button
                      onClick={() => {
                        onSelectWorkspace(ws.id);
                        setShowWorkspaceMenu(false);
                      }}
                      className="flex-1 flex items-center gap-3 text-left min-w-0"
                    >
                      {/* Status indicator */}
                      {ws.isStreaming ? (
                        <span className="w-2 h-2 rounded-full bg-pi-accent animate-pulse flex-shrink-0" />
                      ) : ws.needsAttention ? (
                        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                      ) : (
                        <span className="w-2 h-2 flex-shrink-0" />
                      )}
                      
                      <div className="min-w-0 flex-1">
                        <div className={`font-mono text-sm truncate ${
                          ws.id === activeWorkspaceId ? 'text-pi-accent' : 'text-pi-text'
                        }`}>
                          {ws.name}
                        </div>
                        <div className="text-xs text-pi-muted truncate">
                          {ws.path}
                        </div>
                      </div>
                    </button>

                    {/* Close button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('[MobileBottomNav] Closing workspace:', {
                          id: ws.id,
                          name: ws.name,
                          path: ws.path,
                          allWorkspaces: workspaces.map(w => ({ id: w.id, name: w.name })),
                        });
                        onCloseWorkspace(ws.id);
                        if (workspaces.length === 1) {
                          setShowWorkspaceMenu(false);
                        }
                      }}
                      className="p-2 text-pi-muted hover:text-pi-text"
                      title={`Close ${ws.path}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Open new workspace button */}
            <button
              onClick={() => {
                onOpenBrowser();
                setShowWorkspaceMenu(false);
              }}
              className="flex items-center justify-center gap-2 px-4 py-4 border-t border-pi-border text-pi-accent font-mono text-sm"
            >
              <FolderOpen className="w-5 h-5" />
              <span>Open Directory</span>
            </button>
          </div>
        </>
      )}

      {/* Bottom nav bar */}
      <nav className="flex-shrink-0 border-t border-pi-border bg-pi-surface px-[max(0.5rem,env(safe-area-inset-left))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-center justify-around">
          {/* Workspaces */}
          <button
            onClick={() => setShowWorkspaceMenu(true)}
            className="flex flex-col items-center gap-1 px-3 py-2 text-pi-muted active:text-pi-accent transition-colors relative"
          >
            <Layers className="w-6 h-6" />
            <span className="text-xs font-mono truncate max-w-[60px]">
              {activeWorkspace?.name || 'Workspaces'}
            </span>
            {/* Badge for workspace count */}
            {workspaces.length > 1 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-pi-accent text-pi-bg text-[10px] font-mono rounded-full flex items-center justify-center">
                {workspaces.length}
              </span>
            )}
            {/* Attention indicator */}
            {workspaces.some(w => w.needsAttention && w.id !== activeWorkspaceId) && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
            )}
          </button>

          {/* Sessions toggle */}
          <button
            onClick={onToggleSidebar}
            disabled={!hasActiveWorkspace}
            className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors ${
              hasActiveWorkspace 
                ? 'text-pi-muted active:text-pi-accent' 
                : 'text-pi-muted/40'
            }`}
          >
            <Menu className="w-6 h-6" />
            <span className="text-xs font-mono">Sessions</span>
          </button>

          {/* New chat */}
          <button
            onClick={onNewSession}
            disabled={!hasActiveWorkspace}
            className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors ${
              hasActiveWorkspace 
                ? 'text-pi-muted active:text-pi-accent' 
                : 'text-pi-muted/40'
            }`}
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs font-mono">New</span>
          </button>

          {/* Settings */}
          <button
            onClick={openSettings}
            className="flex flex-col items-center gap-1 px-3 py-2 text-pi-muted active:text-pi-accent transition-colors"
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs font-mono">Settings</span>
          </button>
        </div>
      </nav>
    </>
  );
}
