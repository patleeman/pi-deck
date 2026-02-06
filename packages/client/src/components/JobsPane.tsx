import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus,
  ArrowLeft,
  Edit3,
  Check,
  ChevronDown,
  ChevronRight,
  Play,
  ClipboardList,
  ArrowRightCircle,
  ArrowLeftCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { JobInfo, JobPhase, JobTask, ActiveJobState } from '@pi-web-ui/shared';
import { JOB_PHASE_ORDER } from '@pi-web-ui/shared';
import { JobMarkdownContent } from './JobMarkdownContent';

interface JobsPaneProps {
  workspaceId: string;
  activeJobs: ActiveJobState[];
  onGetJobs: () => void;
  onGetJobContent: (jobPath: string) => void;
  onCreateJob: (title: string, description: string) => void;
  onSaveJob: (jobPath: string, content: string) => void;
  onPromoteJob: (jobPath: string, toPhase?: JobPhase) => void;
  onDemoteJob: (jobPath: string, toPhase?: JobPhase) => void;
  onUpdateJobTask: (jobPath: string, line: number, done: boolean) => void;
}

type ViewMode = 'list' | 'detail' | 'editor' | 'create';

const AUTOSAVE_DELAY_MS = 500;

const PHASE_LABELS: Record<JobPhase, string> = {
  executing: 'Executing',
  planning: 'Planning',
  review: 'Review',
  ready: 'Ready',
  backlog: 'Backlog',
  complete: 'Complete',
};

const PHASE_COLORS: Record<JobPhase, { bg: string; text: string }> = {
  executing: { bg: 'bg-green-500/20', text: 'text-green-400' },
  planning: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  review: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  ready: { bg: 'bg-sky-500/20', text: 'text-sky-400' },
  backlog: { bg: 'bg-pi-muted/20', text: 'text-pi-muted' },
  complete: { bg: 'bg-pi-muted/10', text: 'text-pi-muted' },
};

