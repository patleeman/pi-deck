import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, within } from '@testing-library/react';
import { renderWithProviders as render } from '../../utils/render';
import { Pane } from '../../../src/components/Pane';
import type { PaneData } from '../../../src/hooks/usePanes';
import type { SessionSlotState } from '../../../src/hooks/useWorkspaces';

const mockSlot: SessionSlotState = {
  slotId: 'default',
  state: {
    currentModel: { provider: 'anthropic', id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
    contextUsage: { used: 1000, total: 200000, percentage: 0.5 },
    thinkingLevel: 'off',
    isStreaming: false,
    isCompacting: false,
    autoCompactionEnabled: true,
    autoRetryEnabled: true,
    steeringMode: 'interrupt',
    followUpMode: 'instant',
  },
  messages: [],
  commands: [],
  isStreaming: false,
  streamingText: '',
  streamingThinking: '',
  activeToolExecutions: [],
  bashExecution: null,
  questionnaireRequest: null,
  extensionUIRequest: null,
  customUIState: null,
  queuedMessages: { steering: [], followUp: [] },
};

const mockModels = [
  { provider: 'anthropic', id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
  { provider: 'anthropic', id: 'claude-opus-4', name: 'Claude Opus 4' },
  { provider: 'openai', id: 'gpt-4o', name: 'GPT-4o' },
  { provider: 'openai', id: 'o3', name: 'o3' },
  { provider: 'google', id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
];

const mockPaneData: PaneData = {
  id: 'pane-1',
  sessionSlotId: 'default',
  slot: mockSlot,
};

const defaultProps = {
  pane: mockPaneData,
  isFocused: true,
  sessions: [{ id: 'session-1', name: 'Session 1', isActive: true, messageCount: 0 }],
  models: mockModels,
  backendCommands: [],
  startupInfo: null,
  activeJobs: [],
  canClose: true,
  onFocus: vi.fn(),
  onClose: vi.fn(),
  onSendPrompt: vi.fn(),
  onSteer: vi.fn(),
  onAbort: vi.fn(),
  onLoadSession: vi.fn(),
  onNewSession: vi.fn(),
  onSplit: vi.fn(),
  onGetForkMessages: vi.fn(),
  onFork: vi.fn(),
  onSetModel: vi.fn(),
  onSetThinkingLevel: vi.fn(),
  onQuestionnaireResponse: vi.fn(),
  onExtensionUIResponse: vi.fn(),
  onCustomUIInput: vi.fn(),
  onCompact: vi.fn(),
  onOpenSettings: vi.fn(),
  onExport: vi.fn(),
  onRenameSession: vi.fn(),
  onShowHotkeys: vi.fn(),
  onFollowUp: vi.fn(),
  onReload: vi.fn(),
  onGetSessionTree: vi.fn(),
  onCopyLastAssistant: vi.fn(),
  onGetQueuedMessages: vi.fn(),
  onClearQueue: vi.fn(),
  onListFiles: vi.fn(),
  onExecuteBash: vi.fn(),
  onToggleAllToolsCollapsed: vi.fn(),
  onToggleAllThinkingCollapsed: vi.fn(),
  onGetScopedModels: vi.fn(),
  onSetScopedModels: vi.fn(),
  activePlan: null,
  onUpdatePlanTask: vi.fn(),
  onDeactivatePlan: vi.fn(),
};

/** Click the model selector button (the one showing ⚡ + model name) to open the dropdown */
function openModelMenu(container: HTMLElement) {
  // Find the button that contains the ⚡ icon and model name
  const buttons = Array.from(container.querySelectorAll('button'));
  const modelButton = buttons.find(b => b.textContent?.includes('⚡'));
  expect(modelButton).toBeTruthy();
  fireEvent.click(modelButton!);
}

/** Get the filter input inside the open model dropdown */
function getFilterInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[placeholder="Filter models..."]') as HTMLInputElement;
  expect(input).toBeTruthy();
  return input;
}

/** Get all visible model item buttons in the dropdown */
function getModelItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-model-item]'));
}

