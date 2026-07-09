const { test } = require('node:test');
const assert = require('node:assert');
const Questions = require('../src/questions.js');

test('LIST は50問ある', () => {
  assert.ok(Array.isArray(Questions.LIST));
  assert.equal(Questions.LIST.length, 50);
});

test('各問いは非空の文字列', () => {
  for (const q of Questions.LIST) {
    assert.ok(typeof q === 'string' && q.length > 0);
  }
});

test('重複がない', () => {
  assert.equal(new Set(Questions.LIST).size, Questions.LIST.length);
});

test('indexFor: 基準日からの経過日数で決定論的に巡回する', () => {
  assert.equal(Questions.indexFor('2026-01-01'), 0);
  assert.equal(Questions.indexFor('2026-01-02'), 1);
  // 50日後に同じ問いへ戻る
  assert.equal(Questions.indexFor('2026-02-20'), 0);
  // 同じ日は何度呼んでも同じ
  assert.equal(Questions.indexFor('2026-07-09'), Questions.indexFor('2026-07-09'));
});

test('indexFor: 基準日より前の日付でも 0〜49 に収まる', () => {
  const i = Questions.indexFor('2025-12-25');
  assert.ok(Number.isInteger(i) && i >= 0 && i < 50);
});
