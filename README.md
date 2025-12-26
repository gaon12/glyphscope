# GlyphScope / 글리프스코프

[![npm](https://img.shields.io/npm/v/glyphscope)](https://www.npmjs.com/package/glyphscope) [![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green)](https://nodejs.org/)

**GlyphScope** is a lightweight **Unicode character classifier** for Node.js and modern browsers.
**GlyphScope**는 Node.js와 최신 브라우저에서 동작하는 가벼운 **유니코드 문자 분류기**입니다.

👉 **Try it online / 온라인 데모**: [https://glyphscope.vercel.app](https://glyphscope.vercel.app)

---

## Installation / 설치

```bash
npm install glyphscope
```

GlyphScope targets **Node ≥ 14** and contains **no native addons**.
GlyphScope는 **Node 14 이상**을 지원하며 **네이티브 애드온이 없습니다**.

---

## Quick Start / 빠른 시작

```js
// ES Modules
import { getCharacterType, analyzeText } from 'glyphscope';

// CommonJS
// const { getCharacterType, analyzeText } = require('glyphscope');

// ─────────────────────────────────────────────
// Classify a single character / 단일 문자 분류
console.log(getCharacterType('가')); // { main: 'Hangul', sub: 'Syllable' }
console.log(getCharacterType('A')); // { main: 'Latin',  sub: 'Uppercase' }
console.log(getCharacterType('😊')); // { main: 'Emoji' }

// Analyse a string / 문자열 분석
const res = analyzeText('Hello 가😊');
console.log(res.total);      // 8
console.dir(res.breakdown);
/* → {
     Latin:      { count: 5, ratio: 62.5, chars: ['H','e','l','o'] },
     Whitespace: { count: 1, ratio: 12.5, chars: [' '] },
     Hangul:     { count: 1, ratio: 12.5, chars: ['가'] },
     Emoji:      { count: 1, ratio: 12.5, chars: ['😊'] }
   }
*/
```

> **TypeScript? / 타입스크립트 지원**
> `.d.ts` typings are bundled. No extra install needed.
> `.d.ts` 타입 정의가 포함되어 있어 별도 설치가 필요 없습니다.

---

## API

### `getCharacterType(char)`

| Parameter / 매개변수 | Type               | Description / 설명                             |
| ---------------- | ------------------ | -------------------------------------------- |
| `char`           | `string` (≥1 char) | Character to classify / 분류할 문자 (첫 코드포인트만 사용) |

**Returns / 반환값** `{ main: string, sub?: string }`

* `main` – Primary script (e.g. `Latin`). / 주요 스크립트
* `sub`  – Optional sub‑category (e.g. `Uppercase`). / 세부 분류 (선택)

---

### `analyzeText(text, options?)`

| Parameter / 매개변수      | Type              | Default / 기본값 | Description / 설명                 |
| --------------------- | ----------------- | ------------- | -------------------------------- |
| `text`                | `string`          | —             | String to analyse / 분석할 문자열      |
| `options.granularity` | `'main' \| 'sub'` | `'main'`      | Use sub‑categories / 세부 분류 사용 여부 |

**Returns / 반환값** `{ total: number, breakdown: Record<string, { count: number, ratio: number, chars: string[] }> }`

* `total`      – Total code points / 전체 코드포인트 수
* `breakdown`  – Per‑category stats / 카테고리별 통계:

  * `count` – Number of code points / 개수
  * `ratio` – Percentage (two decimals) / 비율(소수점 둘째 자리)
  * `chars` – Unique characters / 고유 문자 배열

---

## Customization / 커스텀

Custom ranges are not exposed in the current public API.
Need custom ranges? Please open an issue.
현재 버전은 커스텀 범위를 위한 내부 테이블을 공개하지 않습니다.
필요하면 이슈로 요청해주세요.

---

## Performance Notes / 성능 메모

* Fast paths for whitespace/ASCII/emoji + Unicode property checks (mostly **O(1)**). / 화이트스페이스/ASCII/이모지 고속 경로 + 유니코드 속성 검사(대체로 **O(1)**)
* Results cached in a `Map` (hot path ≈ O(1)). / 핫 패스는 `Map` 캐싱으로 **O(1)**
* Uses Unicode property escapes when available; falls back to limited range checks otherwise. / 가능하면 유니코드 속성 이스케이프를 사용하고, 미지원 시 제한적 범위 검사로 동작
* No `Intl` dependency; works in Cloudflare Workers, etc. / `Intl` 의존성 없음 → 경량 런타임에서도 동작

---

## Contributing / 기여

Pull requests are welcome!
PR을 환영합니다.

1. Fork & clone / 포크 후 클론
2. `npm i`
3. Make changes / 수정
4. `npm test && npm run lint`
5. Open a PR / PR 제출

---

## License / 라이선스

GlyphScope is released under the [MIT](LICENSE) license.
GlyphScope는 [MIT](LICENSE) 라이선스로 배포됩니다.
