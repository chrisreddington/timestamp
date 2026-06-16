---
applyTo: "src/themes/**/*.{ts,css,scss}"
description: Advanced patterns for complex themes with many elements, animations, or state
---

# Complex Theme Patterns

This document captures advanced patterns for building complex themes that involve:
- Many DOM elements (1000+ squares, particles, etc.)
- Complex animation sequences (celebration, ambient activity)
- State management across multiple modules
- Performance-critical rendering paths

## When to Use These Patterns

Apply these patterns when your theme has:
- **>1000 DOM elements** that update frequently
- **Multiple animation systems** (ambient + celebration + resize)
- **>5 state fields** across renderer lifecycle
- **Performance budgets** to meet (INP <200ms, 60fps)

Simple themes (e.g., fireworks with canvas) may not need all patterns here.

---

## Architecture Patterns

### Three-Tier Module Structure

Complex themes benefit from clear separation:

```
Renderer (thin factory)
    ↓ delegates to
State Module (lifecycle management)
    ↓ uses
Utility Modules (pure operations)
```

**Example structure:**
```
my-theme/
├── renderers/
│   ├── time-page-renderer.ts     # Thin factory, returns interface
│   └── landing-page-renderer.ts
├── utils/ui/
│   ├── state/
│   │   ├── base-renderer-state.ts    # Shared state interface
│   │   ├── time-renderer-state.ts    # Time page state + lifecycle
│   │   └── landing-renderer-state.ts # Landing page state + lifecycle
│   ├── animation/
│   │   ├── activity-loop.ts          # Ambient animation logic
│   │   ├── state-transitions.ts      # Lifecycle transitions
│   │   └── wall-build.ts             # Celebration animation
│   └── grid-builder/
│       └── index.ts                  # DOM construction
└── config/
    └── index.ts                      # Constants, CSS classes, phase config
```

### State Inheritance Pattern

Use a base state interface extended by specific renderers:

```typescript
// base-renderer-state.ts
export interface BaseRendererState {
  container: HTMLElement | null;
  gridState: GridState | null;
  loopState: ActivityLoopState;
  resourceTracker: ResourceTracker;
  getAnimationState: AnimationStateGetter;
}

// time-renderer-state.ts
export interface TimePageRendererState extends BaseRendererState {
  resizeObserver: ResizeObserver | null;
  lastTime: TimeRemaining | null;
  celebrationController: CelebrationController;
}

// landing-renderer-state.ts
export interface LandingPageRendererState extends BaseRendererState {
  exclusionElement: HTMLElement | null;
  isDestroyed: boolean;
}
```

### Guard Clause Pattern

Use early returns to protect against invalid state:

```typescript
// ✅ Guard at entry points
updateTime(time: TimeRemaining): void {
  if (!isRendererReady(state)) return;
  // ... proceed with update
}

// ✅ Reusable guard functions
export function isRendererReady(state: BaseRendererState): boolean {
  return state.container !== null && state.gridState !== null;
}
```

---

## Canvas-Based Theme Patterns

### Color Mode Initialization for Canvas Renderers

Canvas-based themes that need color-aware palettes must handle color mode initialization carefully to avoid race conditions.

#### The Problem: Landing Page Initialization Race

On the **landing page**, the color mode might not be set in the DOM when your renderer mounts:

```typescript
// ❌ WRONG: DOM attribute may not be set yet
function mount(container: HTMLElement, context?: MountContext): void {
  setupCanvas(state, container);
  // This reads data-color-mode, but it might not exist yet!
  updateColorMode(state);
}
```

**Why this happens:**
1. Line 531 in `landing-page/index.ts`: `initializeBackground()` mounts your renderer
2. Your `mount()` tries to read `document.documentElement.dataset.colorMode`
3. Line 534 in `landing-page/index.ts`: `applyInitialThemeColors()` sets the attribute ❌ **Too late!**

#### The Solution: Use MountContext.colorMode