describe('Model Picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens model dropdown with filter input on click', () => {
    const { container } = render(<Pane {...defaultProps} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    expect(input).toBeTruthy();
    expect(getModelItems(container)).toHaveLength(5);
  });

  it('filters models by name', () => {
    const { container } = render(<Pane {...defaultProps} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    fireEvent.change(input, { target: { value: 'claude' } });

    const items = getModelItems(container);
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Claude Sonnet 4');
    expect(items[1].textContent).toContain('Claude Opus 4');
  });

  it('filters models by provider', () => {
    const { container } = render(<Pane {...defaultProps} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    fireEvent.change(input, { target: { value: 'openai' } });

    const items = getModelItems(container);
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('GPT-4o');
    expect(items[1].textContent).toContain('o3');
  });

  it('shows "No models match" for non-matching filter', () => {
    const { container } = render(<Pane {...defaultProps} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    fireEvent.change(input, { target: { value: 'zzzzz' } });

    expect(getModelItems(container)).toHaveLength(0);
    expect(container.textContent).toContain('No models match');
  });

  it('filter is case-insensitive', () => {
    const { container } = render(<Pane {...defaultProps} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    fireEvent.change(input, { target: { value: 'GEMINI' } });

    const items = getModelItems(container);
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Gemini 2.5 Pro');
  });

  it('selects highlighted model on Enter', () => {
    const onSetModel = vi.fn();
    const { container } = render(<Pane {...defaultProps} onSetModel={onSetModel} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    // First item is highlighted by default
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSetModel).toHaveBeenCalledWith('anthropic', 'claude-sonnet-4');
  });

  it('navigates down with ArrowDown and selects with Enter', () => {
    const onSetModel = vi.fn();
    const { container } = render(<Pane {...defaultProps} onSetModel={onSetModel} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    // Move down twice: index 0 -> 1 -> 2
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSetModel).toHaveBeenCalledWith('openai', 'gpt-4o');
  });

  it('navigates up with ArrowUp', () => {
    const onSetModel = vi.fn();
    const { container } = render(<Pane {...defaultProps} onSetModel={onSetModel} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    // Move down 3, then up 1 => index 2
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSetModel).toHaveBeenCalledWith('openai', 'gpt-4o');
  });

  it('ArrowUp does not go below 0', () => {
    const onSetModel = vi.fn();
    const { container } = render(<Pane {...defaultProps} onSetModel={onSetModel} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    // Try to go up from 0
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Should stay at first item
    expect(onSetModel).toHaveBeenCalledWith('anthropic', 'claude-sonnet-4');
  });

  it('ArrowDown does not exceed list length', () => {
    const onSetModel = vi.fn();
    const { container } = render(<Pane {...defaultProps} onSetModel={onSetModel} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    // Press down way more than 5 items
    for (let i = 0; i < 20; i++) {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    }
    fireEvent.keyDown(input, { key: 'Enter' });

    // Should be last item
    expect(onSetModel).toHaveBeenCalledWith('google', 'gemini-2.5-pro');
  });

  it('resets highlight when filter changes', () => {
    const onSetModel = vi.fn();
    const { container } = render(<Pane {...defaultProps} onSetModel={onSetModel} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    // Navigate down
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // Type filter — should reset highlight to 0
    fireEvent.change(input, { target: { value: 'gpt' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSetModel).toHaveBeenCalledWith('openai', 'gpt-4o');
  });

  it('arrow keys navigate filtered results', () => {
    const onSetModel = vi.fn();
    const { container } = render(<Pane {...defaultProps} onSetModel={onSetModel} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    fireEvent.change(input, { target: { value: 'claude' } });

    // Move down once within filtered list (2 items)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSetModel).toHaveBeenCalledWith('anthropic', 'claude-opus-4');
  });

  it('closes dropdown on Escape', () => {
    const { container } = render(<Pane {...defaultProps} />);
    openModelMenu(container);

    const input = getFilterInput(container);
    expect(input).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Escape' });

    // Filter input should be gone
    const inputAfter = container.querySelector('input[placeholder="Filter models..."]');
    expect(inputAfter).toBeNull();
  });

  it('selects model on click', () => {
    const onSetModel = vi.fn();
    const { container } = render(<Pane {...defaultProps} onSetModel={onSetModel} />);
    openModelMenu(container);

    const items = getModelItems(container);
    fireEvent.click(items[2]); // GPT-4o

    expect(onSetModel).toHaveBeenCalledWith('openai', 'gpt-4o');
  });

  it('highlights item on mouse enter', () => {
    const onSetModel = vi.fn();
    const { container } = render(<Pane {...defaultProps} onSetModel={onSetModel} />);
    openModelMenu(container);

    const items = getModelItems(container);
    // Hover over 4th item (o3), then press Enter on the input
    fireEvent.mouseEnter(items[3]);

    const input = getFilterInput(container);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSetModel).toHaveBeenCalledWith('openai', 'o3');
  });
});
