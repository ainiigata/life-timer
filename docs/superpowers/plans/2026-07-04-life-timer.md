# 人生タイマー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 残り時間(年月日時分秒)をリアルタイム表示し、家族と「あと何回会えるか」・やりたいことリストで今を生きる行動を促す、完全ローカルの単一HTML PWAを作る。

**Architecture:** `src/` のUMDモジュール(life-table / time-calc / store / app)を `node build.js` で `dist/index.html` にインライン化するデルマエ方式。ロジック3モジュールはDOM非依存の純粋関数で `node --test` によるテストファースト。PWA用 `static/`(manifest, sw.js, アイコン)はビルドで `dist/` にコピー。

**Tech Stack:** vanilla JS(ES2020, npm依存ゼロ)、localStorage、node:test、GitHub Pages(公開はステージ6で別途)

## Global Constraints

- npm依存ゼロ。`package.json` は作らない。テストは `node --test test/` で実行
- 外部通信ゼロ。CSPは `default-src 'none'` 基調(sw/manifest用に `'self'` を限定追加)
- localStorage キーは `life-timer-v1`(スペック4章)
- スマホファースト、375px基準。UI仕上げは frontend-design スキルを適用(Task 5)
- 画面フッターに必ず表記: 「出典:「令和5年簡易生命表」(厚生労働省)を加工して作成。余命は統計上の平均であり、個人の寿命を予測するものではありません。」
- モジュールはデルマエと同じUMDパターン(browser: `root.Xxx = factory()` / node: `module.exports = factory()`)
- コミットメッセージ末尾: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 作業ディレクトリ: `/Users/yamadatoshi/yamada-ai-claude/projects/life-timer/`

---

### Task 1: ビルド基盤(build.js + テンプレート骨格 + ビルドテスト)

**Files:**
- Create: `build.js`
- Create: `src/index.template.html`(骨格のみ。画面マークアップはTask 5で追加)
- Create: `src/style.css`(空に近い初期状態)
- Create: `src/life-table.js` / `src/time-calc.js` / `src/store.js` / `src/app.js`(UMD空殻)
- Create: `static/.gitkeep`
- Test: `test/build.test.js`

**Interfaces:**
- Produces: `node build.js` → `dist/index.html`。INJECTマーカー方式(`/*<!--INJECT:KEY-->*/`)。KEYは STYLE / LIFE_TABLE / TIME_CALC / STORE / APP

- [ ] **Step 1: 失敗するビルドテストを書く**

`test/build.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const distPath = path.join(root, 'dist', 'index.html');

execFileSync(process.execPath, ['build.js'], { cwd: root });
const html = fs.readFileSync(distPath, 'utf-8');

test('INJECTマーカーが残っていない', () => {
  assert.ok(!html.includes('INJECT'));
});

test('外部リソース参照ゼロ(src/href属性にhttpなし)', () => {
  assert.ok(!/\b(src|href)\s*=\s*["']https?:/i.test(html));
});

test('通信APIを使用していない(localStorageは使用する)', () => {
  assert.ok(!/\bfetch\s*\(/.test(html));
  assert.ok(!/XMLHttpRequest/.test(html));
  assert.ok(!/\bindexedDB\b/i.test(html));
});

test('CSPメタタグがある', () => {
  assert.ok(html.includes('Content-Security-Policy'));
  assert.ok(html.includes("default-src 'none'"));
});

test('script閉じタグの早期終了がない', () => {
  const open = (html.match(/<script>/g) || []).length;
  const close = (html.match(/<\/script>/g) || []).length;
  assert.equal(open, close);
  assert.equal(open, 4);
});

test('主要モジュールが同梱されている', () => {
  assert.ok(html.includes('LifeTable'));
  assert.ok(html.includes('TimeCalc'));
  assert.ok(html.includes('LifeStore'));
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd /Users/yamadatoshi/yamada-ai-claude/projects/life-timer && node --test test/`
Expected: FAIL(build.js が存在しないため execFileSync がエラー)

- [ ] **Step 3: build.js とソース骨格を作る**

`build.js`:

```js
/* 人生タイマー ビルド — src/を単一HTML dist/index.html にインライン化し、static/をコピーする */
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf-8');

// インラインJS/CSS内の閉じタグでHTMLが早期終了しないようエスケープ
const escapeScript = (js) => js.replace(/<\/script/gi, '<\\/script');
const escapeStyle = (css) => css.replace(/<\/style/gi, '<\\/style');

const INJECTIONS = {
  STYLE: escapeStyle(read('src/style.css')),
  LIFE_TABLE: escapeScript(read('src/life-table.js')),
  TIME_CALC: escapeScript(read('src/time-calc.js')),
  STORE: escapeScript(read('src/store.js')),
  APP: escapeScript(read('src/app.js')),
};

let html = read('src/index.template.html');
for (const [key, content] of Object.entries(INJECTIONS)) {
  const marker = `/*<!--INJECT:${key}-->*/`;
  if (!html.includes(marker)) {
    console.error(`マーカーが見つかりません: ${marker}`);
    process.exit(1);
  }
  html = html.replace(marker, () => content);
}

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);

const staticDir = path.join(root, 'static');
for (const f of fs.readdirSync(staticDir)) {
  if (f.startsWith('.')) continue;
  fs.copyFileSync(path.join(staticDir, f), path.join(dist, f));
}
console.log(`ビルド完了: dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
```

`src/index.template.html`(骨格。bodyの画面マークアップはTask 5で差し替え):

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; manifest-src 'self'; worker-src 'self';">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ff8a3d">
<link rel="manifest" href="./manifest.json">
<title>人生タイマー — 残り時間を、夢の時間に</title>
<!--
  人生タイマー / 残り時間の可視化で「今やる」を引き出すアプリ
  データはすべて端末内(localStorage)に保存され、外部送信は一切ありません
  出典: 「令和5年簡易生命表」(厚生労働省)を加工して作成
-->
<style>
/*<!--INJECT:STYLE-->*/
</style>
</head>
<body>
<main id="app"></main>
<script>/*<!--INJECT:LIFE_TABLE-->*/</script>
<script>/*<!--INJECT:TIME_CALC-->*/</script>
<script>/*<!--INJECT:STORE-->*/</script>
<script>/*<!--INJECT:APP-->*/</script>
</body>
</html>
```

`src/style.css`: `/* 人生タイマー スタイル(Task 5で実装) */` の1行のみ。

`src/life-table.js` / `src/time-calc.js` / `src/store.js` のUMD空殻(名前だけ変えて3つ作る。以下はlife-table.jsの例):

```js
/* 人生タイマー 年齢別平均余命テーブル */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LifeTable = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {};
});
```

(time-calc.jsは `root.TimeCalc`、store.jsは `root.LifeStore`。app.jsは `/* 人生タイマー UI(Task 5で実装) */` のみ)

