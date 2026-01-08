# ⏱️ Timestamp

**Your stamp on time.**

[![CI/CD Status](https://github.com/chrisreddington/timestamp/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/chrisreddington/timestamp/actions/workflows/ci-cd.yml)

[**Try it now →**](https://chrisreddington.com/timestamp/) No signup. No install. Just go.

## What is Timestamp?

Timestamp is a countdown app where **every countdown is a URL**. Pick a date, choose a theme, add a message. Your countdown gets a unique link that works for anyone who opens it. Pure client-side magic.

**Use it for:**

- 🎆 New Year's Eve countdowns with friends worldwide
- ⏱️ Pomodoro timers and meeting breaks  
- 🚀 Product launches and livestream hype
- 🎂 Birthday countdowns to share on social media

## Three Countdown Modes

Timestamp supports three distinct countdown modes, each designed for different use cases:

| Mode | Try it | What it does |
|------|--------|--------------|
| **🏠 Local Time** — *Wall clock* | [🎆 New Year 2027](https://chrisreddington.com/timestamp/?mode=wall-clock&target=2027-01-01T00:00:00&theme=fireworks) | Countdown to midnight in *your* timezone. Each city celebrates at their own midnight. |
| **🌐 Same Moment** — *Absolute time* | [🚀 Product launch](https://chrisreddington.com/timestamp/?mode=absolute&target=2026-07-01T17:00:00Z&theme=contribution-graph&message=Launch%20Day!) | Everyone counts to the same instant worldwide. Perfect for product launches or global livestreams. |
| **⏱️ Timer** — *Your countdown* | [⏱️ 5-minute break](https://chrisreddington.com/timestamp/?mode=timer&duration=300&theme=contribution-graph&message=Break%20time!) | Fixed duration countdown. Starts when you open the link. Great for Pomodoro sessions. |

> 💡 **Tip:** The timer example is great for seeing the celebration animation when it hits zero!

## Available Themes

Find all the themes in the [Theme Gallery](src/themes/README.md), and experience them for yourself on [Timestamp](https://chrisreddington.com/timestamp/).

## Features

### 🔗 Instant URL Sharing
Every configuration generates a shareable URL. Change any setting and the URL updates automatically — just copy and share.

### 📱 Install as an App
Timestamp is a Progressive Web App (PWA), which means you can install it from your browser:

- **Desktop** (Chrome/Edge): Click ⊕ in the address bar
- **iOS**: Share → "Add to Home Screen"
- **Android**: Menu → "Install app"

#### PWA Features

- **Offline support**: The app works without an internet connection after the first visit
- **Full-screen mode**: Runs like a native app when installed
- **Automatic updates**: The app checks for updates and prompts you to refresh

> **Note on notifications**: Notifications were investigated but are not currently implemented. Local browser notifications only work on macOS/iOS while the app is open. Arguably this could be useful if you're switching browser tabs, but may not be worth the additional complexity. Background notifications would require server infrastructure (Web Push via APNs/FCM). See [PWA instructions](.github/instructions/pwa.instructions.md#notifications---not-currently-implemented) for details.

### 🗺️ World Map
Wall-clock mode shows a day/night map with real-time solar position. You can see which cities are celebrating and which are waiting.

### ☀️ Shadow & Sun Angle
Calculate the sun's altitude, azimuth, and estimated shadow length from an object height using your location and current time. Available from the landing page calculator or while viewing the Contribution Graph theme.

### ♿ Accessibility
- Full keyboard navigation
- Screen reader announcements for countdown updates (via orchestrator's `AccessibilityManager`)
- Orchestrator provides accessibility hooks (`onAnimationStateChange`) and foundations (`reducedMotionManager`, `data-reduced-motion` attribute, container ARIA attributes) that themes implement to ensure consistent behavior across all themes


## Run Locally

```bash
git clone https://github.com/chrisreddington/timestamp.git
cd timestamp
npm install
npm run dev
```

Open `http://localhost:5173`. That's it.

> **Prefer ephemeral environments?** Development works great in [GitHub Codespaces](https://docs.github.com/en/codespaces/overview) or [Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers).


## For Developers

Timestamp uses a **modular, pluggable architecture**. The core app handles timing and state management, and provides accessibility foundations (reduced motion detection, screen reader announcements, ARIA structure). Themes handle rendering and implement accessibility hooks (responding to animation state changes, ensuring color contrast). This separation means you can build wildly creative themes without touching countdown logic.

### Quick Links

| I want to... | Go here |
|--------------|---------|
| **Build a new theme** | [Theme Development Guide](docs/THEME_DEVELOPMENT.md) |
| **Understand the architecture** | [Architecture Overview](docs/ARCHITECTURE.md) |
| **See URL parameters** | [Deep Linking Reference](docs/DEEP-LINKING.md) |
| **Fix a bug or add a feature** | [Contributing Guide](CONTRIBUTING.md) |

### Architecture at a Glance

```
src/
├── app/
│   ├── orchestrator/     # Core coordinator — timing, state, theme lifecycle
│   └── pwa/              # Service worker and PWA setup
├── themes/               # Pluggable visual renderers
│   ├── registry/         # Single source of truth for theme metadata
│   ├── contribution-graph/
│   ├── fireworks/
│   └── shared/           # Cleanup utilities shared by all themes
├── components/           # UI components (landing page, buttons, world map)
└── core/                 # Shared types, state management, utilities
```

**Key concept:** The **orchestrator** decides *when* to update. **Themes** decide *how* to render. The orchestrator handles timing accuracy, tab visibility, reduced motion, and celebration state — themes just respond to lifecycle callbacks.

📖 **Full details:** [Architecture Overview](docs/ARCHITECTURE.md)

### Build a Theme in 5 Minutes

```bash
npm run theme create my-theme
npm run generate:previews -- --theme=my-theme
npm run dev
```

Visit `http://localhost:5173/?mode=timer&duration=30&theme=my-theme` to see your theme in action.

📖 **Full guide:** [Theme Development Guide](docs/THEME_DEVELOPMENT.md)

## Contributing

| I want to... | Start here |
|--------------|-----------|
| Report a bug | [Open an issue](https://github.com/chrisreddington/timestamp/issues/new) |
| Build a theme | [Theme Development Guide](docs/THEME_DEVELOPMENT.md) |
| Fix something | [Open issues](https://github.com/chrisreddington/timestamp/issues) · [Contributing Guide](CONTRIBUTING.md) |

### Validation Before PR

```bash
npm run validate:iteration
```

This runs: typecheck → lint → unit tests → build → E2E tests

## Learn More

| Topic | Link |
|-------|------|
| Architecture deep dive | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Building themes | [docs/THEME_DEVELOPMENT.md](docs/THEME_DEVELOPMENT.md) |
| URL parameters | [docs/DEEP-LINKING.md](docs/DEEP-LINKING.md) |
| Code of Conduct | [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) |
| Security Policy | [SECURITY.md](SECURITY.md) |

## License

[MIT](LICENSE)


**[Try the app →](https://chrisreddington.com/timestamp/)**
