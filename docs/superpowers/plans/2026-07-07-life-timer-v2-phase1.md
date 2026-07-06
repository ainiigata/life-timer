# 人生タイマー v2 第1弾 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の人生タイマー(公開済みPWA)に、行動を促す機能群の第1弾 — 格言バナー・新タブ「見つめる」(残り時間の多角的な見せ方)・今日の宣言 — を追加する。

**Architecture:** 既存の単一HTML+vanilla JS+localStorage構成を踏襲。残り時間の算出はすべて既存の誕生日→期待寿命データから。計算・整形はDOM非依存の純粋関数(time-calc.js / 新規 insight.js)に置き、node --testで検証。app.jsはDOM配線のみ。ビルドはデルマエ方式(マーカー注入)。

**Tech Stack:** vanilla JS(ES2020, npm依存ゼロ)、localStorage、node:test、GitHub Pages(mainへpushで自動デプロイ)

## Global Constraints

- npm依存ゼロ。`package.json` は作らない。テストは `node --test`(引数なし。Node 24では `node --test test/` は動かない)
- 外部通信ゼロ。CSPは `default-src 'none'` 基調。`dist/index.html` に `fetch(` 文字列を含めない(sw.jsは別ファイルなので可)
- localStorage キーは `life-timer-v1` 据え置き。`version` は 1 のまま。`today` を後方互換で追加(古いデータもそのまま読める)
- モジュールはUMDパターン(browser: `root.Xxx = factory(deps)` / node: `module.exports = factory(require(...))`)
- ユーザー入力・格言テキストは `textContent` で注入(innerHTMLに生値を入れない)
- 呼吸・鼓動・確率カードには「統計からのおおよその目安。医療情報ではありません。」の注記を画面に出す
- 生命表データの出典表記(既存フッター)は維持。qxも同じ「令和5年簡易生命表」由来
- コミットメッセージ末尾: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 作業ディレクトリ: `/Users/yamadatoshi/yamada-ai-claude/projects/life-timer/`、ブランチは feat/v2-phase1

## ファイル構成(このプランで触るもの)

- Create: `src/quotes.js`(UMD `Quotes`、格言リスト)
- Create: `src/insight.js`(UMD `Insight`、依存 LifeTable+TimeCalc。カードのビューモデルを組む純粋関数)
- Modify: `src/life-table.js`(qx=年間死亡率テーブル + `annualMortality`)
- Modify: `src/time-calc.js`(残り秒・回数・生きた日数・日次死亡確率・今日の残り)
- Modify: `src/store.js`(`today` の emptyData/validate 対応)
- Modify: `src/index.template.html`(格言バナー・見つめるタブ/画面・今日の宣言のマークアップ、script2本追加)
- Modify: `src/style.css`(格言バナー・カード・今日の宣言のスタイル)
- Modify: `src/app.js`(格言バナー・renderInsight・今日の宣言の配線、4タブ対応)
- Modify: `build.js`(INJECTIONSに QUOTES/INSIGHT 追加)
- Modify: `test/build.test.js`(scriptタグ 4→6)
- Test: `test/life-table.test.js` / `test/time-calc.test.js` / `test/store.test.js` / `test/insight.test.js`(新規)

---

### Task 1: 生命表に年間死亡率(qx)を追加

**Files:**
- Modify: `src/life-table.js`
- Test: `test/life-table.test.js`

**Interfaces:**
- Consumes: なし
- Produces: `LifeTable.annualMortality(gender: 'male'|'female', age: number): number`(年間死亡率、線形補間、105歳以上は1.0、負は0歳値、不明性別はthrow)/ `LifeTable.MORTALITY`

- [ ] **Step 1: 失敗するテストを書く**

`test/life-table.test.js` の末尾に追加:

```js
test('annualMortality: 掲載年齢はそのままの値', () => {
  assert.equal(LifeTable.annualMortality('male', 40), 0.00102);
  assert.equal(LifeTable.annualMortality('female', 65), 0.00437);
});

test('annualMortality: 中間年齢は線形補間', () => {
  const v = LifeTable.annualMortality('male', 42.5); // 40(0.00102)と45(0.00147)の中間
  assert.ok(Math.abs(v - (0.00102 + 0.00147) / 2) < 1e-9);
});

test('annualMortality: 105歳以上は1.0', () => {
  assert.equal(LifeTable.annualMortality('female', 110), 1);
});

test('annualMortality: 負の年齢は0歳値', () => {
  assert.equal(LifeTable.annualMortality('male', -3), 0.00065);
});

test('annualMortality: 不明な性別はエラー', () => {
  assert.throws(() => LifeTable.annualMortality('x', 30));
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/life-table.test.js`
Expected: FAIL(annualMortality is not a function)

