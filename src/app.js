/* 人生タイマー UI */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // --- 状態 ---
  let data = null;
  let deathDates = { self: null, family: new Map() }; // データ変更時にのみ再計算
  let timerId = null;
  let selfView = 'timer'; // 'timer' | 'settings'
  let celebrateTimer = null;

  // --- 格言バナー ---
  let quoteOrder = [];
  let quotePos = 0;
  function shuffleQuotes() {
    quoteOrder = Quotes.LIST.map((_, i) => i);
    for (let i = quoteOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [quoteOrder[i], quoteOrder[j]] = [quoteOrder[j], quoteOrder[i]];
    }
    quotePos = 0;
  }
  function showQuote() {
    if (quoteOrder.length === 0) shuffleQuotes();
    const q = Quotes.LIST[quoteOrder[quotePos]];
    $('quote-text').textContent = '「' + q.text + '」';
    $('quote-author').textContent = '— ' + q.author;
    const banner = $('quote-banner');
    banner.style.animation = 'none';
    void banner.offsetWidth; // reflow で再アニメーション
    banner.style.animation = '';
  }
  function nextQuote() {
    quotePos++;
    if (quotePos >= quoteOrder.length) shuffleQuotes();
    showQuote();
  }
  $('quote-banner').addEventListener('click', nextQuote);

  function recomputeDeathDates() {
    const now = new Date();
    deathDates.self = data.self ? TimeCalc.expectedDeathDate(data.self, now) : null;
    deathDates.family = new Map(
      data.family.map((f) => [f.id, TimeCalc.expectedDeathDate(f, now)])
    );
  }

  function persist() {
    LifeStore.save(localStorage, data);
    recomputeDeathDates();
    render();
  }

  // --- タブ ---
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      $('screen-' + btn.dataset.tab).classList.add('active');
      btn.classList.add('active');
      tick(); // 切替先の画面(わたし/見つめる)を即座に最新表示にする
    });
  });

  // --- わたし画面 ---
  function formatBreakdown(b) {
    if (b.expired) return 'おめでとうございます。統計を超えて生きています';
    const pad = (n) => String(n).padStart(2, '0');
    return `${b.years}年 ${b.months}ヶ月 ${b.days}日 ${pad(b.hours)}:${pad(b.minutes)}:${pad(b.seconds)}`;
  }

  function renderSelf() {
    const has = !!data.self;
    $('onboarding').hidden = has;
    $('self-timer').hidden = !has || selfView !== 'timer';
    $('settings').hidden = !has || selfView !== 'settings';
    if (!has) return;
    const now = new Date();
    const b = TimeCalc.breakdown(now, deathDates.self);
    const c = $('countdown');
    if (b.expired) {
      c.textContent = formatBreakdown(b);
    } else {
      // 時刻部(HH:MM:SS)の途中で折り返されないよう、日付部と時刻部を別spanにする
      const pad = (n) => String(n).padStart(2, '0');
      c.textContent = '';
      const dateSpan = document.createElement('span');
      dateSpan.className = 'countdown-date';
      dateSpan.textContent = `${b.years}年 ${b.months}ヶ月 ${b.days}日 `;
      const timeSpan = document.createElement('span');
      timeSpan.className = 'countdown-time';
      timeSpan.textContent = `${pad(b.hours)}:${pad(b.minutes)}:${pad(b.seconds)}`;
      c.append(dateSpan, timeSpan);
    }
    const pct = TimeCalc.progressPercent(data.self.birthDate, deathDates.self, now);
    $('progress-bar').style.width = pct.toFixed(2) + '%';
    $('progress-text').textContent = `人生の ${pct.toFixed(1)}% を生きました`;
    const pinned = data.wishes.find((w) => w.pinned && !w.done);
    const banner = $('dream-banner');
    banner.hidden = !pinned;
    if (pinned) $('dream-title').textContent = pinned.title;
  }

  $('onboarding-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const birthDate = $('ob-birth').value;
    if (!LifeStore.isValidDateStr(birthDate)) {
      alert('誕生日が不正です(未来日付・150年以上前は入力できません)');
      return;
    }
    data.self = { name: '', birthDate, gender: $('ob-gender').value, customLifespan: null };
    persist();
  });

  // --- 優先順位 ---
  const DEFAULT_PRIORITIES = ['家族', '仕事', '自分', '余暇', '睡眠'];

  function renderPriorities() {
    const section = $('priority-section');
    if (!data.self) { section.hidden = true; return; }
    section.hidden = false;
    const items = data.priorities || DEFAULT_PRIORITIES;
    const list = $('priority-list');
    list.textContent = '';
    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'priority-item';
      li.innerHTML = `<span class="priority-label"></span>
        <button class="ghost-btn pri-btn" data-pri-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="上へ">↑</button>
        <button class="ghost-btn pri-btn" data-pri-down="${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="下へ">↓</button>`;
      li.querySelector('.priority-label').textContent = item;
      list.appendChild(li);
    });
  }

  document.addEventListener('click', (e) => {
    const upIdx = e.target.dataset && e.target.dataset.priUp;
    const downIdx = e.target.dataset && e.target.dataset.priDown;
    if (upIdx == null && downIdx == null) return;
    const idx = upIdx != null ? Number(upIdx) : Number(downIdx);
    const items = [...(data.priorities || DEFAULT_PRIORITIES)];
    const swapWith = upIdx != null ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= items.length) return;
    [items[idx], items[swapWith]] = [items[swapWith], items[idx]];
    data.priorities = items;
    persist();
  });

  // --- 今日の宣言 ---
  function todayStr(now) {
    const p = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  }
  function currentToday() {
    if (data.today && data.today.date === todayStr(new Date())) return data.today;
    return null;
  }
  function renderToday() {
    if (!data.self) { $('today-declaration').hidden = true; return; }
    $('today-declaration').hidden = false;
    const t = currentToday();
    $('today-form').hidden = !!t;
    $('today-set').hidden = !t;
    if (t) {
      $('today-text').textContent = t.text;
      $('today-done').checked = t.done;
      $('today-set').classList.toggle('done', t.done);
    } else {
      $('today-input').value = '';
    }
  }
  $('today-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('today-input').value.trim();
    if (!text) return;
    data.today = { date: todayStr(new Date()), text, done: false };
    persist();
  });
  $('today-done').addEventListener('change', (e) => {
    if (!data.today) return;
    data.today.done = e.target.checked;
    if (e.target.checked) celebrate();
    persist();
  });
  $('today-clear').addEventListener('click', () => {
    data.today = null;
    persist();
  });

  // --- 見つめる画面 ---
  function renderInsight() {
    const has = !!data.self;
    $('insight-empty').hidden = has;
    const wrap = $('insight-cards');
    if (!has) { wrap.textContent = ''; return; }
    const cards = Insight.build(data.self, deathDates.self, new Date());
    // 毎秒呼ばれるので、枚数が同じなら要素を作り直さず value/sub だけ更新
    if (wrap.childElementCount !== cards.length) {
      wrap.textContent = '';
      for (const c of cards) {
        const el = document.createElement('div');
        el.className = 'insight-card';
        el.dataset.id = c.id;
        el.innerHTML = '<p class="insight-label"></p><p class="insight-value"></p><p class="insight-sub"></p>';
        wrap.appendChild(el);
      }
    }
    const els = wrap.children;
    cards.forEach((c, i) => {
      const el = els[i];
      el.querySelector('.insight-label').textContent = c.label;
      el.querySelector('.insight-value').textContent = c.value;
      el.querySelector('.insight-sub').textContent = c.sub;
    });
  }

  // --- Life in Weeks ---
  function renderWeeks() {
    const section = $('weeks-grid-section');
    if (!data.self) { section.hidden = true; return; }
    section.hidden = false;
    const grid = $('weeks-grid');
    const TOTAL = 90 * 52; // 4680

    if (grid.childElementCount !== TOTAL) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < TOTAL; i++) {
        const cell = document.createElement('span');
        frag.appendChild(cell);
      }
      grid.appendChild(frag);
    }

    const birth = TimeCalc.parseDate(data.self.birthDate);
    const now = new Date();
    const weeksLived = Math.floor((now - birth) / (7 * 24 * 60 * 60 * 1000));
    const cells = grid.children;
    for (let i = 0; i < cells.length; i++) {
      if (i < weeksLived) cells[i].className = 'wc p';
      else if (i === weeksLived) cells[i].className = 'wc c';
      else cells[i].className = 'wc f';
    }
  }

  // --- 家族画面 ---
  const FREQ_LABEL = {
    daily: '毎日会うなら', weekly: '週1で会うなら', monthly: '月1で会うなら',
    'yearly-2': '年2回会うなら', 'yearly-1': '年1回会うなら',
  };
  let editingFamilyId = null;

  function renderFamily() {
    const list = $('family-list');
    list.textContent = '';
    $('family-empty').hidden = data.family.length > 0;
    const now = new Date();
    for (const f of data.family) {
      const death = deathDates.family.get(f.id);
      const b = TimeCalc.breakdown(now, death);
      const rel = f.relationship || 'other';
      const li = document.createElement('li');
      li.className = 'family-card';

      let meetsHtml = '';
      if (rel === 'child') {
        const hug = TimeCalc.childRemainingDays(f.birthDate, 6, now);
        const live = TimeCalc.childRemainingDays(f.birthDate, 18, now);
        if (!hug.expired) {
          meetsHtml += `<p class="child-days">抱っこできる残り <strong>${hug.days.toLocaleString()}日</strong></p>`;
        }
        if (!live.expired) {
          meetsHtml += `<p class="child-days">一緒に暮らせる残り <strong>${live.days.toLocaleString()}日</strong></p>`;
        }
        if (hug.expired && live.expired) {
          const meets = data.self && deathDates.self
            ? TimeCalc.meetCount(deathDates.self, death, f.meetFrequency, now) : null;
          meetsHtml = meets === null ? '<p class="family-meets">わたしの誕生日を設定すると回数が出ます</p>'
            : `<p class="family-meets">${FREQ_LABEL[f.meetFrequency] || '会うなら'} <strong class="meets-num">あと${meets}回</strong></p>`;
        }
      } else {
        const meets = data.self && deathDates.self
          ? TimeCalc.meetCount(deathDates.self, death, f.meetFrequency, now) : null;
        const meetsClass = (rel === 'parent' || rel === 'spouse') ? 'family-meets emphasis' : 'family-meets';
        meetsHtml = meets === null ? `<p class="${meetsClass}">わたしの誕生日を設定すると回数が出ます</p>`
          : `<p class="${meetsClass}">${FREQ_LABEL[f.meetFrequency] || '会うなら'} <strong class="meets-num">あと${meets}回</strong></p>`;
      }

      li.innerHTML = `<div class="family-head"><strong></strong><button class="ghost-btn" data-edit="${f.id}">編集</button></div>
        <p class="family-remain">残り ${b.expired ? '—' : `${b.years}年${b.months}ヶ月`}</p>
        ${meetsHtml}`;
      li.querySelector('strong').textContent = f.name;
      list.appendChild(li);
    }
  }

  $('family-list').addEventListener('click', (e) => {
    const id = e.target.dataset && e.target.dataset.edit;
    if (!id) return;
    const f = data.family.find((x) => x.id === id);
    if (!f) return;
    editingFamilyId = id;
    $('family-dialog-title').textContent = '家族を編集';
    $('fam-name').value = f.name;
    $('fam-birth').value = f.birthDate;
    $('fam-gender').value = f.gender;
    $('fam-relation').value = f.relationship || 'other';
    $('fam-freq').value = f.meetFrequency;
    $('fam-delete').hidden = false;
    $('family-dialog').showModal();
  });

  $('add-family').addEventListener('click', () => {
    editingFamilyId = null;
    $('family-dialog-title').textContent = '家族を追加';
    $('family-form').reset();
    $('fam-delete').hidden = true;
    $('family-dialog').showModal();
  });

  $('family-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const birthDate = $('fam-birth').value;
    if (!LifeStore.isValidDateStr(birthDate)) {
      alert('誕生日が不正です');
      return;
    }
    const rec = {
      id: editingFamilyId || LifeStore.newId(),
      name: $('fam-name').value.trim(),
      birthDate,
      gender: $('fam-gender').value,
      customLifespan: null,
      relationship: $('fam-relation').value,
      meetFrequency: $('fam-freq').value,
    };
    if (editingFamilyId) {
      data.family = data.family.map((f) => (f.id === editingFamilyId ? rec : f));
    } else {
      data.family.push(rec);
    }
    persist();
    $('family-dialog').close();
  });

  $('fam-delete').addEventListener('click', () => {
    if (!confirm('この家族を削除しますか?')) return;
    data.family = data.family.filter((f) => f.id !== editingFamilyId);
    $('family-dialog').close();
    persist();
  });

  $('fam-cancel').addEventListener('click', () => $('family-dialog').close());

  // --- やりたいこと画面 ---
  function wishRemainLabel(w) {
    if (!w.targetAge || !data.self) return '';
    const deadline = TimeCalc.parseDate(data.self.birthDate);
    deadline.setFullYear(deadline.getFullYear() + w.targetAge);
    const b = TimeCalc.breakdown(new Date(), deadline);
    return b.expired ? `${w.targetAge}歳までに(期限超過)` : `${w.targetAge}歳まで 残り${b.years}年${b.months}ヶ月`;
  }

  function renderWishes() {
    const list = $('wish-list');
    const doneList = $('wish-done-list');
    list.textContent = '';
    doneList.textContent = '';
    const active = data.wishes.filter((w) => !w.done);
    const done = data.wishes.filter((w) => w.done);
    $('wish-empty').hidden = active.length > 0;
    $('done-count').textContent = done.length ? `${done.length}個` : '';
    for (const w of active) {
      const li = document.createElement('li');
      li.className = 'wish-item';
      li.innerHTML = `<label><input type="checkbox" data-wish="${w.id}"> <span class="wish-title"></span></label>
        <span class="wish-remain">${wishRemainLabel(w)}</span>
        <button class="pin-btn${w.pinned ? ' pinned' : ''}" data-pin="${w.id}" aria-label="今の夢にする">${w.pinned ? '★' : '☆'}</button>
        <button class="ghost-btn" data-del-wish="${w.id}" aria-label="削除">×</button>`;
      li.querySelector('.wish-title').textContent = w.title;
      list.appendChild(li);
    }
    for (const w of done) {
      const li = document.createElement('li');
      li.className = 'wish-item done';
      li.innerHTML = `<label><input type="checkbox" checked data-wish="${w.id}"> <span class="wish-title"></span></label>
        <button class="ghost-btn" data-del-wish="${w.id}" aria-label="削除">×</button>`;
      li.querySelector('.wish-title').textContent = w.title;
      doneList.appendChild(li);
    }
  }

  $('wish-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('wish-title').value.trim();
    if (!title) return;
    const age = $('wish-age').value ? Number($('wish-age').value) : null;
    data.wishes.push({
      id: LifeStore.newId(), title, targetAge: age,
      done: false, createdAt: new Date().toISOString().slice(0, 10), doneAt: null,
    });
    $('wish-form').reset();
    persist();
  });

  function celebrate() {
    clearTimeout(celebrateTimer);
    const el = $('celebrate');
    el.textContent = '';
    for (let i = 0; i < 24; i++) {
      const s = document.createElement('span');
      s.className = 'confetti';
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDelay = Math.random() * 0.4 + 's';
      s.style.background = ['#ff8a3d', '#ffd23d', '#3dbf6e', '#3d9bff'][i % 4];
      el.appendChild(s);
    }
    el.hidden = false;
    celebrateTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  document.addEventListener('change', (e) => {
    const id = e.target.dataset && e.target.dataset.wish;
    if (!id) return;
    const w = data.wishes.find((x) => x.id === id);
    if (!w) return;
    w.done = e.target.checked;
    w.doneAt = w.done ? new Date().toISOString().slice(0, 10) : null;
    if (w.done) celebrate();
    persist();
  });

  document.addEventListener('click', (e) => {
    const id = e.target.dataset && e.target.dataset.delWish;
    if (!id) return;
    if (!confirm('このやりたいことを削除しますか?')) return;
    data.wishes = data.wishes.filter((x) => x.id !== id);
    persist();
  });

  document.addEventListener('click', (e) => {
    const id = e.target.dataset && e.target.dataset.pin;
    if (!id) return;
    const wasPin = !!(data.wishes.find((w) => w.id === id) || {}).pinned;
    data.wishes.forEach((w) => { w.pinned = false; });
    if (!wasPin) {
      const w = data.wishes.find((w) => w.id === id);
      if (w && !w.done) w.pinned = true;
    }
    persist();
  });

  // --- 設定・バックアップ ---
  $('open-settings').addEventListener('click', () => {
    if (!data || !data.self) return;
    $('set-birth').value = data.self.birthDate;
    $('set-gender').value = data.self.gender;
    $('set-lifespan').value = data.self.customLifespan || '';
    selfView = 'settings';
    renderSelf();
  });

  $('close-settings').addEventListener('click', () => {
    selfView = 'timer';
    renderSelf();
  });

  $('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const birthDate = $('set-birth').value;
    if (!LifeStore.isValidDateStr(birthDate)) {
      alert('誕生日が不正です');
      return;
    }
    const span = $('set-lifespan').value.trim();
    let customLifespan = null;
    if (span) {
      const n = Number(span);
      if (!Number.isFinite(n) || n < 1 || n > 150) {
        alert('目標寿命は1〜150の数字で入力してください(未設定なら空欄)');
        return;
      }
      customLifespan = n;
    }
    data.self = {
      name: data.self.name || '',
      birthDate,
      gender: $('set-gender').value,
      customLifespan,
    };
    selfView = 'timer';
    persist();
  });

  function downloadJSON() {
    const blob = new Blob([LifeStore.exportJSON(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-timer-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  $('export-json').addEventListener('click', downloadJSON);

  function readImportFile(file, onOk, resultId = 'import-result') {
    const reader = new FileReader();
    reader.onload = () => {
      const r = LifeStore.importJSON(String(reader.result));
      if (!r.ok) {
        $(resultId).textContent = '読み込めませんでした: ' + r.error;
        return;
      }
      onOk(r.data);
    };
    reader.onerror = () => {
      $(resultId).textContent = '読み込めませんでした: ファイル読み取りエラー';
    };
    reader.readAsText(file);
  }

  $('import-json').addEventListener('change', (e) => {
    if (!e.target.files[0]) return;
    if (!confirm('現在のデータを読み込んだ内容で置き換えます。よろしいですか?')) return;
    readImportFile(e.target.files[0], (d) => {
      data = d;
      $('import-result').textContent = '読み込みました';
      $('settings').hidden = true;
      persist();
    });
    e.target.value = '';
  });

  // --- 破損復旧(init内のcorrupt分岐から使う) ---
  $('restore-json').addEventListener('change', (e) => {
    if (!e.target.files[0]) return;
    readImportFile(e.target.files[0], (d) => {
      data = d;
      LifeStore.save(localStorage, data);
      location.reload();
    }, 'restore-result');
    e.target.value = '';
  });

  $('reset-data').addEventListener('click', () => {
    if (!confirm('保存データを消して最初からやり直します。よろしいですか?')) return;
    LifeStore.save(localStorage, LifeStore.emptyData());
    location.reload();
  });

  // --- 毎秒更新 ---
  function tick() {
    if (!data || !data.self) return;
    if ($('screen-self').classList.contains('active')) { renderSelf(); renderPriorities(); renderToday(); }
    if ($('screen-insight').classList.contains('active')) { renderInsight(); renderWeeks(); }
  }

  function render() {
    renderSelf();
    renderPriorities();
    renderToday();
    renderInsight();
    renderWeeks();
    renderFamily();
    renderWishes();
  }

  // --- 起動 ---
  function init() {
    shuffleQuotes();
    showQuote();
    const r = LifeStore.load(localStorage);
    if (r.corrupt) {
      $('corrupt-notice').hidden = false;
      $('onboarding').hidden = true;
      return; // 黙って初期化しない(復元/リセットはTask 8で配線)
    }
    data = r.data;
    recomputeDeathDates();
    render();
    timerId = setInterval(tick, 1000);
  }

  window.LifeApp = { get data() { return data; }, render, formatBreakdown };

  // PWA: file:直開き配布でも動くようhttp(s)時のみ登録
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  init();
})();
