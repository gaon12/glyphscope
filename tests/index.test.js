import assert from 'node:assert/strict';
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
  assert.deepEqual(getCharacterType('A'), { main: 'Latin', sub: 'Uppercase' });
  assert.deepEqual(getCharacterType('z'), { main: 'Latin', sub: 'Lowercase' });
});

run('classifies Hangul syllables and emoji', () => {
  assert.deepEqual(getCharacterType('가'), { main: 'Hangul', sub: 'Syllable' });
  assert.equal(getCharacterType('😊').main, 'Emoji');
});

run('classifies whitespace sub-categories', () => {
  assert.deepEqual(getCharacterType('\t'), {
    main: 'Whitespace',
    sub: 'Control:Tab',
  });

  assert.deepEqual(getCharacterType('\n'), {
    main: 'Whitespace',
    sub: 'Control:Line Break',
  });

  assert.deepEqual(getCharacterType(' '), {
    main: 'Whitespace',
    sub: 'Space Separator',
  });
});

run('classifies format characters used in emoji sequences', () => {
  assert.deepEqual(getCharacterType('\u200D'), {
    main: 'Format',
    sub: 'ZWJ',
  });
});

run('analyses text by code point with main granularity', () => {
  const result = analyzeText('Hello 가😊');

  assert.equal(result.total, 8);
  assert.equal(result.breakdown.Latin.count, 5);
  assert.equal(result.breakdown.Whitespace.count, 1);
  assert.equal(result.breakdown.Hangul.count, 1);
  assert.equal(result.breakdown.Emoji.count, 1);
});

run('analyses text by code point with sub granularity', () => {
  const result = analyzeText('Aa', { granularity: 'sub' });

  assert.equal(result.total, 2);
  assert.equal(result.breakdown['Latin:Uppercase'].count, 1);
  assert.equal(result.breakdown['Latin:Lowercase'].count, 1);
});

run('throws for invalid input', () => {
  assert.throws(() => getCharacterType(''), TypeError);
  assert.throws(() => analyzeText(123), TypeError);
  assert.throws(() => analyzeText('abc', { granularity: 'detail' }), RangeError);
});

console.log('All GlyphScope tests passed.');
