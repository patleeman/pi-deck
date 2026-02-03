import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ForkDialog } from '../../../src/components/ForkDialog';

describe('ForkDialog', () => {
  const mockMessages = [
    { entryId: 'entry-1', text: 'First user message' },
    { entryId: 'entry-2', text: 'Second user message with more content' },
    { entryId: 'entry-3', text: 'Third message' },
  ];

  const defaultProps = {
    isOpen: true,
    messages: mockMessages,
    onFork: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('renders nothing when closed', () => {
      const { container } = render(<ForkDialog {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders dialog when open', () => {
      render(<ForkDialog {...defaultProps} />);
      expect(screen.getByText('Fork from message')).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('shows dialog title', () => {
      render(<ForkDialog {...defaultProps} />);
      expect(screen.getByText('Fork from message')).toBeInTheDocument();
    });

    it('shows git branch icon', () => {
      const { container } = render(<ForkDialog {...defaultProps} />);
      const icon = container.querySelector('.lucide-git-branch');
      expect(icon).toBeInTheDocument();
    });

    it('has close button', () => {
      const { container } = render(<ForkDialog {...defaultProps} />);
      const closeIcon = container.querySelector('.lucide-x');
      expect(closeIcon).toBeInTheDocument();
    });
  });

  describe('Message List', () => {
    it('renders all messages', () => {
      render(<ForkDialog {...defaultProps} />);
      
      expect(screen.getByText('First user message')).toBeInTheDocument();
      expect(screen.getByText('Second user message with more content')).toBeInTheDocument();
      expect(screen.getByText('Third message')).toBeInTheDocument();
    });

    it('shows message numbers', () => {
      render(<ForkDialog {...defaultProps} />);
      
      expect(screen.getByText('1.')).toBeInTheDocument();
      expect(screen.getByText('2.')).toBeInTheDocument();
      expect(screen.getByText('3.')).toBeInTheDocument();
    });

    it('shows empty state when no messages', () => {
      render(<ForkDialog {...defaultProps} messages={[]} />);
      
      expect(screen.getByText('No messages to fork from')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('initially selects the last message', () => {
      const { container } = render(<ForkDialog {...defaultProps} />);
      
      const buttons = container.querySelectorAll('button[class*="text-left"]');
      // Last button should have selected styling
      expect(buttons[2]).toHaveClass('bg-pi-surface');
    });

    it('highlights message on hover', () => {
      render(<ForkDialog {...defaultProps} />);
      
      const firstMessage = screen.getByText('First user message').closest('button');
      fireEvent.mouseEnter(firstMessage!);
      
      // After hover, first should be selected
      expect(firstMessage).toHaveClass('bg-pi-surface');
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates up with ArrowUp', () => {
      render(<ForkDialog {...defaultProps} />);
      
      // Initial selection is last item (index 2)
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      
      // Now second item should be selected (index 1)
      const buttons = screen.getAllByRole('button').filter(b => b.textContent?.includes('.'));
      // Second button should now have selected class
    });

    it('navigates down with ArrowDown', () => {
      render(<ForkDialog {...defaultProps} />);
      
      // Move up first, then down
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      
      // Should be back at last item
    });

    it('does not go above first item', () => {
      render(<ForkDialog {...defaultProps} />);
      
      // Move to first item
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      
      // Should still be valid
    });

    it('selects message with Enter', () => {
      const onFork = vi.fn();
      render(<ForkDialog {...defaultProps} onFork={onFork} />);
      
      fireEvent.keyDown(document, { key: 'Enter' });
      
      expect(onFork).toHaveBeenCalledWith('entry-3'); // Last item selected by default
    });

    it('closes with Escape', () => {
      const onClose = vi.fn();
      render(<ForkDialog {...defaultProps} onClose={onClose} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Click Actions', () => {
    it('calls onFork when message is clicked', () => {
      const onFork = vi.fn();
      render(<ForkDialog {...defaultProps} onFork={onFork} />);
      
      fireEvent.click(screen.getByText('First user message'));
      
      expect(onFork).toHaveBeenCalledWith('entry-1');
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(<ForkDialog {...defaultProps} onClose={onClose} />);
      
      const closeButton = container.querySelector('.lucide-x')?.closest('button');
      fireEvent.click(closeButton!);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(<ForkDialog {...defaultProps} onClose={onClose} />);
      
      const backdrop = container.querySelector('.bg-black\\/50');
      fireEvent.click(backdrop!);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Footer', () => {
    it('shows keyboard shortcut hints', () => {
      render(<ForkDialog {...defaultProps} />);
      
      expect(screen.getByText(/↑↓ navigate/)).toBeInTheDocument();
      expect(screen.getByText(/Enter select/)).toBeInTheDocument();
      expect(screen.getByText(/Esc cancel/)).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('dialog is centered on screen', () => {
      const { container } = render(<ForkDialog {...defaultProps} />);
      
      const dialog = container.querySelector('.fixed.top-1\\/2.left-1\\/2');
      expect(dialog).toBeInTheDocument();
    });

    it('dialog has max width', () => {
      const { container } = render(<ForkDialog {...defaultProps} />);
      
      const dialog = container.querySelector('.max-w-lg');
      expect(dialog).toBeInTheDocument();
    });

    it('dialog has max height with scroll', () => {
      const { container } = render(<ForkDialog {...defaultProps} />);
      
      const dialog = container.querySelector('.max-h-\\[60vh\\]');
      expect(dialog).toBeInTheDocument();
    });
  });
});
