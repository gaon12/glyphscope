//   ____ _  __   ______  _   _   ____   ____ ___  ____  _____
//  / ___| | \ \ / /  _ \| | | | / ___| / ___/ _ \|  _ \| ____|
// | |  _| |  \ V /| |_) | |_| | \___ \| |  | | | | |_) |  _|
// | |_| | |___| | |  __/|  _  |  ___) | |__| |_| |  __/| |___
//  \____|_____|_| |_|   |_| |_| |____/ \____\___/|_|   |_____|
//
// GlyphScope (improved)
// - Node.js(ESM) + 최신 브라우저에서 동작하는 경량 유니코드 분류기
// - White_Space 세부 분류(요청사항 반영)
// - 더 넓은 유니코드 범위를 속성 기반(\p{...})으로 지원
//
// 주의:
// - analyzeText는 기본적으로 "코드포인트 단위"로 순회합니다(for..of).
//   따라서 ZWJ로 결합된 이모지 시퀀스(예: 가족 이모지)는 여러 코드포인트로 분리되어 집계됩니다.
//   (이를 “그래프림 클러스터” 단위로 집계하려면 Intl.Segmenter 기반 확장이 필요합니다.)

'use strict';

/* ------------------------------------------------------------------------------------------------
 * 0. 정규식 유니코드 속성(\p{...}) 지원 여부 감지
 *    - 최신 Node.js/브라우저는 대부분 지원합니다.
 *    - 미지원 환경에서는 일부 분류 정밀도가 떨어질 수 있으나, 최소한의 동작은 유지합니다.
 * ------------------------------------------------------------------------------------------------ */

/**
 * 정규식 패턴을 안전하게 컴파일합니다.
 * @param {string} source - RegExp 소스(문자열). 예: '^\\p{gc=Nd}$'
 * @returns {RegExp|null} - 컴파일 성공 시 RegExp, 실패 시 null
 */
function _makeUnicodeRegExp(source) {
    try {
        return new RegExp(source, 'u');
    } catch {
        return null;
    }
}

/** 유니코드 속성 이스케이프(\p{...}) 기본 지원 여부 */
const _SUPPORTS_PROP_ESCAPES = (() => {
    // 가장 단순한 속성으로 시험합니다.
    // (지원하지 않는 엔진에서는 SyntaxError가 발생합니다.)
    return _makeUnicodeRegExp('^\\p{L}$') !== null;
})();

/* ------------------------------------------------------------------------------------------------
 * 1. White Space 세부 분류(요청사항 핵심)
 *
 * Unicode UCD의 White_Space(= WSpace) 성격을 가진 코드 포인트들은 다음과 같은 집합이 널리 쓰입니다.
 * UAX #44(Unicode Character Database)와 PropList.txt의 White_Space 항목이 이를 기술합니다. :contentReference[oaicite:1]{index=1}
 *
 * 또한 U+200B(ZWSP)는 일반적으로 “White_Space 속성”으로 취급되지 않는 경우가 많으나(예: trim 대상 아님),
 * “보이지 않는 특수 공백”으로 분류하고 싶다는 요구에 따라 별도 하위 범주로 다룹니다. :contentReference[oaicite:2]{index=2}
 * ------------------------------------------------------------------------------------------------ */

/**
 * 화이트스페이스 하위 분류 라벨 정의
 * - main: 'Whitespace'
 * - sub: 아래 상수 중 하나
 */
const WS_SUB = Object.freeze({
    SPACE_SEP: 'Space Separator',     // 일반 공백류(기본/전각/NBSP 등)
    FIXED_WIDTH: 'Fixed-Width Space', // En/Em/Thin 등 타이포그래피 공백
    TAB: 'Control:Tab',               // 탭
    LINE_BREAK: 'Control:Line Break', // LF/CR/LS/PS 등 줄바꿈 계열
    ZERO_WIDTH: 'Invisible:Zero Width', // ZWSP 등 “보이지 않는 특수 공백” (요청사항)
});

/**
 * White_Space(공백 성격)로 널리 취급되는 코드 포인트 범위/목록(안정적 분류용)
 * - 0009..000D, 0020, 0085, 00A0, 1680, 2000..200A, 2028..2029, 202F, 205F, 3000
 *   (UCD PropList의 White_Space와 정합) :contentReference[oaicite:3]{index=3}
 *
 * 주의:
 * - 아래 구현은 “세부 분류” 목적이므로, 라벨링을 위해 그룹별로 분리해 둡니다.
 */

