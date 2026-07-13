# 人生タイマー v2 第2弾 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 家族の続柄→残り日数 / 優先順位+夢ピン留め / Life in Weeks格子 の3機能を追加する

**Architecture:** 既存の単一HTMLビルド(6モジュール)に後方互換でフィールド追加。新ファイルなし。store.js検証拡張 → time-calc.js関数追加 → HTMLテンプレート拡張 → app.js描画拡張 の順で進める。

**Tech Stack:** vanilla JS + localStorage + CSS Grid。node --test でテスト。node build.js でビルド。

## Global Constraints

- localStorage キー `life-timer-v1` バージョン 1 据え置き。後方互換(旧データでも動く)。
- ビルドモジュール数は 6 のまま(新しい .js を作らない)。
- テストコマンド: `node --test`(引数なし。Node v24 では `node --test test/` は動かない)。
- スクリプト数アサーション: build.test.js の `assert.equal(open, 6)` は変えない。
- 新HTML要素IDは build.test.js に存在確認テストを追加する。
- 追加コストゼロ。外部APIなし。

---

### Task 1: store.js — データモデル拡張

**Files:**
- Modify: `src/store.js`
- Test: `test/store.test.js`

**Interfaces:**
- Produces: `validate()` が `relationship / pinned / priorities` を検証する
- Produces: `emptyData()` が `priorities: null` を含む

- [ ] **Step 1: 失敗するテストを書く**

`test/store.test.js` 末尾に追加:

```javascript
// --- v2第2弾: relationship / pinned / priorities ---

test('family.relationship: 有効値は通る', () => {
  const { emptyData, validate } = LifeStore;
  const d = emptyData();
  d.family = [{ id: 'a1', name: '花子', birthDate: '2020-01-01', gender: 'female',
    customLifespan: null, meetFrequency: 'daily', relationship: 'child' }];
  assert.ok(validate(d).ok);
});

test('family.relationship: 不正値はエラー', () => {
  const { emptyData, validate } = LifeStore;
  const d = emptyData();
  d.family = [{ id: 'a1', name: '花子', birthDate: '2020-01-01', gender: 'female',
    customLifespan: null, meetFrequency: 'daily', relationship: 'alien' }];
  assert.ok(!validate(d).ok);
});

test('family.relationship: 省略時(旧データ)は通る', () => {
  const { emptyData, validate } = LifeStore;
  const d = emptyData();
  d.family = [{ id: 'a1', name: '花子', birthDate: '2020-01-01', gender: 'female',
    customLifespan: null, meetFrequency: 'daily' }];
  assert.ok(validate(d).ok);
});

test('wish.pinned: true/false は通る', () => {
  const { emptyData, validate } = LifeStore;
  const d = emptyData();
  d.wishes = [{ id: 'w1', title: '富士山', done: false, createdAt: '2026-01-01', doneAt: null, targetAge: null, pinned: true }];
  assert.ok(validate(d).ok);
});

test('wish.pinned: 不正値はエラー', () => {
  const { emptyData, validate } = LifeStore;
  const d = emptyData();
  d.wishes = [{ id: 'w1', title: '富士山', done: false, createdAt: '2026-01-01', doneAt: null, targetAge: null, pinned: 'yes' }];
  assert.ok(!validate(d).ok);
});

test('data.priorities: 正しい5項目は通る', () => {
  const { emptyData, validate } = LifeStore;
  const d = emptyData();
  d.priorities = ['自分', '家族', '仕事', '余暇', '睡眠'];
  assert.ok(validate(d).ok);
});

test('data.priorities: 不足・重複はエラー', () => {
  const { emptyData, validate } = LifeStore;
  const d = emptyData();
  d.priorities = ['家族', '仕事', '自分'];
  assert.ok(!validate(d).ok);
});

test('data.priorities: null は通る(省略扱い)', () => {
  const { emptyData, validate } = LifeStore;
  const d = emptyData();
  d.priorities = null;
  assert.ok(validate(d).ok);
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
node --test 2>&1 | grep -E "fail|✗"
```
期待: 8件失敗

- [ ] **Step 3: src/store.js を修正**

`FREQ_RE` の次の行に追加:
```javascript
const RELATIONSHIP_RE = /^(child|parent|spouse|sibling|friend|other)$/;
const PRIORITIES_REQUIRED = ['家族', '仕事', '自分', '余暇', '睡眠'];
```

