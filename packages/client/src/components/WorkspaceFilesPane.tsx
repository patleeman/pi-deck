import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { ArrowUp, ChevronDown, ChevronRight, Folder, FileText, LoaderCircle } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { FileInfo } from '@pi-web-ui/shared';

interface WorkspaceFilesPaneProps {
  workspaceName: string;
  entriesByPath: Record<string, FileInfo[]>;
  fileContentsByPath: Record<string, { content: string; truncated: boolean }>;
  onRequestEntries: (path: string) => void;
  onRequestFile: (path: string) => void;
  onTogglePane: () => void;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_TREE_RATIO = 0.33;
const MIN_TREE_RATIO = 0.2;
const MAX_TREE_RATIO = 0.8;

interface TreeRow {
  entry: FileInfo;
  depth: number;
  isPlaceholder?: boolean;
}

const editorTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: 'transparent',
    margin: 0,
    padding: 0,
    fontSize: '12px',
    lineHeight: '1.5',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
    fontSize: '12px',
  },
};

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  json: 'json',
  md: 'markdown',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'cpp',
  css: 'css',
  html: 'html',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  zsh: 'bash',
  toml: 'toml',
  txt: 'text',
};

function getLanguage(path: string): string {
  const parts = path.split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  return LANGUAGE_BY_EXT[ext] || 'text';
}

