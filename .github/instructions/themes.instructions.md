---
applyTo: "src/themes/**/*.ts"
description: Theme architecture, lifecycle, and development patterns
---

# Theme Architecture & Development

Themes are **pure renderers**. The Orchestrator owns timing, state, and lifecycle. SPEC = **WHAT** to build. PLAN = **HOW** to build it.

## Architecture Boundaries

```
Core App (src/app/, src/core/)     → NEVER imports specific themes
   ↓ ONLY via registry
Theme Registry (src/themes/registry/)  → Single source of truth
   ↓ 
Themes (src/themes/{name}/)        → Self-contained, no cross-theme imports
   ↓ ONLY from shared
Shared Utilities (src/themes/shared/)    → Cleanup, constants, background
```

### Dependency Rules
| From | To | Allowed |
|------|-----|---------|
| Core App → Specific Theme | ❌ NO | Use registry |
| Core App → Theme Registry | ✅ YES | `THEME_REGISTRY[themeId]` |
| Theme → Core Types/Utils | ✅ YES | `@core/types`, `@core/utils` |
| Theme → Shared Utilities | ✅ YES | `@themes/shared` |
| Theme → Other Theme | ❌ NO | Never |
| Theme → StateManager | ❌ NO | Orchestrator owns state |

## TimePageRenderer Interface (10 Methods)

```typescript
interface TimePageRenderer {
  mount(container: HTMLElement, context?: MountContext): void;      // Render initial UI
  destroy(): Promise<void>;                 // Clean up ALL resources
  updateTime(time: TimeRemaining): void;    // Update display (COUNTING only)
  onAnimationStateChange(context: AnimationStateContext): void;  // Animation state changes
  onCounting(): void;                       // Reset to countdown mode
  onCelebrating(options?: CelebrationOptions): void;  // Animate celebration
  onCelebrated(options?: CelebrationOptions): void;   // Static celebration
  updateContainer(newContainer: HTMLElement): void;   // Re-query DOM refs
  getResourceTracker(): ResourceTracker;      // Expose for verification
}
```

**Critical**: Themes don't track state. Orchestrator only calls `updateTime()` during COUNTING.

## Responsibilities Matrix

| Responsibility | Orchestrator | Theme |
|----------------|--------------|-------|
| Timer ownership | ✅ Single interval | 🚫 No timers |
| State machine | ✅ COUNTING→CELEBRATING→CELEBRATED | 🚫 No state tracking |
| Focus management | ✅ Preserve/restore | 🚫 No focus code |
| ARIA/accessibility | ✅ role, aria-label | 🚫 No ARIA on container |
| Container moves | ✅ Calls `updateContainer()` | ✅ Re-query DOM |
| Animation timing | 🚫 | ✅ Internal animations |
| Animation state | ✅ Calls `onAnimationStateChange()` | ✅ Implement hook |
| Reduced motion + visibility | ✅ Computes AnimationStateContext | ✅ Respond to context |

### Theme Lifecycle Hooks

Themes receive lifecycle notifications from the orchestrator and are responsible for managing their internal state:

| Hook | Orchestrator Responsibility | Theme Responsibility |
|------|----------------------------|---------------------|
| `onCounting()` | Remove `data-celebrating` attribute, call hook | Reset local animation phase to idle, clear celebration UI |
| `onCelebrating()` | Set `data-celebrating` attribute, call hook | Start celebration animation sequence |
| `onCelebrated()` | Call hook after animation completes | Show final celebration state without animation |

**Key principle**: The orchestrator manages global lifecycle state (`data-celebrating` attribute). Themes manage their LOCAL animation state (where they are in their animation sequence).

### Lifecycle vs Rendering State Separation

**Orchestrator owns**: Lifecycle phase (`counting`/`celebrating`/`celebrated`)
**Theme owns**: Animation phase (internal rendering state)

