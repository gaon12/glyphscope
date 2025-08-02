/**
 * Unicode character classification library type definitions
 */

/**
 * Character type classification result
 */
export interface CharacterType {
  /** Main category (e.g., 'Latin', 'Hangul', 'Han Ideograph', 'Emoji') */
  main: string;
  /** Optional sub-category (e.g., 'Uppercase', 'Lowercase', 'Syllable') */
  sub?: string;
}

/**
 * Analysis options for text processing
 */
export interface AnalyzeOptions {
  /** 
   * Level of detail for categorization
   * - 'main': Use only main categories
   * - 'sub': Use sub-categories when available (format: "main:sub")
   * @default 'main'
   */
  granularity?: 'main' | 'sub';
}

/**
 * Statistics for a single character category
 */
export interface CategoryStats {
  /** Number of characters in this category */
  count: number;
  /** Percentage ratio of total characters (0-100, rounded to 2 decimal places) */
  ratio: number;
  /** Unique characters found in this category, sorted alphabetically */
  chars: string[];
}

/**
 * Complete text analysis result
 */
export interface TextAnalysis {
  /** Total number of characters analyzed */
  total: number;
  /** Per-category breakdown of character statistics */
  breakdown: Record<string, CategoryStats>;
}

/**
 * Classify a single character into Unicode categories.
 * 
 * @param char - A non-empty string (only the first code point is used)
 * @returns Character type classification with main and optional sub-category
 * @throws {TypeError} When input is not a non-empty string
 * 
 * @example
 * ```typescript
 * getCharacterType('A'); // { main: 'Latin', sub: 'Uppercase' }
 * getCharacterType('가'); // { main: 'Hangul', sub: 'Syllable' }
 * getCharacterType('😀'); // { main: 'Emoji' }
 * ```
 */
export function getCharacterType(char: string): CharacterType;

/**
 * Analyze a string and return detailed statistics about character categories.
 * 
 * @param text - The text to analyze
 * @param options - Analysis configuration options
 * @returns Comprehensive analysis with total count and per-category breakdown
 * @throws {TypeError} When text is not a string
 * @throws {RangeError} When granularity is not 'main' or 'sub'
 * 
 * @example
 * ```typescript
 * // Basic analysis
 * analyzeText('Hello 안녕'); 
 * // { total: 8, breakdown: { Latin: { count: 5, ratio: 62.5, chars: ['H','e','l','o'] }, ... } }
 * 
 * // With sub-categories
 * analyzeText('Hello', { granularity: 'sub' });
 * // { total: 5, breakdown: { 'Latin:Uppercase': { count: 1, ... }, 'Latin:Lowercase': { count: 4, ... } } }
 * ```
 */
export function analyzeText(text: string, options?: AnalyzeOptions): TextAnalysis;