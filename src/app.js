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
    renderStreak();
  }

  // --- ストリーク ---
  function renderStreak() {
    const el = $('streak-line');
    if (!data.self || !data.streak) { el.hidden = true; return; }
    el.hidden = false;
    const s = data.streak;
    if (s.run >= 2) el.textContent = `🔥 ${s.run}日連続 · 通算${s.total}日`;
    else if (s.total > 1) el.textContent = `また今日から · 通算${s.total}日`;
    else el.textContent = '今日から記録がはじまりました';
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
      if (document.activeElement !== $('today-input')) {
        $('today-input').value = '';
      }
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

  // --- 今日の問い ---
  let reflectionSavedTimer = null;

  function renderQuestion() {
    const card = $('question-card');
    if (!data.self) { card.hidden = true; return; }
    card.hidden = false;
    const today = todayStr(new Date());
    const qi = Questions.indexFor(today);
    $('question-text').textContent = Questions.LIST[qi];

    // 同じ問いへの過去の答え(直近1件)があれば「再会」表示
    const past = data.reflections
      .filter((r) => r.q === qi && r.date < today)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const pastEl = $('question-past');
    if (past) {
      const [y, m, d] = past.date.split('-').map(Number);
      const label = y === new Date().getFullYear() ? `${m}月${d}日` : `${y}年${m}月${d}日`;
      pastEl.textContent = `前回(${label})のあなた: 「${past.text}」`;
      pastEl.hidden = false;
    } else {
      pastEl.hidden = true;
    }

    // 当日分を入力欄に反映(入力中はユーザーの手を邪魔しない)
    const input = $('reflection-input');
    if (document.activeElement !== input) {
      const mine = data.reflections.find((r) => r.date === today);
      input.value = mine ? mine.text : '';
    }
  }

  $('reflection-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('reflection-input').value.trim();
    if (!text) return;
    const today = todayStr(new Date());
    const qi = Questions.indexFor(today);
    const existing = data.reflections.find((r) => r.date === today);
    if (existing) { existing.q = qi; existing.text = text; }
    else data.reflections.push({ date: today, q: qi, text });
    persist();
    const saved = $('reflection-saved');
    saved.hidden = false;
    clearTimeout(reflectionSavedTimer);
    reflectionSavedTimer = setTimeout(() => { saved.hidden = true; }, 1600);
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

  function downloadBlob(content, mime, filename) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  $('export-json').addEventListener('click', () => {
    downloadBlob(LifeStore.exportJSON(data), 'application/json', `life-timer-${new Date().toISOString().slice(0, 10)}.json`);
  });

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

  // --- ガチャ ---
  function renderGacha() {
    const section = $('gacha-section');
    if (!data.self) { section.hidden = true; return; }
    section.hidden = false;

    const g = data.gacha;
    const totalXp = g ? g.totalXp : 0;
    const { level, xpInLevel, xpNeeded } = Gacha.levelFromXp(totalXp);
    $('gacha-lv-badge').textContent = 'Lv.' + level;
    $('gacha-xp-fill').style.width = Math.min(100, (xpInLevel / xpNeeded) * 100).toFixed(1) + '%';
    $('gacha-xp-label').textContent = `XP: ${xpInLevel} / ${xpNeeded}`;

    const today = todayStr(new Date());
    const pulledToday = g && g.date === today && g.current;

    $('gacha-pull-area').hidden = !!pulledToday;
    $('gacha-result-area').hidden = !pulledToday;

    if (pulledToday) {
      const c = g.current;
      const card = $('gacha-result-card');
      card.className = 'gacha-result-card rarity-' + c.rarity.toLowerCase();
      $('gacha-rarity-badge').textContent = c.rarity;
      $('gacha-challenge-text').textContent = c.text;
      const check = $('gacha-done-check');
      check.checked = c.done;
      const earned = $('gacha-xp-earned');
      if (c.done) {
        earned.textContent = '+' + c.xp + ' XP 獲得！';
        earned.hidden = false;
      } else {
        earned.hidden = true;
      }
    }

    const histSection = $('gacha-history-section');
    const history = g ? g.history : [];
    histSection.hidden = history.length === 0;
    if (history.length > 0) {
      $('gacha-history-count').textContent = history.length + '件';
      const list = $('gacha-history-list');
      list.textContent = '';
      const recent = [...history].reverse().slice(0, 20);
      for (const h of recent) {
        const li = document.createElement('li');
        li.className = 'gacha-history-item';
        const [, m, d] = h.date.split('-').map(Number);
        li.innerHTML = `<span class="gacha-history-badge rarity-${h.rarity.toLowerCase()}"></span><span class="gacha-history-text"></span><span class="gacha-history-date">${m}/${d}</span>`;
        li.querySelector('.gacha-history-badge').textContent = h.rarity;
        li.querySelector('.gacha-history-text').textContent = h.text;
        list.appendChild(li);
      }
    }
  }

  function openGachaOverlay(challenge) {
    const overlay = $('gacha-overlay');
    const card = $('go-card');
    const front = $('go-front');
    const back = $('go-back');
    const hint = $('go-hint');

    card.className = 'go-card go-spinning';
    front.hidden = false;
    back.hidden = true;
    hint.textContent = '引いています…';
    overlay.hidden = false;

    setTimeout(() => {
      card.className = 'go-card';
      front.hidden = true;
      back.hidden = false;
      back.className = 'go-back rarity-' + challenge.rarity.toLowerCase();
      $('go-rarity').textContent = challenge.rarity;
      $('go-text').textContent = challenge.text;
      $('go-xp').textContent = '+' + challenge.xp + ' XP';
      hint.textContent = 'タップして閉じる';

      if (challenge.rarity === 'SR' || challenge.rarity === 'SSR') celebrate();
      overlay.addEventListener('click', () => {
        overlay.hidden = true;
        renderGacha();
      }, { once: true });
    }, 1200);
  }

  $('gacha-pull-btn').addEventListener('click', () => {
    const today = todayStr(new Date());
    if (data.gacha && data.gacha.date === today) return;
    const challenge = Gacha.pull();
    if (!data.gacha) data.gacha = { date: today, current: null, history: [], totalXp: 0 };
    data.gacha.date = today;
    data.gacha.current = { ...challenge, done: false };
    LifeStore.save(localStorage, data);
    openGachaOverlay(challenge);
  });

  $('gacha-done-check').addEventListener('change', (e) => {
    if (!data.gacha || !data.gacha.current) return;
    const wasAlreadyDone = data.gacha.current.done;
    data.gacha.current.done = e.target.checked;
    if (e.target.checked && !wasAlreadyDone) {
      const c = data.gacha.current;
      data.gacha.totalXp += c.xp;
      data.gacha.history.push({ date: data.gacha.date, rarity: c.rarity, text: c.text, xp: c.xp });
      celebrate();
    } else if (!e.target.checked && wasAlreadyDone) {
      const c = data.gacha.current;
      data.gacha.totalXp = Math.max(0, data.gacha.totalXp - c.xp);
      data.gacha.history = data.gacha.history.filter((h) => !(h.date === data.gacha.date && h.text === c.text));
    }
    LifeStore.save(localStorage, data);
    renderGacha();
  });

  // --- きろく ---
  let noteType = 'memo';
  let noteFilter = 'all';
  let calCursor = null; // 表示中の年月 { y, m }。初回描画時に当月で初期化
  let selectedDate = todayStr(new Date());

  const KIND_BADGE = { reflection: '問いの答え', declaration: '今日の宣言', gacha: 'お題クリア', 'wish-done': '叶えた夢' };

  function nowTimeStr() {
    const n = new Date();
    const p = (x) => String(x).padStart(2, '0');
    return `${p(n.getHours())}:${p(n.getMinutes())}`;
  }

  function renderNoteList() {
    const list = $('note-list');
    list.textContent = '';
    const notes = data.notes
      .filter((n) => noteFilter === 'all' || n.type === noteFilter)
      .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))
      .slice(0, 30);
    $('note-empty').hidden = notes.length > 0;
    for (const n of notes) {
      const li = document.createElement('li');
      li.className = 'note-item';
      const [, m, d] = n.date.split('-').map(Number);
      li.innerHTML = `<span class="note-badge type-${n.type}"></span><span class="note-text"></span>
        <span class="note-date">${m}/${d}</span><button class="ghost-btn note-del" aria-label="削除">×</button>`;
      li.querySelector('.note-badge').textContent = Records.TYPE_LABEL[n.type];
      li.querySelector('.note-text').textContent = n.text;
      li.querySelector('.note-del').dataset.delNote = n.id;
      list.appendChild(li);
    }
  }

  function renderCalendar() {
    if (!calCursor) {
      const n = new Date();
      calCursor = { y: n.getFullYear(), m: n.getMonth() + 1 };
    }
    $('cal-title').textContent = `${calCursor.y}年${calCursor.m}月`;
    const marked = Records.datesWithEntries(data, calCursor.y, calCursor.m);
    const today = todayStr(new Date());
    const grid = $('cal-grid');
    grid.textContent = '';
    for (const week of Records.monthMatrix(calCursor.y, calCursor.m)) {
      for (const date of week) {
        if (!date) {
          const sp = document.createElement('span');
          sp.className = 'cal-day cal-empty';
          grid.appendChild(sp);
          continue;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ghost-btn cal-day'
          + (date === today ? ' cal-today' : '')
          + (date === selectedDate ? ' cal-selected' : '')
          + (marked.has(date) ? ' cal-marked' : '');
        btn.dataset.date = date;
        btn.textContent = String(Number(date.slice(8)));
        grid.appendChild(btn);
      }
    }
  }

  function renderDayDetail() {
    const [, m, d] = selectedDate.split('-').map(Number);
    $('day-detail-title').textContent = `${m}月${d}日(${Records.weekdayLabel(selectedDate)})のきろく`;
    const entries = Records.dayEntries(data, selectedDate);
    $('day-detail-empty').hidden = entries.length > 0;
    const list = $('day-detail-list');
    list.textContent = '';
    for (const e of entries) {
      const li = document.createElement('li');
      li.className = 'day-entry';
      if (e.kind === 'note') {
        li.innerHTML = `<span class="note-badge type-${e.type}"></span><span class="entry-text"></span>
          <span class="note-date">${e.time}</span><button class="ghost-btn note-del" aria-label="削除">×</button>`;
        li.querySelector('.note-badge').textContent = Records.TYPE_LABEL[e.type];
        li.querySelector('.entry-text').textContent = e.text;
        li.querySelector('.note-del').dataset.delNote = e.id;
      } else {
        li.innerHTML = '<span class="note-badge kind-badge"></span><span class="entry-text"></span>';
        li.querySelector('.note-badge').textContent = KIND_BADGE[e.kind];
        let text = '';
        if (e.kind === 'reflection') text = `Q: ${Questions.LIST[e.q] || ''} →「${e.text}」`;
        else if (e.kind === 'declaration') text = e.text + (e.done ? ' ✅' : '');
        else if (e.kind === 'gacha') text = `(${e.rarity}) ${e.text}`;
        else text = e.title;
        li.querySelector('.entry-text').textContent = text;
      }
      list.appendChild(li);
    }
  }

  function renderRecordScreen() {
    renderNoteList();
    renderCalendar();
    renderDayDetail();
  }

  $('note-type-chips').addEventListener('click', (e) => {
    const t = e.target.dataset && e.target.dataset.type;
    if (!t) return;
    noteType = t;
    document.querySelectorAll('#note-type-chips .type-chip').forEach((b) => b.classList.toggle('active', b.dataset.type === t));
  });

  $('note-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('note-input').value.trim();
    if (!text) return;
    data.notes.push({ id: LifeStore.newId(), date: todayStr(new Date()), time: nowTimeStr(), type: noteType, text });
    $('note-input').value = '';
    persist();
  });

  $('note-filter-chips').addEventListener('click', (e) => {
    const f = e.target.dataset && e.target.dataset.filter;
    if (!f) return;
    noteFilter = f;
    document.querySelectorAll('#note-filter-chips .filter-chip').forEach((b) => b.classList.toggle('active', b.dataset.filter === f));
    renderNoteList();
  });

  function moveMonth(delta) {
    if (!calCursor) return;
    let { y, m } = calCursor;
    m += delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    calCursor = { y, m };
    renderCalendar();
  }
  $('cal-prev').addEventListener('click', () => moveMonth(-1));
  $('cal-next').addEventListener('click', () => moveMonth(1));

  $('cal-grid').addEventListener('click', (e) => {
    const date = e.target.dataset && e.target.dataset.date;
    if (!date) return;
    selectedDate = date;
    renderCalendar();
    renderDayDetail();
  });

  document.addEventListener('click', (e) => {
    const id = e.target.dataset && e.target.dataset.delNote;
    if (!id) return;
    if (!confirm('このメモを削除しますか?')) return;
    data.notes = data.notes.filter((n) => n.id !== id);
    persist();
  });

  $('export-copy').addEventListener('click', () => {
    const txt = Records.exportText(data, Questions.LIST, new Date());
    const result = $('export-result');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(
        () => { result.textContent = 'コピーしました。AIに貼り付けて使えます'; },
        () => { result.textContent = 'コピーできませんでした。ダウンロードをお使いください'; }
      );
    } else {
      result.textContent = 'この環境ではコピーできません。ダウンロードをお使いください';
    }
  });

  $('export-download').addEventListener('click', () => {
    const txt = Records.exportText(data, Questions.LIST, new Date());
    downloadBlob(txt, 'text/plain', `life-timer-notes-${new Date().toISOString().slice(0, 10)}.txt`);
    $('export-result').textContent = 'ダウンロードしました';
  });

  // 過去日の「今日の宣言」を declarations に移してカレンダーに残す。移したら true
  function archiveStaleToday(today) {
    if (!data.today || data.today.date === today) return false;
    data.declarations.push({ date: data.today.date, text: data.today.text, done: data.today.done });
    data.today = null;
    return true;
  }

  // --- 毎秒更新 ---
  let lastTickDate = todayStr(new Date());

  function tick() {
    if (!data || !data.self) return;
    const today = todayStr(new Date());
    if (today !== lastTickDate) {
      lastTickDate = today;
      let changed = archiveStaleToday(today);
      const newStreak = LifeStore.advanceStreak(data.streak, today);
      if (newStreak !== data.streak) { data.streak = newStreak; changed = true; }
      if (changed) LifeStore.save(localStorage, data);
    }
    if ($('screen-self').classList.contains('active')) { renderSelf(); renderPriorities(); renderToday(); renderQuestion(); renderGacha(); }
    if ($('screen-insight').classList.contains('active')) { renderInsight(); renderWeeks(); }
  }

  function render() {
    renderSelf();
    renderPriorities();
    renderToday();
    renderQuestion();
    renderGacha();
    renderRecordScreen();
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
    if (!data.reflections) data.reflections = [];
    if (!data.gacha) data.gacha = null;
    if (!data.notes) data.notes = [];
    if (!data.declarations) data.declarations = [];
    const todayForStreak = todayStr(new Date());
    let dirty = archiveStaleToday(todayForStreak);
    const newStreak = LifeStore.advanceStreak(data.streak, todayForStreak);
    if (newStreak !== data.streak) { data.streak = newStreak; dirty = true; }
    if (dirty) LifeStore.save(localStorage, data);
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
