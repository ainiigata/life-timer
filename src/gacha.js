/* 人生タイマー ガチャ — 毎日1回のお題排出・レベルシステム */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Gacha = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // レア度定義: prob=累積確率閾値(小さい方から引く), xp=クリア獲得XP
  const RARITY = {
    SSR: { prob: 0.03, xp: 30, label: 'SSR' },
    SR:  { prob: 0.15, xp: 10, label: 'SR' },
    R:   { prob: 0.40, xp: 3,  label: 'R' },
    N:   { prob: 1.00, xp: 1,  label: 'N' },
  };

  const CHALLENGES = [
    // ── N (60%) ── 即日・1〜10分でできること
    { id: 'n01', rarity: 'N', text: '今日、水を5杯飲む' },
    { id: 'n02', rarity: 'N', text: '誰かに「ありがとう」と言う' },
    { id: 'n03', rarity: 'N', text: '深呼吸を10回する' },
    { id: 'n04', rarity: 'N', text: '窓を開けて外の空気を吸う' },
    { id: 'n05', rarity: 'N', text: 'スマホを置いて空を1分見る' },
    { id: 'n06', rarity: 'N', text: '今日の食事をゆっくり味わって食べる' },
    { id: 'n07', rarity: 'N', text: '出会った人に笑顔で挨拶する' },
    { id: 'n08', rarity: 'N', text: '不要なものを1つ捨てる' },
    { id: 'n09', rarity: 'N', text: '今日の気分を一言で表してみる' },
    { id: 'n10', rarity: 'N', text: '好きな音楽を1曲フルで聴く' },
    { id: 'n11', rarity: 'N', text: '5分間、何もしない時間を作る' },
    { id: 'n12', rarity: 'N', text: '今日の良かったことを1つ思い出す' },
    { id: 'n13', rarity: 'N', text: '靴を揃えて置く' },
    { id: 'n14', rarity: 'N', text: '寝る前に5分だけ本を読む' },
    { id: 'n15', rarity: 'N', text: '1回の食事をスマホなしで食べる' },
    { id: 'n16', rarity: 'N', text: '誰かに「お疲れ様」と声をかける' },
    { id: 'n17', rarity: 'N', text: '今日の空の色を覚えておく' },
    { id: 'n18', rarity: 'N', text: '手を30秒丁寧に洗う' },
    { id: 'n19', rarity: 'N', text: '使っていないアプリを1つ削除する' },
    { id: 'n20', rarity: 'N', text: '大きな声で返事をする' },
    { id: 'n21', rarity: 'N', text: '朝一番にコップ1杯の水を飲む' },
    { id: 'n22', rarity: 'N', text: '今日の日付を手書きする' },
    { id: 'n23', rarity: 'N', text: '背筋を伸ばして1分座る' },
    { id: 'n24', rarity: 'N', text: '今夜の寝る時間を決める' },
    { id: 'n25', rarity: 'N', text: '誰かのために少しだけ道をあける' },
    { id: 'n26', rarity: 'N', text: '明日の服を今日決めておく' },
    { id: 'n27', rarity: 'N', text: '1分間だけ目を閉じて静かにする' },
    { id: 'n28', rarity: 'N', text: '今日会った人を心の中で1人褒める' },
    { id: 'n29', rarity: 'N', text: '体にいいものを食事で1つ選ぶ' },
    { id: 'n30', rarity: 'N', text: '今日の「よし、やろう」を1つ決める' },

    // ── R (25%) ── 30分〜1時間の行動
    { id: 'r01', rarity: 'R', text: '30分読書する' },
    { id: 'r02', rarity: 'R', text: '先延ばしにしていることを1つ片付ける' },
    { id: 'r03', rarity: 'R', text: '日記を3行書く' },
    { id: 'r04', rarity: 'R', text: '20分運動する' },
    { id: 'r05', rarity: 'R', text: '料理を1品自分で作る' },
    { id: 'r06', rarity: 'R', text: '苦手な人に自分から話しかける' },
    { id: 'r07', rarity: 'R', text: 'いつもと違う道を通って帰る' },
    { id: 'r08', rarity: 'R', text: '今月の出費を見直す' },
    { id: 'r09', rarity: 'R', text: '学びたいことを30分だけ調べる' },
    { id: 'r10', rarity: 'R', text: '部屋の一角を徹底的に片付ける' },
    { id: 'r11', rarity: 'R', text: '久しぶりの友人に連絡する' },
    { id: 'r12', rarity: 'R', text: '自分の長所を3つ書き出す' },
    { id: 'r13', rarity: 'R', text: '今日の学びをひと言メモに残す' },
    { id: 'r14', rarity: 'R', text: 'ストレッチを15分する' },
    { id: 'r15', rarity: 'R', text: '昔の写真を見返す' },
    { id: 'r16', rarity: 'R', text: '今年の目標を見直す' },
    { id: 'r17', rarity: 'R', text: '気になっていた本を1冊調べて候補に入れる' },
    { id: 'r18', rarity: 'R', text: '散歩しながら普段気づかないものを3つ見つける' },
    { id: 'r19', rarity: 'R', text: 'やめたいことを1つ書き出して理由を考える' },
    { id: 'r20', rarity: 'R', text: '「もったいない」と感じているものを1つ手放す' },

    // ── SR (12%) ── 今日1日かけてやること
    { id: 'sr01', rarity: 'SR', text: '大切な人に電話して近況を話す' },
    { id: 'sr02', rarity: 'SR', text: 'やりたいことを10個紙に書き出す' },
    { id: 'sr03', rarity: 'SR', text: '今日だけSNSを開かない' },
    { id: 'sr04', rarity: 'SR', text: '頼まれていないのに誰かのために何かをする' },
    { id: 'sr05', rarity: 'SR', text: '苦手なことに1時間だけ向き合う' },
    { id: 'sr06', rarity: 'SR', text: '誰かに本音を話す' },
    { id: 'sr07', rarity: 'SR', text: '何でもいいので新しいことに挑戦する' },
    { id: 'sr08', rarity: 'SR', text: '今日の全食事を自炊する' },
    { id: 'sr09', rarity: 'SR', text: '誰かに手書きのメモか手紙を渡す' },
    { id: 'sr10', rarity: 'SR', text: '1時間、スマホを別の部屋に置く' },
    { id: 'sr11', rarity: 'SR', text: '運動を1時間続ける' },
    { id: 'sr12', rarity: 'SR', text: '今日だけ、不満を口に出さない' },
    { id: 'sr13', rarity: 'SR', text: 'ずっと会いたかった人に連絡する' },
    { id: 'sr14', rarity: 'SR', text: '寝る前に今日の感謝を5つ書く' },
    { id: 'sr15', rarity: 'SR', text: '1日の振り返りをノートにびっしり書く' },

    // ── SSR (3%) ── 人生レベルで意味がある
    { id: 'ssr01', rarity: 'SSR', text: '今日だけスマホを6時間以上置いてみる' },
    { id: 'ssr02', rarity: 'SSR', text: '人生の目標を書き直す・見直す' },
    { id: 'ssr03', rarity: 'SSR', text: 'ずっと謝れていなかった人に連絡する' },
    { id: 'ssr04', rarity: 'SSR', text: '子どもの頃の夢を思い出して今の自分と比べてみる' },
    { id: 'ssr05', rarity: 'SSR', text: '今日が人生最後の日だとしたら何をするか紙に書き出す' },
  ];

  // レア度に基づいてランダムに1件引く
  function pull() {
    const r = Math.random();
    let rarity;
    if (r < RARITY.SSR.prob) rarity = 'SSR';
    else if (r < RARITY.SR.prob) rarity = 'SR';
    else if (r < RARITY.R.prob) rarity = 'R';
    else rarity = 'N';

    const pool = CHALLENGES.filter((c) => c.rarity === rarity);
    const picked = pool[Math.floor(Math.random() * pool.length)];
    return { id: picked.id, rarity: picked.rarity, text: picked.text, xp: RARITY[rarity].xp };
  }

  // 累積XP→{level, xpInLevel, xpNeeded}
  // 閾値: Lv1→2=10, Lv2→3=20, Lv3→4=30 … (各レベルで10ずつ増える)
  function levelFromXp(totalXp) {
    let level = 1;
    let xpNeeded = 10;
    let accumulated = 0;
    while (totalXp >= accumulated + xpNeeded) {
      accumulated += xpNeeded;
      level++;
      xpNeeded = 10 * level;
    }
    return { level, xpInLevel: totalXp - accumulated, xpNeeded };
  }

  return { CHALLENGES, RARITY, pull, levelFromXp };
});
