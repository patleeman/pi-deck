import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceTabs } from '../../../src/components/WorkspaceTabs';

describe('WorkspaceTabs', () => {
  const mockTabs = [
    { id: 'ws-1', name: 'project1', path: '/path/to/project1', isStreaming: false, messageCount: 10 },
    { id: 'ws-2', name: 'project2', path: '/path/to/project2', isStreaming: true, messageCount: 5 },
    { id: 'ws-3', name: 'project3', path: '/path/to/project3', isStreaming: false, messageCount: 0, needsAttention: true },
  ];

  const defaultProps = {
    tabs: mockTabs,
    activeId: 'ws-1',
    onSelect: vi.fn(),
    onClose: vi.fn(),
    onOpenBrowser: vi.fn(),
  };

  it('renders all workspace tabs', () => {
    render(<WorkspaceTabs {...defaultProps} />);
    expect(screen.getByText('project1')).toBeInTheDocument();
    expect(screen.getByText('project2')).toBeInTheDocument();
    expect(screen.getByText('project3')).toBeInTheDocument();
  });

  it('shows streaming indicator for streaming workspaces', () => {
    const { container } = render(<WorkspaceTabs {...defaultProps} />);
    const streamingIndicators = container.querySelectorAll('.status-running');
    expect(streamingIndicators.length).toBe(1);
  });

  it('shows attention indicator for workspaces needing attention', () => {
    const { container } = render(<WorkspaceTabs {...defaultProps} />);
    // Should have 2 indicators: 1 streaming + 1 needs attention
    const indicators = container.querySelectorAll('.bg-pi-success');
    expect(indicators.length).toBe(2);
  });

  it('calls onSelect when tab is clicked', () => {
    const onSelect = vi.fn();
    render(<WorkspaceTabs {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('project2'));
    expect(onSelect).toHaveBeenCalledWith('ws-2');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<WorkspaceTabs {...defaultProps} onClose={onClose} />);
    const closeButtons = screen.getAllByRole('button').filter(btn => btn.title === 'Close workspace');
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledWith('ws-1');
  });

  it('does not call onSelect when close button is clicked', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<WorkspaceTabs {...defaultProps} onSelect={onSelect} onClose={onClose} />);
    const closeButtons = screen.getAllByRole('button').filter(btn => btn.title === 'Close workspace');
    fireEvent.click(closeButtons[0]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onOpenBrowser when add button is clicked', () => {
    const onOpenBrowser = vi.fn();
    render(<WorkspaceTabs {...defaultProps} onOpenBrowser={onOpenBrowser} />);
    fireEvent.click(screen.getByText('+'));
    expect(onOpenBrowser).toHaveBeenCalledTimes(1);
  });

  it('highlights active tab', () => {
    render(<WorkspaceTabs {...defaultProps} activeId="ws-2" />);
    const project2Button = screen.getByText('project2').closest('button');
    expect(project2Button?.className).toContain('border-pi-border-focus');
  });

  it('renders empty state with just add button', () => {
    render(<WorkspaceTabs {...defaultProps} tabs={[]} />);
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.queryByText('project1')).not.toBeInTheDocument();
  });

  it('shows path in title attribute', () => {
    render(<WorkspaceTabs {...defaultProps} />);
    const tab = screen.getByText('project1').closest('button');
    expect(tab?.title).toBe('/path/to/project1');
  });
});
