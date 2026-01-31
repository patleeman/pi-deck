import { useState } from 'react';
import type { ModelInfo, SessionState, ThinkingLevel } from '@pi-web-ui/shared';

interface HeaderProps {
  state: SessionState | null;
  models: ModelInfo[];
  onSetModel: (provider: string, modelId: string) => void;
  onSetThinkingLevel: (level: ThinkingLevel) => void;
}

const THINKING_LEVELS: { value: ThinkingLevel; label: string; icon: string }[] = [
  { value: 'off', label: 'Off', icon: '○' },
  { value: 'minimal', label: 'Minimal', icon: '◔' },
  { value: 'low', label: 'Low', icon: '◑' },
  { value: 'medium', label: 'Medium', icon: '◕' },
  { value: 'high', label: 'High', icon: '●' },
  { value: 'xhigh', label: 'XHigh', icon: '◉' },
];

export function Header({ state, models, onSetModel, onSetThinkingLevel }: HeaderProps) {
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showThinkingDropdown, setShowThinkingDropdown] = useState(false);

  const currentThinking = THINKING_LEVELS.find((t) => t.value === state?.thinkingLevel) || THINKING_LEVELS[0];

  // Group models by provider
  const modelsByProvider = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, ModelInfo[]>);

  return (
    <header className="flex-shrink-0 border-b border-pi-border bg-pi-surface px-3 py-1">
      <div className="flex items-center justify-between">
        {/* Logo and title */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-pi-accent font-mono">π</span>
          <span className="text-pi-muted">/</span>
          <span className="text-pi-text">pi-web-ui</span>
        </div>

        {/* Model and thinking controls */}
        <div className="flex items-center gap-2 text-sm">
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowModelDropdown(!showModelDropdown);
                setShowThinkingDropdown(false);
              }}
              className="flex items-center gap-1 px-2 py-0.5 bg-pi-bg border border-pi-border hover:border-pi-accent/50 font-mono text-sm"
            >
              <span className="text-pi-accent">⚡</span>
              <span>{state?.model?.name || 'No model'}</span>
              <span className="text-pi-muted">▾</span>
            </button>

            {showModelDropdown && (
              <div className="absolute right-0 top-full mt-0.5 w-64 bg-pi-surface border border-pi-border z-50 max-h-80 overflow-y-auto">
                {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                  <div key={provider}>
                    <div className="px-2 py-1 text-xs text-pi-muted border-b border-pi-border bg-pi-bg/50 font-mono">
                      {provider}
                    </div>
                    {providerModels.map((model) => (
                      <button
                        key={`${model.provider}-${model.id}`}
                        onClick={() => {
                          onSetModel(model.provider, model.id);
                          setShowModelDropdown(false);
                        }}
                        className={`w-full text-left px-2 py-1 hover:bg-pi-bg transition-colors flex items-center justify-between font-mono text-sm ${
                          state?.model?.id === model.id ? 'bg-pi-accent/10 text-pi-accent' : ''
                        }`}
                      >
                        <span>{model.name}</span>
                        <span className="text-xs text-pi-muted">
                          {model.reasoning && '🧠 '}
                          {Math.round(model.contextWindow / 1000)}k
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Thinking level selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowThinkingDropdown(!showThinkingDropdown);
                setShowModelDropdown(false);
              }}
              className="flex items-center gap-1 px-2 py-0.5 bg-pi-bg border border-pi-border hover:border-pi-accent/50 font-mono text-sm"
            >
              <span className="text-pi-accent">{currentThinking.icon}</span>
              <span>{currentThinking.label}</span>
              <span className="text-pi-muted">▾</span>
            </button>

            {showThinkingDropdown && (
              <div className="absolute right-0 top-full mt-0.5 w-32 bg-pi-surface border border-pi-border z-50">
                {THINKING_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => {
                      onSetThinkingLevel(level.value);
                      setShowThinkingDropdown(false);
                    }}
                    className={`w-full text-left px-2 py-1 hover:bg-pi-bg transition-colors flex items-center justify-between font-mono text-sm ${
                      state?.thinkingLevel === level.value ? 'bg-pi-accent/10 text-pi-accent' : ''
                    }`}
                  >
                    <span>{level.icon} {level.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
