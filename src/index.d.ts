/**
 * Unicode character classification library type definitions.
 */

/**
 * Known primary categories returned by GlyphScope.
 *
 * The runtime may add more script labels over time, but these are the
 * categories currently documented and exercised by the public API.
 */
export type CharacterMainCategory =
  | 'Whitespace'
  | 'Control'
  | 'Digit'
  | 'Latin'
  | 'Hangul'
  | 'Han Ideograph'
  | 'Hiragana'
  | 'Katakana'
  | 'Bopomofo'
  | 'Greek'
  | 'Cyrillic'
  | 'Hebrew'
  | 'Arabic'
  | 'Devanagari'
  | 'Bengali'
  | 'Gurmukhi'
  | 'Gujarati'
  | 'Odia'
  | 'Tamil'
  | 'Telugu'
  | 'Kannada'
  | 'Malayalam'
  | 'Sinhala'
  | 'Thai'
  | 'Lao'
  | 'Khmer'
  | 'Myanmar'
  | 'Tibetan'
  | 'Mongolian'
  | 'Armenian'
  | 'Georgian'
  | 'Ethiopic'
  | 'Cherokee'
  | 'Canadian Aboriginal'
  | 'Runic'
  | 'Ogham'
  | 'Yi'
  | 'Emoji'
  | 'Format'
  | 'Letter'
  | 'Mark'
  | 'Number'
  | 'Punctuation'
  | 'Symbol'
  | 'Separator'
  | 'Other';

/**
 * Known sub-categories returned by GlyphScope.
 */
export type CharacterSubCategory =
  | 'Uppercase'
  | 'Lowercase'
  | 'ASCII'
  | 'Decimal'
  | 'Syllable'
  | 'Jamo'
  | 'Jamo Ext‑A'
  | 'Jamo Ext‑B'
  | 'Compatibility Jamo'
  | 'Letter'
  | 'Other Script'
  | 'Space Separator'
  | 'Fixed-Width Space'
  | 'Control:Tab'
  | 'Control:Line Break'
  | 'Invisible:Zero Width'
  | 'Variation Selector'
  | 'Extended Pictographic'
  | 'Emoji Component'
  | 'ZWJ'
  | 'ZWNJ'
  | 'BOM/ZWNBS';

/**
 * Character type classification result.
 */
export interface CharacterType {
  /** Main category (for example, 'Latin', 'Hangul', or 'Emoji'). */
  main: CharacterMainCategory;
  /** Optional sub-category (for example, 'Uppercase' or 'Syllable'). */
  sub?: CharacterSubCategory;
}

/**
 * Analysis options for text processing.
 */
export interface AnalyzeOptions {
  /**
   * Level of detail for categorization.
   *
   * - 'main': use only the main category.
   * - 'sub': include the sub-category when available using the format 'main:sub'.
   *
   * @default 'main'
   */
  granularity?: 'main' | 'sub';
}

/**
 * Statistics for a single character category.
 */
export interface CategoryStats {
  /** Number of code points in this category. */
  count: number;
  /** Percentage ratio of total code points, rounded to two decimal places. */
  ratio: number;
  /** Unique characters found in this category, sorted in ascending order. */
  chars: string[];
}

/**
 * Complete text analysis result.
 */
export interface TextAnalysis {
  /** Total number of code points analysed. */
  total: number;
  /** Per-category breakdown of character statistics. */
  breakdown: Record<string, CategoryStats>;
}

/**
 * Classify a single character into Unicode-related categories.
 *
 * Only the first Unicode code point from the provided string is used.
 *
 * @param char - A non-empty string.
 * @returns Character type classification with a main and optional sub-category.
 * @throws {TypeError} When the input is not a non-empty string.
 */
export function getCharacterType(char: string): CharacterType;

/**
 * Analyse a string and return statistics about its character categories.
 *
 * Iteration is performed by Unicode code point, not grapheme cluster.
 *
 * @param text - The text to analyse.
 * @param options - Analysis configuration options.
 * @returns A breakdown of per-category counts, ratios, and unique characters.
 * @throws {TypeError} When text is not a string.
 * @throws {RangeError} When granularity is not 'main' or 'sub'.
 */
export function analyzeText(text: string, options?: AnalyzeOptions): TextAnalysis;
