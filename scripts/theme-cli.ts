#!/usr/bin/env npx tsx

/**
 * Unified Theme CLI
 *
 * Single entry point for all theme-related operations.
 *
 * Usage:
 *   npm run theme <command> [options]
 *
 * Commands:
 *   create <name>      Create a new theme scaffold
 *   generate:previews  Generate theme preview images
 *   list:labels        Output theme label data as JSON (for CI)
 *   list:ids           Output ALL theme IDs as JSON (for CI)
 *   list:json          Output full theme metadata as JSON (for CI)
 *   validate           Run all validations (colors + config)
 *   validate:colors    Color contrast validation only
 *   validate:config    Configuration validation only
 *   sync               Run all sync operations
 *   sync:readmes       Sync theme READMEs only
 *   sync:fixtures      Sync E2E fixtures only
 *   sync:templates     Sync issue templates only
 *
 * Options:
 *   --check            Exit with code 1 on failure (CI mode)
 *   --theme=<id>       Target specific theme
 *   --verbose          Show detailed output
 *   --allow-failures   Report failures but exit with code 0
 *   --skip-network     Skip network-based validations
 *   --force            Force overwrite (for generate:previews)
 *   --help, -h         Show help
 */

import { parseArgs } from 'node:util';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface CliOptions {
  command: string;
  check: boolean;
  theme?: string;
  verbose: boolean;
  allowFailures: boolean;
  skipNetwork: boolean;
  force: boolean;
  help: boolean;
  /** Extra positional args (for create command) */
  extraArgs: string[];
}

interface CommandResult {
  success: boolean;
  exitCode: number;
}

// =============================================================================
// ARGUMENT PARSING
// =============================================================================

