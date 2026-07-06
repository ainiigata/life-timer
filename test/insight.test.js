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
  assert.deepEqual(ids, ['seconds', 'breaths', 'heartbeats', 'breakdown', 'counts', 'death-prob', 'parent-days', 'today-remaining']);
  for (const c of cards) {
    assert.ok(c.label && c.value !== undefined && c.sub !== undefined);
  }
});

test('build: 残り秒カードは秒を反映', () => {
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

test('build: 親に育ててもらった日数は日で表す', () => {
  const cards = Insight.build(self, death, now);
  const pd = cards.find((c) => c.id === 'parent-days');
  assert.match(pd.value, /日/);
});