/** U+0009 */
const _WS_TAB = 0x0009;

/** 000A..000D + 0085 + 2028..2029 */
const _WS_LINE_BREAK_RANGES = Object.freeze([
    [0x000A, 0x000D], // LF, VT, FF, CR
    [0x2028, 0x2029], // Line Separator, Paragraph Separator
]);
const _WS_LINE_BREAK_SINGLES = Object.freeze([
    0x0085, // NEXT LINE (NEL)
]);

/** 0020, 00A0, 1680, 3000 */
const _WS_SPACE_SEPARATOR_SINGLES = Object.freeze([
    0x0020, // SPACE
    0x00A0, // NO-BREAK SPACE
    0x1680, // OGHAM SPACE MARK
    0x3000, // IDEOGRAPHIC SPACE(전각 공백)
]);

/** 2000..200A + 202F + 205F */
const _WS_FIXED_WIDTH_RANGES = Object.freeze([
    [0x2000, 0x200A], // EN QUAD..HAIR SPACE
]);
const _WS_FIXED_WIDTH_SINGLES = Object.freeze([
    0x202F, // NARROW NO-BREAK SPACE
    0x205F, // MEDIUM MATHEMATICAL SPACE
]);

/** 요청사항의 “보이지 않는 특수 공백”: U+200B */
const _WS_ZERO_WIDTH_SINGLES = Object.freeze([
    0x200B, // ZERO WIDTH SPACE (ZWSP)
]);

/**
 * 코드 포인트가 특정 범위 리스트에 포함되는지 검사합니다.
 * @param {number} cp
 * @param {Array<[number, number]>} ranges
 * @returns {boolean}
 */
function _inRanges(cp, ranges) {
    for (const [a, b] of ranges) {
        if (cp >= a && cp <= b) return true;
    }
    return false;
}

/**
 * 코드 포인트가 특정 단일 값 리스트에 포함되는지 검사합니다.
 * @param {number} cp
 * @param {ReadonlyArray<number>} singles
 * @returns {boolean}
 */
function _inSingles(cp, singles) {
    // 리스트가 짧으므로 선형 탐색으로도 충분합니다.
    for (const v of singles) {
        if (cp === v) return true;
    }
    return false;
}

/**
 * 화이트스페이스(및 유사 공백) 세부 분류를 수행합니다.
 * @param {number} cp
 * @returns {{ main: 'Whitespace', sub: string } | null}
 */
function _classifyWhitespace(cp) {
    // 1) “보이지 않는 특수 공백” 우선 처리(요청사항)
    if (_inSingles(cp, _WS_ZERO_WIDTH_SINGLES)) {
        return { main: 'Whitespace', sub: WS_SUB.ZERO_WIDTH };
    }

    // 2) 탭
    if (cp === _WS_TAB) {
        return { main: 'Whitespace', sub: WS_SUB.TAB };
    }

    // 3) 줄바꿈/제어형 공백
    if (_inRanges(cp, _WS_LINE_BREAK_RANGES) || _inSingles(cp, _WS_LINE_BREAK_SINGLES)) {
        return { main: 'Whitespace', sub: WS_SUB.LINE_BREAK };
    }

    // 4) 일반적인 공백(기본/전각/NBSP 등)
    if (_inSingles(cp, _WS_SPACE_SEPARATOR_SINGLES)) {
        return { main: 'Whitespace', sub: WS_SUB.SPACE_SEP };
    }

    // 5) 고정 너비 공백(타이포그래피)
    if (_inRanges(cp, _WS_FIXED_WIDTH_RANGES) || _inSingles(cp, _WS_FIXED_WIDTH_SINGLES)) {
        return { main: 'Whitespace', sub: WS_SUB.FIXED_WIDTH };
    }

    return null;
}

/* ------------------------------------------------------------------------------------------------
 * 2. 이모지 및 관련 코드 포인트 분류(확장)
 *
 * UTS #51에서 Extended_Pictographic 속성을 이모지/픽토그래프 계열의 분절(세그먼테이션) 등에 활용함을 설명합니다. :contentReference[oaicite:4]{index=4}
 * 최신 런타임에서는 \p{Extended_Pictographic} 사용이 가능할 수 있으므로 이를 우선 활용합니다.
 * ------------------------------------------------------------------------------------------------ */

/** 이모지/픽토그래프(Extended_Pictographic) */
const _RE_EXT_PICTO = _SUPPORTS_PROP_ESCAPES ? _makeUnicodeRegExp('^\\p{Extended_Pictographic}$') : null;

