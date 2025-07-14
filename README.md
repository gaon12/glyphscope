# GlyphScope

GlyphScope는 단일 문자 혹은 문자열 전체를 분석하여 Unicode 스크립트(예: Latin, Hangul, Han, Emoji 등)로 분류해 주는 간단한 Node.js 라이브러리입니다.

## 설치

```bash
npm install glyphscope
````

## 사용법

```javascript
import { getCharacterType, analyzeText } from 'glyphscope';

// 단일 문자 분류
console.log(getCharacterType('가'));
// → { main: 'Hangul', sub: 'Syllable' }

console.log(getCharacterType('A'));
// → { main: 'Latin', sub: 'Uppercase' }

console.log(getCharacterType('😊'));
// → { main: 'Emoji' }

// 문자열 분석 (메인 카테고리 기준)
const result = analyzeText('Hello 가😊');
console.log(result.total);
// → 7
console.log(result.breakdown);
// → {
//    Latin: { count: 5, ratio: 71.43, chars: ['H','e','l','o'] },
//    Whitespace: { count: 1, ratio: 14.29, chars: [' '] },
//    Hangul: { count: 1, ratio: 14.29, chars: ['가'] },
//    Emoji: { count: 1, ratio: 14.29, chars: ['😊'] }
// }
```

### `getCharacterType(char)`

* **매개변수**: `char` (문자열 길이 ≥ 1)
* **반환값**: `{ main: string, sub?: string }`

  * `main`: 스크립트 이름 (예: Latin, Hangul, Emoji 등)
  * `sub`: 세부 분류 (예: Uppercase, Syllable 등)

### `analyzeText(text, options)`

* **매개변수**:

  * `text` (분석할 문자열)
  * `options.granularity` (`'main'` | `'sub'`, 기본 `'main'`)
* **반환값**: `{ total: number, breakdown: Record<string, { count: number, ratio: number, chars: string[] }> }`

  * `total`: 전체 문자 수
  * `breakdown`: 카테고리별 객체

    * `count`: 해당 카테고리 문자 수
    * `ratio`: 비율(백분율, 소수점 둘째 자리)
    * `chars`: 해당 카테고리에 속하는 고유 문자 배열

## 라이선스

[MIT](LICENSE)
