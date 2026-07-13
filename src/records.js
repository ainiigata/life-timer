/* 人生タイマー きろく — カレンダー行列・日別記録の統合・Markdown書き出し(DOM非依存の純ロジック) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Records = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TYPE_LABEL = { idea: 'アイデア', todo: 'やること', memo: 'メモ' };
  const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];
  const GENDER_LABEL = { male: '男性', female: '女性' };

  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  // 月カレンダー(日曜はじまり)。週×7の2次元配列で、月外のマスは null。month は 1〜12
  function monthMatrix(year, month) {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const weeks = [];
    let week = new Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(dateStr(year, month, d));
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  }

  // その日の全記録を統合: メモ(時刻順)→問いの答え→宣言→お題クリア→叶えた夢
  function dayEntries(data, date) {
    const out = [];
    const notes = (data.notes || []).filter((n) => n.date === date)
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    for (const n of notes) out.push({ kind: 'note', id: n.id, time: n.time, type: n.type, text: n.text });
    for (const r of data.reflections || []) {
      if (r.date === date) out.push({ kind: 'reflection', q: r.q, text: r.text });
    }
    for (const dec of data.declarations || []) {
      if (dec.date === date) out.push({ kind: 'declaration', text: dec.text, done: dec.done });
    }
    if (data.today && data.today.date === date) {
      out.push({ kind: 'declaration', text: data.today.text, done: data.today.done });
    }
    const history = (data.gacha && data.gacha.history) || [];
    for (const h of history) {
      if (h.date === date) out.push({ kind: 'gacha', rarity: h.rarity, text: h.text });
    }
    for (const w of data.wishes || []) {
      if (w.done && w.doneAt === date) out.push({ kind: 'wish-done', title: w.title });
    }
    return out;
  }

  // 何かしらの記録がある日付をすべて集める
  function allDates(data) {
    const s = new Set();
    for (const n of data.notes || []) s.add(n.date);
    for (const r of data.reflections || []) s.add(r.date);
    for (const dec of data.declarations || []) s.add(dec.date);
    if (data.today) s.add(data.today.date);
    for (const h of (data.gacha && data.gacha.history) || []) s.add(h.date);
    for (const w of data.wishes || []) if (w.done && w.doneAt) s.add(w.doneAt);
    return s;
  }

  // 指定月のうち記録がある日付のSet(カレンダーのドット表示用)。month は 1〜12
  function datesWithEntries(data, year, month) {
    const prefix = `${year}-${pad(month)}-`;
    const s = new Set();
    for (const d of allDates(data)) if (d.startsWith(prefix)) s.add(d);
    return s;
  }

  function weekdayLabel(date) {
    const [y, m, d] = date.split('-').map(Number);
    return WEEKDAY[new Date(y, m - 1, d).getDay()];
  }

  // 全記録をコピペしやすいプレーンテキストにする。questions は Questions.LIST(問い本文の解決用)
  function exportText(data, questions, now) {
    const lines = [];
    lines.push(`人生タイマー きろく(${dateStr(now.getFullYear(), now.getMonth() + 1, now.getDate())} 書き出し)`);
    lines.push('');
    lines.push('■ プロフィール');
    if (data.self) {
      lines.push(`誕生日: ${data.self.birthDate} / 性別: ${GENDER_LABEL[data.self.gender] || data.self.gender}`);
      lines.push(`目標寿命: ${data.self.customLifespan ? data.self.customLifespan + '歳' : '未設定(統計値を使用)'}`);
    } else {
      lines.push('未設定');
    }
    if (data.priorities) lines.push(`時間の優先順位: ${data.priorities.join(' > ')}`);
    lines.push('');
    lines.push('■ やりたいこと');
    const wishes = data.wishes || [];
    if (wishes.length === 0) lines.push('(まだありません)');
    for (const w of wishes.filter((x) => !x.done)) {
      let line = `・${w.title}`;
      if (w.targetAge) line += `(${w.targetAge}歳までに)`;
      if (w.pinned) line += '★今の夢';
      lines.push(line);
    }
    for (const w of wishes.filter((x) => x.done)) {
      lines.push(`・【達成】${w.title}${w.doneAt ? `(${w.doneAt})` : ''}`);
    }
    lines.push('');
    lines.push('■ 日々のきろく');
    const dates = [...allDates(data)].sort();
    if (dates.length === 0) lines.push('(まだ記録がありません)');
    for (const date of dates) {
      lines.push('');
      lines.push(`${date}(${weekdayLabel(date)})`);
      for (const e of dayEntries(data, date)) {
        if (e.kind === 'note') lines.push(`・${e.time}【${TYPE_LABEL[e.type]}】${e.text}`);
        else if (e.kind === 'reflection') lines.push(`・【問いの答え】Q: ${questions[e.q] || '(不明な問い)'} →「${e.text}」`);
        else if (e.kind === 'declaration') lines.push(`・【今日の宣言】${e.text}${e.done ? ' ✅' : ''}`);
        else if (e.kind === 'gacha') lines.push(`・【お題クリア】(${e.rarity}) ${e.text}`);
        else if (e.kind === 'wish-done') lines.push(`・【叶えた夢】${e.title}`);
      }
    }
    lines.push('');
    return lines.join('\n');
  }

  return { TYPE_LABEL, monthMatrix, dayEntries, datesWithEntries, weekdayLabel, exportText };
});
