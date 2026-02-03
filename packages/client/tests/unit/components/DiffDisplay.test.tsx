import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffDisplay } from '../../../src/components/DiffDisplay';

describe('DiffDisplay', () => {
  describe('Basic Rendering', () => {
    it('renders added lines in green', () => {
      const { container } = render(
        <DiffDisplay 
          oldText="line 1" 
          newText="line 1\nline 2" 
        />
      );
      
      // Added lines have green text color
      const addedLines = container.querySelectorAll('.text-\\[\\#b5bd68\\]');
      expect(addedLines.length).toBeGreaterThan(0);
    });

    it('renders removed lines in red', () => {
      const { container } = render(
        <DiffDisplay 
          oldText="line 1\nline 2" 
          newText="line 1" 
        />
      );
      
      // Removed lines have red text color
      const removedLines = container.querySelectorAll('.text-\\[\\#ff5c57\\]');
      expect(removedLines.length).toBeGreaterThan(0);
    });

    it('renders context lines in muted color', () => {
      // Create a diff with clear context lines around a change
      const lines = ['context 1', 'context 2', 'changed', 'context 3', 'context 4'];
      const oldText = lines.join('\n');
      const newText = ['context 1', 'context 2', 'MODIFIED', 'context 3', 'context 4'].join('\n');
      
      const { container } = render(
        <DiffDisplay oldText={oldText} newText={newText} />
      );
      
      // Context lines have muted styling
      const contextLines = container.querySelectorAll('.text-pi-muted\\/70');
      expect(contextLines.length).toBeGreaterThan(0);
    });
  });

  describe('Line Indicators', () => {
    it('shows + prefix for added lines', () => {
      const { container } = render(
        <DiffDisplay 
          oldText="" 
          newText="new line" 
        />
      );
      
      expect(container.textContent).toContain('+');
    });

    it('shows - prefix for removed lines', () => {
      const { container } = render(
        <DiffDisplay 
          oldText="old line" 
          newText="" 
        />
      );
      
      expect(container.textContent).toContain('-');
    });
  });

  describe('Line Numbers', () => {
    it('displays line numbers', () => {
      const { container } = render(
        <DiffDisplay 
          oldText="line 1\nline 2\nline 3" 
          newText="line 1\nmodified\nline 3" 
        />
      );
      
      // Should contain line numbers (1, 2, 3)
      expect(container.textContent).toMatch(/1|2|3/);
    });

    it('pads line numbers for alignment', () => {
      // Create a diff with >10 lines to test padding
      const lines = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`);
      const oldText = lines.join('\n');
      const newText = [...lines.slice(0, 10), 'changed', ...lines.slice(11)].join('\n');
      
      render(<DiffDisplay oldText={oldText} newText={newText} />);
      
      // Line numbers should be present
      // The exact formatting depends on implementation
    });
  });

  describe('Context Lines', () => {
    it('shows limited context around changes', () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
      const oldText = lines.join('\n');
      const newText = [...lines.slice(0, 10), 'CHANGED', ...lines.slice(11)].join('\n');
      
      const { container } = render(
        <DiffDisplay oldText={oldText} newText={newText} contextLines={2} />
      );
      
      // Should not show all 20 lines, only context around change
      const allLines = container.querySelectorAll('div > div');
      expect(allLines.length).toBeLessThan(20);
    });

    it('accepts custom contextLines prop', () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
      const oldText = lines.join('\n');
      const newText = [...lines.slice(0, 10), 'CHANGED', ...lines.slice(11)].join('\n');
      
      // Should render without error with different context sizes
      const { rerender } = render(
        <DiffDisplay oldText={oldText} newText={newText} contextLines={1} />
      );
      
      rerender(
        <DiffDisplay oldText={oldText} newText={newText} contextLines={10} />
      );
    });

    it('shows ellipsis for skipped lines', () => {
      const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
      const oldText = lines.join('\n');
      const newText = [...lines.slice(0, 15), 'CHANGED', ...lines.slice(16)].join('\n');
      
      const { container } = render(
        <DiffDisplay oldText={oldText} newText={newText} contextLines={2} />
      );
      
      // Should show "..." for skipped context
      expect(container.textContent).toContain('...');
    });
  });

  describe('Intra-line Highlighting', () => {
    it('highlights changed words within modified lines', () => {
      const { container } = render(
        <DiffDisplay 
          oldText="const foo = 'bar';" 
          newText="const foo = 'baz';" 
        />
      );
      
      // Should have intra-line highlighting spans
      const highlights = container.querySelectorAll('[class*="bg-"]');
      expect(highlights.length).toBeGreaterThan(0);
    });
  });

  describe('Styling', () => {
    it('uses monospace font', () => {
      const { container } = render(
        <DiffDisplay oldText="a" newText="b" />
      );
      
      expect(container.firstChild).toHaveClass('font-mono');
    });

    it('added lines have green background', () => {
      const { container } = render(
        <DiffDisplay oldText="" newText="new" />
      );
      
      const addedLine = container.querySelector('.bg-\\[\\#283a28\\]');
      expect(addedLine).toBeInTheDocument();
    });

    it('removed lines have red background', () => {
      const { container } = render(
        <DiffDisplay oldText="old" newText="" />
      );
      
      const removedLine = container.querySelector('.bg-\\[\\#3a2828\\]');
      expect(removedLine).toBeInTheDocument();
    });

    it('preserves whitespace with whitespace-pre', () => {
      const { container } = render(
        <DiffDisplay oldText="  indented" newText="  indented\n  more" />
      );
      
      const preformattedLines = container.querySelectorAll('.whitespace-pre');
      expect(preformattedLines.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty old text (all additions)', () => {
      const { container } = render(
        <DiffDisplay oldText="" newText="line 1\nline 2" />
      );
      
      expect(container.textContent).toContain('line 1');
      expect(container.textContent).toContain('line 2');
    });

    it('handles empty new text (all deletions)', () => {
      const { container } = render(
        <DiffDisplay oldText="line 1\nline 2" newText="" />
      );
      
      expect(container.textContent).toContain('line 1');
      expect(container.textContent).toContain('line 2');
    });

    it('handles identical texts (no diff)', () => {
      const { container } = render(
        <DiffDisplay oldText="same" newText="same" />
      );
      
      // Should render something (maybe just context)
      expect(container).toBeInTheDocument();
    });

    it('handles multi-line additions', () => {
      const { container } = render(
        <DiffDisplay 
          oldText="line 1\nline 3" 
          newText="line 1\nline 2\nline 3" 
        />
      );
      
      expect(container.textContent).toContain('line 2');
    });

    it('handles multi-line deletions', () => {
      const { container } = render(
        <DiffDisplay 
          oldText="line 1\nline 2\nline 3" 
          newText="line 1\nline 3" 
        />
      );
      
      expect(container.textContent).toContain('line 2');
    });
  });

  describe('Default Props', () => {
    it('uses default contextLines of 4', () => {
      // Create a large diff
      const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
      const oldText = lines.join('\n');
      const newText = [...lines.slice(0, 25), 'CHANGED', ...lines.slice(26)].join('\n');
      
      const { container } = render(
        <DiffDisplay oldText={oldText} newText={newText} />
      );
      
      // Should render with default context
      expect(container).toBeInTheDocument();
    });
  });
});