function PhaseBadge({ phase }: { phase: JobPhase }) {
  const c = PHASE_COLORS[phase];
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${c.bg} ${c.text}`}>
      {PHASE_LABELS[phase]}
    </span>
  );
}

/** Get the promote action label for a given phase */
function getPromoteLabel(phase: JobPhase): string | null {
  switch (phase) {
    case 'backlog': return 'Start Planning';
    case 'planning': return 'Mark Ready';
    case 'ready': return 'Start Execution';
    case 'executing': return 'Move to Review';
    case 'review': return 'Complete';
    default: return null;
  }
}

/** Get the demote action label for a given phase */
function getDemoteLabel(phase: JobPhase): string | null {
  switch (phase) {
    case 'review': return 'Back to Executing';
    case 'ready': return 'Back to Planning';
    default: return null;
  }
}

export function JobsPane({
  workspaceId,
  activeJobs: _activeJobs,
  onGetJobs,
  onGetJobContent,
  onCreateJob,
  onSaveJob,
  onPromoteJob,
  onDemoteJob,
  onUpdateJobTask,
}: JobsPaneProps) {
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobInfo | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editorContent, setEditorContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<JobPhase>>(new Set(['complete']));
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedContentRef = useRef<string>('');

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Listen for job events
  useEffect(() => {
    const handleJobsList = (e: CustomEvent<{ workspaceId: string; jobs: JobInfo[] }>) => {
      if (e.detail.workspaceId === workspaceId) {
        setJobs(e.detail.jobs);
      }
    };

    const handleJobContent = (e: CustomEvent<{ workspaceId: string; jobPath: string; content: string; job: JobInfo }>) => {
      if (e.detail.workspaceId === workspaceId) {
        setEditorContent(e.detail.content);
        lastSavedContentRef.current = e.detail.content;
        setSelectedJob(e.detail.job);
        setError(null);
      }
    };

    const handleJobSaved = (e: CustomEvent<{ workspaceId: string; jobPath: string; job: JobInfo }>) => {
      if (e.detail.workspaceId === workspaceId) {
        if (selectedJob?.path === e.detail.jobPath) {
          setSelectedJob(e.detail.job);
        }
        onGetJobs();
      }
    };

    const handleJobPromoted = (e: CustomEvent<{ workspaceId: string; jobPath: string; job: JobInfo; sessionSlotId?: string }>) => {
      if (e.detail.workspaceId === workspaceId) {
        if (selectedJob?.path === e.detail.jobPath) {
          setSelectedJob(e.detail.job);
          // Re-fetch content since promotion may have updated frontmatter
          onGetJobContent(e.detail.jobPath);
        }
        onGetJobs();
      }
    };

    const handleJobTaskUpdated = (e: CustomEvent<{ workspaceId: string; jobPath: string; job: JobInfo }>) => {
      if (e.detail.workspaceId === workspaceId) {
        if (selectedJob?.path === e.detail.jobPath) {
          setSelectedJob(e.detail.job);
          onGetJobContent(e.detail.jobPath);
        }
        onGetJobs();
      }
    };

    const handleError = (e: CustomEvent<{ message: string; workspaceId?: string }>) => {
      if (e.detail.workspaceId === workspaceId && (e.detail.message.includes('job') || e.detail.message.includes('Job'))) {
        setError(e.detail.message);
      }
    };

    window.addEventListener('pi:jobsList', handleJobsList as EventListener);
    window.addEventListener('pi:jobContent', handleJobContent as EventListener);
    window.addEventListener('pi:jobSaved', handleJobSaved as EventListener);
    window.addEventListener('pi:jobPromoted', handleJobPromoted as EventListener);
    window.addEventListener('pi:jobTaskUpdated', handleJobTaskUpdated as EventListener);
    window.addEventListener('pi:error', handleError as EventListener);

    return () => {
      window.removeEventListener('pi:jobsList', handleJobsList as EventListener);
      window.removeEventListener('pi:jobContent', handleJobContent as EventListener);
      window.removeEventListener('pi:jobSaved', handleJobSaved as EventListener);
      window.removeEventListener('pi:jobPromoted', handleJobPromoted as EventListener);
      window.removeEventListener('pi:jobTaskUpdated', handleJobTaskUpdated as EventListener);
      window.removeEventListener('pi:error', handleError as EventListener);
    };
  }, [workspaceId, selectedJob, onGetJobs, onGetJobContent]);

  // Fetch jobs on mount / workspace change
  useEffect(() => {
    onGetJobs();
  }, [workspaceId, onGetJobs]);

  // Fallback poll
  useEffect(() => {
    const interval = window.setInterval(() => {
      onGetJobs();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [onGetJobs]);

  const handleSelectJob = useCallback((job: JobInfo) => {
    setSelectedJob(job);
    setViewMode('detail');
    onGetJobContent(job.path);
  }, [onGetJobContent]);

  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setSelectedJob(null);
  }, []);

  const handleToggleTask = useCallback((task: JobTask) => {
    if (!selectedJob) return;
    onUpdateJobTask(selectedJob.path, task.line, !task.done);
  }, [selectedJob, onUpdateJobTask]);

  // Autosave for editor mode
  const handleEditorChange = useCallback((value: string) => {
    setEditorContent(value);
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    if (selectedJob && value !== lastSavedContentRef.current) {
      autosaveTimerRef.current = window.setTimeout(() => {
        onSaveJob(selectedJob.path, value);
        lastSavedContentRef.current = value;
      }, AUTOSAVE_DELAY_MS);
    }
  }, [selectedJob, onSaveJob]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const handleCreateJob = useCallback(() => {
    if (!newTitle.trim()) return;
    onCreateJob(newTitle.trim(), newDescription.trim());
    setNewTitle('');
    setNewDescription('');
    setViewMode('list');
  }, [newTitle, newDescription, onCreateJob]);

  const toggleSection = useCallback((phase: JobPhase) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  }, []);

  // Group jobs by phase
  const groupedJobs = useMemo(() => {
    const groups: Record<JobPhase, JobInfo[]> = {
      executing: [],
      planning: [],
      review: [],
      ready: [],
      backlog: [],
      complete: [],
    };
    for (const job of jobs) {
      groups[job.phase].push(job);
    }
    return groups;
  }, [jobs]);

  // ===== CREATE VIEW =====
  if (viewMode === 'create') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-pi-border">
          <button
            onClick={() => setViewMode('list')}
            className="p-1 text-pi-muted hover:text-pi-text rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
          <span className="text-[13px] sm:text-[12px] text-pi-text font-medium">New Job</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <label className="block text-[12px] sm:text-[11px] text-pi-muted mb-1">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-pi-bg border border-pi-border rounded px-2.5 py-1.5 text-[13px] sm:text-[12px] text-pi-text placeholder-pi-muted/50 focus:outline-none focus:border-pi-accent"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && newTitle.trim()) {
                  handleCreateJob();
                }
              }}
            />
          </div>
          <div>
            <label className="block text-[12px] sm:text-[11px] text-pi-muted mb-1">Description</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe the task, context, requirements..."
              className="w-full bg-pi-bg border border-pi-border rounded px-2.5 py-1.5 text-[13px] sm:text-[12px] text-pi-text placeholder-pi-muted/50 focus:outline-none focus:border-pi-accent resize-none leading-relaxed"
              rows={6}
            />
          </div>
          <button
            onClick={handleCreateJob}
            disabled={!newTitle.trim()}
            className="w-full px-3 py-2 sm:py-1.5 rounded bg-pi-accent/20 text-pi-accent hover:bg-pi-accent/30 transition-colors text-[13px] sm:text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Job
          </button>
        </div>
      </div>
    );
  }

  // ===== LIST VIEW =====
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col h-full">
        {/* New job button */}
        <div className="px-3 py-2 border-b border-pi-border">
          <button
            onClick={() => setViewMode('create')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 rounded bg-pi-accent/10 text-pi-accent hover:bg-pi-accent/20 transition-colors text-[13px] sm:text-[12px] w-full justify-center"
          >
            <Plus className="w-3.5 h-3.5" />
            New Job
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-pi-muted px-4">
            <ClipboardList className="w-8 h-8 mb-2 opacity-30" />
            <div className="text-[14px] sm:text-[12px] text-center">No jobs yet</div>
            <div className="text-[12px] sm:text-[11px] mt-1 opacity-70 text-center">
              Create a job to get started
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {JOB_PHASE_ORDER.map((phase) => {
              const phaseJobs = groupedJobs[phase];
              if (phaseJobs.length === 0) return null;
              const isCollapsed = collapsedSections.has(phase);
              const colors = PHASE_COLORS[phase];

              return (
                <div key={phase}>
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(phase)}
                    className="w-full flex items-center gap-2 px-3 py-2 sm:py-1.5 bg-pi-surface/50 border-b border-pi-border/50 hover:bg-pi-surface transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-pi-muted flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-pi-muted flex-shrink-0" />
                    )}
                    <span className={`text-[12px] sm:text-[11px] font-medium ${colors.text}`}>
                      {PHASE_LABELS[phase]}
                    </span>
                    <span className="text-[11px] sm:text-[10px] text-pi-muted">
                      {phaseJobs.length}
                    </span>
                  </button>

                  {/* Job cards */}
                  {!isCollapsed && phaseJobs.map((job) => (
                    <button
                      key={job.path}
                      onClick={() => handleSelectJob(job)}
                      className="w-full text-left px-3 py-2.5 sm:py-2 transition-colors hover:bg-pi-bg border-b border-pi-border/30"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] sm:text-[12px] text-pi-text truncate flex-1">
                          {job.title}
                        </span>
                      </div>
                      {job.taskCount > 0 && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-pi-border/30 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500/60 rounded-full transition-all"
                              style={{ width: `${(job.doneCount / job.taskCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-pi-muted flex-shrink-0">
                            {job.doneCount}/{job.taskCount}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ===== DETAIL / EDITOR VIEW =====
  const promoteLabel = selectedJob ? getPromoteLabel(selectedJob.phase) : null;
  const demoteLabel = selectedJob ? getDemoteLabel(selectedJob.phase) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-pi-border">
        <button
          onClick={handleBackToList}
          className="p-1 text-pi-muted hover:text-pi-text rounded transition-colors"
          title="Back to jobs"
        >
          <ArrowLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </button>
        <span className="text-[13px] sm:text-[12px] text-pi-text truncate flex-1">
          {selectedJob?.title}
        </span>
        {selectedJob && <PhaseBadge phase={selectedJob.phase} />}
      </div>

      {/* View mode toggle + actions */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-pi-border">
        <button
          onClick={() => setViewMode('detail')}
          className={`px-2 py-1 text-[12px] sm:text-[11px] rounded transition-colors ${
            viewMode === 'detail'
              ? 'bg-pi-bg text-pi-text'
              : 'text-pi-muted hover:text-pi-text'
          }`}
        >
          <Check className="w-3 h-3 inline mr-1" />
          View
        </button>
        <button
          onClick={() => setViewMode('editor')}
          className={`px-2 py-1 text-[12px] sm:text-[11px] rounded transition-colors ${
            viewMode === 'editor'
              ? 'bg-pi-bg text-pi-text'
              : 'text-pi-muted hover:text-pi-text'
          }`}
        >
          <Edit3 className="w-3 h-3 inline mr-1" />
          Edit
        </button>
        <div className="flex-1" />

        {/* Demote button */}
        {demoteLabel && (
          <button
            onClick={() => selectedJob && onDemoteJob(selectedJob.path)}
            className="flex items-center gap-1 px-2 py-1 text-[12px] sm:text-[11px] rounded bg-pi-muted/10 text-pi-muted hover:bg-pi-muted/20 transition-colors"
            title={demoteLabel}
          >
            <ArrowLeftCircle className="w-3 h-3" />
            <span className="hidden sm:inline">{demoteLabel}</span>
          </button>
        )}

        {/* Promote button */}
        {promoteLabel && (
          <button
            onClick={() => selectedJob && onPromoteJob(selectedJob.path)}
            className={`flex items-center gap-1 px-2 py-1 text-[12px] sm:text-[11px] rounded transition-colors ${
              selectedJob?.phase === 'backlog' || selectedJob?.phase === 'ready'
                ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                : selectedJob?.phase === 'review'
                ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                : 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20'
            }`}
            title={promoteLabel}
          >
            {(selectedJob?.phase === 'backlog' || selectedJob?.phase === 'ready') ? (
              <Play className="w-3 h-3" />
            ) : (
              <ArrowRightCircle className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">{promoteLabel}</span>
          </button>
        )}
      </div>

      {/* Progress bar */}
      {selectedJob && selectedJob.taskCount > 0 && (
        <div className="px-3 py-2 border-b border-pi-border/50">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-pi-border/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500/60 rounded-full transition-all"
                style={{ width: `${(selectedJob.doneCount / selectedJob.taskCount) * 100}%` }}
              />
            </div>
            <span className="text-[11px] text-pi-muted flex-shrink-0">
              {selectedJob.doneCount}/{selectedJob.taskCount}
            </span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-[12px] sm:text-[11px] text-red-400 flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400/60 hover:text-red-400 text-[11px]"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'detail' ? (
          // Rich markdown view with interactive checkboxes
          <div className="p-3">
            <JobMarkdownContent
              content={editorContent}
              onToggleTask={handleToggleTask}
              tasks={selectedJob?.tasks || []}
            />
          </div>
        ) : (
          // Raw editor
          <textarea
            value={editorContent}
            onChange={(e) => handleEditorChange(e.target.value)}
            className="w-full h-full bg-transparent text-pi-text text-[13px] sm:text-[12px] font-mono p-3 resize-none focus:outline-none leading-relaxed"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}
