import { useState, useEffect, memo } from 'react';
import type { CSSProperties } from 'react';
import { FileText, LoaderCircle, ChevronRight, Eye, GitBranch } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useTheme } from '../contexts/ThemeContext';
import { getCodeTheme } from '../codeTheme';

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  json: 'json', md: 'markdown', py: 'python', go: 'go', rs: 'rust',
  java: 'java', c: 'c', cpp: 'cpp', h: 'cpp', css: 'css', html: 'html',
  yml: 'yaml', yaml: 'yaml', sh: 'bash', zsh: 'bash', toml: 'toml', txt: 'text',
};

function getLanguage(path: string): string {
  const parts = path.split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  return LANGUAGE_BY_EXT[ext] || 'text';
}

interface WorkspaceFilesPaneProps {
  workspaceName: string;
  workspaceId: string;
  workspacePath: string;
  selectedFilePath: string;
  fileContentsByPath: Record<string, { content: string; truncated: boolean }>;
  fileDiffsByPath: Record<string, string>;
  onRequestFile: (path: string) => void;
  onRequestFileDiff: (path: string) => void;
  viewMode: 'file' | 'diff';
  onTogglePane: () => void;
  className?: string;
  style?: CSSProperties;
}

export const WorkspaceFilesPane = memo(function WorkspaceFilesPane({
  workspacePath,
  selectedFilePath,
  fileContentsByPath,
  fileDiffsByPath,
  onRequestFile,
  onRequestFileDiff,
  viewMode,
  onTogglePane,
  className = '',
  style,
}: WorkspaceFilesPaneProps) {
  const { theme } = useTheme();
  const editorTheme = getCodeTheme(theme.mode);

  const absolutePath = selectedFilePath && !selectedFilePath.startsWith('/') && !selectedFilePath.startsWith('~/')
    ? `${workspacePath.endsWith('/') ? workspacePath : workspacePath + '/'}${selectedFilePath}`
    : selectedFilePath;
  const selectedFileContent = selectedFilePath
    ? (fileContentsByPath[selectedFilePath] || fileContentsByPath[absolutePath])
    : undefined;
  const selectedFileDiff = selectedFilePath
    ? (fileDiffsByPath[selectedFilePath] || fileDiffsByPath[absolutePath])
    : undefined;

  useEffect(() => {
    if (selectedFilePath && viewMode === 'file' && !selectedFileContent) {
      onRequestFile(selectedFilePath);
    }
  }, [selectedFilePath, selectedFileContent, onRequestFile, viewMode]);

  useEffect(() => {
    if (selectedFilePath && viewMode === 'diff' && !selectedFileDiff) {
      onRequestFileDiff(selectedFilePath);
    }
  }, [selectedFilePath, selectedFileDiff, onRequestFileDiff, viewMode]);

  const editorLanguage = selectedFilePath ? getLanguage(selectedFilePath) : 'text';
  const displayPath = selectedFilePath || '';

  return (
    <aside className={`w-72 border-l border-pi-border bg-pi-surface flex flex-col ${className}`} style={style}>
      {/* Header */}
      <div className="h-10 px-3 border-b border-pi-border flex items-center">
        <Eye className="w-3 h-3 text-pi-muted mr-2" />
        <span className="text-[12px] uppercase tracking-wide text-pi-text">Preview</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onTogglePane}
          className="hidden sm:flex p-1.5 text-pi-muted hover:text-pi-text hover:bg-pi-bg rounded transition-colors"
          title="Hide pane (⌘⇧F)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* File path */}
      <div className="px-3 py-2 border-b border-pi-border flex items-center gap-2">
        {viewMode === 'diff' && <GitBranch className="w-3 h-3 text-pi-muted flex-shrink-0" />}
        <div className="text-[12px] text-pi-text truncate flex-1" title={displayPath}>
          {displayPath || ''}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-3 py-3">
        {!selectedFilePath ? (
          <div className="text-[12px] text-pi-muted flex flex-col items-center justify-center h-full gap-2">
            <FileText className="w-6 h-6 opacity-30" />
            <span>Select a file to preview</span>
          </div>
        ) : viewMode === 'diff' ? (
          !selectedFileDiff ? (
            <div className="text-[12px] text-pi-muted flex items-center gap-2">
              <LoaderCircle className="w-3 h-3 animate-spin" />
              Loading diff...
            </div>
          ) : (
            <div className="rounded border border-pi-border bg-pi-bg p-2 font-mono text-[12px] leading-relaxed">
              {selectedFileDiff.split('\n').map((line, i) => {
                let lineClass = 'text-pi-muted';
                let bgClass = '';
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  lineClass = 'text-pi-success';
                  bgClass = 'bg-pi-success/10';
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  lineClass = 'text-pi-error';
                  bgClass = 'bg-pi-error/10';
                } else if (line.startsWith('@@')) {
                  lineClass = 'text-pi-accent';
                  bgClass = 'bg-pi-accent/10';
                } else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
                  lineClass = 'text-pi-muted';
                }
                return (
                  <div key={i} className={`whitespace-pre ${bgClass}`}>
                    <span className={lineClass}>{line}</span>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          !selectedFileContent ? (
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
                <div className="mt-2 text-[12px] text-pi-muted">
                  Preview truncated — file is larger than 200KB.
                </div>
              )}
            </div>
          )
        )}
      </div>
    </aside>
  );
});