`static/.gitkeep`: 空ファイル。

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `node --test test/`
Expected: PASS(6テスト)

- [ ] **Step 5: .gitignore を作りコミット**

`.gitignore` の内容: `dist/`(ビルド成果物はコミットしない。公開時はステージ6でgh-pagesへ)

```bash
git add -A && git commit -m "feat: ビルド基盤(単一HTML化・ビルド検証テスト)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 年齢別平均余命テーブル(life-table.js)

**Files:**
- Modify: `src/life-table.js`
- Test: `test/life-table.test.js`

**Interfaces:**
- Produces: `LifeTable.remainingYears(gender: 'male'|'female', age: number): number`(年齢は小数可、線形補間)/ `LifeTable.LIFE_TABLE`

- [ ] **Step 1: 失敗するテストを書く**

`test/life-table.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const LifeTable = require('../src/life-table.js');

test('0歳の平均余命は平均寿命に一致する', () => {
  assert.equal(LifeTable.remainingYears('male', 0), 81.09);
  assert.equal(LifeTable.remainingYears('female', 0), 87.14);
});

test('テーブル掲載年齢はそのままの値を返す', () => {
  assert.equal(LifeTable.remainingYears('male', 40), 42.06);
  assert.equal(LifeTable.remainingYears('female', 65), 24.15);
});

test('中間年齢は線形補間される', () => {
  const v = LifeTable.remainingYears('male', 42.5); // 40(42.06)と45(37.27)の中間
  assert.ok(Math.abs(v - (42.06 + 37.27) / 2) < 1e-9);
});

test('105歳以上は最終値で頭打ち', () => {
  assert.equal(LifeTable.remainingYears('male', 110), LifeTable.remainingYears('male', 105));
});

test('負の年齢は0歳扱い', () => {
  assert.equal(LifeTable.remainingYears('female', -1), 87.14);
});

test('不明な性別はエラー', () => {
  assert.throws(() => LifeTable.remainingYears('other', 30));
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/life-table.test.js`
Expected: FAIL(remainingYears is not a function)

- [ ] **Step 3: 実装する**

`src/life-table.js` のfactory本体を差し替え:

```js
/* 人生タイマー 年齢別平均余命テーブル
   出典: 「令和5年簡易生命表」(厚生労働省)を加工して作成
   https://www.mhlw.go.jp/toukei/saikin/hw/life/life23/index.html
   5歳刻みの公表値(単位: 年)。中間年齢は線形補間で求める */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LifeTable = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LIFE_TABLE = {
    male: {
      0: 81.09, 5: 76.31, 10: 71.34, 15: 66.38, 20: 61.48, 25: 56.61,
      30: 51.75, 35: 46.90, 40: 42.06, 45: 37.27, 50: 32.56, 55: 27.97,
      60: 23.53, 65: 19.34, 70: 15.42, 75: 11.85, 80: 8.73, 85: 6.14,
      90: 4.14, 95: 2.68, 100: 1.69, 105: 1.05,
    },
    female: {
      0: 87.14, 5: 82.35, 10: 77.37, 15: 72.41, 20: 67.46, 25: 62.53,
      30: 57.60, 35: 52.69, 40: 47.81, 45: 42.96, 50: 38.16, 55: 33.42,
      60: 28.74, 65: 24.15, 70: 19.66, 75: 15.36, 80: 11.36, 85: 7.85,
      90: 5.09, 95: 3.10, 100: 1.84, 105: 1.10,
    },
  };
  const AGES = Object.keys(LIFE_TABLE.male).map(Number).sort((a, b) => a - b);
  const MAX_AGE = AGES[AGES.length - 1];

  function remainingYears(gender, age) {
    const t = LIFE_TABLE[gender];
    if (!t) throw new Error('unknown gender: ' + gender);
    if (age <= 0) return t[0];
    if (age >= MAX_AGE) return t[MAX_AGE];
    let lo = AGES[0];
    for (const a of AGES) {
      if (a <= age) lo = a; else break;
    }
    const hi = AGES[AGES.indexOf(lo) + 1];
    const ratio = (age - lo) / (hi - lo);
    return t[lo] + (t[hi] - t[lo]) * ratio;
  }

  return { LIFE_TABLE, remainingYears };
});
```

- [ ] **Step 4: データを一次資料と照合する(重要)**

Run: WebFetch で `https://www.mhlw.go.jp/toukei/saikin/hw/life/life23/index.html` から「令和5年簡易生命表の概況」の「主な年齢の平均余命」表を取得し、上のLIFE_TABLEの全値と照合。相違があればテーブルとテスト期待値の**両方**を公表値に修正する(0歳男81.09・女87.14は確定値。他の年齢は要照合)。取得できない場合は `https://www.mhlw.go.jp/toukei/saikin/hw/life/life23/dl/life23-02.pdf` を試す。

- [ ] **Step 5: テストを実行して通ることを確認**

Run: `node --test test/life-table.test.js`
Expected: PASS(6テスト)

- [ ] **Step 6: コミット**

```bash
git add src/life-table.js test/life-table.test.js
git commit -m "feat: 年齢別平均余命テーブルと線形補間(令和5年簡易生命表)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 残り時間計算(time-calc.js)

**Files:**
- Modify: `src/time-calc.js`
- Test: `test/time-calc.test.js`

**Interfaces:**
- Consumes: `LifeTable.remainingYears(gender, age)`
- Produces:
  - `TimeCalc.MS_PER_YEAR: number`(365.2425日)
  - `TimeCalc.parseDate(s: 'YYYY-MM-DD'): Date`(ローカル0時)
  - `TimeCalc.expectedDeathDate(person: {birthDate, gender, customLifespan?}, now: Date): Date`
  - `TimeCalc.breakdown(from: Date, to: Date): {expired, years, months, days, hours, minutes, seconds}`
  - `TimeCalc.progressPercent(birthDateStr: string, death: Date, now: Date): number`(0-100)
  - `TimeCalc.meetCount(selfDeath: Date, familyDeath: Date, freq: string, now: Date): number`
  - `TimeCalc.freqPerYear(freq: 'daily'|'weekly'|'monthly'|'yearly-N'): number`

- [ ] **Step 1: 失敗するテストを書く**

`test/time-calc.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const TimeCalc = require('../src/time-calc.js');

test('breakdown: ちょうど1年1ヶ月1日1時間1分1秒', () => {
  const from = new Date(2026, 0, 1, 0, 0, 0);
  const to = new Date(2027, 1, 2, 1, 1, 1);
  const b = TimeCalc.breakdown(from, to);
  assert.deepEqual(
    { y: b.years, mo: b.months, d: b.days, h: b.hours, mi: b.minutes, s: b.seconds },
    { y: 1, mo: 1, d: 1, h: 1, mi: 1, s: 1 }
  );
  assert.equal(b.expired, false);
});