The `MountContext` interface includes an optional `colorMode` field that's resolved BEFORE your renderer mounts:

```typescript
interface MountContext {
  getAnimationState: AnimationStateGetter;
  exclusionElement?: HTMLElement;
  colorMode?: ResolvedColorMode;  // 'light' | 'dark'
}
```

**Use it in your landing page renderer:**

```typescript
// ✅ CORRECT: Use colorMode from context
function setupCanvas(state: LandingPageState, container: HTMLElement, initialColorMode?: 'dark' | 'light'): void {
  state.renderer = createCanvasRenderer();
  
  const { width, height } = getViewportDimensions();
  state.grid = createCanvasGridState(width, height);
  state.renderer.resize(state.grid);

  // Set initial color mode if provided from context
  if (initialColorMode) {
    state.renderer.setColorMode(initialColorMode);
  } else {
    // Fallback: derive from data attribute if context didn't provide it
    updateColorMode(state);
  }

  container.appendChild(state.renderer.canvas);
  // ... rest of setup
}

// In your mount method:
mount(container: HTMLElement, context?: MountContext): void {
  // Pass colorMode through to setupCanvas
  setupCanvas(state, container, context?.colorMode);
  // ...
}
```

#### When This Pattern Applies

| Renderer Type | Needs colorMode? | Reason |
|---------------|------------------|--------|
| **Landing page renderer** with canvas | ✅ **Required** | Prevents flash of wrong colors on page load |
| **Time page renderer** with canvas | ⚠️ Optional | Time page is initialized after color mode is set, but using `context.colorMode` is cleaner |
| **Simple DOM-based renderers** | ❌ Not needed | CSS custom properties handle color modes automatically |

#### Complete Example

See the Contribution Graph theme for a working implementation:

📖 **Reference:** `src/themes/contribution-graph/renderers/landing-page-renderer.ts`

**Key points:**
1. Accept `initialColorMode` parameter in `setupCanvas()`
2. Set color mode BEFORE any rendering
3. Keep DOM reading as fallback for time page compatibility
4. Continue listening to `color-mode-change` events for user toggles

```typescript
// Color mode listener for runtime changes
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
state.colorModeListener = () => {
  if (state.renderer && state.grid) {
    state.renderer.setColorMode('system');
    markFullRepaint(state.grid);
  }
};
mediaQuery.addEventListener('change', state.colorModeListener);

// Listen for color mode toggle changes
document.addEventListener('color-mode-change', () => updateColorMode(state));
```

---

## Performance Patterns

### Core Principle: Compositor-Only Properties

The browser rendering pipeline has three phases:
1. **Layout** (expensive) - Changes to geometry, position
2. **Paint** (expensive) - Changes to visual appearance  
3. **Composite** (cheap) - GPU-accelerated layer operations

**Always prefer compositor-only properties:**
- ✅ `opacity` - GPU-accelerated
- ✅ `transform` - GPU-accelerated
- ⚠️ `filter` - GPU-accelerated but has overhead with many elements
- ❌ `box-shadow` - Triggers paint on every frame
- ❌ `background-color` transitions - Triggers paint
- ❌ `border`, `outline` changes - Triggers paint

### CSS Performance for Many Elements

```css
/* ❌ NEVER on 1000+ elements - creates compositor layers per element */
.square {
  will-change: transform;
  transform: translateZ(0);
}

/* ❌ NEVER - Paint-heavy, kills performance */
.square {
  box-shadow: 0 0 10px green;
  transition: background-color 0.3s;
}

/* ✅ Container gets GPU promotion, not children */
.grid-container {
  contain: strict;
}

/* ✅ Individual elements use containment, no GPU promotion */
.square {
  contain: strict;
}

/* ✅ Color via CSS classes, not inline styles */
.square.intensity-0 { background-color: #161b22; }
.square.intensity-4 { background-color: #39d353; }
```

### Pre-computed Class Strings

Avoid string concatenation in hot paths:

