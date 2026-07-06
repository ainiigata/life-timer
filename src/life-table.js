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
  // 年間死亡率(qx: 年齢xの人が1年以内に死亡する確率)。出典・加工は上記に同じ
  const MORTALITY = {
    male: {
      0: 0.00065, 5: 0.00009, 10: 0.00006, 15: 0.00018, 20: 0.00043, 25: 0.00050,
      30: 0.00055, 35: 0.00073, 40: 0.00102, 45: 0.00147, 50: 0.00243, 55: 0.00399,
      60: 0.00633, 65: 0.01049, 70: 0.01724, 75: 0.02839, 80: 0.04773, 85: 0.08414,
      90: 0.15182, 95: 0.25176, 100: 0.40062, 105: 1,
    },
    female: {
      0: 0.00061, 5: 0.00008, 10: 0.00006, 15: 0.00015, 20: 0.00027, 25: 0.00028,
      30: 0.00028, 35: 0.00041, 40: 0.00059, 45: 0.00088, 50: 0.00146, 55: 0.00211,
      60: 0.00300, 65: 0.00437, 70: 0.00703, 75: 0.01215, 80: 0.02269, 85: 0.04654,
      90: 0.09579, 95: 0.18687, 100: 0.32744, 105: 1,
    },
  };

  // 年齢別テーブルを線形補間して引く。掲載年齢はそのまま、上限超は最終値、負は0歳値。
  // ages はテーブルごとに導出する(テーブルの刻みが違っても正しく動く)
  function interpolate(table, gender, age) {
    const t = table[gender];
    if (!t) throw new Error('unknown gender: ' + gender);
    const ages = Object.keys(t).map(Number).sort((a, b) => a - b);
    const maxAge = ages[ages.length - 1];
    if (age <= 0) return t[ages[0]];
    if (age >= maxAge) return t[maxAge];
    let lo = ages[0], hi = ages[1];
    for (let i = 0; i < ages.length - 1; i++) {
      if (ages[i] <= age) { lo = ages[i]; hi = ages[i + 1]; } else break;
    }
    const ratio = (age - lo) / (hi - lo);
    return t[lo] + (t[hi] - t[lo]) * ratio;
  }

  function remainingYears(gender, age) {
    return interpolate(LIFE_TABLE, gender, age);
  }

  function annualMortality(gender, age) {
    return interpolate(MORTALITY, gender, age);
  }

  return { LIFE_TABLE, MORTALITY, remainingYears, annualMortality };
});
