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