`emptyData()` を修正:
```javascript
function emptyData() {
  return { version: 1, self: null, family: [], wishes: [], today: null, priorities: null };
}
```

`validate()` の家族ループ内、`meetFrequency` チェックの後に追加:
```javascript
if (f.relationship != null && !RELATIONSHIP_RE.test(f.relationship)) {
  return { ok: false, error: '家族の続柄が不正です' };
}
```

`validate()` のwishesループ内、`targetAge` チェックの後に追加:
```javascript
if (w.pinned != null && typeof w.pinned !== 'boolean') {
  return { ok: false, error: 'pinned がboolean ではありません' };
}
```

`today` チェックの前に追加:
```javascript
if (data.priorities != null) {
  if (!Array.isArray(data.priorities) || data.priorities.length !== PRIORITIES_REQUIRED.length
      || !PRIORITIES_REQUIRED.every((r) => data.priorities.includes(r))) {
    return { ok: false, error: 'priorities の内容が不正です' };
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
node --test 2>&1 | tail -5
```
期待: 75件以上 pass、fail 0

- [ ] **Step 5: コミット**

```bash
git add src/store.js test/store.test.js
git commit -m "feat(store): relationship/pinned/priorities フィールドをデータモデルに追加"
```

---

### Task 2: time-calc.js — childRemainingDays

**Files:**
- Modify: `src/time-calc.js`
- Test: `test/time-calc.test.js`

**Interfaces:**
- Produces: `TimeCalc.childRemainingDays(birthDate, targetAge, now)` → `{days: number, expired: boolean}`
  - `days`: マイルストーン到達までの残り日数(切り上げ)。expired 時は 0。
  - `expired`: マイルストーンを既に過ぎていれば true。

- [ ] **Step 1: 失敗するテストを書く**

`test/time-calc.test.js` 末尾に追加:

```javascript
// --- childRemainingDays ---
test('childRemainingDays: 未来のマイルストーンは正の日数を返す', () => {
  const birth = '2022-07-09'; // 4歳
  const now = new Date(2026, 6, 9); // 2026-07-09
  const r = TimeCalc.childRemainingDays(birth, 6, now);
  assert.strictEqual(r.expired, false);
  assert.ok(r.days > 0);
  // 6歳の誕生日 = 2028-07-09 まで約730日
  assert.ok(r.days > 700 && r.days < 800);
});

test('childRemainingDays: 過去のマイルストーンはexpired', () => {
  const birth = '2015-01-01'; // 11歳
  const now = new Date(2026, 6, 9);
  const r = TimeCalc.childRemainingDays(birth, 6, now);
  assert.strictEqual(r.expired, true);
  assert.strictEqual(r.days, 0);
});

test('childRemainingDays: マイルストーン当日はexpired', () => {
  const birth = '2020-07-09';
  const now = new Date(2026, 6, 9); // ちょうど6歳の誕生日
  const r = TimeCalc.childRemainingDays(birth, 6, now);
  assert.strictEqual(r.expired, true);
});
```

- [ ] **Step 2: 失敗を確認**

```bash
node --test 2>&1 | grep -E "fail|✗"
```
期待: 3件失敗

- [ ] **Step 3: src/time-calc.js に関数を追加**

`src/time-calc.js` の `return` 文の直前に追加:

```javascript
function childRemainingDays(birthDate, targetAge, now) {
  const birth = parseDate(birthDate);
  const milestone = new Date(birth);
  milestone.setFullYear(milestone.getFullYear() + targetAge);
  const ms = milestone - now;
  if (ms <= 0) return { days: 0, expired: true };
  return { days: Math.ceil(ms / (1000 * 60 * 60 * 24)), expired: false };
}
```

`return` 文に `childRemainingDays` を追加:
```javascript
return { MS_PER_YEAR, parseDate, breakdown, expectedDeathDate, progressPercent,
         freqPerYear, meetCount, remainingSeconds, countByRatePerMinute,
         occurrencesUntil, daysLived, dailyDeathProbability, awakeRemainingToday,
         childRemainingDays };
```

- [ ] **Step 4: テストが通ることを確認**

```bash
node --test 2>&1 | tail -5
```
期待: 78件以上 pass、fail 0

