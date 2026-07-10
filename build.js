/* 人生タイマー ビルド — src/を単一HTML dist/index.html にインライン化し、static/をコピーする */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf-8');

// インラインJS/CSS内の閉じタグでHTMLが早期終了しないようエスケープ
const escapeScript = (js) => js.replace(/<\/script/gi, '<\\/script');
const escapeStyle = (css) => css.replace(/<\/style/gi, '<\\/style');

const INJECTIONS = {
  STYLE: escapeStyle(read('src/style.css')),
  LIFE_TABLE: escapeScript(read('src/life-table.js')),
  TIME_CALC: escapeScript(read('src/time-calc.js')),
  QUOTES: escapeScript(read('src/quotes.js')),
  QUESTIONS: escapeScript(read('src/questions.js')),
  GACHA: escapeScript(read('src/gacha.js')),
  INSIGHT: escapeScript(read('src/insight.js')),
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

// sw.jsのキャッシュ名にコンテンツハッシュを刻印(デプロイごとに旧キャッシュを破棄させる)
const buildHash = crypto.createHash('sha1').update(html).digest('hex').slice(0, 8);

const staticDir = path.join(root, 'static');
for (const f of fs.readdirSync(staticDir)) {
  if (f.startsWith('.')) continue;
  if (f === 'sw.js') {
    const sw = read('static/sw.js').replaceAll('__BUILD__', buildHash);
    fs.writeFileSync(path.join(dist, 'sw.js'), sw);
    continue;
  }
  fs.copyFileSync(path.join(staticDir, f), path.join(dist, f));
}
console.log(`ビルド完了: dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