/** 표준 이모지 관련 속성(일부 런타임에서 지원) */
const _RE_EMOJI = _SUPPORTS_PROP_ESCAPES ? _makeUnicodeRegExp('^\\p{Emoji}$') : null;
const _RE_EMOJI_COMPONENT = _SUPPORTS_PROP_ESCAPES ? _makeUnicodeRegExp('^\\p{Emoji_Component}$') : null;

/** 변이 선택자(Variation Selectors) */
const _VS_BASIC_RANGE = Object.freeze([0xFE00, 0xFE0F]);   // VS1..VS16
const _VS_SUPP_RANGE = Object.freeze([0xE0100, 0xE01EF]);  // Variation Selectors Supplement

/**
 * 이모지/관련 구성요소를 분류합니다.
 * @param {string} ch - 단일 코드포인트 문자열(for..of 기준)
 * @param {number} cp
 * @returns {{ main: 'Emoji', sub?: string } | null}
 */
function _classifyEmoji(ch, cp) {
    // 1) 변이 선택자는 “이모지 표시/텍스트 표시”에 큰 영향을 주므로 별도 표기
    if ((cp >= _VS_BASIC_RANGE[0] && cp <= _VS_BASIC_RANGE[1]) ||
        (cp >= _VS_SUPP_RANGE[0] && cp <= _VS_SUPP_RANGE[1])) {
        return { main: 'Emoji', sub: 'Variation Selector' };
    }

    // 2) Extended_Pictographic 우선(지원되는 런타임이면 가장 포괄적)
    if (_RE_EXT_PICTO && _RE_EXT_PICTO.test(ch)) {
        return { main: 'Emoji', sub: 'Extended Pictographic' };
    }

    // 3) Emoji / Emoji_Component 속성(지원 시 보조 활용)
    if (_RE_EMOJI && _RE_EMOJI.test(ch)) {
        // Emoji 전체를 포괄하되, 가능하면 구성요소도 구분합니다.
        if (_RE_EMOJI_COMPONENT && _RE_EMOJI_COMPONENT.test(ch)) {
            return { main: 'Emoji', sub: 'Emoji Component' };
        }
        return { main: 'Emoji' };
    }

    return null;
}

/* ------------------------------------------------------------------------------------------------
 * 3. 한글 세부 분류(호환성 유지)
 * ------------------------------------------------------------------------------------------------ */

/**
 * 한글 코드포인트를 기존 세부 분류로 복원합니다.
 * @param {number} cp
 * @returns {{ main: 'Hangul', sub: string } | null}
 */
function _classifyHangul(cp) {
    if (cp >= 0xAC00 && cp <= 0xD7A3) return { main: 'Hangul', sub: 'Syllable' };
    if (cp >= 0x1100 && cp <= 0x11FF) return { main: 'Hangul', sub: 'Jamo' };
    if (cp >= 0xA960 && cp <= 0xA97F) return { main: 'Hangul', sub: 'Jamo Ext‑A' };
    if (cp >= 0xD7B0 && cp <= 0xD7FF) return { main: 'Hangul', sub: 'Jamo Ext‑B' };
    if (cp >= 0x3130 && cp <= 0x318F) return { main: 'Hangul', sub: 'Compatibility Jamo' };
    return null;
}

/* ------------------------------------------------------------------------------------------------
 * 4. 유니코드 일반 범주/스크립트 기반 분류(범위 확장 핵심)
 *
 * - UAX #24: Script / Script_Extensions 속성(스크립트 판별 근거) :contentReference[oaicite:5]{index=5}
 * - UAX #44: UCD 및 White_Space 등의 속성 정의 근거 :contentReference[oaicite:6]{index=6}
 *
 * 가능한 경우 \p{gc=...}, \p{Script=...}를 사용하여 수동 범위 테이블의 한계를 보완합니다.
 * ------------------------------------------------------------------------------------------------ */