test('breakdown: うるう年をまたいでも月計算が壊れない(1/31起点)', () => {
  const from = new Date(2024, 0, 31); // 2024はうるう年
  const to = new Date(2024, 2, 1);    // 3/1
  const b = TimeCalc.breakdown(from, to);
  // 1/31 +1ヶ月 = 2/29(月末クランプ)、残り1日
  assert.equal(b.months, 1);
  assert.equal(b.days, 1);
});

test('breakdown: 期限切れはexpired=trueで全ゼロ', () => {
  const b = TimeCalc.breakdown(new Date(2026, 0, 2), new Date(2026, 0, 1));
  assert.equal(b.expired, true);
  assert.equal(b.years + b.months + b.days + b.hours + b.minutes + b.seconds, 0);
});

test('expectedDeathDate: customLifespan優先', () => {
  const now = new Date(2026, 6, 4);
  const d = TimeCalc.expectedDeathDate(
    { birthDate: '1986-07-04', gender: 'male', customLifespan: 100 }, now);
  // 誕生から100年後(±1日以内)
  const expect = TimeCalc.parseDate('1986-07-04').getTime() + 100 * TimeCalc.MS_PER_YEAR;
  assert.ok(Math.abs(d.getTime() - expect) < 86400000);
});

test('expectedDeathDate: 余命テーブル使用時は now+余命', () => {
  const now = new Date(2026, 6, 4);
  const d = TimeCalc.expectedDeathDate({ birthDate: '1986-07-04', gender: 'male' }, now);
  // 40歳男性の余命42.06年 → 死亡推定は now + 42.06年(補間誤差込み±0.2年)
  const years = (d.getTime() - now.getTime()) / TimeCalc.MS_PER_YEAR;
  assert.ok(Math.abs(years - 42.06) < 0.2, `got ${years}`);
});

test('progressPercent: 誕生日当日は0、死亡推定日は100', () => {
  const death = new Date(2066, 6, 4);
  assert.equal(TimeCalc.progressPercent('2026-07-04', death, TimeCalc.parseDate('2026-07-04')), 0);
  assert.equal(TimeCalc.progressPercent('2026-07-04', death, death), 100);
});

test('freqPerYear: 全頻度', () => {
  assert.equal(TimeCalc.freqPerYear('daily'), 365);
  assert.equal(TimeCalc.freqPerYear('weekly'), 52);
  assert.equal(TimeCalc.freqPerYear('monthly'), 12);
  assert.equal(TimeCalc.freqPerYear('yearly-2'), 2);
  assert.throws(() => TimeCalc.freqPerYear('sometimes'));
});

test('meetCount: 先に尽きる側が上限になる', () => {
  const now = new Date(2026, 0, 1);
  const selfDeath = new Date(2066, 0, 1);   // 40年後
  const familyDeath = new Date(2036, 0, 1); // 10年後(こちらが先)
  const n = TimeCalc.meetCount(selfDeath, familyDeath, 'monthly', now);
  assert.ok(n >= 118 && n <= 120, `got ${n}`); // 約10年×12回
});

