/* 人生タイマー 年齢別平均余命テーブル
   出典: 「令和5年簡易生命表」(厚生労働省)を加工して作成
   https://www.mhlw.go.jp/toukei/saikin/hw/life/life23/index.html
   5歳刻みの公表値(単位: 年)。中間年齢は線形補間で求める */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LifeTable = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LIFE_TABLE = {
    male: {
      0: 81.09, 5: 76.30, 10: 71.33, 15: 66.36, 20: 61.45, 25: 56.59,
      30: 51.72, 35: 46.87, 40: 42.06, 45: 37.28, 50: 32.60, 55: 28.05,
      60: 23.68, 65: 19.52, 70: 15.65, 75: 12.13, 80: 8.98, 85: 6.29,
      90: 4.22, 95: 2.75, 100: 1.72, 105: 1.05,
    },
    female: {
      0: 87.14, 5: 82.35, 10: 77.37, 15: 72.40, 20: 67.48, 25: 62.57,
      30: 57.65, 35: 52.74, 40: 47.85, 45: 43.01, 50: 38.23, 55: 33.54,
      60: 28.91, 65: 24.38, 70: 19.96, 75: 15.74, 80: 11.81, 85: 8.33,
      90: 5.53, 95: 3.45, 100: 2.13, 105: 1.33,
    },
  };
  const AGES = Object.keys(LIFE_TABLE.male).map(Number).sort((a, b) => a - b);
  const MAX_AGE = AGES[AGES.length - 1];

  function remainingYears(gender, age) {
    const t = LIFE_TABLE[gender];
    if (!t) throw new Error('unknown gender: ' + gender);
    if (age <= 0) return t[0];
    if (age >= MAX_AGE) return t[MAX_AGE];
    let lo = AGES[0];
    for (const a of AGES) {
      if (a <= age) lo = a; else break;
    }
    const hi = AGES[AGES.indexOf(lo) + 1];
    const ratio = (age - lo) / (hi - lo);
    return t[lo] + (t[hi] - t[lo]) * ratio;
  }

  return { LIFE_TABLE, remainingYears };
});
