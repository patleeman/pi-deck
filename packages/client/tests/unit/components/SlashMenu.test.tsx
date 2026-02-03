import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlashMenu, SlashCommand } from '../../../src/components/SlashMenu';

describe('SlashMenu', () => {
  const mockCommands: SlashCommand[] = [
    { cmd: '/help', desc: 'Show available commands', action: 'help' },
    { cmd: '/clear', desc: 'Clear the conversation', action: 'clear' },
    { cmd: '/model', desc: 'Change the model', action: 'model' },
    { cmd: '/compact', desc: 'Compact the context to save tokens', action: 'compact' },
  ];

  const defaultProps = {
    commands: mockCommands,
    selectedIndex: 0,
    onSelect: vi.fn(),
  };

  it('renders all commands', () => {
    render(<SlashMenu {...defaultProps} />);
    expect(screen.getByText('/help')).toBeInTheDocument();
    expect(screen.getByText('/clear')).toBeInTheDocument();
    expect(screen.getByText('/model')).toBeInTheDocument();
    expect(screen.getByText('/compact')).toBeInTheDocument();
  });

  it('renders command descriptions', () => {
    render(<SlashMenu {...defaultProps} />);
    expect(screen.getByText('Show available commands')).toBeInTheDocument();
    expect(screen.getByText('Clear the conversation')).toBeInTheDocument();
  });

  it('truncates long descriptions', () => {
    const longDescCommand: SlashCommand[] = [
      { 
        cmd: '/test', 
        desc: 'This is a very long description that should be truncated because it exceeds fifty characters', 
        action: 'test' 
      },
    ];
    render(<SlashMenu {...defaultProps} commands={longDescCommand} />);
    // The component truncates at 47 chars + '...'
    expect(screen.getByText('This is a very long description that should be ...')).toBeInTheDocument();
  });

  it('highlights selected command', () => {
    const { container } = render(<SlashMenu {...defaultProps} selectedIndex={1} />);
    const items = container.querySelectorAll('[class*="cursor-pointer"]');
    expect(items[1].className).toContain('bg-pi-surface');
    expect(items[0].className).not.toContain('bg-pi-surface ');
  });

  it('calls onSelect when command is clicked', () => {
    const onSelect = vi.fn();
    render(<SlashMenu {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('/clear'));
    expect(onSelect).toHaveBeenCalledWith(mockCommands[1]);
  });

  it('renders empty when no commands', () => {
    const { container } = render(<SlashMenu {...defaultProps} commands={[]} />);
    const items = container.querySelectorAll('[class*="cursor-pointer"]');
    expect(items.length).toBe(0);
  });
});