```typescript
// ❌ WRONG: Theme duplicates orchestrator state
interface ThemeState {
  isAnimating: boolean;       // Mirrors orchestrator 'celebrating'
  isPostCelebration: boolean; // Mirrors orchestrator 'celebrated'
}

// ✅ CORRECT: Theme has LOCAL animation state only
type AnimationPhase = 'idle' | 'wall-building' | 'text-revealing' | 'activity-resumed';

interface ThemeState {
  animationPhase: AnimationPhase;  // LOCAL rendering state
}

// Theme DERIVES celebration status from local phase
function isCelebrating(state: ThemeState): boolean {
  return state.animationPhase !== 'idle';
}
```

## Required Exports

```typescript
// index.ts must export (using clean entry pattern):
export { MY_THEME_CONFIG } from './config';
export { myThemeTimePageRenderer } from './renderers/time-page-renderer';
export { myThemeLandingPageRenderer } from './renderers/landing-page-renderer';
```

### Config (config/index.ts)
```typescript
export const MY_THEME_CONFIG: ThemeConfig = {
  id: 'my-theme',
  name: 'My Theme',
  description: 'Description',
  publishedDate: '2024-12-26',
  author: 'yourgithubusername', // GitHub username or null
  supportsWorldMap: false,
};
```

### Time Page Renderer (renderers/time-page-renderer.ts)
```typescript
export function myThemeTimePageRenderer(targetDate: Date): TimePageRenderer { ... }
```

### Landing Page Renderer (renderers/landing-page-renderer.ts)
```typescript
export function myThemeLandingPageRenderer(container: HTMLElement): LandingPageRenderer { ... }
```
## Theme Structure Patterns

### Recommended Theme Structure

> **📌 TEST FILE ORGANIZATION**: See [testing.instructions.md](../instructions/testing.instructions.md) for the authoritative guide on unit test co-location and E2E test organization (hybrid pattern).

```
my-theme/
├── index.ts                    # CLEAN entry point - exports ONLY, no implementation
├── styles.scss                 # Theme styles (SCSS)
├── ASSETS.md                   # Asset documentation
├── preview.webp                # Theme preview (generated)
├── config/
│   ├── index.ts                # ThemeConfig + constants
│   └── index.test.ts           # Config tests (co-located)
├── renderers/
│   ├── time-page-renderer.ts   # TimePageRenderer implementation
│   ├── time-page-renderer.test.ts  # Unit tests co-located
│   ├── landing-page-renderer.ts  # LandingPageRenderer implementation  
│   └── landing-page-renderer.test.ts
├── test-utils/
│   └── index.ts                # Shared test helpers
├── utils/
│   ├── time-page/              # Time page specific utilities
│   │   ├── index.ts
│   │   └── index.test.ts
│   └── ui/                     # UI utilities
│       └── ui-builder.ts
├── images/                     # Generated preview images
└── e2e/
    └── mobile-viewport.spec.ts  # Theme-specific E2E tests
```

### Naming Conventions (CRITICAL)

| Item | Convention | Example |
|------|------------|---------|
| Theme folder | kebab-case | `my-cool-theme/` |
| Config constant | SNAKE_UPPER | `MY_COOL_THEME_CONFIG` |
| Time page renderer | camelCase + suffix | `myCoolThemeTimePageRenderer` |
| Landing page renderer | camelCase + suffix | `myCoolThemeLandingPageRenderer` |
| Registry properties | Descriptive names | `timePageRenderer`, `landingPageRenderer` |

### Clean Entry Point Pattern (REQUIRED)

**index.ts should ONLY export, never implement:**

```typescript
// ✅ CORRECT: Clean entry point
/**
 * My Theme
 * Brief description of theme.
 */

import './styles.css';

// Config and constants
export { MY_THEME_CONFIG } from './config';

// Renderer factories (for registry integration)
export { myThemeTimePageRenderer } from './renderers/time-page-renderer';
export { myThemeLandingPageRenderer } from './renderers/landing-page-renderer';
```

```typescript
// ❌ WRONG: Implementation in index.ts
export function myThemeTimePageRenderer(targetDate: Date): TimePageRenderer {
  // 100+ lines of implementation...
}
```

### Registry Integration

Registry entries use descriptive property names:

