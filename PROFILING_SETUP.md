# Client Rendering Profiling Setup

This document explains how to profile the Pi Web UI client for excessive rendering and battery drain issues.

## Quick Start

### 1. Quick Profile (30 seconds)
```bash
# Start dev server first
npm run dev

# In another terminal, run quick profiler
npm run profile:quick

# Or with streaming simulation
npm run profile:streaming
```

### 2. Full Test Suite (2-3 minutes)
```bash
# Run all performance tests
npm run profile

# Run specific tests
npm run profile:baseline      # Idle performance
npm run profile:memory        # Memory leak detection
./scripts/profile-client.sh layout     # Layout thrashing
./scripts/profile-client.sh streaming  # Streaming performance
```

## Available Profiling Tools

### Tool 1: Quick Profile (`scripts/quick-profile.ts`)
A lightweight standalone script for rapid performance checks.

**Usage:**
```bash
npx tsx scripts/quick-profile.ts [options]

Options:
  --duration 5000    # Profiling duration in ms (default: 5000)
  --streaming        # Simulate streaming content
  --json             # Output JSON instead of table
```

**Example Output:**
```
📈 Results
=========

FPS:
  Average: 58.2
  Min: 45.0
  Max: 60.0

CPU Usage:
  Average: 8.5%
  Peak: 23.1%

Timing (ms):
  Layout avg: 0.45 (max: 1.23)
  Paint avg: 2.10 (max: 5.67)
  Script avg: 3.45 (max: 8.90)

💡 Recommendations
==================
  • Excessive painting - look for continuous animations (animate-pulse, spin)
```

### Tool 2: Playwright Test Suite (`packages/client/tests/performance/`)
Comprehensive performance tests using Playwright's Chrome DevTools Protocol integration.

**Tests Included:**
1. **Baseline Idle** - Measures FPS/CPU when app is idle
2. **Streaming Performance** - Simulates message streaming
3. **Animation Repaints** - Detects continuous paint operations
4. **Memory Leak Detection** - Tracks heap growth over time
5. **Layout Thrashing** - Detects forced synchronous layouts
6. **Mobile Viewport** - Tests mobile performance
7. **Component Renders** - Counts React component re-renders

**Run with UI:**
```bash
npx playwright test --ui
```

### Tool 3: Runtime Debug Utilities (`packages/client/src/utils/renderMonitor.ts`)
React utilities for tracking renders during development.

**Usage in Components:**
```tsx
import { useRenderMonitor } from './utils/renderMonitor';

function MessageList(props) {
  useRenderMonitor('MessageList', props);
  // ... component logic
}
```

## Interpreting Results

### Healthy Metrics
| Metric | Healthy Range | Warning |
|--------|--------------|---------|
| Idle FPS | 55-60 | < 30 |
| Idle CPU | < 10% | > 30% |
| Paint Duration | < 2ms | > 5ms |
| Layout Duration | < 2ms | > 5ms |
| Heap Growth | < 20% | > 50% |

### Common Issues Found in This Codebase

1. **Pulse Animations** (`animate-pulse`)
   - Location: `MessageList.tsx`, `MobilePaneTabs.tsx`
   - Problem: Continuous animation forces repaints at 60fps
   - Detection: High paint duration in profiler
   - Fix: Replace with CSS transition or interval-based toggle

2. **WebSocket Streaming**
   - Location: `useWorkspaces.ts`
   - Problem: Each token triggers React re-render
   - Detection: High script duration during streaming
   - Fix: Throttle updates to 50ms intervals

3. **Expensive useMemo in App.tsx**
   - Location: `sidebarWorkspaces` calculation
   - Problem: Recalculates on every workspace change
   - Detection: Long scripting blocks
   - Fix: Split into smaller memos with targeted dependencies

4. **Cursor Blink**
   - Location: `index.css`
   - Problem: Opacity animation forces repaint
   - Detection: Continuous paint flashing
   - Fix: Use `visibility` or reduce animation frequency

## CI Integration

Add to your CI pipeline:
```yaml
# .github/workflows/perf.yml
name: Performance
on: [push]
jobs:
  profile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run dev &
      - run: sleep 5
      - run: npm run profile:quick -- --json > perf-results.json
      - name: Check Performance
        run: |
          if jq -e '.summary.fps.avg < 30' perf-results.json; then
            echo "❌ FPS too low"
            exit 1
          fi
```

## Manual Browser Profiling

### Chrome DevTools
1. **Paint Flashing**
   - DevTools → Rendering → Check "Paint flashing"
   - Green flashing = repainting (bad if continuous)

2. **Performance Tab**
   - Record → Interact → Stop
   - Look for yellow/red blocks (Scripting/Rendering)
   - Check "Frames" row for dropped frames

3. **React DevTools Profiler**
   - Install React DevTools extension
   - Components tab → Record → Flamegraph
   - Gray = memoized, Green = re-rendered

### Activity Monitor (macOS)
Check CPU usage during idle:
```bash
# Should be < 10% when not streaming
# Sustained high usage = excessive rendering
```

## Fixing Issues

### Throttle Streaming Updates
```tsx
// packages/client/src/utils/throttle.ts
import { throttle } from './utils/throttle';

const throttledUpdate = useMemo(
  () => throttle((text) => setStreamingText(text), 50),
  []
);
```

### Replace Pulse Animation
```tsx
// Instead of: <span className="animate-pulse" />
const [visible, setVisible] = useState(true);
useEffect(() => {
  const id = setInterval(() => setVisible(v => !v), 1000);
  return () => clearInterval(id);
}, []);
return <span style={{ opacity: visible ? 1 : 0.5 }} />;
```

### Virtualize Long Lists
```tsx
// For MessageList with >100 messages
import { useVirtualizer } from '@tanstack/react-virtual';
// Render only visible messages
```

## Next Steps

1. Run `npm run profile:quick` to establish baseline
2. Identify top issues from recommendations
3. Apply fixes one at a time
4. Re-run profiler to verify improvements
5. Add performance tests to CI to prevent regressions

## References

- `RENDERING_PERF_GUIDE.md` - Detailed issue analysis
- `packages/client/src/utils/renderMonitor.ts` - Debug utilities
- `packages/client/src/utils/throttle.ts` - Performance helpers
