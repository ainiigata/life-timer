const { test } = require('node:test');
const assert = require('node:assert');
const TimeCalc = require('../src/time-calc.js');

test('breakdown: ちょうど1年1ヶ月1日1時間1分1秒', () => {
  const from = new Date(2026, 0, 1, 0, 0, 0);
  const to = new Date(2027, 1, 2, 1, 1, 1);
  const b = TimeCalc.breakdown(from, to);
  assert.deepEqual(
    { y: b.years, mo: b.months, d: b.days, h: b.hours, mi: b.minutes, s: b.seconds },
    { y: 1, mo: 1, d: 1, h: 1, mi: 1, s: 1 }
  );
  assert.equal(b.expired, false);
});

test('breakdown: うるう年をまたいでも月計算が壊れない(1/31起点)', () => {
  const from = new Date(2024, 0, 31); // 2024はうるう年
  const to = new Date(2024, 2, 1);    // 3/1
  const b = TimeCalc.breakdown(from, to);
  // 1/31 +1ヶ月 = 2/29(月末クランプ)、残り1日
  assert.equal(b.months, 1);
  assert.equal(b.days, 1);
});

test('breakdown: 期限切れはexpired=trueで全ゼロ', () => {
  const b = TimeCalc.breakdown(new Date(2026, 0, 2), new Date(2026, 0, 1));
  assert.equal(b.expired, true);
  assert.equal(b.years + b.months + b.days + b.hours + b.minutes + b.seconds, 0);
});

test('expectedDeathDate: customLifespan優先', () => {
  const now = new Date(2026, 6, 4);
  const d = TimeCalc.expectedDeathDate(
    { birthDate: '1986-07-04', gender: 'male', customLifespan: 100 }, now);
  // 誕生から100年後(±1日以内)
  const expect = TimeCalc.parseDate('1986-07-04').getTime() + 100 * TimeCalc.MS_PER_YEAR;
  assert.ok(Math.abs(d.getTime() - expect) < 86400000);
});

test('expectedDeathDate: customLifespan=0 は 0 を有効値として使用(null/undefined と区別)', () => {
  const now = new Date(2026, 6, 4);
  const d = TimeCalc.expectedDeathDate(
    { birthDate: '2026-07-04', gender: 'male', customLifespan: 0 }, now);
  // 誕生から0年後(誕生日当日、±1日以内)
  const birth = TimeCalc.parseDate('2026-07-04').getTime();
  const diff = Math.abs(d.getTime() - birth);
  assert.ok(diff < 86400000, `death should be ~= birth (diff: ${diff}ms)`);
});

test('expectedDeathDate: 余命テーブル使用時は now+余命', () => {
  const now = new Date(2026, 6, 4);
  const d = TimeCalc.expectedDeathDate({ birthDate: '1986-07-04', gender: 'male' }, now);
  // 40歳男性の余命42.06年 → 死亡推定は now + 42.06年(補間誤差込み±0.2年)
  const years = (d.getTime() - now.getTime()) / TimeCalc.MS_PER_YEAR;
  assert.ok(Math.abs(years - 42.06) < 0.2, `got ${years}`);
});

test('progressPercent: 誕生日当日は0、死亡推定日は100', () => {
  const death = new Date(2066, 6, 4);
  assert.equal(TimeCalc.progressPercent('2026-07-04', death, TimeCalc.parseDate('2026-07-04')), 0);
  assert.equal(TimeCalc.progressPercent('2026-07-04', death, death), 100);
});

test('freqPerYear: 全頻度', () => {
  assert.equal(TimeCalc.freqPerYear('daily'), 365);
  assert.equal(TimeCalc.freqPerYear('weekly'), 52);
  assert.equal(TimeCalc.freqPerYear('monthly'), 12);
  assert.equal(TimeCalc.freqPerYear('yearly-2'), 2);
  assert.throws(() => TimeCalc.freqPerYear('sometimes'));
});

test('freqPerYear: yearly-0 は error、yearly-1 は有効', () => {
  assert.throws(() => TimeCalc.freqPerYear('yearly-0'));
  assert.equal(TimeCalc.freqPerYear('yearly-1'), 1);
});

test('meetCount: 先に尽きる側が上限になる', () => {
  const now = new Date(2026, 0, 1);
  const selfDeath = new Date(2066, 0, 1);   // 40年後
  const familyDeath = new Date(2036, 0, 1); // 10年後(こちらが先)
  const n = TimeCalc.meetCount(selfDeath, familyDeath, 'monthly', now);
  assert.ok(n >= 118 && n <= 120, `got ${n}`); // 約10年×12回
});

test('meetCount: 残りゼロ以下は0回', () => {
  const now = new Date(2026, 0, 1);
  assert.equal(TimeCalc.meetCount(new Date(2025, 0, 1), new Date(2066, 0, 1), 'daily', now), 0);
});
