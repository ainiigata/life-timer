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
