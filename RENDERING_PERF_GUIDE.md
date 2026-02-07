# Client Rendering Performance Guide

## Known Battery Drain Risks

### 1. Animation During Streaming (HIGH PRIORITY)
**Location**: `MessageList.tsx`, `MobilePaneTabs.tsx`

The `animate-pulse` class is applied during streaming:
```tsx
// MessageList.tsx - ToolCallDisplayMemo
{tool.status === 'running' && showPulse && (
  <span className="text-pi-warning text-[11px] flex-shrink-0 animate-pulse">(running)</span>
)}
```

**Problem**: `animate-pulse` triggers continuous repaints (~60fps), even when content is static.

**Fix**: Replace with CSS transition or blink on interval:
```tsx
// Instead of animate-pulse, use a ref-based toggle
const [isVisible, setIsVisible] = useState(true);
useEffect(() => {
  const id = setInterval(() => setIsVisible(v => !v), 1000);
  return () => clearInterval(id);
}, []);
```

---

### 2. WebSocket Message Storms
**Location**: `useWorkspaces.ts`

Streaming responses update state on every token:
```tsx
// Each streaming chunk triggers a React re-render
case 'streaming':
  updateSlotState(payload.slotId, {
    streamingText: payload.text,
    streamingThinking: payload.thinking || '',
  });
```

**Problem**: If streaming is fast (>10 tokens/sec), React queues many re-renders.

**Fix**: Throttle updates during streaming:
```tsx
const throttledUpdate = useMemo(
  () => throttle((slotId, text) => updateSlotState(slotId, { streamingText: text }), 50),
  []
);
```

---

### 3. Layout Calculations on Every Render
**Location**: `App.tsx` line ~1244+

The `sidebarWorkspaces` useMemo creates new arrays/objects on every workspace state change:
```tsx
const sidebarWorkspaces = useMemo(() => ws.workspaces.map((workspace) => {
  // ... creates new objects, arrays, Maps every time
}), [ws.workspaces, ws.activeWorkspaceId, ...many_deps]);
```

**Problem**: Even with useMemo, any workspace state change recalculates everything.

**Fix**: Split into smaller memos or use reselect-style selectors:
```tsx
// Split computations
const workspaceConversations = useMemo(() => {
  // Only recalc when sessions change, not when streaming
}, [ws.workspaces.map(w => w.sessions)]);
```

---

### 4. Cursor Blink Animation
**Location**: `index.css`

```css
@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
```

**Problem**: Forces repaint on every frame during streaming.

**Fix**: Use `transform` or `visibility` instead of `opacity`, or reduce frequency:
```css
/* Reduce from 1s to 1.2s, use steps(1) for less GPU work */
.cursor-blink {
  animation: cursor-blink 1.2s steps(1) infinite;
}
```

---

### 5. Event Listener Spam
**Location**: `App.tsx`

Multiple global event listeners added in useEffect:
```tsx
useEffect(() => {
  window.addEventListener('pi:workspaceEntries', handleWorkspaceEntries);
  window.addEventListener('pi:directoryEntries', handleDirectoryEntries);
  window.addEventListener('pi:workspaceFile', handleWorkspaceFile);
  window.addEventListener('pi:gitStatus', handleGitStatus);
  window.addEventListener('pi:fileDiff', handleFileDiff);
  // ... 15+ more listeners
}, [...]);
```

Each listener closure captures variables, potentially causing stale closure issues.

**Fix**: Use a single dispatcher pattern or context:
```tsx
// Single event bus
const eventBus = useRef(new EventTarget());
useEffect(() => {
  const handler = (e) => {
    switch(e.detail.type) {
      case 'workspaceEntries': ...
    }
  };
  eventBus.current.addEventListener('dispatch', handler);
}, []);
```

---

## Profiling Checklist

### Quick Checks (5 minutes)
- [ ] Open Chrome DevTools → Rendering → Check "Paint flashing"
- [ ] Look for flashing areas during streaming (indicates repaints)
- [ ] Check for constant flashing areas (indicates continuous animation)

### Deep Profiling (15 minutes)
- [ ] Performance tab → Record during 30s of streaming
- [ ] Look for long "Scripting" blocks (>16ms)
- [ ] Check "Layer" tab for excessive compositing
- [ ] Memory tab → Take heap snapshots, look for growing retained size

### Battery Profiling (macOS)
```bash
# Monitor CPU usage while app runs
# Activity Monitor → % CPU column
# Look for sustained >20% CPU during idle
```

---

## Quick Wins

1. **Disable pulse animations on mobile** (already partially done with `showPulse = !isMobile`)
2. **Throttle streaming updates** to 50ms minimum
3. **Virtualize message lists** if >100 messages
4. **Use CSS `content-visibility: auto`** for off-screen messages
5. **Debounce resize handlers** in App.tsx

---

## Tools

```bash
# Bundle analyzer
npm run build -- --analyze

# Lighthouse CI
npx lighthouse http://localhost:3001 --preset=desktop

# React DevTools Profiler (install extension)
# Components tab → Record → Flamegraph
```