```typescript
// registry-core.ts
const loadMyTheme = async (): Promise<LoadedThemeModule> => {
  const module = await import('../my-theme');
  return {
    timePageRenderer: module.myThemeTimePageRenderer,
    landingPageRenderer: module.myThemeLandingPageRenderer,
    config: module.MY_THEME_CONFIG,
  };
};
```

## Module Organization

### utils/ui/ - DOM Creation
**File**: `utils/ui/ui-builder.ts`

**Responsibilities:**
- Create UI structure: `createUI(container)`
- Update countdown: `updateCountdownDisplay(container, days, hours, minutes, seconds)`
- Show celebration: `showCelebrationMessage(container, message)`

**Pattern from fireworks:**
```typescript
export function createUI(containerEl: HTMLElement): void {
  containerEl.innerHTML = `...responsive template...`;
}

export function updateCountdownDisplay(container: HTMLElement, days: number, ...): void {
  const daysEl = container.querySelector('[data-testid="countdown-days"]');
  if (daysEl) daysEl.textContent = String(days);
}
```

### config/ - Constants and Configuration
**File**: `config/index.ts`

**Responsibilities:**
- Color palettes (as const for type safety)
- Animation timings
- Layout constants using responsive CSS custom properties
- Exported types/enums

**Pattern:**
```typescript
export const MY_THEME_COLORS = {
  background: '#0d1117',
  accent: '#58a6ff',
} as const;

export const UI_CONSTANTS = {
  /** Responsive font sizing */
  COUNTDOWN_FONT_SIZE: 'clamp(2rem, calc(4rem * var(--font-scale, 1)), 4rem)',
  COUNTDOWN_GAP: 'clamp(8px, 2vw, 20px)',
} as const;
```

### Color Mode Strategy (CRITICAL)

Theme CSS must use **CSS custom property switching** to prevent flash of wrong colors on page load.

**Why this matters:**
- Before JS loads, only CSS is available
- `prefers-color-scheme` respects system preference immediately
- `[data-color-mode]` is set by JS when user has explicit preference
- Without this pattern, users see a flash of the wrong color scheme

**Required Pattern (Clean CSS Custom Property Switching):**

```css
/* 1. Define STATIC palettes (never change) */
:root {
  --my-color-for-light: #ffffff;
  --my-color-for-dark: #0d1117;
}

/* 2. Define ACTIVE variables via system preference */
@media (prefers-color-scheme: dark) {
  :root {
    --my-color: var(--my-color-for-dark);
  }
}
@media (prefers-color-scheme: light) {
  :root {
    --my-color: var(--my-color-for-light);
  }
}

/* 3. Explicit user preference overrides system */
[data-color-mode="dark"] {
  --my-color: var(--my-color-for-dark);
}
[data-color-mode="light"] {
  --my-color: var(--my-color-for-light);
}

/* 4. ALL selectors use ONLY the active variable - defined ONCE */
.my-element { background-color: var(--my-color); }
```

**Benefits:**
- NO flash of wrong colors (system preference works before JS)
- Minimal CSS (each selector defined once, not 4x)
- Easy maintenance (colors defined in one place)
- Better performance (fewer rules to match)

**Anti-patterns to avoid:**

```css
/* ❌ WRONG: Duplicating selectors for each color mode */
@media (prefers-color-scheme: dark) {
  .my-element { background-color: black; }
}
@media (prefers-color-scheme: light) {
  .my-element { background-color: white; }
}
[data-color-mode="dark"] .my-element { background-color: black; }
[data-color-mode="light"] .my-element { background-color: white; }

/* ❌ WRONG: Light/dark mode as default without prefers-color-scheme */
.my-element { background-color: white; }
[data-color-mode="dark"] .my-element { background-color: black; }
```

### renderers/ - Landing Page Renderer
**File**: `renderers/landing-page-renderer.ts`

**Responsibilities:**
- Implement `LandingPageRenderer` interface
- Create ambient animation behind theme selection card
- Implement `onReducedMotionChange()` hook for motion preferences
- Lightweight (fewer elements than main theme)

