# Contributing to Timestamp

Thank you for your interest in contributing to Timestamp! We welcome contributions of all kinds, especially new themes.

## ⚡ Quick Command Reference

| Command                          | Description                              |
| --------------------------------- | ---------------------------------------- |
| `npm install`                    | Install dependencies                     |
| `npm run dev`                    | Start development server (port 5173)    |
| `npm run build`                  | Build for production                     |
| `npm run test`                   | Run unit tests (Vitest)                  |
| `npm run test:e2e`               | Fast E2E tests (Chromium, excludes @perf) |
| `npm run test:e2e:cross-browser` | E2E tests across all browsers            |
| `npm run test:e2e:perf`          | Performance profiling tests (long)       |
| `npm run test:e2e:full`          | Complete E2E suite (CI)                  |
| `npm run lint`                   | Run ESLint                               |
| `npm run theme create <name>`    | Scaffold a new theme                     |
| `npm run validate:iteration`     | Fast validation (for development)        |
| `npm run validate:full`          | Complete validation (before PR)          |

**Validation before PR:**

```bash
# Fast validation (for iterative development)
npm run validate:iteration

# Complete validation (before pushing)
npm run validate:full
```

## 🤖 GitHub Copilot Support

Timestamp is optimized for GitHub Copilot users! We provide:

- **📋 Custom Instructions** ([`.github/instructions/`](.github/instructions/README.md))
  Coding standards, patterns, and best practices automatically injected based on file type
- **🤝 Custom Agents** ([`.github/agents/`](.github/agents/README.md)) - Specialized
  AI agents for testing, documentation, and domain-specific tasks
- **⚡ Prompt Files** ([`.github/prompts/`](.github/prompts/README.md)) - Reusable
  prompt templates for common tasks

### Using GitHub Copilot in Timestamp

When you open files in VS Code with GitHub Copilot:

- Instruction files automatically provide context based on what you're editin
- Select the custom agent from the Copilot chat pane for specialized help
- Use `/prompt-name` to trigger reusable workflows

**Learn more:**

- [GitHub Copilot Custom Instructions](
  https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)
