import { useEffect, useRef } from 'react';

/**
 * Debug utility to monitor component re-renders
 * Use temporarily to identify excessive rendering
 */
export function useRenderMonitor(componentName: string, props?: Record<string, unknown>) {
  const renderCount = useRef(0);
  const lastProps = useRef(props);
  const lastTime = useRef(Date.now());

  renderCount.current++;
  const now = Date.now();
  const timeSinceLastRender = now - lastTime.current;

  // Check which props changed
  const propChanges: string[] = [];
  if (props && lastProps.current) {
    for (const key of Object.keys(props)) {
      if (props[key] !== lastProps.current[key]) {
        propChanges.push(key);
      }
    }
  }

  // Log if rendering more than 10 times/sec or props changed frequently
  if (renderCount.current > 1 && (timeSinceLastRender < 100 || propChanges.length > 0)) {
    console.warn(
      `[RenderMonitor] ${componentName} rendered #${renderCount.current} ` +
      `(${timeSinceLastRender}ms since last) ` +
      `${propChanges.length > 0 ? `[changed: ${propChanges.join(', ')}]` : '[no prop changes]'}`
    );
  }

  lastProps.current = props;
  lastTime.current = now;

  useEffect(() => {
    return () => {
      console.log(`[RenderMonitor] ${componentName} unmounted after ${renderCount.current} renders`);
    };
  }, [componentName]);
}

/**
 * Track animation frame usage
 */
export function trackAnimationFrames(label: string) {
  let frameCount = 0;
  let startTime = performance.now();
  let rafId: number;

  const countFrame = () => {
    frameCount++;
    const elapsed = performance.now() - startTime;
    
    if (elapsed >= 1000) {
      const fps = Math.round((frameCount / elapsed) * 1000);
      if (fps > 65) {
        console.warn(`[Animation] ${label}: ${fps} FPS (possible forced reflows)`);
      }
      frameCount = 0;
      startTime = performance.now();
    }
    
    rafId = requestAnimationFrame(countFrame);
  };

  rafId = requestAnimationFrame(countFrame);

  return () => cancelAnimationFrame(rafId);
}

/**
 * Check for forced synchronous layouts (layout thrashing)
 */
export function detectLayoutThrashing() {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'measure' && entry.duration > 16) {
        console.warn(`[Layout] Long frame: ${entry.duration.toFixed(2)}ms - ${entry.name}`);
      }
    }
  });

  observer.observe({ entryTypes: ['measure', 'navigation'] });
  return () => observer.disconnect();
}
