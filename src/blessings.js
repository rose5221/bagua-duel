/* 天时 · 福缘 / 妙计
   一次对局 = 一个季节；开局三囊选一。四季轮转，24 节气各有一只锦囊。
   所有效果由 engine.js 的 blessing 钩子执行。 */
(function () {
  'use strict';

  const SEASONS = {
    spring: { name: '春', element: 'wood', startMonth: 1, terms: ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨'] },
    summer: { name: '夏', element: 'fire', startMonth: 4, terms: ['立夏', '小满', '芒种', '夏至', '小暑', '大暑'] },
    autumn: { name: '秋', element: 'metal', startMonth: 7, terms: ['立秋', '处暑', '白露', '秋分', '寒露', '霜降'] },
    winter: { name: '冬', element: 'water', startMonth: 10, terms: ['立冬', '小雪', '大雪', '冬至', '小寒', '大寒'] },
  };
  const ORDER = ['spring', 'summer', 'autumn', 'winter'];

  const LIST = [
    // 春
    { key: 's_lichun', season: 'spring', term: '立春', name: '青牛衔春', shape: 'gourd', cat: 'growth',
      text: '本局第一张入场牌 +3 攻 / +6 血；落后时改为 +5 / +9。',
      desc: '青牛踏春，第一张落下的牌获得成长；己方场上人数少于敌方时效果增强。' },
    { key: 's_yushui', season: 'spring', term: '雨水', name: '润物无声', shape: 'umbrella', cat: 'steady',
      text: '每轮开始，生命最低的己方单位回复 3；低于 50% 时再得 2 护盾。',
      desc: '油纸伞下的春雨，持续照顾最残血的那个人。' },
    { key: 's_jingzhe', season: 'spring', term: '惊蛰', name: '惊雷', shape: 'bell', cat: 'attack',
      text: '每轮第一次攻击 +2 伤；目标满血时再 +2。',
      desc: '春雷唤醒百虫，第一击最响。' },
    { key: 's_chunfen', season: 'spring', term: '春分', name: '剪春', shape: 'swallow', cat: 'tempo',
      text: '每轮第一次移动不消耗行动。',
      desc: '燕尾剪开春风，走位不再占用本回合的行动。' },
    { key: 's_qingming', season: 'spring', term: '清明', name: '留春', shape: 'kite', cat: 'comeback',
      text: '本局第一次己方阵亡时，全体回复 5；落后时回复 8。',
      desc: '纸鸢断线之前，春天会替你再撑一会儿。' },
    { key: 's_guyu', season: 'spring', term: '谷雨', name: '新芽', shape: 'leaf', cat: 'steady',
      text: '每轮第一次落子后，该牌回复 4 并得 1 护盾。',
      desc: '谷雨之后，新落下的牌先扎根再打仗。' },

    // 夏
    { key: 's_lixia', season: 'summer', term: '立夏', name: '榴火', shape: 'pomegranate', cat: 'attack',
      text: '每轮首次攻击 +2 伤；敌方场上 ≥2 人时再 +2。',
      desc: '石榴裂开，夏天第一团火。' },
    { key: 's_xiaoman', season: 'summer', term: '小满', name: '满仓', shape: 'wheat', cat: 'comeback',
      text: '每轮首次攻击 +2；己方场上少于敌方时，改为 +3。',
      desc: '麦穗低头，是在替落后的人攒一口气。' },
    { key: 's_mangzhong', season: 'summer', term: '芒种', name: '连镰', shape: 'sickle', cat: 'attack',
      text: '击杀后，对相邻敌人造成 2 伤（每轮一次）。',
      desc: '一镰割下，锋刃顺势扫向旁边的敌人。' },
    { key: 's_xiazhi', season: 'summer', term: '夏至', name: '昼极', shape: 'sun', cat: 'skill',
      text: '每轮第一次技能使目标本回合 +2 攻；匹配 2 项时 +4。',
      desc: '白昼最长的一天，技能的光也最盛。' },
    { key: 's_xiaoshu', season: 'summer', term: '小暑', name: '蝉鸣', shape: 'cicada', cat: 'attack',
      text: '己方攻击 30% 追加 1 真实伤害；敌方满员时 50%。',
      desc: '蝉声不停，伤害在盾后继续响。' },
    { key: 's_dashu', season: 'summer', term: '大暑', name: '流火', shape: 'flame', cat: 'comeback',
      text: '每轮开始随机敌人 1 层灼烧；落后时改为两名敌人。',
      desc: '大暑的火不认人，但更愿意烧向人多的一方。' },

    // 秋
    { key: 's_liqiu', season: 'autumn', term: '立秋', name: '一叶', shape: 'wutong', cat: 'attack',
      text: '每轮首次攻击无视护盾；目标生命低于 50% 时再 +2。',
      desc: '一叶知秋，第一击穿过所有遮挡。' },
    { key: 's_chushu', season: 'autumn', term: '处暑', name: '归雁', shape: 'goose', cat: 'steady',
      text: '每轮第一次击杀后，己方全体回复 2。',
      desc: '雁阵回时，给活着的人留一口气。' },
    { key: 's_bailu', season: 'autumn', term: '白露', name: '霜刃', shape: 'blade', cat: 'attack',
      text: '每轮首次攻击，若目标本回合未行动 +3 伤；已行动则 +1。',
      desc: '露水未干时出刃，最利。' },
    { key: 's_qiufen', season: 'autumn', term: '秋分', name: '秤星', shape: 'scale', cat: 'comeback',
      text: '每轮首次攻击，若己方总生命低于敌方 +2 伤并获得 2 护盾。',
      desc: '秋分称量轻重，落后的一方多得到一点公道。' },
    { key: 's_hanlu', season: 'autumn', term: '寒露', name: '冷月', shape: 'moon', cat: 'steady',
      text: '敌方每轮第一次攻击伤害 -2；己方场上少于敌方时 -4。',
      desc: '冷月照在刀锋上，第一刀总会慢一点。' },
    { key: 's_shuangjiang', season: 'autumn', term: '霜降', name: '霜花', shape: 'frost', cat: 'steady',
      text: '每轮第一次受击后，攻击者下次攻击 -2（不叠加）。',
      desc: '霜结在甲上，下一刀会打滑。' },

    // 冬
    { key: 's_lidong', season: 'winter', term: '立冬', name: '藏冬', shape: 'ice', cat: 'steady',
      text: '本局第一张入场牌获得 5 护盾；落后时 8。',
      desc: '入冬第一件事，是先把门关上。' },
    { key: 's_xiaoxue', season: 'winter', term: '小雪', name: '雪纹', shape: 'snow', cat: 'steady',
      text: '每轮开始，己方全体 +1 护盾。',
      desc: '小雪一层层落，最后也是一床被子。' },
    { key: 's_daxue', season: 'winter', term: '大雪', name: '封山', shape: 'mountain', cat: 'control',
      text: '每轮敌方第一次移动后，该敌人本回合攻击 -2。',
      desc: '大雪封路，走得越远，刀越慢。' },
    { key: 's_dongzhi', season: 'winter', term: '冬至', name: '长夜', shape: 'night', cat: 'comeback',
      text: '本局第一次己方阵亡时，若落后，该牌以 1 血留在原席；否则全体回复 4。',
      desc: '最长的一夜，留一盏灯给还没走的人。' },
    { key: 's_xiaohan', season: 'winter', term: '小寒', name: '寒梅', shape: 'plum', cat: 'steady',
      text: '每轮开始，生命最低的己方回复 2；低于 30% 再得 3 护盾。',
      desc: '天越冷，梅越不肯落。' },
    { key: 's_dahan', season: 'winter', term: '大寒', name: '岁终', shape: 'bell', cat: 'comeback',
      text: '己方场上仅 1 张时，该牌攻击 +4。',
      desc: '一年最后一天，最后一盏灯反而最亮。' },
  ];

  const TRICKS = {
    spring: { key: 't_spring', kind: 'trick', season: 'spring', term: '立春', name: '借东风', shape: 'swallow', cat: 'trick',
      text: '本季一次：把一名敌人推到相邻空位；没有空位则对其造成 2 伤。',
      desc: '借一阵东风，把对面的阵型吹乱。' },
    summer: { key: 't_summer', kind: 'trick', season: 'summer', term: '大暑', name: '火中取栗', shape: 'flame', cat: 'trick',
      text: '本季一次：选一名已灼烧的敌人，把灼烧复制给另一名敌人；没有目标则追加 2 火伤。',
      desc: '从火里取栗子，手要快。' },
    autumn: { key: 't_autumn', kind: 'trick', season: 'autumn', term: '霜降', name: '移花接木', shape: 'scale', cat: 'trick',
      text: '本季一次：交换场上任意两张牌的卦位，不触发入场加成。',
      desc: '把花接到另一棵枝上，让对面认不出自己的阵。' },
    winter: { key: 't_winter', kind: 'trick', season: 'winter', term: '冬至', name: '金蝉脱壳', shape: 'cicada', cat: 'trick',
      text: '本季第一次己方阵亡时：该牌以 1 血回手，原卦位留下 1 血壳，壳可被击破。',
      desc: '蝉蜕留在枝上，真人已经走了。' },
  };

  const SEASON_ART = {
    spring: 'assets/pixel/pouches/spring_peach.png?v=20261023ao',
    summer: 'assets/pixel/pouches/summer_lotus.png?v=20261023ao',
    autumn: 'assets/pixel/pouches/autumn_chrys.png?v=20261023ao',
    winter: 'assets/pixel/pouches/winter_snow.png?v=20261023ao',
  };
  const TRICK_ART = {
    spring: 'assets/pixel/pouches/trick_spring.png?v=20261023ao',
    summer: 'assets/pixel/pouches/trick_summer.png?v=20261023ao',
    autumn: 'assets/pixel/pouches/trick_autumn.png?v=20261023ao',
    winter: 'assets/pixel/pouches/trick_winter.png?v=20261023ao',
  };

  const BY_KEY = {};
  for (const b of LIST) BY_KEY[b.key] = b;
  for (const k of ORDER) BY_KEY[TRICKS[k].key] = TRICKS[k];

  function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function seasonForRound(round) { return ORDER[(Math.max(1, round) - 1) % 4]; }
  function startMonth(season) { return (SEASONS[season] || SEASONS.spring).startMonth; }
  function seasonName(season) { return (SEASONS[season] || SEASONS.spring).name; }
  function pool(season) { return LIST.filter(b => b.season === season); }

  // 每季 3 选 1；独立 1/6 机会以妙计替换其中一枚。
  function draw(season, allowTrick) {
    const p = shuffle(pool(season));
    const options = p.slice(0, 3).map(x => Object.assign({ kind: 'bless', art: SEASON_ART[season] }, x));
    let trick = false;
    if (allowTrick !== false && Math.random() < 1 / 6) {
      const t = Object.assign({}, TRICKS[season], { art: TRICK_ART[season] });
      options[Math.floor(Math.random() * options.length)] = t;
      trick = true;
    }
    // 至少有一枚“逆境/稳定”选项；否则把最后一枚换成该季最稳的一张。
    const hasAnchor = options.some(x => x.cat === 'comeback' || x.cat === 'steady' || x.kind === 'trick');
    if (!hasAnchor) {
      const fallback = p.find(x => x.cat === 'comeback') || p.find(x => x.cat === 'steady') || p[0];
      options[2] = Object.assign({ kind: 'bless', art: SEASON_ART[season] }, fallback);
    }
    return { season, options, trick };
  }

  window.Blessings = {
    SEASONS, ORDER, LIST, TRICKS, BY_KEY, SEASON_ART, TRICK_ART,
    seasonForRound, startMonth, seasonName, pool, draw,
  };
})();
