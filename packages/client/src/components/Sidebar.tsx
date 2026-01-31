import type { SessionInfo } from '@pi-web-ui/shared';

interface SidebarProps {
  sessions: SessionInfo[];
  currentSessionId?: string;
  onSwitchSession: (sessionId: string) => void;
  onNewSession: () => void;
  onRefresh: () => void;
}

export function Sidebar({
  sessions,
  currentSessionId,
  onSwitchSession,
  onNewSession,
  onRefresh,
}: SidebarProps) {
  // Sort sessions by most recent
  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <aside className="w-56 flex-shrink-0 border-r border-pi-border bg-pi-surface flex flex-col font-mono text-sm">
      {/* Header */}
      <div className="px-2 py-1 border-b border-pi-border flex items-center justify-between">
        <span className="text-pi-muted">sessions</span>
        <div className="flex items-center">
          <button
            onClick={onRefresh}
            className="px-1 hover:text-pi-text text-pi-muted"
            title="Refresh sessions"
          >
            ↻
          </button>
          <button
            onClick={onNewSession}
            className="px-1 text-pi-accent hover:text-pi-accent-hover"
            title="New session"
          >
            +
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sortedSessions.length === 0 ? (
          <div className="px-2 py-2 text-pi-muted">
            (empty)
          </div>
        ) : (
          <div className="py-0.5">
            {sortedSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSwitchSession(session.path)}
                className={`w-full text-left px-2 py-0.5 transition-colors flex items-center gap-1 ${
                  session.id === currentSessionId
                    ? 'bg-pi-accent/20 text-pi-accent'
                    : 'hover:bg-pi-bg'
                }`}
              >
                <span className="text-pi-muted">{session.id === currentSessionId ? '▸' : ' '}</span>
                <span className="flex-1 truncate">
                  {session.name || session.firstMessage || '(empty)'}
                </span>
                <span className="text-pi-muted text-xs">{session.messageCount}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