**Pattern:**
```typescript
import type { LandingPageRenderer, MountContext } from '@core/types';

export function myThemeLandingPageRenderer(container: HTMLElement): LandingPageRenderer {
  let wrapper: HTMLElement | null = null;
  let animationsActive = false;

  return {
    mount(parentContainer: HTMLElement, context?: MountContext): void {
      wrapper = createBackgroundElement();
      parentContainer.appendChild(wrapper);
      
      animationsActive = !(context?.reducedMotion ?? false);
      if (animationsActive) startAnimations();
    },

    destroy(): void {
      stopAnimations();
      wrapper?.remove();
      wrapper = null;
    },

    onVisibilityChange(visible: boolean): void {
      if (visible && animationsActive) resumeAnimations();
      else pauseAnimations();
    },

    onReducedMotionChange(active: boolean): void {
      animationsActive = !active;
      if (active) stopAnimations();
      else startAnimations();
    },

    setSize(width: number, height: number): void { /* resize */ },

    getElementCount(): { total: number; animated: number } {
      return { total: wrapper ? 1 : 0, animated: animationsActive ? 1 : 0 };
    },
  };
}
```

## Cleanup Pattern (REQUIRED)

```typescript
import { createResourceTracker, cancelAll, safeSetInterval } from '@themes/shared';

const tracker = createResourceTracker();
safeSetInterval(() => animate(), 100, tracker);

async function destroy(): Promise<void> {
  cancelAll(tracker);
}
```

## State Object Pattern (Complex Themes)

For themes with multiple state fields, use an explicit state object instead of closure variables:

```typescript
// Create state at factory level
export function myThemeTimePageRenderer(): TimePageRenderer {
  const state = createTimePageRendererState();

  return {
    mount(container, context) {
      setupRendererMount(state, container, context);
      startAmbient(state);
    },
    updateTime(time) {
      if (!isRendererReady(state)) return;
      updateDisplay(state, time);
    },
    destroy() {
      return destroyRendererState(state);
    },
    // ... other methods receive state explicitly
  };
}

// State creation is testable and inspectable
export function createTimePageRendererState(): TimePageRendererState {
  return {
    container: null,
    gridState: null,
    loopState: createActivityLoopState(),
    resourceTracker: createEmptyHandles(),
    // ... all state fields with defaults
  };
}

// Operations are pure functions of state
export function startAmbient(state: RendererState): void { ... }
export function stopActivity(state: RendererState): void { ... }
```

**Benefits:**
- State is explicit and inspectable (no hidden closure variables)
- Operations are testable in isolation
- Clear dependency flow
- State creation can be unit tested separately
- Easier to reset state for testing

**When to use:**
- Theme has >5 state variables
- Theme has complex lifecycle (celebration animations, resize handling)
- Multiple utility modules need access to shared state

See [complex-theme-patterns.instructions.md](.github/instructions/complex-theme-patterns.instructions.md) for advanced patterns.

## Required Test Selectors

| Selector | Purpose |
|----------|---------|
| `theme-container` | Root container |
| `countdown-display` | Countdown area |
| `countdown-days/hours/minutes/seconds` | Time units |
| `celebration-message` | Celebration text |

## Creating a New Theme

```bash
npm run theme create my-theme yourgithubusername
```

Creates all files AND auto-registers. Only manual step: create `preview.webp`.

## Responsive Layout

Use CSS custom properties for safe areas:
- `--safe-area-top/bottom/left/right`
- `--safe-area-width/height`
- `--font-scale` (0.7 mobile, 0.85 tablet, 1.0 desktop)

## Examples

### Time Page Renderer (renderers/time-page-renderer.ts)

