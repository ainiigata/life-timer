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

test('validate: family[].id が数値 → ok:false', () => {
  const bad = JSON.parse(JSON.stringify(VALID));
  bad.family[0].id = 12345;
  assert.equal(LifeStore.validate(bad).ok, false);
  assert.match(LifeStore.validate(bad).error, /家族のID/);
});

test('validate: wishes[].id が欠落 → ok:false', () => {
  const bad = JSON.parse(JSON.stringify(VALID));
  delete bad.wishes[0].id;
  assert.equal(LifeStore.validate(bad).ok, false);
  assert.match(LifeStore.validate(bad).error, /やりたいことのID/);
});

test('validate: wishes[].createdAt が数値 → ok:false', () => {
  const bad = JSON.parse(JSON.stringify(VALID));
  bad.wishes[0].createdAt = 1234567890;
  assert.equal(LifeStore.validate(bad).ok, false);
  assert.match(LifeStore.validate(bad).error, /createdAt/);
});

test('validate: wishes[].doneAt が数値 → ok:false', () => {
  const bad = JSON.parse(JSON.stringify(VALID));
  bad.wishes[0].doneAt = 1234567890;
  assert.equal(LifeStore.validate(bad).ok, false);
  assert.match(LifeStore.validate(bad).error, /doneAt/);
});

test('validate: wishes[].doneAt が null または文字列 → ok:true', () => {
  const ok1 = JSON.parse(JSON.stringify(VALID));
  ok1.wishes[0].doneAt = null;
  assert.equal(LifeStore.validate(ok1).ok, true);

  const ok2 = JSON.parse(JSON.stringify(VALID));
  ok2.wishes[0].doneAt = '2026-07-04';
  assert.equal(LifeStore.validate(ok2).ok, true);
});

test('isValidDateStr: "2026-02-30" (存在しない日付) → false', () => {
  assert.equal(LifeStore.isValidDateStr('2026-02-30'), false);
});

test('isValidDateStr: "2026-02-28" (有効な日付) → true', () => {
  assert.equal(LifeStore.isValidDateStr('2026-02-28'), true);
});

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

// --- v3: streak / reflections / advanceStreak ---

test('streak: 正しい形は通る', () => {
  const d = LifeStore.emptyData();
  d.streak = { last: '2026-07-09', run: 7, total: 23 };
  assert.ok(LifeStore.validate(d).ok);
});

test('streak: run > total はエラー', () => {
  const d = LifeStore.emptyData();
  d.streak = { last: '2026-07-09', run: 24, total: 23 };
  assert.ok(!LifeStore.validate(d).ok);
});

test('streak: 日付形式が壊れているとエラー', () => {
  const d = LifeStore.emptyData();
  d.streak = { last: 'いつか', run: 1, total: 1 };
  assert.ok(!LifeStore.validate(d).ok);
});

test('streak: null は通る(旧データ互換)', () => {
  const d = LifeStore.emptyData();
  d.streak = null;
  assert.ok(LifeStore.validate(d).ok);
});

test('reflections: 正しい配列は通る', () => {
  const d = LifeStore.emptyData();
  d.reflections = [{ date: '2026-07-09', q: 12, text: '母さんに電話する' }];
  assert.ok(LifeStore.validate(d).ok);
});

test('reflections: text空・q負数はエラー', () => {
  const d = LifeStore.emptyData();
  d.reflections = [{ date: '2026-07-09', q: 12, text: '' }];
  assert.ok(!LifeStore.validate(d).ok);
  d.reflections = [{ date: '2026-07-09', q: -1, text: 'a' }];
  assert.ok(!LifeStore.validate(d).ok);
});

test('reflections: 未定義(旧データ)は通る', () => {
  const d = JSON.parse(JSON.stringify(VALID)); // v1形式(reflectionsなし)
  assert.ok(LifeStore.validate(d).ok);
});

test('advanceStreak: 初回は run=1 total=1', () => {
  const s = LifeStore.advanceStreak(null, '2026-07-09');
  assert.deepEqual(s, { last: '2026-07-09', run: 1, total: 1 });
});

test('advanceStreak: 同日2回目は変化なし(同一オブジェクト)', () => {
  const s0 = { last: '2026-07-09', run: 3, total: 10 };
  const s1 = LifeStore.advanceStreak(s0, '2026-07-09');
  assert.strictEqual(s1, s0);
});

test('advanceStreak: 昨日開いていたら run+1 total+1', () => {
  const s = LifeStore.advanceStreak({ last: '2026-07-08', run: 3, total: 10 }, '2026-07-09');
  assert.deepEqual(s, { last: '2026-07-09', run: 4, total: 11 });
});

test('advanceStreak: 途切れたら run=1 だが total は増える(やさしいリセット)', () => {
  const s = LifeStore.advanceStreak({ last: '2026-07-01', run: 30, total: 100 }, '2026-07-09');
  assert.deepEqual(s, { last: '2026-07-09', run: 1, total: 101 });
});

test('advanceStreak: 月またぎの連続を正しく判定', () => {
  const s = LifeStore.advanceStreak({ last: '2026-06-30', run: 5, total: 5 }, '2026-07-01');
  assert.deepEqual(s, { last: '2026-07-01', run: 6, total: 6 });
});

// ── gacha バリデーション ──
const validGacha = () => ({
  date: '2026-07-10',
  totalXp: 15,
  current: { id: 'n01', rarity: 'N', text: '水を飲む', xp: 1, done: false },
  history: [{ date: '2026-07-09', rarity: 'R', text: '読書する', xp: 3 }],
});

test('gacha: 正しい構造は通る', () => {
  const d = { ...LifeStore.emptyData(), gacha: validGacha() };
  assert.equal(LifeStore.validate(d).ok, true);
});

test('gacha: null は通る(旧データ互換)', () => {
  const d = { ...LifeStore.emptyData(), gacha: null };
  assert.equal(LifeStore.validate(d).ok, true);
});

test('gacha: date が不正ならエラー', () => {
  const d = { ...LifeStore.emptyData(), gacha: { ...validGacha(), date: 'invalid' } };
  assert.equal(LifeStore.validate(d).ok, false);
});

test('gacha: totalXp が負数ならエラー', () => {
  const d = { ...LifeStore.emptyData(), gacha: { ...validGacha(), totalXp: -1 } };
  assert.equal(LifeStore.validate(d).ok, false);
});

test('gacha: current.rarity が不正ならエラー', () => {
  const d = { ...LifeStore.emptyData(), gacha: { ...validGacha(), current: { ...validGacha().current, rarity: 'UR' } } };
  assert.equal(LifeStore.validate(d).ok, false);
});

test('gacha: history[].date が不正ならエラー', () => {
  const d = { ...LifeStore.emptyData(), gacha: { ...validGacha(), history: [{ date: 'bad', rarity: 'N', text: 'x', xp: 1 }] } };
  assert.equal(LifeStore.validate(d).ok, false);
});
