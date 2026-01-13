/**
 * Theme Configuration Validation Utilities
 *
 * Shared validation functions for theme configuration files.
 * Used by validate-theme-configs.ts and other build scripts.
 *
 * @packageDocumentation
 */

import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Structured validation error with type, field, and message.
 */
export interface ValidationError {
  /** Error type (e.g., 'MISSING_FIELD', 'INVALID_FORMAT') */
  type: string;
  /** Field that failed validation */
  field: string;
  /** Human-readable error message */
  message: string;
  /** Optional suggestion for fixing the error */
  suggestion?: string;
}

/**
 * Result of a validation check with errors and warnings.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** List of validation errors */
  errors: ValidationError[];
  /** List of validation warnings (non-blocking) */
  warnings: ValidationError[];
}

/**
 * Minimal ThemeConfig interface for validation.
 * Matches the structure in src/themes/shared/types.ts.
 */
export interface ThemeConfigForValidation {
  id: string;
  name: string;
  description: string;
  publishedDate: string;
  author: string | null;
  colors?: {
    dark?: {
      accentPrimary?: string;
      accentSecondary?: string;
    };
    light?: {
      accentPrimary?: string;
      accentSecondary?: string;
    };
  };
  /** Optional npm dependencies used by the theme */
  dependencies?: Array<{ name: string; url: string }>;
}

// =============================================================================
// DATE VALIDATION
// =============================================================================

/**
 * Validate that a published date is in ISO 8601 YYYY-MM-DD format.
 *
 * @param date - Date string to validate
 * @returns Validation result with errors if invalid
 *
 * @example
 * ```typescript
 * const result = validatePublishedDateFormat('2024-12-18');
 * // { valid: true, errors: [], warnings: [] }
 *
 * const invalid = validatePublishedDateFormat('12/18/2024');
 * // { valid: false, errors: [{type: 'INVALID_FORMAT', ...}], warnings: [] }
 * ```
 */
export function validatePublishedDateFormat(date: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // ISO 8601 YYYY-MM-DD format
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!isoDateRegex.test(date)) {
    errors.push({
      type: 'INVALID_FORMAT',
      field: 'publishedDate',
      message: `Invalid date format: "${date}". Expected ISO 8601 format (YYYY-MM-DD).`,
      suggestion: 'Use format: 2024-12-18',
    });
    return { valid: false, errors, warnings };
  }

  // Validate it's a real date (not 2024-13-45)
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);

  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    errors.push({
      type: 'INVALID_DATE',
      field: 'publishedDate',
      message: `Invalid date: "${date}" is not a valid calendar date.`,
      suggestion: 'Check month (01-12) and day (01-31) values.',
    });
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors, warnings };
}

// =============================================================================
// AUTHOR VALIDATION
// =============================================================================

/**
 * Validate that an author field is either null or a valid GitHub username.
 *
 * GitHub username rules:
 * - 1-39 characters
 * - Alphanumeric or single hyphens
 * - Cannot start or end with hyphen
 * - Cannot have consecutive hyphens
 *
 * @param author - Author string to validate (or null)
 * @returns Validation result with errors if invalid
 *
 * @example
 * ```typescript
 * const result = validateAuthorFormat('chrisreddington');
 * // { valid: true, errors: [], warnings: [] }
 *
 * const nullResult = validateAuthorFormat(null);
 * // { valid: true, errors: [], warnings: [] }
 *
 * const invalid = validateAuthorFormat('invalid--username');
 * // { valid: false, errors: [{type: 'INVALID_FORMAT', ...}], warnings: [] }
 * ```
 */
export function validateAuthorFormat(author: string | null): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // null is valid (anonymous theme)
  if (author === null) {
    return { valid: true, errors, warnings };
  }

  // GitHub username rules: 1-39 chars, alphanumeric or single hyphens, no leading/trailing hyphens
  const githubUsernameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

  if (!githubUsernameRegex.test(author)) {
    errors.push({
      type: 'INVALID_FORMAT',
      field: 'author',
      message: `Invalid GitHub username format: "${author}".`,
      suggestion:
        'GitHub usernames: 1-39 chars, alphanumeric or single hyphens, no leading/trailing hyphens.',
    });
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors, warnings };
}

