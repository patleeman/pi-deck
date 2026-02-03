import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HotkeysDialog } from '../../../src/components/HotkeysDialog';

describe('HotkeysDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  it('renders nothing when closed', () => {
    const { container } = render(<HotkeysDialog isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open', () => {
    render(<HotkeysDialog {...defaultProps} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('renders all hotkey categories', () => {
    render(<HotkeysDialog {...defaultProps} />);
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Models & Thinking')).toBeInTheDocument();
    expect(screen.getByText('Display')).toBeInTheDocument();
    expect(screen.getByText('Session')).toBeInTheDocument();
    expect(screen.getByText('Panes')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
  });

  it('renders hotkey descriptions', () => {
    render(<HotkeysDialog {...defaultProps} />);
    expect(screen.getByText('Send message')).toBeInTheDocument();
    expect(screen.getByText('Clear input')).toBeInTheDocument();
  });

  it('renders keyboard shortcuts', () => {
    render(<HotkeysDialog {...defaultProps} />);
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('Escape')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+L')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<HotkeysDialog isOpen={true} onClose={onClose} />);
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<HotkeysDialog isOpen={true} onClose={onClose} />);
    const backdrop = container.querySelector('.bg-black\\/50');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<HotkeysDialog isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders footer with slash command hint', () => {
    render(<HotkeysDialog {...defaultProps} />);
    expect(screen.getByText(/to see all slash commands/)).toBeInTheDocument();
  });
});