test('meetCount: 残りゼロ以下は0回', () => {
  const now = new Date(2026, 0, 1);
  assert.equal(TimeCalc.meetCount(new Date(2025, 0, 1), new Date(2066, 0, 1), 'daily', now), 0);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/time-calc.test.js`
Expected: FAIL(breakdown is not a function)

- [ ] **Step 3: 実装する**

`src/time-calc.js`:

```js
/* 人生タイマー 残り時間計算 — DOM非依存の純粋関数のみ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./life-table.js'));
  else root.TimeCalc = factory(root.LifeTable);
})(typeof self !== 'undefined' ? self : this, function (LifeTable) {
  'use strict';

  const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;
  const MS_DAY = 86400000;

  function parseDate(s) {
    return new Date(s + 'T00:00:00');
  }

  // fromからnヶ月後。月末は短い月の末日にクランプ(1/31+1ヶ月=2/28|29)
  function addMonthsClamped(from, n) {
    const r = new Date(from);
    const day = r.getDate();
    r.setDate(1);
    r.setMonth(r.getMonth() + n);
    const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(day, last));
    return r;
  }

  function breakdown(from, to) {
    if (to - from <= 0) {
      return { expired: true, years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    let totalMonths = 0;
    let cursor = new Date(from);
    let next = addMonthsClamped(from, totalMonths + 1);
    while (next <= to) {
      totalMonths++;
      cursor = next;
      next = addMonthsClamped(from, totalMonths + 1);
    }
    let ms = to - cursor;
    const days = Math.floor(ms / MS_DAY); ms -= days * MS_DAY;
    const hours = Math.floor(ms / 3600000); ms -= hours * 3600000;
    const minutes = Math.floor(ms / 60000); ms -= minutes * 60000;
    const seconds = Math.floor(ms / 1000);
    return {
      expired: false,
      years: Math.floor(totalMonths / 12),
      months: totalMonths % 12,
      days, hours, minutes, seconds,
    };
  }

  function expectedDeathDate(person, now) {
    const birth = parseDate(person.birthDate);
    if (person.customLifespan) {
      return new Date(birth.getTime() + person.customLifespan * MS_PER_YEAR);
    }
    const age = (now - birth) / MS_PER_YEAR;
    const rem = LifeTable.remainingYears(person.gender, age);
    return new Date(now.getTime() + rem * MS_PER_YEAR);
  }

  function progressPercent(birthDateStr, death, now) {
    const birth = parseDate(birthDateStr);
    const p = ((now - birth) / (death - birth)) * 100;
    return Math.min(100, Math.max(0, p));
  }

  const FREQ_PER_YEAR = { daily: 365, weekly: 52, monthly: 12 };

  function freqPerYear(freq) {
    if (FREQ_PER_YEAR[freq]) return FREQ_PER_YEAR[freq];
    const m = /^yearly-(\d+)$/.exec(freq);
    if (m) return Number(m[1]);
    throw new Error('unknown frequency: ' + freq);
  }

  // 会える回数 = 先に尽きる側までの残り年数 × 年間頻度
  function meetCount(selfDeath, familyDeath, freq, now) {
    const end = Math.min(selfDeath.getTime(), familyDeath.getTime());
    const years = Math.max(0, (end - now.getTime()) / MS_PER_YEAR);
    return Math.floor(years * freqPerYear(freq));
  }

  return { MS_PER_YEAR, parseDate, breakdown, expectedDeathDate, progressPercent, freqPerYear, meetCount };
});
```

- [ ] **Step 4: 全テストを実行して通ることを確認**

Run: `node --test test/`
Expected: PASS(build/life-table/time-calc 全部)

- [ ] **Step 5: コミット**

```bash
git add src/time-calc.js test/time-calc.test.js
git commit -m "feat: 残り時間・進捗率・会える回数の計算ロジック

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: データ永続化(store.js)

**Files:**
- Modify: `src/store.js`
- Test: `test/store.test.js`

**Interfaces:**
- Produces:
  - `LifeStore.KEY = 'life-timer-v1'`
  - `LifeStore.emptyData(): {version:1, self:null, family:[], wishes:[]}`
  - `LifeStore.validate(data): {ok: boolean, error?: string}`
  - `LifeStore.load(storage): {data: object|null, corrupt: boolean}`(storageはlocalStorage互換。破損時 data=null, corrupt=true — **黙って初期化しない**)
  - `LifeStore.save(storage, data): void`
  - `LifeStore.exportJSON(data): string` / `LifeStore.importJSON(text): {ok, data?, error?}`
  - `LifeStore.newId(): string` / `LifeStore.isValidDateStr(s): boolean`

- [ ] **Step 1: 失敗するテストを書く**

`test/store.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const LifeStore = require('../src/store.js');

// localStorage互換のメモリ実装
function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

const VALID = {
  version: 1,
  self: { name: '', birthDate: '1986-07-04', gender: 'male', customLifespan: null },
  family: [{ id: 'a1', name: '母', birthDate: '1960-01-15', gender: 'female', customLifespan: null, meetFrequency: 'monthly' }],
  wishes: [{ id: 'w1', title: '富士山に登る', targetAge: 45, done: false, createdAt: '2026-07-04', doneAt: null }],
};

test('未保存ならemptyDataを返しcorruptではない', () => {
  const r = LifeStore.load(memStorage());
  assert.equal(r.corrupt, false);
  assert.deepEqual(r.data, LifeStore.emptyData());
});

test('save→loadで往復できる', () => {
  const s = memStorage();
  LifeStore.save(s, VALID);
  const r = LifeStore.load(s);
  assert.equal(r.corrupt, false);
  assert.deepEqual(r.data, VALID);
});

test('壊れたJSONはcorrupt=trueでdata=null(黙って初期化しない)', () => {
  const s = memStorage({ [LifeStore.KEY]: '{broken' });
  const r = LifeStore.load(s);
  assert.equal(r.corrupt, true);
  assert.equal(r.data, null);
});

test('validate: 未来の誕生日を拒否', () => {
  const bad = JSON.parse(JSON.stringify(VALID));
  bad.self.birthDate = '2999-01-01';
  assert.equal(LifeStore.validate(bad).ok, false);
});

test('validate: 不正な頻度を拒否', () => {
  const bad = JSON.parse(JSON.stringify(VALID));
  bad.family[0].meetFrequency = 'sometimes';
  assert.equal(LifeStore.validate(bad).ok, false);
});

test('validate: 型違いのwishesを拒否', () => {
  const bad = JSON.parse(JSON.stringify(VALID));
  bad.wishes = [{ id: 'w1', title: 123, done: 'yes' }];
  assert.equal(LifeStore.validate(bad).ok, false);
});

test('importJSON: 正常系', () => {
  const r = LifeStore.importJSON(LifeStore.exportJSON(VALID));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, VALID);
});

test('importJSON: 不正データは理由つきで拒否', () => {
  assert.equal(LifeStore.importJSON('not json').ok, false);
  assert.equal(LifeStore.importJSON('{"version":99}').ok, false);
  assert.ok(LifeStore.importJSON('{"version":99}').error.length > 0);
});

test('newId: 呼ぶたびに異なるIDを返す', () => {
  assert.notEqual(LifeStore.newId(), LifeStore.newId());
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/store.test.js`
Expected: FAIL(load is not a function)

- [ ] **Step 3: 実装する**

`src/store.js`:

```js
/* 人生タイマー データ永続化 — localStorage互換オブジェクトを引数に取るDOM非依存実装 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LifeStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KEY = 'life-timer-v1';
  const GENDERS = ['male', 'female'];
  const FREQ_RE = /^(daily|weekly|monthly|yearly-\d+)$/;

  function emptyData() {
    return { version: 1, self: null, family: [], wishes: [] };
  }

  function isValidDateStr(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    if (d > now) return false;
    if (now.getFullYear() - d.getFullYear() > 150) return false;
    return true;
  }

  function validPerson(p) {
    if (!p || typeof p !== 'object') return '人物データが不正です';
    if (!isValidDateStr(p.birthDate)) return '誕生日が不正です(未来日付・150年以上前は不可)';
    if (!GENDERS.includes(p.gender)) return '性別が不正です';
    if (p.customLifespan != null &&
        !(typeof p.customLifespan === 'number' && p.customLifespan > 0 && p.customLifespan <= 150)) {
      return '目標寿命が不正です(1〜150)';
    }
    return null;
  }

  function validate(data) {
    if (!data || typeof data !== 'object') return { ok: false, error: 'データがオブジェクトではありません' };
    if (data.version !== 1) return { ok: false, error: '未対応のデータバージョンです' };
    if (data.self !== null) {
      const e = validPerson(data.self);
      if (e) return { ok: false, error: '本人: ' + e };
    }
    if (!Array.isArray(data.family)) return { ok: false, error: 'family が配列ではありません' };
    for (const f of data.family) {
      const e = validPerson(f);
      if (e) return { ok: false, error: '家族: ' + e };
      if (typeof f.name !== 'string' || f.name === '') return { ok: false, error: '家族の名前が空です' };
      if (typeof f.meetFrequency !== 'string' || !FREQ_RE.test(f.meetFrequency)) {
        return { ok: false, error: '会う頻度が不正です' };
      }
    }
    if (!Array.isArray(data.wishes)) return { ok: false, error: 'wishes が配列ではありません' };
    for (const w of data.wishes) {
      if (!w || typeof w.title !== 'string' || w.title === '') return { ok: false, error: 'やりたいことのタイトルが不正です' };
      if (typeof w.done !== 'boolean') return { ok: false, error: 'done がboolean ではありません' };
      if (w.targetAge != null &&
          !(typeof w.targetAge === 'number' && w.targetAge > 0 && w.targetAge <= 150)) {
        return { ok: false, error: '目標年齢が不正です(1〜150)' };
      }
    }
    return { ok: true };
  }

  function load(storage) {
    const raw = storage.getItem(KEY);
    if (raw === null) return { data: emptyData(), corrupt: false };
    try {
      const data = JSON.parse(raw);
      if (!validate(data).ok) return { data: null, corrupt: true };
      return { data, corrupt: false };
    } catch (_) {
      return { data: null, corrupt: true };
    }
  }

  function save(storage, data) {
    storage.setItem(KEY, JSON.stringify(data));
  }

  function exportJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  function importJSON(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      return { ok: false, error: 'JSONとして読み取れません' };
    }
    const v = validate(data);
    if (!v.ok) return { ok: false, error: v.error };
    return { ok: true, data };
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return { KEY, emptyData, validate, load, save, exportJSON, importJSON, newId, isValidDateStr };
});
```

- [ ] **Step 4: 全テストを実行して通ることを確認**

Run: `node --test test/`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/store.js test/store.test.js
git commit -m "feat: localStorage永続化・バリデーション・JSON入出力

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: UIシェル+「わたし」画面(タブ・オンボーディング・カウントダウン)

**Files:**
- Modify: `src/index.template.html`(body差し替え)
- Modify: `src/style.css`
- Modify: `src/app.js`
- Test: `test/build.test.js`(既存が通り続けること)+ 手動確認

**Interfaces:**
- Consumes: `LifeTable` / `TimeCalc` / `LifeStore`(全関数、Task 2-4のシグネチャ通り)
- Produces: `window.LifeApp = { state, render, formatBreakdown }`(qa-playtesterがコンソールから状態確認に使う)。DOM idは下記マークアップの通り(screen-self / screen-family / screen-wishes / countdown / progress-bar 等)

- [ ] **Step 1: frontend-design スキルを起動してからUIを実装する**

frontend-designスキルを読み、以下のデザイン方針でマークアップ+CSS+JSを書く:
- 前向き・夢を叶えるトーン。明るい暖色(テーマ #ff8a3d 系)+生成りの背景(#fffdf7)
- カウントダウンの数字が主役。等幅数字(`font-variant-numeric: tabular-nums`)で1秒ごとのチラつきを防ぐ
- 375px基準・下タブは `env(safe-area-inset-bottom)` 対応

`src/index.template.html` のbodyを以下に差し替え(head・scriptタグ構成は変えない):

```html
<body>
<main id="app">
  <!-- わたし -->
  <section id="screen-self" class="screen active">
    <div id="onboarding" hidden>
      <h1>人生タイマー</h1>
      <p>誕生日を入れると、残り時間が動き出します。<br>データはこの端末の中だけに保存されます。</p>
      <form id="onboarding-form">
        <label>誕生日 <input type="date" id="ob-birth" required></label>
        <label>性別(余命計算に使います)
          <select id="ob-gender" required>
            <option value="">選択してください</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
          </select>
        </label>
        <button type="submit">はじめる</button>
      </form>
    </div>
    <div id="self-timer" hidden>
      <p class="timer-label">あなたの残り時間</p>
      <div id="countdown" class="countdown" aria-live="off"></div>
      <div class="progress-track"><div id="progress-bar" class="progress-bar"></div></div>
      <p id="progress-text"></p>
      <p id="today-message" class="message">今日をどう使う?</p>
      <button id="open-settings" class="ghost-btn">設定</button>
    </div>
    <div id="settings" hidden>
      <h2>設定</h2>
      <form id="settings-form">
        <label>誕生日 <input type="date" id="set-birth" required></label>
        <label>性別
          <select id="set-gender" required>
            <option value="male">男性</option>
            <option value="female">女性</option>
          </select>
        </label>
        <label>目標寿命(任意。「100歳まで生きる」なら100)
          <input type="number" id="set-lifespan" min="1" max="150" placeholder="未設定なら統計値">
        </label>
        <button type="submit">保存</button>
        <button type="button" id="close-settings" class="ghost-btn">閉じる</button>
      </form>
      <h3>バックアップ</h3>
      <button id="export-json">JSONで書き出す</button>
      <label class="file-btn">JSONを読み込む<input type="file" id="import-json" accept=".json,application/json" hidden></label>
      <p id="import-result" role="status"></p>
    </div>
    <div id="corrupt-notice" hidden>
      <h2>データを読み込めませんでした</h2>
      <p>保存データが壊れています。バックアップJSONから復元するか、リセットしてください。</p>
      <label class="file-btn">バックアップから復元<input type="file" id="restore-json" accept=".json,application/json" hidden></label>
      <button id="reset-data" class="danger-btn">リセットして最初から</button>
    </div>
  </section>
  <!-- 家族 -->
  <section id="screen-family" class="screen">
    <h1>家族</h1>
    <ul id="family-list"></ul>
    <p id="family-empty" hidden>家族を追加すると「あと何回会えるか」がわかります。</p>
    <button id="add-family">+ 家族を追加</button>
    <dialog id="family-dialog">
      <form id="family-form" method="dialog">
        <h2 id="family-dialog-title">家族を追加</h2>
        <label>名前 <input type="text" id="fam-name" required maxlength="20"></label>
        <label>誕生日 <input type="date" id="fam-birth" required></label>
        <label>性別
          <select id="fam-gender" required>
            <option value="male">男性</option>
            <option value="female">女性</option>
          </select>
        </label>
        <label>会う頻度
          <select id="fam-freq">
            <option value="daily">毎日</option>
            <option value="weekly">週に1回</option>
            <option value="monthly" selected>月に1回</option>
            <option value="yearly-2">年に2回</option>
            <option value="yearly-1">年に1回</option>
          </select>
        </label>
        <button type="submit" id="fam-save">保存</button>
        <button type="button" id="fam-delete" class="danger-btn" hidden>削除</button>
        <button type="button" id="fam-cancel" class="ghost-btn">キャンセル</button>
      </form>
    </dialog>
  </section>
  <!-- やりたいこと -->
  <section id="screen-wishes" class="screen">
    <h1>やりたいこと</h1>
    <form id="wish-form">
      <input type="text" id="wish-title" placeholder="例: 家族で沖縄に行く" required maxlength="50">
      <input type="number" id="wish-age" min="1" max="150" placeholder="◯歳までに(任意)">
      <button type="submit">追加</button>
    </form>
    <ul id="wish-list"></ul>
    <p id="wish-empty" hidden>最初のやりたいことを書いてみましょう。</p>
    <h2 class="done-heading">叶えた夢 <span id="done-count"></span></h2>
    <ul id="wish-done-list"></ul>
  </section>
</main>
<nav class="tab-bar">
  <button class="tab-btn active" data-tab="self">わたし</button>
  <button class="tab-btn" data-tab="family">家族</button>
  <button class="tab-btn" data-tab="wishes">やりたいこと</button>
</nav>
<div id="celebrate" hidden aria-hidden="true"></div>
<footer class="source-note">出典:「令和5年簡易生命表」(厚生労働省)を加工して作成。余命は統計上の平均であり、個人の寿命を予測するものではありません。</footer>
<script>/*<!--INJECT:LIFE_TABLE-->*/</script>
<script>/*<!--INJECT:TIME_CALC-->*/</script>
<script>/*<!--INJECT:STORE-->*/</script>
<script>/*<!--INJECT:APP-->*/</script>
</body>
```

`src/style.css`: frontend-designスキルの方針で全画面分を実装(このタスクで全部書く。タブバー・カード・ダイアログ・progress-track/bar・celebrate用アニメーション・.screen{display:none}/.screen.active{display:block}・ghost-btn/danger-btn/file-btn)。

`src/app.js` にこのタスクで入れる内容(タブ切替+わたし画面):

```js
/* 人生タイマー UI */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // --- 状態 ---
  let data = null;
  let deathDates = { self: null, family: new Map() }; // データ変更時にのみ再計算
  let timerId = null;

  function recomputeDeathDates() {
    const now = new Date();
    deathDates.self = data.self ? TimeCalc.expectedDeathDate(data.self, now) : null;
    deathDates.family = new Map(
      data.family.map((f) => [f.id, TimeCalc.expectedDeathDate(f, now)])
    );
  }

  function persist() {
    LifeStore.save(localStorage, data);
    recomputeDeathDates();
    render();
  }

  // --- タブ ---
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      $('screen-' + btn.dataset.tab).classList.add('active');
      btn.classList.add('active');
    });
  });

  // --- わたし画面 ---
  function formatBreakdown(b) {
    if (b.expired) return 'おめでとうございます。統計を超えて生きています';
    const pad = (n) => String(n).padStart(2, '0');
    return `${b.years}年 ${b.months}ヶ月 ${b.days}日 ${pad(b.hours)}:${pad(b.minutes)}:${pad(b.seconds)}`;
  }

  function renderSelf() {
    const has = !!data.self;
    $('onboarding').hidden = has;
    $('self-timer').hidden = !has;
    if (!has) return;
    const now = new Date();
    const b = TimeCalc.breakdown(now, deathDates.self);
    $('countdown').textContent = formatBreakdown(b);
    const pct = TimeCalc.progressPercent(data.self.birthDate, deathDates.self, now);
    $('progress-bar').style.width = pct.toFixed(2) + '%';
    $('progress-text').textContent = `人生の ${pct.toFixed(1)}% を生きました`;
  }

  $('onboarding-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const birthDate = $('ob-birth').value;
    if (!LifeStore.isValidDateStr(birthDate)) {
      alert('誕生日が不正です(未来日付・150年以上前は入力できません)');
      return;
    }
    data.self = { name: '', birthDate, gender: $('ob-gender').value, customLifespan: null };
    persist();
  });

  // --- 毎秒更新 ---
  function tick() {
    if (data && data.self) renderSelf();
  }

  function render() {
    renderSelf();
    // renderFamily / renderWishes はTask 6-7で追加
    if (typeof renderFamily === 'function') renderFamily();
    if (typeof renderWishes === 'function') renderWishes();
  }

  // --- 起動 ---
  function init() {
    const r = LifeStore.load(localStorage);
    if (r.corrupt) {
      $('corrupt-notice').hidden = false;
      $('onboarding').hidden = true;
      return; // 黙って初期化しない(復元/リセットはTask 8で配線)
    }
    data = r.data;
    recomputeDeathDates();
    render();
    timerId = setInterval(tick, 1000);
  }

  window.LifeApp = { get data() { return data; }, render, formatBreakdown };
  init();
})();
```

(注: `renderFamily`/`renderWishes` の存在チェックはTask 6-7で実体が入るまでの橋渡し。Task 7完了後に存在チェックを外して直接呼びに書き換える)

- [ ] **Step 2: ビルドして全テストを確認**

Run: `node build.js && node --test test/`
Expected: ビルド成功+全テストPASS

- [ ] **Step 3: ブラウザで手動確認**

Run: `open dist/index.html`
確認: (1)初回はオンボーディング表示 (2)誕生日+性別を入れると残り時間が秒単位で動く (3)プログレスバーと%表示 (4)タブ切替で3画面が切り替わる (5)リロードしてもデータが残る

- [ ] **Step 4: コミット**

```bash
git add -A && git commit -m "feat: UIシェル(下タブ3画面)とわたし画面のカウントダウン

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 家族画面(CRUD+会える回数)