```typescript
// ❌ Creates new string every call
function getSquareClass(intensity: number, phase: string): string {
  return `square intensity-${intensity} ${phase}`;
}

// ✅ Pre-compute at module load
const CLASS_STRINGS: Record<string, string> = {};
for (const phase of ['calm', 'building', 'intense', 'final']) {
  for (let i = 0; i <= 4; i++) {
    CLASS_STRINGS[`${phase}-${i}`] = `square intensity-${i} ${phase}`;
  }
}

export function getSquareClass(intensity: number, phase: string): string {
  return CLASS_STRINGS[`${phase}-${intensity}`] ?? CLASS_STRINGS['calm-0'];
}
```

### Differential Updates

Only modify elements that actually changed:

```typescript
// ✅ Track previous state, only update changes
export function renderDigits(state: GridState, lines: string[]): void {
  const cacheKey = lines.join('|');
  if (state.lastTimeStr === cacheKey) return; // Skip if unchanged
  
  state.lastTimeStr = cacheKey;
  const newIndices = computeDigitIndices(state, lines);
  
  // Clear old positions not in new set
  for (const idx of state.lastDigitIndices) {
    if (!newIndices.has(idx)) clearSquare(state.squares[idx]);
  }
  
  // Set new positions not in old set
  for (const idx of newIndices) {
    if (!state.lastDigitIndices.has(idx)) setSquare(state.squares[idx]);
  }
  
  state.lastDigitIndices = newIndices;
}
```

**Impact:** 87.5% reduction in DOM ops (35 vs 280 per tick for countdown).

### Dirty Flag Pattern

Skip expensive rebuilds when data hasn't changed:

```typescript
interface GridState {
  ambientSquares: Square[];
  ambientSquaresDirty: boolean;  // Set true when bounding box changes
  digitBoundingBox: BoundingBox | null;
}

function updateAmbientSquares(state: GridState, newBox: BoundingBox): void {
  // Skip rebuild if bounding box unchanged
  if (!state.ambientSquaresDirty && boundingBoxEquals(state.digitBoundingBox, newBox)) {
    return;
  }
  
  state.ambientSquares = state.squares.filter(/* ... */);
  state.ambientSquaresDirty = false;
}
```

### Activity Loop: Interval vs RAF

```typescript
// ❌ RAF runs 60x/second even when idle
function processFades(now: number): void {
  // ... work
  requestAnimationFrame(processFades);
}

// ✅ Interval at 10Hz - 6x fewer iterations for non-visual work
setInterval(processFades, 100);
```

**Use RAF for:** Visual animations that need smooth frame updates.
**Use setInterval for:** Logic-only updates (activity tick scheduling, phase changes).

---

## Memory Management

### Periodic Cleanup for Long-Running Countdowns

Countdowns can run for months. Prevent memory accumulation:

```typescript
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function startPeriodicCleanup(
  gridState: GridState,
  resourceTracker: ResourceTracker
): number {
  return window.setInterval(() => {
    // Prune timeout/RAF tracking arrays
    if (resourceTracker.timeouts.length > 20) {
      resourceTracker.timeouts = resourceTracker.timeouts.slice(-20);
    }
    
    // Rebuild ambient squares to drop stale references
    gridState.ambientSquares = gridState.squares.filter(
      s => !s.isDigit && !s.element.classList.contains('is-wall')
    );
    
    // Clear cached state
    gridState.lastTimeStr = null;
    gridState.lastDigitIndices.clear();
  }, CLEANUP_INTERVAL_MS);
}
```

### WeakMap/WeakSet for Element Tracking

Use weak references for tracking state tied to DOM elements:

```typescript
interface GridState {
  // Pending cleanup timeouts for squares (allows GC when square removed)
  pendingCleanups: WeakMap<Square, number>;
  // Squares currently animating (prevents re-activation)
  animatingSquares: WeakSet<Square>;
}
```

### Fisher-Yates for O(1) Random Selection

When selecting random elements from large arrays:

