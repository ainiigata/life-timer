/* 人生タイマー 見つめるカードのビューモデル — DOM非依存の純粋関数 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./life-table.js'), require('./time-calc.js'));
  else root.Insight = factory(root.LifeTable, root.TimeCalc);
})(typeof self !== 'undefined' ? self : this, function (LifeTable, TimeCalc) {
  'use strict';

  const LOTTERY_ODDS = 20000000; // 宝くじ1等 約2000万分の1(注記付きの目安)
  const BREATHS_PER_MIN = 16;
  const HEARTBEATS_PER_MIN = 70;
  const SLEEP_FRACTION = 8 / 24;
  const BED_HOUR = 23;
  const MOON_PER_YEAR = 12.37;
  const SEC_PER_YEAR = TimeCalc.MS_PER_YEAR / 1000;

  // 大きい整数を「1億2340万」形式に(万・億・兆)。1万未満はカンマ区切り
  function formatOku(n) {
    n = Math.floor(n);
    if (n < 10000) return n.toLocaleString('en-US');
    const units = [[1e12, '兆'], [1e8, '億'], [1e4, '万']];
    let rest = n, out = '';
    for (const [base, label] of units) {
      if (rest >= base) {
        out += Math.floor(rest / base) + label;
        rest = rest % base;
      }
    }
    return out;
  }

  function ageAt(person, now) {
    return (now.getTime() - TimeCalc.parseDate(person.birthDate).getTime()) / TimeCalc.MS_PER_YEAR;
  }

  function build(person, deathDate, now) {
    const sec = TimeCalc.remainingSeconds(now, deathDate);
    const years = sec / SEC_PER_YEAR;

    // 明日死ぬ確率
    const qx = LifeTable.annualMortality(person.gender, ageAt(person, now));
    const pDay = TimeCalc.dailyDeathProbability(qx);
    const timesVsLottery = pDay > 0 ? Math.round(LOTTERY_ODDS * pDay) : 0;
    const surviveP = ((1 - pDay) * 100).toFixed(4);

    const yearlyCount = TimeCalc.occurrencesUntil(now, deathDate, 1);
    const moonCount = TimeCalc.occurrencesUntil(now, deathDate, MOON_PER_YEAR);
    const awake = TimeCalc.awakeRemainingToday(now, BED_HOUR);
    const awakeValue = (awake.hours === 0 && awake.minutes === 0)
      ? 'そろそろ休みましょう'
      : `あと ${awake.hours}時間${awake.minutes}分`;

    return [
      { id: 'seconds', label: '残り時間を秒で数えると', value: `約 ${formatOku(sec)} 秒`, sub: '1秒、また1秒と減っていきます' },
      { id: 'breaths', label: 'これからする呼吸', value: `約 ${formatOku(TimeCalc.countByRatePerMinute(sec, BREATHS_PER_MIN))} 回`, sub: `1分に約${BREATHS_PER_MIN}回として` },
      { id: 'heartbeats', label: 'これから打つ鼓動', value: `約 ${formatOku(TimeCalc.countByRatePerMinute(sec, HEARTBEATS_PER_MIN))} 回`, sub: `1分に約${HEARTBEATS_PER_MIN}回として` },
      { id: 'breakdown', label: '残り時間の内訳', value: `眠っている時間だけで 約${Math.floor(years * SLEEP_FRACTION)}年`, sub: `起きて使える時間は 約${Math.floor(years * (1 - SLEEP_FRACTION))}年` },
      { id: 'counts', label: 'あと何回、めぐってくる?', value: `桜 ${yearlyCount}回 ・ 年末 ${yearlyCount}回`, sub: `満月は あと約${formatOku(moonCount)}回` },
      { id: 'death-prob', label: '明日、無事に朝を迎えられる確率', value: `${surviveP}%`, sub: `それでも、宝くじ1等(約2000万分の1)より、明日が来ない可能性のほうが約${timesVsLottery}倍高い。だから、今日を大切に。` },
      { id: 'parent-days', label: '親が見守ってくれた日々', value: `${formatOku(TimeCalc.daysLived(person.birthDate, now))} 日`, sub: 'あなたが生きてきた日数です' },
      { id: 'today-remaining', label: '今日、起きていられる時間', value: awakeValue, sub: '一日は、今日ももう戻ってきません' },
    ];
  }

  return { formatOku, build };
});