- [ ] **Step 3: 実装する**

`src/life-table.js` の factory 内、`LIFE_TABLE` の後・`return` の前に追加。数値は令和5年簡易生命表の死亡率(qx)列(一次資料 life23 xlsx から抽出済み):

```js
  // 年間死亡率(qx: 年齢xの人が1年以内に死亡する確率)。出典・加工は上記に同じ
  const MORTALITY = {
    male: {
      0: 0.00065, 5: 0.00009, 10: 0.00006, 15: 0.00018, 20: 0.00043, 25: 0.00050,
      30: 0.00055, 35: 0.00073, 40: 0.00102, 45: 0.00147, 50: 0.00243, 55: 0.00399,
      60: 0.00633, 65: 0.01049, 70: 0.01724, 75: 0.02839, 80: 0.04773, 85: 0.08414,
      90: 0.15182, 95: 0.25176, 100: 0.40062, 105: 1,
    },
    female: {
      0: 0.00061, 5: 0.00008, 10: 0.00006, 15: 0.00015, 20: 0.00027, 25: 0.00028,
      30: 0.00028, 35: 0.00041, 40: 0.00059, 45: 0.00088, 50: 0.00146, 55: 0.00211,
      60: 0.00300, 65: 0.00437, 70: 0.00703, 75: 0.01215, 80: 0.02269, 85: 0.04654,
      90: 0.09579, 95: 0.18687, 100: 0.32744, 105: 1,
    },
  };

  function annualMortality(gender, age) {
    const t = MORTALITY[gender];
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
```

`return { LIFE_TABLE, remainingYears };` を `return { LIFE_TABLE, MORTALITY, remainingYears, annualMortality };` に変更。

- [ ] **Step 4: 全テストを実行して通ることを確認**

Run: `node --test`
Expected: PASS(既存 + 新規5件)

- [ ] **Step 5: コミット**

```bash
git add src/life-table.js test/life-table.test.js
git commit -m "feat: 生命表に年間死亡率(qx)と annualMortality を追加

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: time-calc に見つめる用の純粋関数を追加

**Files:**
- Modify: `src/time-calc.js`
- Test: `test/time-calc.test.js`

**Interfaces:**
- Consumes: `LifeTable`(既存 factory 引数)
- Produces:
  - `TimeCalc.remainingSeconds(now: Date, death: Date): number`(整数、期限切れは0)
  - `TimeCalc.countByRatePerMinute(remainingSec: number, perMinute: number): number`(floor(sec×perMinute/60))
  - `TimeCalc.occurrencesUntil(now: Date, death: Date, perYear: number): number`(floor(残り年×perYear)、期限切れは0)
  - `TimeCalc.daysLived(birthDateStr: string, now: Date): number`(整数、負にならない)
  - `TimeCalc.dailyDeathProbability(qxAnnual: number): number`(1−(1−qx)^(1/365))
  - `TimeCalc.awakeRemainingToday(now: Date, bedHour: number): {hours: number, minutes: number}`(就寝時刻を過ぎていれば{0,0})

- [ ] **Step 1: 失敗するテストを書く**

`test/time-calc.test.js` の末尾に追加:

```js
test('remainingSeconds: 期限までの秒(期限切れは0)', () => {
  const now = new Date(2026, 0, 1, 0, 0, 0);
  assert.equal(TimeCalc.remainingSeconds(now, new Date(2026, 0, 1, 0, 0, 10)), 10);
  assert.equal(TimeCalc.remainingSeconds(now, new Date(2025, 0, 1)), 0);
});

test('countByRatePerMinute: 呼吸16/分・鼓動70/分', () => {
  assert.equal(TimeCalc.countByRatePerMinute(60, 16), 16);
  assert.equal(TimeCalc.countByRatePerMinute(60, 70), 70);
  assert.equal(TimeCalc.countByRatePerMinute(90, 16), 24); // floor(90*16/60)=24
});

test('occurrencesUntil: 残り年×頻度(切り捨て)', () => {
  const now = new Date(2026, 0, 1);
  const death = new Date(2036, 0, 1); // 約10年
  const n = TimeCalc.occurrencesUntil(now, death, 1); // 桜=年1
  assert.ok(n === 9 || n === 10, `got ${n}`);
  assert.equal(TimeCalc.occurrencesUntil(now, new Date(2025, 0, 1), 1), 0);
});

test('daysLived: 生きた日数(うるう跨ぎ)', () => {
  const now = new Date(2026, 0, 1);
  assert.equal(TimeCalc.daysLived('2025-01-01', now), 365);
  assert.equal(TimeCalc.daysLived('2024-01-01', now), 731); // 2024はうるう年
  assert.equal(TimeCalc.daysLived('2027-01-01', now), 0);   // 未来は0
});