**Files:**
- Modify: `src/app.js`(家族セクションを追加)

**Interfaces:**
- Consumes: `TimeCalc.meetCount` / `TimeCalc.breakdown` / `LifeStore.newId` / Task 5の `persist()` `deathDates` / family-dialog のDOM
- Produces: `renderFamily()`(render()から呼ばれる)

- [ ] **Step 1: 家族セクションのJSを追加**

`src/app.js` の `// --- 毎秒更新 ---` の直前に追加:

```js
  // --- 家族画面 ---
  const FREQ_LABEL = {
    daily: '毎日会うなら', weekly: '週1で会うなら', monthly: '月1で会うなら',
    'yearly-2': '年2回会うなら', 'yearly-1': '年1回会うなら',
  };
  let editingFamilyId = null;

  function renderFamily() {
    const list = $('family-list');
    list.textContent = '';
    $('family-empty').hidden = data.family.length > 0;
    const now = new Date();
    for (const f of data.family) {
      const death = deathDates.family.get(f.id);
      const b = TimeCalc.breakdown(now, death);
      const li = document.createElement('li');
      li.className = 'family-card';
      const meets = data.self && deathDates.self
        ? TimeCalc.meetCount(deathDates.self, death, f.meetFrequency, now)
        : null;
      li.innerHTML = `
        <div class="family-head"><strong></strong><button class="ghost-btn" data-edit="${f.id}">編集</button></div>
        <p class="family-remain">残り ${b.expired ? '—' : `${b.years}年${b.months}ヶ月`}</p>
        <p class="family-meets">${meets === null ? 'わたしの誕生日を設定すると回数が出ます'
          : `${FREQ_LABEL[f.meetFrequency] || '会うなら'} <strong class="meets-num">あと${meets}回</strong>`}</p>`;
      li.querySelector('strong').textContent = f.name; // XSS防止のためtextContentで注入
      list.appendChild(li);
    }
  }

  $('family-list').addEventListener('click', (e) => {
    const id = e.target.dataset && e.target.dataset.edit;
    if (!id) return;
    const f = data.family.find((x) => x.id === id);
    editingFamilyId = id;
    $('family-dialog-title').textContent = '家族を編集';
    $('fam-name').value = f.name;
    $('fam-birth').value = f.birthDate;
    $('fam-gender').value = f.gender;
    $('fam-freq').value = f.meetFrequency;
    $('fam-delete').hidden = false;
    $('family-dialog').showModal();
  });

  $('add-family').addEventListener('click', () => {
    editingFamilyId = null;
    $('family-dialog-title').textContent = '家族を追加';
    $('family-form').reset();
    $('fam-delete').hidden = true;
    $('family-dialog').showModal();
  });

  $('family-form').addEventListener('submit', () => {
    const birthDate = $('fam-birth').value;
    if (!LifeStore.isValidDateStr(birthDate)) {
      alert('誕生日が不正です');
      return;
    }
    const rec = {
      id: editingFamilyId || LifeStore.newId(),
      name: $('fam-name').value.trim(),
      birthDate,
      gender: $('fam-gender').value,
      customLifespan: null,
      meetFrequency: $('fam-freq').value,
    };
    if (editingFamilyId) {
      data.family = data.family.map((f) => (f.id === editingFamilyId ? rec : f));
    } else {
      data.family.push(rec);
    }
    persist();
  });

  $('fam-delete').addEventListener('click', () => {
    if (!confirm('この家族を削除しますか?')) return;
    data.family = data.family.filter((f) => f.id !== editingFamilyId);
    $('family-dialog').close();
    persist();
  });

  $('fam-cancel').addEventListener('click', () => $('family-dialog').close());
```