```typescript
// ❌ Array slice creates new array
const randomSquare = availableSquares[Math.floor(Math.random() * availableSquares.length)];

// ✅ Swap-and-pop for O(1) removal without reallocation
function swapAndPop<T>(arr: T[], idx: number): T {
  const lastIdx = arr.length - 1;
  const item = arr[idx];
  arr[idx] = arr[lastIdx];
  arr.pop();
  return item;
}

const idx = Math.floor(Math.random() * buffer.length);
const square = swapAndPop(buffer, idx);
```

---

## Animation Patterns

### CSS-Driven Animation Lifecycle

Let CSS handle animation timing, JS just toggles classes:

```css
/* CSS defines full animation including cleanup */
.square.is-ambient {
  animation: ambient-pulse 1.5s ease-in-out forwards;
}

@keyframes ambient-pulse {
  0% { opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }  /* Returns to base state */
}
```

```typescript
// JS adds class to start, schedules cleanup after animation duration
function activateSquare(square: Square, phase: string, resourceTracker: ResourceTracker): void {
  square.element.className = getAmbientClass(getWeightedIntensity(), phase);
  state.activeAmbient.add(square);
  
  // Schedule cleanup after CSS animation completes
  const duration = getPhaseDurationMs(phase);
  window.setTimeout(() => {
    state.activeAmbient.delete(square);
    square.element.className = getBaseClass(0);
  }, duration + 100); // Small buffer
}
```

### Celebration Controller Pattern

Use abort controllers for cancellable async sequences:

```typescript
interface CelebrationController {
  abortController: AbortController | null;
}

export function prepareCelebration(state: RendererState): AbortSignal {
  // Abort any running celebration
  if (state.celebrationController.abortController) {
    state.celebrationController.abortController.abort();
  }
  
  state.celebrationController.abortController = new AbortController();
  return state.celebrationController.abortController.signal;
}

export async function executeAnimatedCelebration(
  state: RendererState,
  message: string,
  signal: AbortSignal
): Promise<void> {
  await buildWall(state.gridState);
  if (signal.aborted) return;  // Check between phases
  
  renderCelebrationText(state.gridState, message);
  
  await unbuildWall(state.gridState);
  if (signal.aborted) return;
  
  startCelebrationAmbient(state);
}
```

---

## Resize Handling

### RAF Throttling

Prevent layout thrashing during resize:

```typescript
function setupResizeObserver(state: RendererState): void {
  state.resizeObserver = new ResizeObserver(() => {
    if (state.resizeRafId !== null) return; // Skip if pending
    
    state.resizeRafId = requestAnimationFrame(() => {
      state.resizeRafId = null;
      handleResize(state);
    });
  });
  
  state.resizeObserver.observe(state.container);
}
```

### Critical Cleanup Before Rebuild

```typescript
function handleResize(state: RendererState): void {
  // CRITICAL: Stop activity loop before grid rebuild
  // (loop holds closure over old gridState)
  stopActivity(state);
  
  // CRITICAL: Cancel pending callbacks to release old square references
  cancelPendingCallbacks(state.resourceTracker);
  
  // Remove old grid
  state.container.querySelector('.grid')?.remove();
  
  // Create fresh grid (forces GC of old squares)
  state.gridState = createGrid(state.container);
  
  // Restore state
  if (wasInCelebration) {
    showCompletionMessage(state, state.completionMessage);
  } else {
    renderDigits(state.gridState, state.lastTime);
    startCountdownAmbient(state);
  }
}
```

---

## Performance Budget

| Metric | Target | Notes |
|--------|--------|-------|
| INP | <200ms | Interaction to Next Paint |
| LCP | <2.5s | Largest Contentful Paint |
| Rendering/frame | <16ms | 60fps target |
| DOM Nodes | <10,000 | Total elements on page |
| FPS (p95) | ≥50 | During animations |

### Testing Performance Changes

