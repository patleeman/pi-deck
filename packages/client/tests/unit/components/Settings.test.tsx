import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Settings } from '../../../src/components/Settings';
import { SettingsProvider, useSettings } from '../../../src/contexts/SettingsContext';
import { ThemeProvider } from '../../../src/contexts/ThemeContext';

// Helper component to open settings
function SettingsOpener({ shouldOpen }: { shouldOpen: boolean }) {
  const { openSettings } = useSettings();
  if (shouldOpen) {
    // Open settings on mount
    React.useEffect(() => {
      openSettings();
    }, [openSettings]);
  }
  return null;
}

import React from 'react';

// Wrapper component that provides necessary context
function TestWrapper({ children, isOpen = true }: { children: React.ReactNode; isOpen?: boolean }) {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <SettingsOpener shouldOpen={isOpen} />
        {children}
      </SettingsProvider>
    </ThemeProvider>
  );
}

describe('Settings', () => {
  const defaultProps = {
    notificationPermission: 'default' as NotificationPermission,
    onRequestNotificationPermission: vi.fn(),
    deployStatus: 'idle' as const,
    deployMessage: null,
    onDeploy: vi.fn(),
    allowedRoots: ['/Users/test', '/home/test'],
    onUpdateAllowedRoots: vi.fn(),
  };

  it('renders nothing when closed', () => {
    const { container } = render(
      <TestWrapper isOpen={false}>
        <Settings {...defaultProps} />
      </TestWrapper>
    );
    // The Settings component should not render when context says it's closed
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('renders settings title when open', () => {
    render(
      <TestWrapper isOpen={true}>
        <Settings {...defaultProps} />
      </TestWrapper>
    );
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders theme section', () => {
    render(
      <TestWrapper isOpen={true}>
        <Settings {...defaultProps} />
      </TestWrapper>
    );
    // Theme section should have Dark and Light labels
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
  });

  it('renders notifications section', () => {
    render(
      <TestWrapper isOpen={true}>
        <Settings {...defaultProps} />
      </TestWrapper>
    );
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('shows enable notifications button when permission is default', () => {
    render(
      <TestWrapper isOpen={true}>
        <Settings {...defaultProps} notificationPermission="default" />
      </TestWrapper>
    );
    expect(screen.getByText('Enable notifications')).toBeInTheDocument();
  });

  it('shows notification toggle when permission is granted', () => {
    render(
      <TestWrapper isOpen={true}>
        <Settings {...defaultProps} notificationPermission="granted" />
      </TestWrapper>
    );
    // When granted, shows a toggle with this label
    expect(screen.getByText('Enable notifications')).toBeInTheDocument();
    expect(screen.getByText('Get notified when tasks complete')).toBeInTheDocument();
  });

  it('renders deploy section', () => {
    render(
      <TestWrapper isOpen={true}>
        <Settings {...defaultProps} />
      </TestWrapper>
    );
    expect(screen.getByText('Rebuild & Restart Server')).toBeInTheDocument();
  });

  it('calls onDeploy when rebuild button is clicked', () => {
    const onDeploy = vi.fn();
    render(
      <TestWrapper isOpen={true}>
        <Settings {...defaultProps} onDeploy={onDeploy} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Rebuild & Restart Server'));
    expect(onDeploy).toHaveBeenCalledTimes(1);
  });

  it('shows building status', () => {
    render(
      <TestWrapper isOpen={true}>
        <Settings {...defaultProps} deployStatus="building" />
      </TestWrapper>
    );
    expect(screen.getByText('Building...')).toBeInTheDocument();
  });

  it('shows restarting status', () => {
    render(
      <TestWrapper isOpen={true}>
        <Settings {...defaultProps} deployStatus="restarting" />
      </TestWrapper>
    );
    expect(screen.getByText('Restarting...')).toBeInTheDocument();
  });

  it('shows error message when deploy fails', () => {
    render(
      <TestWrapper isOpen={true}>
        <Settings {...defaultProps} deployStatus="error" deployMessage="Build failed" />
      </TestWrapper>
    );
    expect(screen.getByText('Build failed')).toBeInTheDocument();
  });

  it('renders allowed directories section', () => {
    render(
      <TestWrapper isOpen={true}>
        <Settings {...defaultProps} />
      </TestWrapper>
    );
    expect(screen.getByText('Allowed Directories')).toBeInTheDocument();
    expect(screen.getByText('/Users/test')).toBeInTheDocument();
    expect(screen.getByText('/home/test')).toBeInTheDocument();
  });
});