- [ ] **Step 5: コミット**

```bash
git add src/time-calc.js test/time-calc.test.js
git commit -m "feat(time-calc): childRemainingDays を追加(抱っこ/同居マイルストーン計算)"
```

---

### Task 3: 家族続柄UI

**Files:**
- Modify: `src/index.template.html`
- Modify: `src/app.js`
- Modify: `src/style.css`
- Test: `test/build.test.js`

**Interfaces:**
- Consumes: `TimeCalc.childRemainingDays` (Task 2)
- Consumes: `family.relationship` (Task 1)

- [ ] **Step 1: 失敗するテストを書く**

`test/build.test.js` の末尾に追加:

```javascript
test('家族ダイアログに続柄セレクトがある', () => {
  assert.ok(html.includes('id="fam-relation"'));
  assert.ok(html.includes('value="child"'));
});
```

- [ ] **Step 2: 失敗を確認**

```bash
node --test 2>&1 | grep -E "fail|✗"
```
期待: 1件失敗

- [ ] **Step 3: HTMLテンプレートに続柄セレクトを追加**

`src/index.template.html` の `<label>会う頻度` の前に挿入:

```html
        <label>続柄
          <select id="fam-relation">
            <option value="other">その他</option>
            <option value="child">子ども</option>
            <option value="parent">親</option>
            <option value="spouse">配偶者・パートナー</option>
            <option value="sibling">兄弟姉妹</option>
            <option value="friend">友人</option>
          </select>
        </label>
```

- [ ] **Step 4: app.js を修正**

`family-list` クリックハンドラ(編集ダイアログを開く箇所)に追加:
```javascript
$('fam-relation').value = f.relationship || 'other';
```

`family-form submit` の `rec` オブジェクトに追加:
```javascript
relationship: $('fam-relation').value,
```

`renderFamily()` の `li.innerHTML` を差し替え。子ども専用表示を追加:

```javascript
function renderFamily() {
  const list = $('family-list');
  list.textContent = '';
  $('family-empty').hidden = data.family.length > 0;
  const now = new Date();
  for (const f of data.family) {
    const death = deathDates.family.get(f.id);
    const b = TimeCalc.breakdown(now, death);
    const rel = f.relationship || 'other';
    const li = document.createElement('li');
    li.className = 'family-card';

    let meetsHtml = '';
    if (rel === 'child') {
      const hug = TimeCalc.childRemainingDays(f.birthDate, 6, now);
      const live = TimeCalc.childRemainingDays(f.birthDate, 18, now);
      if (!hug.expired) {
        meetsHtml += `<p class="child-days">抱っこできる残り <strong>${hug.days.toLocaleString()}日</strong></p>`;
      }
      if (!live.expired) {
        meetsHtml += `<p class="child-days">一緒に暮らせる残り <strong>${live.days.toLocaleString()}日</strong></p>`;
      }
      if (hug.expired && live.expired) {
        const meets = data.self && deathDates.self
          ? TimeCalc.meetCount(deathDates.self, death, f.meetFrequency, now) : null;
        meetsHtml = meets === null ? '<p class="family-meets">わたしの誕生日を設定すると回数が出ます</p>'
          : `<p class="family-meets">${FREQ_LABEL[f.meetFrequency] || '会うなら'} <strong class="meets-num">あと${meets}回</strong></p>`;
      }
    } else {
      const meets = data.self && deathDates.self
        ? TimeCalc.meetCount(deathDates.self, death, f.meetFrequency, now) : null;
      const meetsClass = (rel === 'parent' || rel === 'spouse') ? 'family-meets emphasis' : 'family-meets';
      meetsHtml = meets === null ? `<p class="${meetsClass}">わたしの誕生日を設定すると回数が出ます</p>`
        : `<p class="${meetsClass}">${FREQ_LABEL[f.meetFrequency] || '会うなら'} <strong class="meets-num">あと${meets}回</strong></p>`;
    }

    li.innerHTML = `<div class="family-head"><strong></strong><button class="ghost-btn" data-edit="${f.id}">編集</button></div>
      <p class="family-remain">残り ${b.expired ? '—' : `${b.years}年${b.months}ヶ月`}</p>
      ${meetsHtml}`;
    li.querySelector('strong').textContent = f.name;
    list.appendChild(li);
  }
}
```

