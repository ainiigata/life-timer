const { test } = require('node:test');
const assert = require('node:assert');
const LifeStore = require('../src/store.js');
const Records = require('../src/records.js');

// きろくが一通り入ったサンプルデータ
function sampleData() {
  const d = LifeStore.emptyData();
  d.self = { name: '', birthDate: '1986-07-04', gender: 'male', customLifespan: 100 };
  d.priorities = ['家族', '自分', '仕事', '余暇', '睡眠'];
  d.wishes = [
    { id: 'w1', title: '家族で沖縄に行く', targetAge: 45, done: false, createdAt: '2026-07-01', doneAt: null, pinned: true },
    { id: 'w2', title: '富士山に登る', targetAge: null, done: true, createdAt: '2026-06-01', doneAt: '2026-07-10' },
  ];
  d.notes = [
    { id: 'n2', date: '2026-07-13', time: '12:30', type: 'todo', text: '図書館に本を返す' },
    { id: 'n1', date: '2026-07-13', time: '09:12', type: 'idea', text: '朝の散歩コースを変える' },
    { id: 'n3', date: '2026-07-10', time: '21:00', type: 'memo', text: '今日はよく笑った' },
  ];
  d.reflections = [{ date: '2026-07-13', q: 2, text: '母に電話する' }];
  d.declarations = [{ date: '2026-07-12', text: '履歴書を書く', done: true }];
  d.today = { date: '2026-07-13', text: '部屋を片付ける', done: false };
  d.gacha = {
    date: '2026-07-13', totalXp: 4, current: null,
    history: [{ date: '2026-07-13', rarity: 'R', text: '10分散歩する', xp: 3 }],
  };
  return d;
}

// --- monthMatrix ---

test('monthMatrix: 2026年7月は水曜はじまり・31日・5週', () => {
  const m = Records.monthMatrix(2026, 7);
  assert.equal(m.length, 5);
  for (const week of m) assert.equal(week.length, 7);
  assert.deepEqual(m[0], [null, null, null, '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04']);
  assert.equal(m[4][5], '2026-07-31');
  assert.equal(m[4][6], null);
});

test('monthMatrix: うるう年2024年2月は29日まで', () => {
  const m = Records.monthMatrix(2024, 2);
  const days = m.flat().filter(Boolean);
  assert.equal(days.length, 29);
  assert.equal(days[0], '2024-02-01');
  assert.equal(days[28], '2024-02-29');
});

test('monthMatrix: 平年2026年2月は28日まで', () => {
  const days = Records.monthMatrix(2026, 2).flat().filter(Boolean);
  assert.equal(days.length, 28);
  assert.equal(days[27], '2026-02-28');
});

// --- dayEntries ---

test('dayEntries: メモ(時刻順)→問い→宣言→お題→叶えた夢 の順に統合される', () => {
  const entries = Records.dayEntries(sampleData(), '2026-07-13');
  assert.deepEqual(entries.map((e) => e.kind), ['note', 'note', 'reflection', 'declaration', 'gacha']);
  assert.equal(entries[0].time, '09:12'); // 時刻昇順
  assert.equal(entries[0].type, 'idea');
  assert.equal(entries[1].time, '12:30');
  assert.equal(entries[2].text, '母に電話する');
  assert.equal(entries[2].q, 2);
  assert.equal(entries[3].text, '部屋を片付ける'); // 当日のdata.todayも宣言として出る
  assert.equal(entries[3].done, false);
  assert.equal(entries[4].rarity, 'R');
});

test('dayEntries: アーカイブ済み宣言と叶えた夢が出る', () => {
  const d = sampleData();
  assert.deepEqual(Records.dayEntries(d, '2026-07-12').map((e) => e.kind), ['declaration']);
  const e10 = Records.dayEntries(d, '2026-07-10');
  assert.deepEqual(e10.map((e) => e.kind), ['note', 'wish-done']);
  assert.equal(e10[1].title, '富士山に登る');
});

test('dayEntries: 記録のない日は空配列、旧データ(notes等なし)でも落ちない', () => {
  assert.deepEqual(Records.dayEntries(sampleData(), '2026-01-01'), []);
  const old = { version: 1, self: null, family: [], wishes: [] }; // v1初期形式
  assert.deepEqual(Records.dayEntries(old, '2026-07-13'), []);
});

// --- datesWithEntries ---

test('datesWithEntries: その月の記録がある日付のSetを返す', () => {
  const s = Records.datesWithEntries(sampleData(), 2026, 7);
  assert.ok(s.has('2026-07-13'));
  assert.ok(s.has('2026-07-12'));
  assert.ok(s.has('2026-07-10'));
  assert.ok(!s.has('2026-07-11'));
  assert.equal(Records.datesWithEntries(sampleData(), 2026, 6).size, 0);
});

// --- exportMarkdown ---

const QUESTIONS = ['問い0', '問い1', '今日、誰を喜ばせたい?'];

test('exportMarkdown: プロフィール・優先順位・やりたいことを含む', () => {
  const md = Records.exportMarkdown(sampleData(), QUESTIONS, new Date('2026-07-13T15:00:00'));
  assert.ok(md.includes('# 人生タイマー きろく(2026-07-13 書き出し)'));
  assert.ok(md.includes('1986-07-04'));
  assert.ok(md.includes('家族 > 自分 > 仕事 > 余暇 > 睡眠'));
  assert.ok(md.includes('- [ ] 家族で沖縄に行く(45歳までに)★今の夢'));
  assert.ok(md.includes('- [x] 富士山に登る(2026-07-10 達成)'));
});

test('exportMarkdown: 日々のきろくが日付昇順・曜日付き・種類ラベル付きで出る', () => {
  const md = Records.exportMarkdown(sampleData(), QUESTIONS, new Date('2026-07-13T15:00:00'));
  const i10 = md.indexOf('### 2026-07-10(金)');
  const i12 = md.indexOf('### 2026-07-12(日)');
  const i13 = md.indexOf('### 2026-07-13(月)');
  assert.ok(i10 > -1 && i12 > i10 && i13 > i12);
  assert.ok(md.includes('- 09:12【アイデア】朝の散歩コースを変える'));
  assert.ok(md.includes('- 12:30【やること】図書館に本を返す'));
  assert.ok(md.includes('【問いの答え】Q: 今日、誰を喜ばせたい? →「母に電話する」'));
  assert.ok(md.includes('【今日の宣言】履歴書を書く ✅'));
  assert.ok(md.includes('【お題クリア】(R) 10分散歩する'));
  assert.ok(md.includes('【叶えた夢】富士山に登る'));
});

test('exportMarkdown: 空データでも落ちずヘッダを出す', () => {
  const md = Records.exportMarkdown(LifeStore.emptyData(), QUESTIONS, new Date('2026-07-13T15:00:00'));
  assert.ok(md.includes('# 人生タイマー きろく(2026-07-13 書き出し)'));
  assert.ok(md.includes('まだ記録がありません'));
});

test('TYPE_LABEL: 3種類のラベルを提供する', () => {
  assert.deepEqual(Records.TYPE_LABEL, { idea: 'アイデア', todo: 'やること', memo: 'メモ' });
});
