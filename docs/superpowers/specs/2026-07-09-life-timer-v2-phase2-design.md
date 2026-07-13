# 人生タイマー v2 第2弾 設計ドキュメント

日付: 2026-07-09  
ステータス: 承認済み(ユーザー要件確認済み)  
前提: v2第1弾(格言バナー/見つめるタブ/今日の宣言)は公開済み。本書は第2弾3機能の追加。

## 1. 追加する機能

### ① 家族の続柄 → 残り日数表示

家族モデルに `relationship` フィールドを追加する。

| relationship値 | 表示内容 |
|---|---|
| `child` | 抱っこできる残り日数(〜6歳)・一緒に暮らせる残り日数(〜18歳) |
| `parent` / `spouse` | 「あと○回」を大きく強調(既存の meetCount 強調スタイル) |
| `sibling` / `friend` / `other` | 既存表示(あと○回)と同じ |

- **子どもの2マイルストーン**は固定値 6歳 / 18歳(カスタム化なし)
- 6歳を超えた子どもには「抱っこ」行を非表示にし「同居」のみ表示
- 18歳を超えた子どもには両行を非表示にし、通常の「あと○回」表示に切り替える
- `relationship` は任意フィールド。既存データはそのまま `'other'` 扱いで後方互換
- `meetFrequency` は全続柄で引き続き必須(子どもが18歳超で meetCount を使うため)

ダイアログに「続柄」セレクトを追加:
- その他 / 子ども / 親 / 配偶者・パートナー / 兄弟姉妹 / 友人

### ② 優先順位 + 夢ピン留め(「わたし」画面)

**夢ピン留め**:
- やりたいことに ★ ボタンを追加。クリックで「今の夢」に設定。
- 同時にピン留めできるのは1件のみ。別の ★ を押すと前のピンが外れる(トグル)。
- わたし画面のカウントダウン直下に「今の夢」セクションを表示。未ピン時は非表示。
- 達成済み(done)のやりたいことにはピン留めボタンを表示しない。

**優先順位**:
- 初期順位: 家族 / 仕事 / 自分 / 余暇 / 睡眠 の5項目固定。
- わたし画面の「今日の宣言」の下に配置。↑↓ボタンで並べ替え。
- 並べ替え結果を `data.priorities` に保存。未設定時はデフォルト順を使う。
- 「ふりかえり型」: これが今の自分の優先順位、と宣言する記録。強制なし。

### ③ Life in Weeks格子(「見つめる」タブ末尾)

- 見つめるタブの既存カード群と `insight-note` の後に追加する。
- 90年 × 52週 = **4680セル**のグリッドで人生を可視化。
- 左端が0歳第1週、右へ1週ずつ、52週で折り返し次の年へ。
- セル状態:
  - 過去(経過した週): オレンジ塗りつぶし
  - 現在(今週): オレンジ強調枠 + 輝き
  - 未来: 枠のみ(透明)
- セルサイズ: 5×5px, gap 1px → 幅約311px(375px画面に収まる)
- グリッドは誕生日変更時以外は再描画しない(初回のみDOM生成、以降はクラス更新)

## 2. データモデル変更

`localStorage` キー `life-timer-v1` 据え置き(バージョン1のまま後方互換追加)。

```json
{
  "version": 1,
  "self": { ... },
  "family": [
    {
      "id": "...", "name": "太郎", "birthDate": "2020-01-01",
      "gender": "male", "customLifespan": null,
      "meetFrequency": "daily",
      "relationship": "child"
    }
  ],
  "wishes": [
    {
      "id": "...", "title": "富士山に登る",
      "done": false, "createdAt": "2026-07-01", "doneAt": null,
      "targetAge": null,
      "pinned": false
    }
  ],
  "today": { ... },
  "priorities": ["家族", "仕事", "自分", "余暇", "睡眠"]
}
```

### 追加フィールドの検証ルール

| フィールド | 型 | 許容値 | 省略時 |
|---|---|---|---|
| `family[].relationship` | string (optional) | `child\|parent\|spouse\|sibling\|friend\|other` | `'other'` 扱い |
| `wishes[].pinned` | boolean (optional) | `true\|false` | `false` 扱い |
| `data.priorities` | string[] (optional) | 5項目 `['家族','仕事','自分','余暇','睡眠']` の並べ替え | デフォルト順 |

## 3. ファイル変更マップ

| ファイル | 変更内容 |
|---|---|
| `src/store.js` | relationship/pinned/priorities の検証追加 |
| `src/time-calc.js` | `childRemainingDays(birthDate, targetAge, now)` 追加 |
| `src/index.template.html` | 今の夢セクション・優先順位セクション・fam-relation・★ボタン・weeks-grid追加 |
| `src/app.js` | renderWishes/renderFamily/renderSelf/renderWeeks の更新・新規ハンドラ追加 |
| `src/style.css` | 上記UI要素のスタイル追加 |
| `test/store.test.js` | 新フィールドのテスト追加(6件) |
| `test/time-calc.test.js` | childRemainingDays のテスト追加(3件) |
| `test/build.test.js` | 新HTML要素の存在確認追加(3件) |

## 4. 非機能要件

- 追加コストゼロ(外部APIなし)
- ビルドモジュール数は6のまま(新しい .js ファイルは作らない)
- 全テスト通過(67 → 79 件目標)
- 既存localStorage データを破壊しない(後方互換)
- スマホ(375px)で幅が収まること
