const { test } = require('node:test');
const assert = require('node:assert');
const LifeTable = require('../src/life-table.js');

test('0歳の平均余命は平均寿命に一致する', () => {
  assert.equal(LifeTable.remainingYears('male', 0), 81.09);
  assert.equal(LifeTable.remainingYears('female', 0), 87.14);
});

test('テーブル掲載年齢はそのままの値を返す', () => {
  assert.equal(LifeTable.remainingYears('male', 40), 42.06);
  assert.equal(LifeTable.remainingYears('female', 65), 24.38);
});

test('中間年齢は線形補間される', () => {
  const v = LifeTable.remainingYears('male', 42.5); // 40(42.06)と45(37.28)の中間
  assert.ok(Math.abs(v - (42.06 + 37.28) / 2) < 1e-9);
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
