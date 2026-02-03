import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from '../../../src/contexts/SettingsContext';

// Test component that exposes settings
function TestConsumer() {
  const { settings, updateSettings, isSettingsOpen, openSettings, closeSettings } = useSettings();
  return (
    <div>
      <span data-testid="autoCollapseThinking">{String(settings.autoCollapseThinking)}</span>
      <span data-testid="autoCollapseTools">{String(settings.autoCollapseTools)}</span>
      <span data-testid="notificationsEnabled">{String(settings.notificationsEnabled)}</span>
      <span data-testid="isOpen">{String(isSettingsOpen)}</span>
      <button data-testid="toggle-thinking" onClick={() => updateSettings({ autoCollapseThinking: !settings.autoCollapseThinking })}>
        Toggle Thinking
      </button>
      <button data-testid="open" onClick={openSettings}>Open</button>
      <button data-testid="close" onClick={closeSettings}>Close</button>
    </div>
  );
}

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('provides default settings', () => {
    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>
    );

    expect(screen.getByTestId('autoCollapseThinking').textContent).toBe('false');
    expect(screen.getByTestId('autoCollapseTools').textContent).toBe('true');
    expect(screen.getByTestId('notificationsEnabled').textContent).toBe('true');
  });

  it('starts with settings dialog closed', () => {
    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>
    );

    expect(screen.getByTestId('isOpen').textContent).toBe('false');
  });

  it('can open settings dialog', () => {
    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>
    );

    act(() => {
      screen.getByTestId('open').click();
    });

    expect(screen.getByTestId('isOpen').textContent).toBe('true');
  });

  it('can close settings dialog', () => {
    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>
    );

    act(() => {
      screen.getByTestId('open').click();
    });
    expect(screen.getByTestId('isOpen').textContent).toBe('true');

    act(() => {
      screen.getByTestId('close').click();
    });
    expect(screen.getByTestId('isOpen').textContent).toBe('false');
  });

  it('can update settings', () => {
    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>
    );

    expect(screen.getByTestId('autoCollapseThinking').textContent).toBe('false');

    act(() => {
      screen.getByTestId('toggle-thinking').click();
    });

    expect(screen.getByTestId('autoCollapseThinking').textContent).toBe('true');
  });

  it('persists settings to localStorage', () => {
    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>
    );

    act(() => {
      screen.getByTestId('toggle-thinking').click();
    });

    const stored = localStorage.getItem('pi-settings');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.autoCollapseThinking).toBe(true);
  });

  it('loads settings from localStorage', () => {
    localStorage.setItem('pi-settings', JSON.stringify({
      autoCollapseThinking: true,
      autoCollapseTools: false,
      notificationsEnabled: false,
    }));

    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>
    );

    expect(screen.getByTestId('autoCollapseThinking').textContent).toBe('true');
    expect(screen.getByTestId('autoCollapseTools').textContent).toBe('false');
    expect(screen.getByTestId('notificationsEnabled').textContent).toBe('false');
  });

  it('handles malformed localStorage data gracefully', () => {
    localStorage.setItem('pi-settings', 'not valid json');

    // Should not throw
    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>
    );

    // Should use defaults
    expect(screen.getByTestId('autoCollapseThinking').textContent).toBe('false');
  });

  it('merges partial stored settings with defaults', () => {
    localStorage.setItem('pi-settings', JSON.stringify({
      autoCollapseThinking: true,
    }));

    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>
    );

    // Stored value
    expect(screen.getByTestId('autoCollapseThinking').textContent).toBe('true');
    // Defaults
    expect(screen.getByTestId('autoCollapseTools').textContent).toBe('true');
    expect(screen.getByTestId('notificationsEnabled').textContent).toBe('true');
  });

  it('throws error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useSettings must be used within a SettingsProvider');
    
    consoleSpy.mockRestore();
  });
});