- [ ] **Step 5: style.css に .child-days と .emphasis スタイルを追加**

`src/style.css` の `.family-meets` スタイルの後に追加:

```css
.child-days {
  font-size: 0.92rem;
  color: var(--text);
  margin: 0.2rem 0 0;
}
.child-days strong {
  color: var(--orange);
  font-size: 1.1em;
}
.family-meets.emphasis .meets-num {
  font-size: 1.4em;
}
```

- [ ] **Step 6: ビルドしてテストが通ることを確認**

```bash
node --test 2>&1 | tail -5
```
期待: 79件以上 pass、fail 0

- [ ] **Step 7: コミット**

```bash
git add src/index.template.html src/app.js src/style.css test/build.test.js
git commit -m "feat(family): 続柄フィールドを追加し、子ども向けに残り日数カードを表示"
```

---

### Task 4: 夢ピン留め + 今の夢表示

**Files:**
- Modify: `src/index.template.html`
- Modify: `src/app.js`
- Modify: `src/style.css`
- Test: `test/build.test.js`

**Interfaces:**
- Consumes: `wishes[].pinned` (Task 1)

- [ ] **Step 1: 失敗するテストを書く**

`test/build.test.js` の末尾に追加:

```javascript
test('今の夢バナー要素がある', () => {
  assert.ok(html.includes('id="dream-banner"'));
  assert.ok(html.includes('id="dream-title"'));
});
```

- [ ] **Step 2: 失敗を確認**

```bash
node --test 2>&1 | grep -E "fail|✗"
```

- [ ] **Step 3: HTMLテンプレートに「今の夢」セクションを追加**

`src/index.template.html` の `<p id="today-message"` の前に挿入:

```html
      <div id="dream-banner" class="dream-banner" hidden>
        <p class="dream-label">★ 今の夢</p>
        <p id="dream-title" class="dream-title"></p>
      </div>
```

やりたいこと画面の `<ul id="wish-list"></ul>` の前にある wish-form の後の部分で、`renderWishes()` が動的にボタンを差し込む(HTMLテンプレートへの追加は不要)。

- [ ] **Step 4: app.js の renderSelf() に今の夢表示を追加**

`renderSelf()` の `$('progress-text').textContent = ...` の後に追加:

```javascript
const pinned = data.wishes.find((w) => w.pinned && !w.done);
const banner = $('dream-banner');
banner.hidden = !pinned;
if (pinned) $('dream-title').textContent = pinned.title;
```

- [ ] **Step 5: app.js の renderWishes() に ★ ボタンを追加**

`renderWishes()` 内の active wish の `li.innerHTML` に ★ ボタンを追加:

```javascript
li.innerHTML = `<label><input type="checkbox" data-wish="${w.id}"> <span class="wish-title"></span></label>
  <span class="wish-remain">${wishRemainLabel(w)}</span>
  <button class="pin-btn${w.pinned ? ' pinned' : ''}" data-pin="${w.id}" aria-label="今の夢にする">${w.pinned ? '★' : '☆'}</button>
  <button class="ghost-btn" data-del-wish="${w.id}" aria-label="削除">×</button>`;
```

- [ ] **Step 6: app.js にピン留めクリックハンドラを追加**

`document.addEventListener('click', ...)` のうち `delWish` ハンドラの後に追加:

```javascript
document.addEventListener('click', (e) => {
  const id = e.target.dataset && e.target.dataset.pin;
  if (!id) return;
  const wasPin = !!(data.wishes.find((w) => w.id === id) || {}).pinned;
  data.wishes.forEach((w) => { w.pinned = false; });
  if (!wasPin) {
    const w = data.wishes.find((w) => w.id === id);
    if (w && !w.done) w.pinned = true;
  }
  persist();
});
```

- [ ] **Step 7: style.css にスタイルを追加**

```css
/* 今の夢バナー */
.dream-banner {
  background: linear-gradient(135deg, #fff8f2 0%, #fff3e8 100%);
  border: 2px solid var(--orange);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  margin: 0.75rem 0;
  text-align: center;
}
.dream-label {
  font-size: 0.75rem;
  color: var(--orange);
  font-weight: 700;
  letter-spacing: 0.05em;
  margin: 0 0 0.25rem;
}
.dream-title {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

/* ピン留めボタン */
.pin-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  color: #ccc;
  padding: 0 0.25rem;
  line-height: 1;
}
.pin-btn.pinned { color: var(--orange); }
```