- [ ] **Step 2: ビルド+全テスト**

Run: `node build.js && node --test test/`
Expected: PASS

- [ ] **Step 3: ブラウザで手動確認**

Run: `open dist/index.html`
確認: (1)家族追加→カードに名前・残り時間・「月1で会うなら あと◯回」 (2)頻度を変えると回数が変わる (3)編集・削除が効く (4)リロードで残る (5)本人未設定時は回数の代わりに案内文

- [ ] **Step 4: コミット**

```bash
git add src/app.js && git commit -m "feat: 家族画面(登録・編集・削除と会える回数換算)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: やりたいこと画面(リスト+達成演出)

**Files:**
- Modify: `src/app.js`

**Interfaces:**
- Consumes: Task 5の `persist()` / `data.wishes` / wish系DOM / `#celebrate`
- Produces: `renderWishes()`。Task 5の橋渡し(`typeof renderFamily === 'function'`チェック)をこのタスクで外し、`render()` は `renderSelf(); renderFamily(); renderWishes();` の直接呼びにする

- [ ] **Step 1: やりたいことセクションのJSを追加**

`src/app.js` の家族セクションの後に追加し、`render()` を直接呼びに書き換え:

```js
  // --- やりたいこと画面 ---
  function wishRemainLabel(w) {
    if (!w.targetAge || !data.self) return '';
    const deadline = TimeCalc.parseDate(data.self.birthDate);
    deadline.setFullYear(deadline.getFullYear() + w.targetAge);
    const b = TimeCalc.breakdown(new Date(), deadline);
    return b.expired ? `${w.targetAge}歳までに(期限超過)` : `${w.targetAge}歳まで 残り${b.years}年${b.months}ヶ月`;
  }

  function renderWishes() {
    const list = $('wish-list');
    const doneList = $('wish-done-list');
    list.textContent = '';
    doneList.textContent = '';
    const active = data.wishes.filter((w) => !w.done);
    const done = data.wishes.filter((w) => w.done);
    $('wish-empty').hidden = active.length > 0;
    $('done-count').textContent = done.length ? `${done.length}個` : '';
    for (const w of active) {
      const li = document.createElement('li');
      li.className = 'wish-item';
      li.innerHTML = `<label><input type="checkbox" data-wish="${w.id}"> <span class="wish-title"></span></label>
        <span class="wish-remain">${wishRemainLabel(w)}</span>
        <button class="ghost-btn" data-del-wish="${w.id}" aria-label="削除">×</button>`;
      li.querySelector('.wish-title').textContent = w.title;
      list.appendChild(li);
    }
    for (const w of done) {
      const li = document.createElement('li');
      li.className = 'wish-item done';
      li.innerHTML = `<label><input type="checkbox" checked data-wish="${w.id}"> <span class="wish-title"></span></label>`;
      li.querySelector('.wish-title').textContent = w.title;
      doneList.appendChild(li);
    }
  }

  $('wish-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('wish-title').value.trim();
    if (!title) return;
    const age = $('wish-age').value ? Number($('wish-age').value) : null;
    data.wishes.push({
      id: LifeStore.newId(), title, targetAge: age,
      done: false, createdAt: new Date().toISOString().slice(0, 10), doneAt: null,
    });
    $('wish-form').reset();
    persist();
  });

  function celebrate() {
    const el = $('celebrate');
    el.textContent = '';
    for (let i = 0; i < 24; i++) {
      const s = document.createElement('span');
      s.className = 'confetti';
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDelay = Math.random() * 0.4 + 's';
      s.style.background = ['#ff8a3d', '#ffd23d', '#3dbf6e', '#3d9bff'][i % 4];
      el.appendChild(s);
    }
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 2200);
  }

  document.addEventListener('change', (e) => {
    const id = e.target.dataset && e.target.dataset.wish;
    if (!id) return;
    const w = data.wishes.find((x) => x.id === id);
    w.done = e.target.checked;
    w.doneAt = w.done ? new Date().toISOString().slice(0, 10) : null;
    if (w.done) celebrate();
    persist();
  });

  document.addEventListener('click', (e) => {
    const id = e.target.dataset && e.target.dataset.delWish;
    if (!id) return;
    if (!confirm('このやりたいことを削除しますか?')) return;
    data.wishes = data.wishes.filter((x) => x.id !== id);
    persist();
  });
```

