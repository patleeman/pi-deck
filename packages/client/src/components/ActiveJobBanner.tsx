import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Briefcase } from 'lucide-react';
import type { ActiveJobState, JobPhase } from '@pi-deck/shared';

interface ActiveJobBannerProps {
  activeJob: ActiveJobState;
  onToggleTask: (jobPath: string, line: number, done: boolean) => void;
}

const PHASE_LABELS: Record<JobPhase, string> = {
  executing: 'Executing',
  planning: 'Planning',
  review: 'Review',
  ready: 'Ready',
  backlog: 'Backlog',
  complete: 'Complete',
};

const PHASE_ICON_COLORS: Record<JobPhase, string> = {
  executing: 'text-green-400',
  planning: 'text-amber-400',
  review: 'text-purple-400',
  ready: 'text-sky-400',
  backlog: 'text-pi-muted',
  complete: 'text-pi-muted',
};

const PHASE_BAR_COLORS: Record<JobPhase, string> = {
  executing: 'bg-green-500/60',
  planning: 'bg-amber-500/60',
  review: 'bg-purple-500/60',
  ready: 'bg-sky-500/60',
  backlog: 'bg-pi-muted/60',
  complete: 'bg-pi-muted/60',
};

const PHASE_BADGE_STYLES: Record<JobPhase, string> = {
  executing: 'bg-green-500/20 text-green-400',
  planning: 'bg-amber-500/20 text-amber-400',
  review: 'bg-purple-500/20 text-purple-400',
  ready: 'bg-sky-500/20 text-sky-400',
  backlog: 'bg-pi-muted/20 text-pi-muted',
  complete: 'bg-pi-muted/10 text-pi-muted',
};

export function ActiveJobBanner({ activeJob, onToggleTask }: ActiveJobBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const { title, phase, tasks, taskCount, doneCount, jobPath } = activeJob;
  const progressPercent = taskCount > 0 ? (doneCount / taskCount) * 100 : 0;
  const iconColor = PHASE_ICON_COLORS[phase];
  const barColor = PHASE_BAR_COLORS[phase];

  return (
    <div className="border-t border-pi-border bg-pi-surface/50">
      {/* Compact header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-pi-bg/50 transition-colors"
      >
        <Briefcase className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0`} />
        <span className="text-[12px] sm:text-[11px] text-pi-text truncate flex-1">{title}</span>
        <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded flex-shrink-0 ${PHASE_BADGE_STYLES[phase]}`}>
          {PHASE_LABELS[phase]}
        </span>
        {taskCount > 0 && (
          <>
            <span className="text-[11px] text-pi-muted flex-shrink-0">{doneCount}/{taskCount}</span>
            <div className="w-16 h-1 bg-pi-border/30 rounded-full overflow-hidden flex-shrink-0">
              <div
                className={`h-full ${barColor} rounded-full transition-all`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        )}
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-pi-muted flex-shrink-0" />
        ) : (
          <ChevronUp className="w-3 h-3 text-pi-muted flex-shrink-0" />
        )}
      </button>

      {/* Expandable task list */}
      {expanded && tasks.length > 0 && (
        <div className="border-t border-pi-border/50 max-h-48 overflow-y-auto">
          {tasks.map((task, i) => (
            <button
              key={`${task.line}-${i}`}
              onClick={() => onToggleTask(jobPath, task.line, !task.done)}
              className="w-full text-left px-3 py-1.5 sm:py-1 flex items-center gap-2 hover:bg-pi-bg/50 transition-colors active:bg-pi-bg/70"
              style={{ paddingLeft: `${task.depth * 12 + 12}px` }}
            >
              <span className={`flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                task.done
                  ? 'bg-green-500/20 border-green-500/40 text-green-400'
                  : 'border-pi-border hover:border-pi-accent'
              }`}>
                {task.done && <Check className="w-2.5 h-2.5" />}
              </span>
              <span className={`text-[12px] sm:text-[11px] truncate ${
                task.done ? 'text-pi-muted line-through' : 'text-pi-text'
              }`}>
                {task.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