- [ ] **Step 8: ビルドしてテストが通ることを確認**

```bash
node --test 2>&1 | tail -5
```
期待: 80件以上 pass、fail 0

- [ ] **Step 9: コミット**

```bash
git add src/index.template.html src/app.js src/style.css test/build.test.js
git commit -m "feat(wishes): ★ピン留めボタンと「今の夢」バナーを追加"
```

---

### Task 5: 優先順位UI

**Files:**
- Modify: `src/index.template.html`
- Modify: `src/app.js`
- Modify: `src/style.css`
- Test: `test/build.test.js`

**Interfaces:**
- Consumes: `data.priorities` (Task 1)

- [ ] **Step 1: 失敗するテストを書く**

`test/build.test.js` の末尾に追加:

```javascript
test('優先順位リスト要素がある', () => {
  assert.ok(html.includes('id="priority-list"'));
});
```

- [ ] **Step 2: 失敗を確認**

```bash
node --test 2>&1 | grep -E "fail|✗"
```

- [ ] **Step 3: HTMLテンプレートに優先順位セクションを追加**

`src/index.template.html` の `<button id="open-settings"` の前に挿入:

```html
      <section id="priority-section" hidden>
        <h3 class="priority-heading">時間の優先順位</h3>
        <p class="priority-note">↑↓で並べ替えてみよう</p>
        <ol id="priority-list" class="priority-list"></ol>
      </section>
```

- [ ] **Step 4: app.js に renderPriorities() と ↑↓ハンドラを追加**

`renderSelf()` の直後に追加:

```javascript
const DEFAULT_PRIORITIES = ['家族', '仕事', '自分', '余暇', '睡眠'];

function renderPriorities() {
  const section = $('priority-section');
  if (!data.self) { section.hidden = true; return; }
  section.hidden = false;
  const items = data.priorities || DEFAULT_PRIORITIES;
  const list = $('priority-list');
  list.textContent = '';
  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'priority-item';
    li.innerHTML = `<span class="priority-label"></span>
      <button class="ghost-btn pri-btn" data-pri-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="上へ">↑</button>
      <button class="ghost-btn pri-btn" data-pri-down="${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="下へ">↓</button>`;
    li.querySelector('.priority-label').textContent = item;
    list.appendChild(li);
  });
}
```

`document.addEventListener('click', ...)` の先頭付近に追加:

```javascript
document.addEventListener('click', (e) => {
  const upIdx = e.target.dataset && e.target.dataset.priUp;
  const downIdx = e.target.dataset && e.target.dataset.priDown;
  if (upIdx == null && downIdx == null) return;
  const idx = upIdx != null ? Number(upIdx) : Number(downIdx);
  const items = [...(data.priorities || DEFAULT_PRIORITIES)];
  const swapWith = upIdx != null ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= items.length) return;
  [items[idx], items[swapWith]] = [items[swapWith], items[idx]];
  data.priorities = items;
  persist();
});
```

`render()` に `renderPriorities()` を追加:
```javascript
function render() {
  renderSelf();
  renderPriorities();
  renderToday();
  renderInsight();
  renderFamily();
  renderWishes();
}
```

- [ ] **Step 5: style.css にスタイルを追加**

```css
/* 優先順位 */
#priority-section {
  margin: 1rem 0 0.5rem;
}
.priority-heading {
  font-size: 0.9rem;
  color: var(--text-muted, #888);
  margin: 0 0 0.1rem;
}
.priority-note {
  font-size: 0.75rem;
  color: #bbb;
  margin: 0 0 0.5rem;
}
.priority-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.priority-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid #f0ece6;
}
.priority-item:last-child { border-bottom: none; }
.priority-label {
  flex: 1;
  font-size: 0.95rem;
}
.pri-btn {
  font-size: 0.85rem;
  padding: 0.15rem 0.4rem;
  min-width: 1.8rem;
}
.pri-btn:disabled { opacity: 0.25; cursor: default; }
```

- [ ] **Step 6: ビルドしてテストが通ることを確認**

```bash
node --test 2>&1 | tail -5
```
期待: 81件以上 pass、fail 0

- [ ] **Step 7: コミット**

```bash
git add src/index.template.html src/app.js src/style.css test/build.test.js
git commit -m "feat(self): 時間の優先順位リストを追加(↑↓で並べ替え)"
```

---

### Task 6: Life in Weeks格子

**Files:**
- Modify: `src/index.template.html`
- Modify: `src/app.js`
- Modify: `src/style.css`
- Test: `test/build.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/build.test.js` の末尾に追加:

```javascript
test('Life in Weeks グリッド要素がある', () => {
  assert.ok(html.includes('id="weeks-grid-section"'));
  assert.ok(html.includes('id="weeks-grid"'));
});
```

- [ ] **Step 2: 失敗を確認**

```bash
node --test 2>&1 | grep -E "fail|✗"
```

- [ ] **Step 3: HTMLテンプレートに weeks-grid セクションを追加**

`src/index.template.html` の `<p class="insight-note">` の後に挿入:

```html
    <section id="weeks-grid-section" hidden>
      <h2 class="weeks-title">人生の週カレンダー</h2>
      <p class="weeks-note">生まれてから経過した週はオレンジで塗られています。左上が0歳の第1週、右へ1週ずつ進み、52週で折り返して次の年へ。</p>
      <div id="weeks-grid" class="weeks-grid" aria-hidden="true"></div>
    </section>