function getParentPath(path: string): string {
  if (!path) return '';
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

export function WorkspaceFilesPane({
  workspaceName,
  entriesByPath,
  fileContentsByPath,
  onRequestEntries,
  onRequestFile,
  onTogglePane,
  className = '',
  style,
}: WorkspaceFilesPaneProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState('');
  const [treeRootPath, setTreeRootPath] = useState('');
  const [treeRatio, setTreeRatio] = useState(DEFAULT_TREE_RATIO);
  const [isResizing, setIsResizing] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  const entryIndex = useMemo(() => {
    const map = new Map<string, FileInfo>();
    Object.values(entriesByPath).forEach((entries) => {
      entries.forEach((entry) => map.set(entry.path, entry));
    });
    return map;
  }, [entriesByPath]);

  useEffect(() => {
    setTreeRootPath('');
    setExpandedPaths(new Set());
    setSelectedPath('');
  }, [workspaceName]);

  useEffect(() => {
    if (!entriesByPath[treeRootPath]) {
      onRequestEntries(treeRootPath);
    }
  }, [entriesByPath, onRequestEntries, treeRootPath]);

  useEffect(() => {
    if (selectedPath && !entryIndex.has(selectedPath)) {
      setSelectedPath('');
    }
  }, [entryIndex, selectedPath]);

  useEffect(() => {
    if (!selectedPath || !treeRootPath) return;
    const isWithinRoot = selectedPath === treeRootPath || selectedPath.startsWith(`${treeRootPath}/`);
    if (!isWithinRoot) {
      setSelectedPath('');
    }
  }, [selectedPath, treeRootPath]);

  const togglePath = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
        if (!entriesByPath[path]) {
          onRequestEntries(path);
        }
      }
      return next;
    });
  };

  const handleZoomOut = useCallback(() => {
    setTreeRootPath((prev) => getParentPath(prev));
  }, []);

  const handleZoomIn = useCallback((path: string) => {
    setTreeRootPath(path);
  }, []);

  const handleResizeStart = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const container = splitRef.current?.getBoundingClientRect();
      if (!container) return;
      const ratio = (event.clientY - container.top) / container.height;
      const clampedRatio = Math.min(Math.max(ratio, MIN_TREE_RATIO), MAX_TREE_RATIO);
      setTreeRatio(clampedRatio);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const visibleNodes = useMemo(() => {
    const nodes: TreeRow[] = [];
    const rootEntries = entriesByPath[treeRootPath] || [];
    const stack: Array<{ entry: FileInfo; depth: number }> = [];

    for (let i = rootEntries.length - 1; i >= 0; i -= 1) {
      stack.push({ entry: rootEntries[i], depth: 0 });
    }

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      nodes.push({ entry: current.entry, depth: current.depth });

      if (current.entry.isDirectory && expandedPaths.has(current.entry.path)) {
        const children = entriesByPath[current.entry.path];
        if (!children) {
          nodes.push({
            entry: {
              name: 'Loading...',
              path: `__loading__/${current.entry.path}`,
              isDirectory: false,
            },
            depth: current.depth + 1,
            isPlaceholder: true,
          });
        } else if (children.length === 0) {
          nodes.push({
            entry: {
              name: 'Empty folder',
              path: `__empty__/${current.entry.path}`,
              isDirectory: false,
            },
            depth: current.depth + 1,
            isPlaceholder: true,
          });
        } else {
          for (let i = children.length - 1; i >= 0; i -= 1) {
            stack.push({ entry: children[i], depth: current.depth + 1 });
          }
        }
      }
    }

    return nodes;
  }, [entriesByPath, expandedPaths, treeRootPath]);

  const selectedEntry = selectedPath ? entryIndex.get(selectedPath) : undefined;
  const selectedFilePath = selectedEntry && !selectedEntry.isDirectory ? selectedEntry.path : '';
  const selectedFileContent = selectedFilePath ? fileContentsByPath[selectedFilePath] : undefined;

  useEffect(() => {
    if (selectedFilePath && !selectedFileContent) {
      onRequestFile(selectedFilePath);
    }
  }, [selectedFilePath, selectedFileContent, onRequestFile]);

  const hasRootEntries = Object.prototype.hasOwnProperty.call(entriesByPath, treeRootPath);
  const isRootEmpty = hasRootEntries && (entriesByPath[treeRootPath]?.length ?? 0) === 0;
  const editorLanguage = selectedFilePath ? getLanguage(selectedFilePath) : 'text';
  const treeRootLabel = treeRootPath ? `/${treeRootPath}` : '/';
  const canZoomOut = treeRootPath !== '';

  return (
    <aside className={`w-72 border-l border-pi-border bg-pi-surface flex flex-col ${className}`} style={style}>
      <div className="px-3 py-2 border-b border-pi-border flex items-start gap-2">
        <button
          type="button"
          onClick={onTogglePane}
          className="mt-0.5 rounded p-1 text-pi-muted hover:text-pi-text hover:bg-pi-bg transition-colors"
          title="Hide file pane (⌘⇧F)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-pi-muted">Files</div>
          <div className="text-[12px] text-pi-text truncate">{workspaceName}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col" ref={splitRef}>
        <div className="min-h-0 flex flex-col" style={{ flex: `${treeRatio} 1 0%` }}>
          <div className="px-3 py-2 border-b border-pi-border flex items-center gap-2 text-[11px] text-pi-muted">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={!canZoomOut}
              className={`p-1 rounded transition-colors ${
                canZoomOut ? 'text-pi-muted hover:text-pi-text hover:bg-pi-bg' : 'text-pi-muted/40 cursor-not-allowed'
              }`}
              title="Up one level"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <span className="truncate">{treeRootLabel}</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {visibleNodes.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-pi-muted">
                {isRootEmpty ? 'No files found' : 'Loading files...'}
              </div>
            ) : (
              visibleNodes.map(({ entry, depth, isPlaceholder }) => {
                const isSelected = selectedPath === entry.path;
                const showLoader = Boolean(isPlaceholder && entry.name === 'Loading...');

                return (
                  <div key={entry.path}>
                    <button
                      onClick={() => !isPlaceholder && setSelectedPath(entry.path)}
                      onDoubleClick={() => {
                        if (!isPlaceholder && entry.isDirectory) {
                          handleZoomIn(entry.path);
                        }
                      }}
                      className={`w-full flex items-center gap-2 py-1 rounded text-left text-[12px] transition-colors ${
                        isSelected ? 'bg-pi-border/40 text-pi-text' : 'text-pi-muted hover:text-pi-text hover:bg-pi-bg'
                      } ${isPlaceholder ? 'cursor-default opacity-70' : ''}`}
                      style={{ paddingLeft: `${depth * 12 + 8}px` }}
                      disabled={isPlaceholder}
                    >
                      {entry.isDirectory ? (
                        <span
                          className="w-4 h-4 flex items-center justify-center"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!isPlaceholder) {
                              togglePath(entry.path);
                            }
                          }}
                        >
                          {expandedPaths.has(entry.path) ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </span>
                      ) : (
                        <span className="w-4 h-4 flex items-center justify-center">
                          {showLoader ? <LoaderCircle className="w-3 h-3 animate-spin" /> : null}
                        </span>
                      )}
                      {entry.isDirectory ? (
                        <Folder className="w-3.5 h-3.5 text-pi-muted" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-pi-muted" />
                      )}
                      <span className="truncate">{entry.name}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div
          onMouseDown={handleResizeStart}
          className="flex-shrink-0 h-1 cursor-row-resize hover:bg-pi-border flex items-center justify-center"
        >
          <div className="bg-pi-border/50 rounded-full h-0.5 w-6" />
        </div>

        <div
          className="border-t border-pi-border flex flex-col min-h-0"
          style={{ flex: `${1 - treeRatio} 1 0%` }}
        >
          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-pi-muted">Editor</div>
          <div className="px-3 pb-2 text-[12px] text-pi-text truncate" title={selectedFilePath ? `/${selectedFilePath}` : ''}>
            {selectedFilePath ? `/${selectedFilePath}` : 'Select a file to preview'}
          </div>
          <div className="flex-1 overflow-auto px-3 pb-3">
            {!selectedFilePath ? (
              <div className="text-[12px] text-pi-muted">Pick a file in the tree above to preview it here.</div>
            ) : !selectedFileContent ? (
              <div className="text-[12px] text-pi-muted flex items-center gap-2">
                <LoaderCircle className="w-3 h-3 animate-spin" />
                Loading file...
              </div>
            ) : (
              <div className="rounded border border-pi-border bg-pi-bg p-2">
                <SyntaxHighlighter
                  language={editorLanguage}
                  style={editorTheme as any}
                  customStyle={{
                    margin: 0,
                    background: 'transparent',
                    padding: 0,
                    fontSize: '12px',
                    lineHeight: '1.5',
                  }}
                  showLineNumbers
                  lineNumberStyle={{ color: '#7d8590', paddingRight: '12px' }}
                >
                  {selectedFileContent.content || ' '}
                </SyntaxHighlighter>
                {selectedFileContent.truncated && (
                  <div className="mt-2 text-[11px] text-pi-muted">
                    Preview truncated — file is larger than 200KB.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
