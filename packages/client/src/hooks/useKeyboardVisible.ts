import { useState, useEffect } from 'react';

/**
 * Detects when the virtual keyboard is open on mobile devices.
 * Uses the Visual Viewport API to detect viewport height changes.
 * Also sets --viewport-height CSS variable for proper mobile viewport handling.
 * Returns true when the keyboard is likely visible.
 * 
 * On iOS Safari, when the keyboard opens:
 * 1. The browser scrolls the page up rather than resizing the viewport
 * 2. visualViewport.height reflects the actual visible area
 * 3. We need to set both the height AND offset to position content correctly
 */
export function useKeyboardVisible(): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    
    // Set the CSS variables for viewport height and offset
    const updateViewportHeight = () => {
      if (viewport) {
        // Use visualViewport for accurate height on mobile
        document.documentElement.style.setProperty('--viewport-height', `${viewport.height}px`);
        // The offset tells us how much the viewport has been scrolled/pushed up by the keyboard
        document.documentElement.style.setProperty('--viewport-offset', `${viewport.offsetTop}px`);
      } else {
        document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
        document.documentElement.style.setProperty('--viewport-offset', '0px');
      }
    };

    // Initial setup - always set the height
    updateViewportHeight();

    // Only set up keyboard detection on touch devices
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice || !viewport) {
      // For non-touch devices, just listen for window resize
      window.addEventListener('resize', updateViewportHeight);
      return () => window.removeEventListener('resize', updateViewportHeight);
    }

    // Store initial viewport height to detect keyboard
    let initialHeight = viewport.height;
    let orientationTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleViewportChange = () => {
      // Update CSS variables for actual viewport height and offset
      updateViewportHeight();

      // If viewport height decreased significantly (>150px), keyboard is likely open
      // We use a threshold because small changes can happen from address bar, etc.
      const heightDiff = initialHeight - viewport.height;
      const isOpen = heightDiff > 150;
      setIsKeyboardVisible(isOpen);
    };

    // Update initial height when orientation changes
    const handleOrientationChange = () => {
      // Clear any existing timeout
      if (orientationTimeout) {
        clearTimeout(orientationTimeout);
      }
      // Wait for viewport to settle after orientation change
      orientationTimeout = setTimeout(() => {
        initialHeight = viewport.height;
        updateViewportHeight();
        setIsKeyboardVisible(false);
        orientationTimeout = null;
      }, 300);
    };

    // Listen for both resize and scroll events on visual viewport
    // Some browsers scroll the viewport instead of resizing it
    viewport.addEventListener('resize', handleViewportChange);
    viewport.addEventListener('scroll', handleViewportChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      viewport.removeEventListener('resize', handleViewportChange);
      viewport.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (orientationTimeout) {
        clearTimeout(orientationTimeout);
      }
    };
  }, []);

  return isKeyboardVisible;
}
