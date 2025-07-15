//   ____ _  __   ______  _   _   ____   ____ ___  ____  _____ 
//  / ___| | \ \ / /  _ \| | | | / ___| / ___/ _ \|  _ \| ____|
// | |  _| |  \ V /| |_) | |_| | \___ \| |  | | | | |_) |  _|  
// | |_| | |___| | |  __/|  _  |  ___) | |__| |_| |  __/| |___ 
//  \____|_____|_| |_|   |_| |_| |____/ \____\___/|_|   |_____|

'use strict';

/* ------------------------------------------------------------------------------------------------
 * 1. Define Unicode ranges
 *    [start code point, end code point, main label, (optional) sub label]
 *    Feel free to add/remove ranges as needed.
 * ------------------------------------------------------------------------------------------------ */
const CATEGORY_RANGES = [
    // Whitespace
    [0x0009, 0x000D, 'Whitespace'],
    [0x0020, 0x0020, 'Whitespace'],

    // ASCII punctuation & symbols
    [0x0021, 0x002F, 'Punctuation'],
    [0x003A, 0x0040, 'Punctuation'],
    [0x005B, 0x0060, 'Punctuation'],
    [0x007B, 0x007E, 'Punctuation'],
    [0x3000, 0x303F, 'Punctuation'],

    // ASCII digits & Latin
    [0x0030, 0x0039, 'Digit', 'ASCII'],
    [0x0041, 0x005A, 'Latin', 'Uppercase'],
    [0x0061, 0x007A, 'Latin', 'Lowercase'],

    // Hangul
    [0xAC00, 0xD7A3, 'Hangul', 'Syllable'],
    [0x1100, 0x11FF, 'Hangul', 'Jamo'],
    [0xA960, 0xA97F, 'Hangul', 'Jamo Ext‑A'],
    [0xD7B0, 0xD7FF, 'Hangul', 'Jamo Ext‑B'],
    [0x3130, 0x318F, 'Hangul', 'Compatibility Jamo'],

    // CJK Unified Ideographs (Han)
    [0x4E00, 0x9FFF, 'Han Ideograph'],
    [0x3400, 0x4DBF, 'Han Ideograph'],         // Ext‑A
    [0x20000, 0x2A6DF, 'Han Ideograph'],       // Ext‑B
    [0x2A700, 0x2B73F, 'Han Ideograph'],       // Ext‑C
    [0x2B740, 0x2B81F, 'Han Ideograph'],       // Ext‑D
    [0x2B820, 0x2CEAF, 'Han Ideograph'],       // Ext‑E
    [0x2CEB0, 0x2EBEF, 'Han Ideograph'],       // Ext‑F

    // Japanese
    [0x3040, 0x309F, 'Hiragana'],
    [0x30A0, 0x30FF, 'Katakana'],
    [0x31F0, 0x31FF, 'Katakana'],

    // Bopomofo
    [0x3100, 0x312F, 'Bopomofo'],

    // Greek & Coptic
    [0x0370, 0x03FF, 'Greek'],

    // Cyrillic
    [0x0400, 0x04FF, 'Cyrillic'],

    // Hebrew
    [0x0590, 0x05FF, 'Hebrew'],

    // Arabic
    [0x0600, 0x06FF, 'Arabic'],

    // Devanagari
    [0x0900, 0x097F, 'Devanagari'],

    // Thai
    [0x0E00, 0x0E7F, 'Thai'],

    // Emoji & popular symbols
    [0x1F600, 0x1F64F, 'Emoji'],   // Emoticons
    [0x1F300, 0x1F5FF, 'Emoji'],   // Symbols & Pictographs
    [0x1F680, 0x1F6FF, 'Emoji'],   // Transport & Map
    [0x1F1E6, 0x1F1FF, 'Emoji'],   // Regional Indicator Symbols
    [0x1F900, 0x1F9FF, 'Emoji'],   // Supplemental Pictographs
    [0x1FA70, 0x1FAFF, 'Emoji'],   // Extended Pictographs
    [0x2600, 0x26FF, 'Emoji'],     // Misc symbols
    [0x2700, 0x27BF, 'Emoji'],     // Dingbats
    [0xFE00, 0xFE0F, 'Emoji'],     // Variation Selectors
];

/* Ensure sorted (ascending by start code point) */
CATEGORY_RANGES.sort((a, b) => a[0] - b[0]);

/* ------------------------------------------------------------------------------------------------
 * 2. Internal utilities – range lookup via binary search
 * ------------------------------------------------------------------------------------------------ */
/**
 * Find the range containing a code point using binary search.
 * @param {number} cp - Unicode code point
 * @returns {{ main: string, sub?: string }} - Matched labels or 'Other'
 */
function _binarySearch(cp) {
    let lo = 0;
    let hi = CATEGORY_RANGES.length - 1;

    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const [start, end, main, sub] = CATEGORY_RANGES[mid];
        if (cp < start) hi = mid - 1;
        else if (cp > end) lo = mid + 1;
        else return { main, sub };
    }
    return { main: 'Other' };
}

/* Memoization cache – reuse results for frequently seen code points */
const _memo = new Map();

/* ------------------------------------------------------------------------------------------------
 * 3. Public API
 * ------------------------------------------------------------------------------------------------ */
/**
 * Classify a single character.
 * @param {string} char – A non‑empty string (only the first code point is used)
 * @returns {{ main: string, sub?: string }}
 */
function getCharacterType(char) {
    if (typeof char !== 'string' || char.length === 0) {
        throw new TypeError('getCharacterType expects a non‑empty string.');
    }
    const cp = char.codePointAt(0);
    let hit = _memo.get(cp);
    if (!hit) {
        hit = _binarySearch(cp);
        _memo.set(cp, hit);
    }
    return hit;
}

/**
 * Analyze a string and return per‑category statistics.
 * @param {string} text
 * @param {{ granularity?: 'main' | 'sub' }} [options]
 * @returns {{ total: number, breakdown: Record<string,{count:number,ratio:number,chars:string[]}> }}
 */
function analyzeText(text, { granularity = 'main' } = {}) {
    if (typeof text !== 'string') {
        throw new TypeError('Input must be a string.');
    }
    if (granularity !== 'main' && granularity !== 'sub') {
        throw new RangeError("granularity must be 'main' or 'sub'");
    }

    /** @type {Record<string, {count:number, chars:Set<string>}>} */
    const breakdown = Object.create(null);
    let total = 0;

    // ES2015 code‑point‑safe iteration
    for (const char of text) {
        const { main, sub } = getCharacterType(char);
        const label = granularity === 'sub' && sub ? `${main}:${sub}` : main;

        let bucket = breakdown[label];
        if (!bucket) bucket = breakdown[label] = { count: 0, chars: new Set() };

        bucket.count++;
        bucket.chars.add(char);
        total++;
    }

    // Post‑processing: compute ratios and sort chars
    for (const k in breakdown) {
        const b = breakdown[k];
        b.ratio = +(b.count * 100 / total).toFixed(2);
        b.chars = Array.from(b.chars).sort();
    }

    return { total, breakdown };
}

/* ------------------------------------------------------------------------------------------------
 * 4. Module export
 * ------------------------------------------------------------------------------------------------ */
export { getCharacterType, analyzeText };
