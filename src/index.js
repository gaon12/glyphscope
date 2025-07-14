//   ____ _  __   ______  _   _   ____   ____ ___  ____  _____ 
//  / ___| | \ \ / /  _ \| | | | / ___| / ___/ _ \|  _ \| ____|
// | |  _| |  \ V /| |_) | |_| | \___ \| |  | | | | |_) |  _|  
// | |_| | |___| | |  __/|  _  |  ___) | |__| |_| |  __/| |___ 
//  \____|_____|_| |_|   |_| |_| |____/ \____\___/|_|   |_____|


/* ------------------------------------------------------------------------------------------------
 * CATEGORY DEFINITIONS
 * ------------------------------------------------------------------------------------------------
 * Each rule contains:
 *   - test(cp) → boolean        // range predicate
 *   - main : string             // top‑level label
 *   - sub  : string | undefined // optional refined label
 * The array is ordered so that frequently‑encountered ranges are early for average O(1) speed.
 */
const CATEGORY_RULES = [
    // Whitespace – most common
    { test: cp => cp === 0x0020 || (cp >= 0x0009 && cp <= 0x000D), main: 'Whitespace' },

    // Hangul (Korean)
    { test: cp => cp >= 0xAC00 && cp <= 0xD7A3, main: 'Hangul', sub: 'Syllable' },
    { test: cp => cp >= 0x1100 && cp <= 0x11FF, main: 'Hangul', sub: 'Jamo' },
    { test: cp => cp >= 0x3130 && cp <= 0x318F, main: 'Hangul', sub: 'Compatibility Jamo' },

    // Latin (ASCII)
    { test: cp => cp >= 0x0041 && cp <= 0x005A, main: 'Latin', sub: 'Uppercase' },
    { test: cp => cp >= 0x0061 && cp <= 0x007A, main: 'Latin', sub: 'Lowercase' },

    // Digits (ASCII)
    { test: cp => cp >= 0x0030 && cp <= 0x0039, main: 'Digit', sub: 'ASCII' },

    // CJK Unified Ideographs (Han)
    { test: cp => (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF), main: 'Han Ideograph' },

    // Kana & Japanese blocks
    { test: cp => cp >= 0x3040 && cp <= 0x309F, main: 'Hiragana' },
    { test: cp => (cp >= 0x30A0 && cp <= 0x30FF) || (cp >= 0x31F0 && cp <= 0x31FF), main: 'Katakana' },

    // Bopomofo
    { test: cp => cp >= 0x3100 && cp <= 0x312F, main: 'Bopomofo' },

    // Greek & Coptic
    { test: cp => cp >= 0x0370 && cp <= 0x03FF, main: 'Greek' },

    // Cyrillic
    { test: cp => cp >= 0x0400 && cp <= 0x04FF, main: 'Cyrillic' },

    // Hebrew
    { test: cp => cp >= 0x0590 && cp <= 0x05FF, main: 'Hebrew' },

    // Arabic
    { test: cp => cp >= 0x0600 && cp <= 0x06FF, main: 'Arabic' },

    // Devanagari
    { test: cp => cp >= 0x0900 && cp <= 0x097F, main: 'Devanagari' },

    // Thai
    { test: cp => cp >= 0x0E00 && cp <= 0x0E7F, main: 'Thai' },

    // Emoji – popular blocks
    {
        test: cp =>
            (cp >= 0x1F600 && cp <= 0x1F64F) || // Emoticons
            (cp >= 0x1F300 && cp <= 0x1F5FF) || // Symbols & Pictographs
            (cp >= 0x1F680 && cp <= 0x1F6FF) || // Transport & Map
            (cp >= 0x2600 && cp <= 0x26FF)   || // Misc symbols
            (cp >= 0x2700 && cp <= 0x27BF)   || // Dingbats
            (cp >= 0xFE00 && cp <= 0xFE0F)   || // Variation selectors
            (cp >= 0x1F900 && cp <= 0x1F9FF),   // Supplemental Pictographs
        main: 'Emoji',
    },

    // Punctuation & Symbols (ASCII + CJK)
    {
        test: cp =>
            (cp >= 0x0021 && cp <= 0x002F) ||
            (cp >= 0x003A && cp <= 0x0040) ||
            (cp >= 0x005B && cp <= 0x0060) ||
            (cp >= 0x007B && cp <= 0x007E) ||
            (cp >= 0x3000 && cp <= 0x303F),
        main: 'Punctuation',
    },
];

/* ------------------------------------------------------------------------------------------------
 *  CACHING LAYER – avoid duplicate rule scans for repeated code points
 * ------------------------------------------------------------------------------------------------ */
const _memo = new Map(); // cp → { main, sub }
function _classify(cp) {
    let cached = _memo.get(cp);
    if (cached) return cached;
    for (const r of CATEGORY_RULES) if (r.test(cp)) {
        cached = { main: r.main, sub: r.sub };
        _memo.set(cp, cached);
        return cached;
    }
    cached = { main: 'Other' };
    _memo.set(cp, cached);
    return cached;
}

/* ------------------------------------------------------------------------------------------------
 *  PUBLIC API
 * ------------------------------------------------------------------------------------------------ */
/**
 * Classify a single Unicode character.
 * @param {string} char – single character
 * @returns {{ main: string, sub?: string }}
 */
function getCharacterType(char) {
    if (typeof char !== 'string' || char.length === 0)
        throw new TypeError('getCharacterType expects a non‑empty string.');
    const cp = char.codePointAt(0);
    return _classify(cp);
}

/**
 * Analyze text and return category statistics.
 * @param {string} text
 * @param {{ granularity?: 'main' | 'sub' }} [options]
 * @returns {{ total: number, breakdown: Record<string,{count:number,ratio:number,chars:string[]}> }}
 */
function analyzeText(text, { granularity = 'main' } = {}) {
    if (typeof text !== 'string') throw new TypeError('Input must be a string.');
    if (granularity !== 'main' && granularity !== 'sub')
        throw new RangeError("granularity must be 'main' or 'sub'");

    const breakdown = Object.create(null);
    let total = 0;

    for (let i = 0; i < text.length; ) {
        const cp = text.codePointAt(i);
        const { main, sub } = _classify(cp);
        const label = granularity === 'sub' && sub ? `${main}:${sub}` : main;

        let bucket = breakdown[label];
        if (!bucket) bucket = breakdown[label] = { count: 0, chars: new Set() };
        bucket.count++;
        bucket.chars.add(String.fromCodePoint(cp));

        total++;
        i += cp > 0xFFFF ? 2 : 1; // skip surrogate pair
    }

    for (const k in breakdown) {
        const b = breakdown[k];
        b.ratio = +(b.count * 100 / total).toFixed(2);
        b.chars = Array.from(b.chars).sort();
    }

    return { total, breakdown };
}

// ---------------------------------------------------------------------------
//  Module exports
// ---------------------------------------------------------------------------
export { getCharacterType, analyzeText };
