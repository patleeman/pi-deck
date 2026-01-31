interface ConnectionStatusProps {
  isConnected: boolean;
  error: string | null;
}

export function ConnectionStatus({ isConnected, error }: ConnectionStatusProps) {
  if (isConnected && !error) {
    return null;
  }

  return (
    <div className="bg-pi-error/10 border-b border-pi-error/30 px-3 py-0.5 text-xs font-mono text-pi-error">
      [!] {error || 'disconnected, reconnecting...'}
    </div>
  );
}
