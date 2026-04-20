import * as assert from 'assert';
import { analyzeText, getCharacterType } from '../src/index.js';

/**
 * Run a named test case.
 *
 * @param {string} name
 * @param {() => void} fn
 */
function run(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

run('classifies ASCII latin letters', () => {
  assert.deepStrictEqual(getCharacterType('A'), { main: 'Latin', sub: 'Uppercase' });
  assert.deepStrictEqual(getCharacterType('z'), { main: 'Latin', sub: 'Lowercase' });
});

run('classifies Hangul syllables and emoji', () => {
  assert.deepStrictEqual(getCharacterType('가'), { main: 'Hangul', sub: 'Syllable' });
  assert.strictEqual(getCharacterType('😊').main, 'Emoji');
});

run('classifies whitespace sub-categories', () => {
  assert.deepStrictEqual(getCharacterType('\t'), {
    main: 'Whitespace',
    sub: 'Control:Tab',
  });

  assert.deepStrictEqual(getCharacterType('\n'), {
    main: 'Whitespace',
    sub: 'Control:Line Break',
  });

  assert.deepStrictEqual(getCharacterType(' '), {
    main: 'Whitespace',
    sub: 'Space Separator',
  });
});

run('classifies format characters used in emoji sequences', () => {
  assert.deepStrictEqual(getCharacterType('\u200D'), {
    main: 'Format',
    sub: 'ZWJ',
  });
});

run('analyses text by code point with main granularity', () => {
  const result = analyzeText('Hello 가😊');

  assert.strictEqual(result.total, 8);
  assert.strictEqual(result.breakdown.Latin.count, 5);
  assert.strictEqual(result.breakdown.Whitespace.count, 1);
  assert.strictEqual(result.breakdown.Hangul.count, 1);
  assert.strictEqual(result.breakdown.Emoji.count, 1);
});

run('analyses text by code point with sub granularity', () => {
  const result = analyzeText('Aa', { granularity: 'sub' });

  assert.strictEqual(result.total, 2);
  assert.strictEqual(result.breakdown['Latin:Uppercase'].count, 1);
  assert.strictEqual(result.breakdown['Latin:Lowercase'].count, 1);
});

run('throws for invalid input', () => {
  assert.throws(() => getCharacterType(''), TypeError);
  assert.throws(() => analyzeText(123), TypeError);
  assert.throws(() => analyzeText('abc', { granularity: 'detail' }), RangeError);
});

console.log('All GlyphScope tests passed.');
