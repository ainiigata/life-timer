/* 人生タイマー 残り時間計算 — DOM非依存の純粋関数のみ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./life-table.js'));
  else root.TimeCalc = factory(root.LifeTable);
})(typeof self !== 'undefined' ? self : this, function (LifeTable) {
  'use strict';

  const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;
  const MS_DAY = 86400000;

  function parseDate(s) {
    return new Date(s + 'T00:00:00');
  }

  // fromからnヶ月後。月末は短い月の末日にクランプ(1/31+1ヶ月=2/28|29)
  function addMonthsClamped(from, n) {
    const r = new Date(from);
    const day = r.getDate();
    r.setDate(1);
    r.setMonth(r.getMonth() + n);
    const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(day, last));
    return r;
  }

  function breakdown(from, to) {
    if (to - from <= 0) {
      return { expired: true, years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    let totalMonths = 0;
    let cursor = new Date(from);
    let next = addMonthsClamped(from, totalMonths + 1);
    while (next <= to) {
      totalMonths++;
      cursor = next;
      next = addMonthsClamped(from, totalMonths + 1);
    }
    let ms = to - cursor;
    const days = Math.floor(ms / MS_DAY); ms -= days * MS_DAY;
    const hours = Math.floor(ms / 3600000); ms -= hours * 3600000;
    const minutes = Math.floor(ms / 60000); ms -= minutes * 60000;
    const seconds = Math.floor(ms / 1000);
    return {
      expired: false,
      years: Math.floor(totalMonths / 12),
      months: totalMonths % 12,
      days, hours, minutes, seconds,
    };
  }

  function expectedDeathDate(person, now) {
    const birth = parseDate(person.birthDate);
    if (person.customLifespan != null) {
      return new Date(birth.getTime() + person.customLifespan * MS_PER_YEAR);
    }
    const age = (now - birth) / MS_PER_YEAR;
    const rem = LifeTable.remainingYears(person.gender, age);
    return new Date(now.getTime() + rem * MS_PER_YEAR);
  }

  function progressPercent(birthDateStr, death, now) {
    const birth = parseDate(birthDateStr);
    const p = ((now - birth) / (death - birth)) * 100;
    return Math.min(100, Math.max(0, p));
  }

  const FREQ_PER_YEAR = { daily: 365, weekly: 52, monthly: 12 };

  function freqPerYear(freq) {
    if (FREQ_PER_YEAR[freq]) return FREQ_PER_YEAR[freq];
    const m = /^yearly-(\d+)$/.exec(freq);
    if (m) {
      const n = Number(m[1]);
      if (n < 1) throw new Error('unknown frequency: ' + freq);
      return n;
    }
    throw new Error('unknown frequency: ' + freq);
  }

  // 会える回数 = 先に尽きる側までの残り年数 × 年間頻度
  function meetCount(selfDeath, familyDeath, freq, now) {
    const end = Math.min(selfDeath.getTime(), familyDeath.getTime());
    const years = Math.max(0, (end - now.getTime()) / MS_PER_YEAR);
    return Math.floor(years * freqPerYear(freq));
  }

  return { MS_PER_YEAR, parseDate, breakdown, expectedDeathDate, progressPercent, freqPerYear, meetCount };
});
