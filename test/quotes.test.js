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
