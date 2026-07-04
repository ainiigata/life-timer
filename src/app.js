/* 人生タイマー UI */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // --- 状態 ---
  let data = null;
  let deathDates = { self: null, family: new Map() }; // データ変更時にのみ再計算
  let timerId = null;

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
    $('self-timer').hidden = !has;
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

  // --- 毎秒更新 ---
  function tick() {
    if (data && data.self) renderSelf();
  }

  function render() {
    renderSelf();
    // renderFamily / renderWishes はTask 6-7で追加
    if (typeof renderFamily === 'function') renderFamily();
    if (typeof renderWishes === 'function') renderWishes();
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
  init();
})();