/** General Category(일반 범주) */
const _RE_GC_LETTER = _SUPPORTS_PROP_ESCAPES ? _makeUnicodeRegExp('^\\p{gc=L}$') : null;   // Letter
const _RE_GC_MARK = _SUPPORTS_PROP_ESCAPES ? _makeUnicodeRegExp('^\\p{gc=M}$') : null;     // Mark
const _RE_GC_DECIMAL = _SUPPORTS_PROP_ESCAPES ? _makeUnicodeRegExp('^\\p{gc=Nd}$') : null; // Decimal_Number
const _RE_GC_NUMBER = _SUPPORTS_PROP_ESCAPES ? _makeUnicodeRegExp('^\\p{gc=N}$') : null;   // Number(전체)
const _RE_GC_PUNCT = _SUPPORTS_PROP_ESCAPES ? _makeUnicodeRegExp('^\\p{gc=P}$') : null;    // Punctuation
const _RE_GC_SYMBOL = _SUPPORTS_PROP_ESCAPES ? _makeUnicodeRegExp('^\\p{gc=S}$') : null;   // Symbol
const _RE_GC_SEP = _SUPPORTS_PROP_ESCAPES ? _makeUnicodeRegExp('^\\p{gc=Z}$') : null;      // Separator
const _RE_GC_CTRL = _SUPPORTS_PROP_ESCAPES ? _makeUnicodeRegExp('^\\p{gc=Cc}$') : null;    // Control
const _RE_GC_FORMAT = _SUPPORTS_PROP_ESCAPES ? _makeUnicodeRegExp('^\\p{gc=Cf}$') : null;  // Format

/**
 * 스크립트 감지 목록
 * - 자주 쓰는 스크립트를 넓게 커버합니다.
 * - 이 목록에 없더라도, 글자(Letter)로 판정되면 'Letter'로 최소 분류됩니다.
 */
function _compileScriptRegex(aliases) {
    // aliases 예: ['Hangul'] 또는 ['Odia', 'Oriya']처럼 후보를 순차 시도
    for (const name of aliases) {
        const re = _makeUnicodeRegExp(`^\\p{Script=${name}}$`);
        if (re) return re;
    }
    return null;
}

/** {label, re} 형태의 스크립트 판별기 목록 */
const _SCRIPT_DETECTORS = (() => {
    /** @type {Array<{ label: string, re: RegExp }>} */
    const out = [];

    /**
     * 항목을 추가합니다(컴파일 실패 시 자동 제외).
     * @param {string} label - GlyphScope에서 반환할 메인 라벨
     * @param {string[]} aliases - \p{Script=...}에 넣어볼 후보 이름(별칭)
     */
    function add(label, aliases) {
        const re = _compileScriptRegex(aliases);
        if (re) out.push({ label, re });
    }

    // 기존 코드에서 다루던 핵심 스크립트 + 범위 확대(자주 사용/대표성 기준)
    add('Hangul', ['Hangul']);
    add('Han Ideograph', ['Han']);
    add('Hiragana', ['Hiragana']);
    add('Katakana', ['Katakana']);
    add('Bopomofo', ['Bopomofo']);

    add('Latin', ['Latin']);
    add('Greek', ['Greek']);
    add('Cyrillic', ['Cyrillic']);

    add('Hebrew', ['Hebrew']);
    add('Arabic', ['Arabic']);

    add('Devanagari', ['Devanagari']);
    add('Bengali', ['Bengali']);
    add('Gurmukhi', ['Gurmukhi']);
    add('Gujarati', ['Gujarati']);
    add('Odia', ['Odia', 'Oriya']); // 표기 변경 이슈를 고려하여 후보를 모두 시도
    add('Tamil', ['Tamil']);
    add('Telugu', ['Telugu']);
    add('Kannada', ['Kannada']);
    add('Malayalam', ['Malayalam']);
    add('Sinhala', ['Sinhala']);

    add('Thai', ['Thai']);
    add('Lao', ['Lao']);
    add('Khmer', ['Khmer']);
    add('Myanmar', ['Myanmar']);
    add('Tibetan', ['Tibetan']);
    add('Mongolian', ['Mongolian']);

    add('Armenian', ['Armenian']);
    add('Georgian', ['Georgian']);
    add('Ethiopic', ['Ethiopic']);

    add('Cherokee', ['Cherokee']);
    add('Canadian Aboriginal', ['Canadian_Aboriginal']);

    add('Runic', ['Runic']);
    add('Ogham', ['Ogham']);

    add('Yi', ['Yi']);

    return out;
})();

/**
 * 문자(코드포인트 1개)가 어느 스크립트에 속하는지 판별합니다.
 * @param {string} ch
 * @returns {string|null} - 스크립트 라벨 또는 null
 */
function _detectScriptLabel(ch) {
    for (const { label, re } of _SCRIPT_DETECTORS) {
        if (re.test(ch)) return label;
    }
    return null;
}

/* ------------------------------------------------------------------------------------------------
 * 5. ASCII 고속 경로(성능)
 * ------------------------------------------------------------------------------------------------ */

