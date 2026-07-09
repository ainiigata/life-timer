# 人生タイマー v3 設計ドキュメント — 開きたくなる仕組み

日付: 2026-07-09  
ステータス: 承認済み(案A・ユーザー確認済み)  
前提: v2第2弾まで公開済み。本書は「強い意志がなくても毎日開きたくなる」再訪動機の追加。

## 0. 方針

- 理想リズム: **毎日1回**(朝か夜)
- フック: **積み上げ型(ストリーク)+ 日替わり型(今日の問い)** の二本柱
- 開いて3秒で刺さる既存体験(カウントダウン)を邪魔しない。わたし画面に溶け込ませる
- サーバーなし制約のためプッシュ通知は不採用。「開いたときの報酬」で勝負する

## 1. 追加する機能

### ① ストリーク(開くだけカウント)

- 起動するだけで「今日の1日」がカウントされる。操作は一切不要
- **やさしいリセット**: 途切れたら連続日数(run)は1に戻るが、通算日数(total)は絶対に減らない
- 表示: わたし画面、格言バナーの下・タイマーラベルの上に一行
  - `run >= 2`: 「🔥 7日連続 · 通算23日」
  - `run == 1` かつ `total > 1`: 「また今日から · 通算23日」(責めないトーン)
  - `run == 1` かつ `total == 1`: 「今日から記録がはじまりました」
- 更新ロジックは純関数 `LifeStore.advanceStreak(streak, todayStr)` として実装(DOM非依存・テスト可能):
  - `streak.last === today` → 変化なし(同一オブジェクトを返す)
  - `streak.last === 昨日` → `{ last: today, run: run+1, total: total+1 }`
  - それ以外(途切れ・初回) → `{ last: today, run: 1, total: (旧total||0)+1 }`
- 呼び出しタイミング: init時 + tick内で日付が変わったことを検知したら(0時をまたいで開きっぱなしのケース)

### ② 今日の問い + 一言メモ

- 新モジュール `src/questions.js`(UMD、`Questions.LIST` = オリジナルの問い50問)
  - 格言と違い出典検証は不要(オリジナル文)。テーマ: 人・感謝・今日の使い方・死生観・夢
  - `Questions.indexFor(dateStr)`: 基準日(2026-01-01)からの経過日数 % 50 で決定論的に選ぶ。同じ日は何度開いても同じ問い
- UI: わたし画面、今日の宣言の下にカード
  - 問い文 + 一言入力欄(任意・100字まで)+「残す」ボタン
  - 書かなくてもストリークとは無関係(ストリークは開くだけ)
  - 当日分は上書き可(再送信で更新)
- データ: `data.reflections = [{ date: "YYYY-MM-DD", q: 問いindex, text: "..." }]`(残した時だけ追加)

### ③ 再会の仕掛け(長期報酬)

- 50日周期で同じ問いが巡ってきたとき、同じ問いへの過去の答え(直近1件)があれば問いの下に表示:
  > 前回(4月1日)のあなた: 「母さんに電話する」
- 年が違う場合は「2026年4月1日」と年も表示
- `reflections` から同じ `q` かつ過去日付の最新1件を引くだけ。追加データ不要

## 2. データモデル変更

`localStorage` キー `life-timer-v1`、version 1 のまま後方互換追加。

```json
{
  "streak": { "last": "2026-07-09", "run": 7, "total": 23 },
  "reflections": [{ "date": "2026-07-09", "q": 12, "text": "母さんに電話する" }]
}
```

### 検証ルール(store.js)

| フィールド | 型 | 検証 | 省略時 |
|---|---|---|---|
| `data.streak` | object (optional) | `last`=日付文字列(YYYY-MM-DD)、`run`/`total`=正の整数、`run <= total` | `null` 扱い |
| `data.reflections` | array (optional) | 各要素: `date`=日付文字列、`q`=0以上の整数、`text`=非空文字列 | `[]` 扱い |

`emptyData()` は `streak: null, reflections: []` を含む。

## 3. ファイル変更マップ

| ファイル | 変更内容 |
|---|---|
| `src/questions.js` | **新規**。Questions.LIST(50問)+ indexFor(dateStr) |
| `src/store.js` | streak/reflections の検証 + advanceStreak 純関数 |
| `src/index.template.html` | streak行 + 問いカード + INJECT:QUESTIONS(scriptは7本に) |
| `build.js` | INJECTIONSにQUESTIONS追加(依存順: QUOTESの後) |
| `src/app.js` | streak更新/表示・問いカード描画・reflection保存・再会表示 |
| `src/style.css` | .streak-line / .question-card 系のスタイル |
| `test/questions.test.js` | **新規**。50問・重複なし・非空・indexForの決定論 |
| `test/store.test.js` | advanceStreak(4境界)+ 検証(正常・異常系) |
| `test/build.test.js` | script本数 6→**7** に更新 + 新要素ID存在確認 |

## 4. 非機能要件

- 追加コストゼロ(外部APIなし・通知サーバーなし)
- 既存localStorageデータを破壊しない(後方互換)
- 全テスト通過(82 → 95件前後)
- スマホ(375px)で崩れない
- 問い50問はオリジナル文のため出典裏取り不要(格言の規律とは区別する)
