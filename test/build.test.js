const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const distPath = path.join(root, 'dist', 'index.html');

try {
  execFileSync(process.execPath, ['build.js'], { cwd: root });
} catch (e) {
  console.error('ビルド失敗:', e.stderr ? String(e.stderr) : e.message);
  process.exit(1);
}
const html = fs.readFileSync(distPath, 'utf-8');

test('INJECTマーカーが残っていない', () => {
  assert.ok(!html.includes('INJECT'));
});

test('外部リソース参照ゼロ(src/href属性にhttpなし)', () => {
  assert.ok(!/\b(src|href)\s*=\s*["']https?:/i.test(html));
});

test('通信APIを使用していない(localStorageは使用する)', () => {
  assert.ok(!/\bfetch\s*\(/.test(html));
  assert.ok(!/XMLHttpRequest/.test(html));
  assert.ok(!/\bindexedDB\b/i.test(html));
});

test('CSPメタタグがある', () => {
  assert.ok(html.includes('Content-Security-Policy'));
  assert.ok(html.includes("default-src 'none'"));
});

test('script閉じタグの早期終了がない', () => {
  const open = (html.match(/<script>/g) || []).length;
  const close = (html.match(/<\/script>/g) || []).length;
  assert.equal(open, close);
  assert.equal(open, 8);
});

test('主要モジュールが同梱されている', () => {
  assert.ok(html.includes('LifeTable'));
  assert.ok(html.includes('TimeCalc'));
  assert.ok(html.includes('LifeStore'));
});

test('PWAファイルがdistにコピーされている', () => {
  for (const f of ['manifest.json', 'sw.js', 'icon.svg', 'icon-maskable.svg']) {
    assert.ok(fs.existsSync(path.join(root, 'dist', f)), f + ' がない');
  }
});

test('manifestが相対パス構成', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'manifest.json'), 'utf-8'));
  assert.equal(m.start_url, './?pwa=1');
  assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone');
});

test('sw.jsのキャッシュ名にビルドハッシュが刻印されている', () => {
  const sw = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf-8');
  assert.ok(!sw.includes('__BUILD__'));
  assert.match(sw, /const CACHE = 'life-timer-[0-9a-f]{8}'/);
});

test('CSPがselfの画像(PWAアイコン)を許可している', () => {
  assert.ok(html.includes("img-src data: 'self'"));
});

test('家族ダイアログに続柄セレクトがある', () => {
  assert.ok(html.includes('id="fam-relation"'));
  assert.ok(html.includes('value="child"'));
});

test('今の夢バナー要素がある', () => {
  assert.ok(html.includes('id="dream-banner"'));
  assert.ok(html.includes('id="dream-title"'));
});

test('優先順位リスト要素がある', () => {
  assert.ok(html.includes('id="priority-list"'));
});

test('Life in Weeks グリッド要素がある', () => {
  assert.ok(html.includes('id="weeks-grid-section"'));
  assert.ok(html.includes('id="weeks-grid"'));
});

test('ストリーク行と今日の問いカードがある', () => {
  assert.ok(html.includes('id="streak-line"'));
  assert.ok(html.includes('id="question-card"'));
  assert.ok(html.includes('id="question-text"'));
  assert.ok(html.includes('id="question-past"'));
  assert.ok(html.includes('id="reflection-form"'));
});

test('Questionsモジュールが同梱されている', () => {
  assert.ok(html.includes('Questions'));
  assert.ok(html.includes('今日、いちばん会いたい人は誰ですか?'));
});

test('ガチャセクション要素がある', () => {
  assert.ok(html.includes('id="gacha-section"'));
  assert.ok(html.includes('id="gacha-pull-btn"'));
  assert.ok(html.includes('id="gacha-result-area"'));
  assert.ok(html.includes('id="gacha-overlay"'));
  assert.ok(html.includes('id="gacha-done-check"'));
});

test('Gachaモジュールが同梱されている', () => {
  assert.ok(html.includes('Gacha'));
  assert.ok(html.includes('今日だけスマホを6時間以上置いてみる'));
});