```typescript
import { createResourceTracker, cancelAll, safeSetInterval } from '@themes/shared';
import type { TimePageRenderer, TimeRemaining, MountContext, AnimationStateContext } from '@core/types';

export function myThemeTimePageRenderer(targetDate: Date): TimePageRenderer {
  const tracker = createResourceTracker();
  let container: HTMLElement | null = null;
  let animationsActive = false;

  return {
    mount(el: HTMLElement, context?: MountContext): void {
      container = el;
      const animState = context?.getAnimationState();
      animationsActive = animState?.shouldAnimate && !animState?.prefersReducedMotion;
      
      // Initialize DOM and start animations
      if (animationsActive) {
        safeSetInterval(() => animate(), 100, tracker);
      }
    },

    destroy(): Promise<void> {
      cancelAll(tracker);
      container = null;
      return Promise.resolve();
    },

    updateTime(time: TimeRemaining): void {
      // Update display - only called during COUNTING state
    },

    onAnimationStateChange(context: AnimationStateContext): void {
      const shouldAnimate = context.shouldAnimate && !context.prefersReducedMotion;
      if (shouldAnimate !== animationsActive) {
        animationsActive = shouldAnimate;
        if (shouldAnimate) startAnimations();
        else stopAnimations();
      }
    },

    onCounting(): void { /* Reset to countdown mode */ },
    onCelebrating(): void { /* Start celebration animation */ },
    onCelebrated(): void { /* Static celebration state */ },

    updateContainer(el: HTMLElement): void { container = el; },
    getResourceTracker() { return tracker; },
  };
}
```

### Registry Entry (registry-core.ts)

```typescript
// In src/themes/registry/registry-core.ts
const loadMyTheme = async (): Promise<LoadedThemeModule> => {
  const module = await import('../my-theme');
  return {
    timePageRenderer: module.myThemeTimePageRenderer,
    landingPageRenderer: module.myThemeLandingPageRenderer,
    config: module.MY_THEME_CONFIG,
  };
};

export const THEME_REGISTRY = {
  // ... existing themes
  'my-theme': createRegistryEntry(MY_THEME_CONFIG, loadMyTheme),
} as const;
```

### Cleanup Pattern

```typescript
import { createResourceTracker, cancelAll, safeSetInterval, safeSetTimeout } from '@themes/shared';

const tracker = createResourceTracker();

// Safe timer creation - automatically tracked
safeSetInterval(() => pulse(), 100, tracker);
safeSetTimeout(() => flash(), 500, tracker);

// Cleanup clears ALL tracked resources
async function destroy(): Promise<void> {
  cancelAll(tracker); // Clears intervals, timeouts, RAFs
}
```

---

## Anti-Patterns

| Anti-Pattern | Better Approach |
| Theme creates countdown timer | Receive updates via `updateTime()` |
| Theme imports StateManager | Use interface methods |
| Theme imports other themes | Use `@themes/shared` |
| Core imports specific theme | Use `THEME_REGISTRY[themeId]` |
| Empty `destroy()` | Use `cancelAll(tracker)` |
| Hardcoded theme IDs | Use `isValidThemeId()` from registry |
| Subscribing to animation state directly | Implement `onAnimationStateChange()` hook |
| Implementation in index.ts | Move to dedicated renderer files |
| Generic factory names (`factory`, `backgroundFactory`) | Use descriptive names (`timePageRenderer`, `landingPageRenderer`) |
| Flat config files | Use `config/index.ts` with co-located tests |
| Tests in separate folders | Co-locate tests with source files |
| `createThemeName` naming | Use `themeNameTimePageRenderer` pattern |
| Light/dark mode as CSS default | Use `prefers-color-scheme` media queries |

## References

### Project Documentation
- [THEME_DEVELOPMENT.md](../../docs/THEME_DEVELOPMENT.md) - Complete guide
- [Theme Registry](../../src/themes/registry/) - Single source of truth
- [Shared Utilities](../../src/themes/shared/) - Cleanup patterns, dependency rules

### Related Instructions
- [complex-theme-patterns.instructions.md](.github/instructions/complex-theme-patterns.instructions.md) - Advanced patterns for complex themes
- [perf-analysis.instructions.md](.github/instructions/perf-analysis.instructions.md) - General performance monitoring
- [typescript.instructions.md](.github/instructions/typescript.instructions.md) - TypeScript coding standards
- [testing.instructions.md](.github/instructions/testing.instructions.md) - Theme testing patterns