Always profile in Chrome DevTools Performance tab:
1. Record for 10+ seconds
2. Include resize and theme switch interactions
3. Check:
   - Main thread time breakdown
   - Rendering vs Painting vs Scripting ratio
   - Frame drops (red bars in Frames row)
   - INP metric

---

## Examples

### Pre-computed Class Strings

```typescript
// config/index.ts
const AMBIENT_CLASS_STRINGS: Record<string, string> = {};
for (const phase of ['calm', 'building', 'intense', 'final']) {
  for (let intensity = 0; intensity <= 4; intensity++) {
    AMBIENT_CLASS_STRINGS[`${phase}-${intensity}`] = 
      `square intensity-${intensity} is-ambient phase-${phase}`;
  }
}

export function getAmbientClass(intensity: number, phase: string): string {
  return AMBIENT_CLASS_STRINGS[`${phase}-${intensity}`] ?? 'square intensity-0';
}
```

### Differential Digit Updates

```typescript
// Only update changed digits (87.5% fewer DOM ops)
export function renderDigits(state: GridState, lines: string[]): void {
  const cacheKey = lines.join('|');
  if (state.lastTimeStr === cacheKey) return;
  
  state.lastTimeStr = cacheKey;
  const newIndices = computeDigitIndices(state, lines);
  
  // Clear old, set new - only changes
  for (const idx of state.lastDigitIndices) {
    if (!newIndices.has(idx)) clearSquare(idx);
  }
  for (const idx of newIndices) {
    if (!state.lastDigitIndices.has(idx)) setSquare(idx);
  }
  
  state.lastDigitIndices = newIndices;
}
```

### Memory-Safe Activity Loop

```typescript
export function activityTick(state: GridState, phase: string, handles: ResourceTracker): void {
  if (state.ambientSquares.length === 0) return;
  
  const config = getPhaseConfig(phase);
  const targetActive = Math.ceil((state.ambientSquares.length * config.coverage) / 1000);
  const needed = Math.max(0, targetActive - state.activeAmbient.size);
  
  // Build local buffer (GC cleans between ticks)
  const available = state.ambientSquares.filter(
    s => !state.activeAmbient.has(s) && !state.animatingSquares.has(s)
  );
  
  // O(1) random selection via swap-and-pop
  for (let i = 0; i < needed && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    const square = swapAndPop(available, idx);
    activateSquare(square, phase, handles);
  }
}
```

---

## Anti-Patterns

| Anti-Pattern | Why It's Problematic | Better Approach |
|--------------|---------------------|-----------------|
| `will-change` on 1000+ elements | Creates compositor layers per element | Apply to container only |
| `box-shadow` animations | Triggers paint on every frame | Use `filter: drop-shadow()` or opacity |
| RAF loop when idle | 60fps CPU usage with no work | Use `setInterval` at 10Hz |
| Multiple DOM ops per element | Style recalc per operation | Single `className` assignment |
| Inline style manipulation | Style recalc per element per change | CSS classes for all states |
| Re-rendering all elements | O(n) ops when O(1) suffices | Differential updates with caching |
| String concat in hot loops | GC pressure from temporary strings | Pre-compute class strings |
| Rebuilding during active resize | DOM churn causes jank | RAF throttle + state preservation |
| Unbounded tracking arrays | Memory grows over time | Periodic cleanup, WeakMap/WeakSet |
| Random pick with rejection | O(10) worst case per pick | Pre-filter valid list |

---

## References

### Project Documentation
- [themes.instructions.md](.github/instructions/themes.instructions.md) - Core theme patterns
- [typescript.instructions.md](.github/instructions/typescript.instructions.md) - TypeScript standards
- [perf-analysis.instructions.md](.github/instructions/perf-analysis.instructions.md) - Performance monitoring

### External Resources
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/) - Profiling guide
- [CSS Containment](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment) - Browser optimization hints
- [Compositor Properties](https://web.dev/articles/animations-guide) - GPU-accelerated animations
- [INP Optimization](https://web.dev/articles/inp) - Interaction to Next Paint best practices