/**
 * ASCII(<= 0x7F) 범위를 빠르게 분류합니다.
 * - 화이트스페이스는 이미 상위에서 처리하므로 여기서는 공백/개행 제외입니다.
 * @param {number} cp
 * @returns {{ main: string, sub?: string }}
 */
function _classifyAscii(cp) {
    // 제어 문자(ASCII) - 공백/개행은 화이트스페이스 단계에서 처리됨
    if (cp <= 0x1F || cp === 0x7F) return { main: 'Control' };

    // 숫자
    if (cp >= 0x30 && cp <= 0x39) return { main: 'Digit', sub: 'ASCII' };

    // 라틴 문자
    if (cp >= 0x41 && cp <= 0x5A) return { main: 'Latin', sub: 'Uppercase' };
    if (cp >= 0x61 && cp <= 0x7A) return { main: 'Latin', sub: 'Lowercase' };

    // 구두점/기호(기존 코드의 ASCII Punctuation 범위 유지)
    if ((cp >= 0x21 && cp <= 0x2F) ||
        (cp >= 0x3A && cp <= 0x40) ||
        (cp >= 0x5B && cp <= 0x60) ||
        (cp >= 0x7B && cp <= 0x7E)) {
        return { main: 'Punctuation', sub: 'ASCII' };
    }

    // 그 외 ASCII
    return { main: 'Other', sub: 'ASCII' };
}

/* ------------------------------------------------------------------------------------------------
 * 6. 메모이제이션(캐시)
 * ------------------------------------------------------------------------------------------------ */

/** 코드포인트별 분류 결과 캐시 */
const _memo = new Map();

/* ------------------------------------------------------------------------------------------------
 * 7. 핵심 분류 루틴
 * ------------------------------------------------------------------------------------------------ */

/**
 * 단일 코드포인트(문자) 분류.
 * @param {string} ch - 단일 코드포인트 문자열(for..of 기준)
 * @param {number} cp - ch의 code point
 * @returns {{ main: string, sub?: string }}
 */
function _classifyCodePoint(ch, cp) {
    // 1) 화이트스페이스(요청사항: 하위 분류 포함)
    const ws = _classifyWhitespace(cp);
    if (ws) return ws;

    // 2) ASCII 고속 경로
    if (cp <= 0x7F) return _classifyAscii(cp);

    // 3) 이모지/픽토그래프(가능하면 Extended_Pictographic 활용)
    const em = _classifyEmoji(ch, cp);
    if (em) return em;

    // 4) 한글 세부 분류(기존 호환성 유지)
    const hangul = _classifyHangul(cp);
    if (hangul) return hangul;

    // 5) 유니코드 속성 기반 분류(\p{...}) — 지원되는 런타임에서 폭넓은 범위 커버
    if (_SUPPORTS_PROP_ESCAPES) {
        // 5-1) Control(제어 문자)
        if (_RE_GC_CTRL && _RE_GC_CTRL.test(ch)) {
            return { main: 'Control' };
        }

        // 5-2) Format(서식 문자) — ZWJ 등은 텍스트 처리에서 중요하므로 하위 라벨을 부여
        if (_RE_GC_FORMAT && _RE_GC_FORMAT.test(ch)) {
            // ZWJ/ZWNJ 등 대표 케이스
            if (cp === 0x200D) return { main: 'Format', sub: 'ZWJ' };  // ZERO WIDTH JOINER
            if (cp === 0x200C) return { main: 'Format', sub: 'ZWNJ' }; // ZERO WIDTH NON-JOINER
            if (cp === 0xFEFF) return { main: 'Format', sub: 'BOM/ZWNBS' }; // BOM 또는 (구) ZWNBSP
            return { main: 'Format' };
        }

        // 5-3) 글자(스크립트 기반)
        if (_RE_GC_LETTER && _RE_GC_LETTER.test(ch)) {
            const scriptLabel = _detectScriptLabel(ch);
            if (scriptLabel) return { main: scriptLabel, sub: 'Letter' };
            return { main: 'Letter', sub: 'Other Script' };
        }

        // 5-4) 결합 문자(악센트/모음부호 등)
        if (_RE_GC_MARK && _RE_GC_MARK.test(ch)) {
            return { main: 'Mark' };
        }

        // 5-5) 10진 숫자(각 스크립트의 0..9)
        if (_RE_GC_DECIMAL && _RE_GC_DECIMAL.test(ch)) {
            return { main: 'Digit', sub: 'Decimal' };
        }

        // 5-6) 숫자(로마 숫자/분수 등 포함)
        if (_RE_GC_NUMBER && _RE_GC_NUMBER.test(ch)) {
            return { main: 'Number' };
        }

        // 5-7) 구두점
        if (_RE_GC_PUNCT && _RE_GC_PUNCT.test(ch)) {
            return { main: 'Punctuation' };
        }

        // 5-8) 기호
        if (_RE_GC_SYMBOL && _RE_GC_SYMBOL.test(ch)) {
            return { main: 'Symbol' };
        }

        // 5-9) Separator(줄/문단 구분자 등) — 2028/2029는 이미 화이트스페이스로 처리됨
        if (_RE_GC_SEP && _RE_GC_SEP.test(ch)) {
            return { main: 'Separator' };
        }
    }

    // 6) 속성 기반 분류가 불가능한 환경(또는 어떤 항목에도 걸리지 않은 경우)
    //    - 기존 방식처럼 “기타” 처리하되, 가능한 한 유용한 정보를 주기 위해 코드포인트 범위를 일부 보강합니다.
    //
    //    예: 한자 확장(G/H/I/J)은 유니코드 17 기준으로 다음 범위를 가집니다. :contentReference[oaicite:7]{index=7}
    //    하지만 여기서는 “경량”을 유지하기 위해 전 범위를 상세히 하드코딩하지 않고,
    //    속성(\p{Script=Han})이 가능한 환경에서의 자동 커버를 권장합니다.
    //
    //    그래도 최소한의 보강으로 “CJK 한자 확장 영역” 정도는 인지하도록 합니다.

    // 보강: CJK Unified Ideographs (일부 범위)
    // (완전한 커버를 위해서는 UAX #24의 Scripts.txt를 통째로 포함/파싱해야 하므로 여기서는 최소화)
    if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) ||
        (cp >= 0x20000 && cp <= 0x2A6DF) || (cp >= 0x2A700 && cp <= 0x2B73F) ||
        (cp >= 0x2B740 && cp <= 0x2B81F) || (cp >= 0x2B820 && cp <= 0x2CEAF) ||
        (cp >= 0x2CEB0 && cp <= 0x2EBEF) ||
        (cp >= 0x30000 && cp <= 0x3134F) || // Ext G
        (cp >= 0x31350 && cp <= 0x323AF) || // Ext H
        (cp >= 0x2EBF0 && cp <= 0x2EE5F) || // Ext I
        (cp >= 0x323B0 && cp <= 0x3347F)    // Ext J
    ) {
        return { main: 'Han Ideograph' };
    }

    return { main: 'Other' };
}

