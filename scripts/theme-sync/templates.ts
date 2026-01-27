/**
 * Issue Template Synchronization
 *
 * Extracts theme names from THEME_REGISTRY and updates bug_report.yml
 * to keep the theme dropdown in sync with available themes.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { THEME_REGISTRY } from '../../src/themes/registry/registry-core.js';

/**
 * Theme data for labeling operations (id + display name).
 */
export interface ThemeLabelData {
  id: string;
  name: string;
}

/**
 * Full theme metadata for release announcements.
 */
export interface ThemeMetadataFull {
  id: string;
  name: string;
  description: string;
  author: string | null;
  publishedDate: string;
}

/**
 * Extract theme data (id and name) from THEME_REGISTRY.
 * Filters out themes where `availableInIssueTemplate` is explicitly set to false.
 *
 * @returns Array of theme data objects with id and name
 */
export function extractThemeLabelData(): ThemeLabelData[] {
  return Object.values(THEME_REGISTRY)
    .filter((theme) => theme.availableInIssueTemplate ?? true)
    .map((theme) => ({ id: theme.id, name: theme.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Extract theme display names from THEME_REGISTRY.
 * Filters out themes where `availableInIssueTemplate` is explicitly set to false.
 *
 * @returns Sorted array of theme display names
 */
export function extractThemeNames(): string[] {
  return extractThemeLabelData().map((theme) => theme.name);
}

/**
 * Extract ALL theme IDs from THEME_REGISTRY (no filtering).
 * Used by release workflow to detect new themes.
 *
 * @returns Sorted array of all theme IDs
 */
export function extractAllThemeIds(): string[] {
  return Object.keys(THEME_REGISTRY).sort();
}

/**
 * Extract full metadata for ALL themes from THEME_REGISTRY (no filtering).
 * Used by release workflow to generate release notes.
 *
 * @returns Array of full theme metadata
 */
export function extractAllThemeMetadata(): ThemeMetadataFull[] {
  return Object.values(THEME_REGISTRY)
    .map((theme) => ({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      author: theme.author,
      publishedDate: theme.publishedDate,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Update bug_report.yml with the provided theme list.
 *
 * @param themes - Display names to write into the options list
 */
function updateBugReportTemplate(themes: string[]): void {
  const templatePath = join(process.cwd(), '.github/ISSUE_TEMPLATE/bug_report.yml');
  const content = readFileSync(templatePath, 'utf-8');

  const lines = content.split('\n');
  let inThemeField = false;
  let inOptions = false;
  let optionsIndent = '';
  let optionsStart = -1;
  let optionsEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('id: theme')) {
      inThemeField = true;
    }

    if (inThemeField && line.includes('options:')) {
      inOptions = true;
      optionsStart = i;
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const match = nextLine.match(/^(\s*)-/);
        if (match) {
          optionsIndent = match[1];
        }
      }
    }

    if (
      inOptions &&
      (line.includes('validations:') ||
        (line.trim() && !line.includes('-') && !line.includes('options:')))
    ) {
      optionsEnd = i;
      break;
    }
  }

  if (optionsStart === -1 || !optionsIndent) {
    throw new Error('Could not find theme options in bug_report.yml');
  }

  const newOptions = [...themes, 'Not applicable / Not sure'];
  const optionLines = newOptions.map((theme) => `${optionsIndent}- ${theme}`);

  const newLines = [...lines.slice(0, optionsStart + 1), ...optionLines, ...lines.slice(optionsEnd)];

  writeFileSync(templatePath, newLines.join('\n'), 'utf-8');
  console.log(`✅ Updated bug_report.yml with ${themes.length} themes`);
  themes.forEach((theme) => console.log(`   - ${theme}`));
}

/**
 * Check if bug_report.yml theme options match the provided list.
 *
 * @param themes - Expected display names (excluding fallback)
 * @returns true when the template options match exactly
 */
function checkTemplateSync(themes: string[]): boolean {
  const templatePath = join(process.cwd(), '.github/ISSUE_TEMPLATE/bug_report.yml');
  const content = readFileSync(templatePath, 'utf-8');
  const lines = content.split('\n');

  let inThemeField = false;
  let inThemeOptions = false;
  const currentOptions: string[] = [];

  for (const line of lines) {
    if (line.includes('id: theme')) {
      inThemeField = true;
      continue;
    }

    if (inThemeField && line.includes('options:')) {
      inThemeOptions = true;
      continue;
    }

    if (inThemeOptions) {
      const match = line.match(/^\s*-\s*(.+)$/);
      if (match) {
        currentOptions.push(match[1]);
      } else if (
        line.includes('validations:') ||
        (line.trim() && !line.includes('-') && line.includes(':'))
      ) {
        break;
      }
    }
  }

  const expectedOptions = [...themes, 'Not applicable / Not sure'];

  if (currentOptions.length !== expectedOptions.length) {
    return false;
  }

  for (let i = 0; i < currentOptions.length; i++) {
    if (currentOptions[i] !== expectedOptions[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Sync issue templates from registry.
 *
 * @returns true if successful
 */
export function syncTemplates(): boolean {
  try {
    const themes = extractThemeNames();
    console.log(`📋 Found ${themes.length} themes in THEME_REGISTRY`);
    updateBugReportTemplate(themes);
    return true;
  } catch (error) {
    console.error('❌ Failed to sync templates:', error);
    return false;
  }
}

/**
 * Check if templates are in sync with registry.
 *
 * @returns true if in sync, false otherwise
 */
export function checkTemplatesSync(): boolean {
  try {
    const themes = extractThemeNames();
    console.log(`📋 Found ${themes.length} themes in THEME_REGISTRY`);

    const inSync = checkTemplateSync(themes);
    if (inSync) {
      console.log('✅ Issue template is in sync with THEME_REGISTRY');
      return true;
    }

    console.error('❌ Issue template is out of sync with THEME_REGISTRY');
    console.error('   Run: npm run theme sync:templates');
    return false;
  } catch (error) {
    console.error('❌ Failed to check template sync:', error);
    return false;
  }
}
