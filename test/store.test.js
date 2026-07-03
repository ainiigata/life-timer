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
