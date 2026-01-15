# Third-Party Assets and Dependencies

This document lists all third-party assets, libraries, and data sources used in this project, along with their licenses and attribution.

## Runtime Dependencies

Libraries used in the production application.

| Name | Source URL | License | Description |
|------|------------|---------|-------------|
| @primer/octicons | [GitHub Octicons](https://primer.style/foundations/icons) | MIT | GitHub's icon library used for UI icons |
| suncalc | [mourner/suncalc](https://github.com/mourner/suncalc) | BSD-2-Clause | Sun position calculations for world map and Sun/Moon Shadow theme |

## Development Dependencies

Libraries and tools used for development, testing, and building.

| Name | Source URL | License | Description |
|------|------------|---------|-------------|
| Playwright | [playwright.dev](https://playwright.dev/) | Apache-2.0 | End-to-end testing framework |
| TypeScript | [typescriptlang.org](https://www.typescriptlang.org/) | Apache-2.0 | TypeScript language and compiler |
| Vite | [vitejs.dev](https://vitejs.dev/) | MIT | Next-generation frontend build tool |
| Vitest | [vitest.dev](https://vitest.dev/) | MIT | Unit testing framework |

## Theme-Specific Dependencies

Dependencies used by specific themes. See each theme's README for details.

| Theme | Dependency | Source URL | License |
|-------|------------|------------|---------|
| Fireworks | fireworks-js | [crashmax-dev/fireworks-js](https://github.com/crashmax-dev/fireworks-js) | MIT |
| Sun/Moon Shadow | suncalc | [mourner/suncalc](https://github.com/mourner/suncalc) | BSD-2-Clause |

## Data Sources

Data assets used in the application.

| Name | Source URL | License | Description |
|------|------------|---------|-------------|
| Natural Earth | [naturalearthdata.com](https://www.naturalearthdata.com/) | Public Domain | Simplified world map SVG path data |

## Icon Attribution

All icons in this project come from [GitHub Octicons](https://primer.style/foundations/icons), which is licensed under the MIT License.

## Adding New Dependencies

When adding new dependencies, please:

1. Verify the license is compatible with MIT
2. Add an entry to the appropriate table in this file
3. For theme-specific dependencies, also add them to the theme's `config.ts` in the `dependencies` array

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details on third-party asset requirements.
