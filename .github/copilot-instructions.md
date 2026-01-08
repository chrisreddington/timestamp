---
description: Project-wide coding conventions, build commands, and architecture patterns
---

# Timestamp Project Instructions

A customizable time tracking app with countdowns, timers, and world clocks featuring multiple visual themes and instant URL sharing. This file provides project-wide coding conventions, build commands, and architecture patterns for GitHub Copilot.

## Key Concepts

### Project Overview

TypeScript project featuring:
- **Three countdown modes**:
  - **🏠 Local Time** (Wall clock): Per timezone, e.g. New Year's Eve — each timezone celebrates independently
  - **🌐 Same Moment** (Absolute time): One instant, e.g. product launch — everyone counts to the same UTC instant
  - **⏱️ Timer** (Your countdown): Fixed duration countdown — count down from any duration
- **Instant URL sharing**: Every countdown configuration generates a shareable URL
- **Multiple visual themes**: GitHub contribution graph aesthetic, fireworks, and more

### Project Structure

```
timestamp/
├── src/
│   ├── app/                    # Orchestrator & state coordination
│   │   ├── orchestrator/       # Modular orchestrator components
│   │   │   ├── controllers/    # Page lifecycle controllers
│   │   │   ├── theme-manager/  # Theme loading & transitions
│   │   │   ├── time-manager/   # Countdown loop & timer controls
│   │   │   └── ui/             # UI chrome visibility & colors
│   │   └── pwa/                # PWA registration & updates
│   ├── components/             # UI components
│   │   ├── color-mode-toggle/  # Light/dark mode toggle
│   │   ├── countdown-buttons/  # Timer controls (play/pause/reset)
│   │   ├── landing-page/       # Landing page modules
│   │   ├── mobile-menu/        # Mobile hamburger menu
│   │   ├── perf-overlay/       # Performance monitoring overlay
│   │   ├── pwa/                # PWA UI components
│   │   ├── theme-picker/       # Theme selection modal
│   │   ├── timezone-selector/  # Timezone selector
│   │   ├── toast/              # Toast notification system
│   │   ├── tooltip/            # Tooltip component
│   │   └── world-map/          # Day/night visualization
│   ├── core/                   # Core types, state, utilities
│   │   ├── config/             # Mode configuration
│   │   ├── state/              # App state management
│   │   ├── types/              # Shared type definitions
│   │   ├── time/               # Time calculations & timezones
│   │   ├── url/                # URL building & parsing
│   │   └── utils/              # Accessibility, DOM, performance
│   ├── data/                   # Static data (cities, SVG paths)
│   ├── styles/                 # CSS files
│   ├── test-utils/             # Shared test helpers
│   └── themes/                 # Theme implementations
│       ├── registry/           # SINGLE SOURCE OF TRUTH
        ├── theme-1/
        ├── theme-2/
        ......
│       └── shared/             # Shared cleanup, constants
├── docs/                       # Specs, plans, guides
├── e2e/                        # Cross-cutting E2E tests
├── scripts/                    # Build scripts
└── .github/                    # Workflows, agents, instructions, prompts
```

---

## Rules and Guidelines

