/* 人生タイマー データ永続化 — localStorage互換オブジェクトを引数に取るDOM非依存実装 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LifeStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KEY = 'life-timer-v1';
  const GENDERS = ['male', 'female'];
  const FREQ_RE = /^(daily|weekly|monthly|yearly-\d+)$/;

  function emptyData() {
    return { version: 1, self: null, family: [], wishes: [] };
  }

  function isValidDateStr(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    if (d > now) return false;
    if (now.getFullYear() - d.getFullYear() > 150) return false;
    return true;
  }

  function validPerson(p) {
    if (!p || typeof p !== 'object') return '人物データが不正です';
    if (!isValidDateStr(p.birthDate)) return '誕生日が不正です(未来日付・150年以上前は不可)';
    if (!GENDERS.includes(p.gender)) return '性別が不正です';
    if (p.customLifespan != null &&
        !(typeof p.customLifespan === 'number' && p.customLifespan > 0 && p.customLifespan <= 150)) {
      return '目標寿命が不正です(1〜150)';
    }
    return null;
  }

  function validate(data) {
    if (!data || typeof data !== 'object') return { ok: false, error: 'データがオブジェクトではありません' };
    if (data.version !== 1) return { ok: false, error: '未対応のデータバージョンです' };
    if (data.self !== null) {
      const e = validPerson(data.self);
      if (e) return { ok: false, error: '本人: ' + e };
    }
    if (!Array.isArray(data.family)) return { ok: false, error: 'family が配列ではありません' };
    for (const f of data.family) {
      const e = validPerson(f);
      if (e) return { ok: false, error: '家族: ' + e };
      if (typeof f.name !== 'string' || f.name === '') return { ok: false, error: '家族の名前が空です' };
      if (typeof f.meetFrequency !== 'string' || !FREQ_RE.test(f.meetFrequency)) {
        return { ok: false, error: '会う頻度が不正です' };
      }
    }
    if (!Array.isArray(data.wishes)) return { ok: false, error: 'wishes が配列ではありません' };
    for (const w of data.wishes) {
      if (!w || typeof w.title !== 'string' || w.title === '') return { ok: false, error: 'やりたいことのタイトルが不正です' };
      if (typeof w.done !== 'boolean') return { ok: false, error: 'done がboolean ではありません' };
      if (w.targetAge != null &&
          !(typeof w.targetAge === 'number' && w.targetAge > 0 && w.targetAge <= 150)) {
        return { ok: false, error: '目標年齢が不正です(1〜150)' };
      }
    }
    return { ok: true };
  }

  function load(storage) {
    const raw = storage.getItem(KEY);
    if (raw === null) return { data: emptyData(), corrupt: false };
    try {
      const data = JSON.parse(raw);
      if (!validate(data).ok) return { data: null, corrupt: true };
      return { data, corrupt: false };
    } catch (_) {
      return { data: null, corrupt: true };
    }
  }

  function save(storage, data) {
    storage.setItem(KEY, JSON.stringify(data));
  }

  function exportJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  function importJSON(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      return { ok: false, error: 'JSONとして読み取れません' };
    }
    const v = validate(data);
    if (!v.ok) return { ok: false, error: v.error };
    return { ok: true, data };
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return { KEY, emptyData, validate, load, save, exportJSON, importJSON, newId, isValidDateStr };
});
