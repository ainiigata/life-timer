const { test } = require('node:test');
const assert = require('node:assert');
const Gacha = require('../src/gacha.js');

test('チャレンジ総数が70件以上ある', () => {
  assert.ok(Gacha.CHALLENGES.length >= 70);
});

test('各チャレンジはid/rarity/textを持つ', () => {
  for (const c of Gacha.CHALLENGES) {
    assert.ok(typeof c.id === 'string' && c.id.length > 0, `id: ${c.id}`);
    assert.ok(['N', 'R', 'SR', 'SSR'].includes(c.rarity), `rarity: ${c.rarity}`);
    assert.ok(typeof c.text === 'string' && c.text.length > 0, `text: ${c.text}`);
  }
});

test('レア度ごとの件数: N≥30, R≥20, SR≥15, SSR≥5', () => {
  const counts = { N: 0, R: 0, SR: 0, SSR: 0 };
  for (const c of Gacha.CHALLENGES) counts[c.rarity]++;
  assert.ok(counts.N >= 30, `N: ${counts.N}`);
  assert.ok(counts.R >= 20, `R: ${counts.R}`);
  assert.ok(counts.SR >= 15, `SR: ${counts.SR}`);
  assert.ok(counts.SSR >= 5, `SSR: ${counts.SSR}`);
});

test('IDに重複がない', () => {
  const ids = Gacha.CHALLENGES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('pull()はCHALLENGESにあるレア度とid・textを返す', () => {
  for (let i = 0; i < 20; i++) {
    const result = Gacha.pull();
    assert.ok(['N', 'R', 'SR', 'SSR'].includes(result.rarity));
    assert.ok(typeof result.xp === 'number' && result.xp > 0);
    const found = Gacha.CHALLENGES.find((c) => c.id === result.id);
    assert.ok(found, `id ${result.id} が CHALLENGES に見つからない`);
    assert.equal(found.rarity, result.rarity);
  }
});

test('pull()のXPはレア度に対応している', () => {
  const xpMap = { N: 1, R: 3, SR: 10, SSR: 30 };
  for (let i = 0; i < 20; i++) {
    const result = Gacha.pull();
    assert.equal(result.xp, xpMap[result.rarity], `rarity ${result.rarity} のXPが不正`);
  }
});

test('levelFromXp: 0XPはLv1', () => {
  const r = Gacha.levelFromXp(0);
  assert.equal(r.level, 1);
  assert.equal(r.xpInLevel, 0);
  assert.equal(r.xpNeeded, 10);
});

test('levelFromXp: 10XPでLv2', () => {
  const r = Gacha.levelFromXp(10);
  assert.equal(r.level, 2);
  assert.equal(r.xpInLevel, 0);
  assert.equal(r.xpNeeded, 20);
});

test('levelFromXp: 9XPはまだLv1', () => {
  const r = Gacha.levelFromXp(9);
  assert.equal(r.level, 1);
  assert.equal(r.xpInLevel, 9);
});

test('levelFromXp: 30XP(10+20)でLv3', () => {
  const r = Gacha.levelFromXp(30);
  assert.equal(r.level, 3);
  assert.equal(r.xpInLevel, 0);
  assert.equal(r.xpNeeded, 30);
});

test('levelFromXp: xpInLevel は次のレベルまでの位置を正しく示す', () => {
  const r = Gacha.levelFromXp(15); // Lv2(10-29): xpInLevel=5
  assert.equal(r.level, 2);
  assert.equal(r.xpInLevel, 5);
  assert.equal(r.xpNeeded, 20);
});