// =============================================================================
// PREVIEW FILE VALIDATION
// =============================================================================

/**
 * Validate that a theme's preview assets exist in the images/ subfolder.
 * Checks for both color modes: card images (.webp) and preview videos (.webm).
 *
 * @param themeId - Theme ID to check
 * @param themesDir - Base themes directory path (default: src/themes)
 * @returns Validation result with errors if files not found
 */
export async function validatePreviewExists(
  themeId: string,
  themesDir = 'src/themes',
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Images are now in the images/ subfolder
  const imagesDir = join(themesDir, themeId, 'images');
  
  // Required preview files:
  // - Card images for theme selector (.webp)
  // - Preview videos for theme modal (.webm)
  const requiredFiles = [
    'preview-dark-card-1x.webp',
    'preview-dark-card-2x.webp',
    'preview-light-card-1x.webp',
    'preview-light-card-2x.webp',
    'preview-dark.webm',
    'preview-light.webm',
  ];

  const missingFiles: string[] = [];

  for (const file of requiredFiles) {
    const filePath = join(imagesDir, file);
    try {
      await access(filePath, constants.R_OK);
    } catch {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    errors.push({
      type: 'MISSING_FILE',
      field: 'preview',
      message: `Missing preview files for theme "${themeId}": ${missingFiles.join(', ')}.`,
      suggestion: `Run: npm run generate:previews -- --theme=${themeId}`,
    });
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors, warnings };
}

// =============================================================================
// REQUIRED FIELDS VALIDATION
// =============================================================================

/**
 * Validate that all required ThemeConfig fields are present.
 *
 * Required fields: id, name, description, publishedDate, author
 *
 * @param config - Theme config object to validate
 * @returns Validation result with errors for missing fields
 *
 * @example
 * ```typescript
 * const config = { id: 'test', name: 'Test' };
 * const result = validateRequiredFields(config);
 * // { valid: false, errors: [missing description, publishedDate, author], warnings: [] }
 * ```
 */
export function validateRequiredFields(config: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (typeof config !== 'object' || config === null) {
    errors.push({
      type: 'INVALID_TYPE',
      field: 'config',
      message: 'Theme config must be an object.',
    });
    return { valid: false, errors, warnings };
  }

  const configObj = config as Record<string, unknown>;
  const requiredFields = ['id', 'name', 'description', 'publishedDate', 'author'];

  for (const field of requiredFields) {
    if (!(field in configObj)) {
      errors.push({
        type: 'MISSING_FIELD',
        field,
        message: `Missing required field: ${field}`,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// COLORS VALIDATION
// =============================================================================

/**
 * Validate that if colors are specified, both dark and light modes exist,
 * and each mode has accentPrimary.
 *
 * @param colors - Colors object from ThemeConfig
 * @returns Validation result with errors if invalid
 *
 * @example
 * ```typescript
 * const colors = {
 *   dark: { accentPrimary: '#fbbf24' },
 *   light: { accentPrimary: '#d97706' }
 * };
 * const result = validateColors(colors);
 * // { valid: true, errors: [], warnings: [] }
 * ```
 */
export function validateColors(
  colors: ThemeConfigForValidation['colors'],
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!colors) {
    return { valid: true, errors, warnings };
  }

  // If colors specified, both dark and light must exist
  const hasDark = colors.dark !== undefined;
  const hasLight = colors.light !== undefined;

  if (hasDark && !hasLight) {
    errors.push({
      type: 'MISSING_MODE',
      field: 'colors.light',
      message: 'If colors.dark is specified, colors.light must also be present.',
    });
  }

  if (hasLight && !hasDark) {
    errors.push({
      type: 'MISSING_MODE',
      field: 'colors.dark',
      message: 'If colors.light is specified, colors.dark must also be present.',
    });
  }

  // Each mode must have accentPrimary
  if (hasDark && !colors.dark?.accentPrimary) {
    errors.push({
      type: 'MISSING_FIELD',
      field: 'colors.dark.accentPrimary',
      message: 'colors.dark must have accentPrimary.',
    });
  }

  if (hasLight && !colors.light?.accentPrimary) {
    errors.push({
      type: 'MISSING_FIELD',
      field: 'colors.light.accentPrimary',
      message: 'colors.light must have accentPrimary.',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// REGISTRY MATCHING VALIDATION
// =============================================================================

/**
 * Validate that registry entry matches ThemeConfig values.
 *
 * @param registryEntry - Entry from THEME_REGISTRY
 * @param themeConfig - ThemeConfig from theme module
 * @returns Validation result with errors for mismatches
 *
 * @example
 * ```typescript
 * const result = validateRegistryMatch(
 *   { id: 'fireworks', displayName: 'Fireworks', author: 'chrisreddington' },
 *   { id: 'fireworks', name: 'Fireworks Celebration', author: 'chrisreddington', ... }
 * );
 * // { valid: true, errors: [], warnings: [] }
 * ```
 */
export function validateRegistryMatch(
  registryEntry: { id: string; displayName: string; author: string | null },
  themeConfig: ThemeConfigForValidation,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // ID must match
  if (registryEntry.id !== themeConfig.id) {
    errors.push({
      type: 'REGISTRY_MISMATCH',
      field: 'id',
      message: `Registry ID "${registryEntry.id}" does not match config ID "${themeConfig.id}".`,
    });
  }

  // Display name must match
  if (registryEntry.displayName !== themeConfig.name) {
    errors.push({
      type: 'REGISTRY_MISMATCH',
      field: 'name',
      message: `Registry displayName "${registryEntry.displayName}" does not match config name "${themeConfig.name}".`,
    });
  }

  // Author must match
  if (registryEntry.author !== themeConfig.author) {
    errors.push({
      type: 'REGISTRY_MISMATCH',
      field: 'author',
      message: `Registry author "${registryEntry.author}" does not match config author "${themeConfig.author}".`,
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// SUSPICIOUS PATTERN WARNINGS
// =============================================================================

/**
 * Check for suspicious patterns in theme configuration (warnings only).
 *
 * @param themeConfig - ThemeConfig to check
 * @returns Validation result with warnings (always valid: true)
 *
 * @example
 * ```typescript
 * const config = { id: 'test', name: 'Test', description: 'Short', ... };
 * const result = checkSuspiciousPatterns(config);
 * // { valid: true, errors: [], warnings: [{type: 'SUSPICIOUS_PATTERN', ...}] }
 * ```
 */
export function checkSuspiciousPatterns(
  themeConfig: ThemeConfigForValidation,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Short description (<20 chars)
  if (themeConfig.description.length < 20) {
    warnings.push({
      type: 'SUSPICIOUS_PATTERN',
      field: 'description',
      message: `Description is very short (${themeConfig.description.length} chars). Consider adding more detail.`,
    });
  }

  // Name/ID format mismatch (e.g., id: 'fireworks' but name: 'rockets')
  const idWords = themeConfig.id.split('-');
  const nameWords = themeConfig.name.toLowerCase().split(/\s+/);

  const idMatchesName = idWords.some((idWord) =>
    nameWords.some((nameWord) => nameWord.includes(idWord) || idWord.includes(nameWord)),
  );

  if (!idMatchesName) {
    warnings.push({
      type: 'SUSPICIOUS_PATTERN',
      field: 'name',
      message: `Theme name "${themeConfig.name}" doesn't seem to match ID "${themeConfig.id}".`,
      suggestion: 'Verify name/ID consistency.',
    });
  }

  return { valid: true, errors, warnings };
}
