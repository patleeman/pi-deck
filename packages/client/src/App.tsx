import { useState, useCallback, useRef } from 'react';
import { useWorkspaces } from './hooks/useWorkspaces';
import { ChatView } from './components/ChatView';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { InputEditor, InputEditorHandle } from './components/InputEditor';
import { ConnectionStatus } from './components/ConnectionStatus';
import { DirectoryBrowser } from './components/DirectoryBrowser';
import { WorkspaceTabs } from './components/WorkspaceTabs';

const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:3001/ws'
  : `ws://${window.location.host}/ws`;

function App() {
  const ws = useWorkspaces(WS_URL);
  const [isDragging, setIsDragging] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const dragCounterRef = useRef(0);
  const inputEditorRef = useRef<InputEditorHandle>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;

    // Check if dragging files
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length > 0 && inputEditorRef.current) {
      imageFiles.forEach((file) => {
        inputEditorRef.current?.addImageFile(file);
      });
    }
  }, []);

  // Keyboard shortcut for opening browser
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && showBrowser) {
        setShowBrowser(false);
      }
      if (e.key === 'o' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowBrowser(true);
      }
    },
    [showBrowser]
  );

  if (!ws.isConnected && ws.isConnecting) {
    return (
      <div className="min-h-screen bg-pi-bg flex items-center justify-center font-mono text-sm text-pi-muted">
        <span className="text-pi-accent animate-pulse">π</span>
        <span className="ml-2">connecting...</span>
      </div>
    );
  }

  const activeWs = ws.activeWorkspace;
  const workspaceTabs = ws.workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    path: w.path,
    isStreaming: w.isStreaming,
    messageCount: w.messages.length,
  }));

  return (
    <div
      className="min-h-screen bg-pi-bg flex flex-col relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-pi-bg/95 flex items-center justify-center pointer-events-none font-mono">
          <div className="border border-dashed border-pi-accent p-4 text-pi-accent">
            [drop images to attach]
          </div>
        </div>
      )}

      {/* Directory browser modal */}
      {showBrowser && (
        <DirectoryBrowser
          currentPath={ws.currentBrowsePath}
          entries={ws.directoryEntries}
          allowedRoots={ws.allowedRoots}
          onNavigate={ws.browseDirectory}
          onOpenWorkspace={ws.openWorkspace}
          onClose={() => setShowBrowser(false)}
        />
      )}

      {/* Connection status banner */}
      <ConnectionStatus isConnected={ws.isConnected} error={ws.error} />

      {/* Workspace tabs */}
      <WorkspaceTabs
        tabs={workspaceTabs}
        activeId={ws.activeWorkspaceId}
        onSelect={ws.setActiveWorkspace}
        onClose={ws.closeWorkspace}
        onOpenBrowser={() => setShowBrowser(true)}
      />

      {/* Show empty state when no workspace is open */}
      {!activeWs ? (
        <div className="flex-1 flex flex-col items-center justify-center text-pi-muted font-mono">
          <span className="text-pi-accent text-6xl mb-4">π</span>
          <p className="mb-4">No workspace open</p>
          <button
            onClick={() => setShowBrowser(true)}
            className="px-4 py-2 border border-pi-accent text-pi-accent hover:bg-pi-accent hover:text-pi-bg transition-colors"
          >
            [open directory] <span className="text-xs ml-2">⌘O</span>
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <Header
            state={activeWs.state}
            models={activeWs.models}
            onSetModel={ws.setModel}
            onSetThinkingLevel={ws.setThinkingLevel}
          />

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <Sidebar
              sessions={activeWs.sessions}
              currentSessionId={activeWs.state?.sessionId}
              onSwitchSession={ws.switchSession}
              onNewSession={ws.newSession}
              onRefresh={ws.refreshSessions}
            />

            {/* Main content */}
            <main className="flex-1 flex flex-col overflow-hidden">
              {/* Chat messages */}
              <ChatView
                messages={activeWs.messages}
                isStreaming={activeWs.isStreaming}
                streamingText={activeWs.streamingText}
                streamingThinking={activeWs.streamingThinking}
                activeToolExecutions={activeWs.activeToolExecutions}
              />

              {/* Input editor */}
              <InputEditor
                ref={inputEditorRef}
                isStreaming={activeWs.isStreaming}
                onSend={ws.sendPrompt}
                onSteer={ws.steer}
                onFollowUp={ws.followUp}
                onAbort={ws.abort}
              />
            </main>
          </div>

          {/* Footer */}
          <footer className="flex-shrink-0 border-t border-pi-border px-3 py-0.5 text-xs text-pi-muted flex items-center justify-between font-mono">
            <span>
              {activeWs.path} | {activeWs.state?.sessionId?.slice(0, 8) || '–'}{' '}
              | {activeWs.state?.messageCount || 0} msgs
            </span>
            <span>
              {((activeWs.state?.tokens.total || 0) / 1000).toFixed(1)}k tok | $
              {(activeWs.state?.cost || 0).toFixed(4)}
            </span>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
