import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardVisible } from '../../../src/hooks/useKeyboardVisible';

describe('useKeyboardVisible', () => {
  let mockVisualViewport: {
    height: number;
    offsetTop: number;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockVisualViewport = {
      height: 800,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Mock visualViewport
    Object.defineProperty(window, 'visualViewport', {
      value: mockVisualViewport,
      writable: true,
      configurable: true,
    });

    // Mock touch device
    Object.defineProperty(window, 'ontouchstart', {
      value: () => {},
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false initially', () => {
    const { result } = renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);
  });

  it('sets up visual viewport event listeners on touch devices', () => {
    renderHook(() => useKeyboardVisible());
    
    expect(mockVisualViewport.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(mockVisualViewport.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardVisible());
    
    unmount();
    
    expect(mockVisualViewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(mockVisualViewport.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('sets --viewport-height CSS variable', () => {
    renderHook(() => useKeyboardVisible());
    
    const viewportHeight = document.documentElement.style.getPropertyValue('--viewport-height');
    expect(viewportHeight).toBe('800px');
  });

  it('does not detect keyboard as visible for small viewport changes', () => {
    const { result } = renderHook(() => useKeyboardVisible());
    
    // Simulate small viewport change (like address bar hiding)
    mockVisualViewport.height = 750; // Only 50px difference
    
    // Get the resize handler and call it
    const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
      call => call[0] === 'resize'
    )?.[1];
    
    if (resizeHandler) {
      act(() => {
        resizeHandler();
      });
    }
    
    // Should still be false because change is small
    expect(result.current).toBe(false);
  });

  it('works on non-touch devices without visualViewport', () => {
    // Remove touch detection
    // @ts-ignore
    delete window.ontouchstart;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
    
    // Render should not throw
    const { result } = renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);
  });

  it('works when visualViewport is undefined', () => {
    Object.defineProperty(window, 'visualViewport', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    
    const { result } = renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);
  });

  it('updates viewport height on resize', () => {
    renderHook(() => useKeyboardVisible());
    
    // Simulate resize
    mockVisualViewport.height = 600;
    
    const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
      call => call[0] === 'resize'
    )?.[1];
    
    if (resizeHandler) {
      act(() => {
        resizeHandler();
      });
    }
    
    const viewportHeight = document.documentElement.style.getPropertyValue('--viewport-height');
    expect(viewportHeight).toBe('600px');
  });

  it('sets --viewport-offset CSS variable for iOS keyboard handling', () => {
    mockVisualViewport.offsetTop = 100;
    renderHook(() => useKeyboardVisible());
    
    const viewportOffset = document.documentElement.style.getPropertyValue('--viewport-offset');
    expect(viewportOffset).toBe('100px');
  });

  it('updates viewport offset when keyboard opens (iOS Safari behavior)', () => {
    renderHook(() => useKeyboardVisible());
    
    // Simulate iOS Safari behavior: keyboard opens, viewport scrolls up
    mockVisualViewport.height = 400; // Significantly reduced
    mockVisualViewport.offsetTop = 200; // Viewport pushed down
    
    const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
      call => call[0] === 'resize'
    )?.[1];
    
    if (resizeHandler) {
      act(() => {
        resizeHandler();
      });
    }
    
    // Both CSS variables should be updated
    expect(document.documentElement.style.getPropertyValue('--viewport-height')).toBe('400px');
    expect(document.documentElement.style.getPropertyValue('--viewport-offset')).toBe('200px');
  });
});
