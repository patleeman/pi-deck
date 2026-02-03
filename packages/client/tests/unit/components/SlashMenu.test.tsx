import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlashMenu, SlashCommand } from '../../../src/components/SlashMenu';

describe('SlashMenu', () => {
  const mockCommands: SlashCommand[] = [
    { cmd: '/help', desc: 'Show available commands', action: 'help' },
    { cmd: '/model', desc: 'Select a different model', action: 'model' },
    { cmd: '/compact', desc: 'Compact conversation history', action: 'compact' },
    { cmd: '/settings', desc: 'Open settings dialog', action: 'settings' },
    { cmd: '/split', desc: 'Split pane vertically', action: 'vsplit' },
  ];

  const defaultProps = {
    commands: mockCommands,
    selectedIndex: 0,
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all commands', () => {
      render(<SlashMenu {...defaultProps} />);
      
      expect(screen.getByText('/help')).toBeInTheDocument();
      expect(screen.getByText('/model')).toBeInTheDocument();
      expect(screen.getByText('/compact')).toBeInTheDocument();
      expect(screen.getByText('/settings')).toBeInTheDocument();
      expect(screen.getByText('/split')).toBeInTheDocument();
    });

    it('renders command descriptions', () => {
      render(<SlashMenu {...defaultProps} />);
      
      expect(screen.getByText('Show available commands')).toBeInTheDocument();
      expect(screen.getByText('Select a different model')).toBeInTheDocument();
    });

    it('truncates long descriptions to ~50 characters', () => {
      const longDescCommand: SlashCommand[] = [
        { 
          cmd: '/long', 
          desc: 'This is a very long description that should be truncated because it exceeds fifty characters', 
          action: 'long' 
        },
      ];
      
      render(<SlashMenu {...defaultProps} commands={longDescCommand} />);
      
      // Should show truncated version with ellipsis (47 chars + ...)
      expect(screen.getByText('This is a very long description that should be ...')).toBeInTheDocument();
    });

    it('does not truncate descriptions under 50 characters', () => {
      render(<SlashMenu {...defaultProps} />);
      
      // "Show available commands" is under 50 chars, should be complete
      expect(screen.getByText('Show available commands')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('highlights the selected command', () => {
      const { container } = render(<SlashMenu {...defaultProps} selectedIndex={2} />);
      
      const items = container.querySelectorAll('[class*="cursor-pointer"]');
      // Third item (index 2) should have bg-pi-surface class
      expect(items[2]).toHaveClass('bg-pi-surface');
    });

    it('first item is selected when selectedIndex is 0', () => {
      const { container } = render(<SlashMenu {...defaultProps} selectedIndex={0} />);
      
      const items = container.querySelectorAll('[class*="cursor-pointer"]');
      expect(items[0]).toHaveClass('bg-pi-surface');
    });

    it('non-selected items have hover state', () => {
      const { container } = render(<SlashMenu {...defaultProps} selectedIndex={0} />);
      
      const items = container.querySelectorAll('[class*="cursor-pointer"]');
      // Non-selected items should have hover style
      expect(items[1]).toHaveClass('hover:bg-pi-surface/50');
    });
  });

  describe('Interaction', () => {
    it('calls onSelect when command is clicked', () => {
      const onSelect = vi.fn();
      render(<SlashMenu {...defaultProps} onSelect={onSelect} />);
      
      fireEvent.click(screen.getByText('/model'));
      
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(mockCommands[1]);
    });

    it('calls onSelect with correct command object', () => {
      const onSelect = vi.fn();
      render(<SlashMenu {...defaultProps} onSelect={onSelect} />);
      
      fireEvent.click(screen.getByText('/compact'));
      
      expect(onSelect).toHaveBeenCalledWith({
        cmd: '/compact',
        desc: 'Compact conversation history',
        action: 'compact',
      });
    });
  });

  describe('Styling', () => {
    it('commands are styled with accent color', () => {
      const { container } = render(<SlashMenu {...defaultProps} />);
      
      const cmdElements = container.querySelectorAll('.text-pi-accent');
      expect(cmdElements.length).toBe(mockCommands.length);
    });

    it('descriptions are styled with muted color', () => {
      const { container } = render(<SlashMenu {...defaultProps} />);
      
      const descElements = container.querySelectorAll('.text-pi-muted');
      expect(descElements.length).toBe(mockCommands.length);
    });

    it('has max height with overflow scroll', () => {
      const { container } = render(<SlashMenu {...defaultProps} />);
      
      const menu = container.firstChild;
      expect(menu).toHaveClass('max-h-[200px]');
      expect(menu).toHaveClass('overflow-y-auto');
    });

    it('is positioned above input (bottom-full)', () => {
      const { container } = render(<SlashMenu {...defaultProps} />);
      
      const menu = container.firstChild;
      expect(menu).toHaveClass('bottom-full');
    });

    it('has z-index for overlay', () => {
      const { container } = render(<SlashMenu {...defaultProps} />);
      
      const menu = container.firstChild;
      expect(menu).toHaveClass('z-50');
    });
  });

  describe('Empty State', () => {
    it('renders empty menu when no commands', () => {
      const { container } = render(<SlashMenu {...defaultProps} commands={[]} />);
      
      const items = container.querySelectorAll('[class*="cursor-pointer"]');
      expect(items.length).toBe(0);
    });
  });

  describe('Command Structure', () => {
    it('each command has cmd, desc, and action properties', () => {
      mockCommands.forEach(cmd => {
        expect(cmd).toHaveProperty('cmd');
        expect(cmd).toHaveProperty('desc');
        expect(cmd).toHaveProperty('action');
        expect(cmd.cmd.startsWith('/')).toBe(true);
      });
    });
  });
});