- [About GitHub Copilot Chat](
  https://docs.github.com/en/copilot/using-github-copilot/asking-github-copilot-questions-in-your-ide)

## 🎨 Contributing a New Theme

The best way to contribute is by creating a new theme! The app is designed to make this straightforward.

### Quick Start

1. **Fork and clone** the repository
2. **Install dependencies**: `npm install`
3. **Start development server**: `npm run dev`
4. **Create your theme** in `src/themes/your-theme/`

See the complete [Theme Development Guide](docs/THEME_DEVELOPMENT.md) for
step-by-step instructions, including:

- ThemeController interface requirements
- Registration process
- Testing guidelines
- Performance best practices

### Theme Requirements

Run `npm run theme create my-theme` to scaffold a new theme with all required
files. The script automatically registers your theme - you just need to:

- ✅ Implement the `TimePageRenderer` interface (10 methods) - scaffold provided
- ✅ Include required test selectors (`data-testid` attributes) - scaffold
  provided
- ✅ Support `prefers-reduced-motion` for accessibility - scaffold provided
- ✅ Clean up all resources on destroy (no memory leaks) - scaffold provided
- ✅ Generate preview images and videos: `npm run generate:previews -- --theme=your-theme`

### Theme CLI Commands

The unified theme CLI provides commands for validation and synchronization:

```bash
# Create a new theme
npm run theme create <theme-name>           # Basic scaffold
npm run theme create <theme-name> author    # With author name

# Generate preview images AND videos (requires build first)
npm run generate:previews               # All themes (images + videos)
npm run generate:previews -- --theme=<id>   # Single theme only
npm run generate:previews -- --force    # Force regenerate all
npm run generate:previews -- --media=images # Images only
npm run generate:previews -- --media=videos # Videos only

# Validation commands
npm run theme validate              # All validations (colors + config)
npm run theme validate:colors       # Color contrast only
npm run theme validate:config       # Config schema only

# Sync commands (keep docs/fixtures in sync)
npm run theme sync                  # All sync operations
npm run theme sync:readmes          # Theme READMEs only
npm run theme sync:fixtures         # E2E fixtures only
npm run theme sync:templates        # Issue templates only
```

### Theme License Agreement

By contributing a theme to Timestamp, you agree to the following terms:

All theme contributions are licensed under the **MIT License**, consistent with
the main project. By submitting a theme, you agree that:

1. **You have the rights to contribute the code and any assets as part of the
   theme**
2. **Your contribution will be licensed under MIT** meaning that others can use,
   modify, and distribute your theme freely
3. **You grant permission for inclusion**, so it may be bundled, modified, and 
   redistributed as part of this project

### Third-Party Assets

If your theme includes third-party assets, you **must**:

- Include license, copyright, and source information for images, icons and SVGs
- Verify license compatibility for fonts
- Verify license compatibility for any libraries that you may depend on

#### Documenting Third-Party Assets

Add an `ASSETS.md` file to your theme folder documenting all third-party content:

```markdown
# Third-Party Assets

## Icons
- **Icon Set Name**: [Source URL](https://example.com)
  - License: MIT
  - Copyright: © 2024 Author Name

## Fonts
- **Font Name**: [Source URL](https://fonts.google.com/specimen/FontName)
  - License: SIL Open Font License 1.1

## Images
- **background-pattern.svg**: [Source URL](https://example.com)
  - License: CC0 Public Domain
```

For npm packages, add them to the `dependencies` array in your theme's `config.ts`:

```typescript
dependencies: [
  { name: 'my-library', url: 'https://github.com/owner/my-library' }
],
```

This automatically generates a Dependencies section in your theme's README and the in-app tooltips.

### Assets You Cannot Use

Some content is **not permitted** in theme contributions:

- Company logos/trademarks
- Copyrighted characters  
- Content you don't have rights to
- Non-commercial licensed content

When in doubt, check [Choose a License](https://choosealicense.com/appendix/) 
or ask in an issue.

### Licensing and Third-Party Assets

By contributing a theme, you agree that:

- **Your theme is licensed under MIT** — same as the main project
- **You have the rights to contribute** — you authored it, or it's from
  MIT-compatible sources
- **Third-party assets must be documented** — include license, copyright, and
  source for any icons, fonts, or images you didn't create

⚠️ **Not permitted**: Company logos/trademarks, copyrighted characters or content with non-commercial restrictions.

### Testing Your Theme

Tests are organized using a hybrid pattern:

- **Unit tests** (`.test.ts`): Co-located with source files in `src/themes/your-theme/`
- **Theme-specific E2E tests**: Co-located in `src/themes/your-theme/e2e/`
- **Cross-cutting E2E tests**: In `e2e/` for tests spanning multiple themes

```bash
npm run test              # Unit tests
npm run test:e2e          # E2E tests (includes theme-specific tests)
npm run build             # Type-check and build
```

All tests must pass before submitting a PR.

## 🐛 Bug Reports

Found a bug? Please [open an issue](https://github.com/chrisreddington/timestamp/issues/new?template=bug_report.yml) with:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS information
- Screenshots (if applicable)

## 💡 Feature Requests

Have an idea? Please [open an issue](https://github.com/chrisreddington/timestamp/issues/new?template=feature_request.yml) with:

- Description of the feature
- Use case and motivation
- Proposed implementation (optional)

## 🏗️ Development Environments

### Local Setup

The standard approach:

```bash
git clone https://github.com/chrisreddington/timestamp.git
cd countdown
npm install
npm run dev
```

### GitHub Codespaces

**Want to develop in the cloud?** GitHub Codespaces gives you a complete, browser-based development environment:

1. Click the green "Code" button on this repo
2. Select "Codespaces" tab
3. Click "Create codespace on main"

You'll get a fully configured VS Code environment in your browser with all
dependencies installed. Perfect for quick contributions or testing on different
machines.

[Learn more about Codespaces](https://docs.github.com/en/codespaces/overview)

### Dev Containers

**Prefer developing locally with Docker?** Dev containers provide a consistent,
containerized development environment:

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Install the [Dev Containers extension](
   https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
   for VS Code
3. Open this repo in VS Code
4. When prompted, click "Reopen in Container" (or run command: "Dev Containers: Reopen in Container")

The container includes all required tools and dependencies. Changes you make are instantly reflected, just like local development.

[Learn more about Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)

## 📝 Code Standards

Timestamp follows these conventions:

- **TypeScript** with strict mode enabled
- **ESLint** for code quality
- **Prettier** for formatting (via ESLint)
- **Vitest** for unit tests
- **Playwright** for E2E tests

### Before Submitting

1. ✅ Run `npm run lint` and fix any issues
2. ✅ Run `npm run test` and ensure all tests pass
3. ✅ Run `npm run test:e2e` for E2E validation
4. ✅ Add tests for new functionality
5. ✅ Update documentation if needed

## 🔄 Pull Request Process

1. **Create a branch** from `main` with a descriptive name:
   - `feature/new-theme-name` for new themes
   - `fix/bug-description` for bug fixes
   - `docs/description` for documentation

2. **Make your changes** following the code standards

3. **Write tests** for new functionality

4. **Update documentation** if you're changing behavior

5. **Submit a PR** with:
   - Clear title describing the change
   - Description of what and why
   - Screenshots for UI changes
   - Reference to related issues

6. **Respond to feedback** - maintainers may request changes

## 🎯 Good First Issues

New to the project? Look for issues labeled `good first issue` - these are great starting points. We also use the `help wanted` label for tasks that need attention, so keep watch for those!

## 📜 Code of Conduct

Timestamp follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## 📄 License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## ❓ Questions?

Not sure about something? Open an [issue](https://github.com/chrisreddington/timestamp/issues/new) - we're here to help!

## 🙏 Thank You

Every contribution, no matter how big or small, is valuable, whether that's a documentation update, feature suggestion, bug fix, or new feature. Thank you for helping make Timestamp better!