/* ------------------------------------------------------------------------------------------------
 * 8. Public API
 * ------------------------------------------------------------------------------------------------ */

/**
 * 단일 문자(문자열의 첫 코드포인트) 분류.
 * @param {string} char - 비어있지 않은 문자열(첫 코드포인트만 사용)
 * @returns {{ main: string, sub?: string }}
 */
function getCharacterType(char) {
    if (typeof char !== 'string' || char.length === 0) {
        throw new TypeError('getCharacterType expects a non-empty string.');
    }

    const cp = char.codePointAt(0);

    // 메모 캐시 히트 시 즉시 반환
    const cached = _memo.get(cp);
    if (cached) return cached;

    // 첫 코드포인트를 안전하게 문자열로 구성(서러게이트 페어 포함)
    const ch = String.fromCodePoint(cp);

    const result = _classifyCodePoint(ch, cp);
    _memo.set(cp, result);
    return result;
}

/**
 * 문자열을 분석하여 카테고리별 통계를 반환.
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

    // ES2015: 코드포인트 안전 순회
    for (const ch of text) {
        const { main, sub } = getCharacterType(ch);
        const label = (granularity === 'sub' && sub) ? `${main}:${sub}` : main;

        let bucket = breakdown[label];
        if (!bucket) bucket = breakdown[label] = { count: 0, chars: new Set() };

        bucket.count++;
        bucket.chars.add(ch);
        total++;
    }

    // 비율 계산 및 chars 정렬
    for (const k in breakdown) {
        const b = breakdown[k];
        const ratio = total > 0 ? (b.count * 100 / total) : 0;
        /** @type {any} */
        b.ratio = +ratio.toFixed(2);
        /** @type {any} */
        b.chars = Array.from(b.chars).sort();
    }

    return { total, breakdown };
}

/* ------------------------------------------------------------------------------------------------
 * 9. Module export
 * ------------------------------------------------------------------------------------------------ */
export { getCharacterType, analyzeText };