`render()` の書き換え(橋渡し削除):

```js
  function render() {
    renderSelf();
    renderFamily();
    renderWishes();
  }
```

`src/style.css` に confetti アニメーションが未実装なら追加(Task 5で入れていれば不要):

```css
#celebrate { position: fixed; inset: 0; pointer-events: none; z-index: 99; }
.confetti {
  position: absolute; top: -12px; width: 10px; height: 10px; border-radius: 2px;
  animation: confetti-fall 1.8s ease-in forwards;
}
@keyframes confetti-fall {
  to { transform: translateY(105vh) rotate(540deg); opacity: 0.2; }
}
```

- [ ] **Step 2: ビルド+全テスト**

Run: `node build.js && node --test test/`
Expected: PASS

- [ ] **Step 3: ブラウザで手動確認**

Run: `open dist/index.html`
確認: (1)追加→未達成リストに出る (2)「◯歳までに」を入れると残り年月表示 (3)チェック→紙吹雪→「叶えた夢」へ移動 (4)チェック解除で戻る (5)×で削除確認→削除

- [ ] **Step 4: コミット**

```bash
git add src/app.js src/style.css && git commit -m "feat: やりたいことリスト(期限連動・達成演出)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 設定・バックアップ・破損復旧の配線

**Files:**
- Modify: `src/app.js`

**Interfaces:**
- Consumes: `LifeStore.exportJSON/importJSON/save/emptyData` / settings系・corrupt-notice系DOM
- Produces: 設定画面の開閉・保存、JSON書き出し/読み込み、破損時の復元/リセット動線

- [ ] **Step 1: 設定と復旧のJSを追加**

`src/app.js` のやりたいことセクションの後に追加:

```js
  // --- 設定・バックアップ ---
  $('open-settings').addEventListener('click', () => {
    $('set-birth').value = data.self.birthDate;
    $('set-gender').value = data.self.gender;
    $('set-lifespan').value = data.self.customLifespan || '';
    $('self-timer').hidden = true;
    $('settings').hidden = false;
  });

  $('close-settings').addEventListener('click', () => {
    $('settings').hidden = true;
    $('self-timer').hidden = false;
  });

  $('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const birthDate = $('set-birth').value;
    if (!LifeStore.isValidDateStr(birthDate)) {
      alert('誕生日が不正です');
      return;
    }
    const span = $('set-lifespan').value;
    data.self = {
      name: data.self.name || '',
      birthDate,
      gender: $('set-gender').value,
      customLifespan: span ? Number(span) : null,
    };
    $('settings').hidden = true;
    persist();
  });

  function downloadJSON() {
    const blob = new Blob([LifeStore.exportJSON(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-timer-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  $('export-json').addEventListener('click', downloadJSON);

  function readImportFile(file, onOk) {
    const reader = new FileReader();
    reader.onload = () => {
      const r = LifeStore.importJSON(String(reader.result));
      if (!r.ok) {
        $('import-result').textContent = '読み込めませんでした: ' + r.error;
        return;
      }
      onOk(r.data);
    };
    reader.readAsText(file);
  }

  $('import-json').addEventListener('change', (e) => {
    if (!e.target.files[0]) return;
    if (!confirm('現在のデータを読み込んだ内容で置き換えます。よろしいですか?')) return;
    readImportFile(e.target.files[0], (d) => {
      data = d;
      $('import-result').textContent = '読み込みました';
      $('settings').hidden = true;
      persist();
    });
  });

  // --- 破損復旧(init内のcorrupt分岐から使う) ---
  $('restore-json').addEventListener('change', (e) => {
    if (!e.target.files[0]) return;
    readImportFile(e.target.files[0], (d) => {
      data = d;
      LifeStore.save(localStorage, data);
      location.reload();
    });
  });

  $('reset-data').addEventListener('click', () => {
    if (!confirm('保存データを消して最初からやり直します。よろしいですか?')) return;
    LifeStore.save(localStorage, LifeStore.emptyData());
    location.reload();
  });
```

- [ ] **Step 2: ビルド+全テスト**

Run: `node build.js && node --test test/`
Expected: PASS

- [ ] **Step 3: ブラウザで手動確認(破損復旧も)**

Run: `open dist/index.html`
確認: (1)設定で誕生日・目標寿命を変えるとカウントダウンが変わる (2)JSON書き出し→ファイルが落ちる (3)読み込みで復元される (4)DevToolsで `localStorage.setItem('life-timer-v1','{broken')` →リロード→破損画面が出て、復元とリセットの両方が機能する

- [ ] **Step 4: コミット**

```bash
git add src/app.js && git commit -m "feat: 設定・JSONバックアップ・破損時復旧動線

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: PWA(manifest・Service Worker・アイコン)+README

**Files:**
- Create: `static/manifest.json` / `static/sw.js` / `static/icon.svg` / `static/icon-maskable.svg`
- Create: `README.md`
- Modify: `src/app.js`(SW登録)
- Test: `test/build.test.js` に dist コピー検証を追加

**Interfaces:**
- Consumes: Task 1のbuild.js(static/→dist/コピーは実装済み)
- Produces: `dist/` にPWA一式。GitHub Pages配下(サブパス)でも動く相対パス構成

- [ ] **Step 1: distにPWAファイルが揃うことを検証するテストを追加**

`test/build.test.js` の末尾に追加:

```js
test('PWAファイルがdistにコピーされている', () => {
  for (const f of ['manifest.json', 'sw.js', 'icon.svg', 'icon-maskable.svg']) {
    assert.ok(fs.existsSync(path.join(root, 'dist', f)), f + ' がない');
  }
});

test('manifestが相対パス構成', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'manifest.json'), 'utf-8'));
  assert.equal(m.start_url, './?pwa=1');
  assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone');
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/build.test.js`
Expected: FAIL(manifest.json がない)

- [ ] **Step 3: PWAファイルを作る**

`static/manifest.json`:

```json
{
  "name": "人生タイマー",
  "short_name": "人生タイマー",
  "description": "残り時間を可視化して、やりたいことを今やるためのアプリ",
  "lang": "ja",
  "start_url": "./?pwa=1",
  "scope": "./",
  "display": "standalone",
  "background_color": "#fffdf7",
  "theme_color": "#ff8a3d",
  "icons": [
    { "src": "./icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "./icon-maskable.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable" }
  ]
}
```

`static/sw.js`:

```js
/* 人生タイマー Service Worker — キャッシュファースト(完全オフライン動作) */
const CACHE = 'life-timer-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg', './icon-maskable.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
  );
});
```

`static/icon.svg`(砂時計と芽。maskable版は同じ絵柄で余白を20%広く取る):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#ff8a3d"/>
  <path d="M32 22h36v6c0 8-7 13-13 18 6 5 13 10 13 18v6H32v-6c0-8 7-13 13-18-6-5-13-10-13-18z"
        fill="#fffdf7"/>
  <path d="M50 52c5 4 11 8 11 14v4H39v-4c0-6 6-10 11-14z" fill="#ffd23d"/>
  <circle cx="50" cy="34" r="4" fill="#ffd23d"/>
</svg>
```

`static/icon-maskable.svg` は上と同じ内容で `rx="0"`、図柄のパス座標を中央60%に収める(全要素の座標を `scale(0.7) translate(21,21)` 相当に調整した `<g transform="translate(15 15) scale(0.7)">` で包む)。

`src/app.js` の `init()` 呼び出し直前にSW登録を追加:

```js
  // PWA: file:直開き配布でも動くようhttp(s)時のみ登録
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
```

`README.md`: アプリ概要、使い方(dist/index.htmlを開く or GitHub Pages)、ビルド(`node build.js`)、テスト(`node --test test/`)、データはlocalStorageのみで外部送信なし、出典表記(「令和5年簡易生命表」(厚生労働省)を加工して作成)を記載。

- [ ] **Step 4: ビルド+全テスト**

Run: `node build.js && node --test test/`
Expected: PASS(全テスト)

- [ ] **Step 5: ローカルHTTPサーバでPWA動作確認**

Run: `cd dist && python3 -m http.server 8765` → ブラウザで `http://localhost:8765`
確認: (1)DevTools Application→Manifestにエラーなし (2)Service Worker登録済み (3)サーバを止めてリロードしてもオフライン表示される (4)確認後サーバ停止

- [ ] **Step 6: コミット**

```bash
git add -A && git commit -m "feat: PWA対応(manifest/Service Worker/アイコン)とREADME

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## 実装後(このプランの外)

app-dev:new-app パイプラインのステージ6へ: code-reviewer / ux-reviewer / qa-playtester を並列dispatch → 修正 → release-checker → ユーザー承認を得てGitHub Pages公開(publicリポジトリ作成が必要。gh-pagesブランチに `git subtree push --prefix dist origin gh-pages` 等)。
