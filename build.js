/* 人生タイマー ビルド — src/を単一HTML dist/index.html にインライン化し、static/をコピーする */
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf-8');

// インラインJS/CSS内の閉じタグでHTMLが早期終了しないようエスケープ
const escapeScript = (js) => js.replace(/<\/script/gi, '<\\/script');
const escapeStyle = (css) => css.replace(/<\/style/gi, '<\\/style');

const INJECTIONS = {
  STYLE: escapeStyle(read('src/style.css')),
  LIFE_TABLE: escapeScript(read('src/life-table.js')),
  TIME_CALC: escapeScript(read('src/time-calc.js')),
  STORE: escapeScript(read('src/store.js')),
  APP: escapeScript(read('src/app.js')),
};

let html = read('src/index.template.html');
for (const [key, content] of Object.entries(INJECTIONS)) {
  const marker = `/*<!--INJECT:${key}-->*/`;
  if (!html.includes(marker)) {
    console.error(`マーカーが見つかりません: ${marker}`);
    process.exit(1);
  }
  html = html.replace(marker, () => content);
}

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);

const staticDir = path.join(root, 'static');
for (const f of fs.readdirSync(staticDir)) {
  if (f.startsWith('.')) continue;
  fs.copyFileSync(path.join(staticDir, f), path.join(dist, f));
}
console.log(`ビルド完了: dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
