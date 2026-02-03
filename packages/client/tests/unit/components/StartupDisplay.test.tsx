import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StartupDisplay } from '../../../src/components/StartupDisplay';
import { mockStartupInfo } from '../../fixtures/messages';

describe('StartupDisplay', () => {
  beforeEach(() => {
    // Mock navigator.platform for consistent shortcut display
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });
  });

  it('renders version number', () => {
    render(<StartupDisplay startupInfo={mockStartupInfo} />);
    expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
  });

  it('renders pi branding', () => {
    render(<StartupDisplay startupInfo={mockStartupInfo} />);
    expect(screen.getByText('pi')).toBeInTheDocument();
  });

  it('renders keyboard shortcuts', () => {
    render(<StartupDisplay startupInfo={mockStartupInfo} />);
    expect(screen.getByText('⌘Enter')).toBeInTheDocument();
    expect(screen.getByText('Send message')).toBeInTheDocument();
  });

  it('renders context files section', () => {
    render(<StartupDisplay startupInfo={mockStartupInfo} />);
    expect(screen.getByText('[Context]')).toBeInTheDocument();
    expect(screen.getByText('AGENTS.md')).toBeInTheDocument();
  });

  it('renders skills section', () => {
    render(<StartupDisplay startupInfo={mockStartupInfo} />);
    expect(screen.getByText('[Skills]')).toBeInTheDocument();
  });

  it('renders extensions section', () => {
    render(<StartupDisplay startupInfo={mockStartupInfo} />);
    expect(screen.getByText('[Extensions]')).toBeInTheDocument();
  });

  it('renders themes section', () => {
    render(<StartupDisplay startupInfo={mockStartupInfo} />);
    expect(screen.getByText('[Themes]')).toBeInTheDocument();
  });

  it('shortens home directory paths', () => {
    const infoWithPath = {
      ...mockStartupInfo,
      contextFiles: ['/Users/testuser/project/AGENTS.md'],
    };
    render(<StartupDisplay startupInfo={infoWithPath} />);
    expect(screen.getByText('~/project/AGENTS.md')).toBeInTheDocument();
  });

  it('shows user scope for user items', () => {
    render(<StartupDisplay startupInfo={mockStartupInfo} />);
    const userLabels = screen.getAllByText('user');
    expect(userLabels.length).toBeGreaterThan(0);
  });

  it('shows project scope for project items', () => {
    render(<StartupDisplay startupInfo={mockStartupInfo} />);
    const projectLabels = screen.getAllByText('project');
    expect(projectLabels.length).toBeGreaterThan(0);
  });

  it('handles empty startup info gracefully', () => {
    const emptyInfo = {
      version: '1.0.0',
      contextFiles: [],
      skills: [],
      extensions: [],
      themes: [],
      shortcuts: [],
    };
    render(<StartupDisplay startupInfo={emptyInfo} />);
    expect(screen.getByText('pi')).toBeInTheDocument();
    expect(screen.queryByText('[Context]')).not.toBeInTheDocument();
    expect(screen.queryByText('[Skills]')).not.toBeInTheDocument();
  });
});
