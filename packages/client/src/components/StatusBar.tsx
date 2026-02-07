function shortenCwd(cwd: string): string {
  const parts = cwd.replace(/\/$/, '').split('/');
  if (parts.length <= 3) return cwd;
  return '…/' + parts.slice(-2).join('/');
}

interface StatusBarProps {
  cwd: string;
  gitBranch: string | null;
  gitChangedFiles: number;
  runningCount: number;
  compactingCount: number;
  errorCount: number;
  contextPercent?: number;
  isKeyboardVisible?: boolean;
  message?: string | null;
  messageType?: 'error' | 'warning' | 'info';
  onDismissMessage?: () => void;
}

export function StatusBar({
  cwd,
  gitBranch,
  gitChangedFiles,
  runningCount,
  compactingCount,
  errorCount,
  contextPercent,
  isKeyboardVisible = false,
  message,
  messageType = 'info',
  onDismissMessage,
}: StatusBarProps) {
  // Hide status bar when keyboard is visible on mobile
  if (isKeyboardVisible) {
    return null;
  }

  const messageColors = {
    error: 'text-pi-error',
    warning: 'text-pi-warning',
    info: 'text-pi-muted',
  };

  return (
    <div 
      className="flex items-center justify-between px-3 py-1.5 border-t border-pi-border text-[12px] text-pi-muted font-mono"
    >
      {/* Left side: message, cwd, git branch */}
      <div className="flex items-center gap-5">
        {message && (
          <span className={`flex items-center gap-2 ${messageColors[messageType]}`}>
            [!] {message}
            {onDismissMessage && (
              <button
                onClick={onDismissMessage}
                className="hover:opacity-70 transition-opacity"
                title="Dismiss"
              >
                ×
              </button>
            )}
          </span>
        )}
        {cwd && (
          <span className="truncate max-w-[300px]" title={cwd}>
            {shortenCwd(cwd)}
          </span>
        )}
        {gitBranch && (
          <span className="text-pi-success flex items-center gap-1">
            {gitBranch}
            {gitChangedFiles > 0 && (
              <span className="text-pi-warning">+{gitChangedFiles}</span>
            )}
          </span>
        )}
      </div>

      {/* Right side: session status summary */}
      <div className="flex items-center gap-5">
        {compactingCount > 0 && (
          <span className="text-pi-warning">Compacting...</span>
        )}
        {runningCount > 0 && (
          <span>{runningCount} running</span>
        )}
        {errorCount > 0 && (
          <span className="text-pi-error">{errorCount} {errorCount === 1 ? 'error' : 'errors'}</span>
        )}
        {contextPercent !== undefined && (
          <span className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-pi-border rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${contextPercent}%`,
                  backgroundColor: `hsl(${Math.max(0, 120 - contextPercent * 1.2)}, 70%, 45%)`,
                }}
              />
            </div>
            <span>{Math.round(contextPercent)}%</span>
          </span>
        )}
      </div>
    </div>
  );
}