```

- [ ] **Step 4: app.js に renderWeeks() を追加**

`renderInsight()` の直後に追加:

```javascript
function renderWeeks() {
  const section = $('weeks-grid-section');
  if (!data.self) { section.hidden = true; return; }
  section.hidden = false;
  const grid = $('weeks-grid');
  const TOTAL = 90 * 52; // 4680

  if (grid.childElementCount !== TOTAL) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < TOTAL; i++) {
      const cell = document.createElement('span');
      frag.appendChild(cell);
    }
    grid.appendChild(frag);
  }

  const birth = TimeCalc.parseDate(data.self.birthDate);
  const now = new Date();
  const weeksLived = Math.floor((now - birth) / (7 * 24 * 60 * 60 * 1000));
  const cells = grid.children;
  for (let i = 0; i < cells.length; i++) {
    if (i < weeksLived) cells[i].className = 'wc p';
    else if (i === weeksLived) cells[i].className = 'wc c';
    else cells[i].className = 'wc f';
  }
}
```

`tick()` に weeks の更新を追加:
```javascript
function tick() {
  if (!data || !data.self) return;
  if ($('screen-self').classList.contains('active')) { renderSelf(); renderPriorities(); renderToday(); }
  if ($('screen-insight').classList.contains('active')) { renderInsight(); renderWeeks(); }
}
```

`render()` に `renderWeeks()` を追加:
```javascript
function render() {
  renderSelf();
  renderPriorities();
  renderToday();
  renderInsight();
  renderWeeks();
  renderFamily();
  renderWishes();
}
```

- [ ] **Step 5: style.css に weeks-grid スタイルを追加**

```css
/* Life in Weeks */
#weeks-grid-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #f0ece6;
}
.weeks-title {
  font-size: 1rem;
  margin: 0 0 0.4rem;
}
.weeks-note {
  font-size: 0.75rem;
  color: #aaa;
  margin: 0 0 1rem;
  line-height: 1.5;
}
.weeks-grid {
  display: grid;
  grid-template-columns: repeat(52, 5px);
  gap: 1px;
  width: fit-content;
  max-width: 100%;
  overflow-x: auto;
}
.weeks-grid .wc {
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 1px;
}
.weeks-grid .wc.p {
  background: var(--orange);
}
.weeks-grid .wc.c {
  background: var(--orange);
  box-shadow: 0 0 3px var(--orange);
  outline: 2px solid #c05510;
  outline-offset: 0;
}
.weeks-grid .wc.f {
  background: transparent;
  border: 1px solid #e0d0c0;
}
```

- [ ] **Step 6: ビルドしてテストが全て通ることを確認**

```bash
node --test 2>&1 | tail -5
```
期待: 83件以上 pass、fail 0

- [ ] **Step 7: コミット**

```bash
git add src/index.template.html src/app.js src/style.css test/build.test.js
git commit -m "feat(insight): Life in Weeks 格子グリッドを見つめるタブに追加"
```