### Key Features
- **Local Time** (wall-clock): Count down to specific dates per timezone (New Year's Eve, birthdays)
- **Same Moment** (absolute): Count down to a single instant globally (product launches, events)
- **Timer**: Fixed duration countdowns (5 minutes, 2 hours, custom durations)
- **URL Sharing**: Automatically generates shareable URLs for any countdown configuration
- **Multiple Themes**: 
  - Contribution Graph: GitHub-style grid with pulsing digits and living background
  - Fireworks: Dynamic canvas animations that intensify as time approaches zero
- **World Map**: Day/night visualization showing real-time solar position
- **Timezone Support**: Full IANA timezone database with intelligent defaults
- **Accessibility**: Screen reader support and reduced motion
- **Responsive Layout System**:
  - Safe Area: Themes render within safe area defined by CSS custom properties (`--safe-area-*`)
  - Breakpoints: mobile (≤1050px shows hamburger), desktop (>1050px)
  - Mobile Hamburger Menu: All chrome consolidated in overlay on mobile for maximum countdown space
  - Responsive Fonts: `--font-scale` CSS property (0.7 mobile, 1.0 desktop)
  - Utility module: `@themes/shared/responsive-layout`

### Development Commands
- `npm install` - Install dependencies
- `npm run dev` - Start development server (default port: 5173)
- `npm run build` - Build for production
- `npm run test` - Run unit tests with Vitest
- `npm run test:e2e` - Run ALL E2E tests with Playwright (required for final validation)
- `npm run test:e2e:fast` - Fast E2E iteration (single browser, no retries, short timeout)
- `npm run theme <command>` - Unified theme CLI for validation and sync operations
- `npm run validate:scripts` - Type-check and lint build scripts (scripts/ folder)
- `npm run typecheck:scripts` - Type-check scripts only (uses tsconfig.scripts.json)
- `npm run lint:scripts` - Lint scripts only
- `npm run lint:all` - Lint both src/ and scripts/
- `npm run validate:iteration` - **Agents use this**: Full validation with fast E2E tests
- `npm run validate:full` - Complete validation with full E2E suite (human-triggered)

> **Note**: E2E tests automatically sync fixtures before running (`pretest:e2e` hook).
> CI uses `npm run theme sync:fixtures -- --check` to validate the committed file is current.

### Theme CLI Commands

```bash
# Create a new theme
npm run theme create <theme-name>           # Create theme scaffold
npm run theme create <theme-name> author    # Create with author

# Generate preview images (requires build first)
npm run generate:previews                   # Generate all previews
npm run generate:previews -- --force        # Force regenerate all
npm run generate:previews -- --theme=<id>   # Single theme only

# Validation commands
npm run theme validate              # All validations (colors + config)
npm run theme validate:colors       # Color contrast only
npm run theme validate:config       # Config schema only

# Sync commands  
npm run theme sync                  # All sync operations
npm run theme sync:readmes          # Theme READMEs only
npm run theme sync:fixtures         # E2E fixtures only
npm run theme sync:templates        # Issue templates only

# Check mode (CI - exit 1 on failure)
npm run theme validate -- --check
npm run theme sync -- --check
```

### E2E Testing Strategy

> **📌 TESTING STANDARDS**: See [testing.instructions.md](.github/instructions/testing.instructions.md) for the complete testing guide including test type boundaries, locator strategies, assertion patterns, and anti-patterns.

**Agents MUST use fast mode:**
```bash
# ALWAYS use fast mode - chromium only, parallel workers, 15s timeout, 0 retries
npm run test:e2e:fast

# Fast mode with filtering
npm run test:e2e:fast -- --grep "theme switching"
```

> ⚠️ **CRITICAL**: Agents must ONLY run `npm run test:e2e:fast`, NEVER `npm run test:e2e`.
> The full E2E suite takes too long for interactive development. CI handles full browser matrix testing.

**For final validation (human-triggered only):**
```bash
# Full mode: all browsers, retries, full timeout (matches CI)
# Only run manually before pushing - NOT via agents
npm run test:e2e
```

### Command Output Guidelines

**Output Visibility (Token Efficiency):**
- ✅ ALWAYS run commands with visible output (agents learn from it)
- ✅ Use compact/concise output formats to save tokens:
  - Tests: Use `--reporter=dot` (already configured in test scripts)
  - TypeScript: Compiler output is already concise
  - Linters: Default output is already token-efficient
- ✅ Let commands run to completion naturally
- ❌ NEVER truncate with `| head`, `| tail`, or `| head -n X`
- ❌ NEVER hide output with `> /dev/null` or similar

**Running Individual Tests:**
When running specific test files (not full validation suite), use compact reporters:
```bash
# ✅ Compact output for specific tests
npm run test -- my-file.test.ts          # Already uses dot reporter
npm run test:e2e -- my-spec.spec.ts      # Already uses dot reporter

# ❌ Don't truncate output
npm run test 2>&1 | head -n 50           # NEVER DO THIS
```

**Rationale:**
- Live output enables agents to learn from errors and success patterns
- Compact formats (like dot reporter) save tokens while preserving visibility
- Full output ensures no critical context is lost (test names on failure, stack traces, etc.)

### Acceptance Criteria (REQUIRED Before Marking Work Complete)

Before marking any code changes as complete, **ALL** validation checks must pass:

```bash
# Agents use this - fast E2E tests (chromium only)
npm run validate:iteration

# Before pushing / CI - full E2E suite (all browsers)
npm run validate:full
```

**What these scripts run (in order):**
1. `typecheck` - TypeScript compilation check (src/)
2. `validate:scripts` - Type-check and lint build scripts (scripts/)
3. `lint` - ESLint code style compliance
4. `test` - Unit tests with Vitest
5. `build` - Production build verification
6. `test:e2e:fast` or `test:e2e` - E2E tests (fast or full)

> ⚠️ **This is non-negotiable.** Do NOT mark work as complete until validation passes.
> If any check fails, diagnose and fix before proceeding.
> CI will run `validate:full` with all browsers before merge.

### Path Aliases
The project uses TypeScript path aliases for cleaner imports:
- `@/*` - Maps to `src/*`
- `@app/*` - Maps to `src/app/*`
- `@core/*` - Maps to `src/core/*`
- `@themes/*` - Maps to `src/themes/*`

### Dependency Management Standards
- **Research Latest Versions**: Whenever updating or adding dependencies (npm packages, Node.js versions, etc.), always research the latest stable versions available.
- **LTS Preference**: Prefer Long-Term Support (LTS) versions for core runtimes like Node.js unless a specific feature from a newer version is required.
- **Risk Assessment**: If a dependency is found to be unmaintained, deprecated, or has known security vulnerabilities, flag it as a risk and suggest alternatives.
- **SHA Pinning**: Always pin GitHub Actions to full commit SHAs.

### Documentation Standards
- Specifications: `docs/specs/SPEC-NNN-kebab-case-title.md`
- Discovery: `docs/discovery/DISC-NNN-kebab-case-title.md`
- Use zero-padded 3-digit numbers for NNN.

### Accessibility Standards
- Support `prefers-reduced-motion` for all animations.
- Ensure high contrast between text and background colors.

### Keeping Instructions Up-to-Date

**IMPORTANT**: When making changes to the project that affect this document or any `.instructions.md` file, update the relevant instruction files to reflect those changes.

#### When to Update This File:
- Adding/removing/renaming files or directories in project structure
- Changing npm scripts or build commands
- Adding new path aliases
- Modifying theme system architecture
- Adding new code quality standards or patterns
- Changing accessibility or documentation standards

#### When to Update Path-Specific Instructions:
- `assets-sync.instructions.md`: When theme or root ASSETS.md files change
- `complex-theme-patterns.instructions.md`: When complex theme architecture or performance patterns change
- `copilot-instructions.instructions.md`: When instruction file standards change
- `custom-agents.instructions.md`: When agent patterns or protocols change
- `documentation.instructions.md`: When TSDoc or code documentation standards change
- `github-actions.instructions.md`: When workflow patterns, commands, or security practices change
- `manager-agents.instructions.md`: When manager agent orchestration patterns change
- `perf-analysis.instructions.md`: When performance monitoring guidelines change
- `prompt-files.instructions.md`: When prompt file conventions change
- `pwa.instructions.md`: When PWA development or caching patterns change
- `spec-plan-docs.instructions.md`: When specification/plan document standards change
- `specialist-agents.instructions.md`: When specialist agent patterns change
- `testing.instructions.md`: When testing patterns or requirements change
- `themes.instructions.md`: When theme architecture or patterns change
- `typescript.instructions.md`: When TypeScript coding standards change

### Code Quality Standards

See [typescript.instructions.md](.github/instructions/typescript.instructions.md) for comprehensive TypeScript coding standards including:
- Naming conventions (files, variables, constants)
- Type system best practices
- DRY principles and code organization
- Error handling patterns
- **Validation after code changes** (required)

### TSDoc and Code Documentation

> **📌 SINGLE SOURCE OF TRUTH**: See [documentation.instructions.md](.github/instructions/documentation.instructions.md) for ALL TSDoc and inline comment standards including right-sizing rules, tag requirements, and comment prefixes.

### Theme System Architecture

See [themes.instructions.md](.github/instructions/themes.instructions.md) for theme development guidance including:
- `THEME_REGISTRY` as single source of truth
- Required exports and naming conventions (`{camelCase}TimePageRenderer`, `{camelCase}LandingPageRenderer`)
- `TimePageRenderer` interface implementation
- Clean entry point pattern (index.ts exports only)
- Co-located tests with source files
- Cleanup and accessibility patterns

**Key principle**: The `ThemeId` type is automatically derived from `THEME_REGISTRY` keys - use registry utilities (`isValidThemeId`, `getThemeDisplayName`, `validateThemeId`) instead of hardcoding theme names.

### Code Smell Detection

Quality metrics used in code audits:
- **File-level thresholds**: >350 lines = split into focused modules
- **Function-level thresholds**: >40 lines = extract helper functions
- **Architecture violations**: core↔theme boundaries, cross-theme imports
- **Cleanup smells**: orphaned intervals, empty destroy methods

### Architectural Standards

The app uses a **modular, pluggable architecture** with clear separation of concerns:

**Orchestrator Pattern**:
- `orchestrator.ts` coordinates theme lifecycle and state management
- Extracted modules handle specific responsibilities:
  - `celebration-transitions.ts`: Transitions between celebration states
  - `controllers/page-controller.ts`: Unified animation state lifecycle
  - `theme-manager/theme-loader-factory.ts`: Theme loading and factory creation
  - `theme-manager/theme-switcher.ts`: Theme transition management
  - `time-manager/tick-scheduler.ts`: Countdown loop interval management
  - `time-manager/timer-playback-controls.ts`: Timer play/pause/reset controls
  - `time-manager/timezone-state-manager.ts`: Timezone state management
  - `ui/ui-chrome-visibility-manager.ts`: UI chrome visibility control
  - `ui/theme-color-manager.ts`: Theme color CSS variable application
  - `ui/ui-factory.ts`: Component creation/destruction lifecycle

**Component Modularization**:
- Large components (>300 lines) are broken into focused modules
- Example: `landing-page/` uses:
  - `validation.ts`: Form validation logic
  - `event-handlers.ts`: Event handling coordination
  - `dom-builders.ts`: DOM element construction
  - `form-controller.ts`: Form state and lifecycle management
  - `background-manager.ts`: Dynamic background effects
- Each module has comprehensive unit tests

**Theme Architecture**:
- Core app and themes have clear separation of concerns
- New themes are created via `npm run theme create <name>` (auto-registers)
- Each theme is self-contained in its own folder
- Tests are co-located with theme code

For code quality reviews and theme audits, use the **Specialist - Code Quality** agent who:
- Reviews architecture boundaries
- Detects code smells
- Identifies refactoring opportunities
- Validates separation of concerns

---

## Examples

### Path Alias Usage

```typescript
// ✅ Use path aliases for cleaner imports
import { getTimeRemaining } from '@core/time/time';
import { THEME_REGISTRY } from '@themes/registry';
import { fireworksTimePageRenderer } from '@themes/fireworks';
```

### Development Workflow

```bash
# Start development
npm run dev

# Run tests before committing
npm run test && npm run test:e2e

# Build for production
npm run build
```

---

## Anti-Patterns

| Anti-Pattern | Why It's Problematic | Better Approach |
|--------------|---------------------|-----------------|
| Hardcoded theme names | Breaks when themes added/removed | Use `isValidThemeId()` from registry |
| Deep relative imports | Fragile paths; hard to refactor | Use path aliases (`@core/`, `@themes/`) |
| Duplicate URL logic | Multiple sources of truth | Use utilities from `url.ts` |
| Inline CSS in components | Hard to maintain, no reuse | Extract to external CSS files |
| createElement() chains | Verbose, hard to visualize | Use HTML template literals |
| Inline style manipulation | Couples styling to JS | Use CSS classes and custom properties |
| 500+ line files | Hard to test, understand | Break into focused modules (<300 lines) |
| Skipping tests | Regressions slip through | Run `npm run test` before commits |
| Outdated instructions | Misleads future development | Update instruction files with code changes |
| `createThemeName` naming | Inconsistent with architecture | Use `themeNameTimePageRenderer` pattern |
| Generic registry properties | Non-descriptive API | Use `timePageRenderer`, `landingPageRenderer` |
| Implementation in index.ts | Hard to test, violates SRP | Move to dedicated renderer files |

---

## References

### Path-Specific Instructions (Auto-Loaded)
All files in `.github/instructions/` — loaded automatically based on `applyTo` patterns:

| File | Applies To | Purpose |
|------|------------|---------|
| [typescript.instructions.md](.github/instructions/typescript.instructions.md) | `**/*.{ts,tsx}` | TypeScript coding standards |
| [documentation.instructions.md](.github/instructions/documentation.instructions.md) | `**/*.{ts,tsx}` | **TSDoc and code documentation (SINGLE SOURCE OF TRUTH)** |
| [testing.instructions.md](.github/instructions/testing.instructions.md) | `**/*.{test,spec}.{ts,tsx}` | Vitest and Playwright patterns |
| [themes.instructions.md](.github/instructions/themes.instructions.md) | `src/themes/**/*.ts` | Theme architecture and lifecycle |
| [complex-theme-patterns.instructions.md](.github/instructions/complex-theme-patterns.instructions.md) | `src/themes/**/*.{ts,css,scss}` | Advanced patterns for complex themes |
| [pwa.instructions.md](.github/instructions/pwa.instructions.md) | `src/pwa/**/*.ts` | PWA development and caching |
| [github-actions.instructions.md](.github/instructions/github-actions.instructions.md) | `.github/workflows/**/*.{yml,yaml}` | CI/CD workflows |
| [custom-agents.instructions.md](.github/instructions/custom-agents.instructions.md) | `**/*.agent.md` | Agent file standards |
| [manager-agents.instructions.md](.github/instructions/manager-agents.instructions.md) | `.github/agents/manager-*.agent.md` | Manager orchestration |
| [specialist-agents.instructions.md](.github/instructions/specialist-agents.instructions.md) | `.github/agents/specialist-*.agent.md` | Specialist patterns |
| [prompt-files.instructions.md](.github/instructions/prompt-files.instructions.md) | `**/*.prompt.md` | Prompt file conventions |
| [spec-plan-docs.instructions.md](.github/instructions/spec-plan-docs.instructions.md) | `docs/{specs,plans}/*.md` | Specification standards |
| [assets-sync.instructions.md](.github/instructions/assets-sync.instructions.md) | `**/ASSETS.md` | Asset synchronization |
| [perf-analysis.instructions.md](.github/instructions/perf-analysis.instructions.md) | `**/*.{ts,tsx,spec.ts}` | Performance monitoring |
| [copilot-instructions.instructions.md](.github/instructions/copilot-instructions.instructions.md) | `**/{copilot-instructions.md,*.instructions.md}` | Instruction file standards |