function parseCliArgs(): CliOptions {
  const { values, positionals } = parseArgs({
    options: {
      check: { type: 'boolean', default: false },
      theme: { type: 'string' },
      verbose: { type: 'boolean', default: false },
      'allow-failures': { type: 'boolean', default: false },
      'skip-network': { type: 'boolean', default: false },
      force: { type: 'boolean', short: 'f', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  return {
    command: positionals[0] ?? 'help',
    check: Boolean(values.check),
    theme: typeof values.theme === 'string' ? values.theme : undefined,
    verbose: Boolean(values.verbose),
    allowFailures: Boolean(values['allow-failures']),
    skipNetwork: Boolean(values['skip-network']),
    force: Boolean(values.force),
    help: Boolean(values.help),
    extraArgs: positionals.slice(1),
  };
}

// =============================================================================
// HELP OUTPUT
// =============================================================================

function showHelp(): void {
  console.log(`
Unified Theme CLI

Single entry point for all theme operations.

Usage:
  npm run theme <command> [options]

Commands:
  create <name> [author]   Create a new theme scaffold
  generate:previews        Generate theme preview images
  list:labels              Output theme label data as JSON (for CI)
  list:ids                 Output ALL theme IDs as JSON (for CI)
  list:json                Output full theme metadata as JSON (for CI)
  validate                 Run all validations (colors + config)
  validate:colors          Color contrast validation only
  validate:config          Configuration validation only
  sync                     Run all sync operations
  sync:readmes             Sync theme READMEs only
  sync:fixtures            Sync E2E fixtures only
  sync:templates           Sync issue templates only

Options:
  --check              Exit with code 1 on failure (CI mode)
  --theme=<id>         Target specific theme
  --verbose            Show detailed output
  --allow-failures     Report failures but exit with code 0
  --skip-network       Skip network-based validations
  --force, -f          Force overwrite (for generate:previews)
  --help, -h           Show this help message

Examples:
  npm run theme create my-theme                  # Create new theme
  npm run theme create my-theme -- myusername   # Create with author
  npm run theme generate:previews               # Generate all previews
  npm run theme generate:previews -- --force    # Force regenerate all
  npm run theme generate:previews -- --theme=fireworks  # Single theme
  npm run theme validate                        # All validations
  npm run theme sync -- --check                 # Check all syncs
  npm run theme list:labels                     # Get theme data as JSON
`);
}

// =============================================================================
// COMMAND IMPLEMENTATIONS
// =============================================================================

async function runCreateTheme(options: CliOptions): Promise<CommandResult> {
  const themeName = options.extraArgs[0];
  const author = options.extraArgs[1];

  if (!themeName) {
    console.error('❌ Theme name required');
    console.error('   Usage: npm run theme create <theme-name> [author]');
    return { success: false, exitCode: 1 };
  }

  // Set up argv for create-theme script
  const originalArgv = process.argv;
  process.argv = ['node', 'create-theme', themeName];
  if (author) {
    process.argv.push(author);
  }

  try {
    await import('./create-theme/index.js');
    return { success: true, exitCode: 0 };
  } catch (error) {
    console.error('❌ Failed to create theme:', error);
    return { success: false, exitCode: 1 };
  } finally {
    process.argv = originalArgv;
  }
}

async function runGeneratePreviews(options: CliOptions): Promise<CommandResult> {
  const { generateThemePreviews, parsePreviewArgs } = await import(
    './image-generation/theme-previews.js'
  );

  // Build args array for the preview generator
  const args: string[] = [];
  if (options.theme) args.push(`--theme=${options.theme}`);
  if (options.force) args.push('--force');

  const previewOptions = parsePreviewArgs(args);

  try {
    await generateThemePreviews(previewOptions);
    return { success: true, exitCode: 0 };
  } catch (error) {
    console.error('❌ Failed to generate previews:', error);
    return { success: false, exitCode: 1 };
  }
}

async function runColorValidation(options: CliOptions): Promise<CommandResult> {
  const { runColorValidation: validate } = await import('./theme-validation/index.js');

  const exitCode = validate({
    theme: options.theme as import('./theme-colors/index.js').ValidationOptions['theme'],
    verbose: options.verbose,
    allowFailures: options.allowFailures,
  });

  return { success: exitCode === 0, exitCode };
}

async function runConfigValidation(options: CliOptions): Promise<CommandResult> {
  const { runConfigValidation: validate } = await import('./theme-validation/index.js');

  const exitCode = await validate({
    check: options.check,
    skipNetwork: options.skipNetwork,
    theme: options.theme,
  });

  return { success: exitCode === 0, exitCode };
}

async function runAllValidations(options: CliOptions): Promise<CommandResult> {
  console.log('🔍 Running all theme validations...\n');

  console.log('═'.repeat(60));
  console.log('📊 Color Contrast Validation');
  console.log('═'.repeat(60));
  const colorResult = await runColorValidation(options);

  console.log('\n');

  console.log('═'.repeat(60));
  console.log('📋 Configuration Validation');
  console.log('═'.repeat(60));
  const configResult = await runConfigValidation(options);

  const allPassed = colorResult.success && configResult.success;
  const exitCode = allPassed || options.allowFailures ? 0 : 1;

  console.log('\n');
  console.log('═'.repeat(60));
  console.log('📊 Validation Summary');
  console.log('═'.repeat(60));
  console.log(`Color Validation: ${colorResult.success ? '✅ Passed' : '❌ Failed'}`);
  console.log(`Config Validation: ${configResult.success ? '✅ Passed' : '❌ Failed'}`);

  return { success: allPassed, exitCode };
}

async function runReadmeSync(options: CliOptions): Promise<CommandResult> {
  const { syncReadmes, checkReadmesSync } = await import('./theme-sync/index.js');

  if (options.check) {
    const inSync = checkReadmesSync();
    return { success: inSync, exitCode: inSync ? 0 : 1 };
  }

  const success = syncReadmes();
  return { success, exitCode: success ? 0 : 1 };
}

async function runFixtureSync(options: CliOptions): Promise<CommandResult> {
  const { syncFixtures, checkFixturesSync } = await import('./theme-sync/index.js');

  if (options.check) {
    const inSync = await checkFixturesSync();
    return { success: inSync, exitCode: inSync ? 0 : 1 };
  }

  const success = await syncFixtures();
  return { success, exitCode: success ? 0 : 1 };
}

async function runTemplateSync(options: CliOptions): Promise<CommandResult> {
  const { syncTemplates, checkTemplatesSync } = await import('./theme-sync/index.js');

  if (options.check) {
    const inSync = checkTemplatesSync();
    return { success: inSync, exitCode: inSync ? 0 : 1 };
  }

  const success = syncTemplates();
  return { success, exitCode: success ? 0 : 1 };
}

/**
 * Output theme label data as JSON for CI workflows.
 * This allows workflows to get theme data without direct TypeScript imports.
 */
async function runListLabels(): Promise<CommandResult> {
  const { extractThemeLabelData } = await import('./theme-sync/index.js');

  try {
    const themes = extractThemeLabelData();
    console.log(JSON.stringify(themes));
    return { success: true, exitCode: 0 };
  } catch (error) {
    console.error('❌ Failed to extract theme data:', error);
    return { success: false, exitCode: 1 };
  }
}

/**
 * Output ALL theme IDs as JSON array for CI workflows.
 * Used by release workflow to detect new themes.
 */
async function runListIds(): Promise<CommandResult> {
  const { extractAllThemeIds } = await import('./theme-sync/index.js');

  try {
    const ids = extractAllThemeIds();
    console.log(JSON.stringify(ids));
    return { success: true, exitCode: 0 };
  } catch (error) {
    console.error('❌ Failed to extract theme IDs:', error);
    return { success: false, exitCode: 1 };
  }
}

/**
 * Output full theme metadata as JSON for CI workflows.
 * Used by release workflow to generate release notes.
 */
async function runListJson(): Promise<CommandResult> {
  const { extractAllThemeMetadata } = await import('./theme-sync/index.js');

  try {
    const themes = extractAllThemeMetadata();
    console.log(JSON.stringify(themes));
    return { success: true, exitCode: 0 };
  } catch (error) {
    console.error('❌ Failed to extract theme metadata:', error);
    return { success: false, exitCode: 1 };
  }
}

async function runAllSyncs(options: CliOptions): Promise<CommandResult> {
  console.log('🔄 Running all sync operations...\n');

  const results: { name: string; result: CommandResult }[] = [];

  console.log('═'.repeat(60));
  console.log('📖 Theme README Sync');
  console.log('═'.repeat(60));
  results.push({ name: 'README Sync', result: await runReadmeSync(options) });

  console.log('\n');

  console.log('═'.repeat(60));
  console.log('🧪 E2E Fixture Sync');
  console.log('═'.repeat(60));
  results.push({ name: 'Fixture Sync', result: await runFixtureSync(options) });

  console.log('\n');

  console.log('═'.repeat(60));
  console.log('📝 Issue Template Sync');
  console.log('═'.repeat(60));
  results.push({ name: 'Template Sync', result: await runTemplateSync(options) });

  const allPassed = results.every((r) => r.result.success);
  const exitCode = allPassed || options.allowFailures ? 0 : 1;

  console.log('\n');
  console.log('═'.repeat(60));
  console.log('🔄 Sync Summary');
  console.log('═'.repeat(60));
  for (const { name, result } of results) {
    console.log(`${name}: ${result.success ? '✅ Passed' : '❌ Failed'}`);
  }

  return { success: allPassed, exitCode };
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

async function main(): Promise<void> {
  const options = parseCliArgs();

  if (options.help || options.command === 'help') {
    showHelp();
    process.exit(0);
  }

  let result: CommandResult;

  switch (options.command) {
    case 'create':
      result = await runCreateTheme(options);
      break;
    case 'generate:previews':
      result = await runGeneratePreviews(options);
      break;
    case 'validate':
      result = await runAllValidations(options);
      break;
    case 'validate:colors':
      result = await runColorValidation(options);
      break;
    case 'validate:config':
      result = await runConfigValidation(options);
      break;
    case 'sync':
      result = await runAllSyncs(options);
      break;
    case 'sync:readmes':
      result = await runReadmeSync(options);
      break;
    case 'sync:fixtures':
      result = await runFixtureSync(options);
      break;
    case 'sync:templates':
      result = await runTemplateSync(options);
      break;
    case 'list:labels':
      result = await runListLabels();
      break;
    case 'list:ids':
      result = await runListIds();
      break;
    case 'list:json':
      result = await runListJson();
      break;
    default:
      console.error(`❌ Unknown command: ${options.command}`);
      console.error('   Run: npm run theme --help');
      process.exit(1);
  }

  process.exit(result.exitCode);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
