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
    $('countdown').textContent = formatBreakdown(b);
    const pct = TimeCalc.progressPercent(data.self.birthDate, deathDates.self, now);
    $('progress-bar').style.width = pct.toFixed(2) + '%';
    $('progress-text').textContent = `人生の ${pct.toFixed(1)}% を生きました`;
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
      const li = document.createElement('li');
      li.className = 'family-card';
      const meets = data.self && deathDates.self
        ? TimeCalc.meetCount(deathDates.self, death, f.meetFrequency, now)
        : null;
      li.innerHTML = `
        <div class="family-head"><strong></strong><button class="ghost-btn" data-edit="${f.id}">編集</button></div>
        <p class="family-remain">残り ${b.expired ? '—' : `${b.years}年${b.months}ヶ月`}</p>
        <p class="family-meets">${meets === null ? 'わたしの誕生日を設定すると回数が出ます'
          : `${FREQ_LABEL[f.meetFrequency] || '会うなら'} <strong class="meets-num">あと${meets}回</strong>`}</p>`;
      li.querySelector('strong').textContent = f.name; // XSS防止のためtextContentで注入
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
    const span = $('set-lifespan').value;
    data.self = {
      name: data.self.name || '',
      birthDate,
      gender: $('set-gender').value,
      customLifespan: span ? Number(span) : null,
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
    if (data && data.self) renderSelf();
  }

  function render() {
    renderSelf();
    renderFamily();
    renderWishes();
  }

  // --- 起動 ---
  function init() {
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