test('dailyDeathProbability: qxからの日次確率', () => {
  const p = TimeCalc.dailyDeathProbability(0.00102);
  assert.ok(p > 0 && p < 0.00102, `got ${p}`);
  assert.ok(Math.abs(p - (1 - Math.pow(1 - 0.00102, 1 / 365))) < 1e-15);
});

test('awakeRemainingToday: 就寝前は残りあり・就寝後は0', () => {
  const before = TimeCalc.awakeRemainingToday(new Date(2026, 0, 1, 21, 0, 0), 23);
  assert.deepEqual(before, { hours: 2, minutes: 0 });
  const after = TimeCalc.awakeRemainingToday(new Date(2026, 0, 1, 23, 30, 0), 23);
  assert.deepEqual(after, { hours: 0, minutes: 0 });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/time-calc.test.js`
Expected: FAIL(remainingSeconds is not a function)

- [ ] **Step 3: 実装する**

`src/time-calc.js` の `meetCount` の後、`return` の前に追加:

```js
  function remainingSeconds(now, death) {
    return Math.max(0, Math.floor((death.getTime() - now.getTime()) / 1000));
  }

  function countByRatePerMinute(remainingSec, perMinute) {
    return Math.floor(remainingSec * perMinute / 60);
  }

  function occurrencesUntil(now, death, perYear) {
    const years = Math.max(0, (death.getTime() - now.getTime()) / MS_PER_YEAR);
    return Math.floor(years * perYear);
  }

  function daysLived(birthDateStr, now) {
    const days = Math.floor((now.getTime() - parseDate(birthDateStr).getTime()) / MS_DAY);
    return Math.max(0, days);
  }

  function dailyDeathProbability(qxAnnual) {
    return 1 - Math.pow(1 - qxAnnual, 1 / 365);
  }

  function awakeRemainingToday(now, bedHour) {
    const bed = new Date(now);
    bed.setHours(bedHour, 0, 0, 0);
    let ms = bed.getTime() - now.getTime();
    if (ms <= 0) return { hours: 0, minutes: 0 };
    const hours = Math.floor(ms / 3600000); ms -= hours * 3600000;
    const minutes = Math.floor(ms / 60000);
    return { hours, minutes };
  }
```

`return { ... , meetCount };` に上記6関数を追加して export する。

- [ ] **Step 4: 全テストを実行して通ることを確認**

Run: `node --test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/time-calc.js test/time-calc.test.js
git commit -m "feat: 見つめる用の時間計算関数(残り秒・回数・生きた日数・死亡確率・今日の残り)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: store に today(今日の宣言)を後方互換で追加

**Files:**
- Modify: `src/store.js`
- Test: `test/store.test.js`

**Interfaces:**
- Consumes: なし
- Produces: `emptyData()` が `today: null` を含む。`validate` が `today` を「null または {date:非空文字列, text:非空文字列, done:boolean}」として許容(未定義キーも許容し後方互換)

- [ ] **Step 1: 失敗するテストを書く**

`test/store.test.js` の末尾に追加(既存の memStorage / VALID を利用):

```js
test('emptyData は today:null を含む', () => {
  assert.equal(LifeStore.emptyData().today, null);
});

test('validate: 正しい today を許容', () => {
  const d = JSON.parse(JSON.stringify(VALID));
  d.today = { date: '2026-07-07', text: '履歴書を書く', done: false };
  assert.equal(LifeStore.validate(d).ok, true);
});

test('validate: today なしの古いデータも許容(後方互換)', () => {
  const d = JSON.parse(JSON.stringify(VALID));
  delete d.today;
  assert.equal(LifeStore.validate(d).ok, true);
});

test('validate: 壊れた today を拒否', () => {
  const d = JSON.parse(JSON.stringify(VALID));
  d.today = { date: '', text: 123, done: 'no' };
  assert.equal(LifeStore.validate(d).ok, false);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/store.test.js`
Expected: FAIL(emptyData().today が undefined / 壊れたtodayが通る)

- [ ] **Step 3: 実装する**

`src/store.js` の `emptyData` を変更:

```js
  function emptyData() {
    return { version: 1, self: null, family: [], wishes: [], today: null };
  }
```

`validate` の wishes ループの後、`return { ok: true };` の前に today 検証を追加:

```js
    if (data.today != null) {
      const t = data.today;
      if (typeof t !== 'object') return { ok: false, error: 'today が不正です' };
      if (typeof t.date !== 'string' || t.date === '') return { ok: false, error: '今日の宣言の日付が不正です' };
      if (typeof t.text !== 'string' || t.text === '') return { ok: false, error: '今日の宣言のテキストが不正です' };
      if (typeof t.done !== 'boolean') return { ok: false, error: '今日の宣言の done が不正です' };
    }
```

（`data.today` が undefined のケースは `!= null` で素通り＝後方互換。）

- [ ] **Step 4: 全テストを実行して通ることを確認**

Run: `node --test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/store.js test/store.test.js
git commit -m "feat: store に today(今日の宣言)を後方互換で追加

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 格言モジュール(quotes.js)

**Files:**
- Create: `src/quotes.js`
- Test: `test/quotes.test.js`

**Interfaces:**
- Consumes: なし
- Produces: `Quotes.LIST: Array<{author: string, text: string}>`(25件以上、各要素は非空)

- [ ] **Step 1: 失敗するテストを書く**

`test/quotes.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const Quotes = require('../src/quotes.js');

test('LIST は25件以上ある', () => {
  assert.ok(Array.isArray(Quotes.LIST));
  assert.ok(Quotes.LIST.length >= 25, `got ${Quotes.LIST.length}`);
});

test('各格言は author と text を非空で持つ', () => {
  for (const q of Quotes.LIST) {
    assert.ok(typeof q.author === 'string' && q.author.length > 0);
    assert.ok(typeof q.text === 'string' && q.text.length > 0);
  }
});

test('ユーザー指定の核5名が含まれる', () => {
  const authors = Quotes.LIST.map((q) => q.author).join('｜');
  for (const a of ['ジョブズ', '中島敦', 'ガンジー', 'セネカ', '吉田松陰']) {
    assert.ok(authors.includes(a), `missing ${a}`);
  }
});

test('重複(同一author+text)がない', () => {
  const keys = Quotes.LIST.map((q) => q.author + '|' + q.text);
  assert.equal(new Set(keys).size, keys.length);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/quotes.test.js`
Expected: FAIL(Cannot find module quotes.js)

- [ ] **Step 3: 実装する**

`src/quotes.js` を作る。核5つ(スペック記載の文言)を必ず含め、時間・行動・今を生きるをテーマに合計25件以上。**各格言は収録前に文言・人物を信頼できる出典で確認し、誤帰属・出典不明のものは載せない**(諸説あるものは避ける)。UMD:

```js
/* 人生タイマー 格言集 — 時間・行動・今を生きることをテーマにした偉人の言葉 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Quotes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LIST = [
    { author: 'スティーブ・ジョブズ', text: 'もし今日が人生最後の日だとしたら、今日やろうとしていることを本当にやりたいか?' },
    { author: '中島敦', text: '人生は何事もなさぬにはあまりにも長いが、何事かをなすにはあまりにも短い' },
    { author: 'マハトマ・ガンジー', text: '明日死ぬかのように生きよ。永遠に生きるかのように学べ' },
    { author: 'セネカ', text: '致命的なのは、時間が足りないことではなく、多くの時間を無駄にしていることだ' },
    { author: '吉田松陰', text: '今日できることを明日に延ばすな。今日という日は二度と来ない' },
    // …実装者が信頼できる出典で裏取りした格言を合計25件以上になるまで追加する
  ];
  return { LIST };
});
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `node --test test/quotes.test.js`
Expected: PASS(4件)

- [ ] **Step 5: コミット**

```bash
git add src/quotes.js test/quotes.test.js
git commit -m "feat: 格言集モジュール(裏取り済み25件以上)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 見つめるカードのビューモデル(insight.js)

**Files:**
- Create: `src/insight.js`
- Test: `test/insight.test.js`

**Interfaces:**
- Consumes: `LifeTable.annualMortality` / `TimeCalc`(remainingSeconds, countByRatePerMinute, occurrencesUntil, daysLived, dailyDeathProbability, awakeRemainingToday, MS_PER_YEAR, parseDate, expectedDeathDate)
- Produces: `Insight.build(self: {birthDate, gender, customLifespan?}, deathDate: Date, now: Date): Array<{id, label, value, sub}>`
  - id: 'seconds'|'breaths'|'heartbeats'|'breakdown'|'counts'|'death-prob'|'parent-days'|'today-remaining'
  - label: カード見出し(string) / value: 主表示(string) / sub: 補足(string、無ければ '')
- Produces: `Insight.formatOku(n: number): string`(大きい整数を「約○億○万」等の日本語表記に。桁は万・億・兆)

- [ ] **Step 1: 失敗するテストを書く**

`test/insight.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const Insight = require('../src/insight.js');

const self = { birthDate: '1986-07-04', gender: 'male', customLifespan: null };
const now = new Date(2026, 6, 7, 12, 0, 0);
const death = new Date(2068, 6, 4); // 約42年後

test('formatOku: 万・億の日本語表記', () => {
  assert.equal(Insight.formatOku(0), '0');
  assert.equal(Insight.formatOku(1234), '1,234');
  assert.equal(Insight.formatOku(12340000), '1234万');
  assert.equal(Insight.formatOku(123400000), '1億2340万');
});

test('build: 8枚のカードを返す', () => {
  const cards = Insight.build(self, death, now);
  const ids = cards.map((c) => c.id);
  assert.deepEqual(ids, ['seconds','breaths','heartbeats','breakdown','counts','death-prob','parent-days','today-remaining']);
  for (const c of cards) {
    assert.ok(c.label && c.value !== undefined && c.sub !== undefined);
  }
});

test('build: 残り秒カードは残り秒数を反映', () => {
  const cards = Insight.build(self, death, now);
  const sec = cards.find((c) => c.id === 'seconds');
  assert.match(sec.value, /秒/);
});

test('build: 明日死ぬ確率カードは確率と宝くじ比較を含む', () => {
  const cards = Insight.build(self, death, now);
  const dp = cards.find((c) => c.id === 'death-prob');
  assert.ok(dp.value.length > 0);
  assert.match(dp.sub, /宝くじ/);
});

test('build: 親に育ててもらった日数は生きた日数', () => {
  const cards = Insight.build(self, death, now);
  const pd = cards.find((c) => c.id === 'parent-days');
  assert.match(pd.value, /日/);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/insight.test.js`
Expected: FAIL(Cannot find module insight.js)

- [ ] **Step 3: 実装する**

`src/insight.js`(UMD、依存注入)。各カードのビューモデルを組む。数値整形の `formatOku` と各カードを実装。宝くじ1等は約2000万分の1(注記付き固定値)。呼吸16/分・鼓動70/分・睡眠1日8時間・就寝23時。

```js
/* 人生タイマー 見つめるカードのビューモデル — DOM非依存の純粋関数 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./life-table.js'), require('./time-calc.js'));
  else root.Insight = factory(root.LifeTable, root.TimeCalc);
})(typeof self !== 'undefined' ? self : this, function (LifeTable, TimeCalc) {
  'use strict';

  const LOTTERY_ODDS = 20000000; // 宝くじ1等 約2000万分の1(注記付きの目安)
  const BREATHS_PER_MIN = 16;
  const HEARTBEATS_PER_MIN = 70;
  const SLEEP_FRACTION = 8 / 24;
  const BED_HOUR = 23;
  const MOON_PER_YEAR = 12.37;

  // 大きい整数を「1億2340万」形式に(万・億・兆)。1万未満はカンマ区切り
  function formatOku(n) {
    n = Math.floor(n);
    if (n < 10000) return n.toLocaleString('en-US');
    const units = [[1e12, '兆'], [1e8, '億'], [1e4, '万']];
    let rest = n, out = '';
    for (const [base, label] of units) {
      if (rest >= base) {
        out += Math.floor(rest / base) + label;
        rest = rest % base;
      }
    }
    return out;
  }

  function ageAt(self, now) {
    return (now.getTime() - TimeCalc.parseDate(self.birthDate).getTime()) / TimeCalc.MS_PER_YEAR;
  }

  function build(self, deathDate, now) {
    const sec = TimeCalc.remainingSeconds(now, deathDate);
    const years = sec / (TimeCalc.MS_PER_YEAR / 1000);

    // 明日死ぬ確率
    const qx = LifeTable.annualMortality(self.gender, ageAt(self, now));
    const pDay = TimeCalc.dailyDeathProbability(qx);
    const oneIn = pDay > 0 ? Math.round(1 / pDay) : Infinity;
    const timesVsLottery = pDay > 0 ? Math.round(LOTTERY_ODDS * pDay) : 0;
    const surviveP = ((1 - pDay) * 100).toFixed(4);

    return [
      { id: 'seconds', label: '残り時間を秒で数えると', value: `約 ${formatOku(sec)} 秒`, sub: '1秒、また1秒と減っていきます' },
      { id: 'breaths', label: 'これからする呼吸', value: `約 ${formatOku(TimeCalc.countByRatePerMinute(sec, BREATHS_PER_MIN))} 回`, sub: `1分に約${BREATHS_PER_MIN}回として` },
      { id: 'heartbeats', label: 'これから打つ鼓動', value: `約 ${formatOku(TimeCalc.countByRatePerMinute(sec, HEARTBEATS_PER_MIN))} 回`, sub: `1分に約${HEARTBEATS_PER_MIN}回として` },
      { id: 'breakdown', label: '残り時間の内訳', value: `眠っている時間だけで 約${Math.floor(years * SLEEP_FRACTION)}年`, sub: `起きて使える時間は 約${Math.floor(years * (1 - SLEEP_FRACTION))}年` },
      { id: 'counts', label: 'あと何回、めぐってくる?', value: `桜 ${TimeCalc.occurrencesUntil(now, deathDate, 1)}回・年末 ${TimeCalc.occurrencesUntil(now, deathDate, 1)}回`, sub: `満月は あと${formatOku(TimeCalc.occurrencesUntil(now, deathDate, MOON_PER_YEAR))}回` },
      { id: 'death-prob', label: '明日、無事に朝を迎えられる確率', value: `${surviveP}%`, sub: `それでも、宝くじ1等(約2000万分の1)より、明日が来ない可能性のほうが約${timesVsLottery}倍高い。だから今日を大切に。` },
      { id: 'parent-days', label: '親が見守ってくれた日々', value: `${formatOku(TimeCalc.daysLived(self.birthDate, now))} 日`, sub: 'あなたが生きてきた日数です' },
      (function () {
        const a = TimeCalc.awakeRemainingToday(now, BED_HOUR);
        const v = (a.hours === 0 && a.minutes === 0) ? 'そろそろ休みましょう' : `あと ${a.hours}時間${a.minutes}分`;
        return { id: 'today-remaining', label: '今日、起きていられる時間', value: v, sub: '一日は、今日ももう戻ってきません' };
      })(),
    ];
  }

  return { formatOku, build };
});
```

- [ ] **Step 4: 全テストを実行して通ることを確認**

Run: `node --test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/insight.js test/insight.test.js
git commit -m "feat: 見つめるカードのビューモデル(insight.js)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: ビルドに新モジュールを組み込む(quotes/insight)

**Files:**
- Modify: `build.js`
- Modify: `src/index.template.html`(script2本追加。UIマークアップはTask 7-9で追加)
- Modify: `test/build.test.js`

**Interfaces:**
- Consumes: Task 4-5 の src/quotes.js, src/insight.js
- Produces: `dist/index.html` に QUOTES/INSIGHT がインライン化され、scriptタグが6本になる

- [ ] **Step 1: build.test.js の script 本数を更新(失敗する状態にする)**

`test/build.test.js` の該当assertを 4→6 に変更:

```js
test('script閉じタグの早期終了がない', () => {
  const open = (html.match(/<script>/g) || []).length;
  const close = (html.match(/<\/script>/g) || []).length;
  assert.equal(open, close);
  assert.equal(open, 6);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/build.test.js`
Expected: FAIL(現状4本なので `open === 6` が失敗)

- [ ] **Step 3: build.js と template に注入を追加**

`build.js` の INJECTIONS を依存順に(LIFE_TABLE → TIME_CALC → QUOTES → INSIGHT → STORE → APP):

```js
const INJECTIONS = {
  STYLE: escapeStyle(read('src/style.css')),
  LIFE_TABLE: escapeScript(read('src/life-table.js')),
  TIME_CALC: escapeScript(read('src/time-calc.js')),
  QUOTES: escapeScript(read('src/quotes.js')),
  INSIGHT: escapeScript(read('src/insight.js')),
  STORE: escapeScript(read('src/store.js')),
  APP: escapeScript(read('src/app.js')),
};
```

`src/index.template.html` の script 群を、依存順になるよう差し替え(LIFE_TABLE と TIME_CALC の後に QUOTES/INSIGHT、その後 STORE/APP):

```html
<script>/*<!--INJECT:LIFE_TABLE-->*/</script>
<script>/*<!--INJECT:TIME_CALC-->*/</script>
<script>/*<!--INJECT:QUOTES-->*/</script>
<script>/*<!--INJECT:INSIGHT-->*/</script>
<script>/*<!--INJECT:STORE-->*/</script>
<script>/*<!--INJECT:APP-->*/</script>
```

- [ ] **Step 4: ビルドして全テストが通ることを確認**

Run: `node build.js && node --test`
Expected: ビルド成功 + 全テストPASS(script 6本)

- [ ] **Step 5: コミット**

```bash
git add build.js src/index.template.html test/build.test.js
git commit -m "build: quotes/insight モジュールをインライン化(script 6本)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 格言バナー(わたし画面上部)

**Files:**
- Modify: `src/index.template.html`(格言バナーのマークアップ)
- Modify: `src/style.css`
- Modify: `src/app.js`

**Interfaces:**
- Consumes: `Quotes.LIST`
- Produces: `#quote-banner`(タップで次の格言・重複を避けて巡回)。本人未設定でも表示

- [ ] **Step 1: マークアップを追加**

`src/index.template.html` の `#screen-self` の先頭(オンボーディング/タイマーより上)に追加:

```html
<button id="quote-banner" class="quote-banner" type="button" aria-label="次の言葉">
  <span id="quote-text" class="quote-text"></span>
  <span id="quote-author" class="quote-author"></span>
</button>
```

- [ ] **Step 2: スタイルを追加**

`src/style.css` に格言バナーのスタイルを追加(既存のテーマ変数・角丸・影を踏襲。全幅・タップ可能・引用符装飾など。frontend-design スキルを起動してトーンを合わせる)。

- [ ] **Step 3: app.js に巡回ロジックを追加**

`src/app.js` の IIFE 内、状態宣言の近くに追加。シャッフルした順序を持ち、タップで次へ。表示は textContent:

```js
  // --- 格言バナー ---
  let quoteOrder = [];
  let quotePos = 0;
  function shuffleQuotes() {
    quoteOrder = Quotes.LIST.map((_, i) => i);
    for (let i = quoteOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [quoteOrder[i], quoteOrder[j]] = [quoteOrder[j], quoteOrder[i]];
    }
    quotePos = 0;
  }
  function showQuote() {
    if (quoteOrder.length === 0) shuffleQuotes();
    const q = Quotes.LIST[quoteOrder[quotePos]];
    $('quote-text').textContent = '「' + q.text + '」';
    $('quote-author').textContent = '— ' + q.author;
  }
  function nextQuote() {
    quotePos++;
    if (quotePos >= quoteOrder.length) shuffleQuotes();
    showQuote();
  }
  $('quote-banner').addEventListener('click', nextQuote);
```

`init()` 内(データ読み込み後、render前後どこか一度)で `shuffleQuotes(); showQuote();` を呼ぶ。

- [ ] **Step 4: ビルド+全テスト**

Run: `node build.js && node --test`
Expected: PASS(既存テストが壊れないこと)

- [ ] **Step 5: 手動確認**

Run: `open dist/index.html`
確認: 格言が表示される / タップで次に変わる / 一周したら再シャッフルされ繰り返す

- [ ] **Step 6: コミット**

```bash
git add -A && git commit -m "feat: 格言バナー(タップで巡回)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 新タブ「見つめる」(カード表示)

**Files:**
- Modify: `src/index.template.html`(タブボタン・#screen-insight)
- Modify: `src/style.css`
- Modify: `src/app.js`

**Interfaces:**
- Consumes: `Insight.build(self, deathDate, now)` / 既存 `deathDates.self`
- Produces: `renderInsight()`(見つめる画面のカード描画)。アクティブ時は tick で毎秒更新。本人未設定は案内文

- [ ] **Step 1: マークアップを追加**

タブバー(`.tab-bar`)の「わたし」ボタンの直後に追加:

```html
<button class="tab-btn" data-tab="insight">見つめる</button>
```

`#screen-self` と `#screen-family` の間に画面を追加:

```html
<section id="screen-insight" class="screen">
  <h1>見つめる</h1>
  <p id="insight-empty" hidden>まず「わたし」で誕生日を設定してください。</p>
  <div id="insight-cards"></div>
  <p class="insight-note">呼吸・鼓動・確率は統計からのおおよその目安です。医療情報ではありません。</p>
</section>
```

- [ ] **Step 2: スタイルを追加**

`src/style.css` に `.insight-card`(label/value/sub)・`#insight-cards` レイアウト・`.insight-note` を追加(frontend-design のトーンで。value を主役に大きく、tabular-nums)。

- [ ] **Step 3: app.js に renderInsight を追加**

```js
  // --- 見つめる画面 ---
  function renderInsight() {
    const has = !!data.self;
    $('insight-empty').hidden = has;
    const wrap = $('insight-cards');
    if (!has) { wrap.textContent = ''; return; }
    const cards = Insight.build(data.self, deathDates.self, new Date());
    // 既存カードがあれば value/sub のみ更新、なければ生成(毎秒呼ばれるので作り直しを避ける)
    if (wrap.childElementCount !== cards.length) {
      wrap.textContent = '';
      for (const c of cards) {
        const el = document.createElement('div');
        el.className = 'insight-card';
        el.dataset.id = c.id;
        el.innerHTML = '<p class="insight-label"></p><p class="insight-value"></p><p class="insight-sub"></p>';
        wrap.appendChild(el);
      }
    }
    const els = wrap.children;
    cards.forEach((c, i) => {
      const el = els[i];
      el.querySelector('.insight-label').textContent = c.label;
      el.querySelector('.insight-value').textContent = c.value;
      el.querySelector('.insight-sub').textContent = c.sub;
    });
  }
```

`render()` に `renderInsight();` を追加。`tick()` を「アクティブ画面のみ毎秒更新」に拡張:

```js
  function tick() {
    if (!data || !data.self) return;
    if ($('screen-self').classList.contains('active')) renderSelf();
    if ($('screen-insight').classList.contains('active')) renderInsight();
  }
```

（既存 tick が renderSelf を無条件に呼んでいる場合は上記に置換。renderInsight は insight-value を textContent 更新するだけなので軽量。）

- [ ] **Step 4: ビルド+全テスト**

Run: `node build.js && node --test`
Expected: PASS

- [ ] **Step 5: 手動確認**

Run: `open dist/index.html`
確認: 誕生日設定後、見つめるタブに8枚のカード / 残り秒が毎秒減る / 本人未設定時は案内文 / タブが4つ並ぶ(375pxで収まる)

- [ ] **Step 6: コミット**

```bash
git add -A && git commit -m "feat: 見つめるタブ(残り時間の多角的な可視化カード)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 今日の宣言(わたし画面)

**Files:**
- Modify: `src/index.template.html`
- Modify: `src/style.css`
- Modify: `src/app.js`

**Interfaces:**
- Consumes: 既存 `persist()` / `data.today` / `celebrate()` / `LifeStore`
- Produces: `renderToday()`。当日未設定は入力欄、設定済みは宣言+チェック。日付跨ぎでリセット

- [ ] **Step 1: マークアップを追加**

`#self-timer` 内(カウントダウンの下、設定ボタンの上あたり)に追加:

```html
<div id="today-declaration" class="today-declaration">
  <form id="today-form">
    <label for="today-input">今日やることを1つ</label>
    <input type="text" id="today-input" maxlength="60" placeholder="例: 履歴書を書く">
    <button type="submit">決める</button>
  </form>
  <div id="today-set" hidden>
    <p class="today-label">今日の宣言</p>
    <label class="today-check"><input type="checkbox" id="today-done"> <span id="today-text"></span></label>
    <button type="button" id="today-clear" class="ghost-btn">変更</button>
  </div>
</div>
```

- [ ] **Step 2: スタイルを追加**

`src/style.css` に `.today-declaration` 一式(達成時の取り消し線など)。

- [ ] **Step 3: app.js に配線を追加**

```js
  // --- 今日の宣言 ---
  function todayStr(now) {
    const p = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  }
  function currentToday() {
    // 当日分でなければ未設定扱い
    if (data.today && data.today.date === todayStr(new Date())) return data.today;
    return null;
  }
  function renderToday() {
    if (!data.self) { $('today-declaration').hidden = true; return; }
    $('today-declaration').hidden = false;
    const t = currentToday();
    $('today-form').hidden = !!t;
    $('today-set').hidden = !t;
    if (t) {
      $('today-text').textContent = t.text;
      $('today-done').checked = t.done;
      $('today-set').classList.toggle('done', t.done);
    } else {
      $('today-input').value = '';
    }
  }
  $('today-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('today-input').value.trim();
    if (!text) return;
    data.today = { date: todayStr(new Date()), text, done: false };
    persist();
  });
  $('today-done').addEventListener('change', (e) => {
    if (!data.today) return;
    data.today.done = e.target.checked;
    if (e.target.checked) celebrate();
    persist();
  });
  $('today-clear').addEventListener('click', () => {
    data.today = null;
    persist();
  });
```

`renderSelf()` の末尾または `render()` に `renderToday();` を追加。

- [ ] **Step 4: ビルド+全テスト**

Run: `node build.js && node --test`
Expected: PASS

- [ ] **Step 5: 手動確認**

Run: `open dist/index.html`
確認: 宣言を入力→表示に切替 / チェックで演出+取り消し線 / 「変更」で入力に戻る / リロードで保持 / (DevToolsで data.today.date を昨日にして)リロード→当日未設定に戻る

- [ ] **Step 6: コミット**

```bash
git add -A && git commit -m "feat: 今日の宣言(朝決めて夜チェック・日付でリセット)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## 実装後(このプランの外)

- 実操作QA(スマホ375px / PC1280px、Playwright): 格言巡回・8カード・毎秒更新・今日の宣言・4タブ・XSS(宣言テキストに `<img onerror>`)・コンソールエラーゼロ
- 最終ブランチレビュー → 修正 → main へ push で GitHub Actions 自動デプロイ → 公開URLで動作確認
- 第2弾スペック(続柄→抱っこ残り日数、優先順位、Life in Weeks)は別サイクル
