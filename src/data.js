/* 八卦对决 · 数据层 v2
   8 属性 × 8 家庭成员 = 64 张人物牌；每人 2 属性 × 各 4 张 = 8 张。
   8 件武器、8 张技能、卦位场地效果。 */
(function () {
  'use strict';

  const ELEMENTS = {
    metal: { key: 'metal', name: '金', color: '#C2A24C', light: '#DCC27C', gen: 'water', over: 'wood' },
    wood:  { key: 'wood',  name: '木', color: '#5B7A4B', light: '#86A574', gen: 'fire',  over: 'earth' },
    water: { key: 'water', name: '水', color: '#3F6E7A', light: '#6E9BA6', gen: 'wood',  over: 'fire' },
    fire:  { key: 'fire',  name: '火', color: '#B4472F', light: '#D67B62', gen: 'earth', over: 'metal' },
    earth: { key: 'earth', name: '土', color: '#A97B4A', light: '#C9A171', gen: 'metal', over: 'water' },
  };

  // 后天八卦环序：正上（南）→ 顺时针
  const RING = ['li', 'xun', 'zhen', 'gen', 'kan', 'qian', 'dui', 'kun'];

  const TRIGRAMS = {
    qian: { key: 'qian', name: '乾', sym: '☰', dir: '西北', element: 'metal', attr: '天', role: '夫',   skill: '刚健' },
    dui:  { key: 'dui',  name: '兑', sym: '☱', dir: '西',   element: 'metal', attr: '泽', role: '少女', skill: '口舌' },
    li:   { key: 'li',   name: '离', sym: '☲', dir: '南',   element: 'fire',  attr: '火', role: '中女', skill: '光明' },
    zhen: { key: 'zhen', name: '震', sym: '☳', dir: '东',   element: 'wood',  attr: '雷', role: '长男', skill: '动' },
    xun:  { key: 'xun',  name: '巽', sym: '☴', dir: '东南', element: 'wood',  attr: '风', role: '长女', skill: '入' },
    kan:  { key: 'kan',  name: '坎', sym: '☵', dir: '北',   element: 'water', attr: '水', role: '中男', skill: '险' },
    gen:  { key: 'gen',  name: '艮', sym: '☶', dir: '东北', element: 'earth', attr: '山', role: '少男', skill: '止' },
    kun:  { key: 'kun',  name: '坤', sym: '☷', dir: '西南', element: 'earth', attr: '地', role: '母',   skill: '承载' },
  };

  const ATTRS = [
    { key: 'qian', name: '天', sym: '☰', element: 'metal', trigram: 'qian' },
    { key: 'dui',  name: '泽', sym: '☱', element: 'metal', trigram: 'dui' },
    { key: 'li',   name: '火', sym: '☲', element: 'fire',  trigram: 'li' },
    { key: 'zhen', name: '雷', sym: '☳', element: 'wood',  trigram: 'zhen' },
    { key: 'xun',  name: '风', sym: '☴', element: 'wood',  trigram: 'xun' },
    { key: 'kan',  name: '水', sym: '☵', element: 'water', trigram: 'kan' },
    { key: 'gen',  name: '山', sym: '☶', element: 'earth', trigram: 'gen' },
    { key: 'kun',  name: '地', sym: '☷', element: 'earth', trigram: 'kun' },
  ];

  // 基础血量为攻击的约 3 倍
  const ROLES = [
    { key: 'fu',       name: '夫',   trigram: 'qian', element: 'metal', atk: 10, hp: 30, line: '一家之主，刚健。' },
    { key: 'shaonv',   name: '少女', trigram: 'dui',  element: 'metal', atk: 7,  hp: 24, line: '兑之少女，口舌。' },
    { key: 'zhongnv',  name: '中女', trigram: 'li',   element: 'fire',  atk: 9,  hp: 27, line: '离之中女，光明。' },
    { key: 'changnv',  name: '长女', trigram: 'xun',  element: 'wood',  atk: 8,  hp: 26, line: '巽之长女，入。' },
    { key: 'shaonan',  name: '少男', trigram: 'gen',  element: 'earth', atk: 8,  hp: 30, line: '艮之少男，止。' },
    { key: 'zhongnan', name: '中男', trigram: 'kan',  element: 'water', atk: 9,  hp: 30, line: '坎之中男，险。' },
    { key: 'changnan', name: '长男', trigram: 'zhen', element: 'wood',  atk: 11, hp: 27, line: '震之长男，动。' },
    { key: 'mu',       name: '母',   trigram: 'kun',  element: 'earth', atk: 6,  hp: 36, line: '坤之母，承载。' },
  ];
  const ROLE_BY_KEY = Object.fromEntries(ROLES.map(r => [r.key, r]));
  const ATTR_BY_KEY = Object.fromEntries(ATTRS.map(a => [a.key, a]));

  const CARDS = {};
  for (const a of ATTRS) {
    for (const r of ROLES) {
      const id = a.key + '-' + r.key;
      CARDS[id] = {
        id,
        attrKey: a.key, attr: a.name, sym: a.sym,
        roleKey: r.key, role: r.name,
        element: a.element, roleElement: r.element,
        atk: r.atk, hp: r.hp,
        name: a.name + '·' + r.name,
        line: r.line,
      };
    }
  }

  // 8 件武器；武器生命不参与险的倍增/减半
  const WEAPONS = [
    { key: 'dao',    name: '刀',   type: 'melee',  atk: 4,  hp: 0,  range: 1, shield: 0, desc: '近战 · 攻 +4。' },
    { key: 'jian',   name: '剑',   type: 'melee',  atk: 3,  hp: 4,  range: 1, shield: 0, desc: '近战 · 攻 +3，生命 +4。' },
    { key: 'fu',     name: '斧',   type: 'melee',  atk: 6,  hp: -6, range: 1, shield: 0, desc: '近战 · 攻 +6，生命 -6。' },
    { key: 'qiang',  name: '长枪', type: 'melee',  atk: 3,  hp: 0,  range: 2, shield: 0, spear: true, desc: '近战 · 攻 +3，可打距离 2；攻击一次后销毁。' },
    { key: 'tiedun', name: '铁盾', type: 'shield', atk: -2, hp: 6,  range: 1, shield: 4, desc: '盾 · 攻 -2，生命 +6，每回合刷新 4 护盾。' },
    { key: 'gangdun',name: '钢盾', type: 'shield', atk: 0,  hp: 2,  range: 1, shield: 3, desc: '盾 · 生命 +2，每回合刷新 3 护盾。' },
    { key: 'gong',   name: '弓',   type: 'ranged', atk: 1,  hp: 0,  range: 2, shield: 0, desc: '远程 · 攻 +1，攻击距离 2。' },
    { key: 'nu',     name: '弩',   type: 'ranged', atk: 2,  hp: -3, range: 2, shield: 0, desc: '远程 · 攻 +2，生命 -3，攻击距离 2。' },
  ];
  const WEAPON_BY_KEY = Object.fromEntries(WEAPONS.map(w => [w.key, w]));

  // 每张技能整局 2 次；每回合最多 2 张且不可重复
  const SKILLS = [
    { key: 'gangjian', name: '刚健', trigram: 'qian', element: 'metal', attr: '天', role: '夫', uses: 2,
      desc: '目标 +4 攻/+8 血；若为天或父，每命中一项再 +2 攻/+4 血（可叠加）。' },
    { key: 'koushe', name: '口舌', trigram: 'dui', element: 'metal', attr: '泽', role: '少女', uses: 2,
      desc: '目标 +4 攻；若为泽或少女，每命中一项再 +2 攻。' },
    { key: 'guangming', name: '光明', trigram: 'li', element: 'fire', attr: '火', role: '中女', uses: 2,
      desc: '目标及邻位友军 +4 血，可超过生命上限形成灵光血；若为火或中女，命中一项目标再 +4 血，两项则目标及邻位再 +4 血。' },
    { key: 'dong', name: '动', trigram: 'zhen', element: 'wood', attr: '雷', role: '长男', uses: 2,
      desc: '目标额外行动一次；若为雷或长男，每命中一项再 +1 行动；两项时再选一个邻位友军 +1 行动。' },
    { key: 'ru', name: '入', trigram: 'xun', element: 'wood', attr: '风', role: '长女', uses: 2,
      desc: '目标下次攻击伤害翻倍；若为风或长女，一项则接下来两次翻倍，两项则接下来两次翻 3 倍。' },
    { key: 'xian', name: '险', trigram: 'kan', element: 'water', attr: '水', role: '中男', uses: 2,
      desc: '目标攻击翻倍，生命减半（武器生命不计）；若为水或中男，一项免去减半，两项则攻击与生命都翻倍。' },
    { key: 'zhi', name: '止', trigram: 'gen', element: 'earth', attr: '山', role: '少男', uses: 2,
      desc: '令目标范围内一名敌人下次攻击失效 3 回合；若为山或少男，一项另禁技能 3 回合，两项延至 5 回合，攻击后失效。' },
    { key: 'chengzai', name: '承载', trigram: 'kun', element: 'earth', attr: '地', role: '母', uses: 2,
      desc: '目标装备回手，再选一件装备换上；若为地或母，一项保留原装备攻/血加成，两项保留并去掉新装备减益。' },
  ];
  const SKILL_BY_KEY = Object.fromEntries(SKILLS.map(s => [s.key, s]));

  // 场地效果（每轮开始触发；按“卦位元素 vs 牌元素”）
  const FIELD_RULES = [
    { el: 'metal', gen: '本回合造成伤害 +1', equal: '本回合造成伤害 +1', over: '本回合造成伤害 -1' },
    { el: 'wood',  gen: '本回合回复 1 血',   equal: '本回合造成伤害 +1', over: '无' },
    { el: 'water', gen: '本回合获得 2 临时护盾', equal: '本回合造成伤害 +1', over: '无' },
    { el: 'fire',  gen: '攻击附加灼烧（2 回合）', equal: '本回合造成伤害 +1', over: '自身获得灼烧' },
    { el: 'earth', gen: '本回合受到伤害 -1', equal: '本回合造成伤害 +1', over: '本回合受到伤害 +1' },
  ];

  const DIFFICULTY = [
    { key: 'easy', name: '简单', desc: 'AI 行动随机，技能很少用。' },
    { key: 'normal', name: '普通', desc: 'AI 会找击杀、落子加成和基础技能。' },
    { key: 'hard', name: '困难', desc: 'AI 会优先击杀、卡位、连招和保留关键技能。' },
  ];

  const TERMS = [
    { name: '立春', zhong: '雨水', element: 'wood' }, { name: '惊蛰', zhong: '春分', element: 'wood' },
    { name: '清明', zhong: '谷雨', element: 'earth' }, { name: '立夏', zhong: '小满', element: 'fire' },
    { name: '芒种', zhong: '夏至', element: 'fire' }, { name: '小暑', zhong: '大暑', element: 'earth' },
    { name: '立秋', zhong: '处暑', element: 'metal' }, { name: '白露', zhong: '秋分', element: 'metal' },
    { name: '寒露', zhong: '霜降', element: 'earth' }, { name: '立冬', zhong: '小雪', element: 'water' },
    { name: '大雪', zhong: '冬至', element: 'water' }, { name: '小寒', zhong: '大寒', element: 'earth' },
  ];
  const SEATS = {
    N: { label: '北', facing: '南', zhi: '子', toward: '午', text: '坐北朝南（位子向午）' },
    S: { label: '南', facing: '北', zhi: '午', toward: '子', text: '坐南朝北（位午向子）' },
  };

  // 立绘：assets/art/cards/<属性>-<角色>.webp（由即梦导出图按 id 归位）
  const ART_ROOT = 'assets/art/cards/';

  // 图缺失时的兜底：程序化剪影
  function portraitSvgHtml(card, w, h, cls) {
    const ec = ELEMENTS[card.roleElement] || ELEMENTS.metal;
    const ac = ELEMENTS[card.element] || ELEMENTS.metal;
    const hat = { fu: 0, shaonv: 1, zhongnv: 2, changnv: 3, shaonan: 4, zhongnan: 5, changnan: 6, mu: 7 }[card.roleKey] || 0;
    const head = hat === 0 ? 'M22 18 h20 v16 h-20 z' : hat === 7 ? 'M20 20 h24 v15 h-24 z' : 'M23 21 h18 v14 h-18 z';
    return `<svg class="${cls || ''}" viewBox="0 0 64 64" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" aria-label="${card.name}">
      <rect x="1" y="1" width="62" height="62" fill="#F7F3E8" stroke="#2B3033"/>
      <rect x="4" y="4" width="56" height="56" fill="${ac.color}" opacity=".10"/>
      <text x="32" y="21" text-anchor="middle" font-size="13" fill="${ac.color}" font-family="serif">${card.sym}</text>
      <g fill="#17191B">
        <path d="M14 56 c2-10 8-14 18-14 s16 4 18 14 z"/>
        <path d="M26 34 h12 v7 h-12 z"/>
        <path d="${head}"/>
        <path d="M18 18 h28 v3 h-28 z" fill="${ec.color}"/>
      </g>
      <rect x="20" y="26" width="6" height="2" fill="${ac.key === 'fire' ? '#F7F3E8' : '#17191B'}"/>
      <rect x="38" y="26" width="6" height="2" fill="${ac.key === 'fire' ? '#F7F3E8' : '#17191B'}"/>
      <text x="32" y="49" text-anchor="middle" font-size="10" fill="#F7F3E8" font-family="serif">${card.role}</text>
      <text x="32" y="60" text-anchor="middle" font-size="7" fill="${ac.color}" font-family="monospace">${card.attr}</text>
    </svg>`;
  }

  function portraitHtml(card, w, h, cls) {
    return `<img class="portrait ${cls || ''}" src="${ART_ROOT}${card.id}.webp"
      width="${w}" height="${h}" alt="${card.name}" loading="lazy" decoding="async"
      data-cid="${card.id}" onerror="this.onerror=null;window.DATA.portraitFallback(this)">`;
  }

  function portraitFallback(img) {
    const card = CARDS[img.dataset.cid];
    if (!card) return;
    const w = +img.getAttribute('width') || 30;
    const h = +img.getAttribute('height') || 34;
    img.outerHTML = portraitSvgHtml(card, w, h, (img.className || '').replace('portrait', '').trim());
  }

  // 角色：道童 / 清风 / 旁门开局可选；痴儿需道童连续三次卜出老阴
  const CHARACTERS = [
    {
      key: 'daotong', name: '道童', tag: '默认', open: true,
      desc: '求签 · 卜卦', passive: '无被动',
      skills: ['sign', 'divine'],
    },
    {
      key: 'qingfeng', name: '清风道长', tag: '可选', open: true,
      desc: '化身 · 分身', passive: '三魂七魄化身',
      skills: ['avatar', 'clone'],
    },
    {
      key: 'pangmen', name: '旁门道人', tag: '可选', open: true,
      desc: '夺魄 · 炼魂', passive: '炼魂：己方全体每回合 +1 攻 / -2 血',
      skills: ['seize'],
    },
    {
      key: 'chier', name: '痴儿', tag: '未解锁', open: false,
      desc: '痴傻 · 蠢笨 · 愚痴 · 愚钝 · 痴戾', passive: '五重痴相',
      skills: [],
    },
  ];

  const CHAR_SKILLS = {
    sign: {
      name: '求签', limit: '每回合一次',
      desc: '系统按双方场面与气场判签：上上 / 上吉 / 中吉 / 中平 / 下下。对手只见你求签，不见签文。',
    },
    divine: {
      name: '卜卦', limit: '每回合一次',
      desc: '掷三枚铜钱。三背为老阳：敌方全体 -2 攻 / -2 血；三字为老阴：己方全体 -1 攻 / -1 血；少阳、少阴无事。',
    },
    avatar: {
      name: '化身', limit: '每局一次',
      desc: '选天地人三魂之一入场，不占 3 张上限，木属性 20 攻/40 血；与分身不可同时在场。化身阵亡会失去该魂。',
    },
    clone: {
      name: '分身', limit: '每局一次',
      desc: '选七魄之一入场，受 3 张上限，金属性 20 攻/30 血；与化身不可同时在场。分身阵亡后该魄转伪。',
    },
    seize: {
      name: '夺魄', limit: '胜利结算',
      desc: '胜利结算时，若己方场上仍有 3 张牌，可夺取敌方一魄炼为伪魄；对局中不直接使用。',
    },
  };

  const HUNS = [
    { key: 'tian', name: '天魂', full: '天魂·胎光', effect: '化身：入场攻击 +50%' },
    { key: 'di', name: '地魂', full: '地魂·爽灵', effect: '化身：攻击 30% 再攻击一次' },
    { key: 'ren', name: '人魂', full: '人魂·幽精', effect: '化身：入场生命 +30%' },
  ];

  const POS = [
    { key: 'shigou', name: '尸狗', effect: '分身：场上己方 +1 护盾' },
    { key: 'fushi', name: '伏矢', effect: '分身：场上己方每回合 +1 生命' },
    { key: 'queyin', name: '雀阴', effect: '分身：开局固定坐北朝南' },
    { key: 'tunzei', name: '吞贼', effect: '分身：首个入场人物免疫一次伤害' },
    { key: 'feidu', name: '非毒', effect: '分身：攻击命中附加 1 层剧毒' },
    { key: 'chuhui', name: '除秽', effect: '分身：攻击伤害 +1' },
    { key: 'choufei', name: '臭肺', effect: '分身：人物入场 +2 攻 +2 生命' },
  ];

  const SIGNS = [
    { key: '上上', tone: 'gold', effect: '己方全体 +2 攻 / +2 血' },
    { key: '上吉', tone: 'gold', effect: '己方全体 +1 攻 / 回复 3 血' },
    { key: '中吉', tone: 'jade', effect: '己方全体 回复 4 血' },
    { key: '中平', tone: 'plain', effect: '己方全体 回复 2 血' },
    { key: '下下', tone: 'ash', effect: '己方全体 -1 攻（最低 0）' },
  ];

  window.DATA = {
    ELEMENTS, RING, TRIGRAMS, ATTRS, ROLES, ROLE_BY_KEY, ATTR_BY_KEY, CARDS,
    WEAPONS, WEAPON_BY_KEY, SKILLS, SKILL_BY_KEY, FIELD_RULES, DIFFICULTY, TERMS, SEATS,
    CHARACTERS, CHAR_SKILLS, SIGNS, HUNS, POS,
    ART_ROOT, portraitHtml, portraitSvgHtml, portraitFallback,
  };
})();
