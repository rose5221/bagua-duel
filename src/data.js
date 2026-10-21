/* 八卦对决 · 数据层
   8 卦位 = 8 属性 × 8 家庭成员；64 张人物牌；武器/技能/节气。 */
(function () {
  'use strict';

  const ELEMENTS = {
    metal: { key: 'metal', name: '金', color: '#C2A24C', light: '#DCC27C', gen: 'water', over: 'wood' },
    wood:  { key: 'wood',  name: '木', color: '#5B7A4B', light: '#86A574', gen: 'fire',  over: 'earth' },
    water: { key: 'water', name: '水', color: '#3F6E7A', light: '#6E9BA6', gen: 'wood',  over: 'fire' },
    fire:  { key: 'fire',  name: '火', color: '#B4472F', light: '#D67B62', gen: 'earth', over: 'metal' },
    earth: { key: 'earth', name: '土', color: '#A97B4A', light: '#C9A171', gen: 'metal', over: 'water' },
  };

  // 后天八卦环序：正上（南）→ 顺时针；同时决定邻位与攻击距离
  const RING = ['li', 'xun', 'zhen', 'gen', 'kan', 'qian', 'dui', 'kun'];

  const TRIGRAMS = {
    qian: { key: 'qian', name: '乾', sym: '☰', dir: '西北', element: 'metal', attr: '天', role: '夫',   skill: '刚健', angle: 315 },
    dui:  { key: 'dui',  name: '兑', sym: '☱', dir: '西',   element: 'metal', attr: '泽', role: '少女', skill: '口舌', angle: 270 },
    li:   { key: 'li',   name: '离', sym: '☲', dir: '南',   element: 'fire',  attr: '火', role: '中女', skill: '光明', angle: 0 },
    zhen: { key: 'zhen', name: '震', sym: '☳', dir: '东',   element: 'wood',  attr: '雷', role: '长男', skill: '动',   angle: 90 },
    xun:  { key: 'xun',  name: '巽', sym: '☴', dir: '东南', element: 'wood',  attr: '风', role: '长女', skill: '入',   angle: 45 },
    kan:  { key: 'kan',  name: '坎', sym: '☵', dir: '北',   element: 'water', attr: '水', role: '中男', skill: '险',   angle: 180 },
    gen:  { key: 'gen',  name: '艮', sym: '☶', dir: '东北', element: 'earth', attr: '山', role: '少男', skill: '止',   angle: 135 },
    kun:  { key: 'kun',  name: '坤', sym: '☷', dir: '西南', element: 'earth', attr: '地', role: '母',   skill: '承载', angle: 225 },
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

  const ROLES = [
    { key: 'fu',      name: '夫',   trigram: 'qian', element: 'metal', atk: 5, hp: 5, line: '一家之主，刚健。' },
    { key: 'shaonv',  name: '少女', trigram: 'dui',  element: 'metal', atk: 3, hp: 5, line: '兑之少女，口舌。' },
    { key: 'zhongnv', name: '中女', trigram: 'li',   element: 'fire',  atk: 4, hp: 5, line: '离之中女，光明。' },
    { key: 'changnv', name: '长女', trigram: 'xun',  element: 'wood',  atk: 4, hp: 4, line: '巽之长女，入。' },
    { key: 'shaonan', name: '少男', trigram: 'gen',  element: 'earth', atk: 4, hp: 4, line: '艮之少男，止。' },
    { key: 'zhongnan',name: '中男', trigram: 'kan',  element: 'water', atk: 4, hp: 5, line: '坎之中男，险。' },
    { key: 'changnan',name: '长男', trigram: 'zhen', element: 'wood',  atk: 5, hp: 4, line: '震之长男，动。' },
    { key: 'mu',      name: '母',   trigram: 'kun',  element: 'earth', atk: 3, hp: 7, line: '坤之母，承载。' },
  ];
  const ROLE_BY_KEY = Object.fromEntries(ROLES.map(r => [r.key, r]));
  const ATTR_BY_KEY = Object.fromEntries(ATTRS.map(a => [a.key, a]));

  // 64 张人物牌
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

  const WEAPONS = [
    { key: 'sword', name: '铁剑', type: 'melee',  atk: 2, hp: 0,  armor: 0, range: 1, shield: 0, desc: '近战 · 攻 +2。' },
    { key: 'axe',   name: '战斧', type: 'melee',  atk: 3, hp: -1, armor: 0, range: 1, shield: 0, desc: '近战 · 攻 +3，生命 -1。' },
    { key: 'spear', name: '长枪', type: 'melee',  atk: 2, hp: 0,  armor: 1, range: 1, shield: 0, desc: '近战 · 攻 +2，减伤 1。' },
    { key: 'bow',   name: '角弓', type: 'ranged', atk: 2, hp: -1, armor: 0, range: 2, shield: 0, desc: '远程 · 攻 +2，生命 -1，攻击距离 2。' },
    { key: 'gun',   name: '火铳', type: 'ranged', atk: 3, hp: -2, armor: 0, range: 2, shield: 0, desc: '远程 · 攻 +3，生命 -2，攻击距离 2。' },
    { key: 'dart',  name: '飞刀', type: 'ranged', atk: 1, hp: 0,  armor: 0, range: 2, shield: 0, desc: '远程 · 攻 +1，攻击距离 2。' },
    { key: 'woodshield', name: '木盾', type: 'shield', atk: 0, hp: 3, armor: 0, range: 1, shield: 2, desc: '盾 · 生命 +3，每回合刷新 2 护盾。' },
    { key: 'bronzeshield', name: '铜盾', type: 'shield', atk: 0, hp: 2, armor: 0, range: 1, shield: 3, desc: '盾 · 生命 +2，每回合刷新 3 护盾。' },
    { key: 'ironarmor', name: '铁甲', type: 'shield', atk: 0, hp: 4, armor: 0, range: 1, shield: 1, desc: '盾 · 生命 +4，每回合刷新 1 护盾。' },
  ];
  const WEAPON_BY_KEY = Object.fromEntries(WEAPONS.map(w => [w.key, w]));

  const SKILLS = [
    { key: 'gangjian', name: '刚健', trigram: 'qian', element: 'metal', attr: '天', role: '夫', target: 'ally',
      desc: '目标 +4/+4；若为天或夫，每命中一项再 +2/+2（可叠加）。' },
    { key: 'koushe', name: '口舌', trigram: 'dui', element: 'metal', attr: '泽', role: '少女', target: 'ally',
      desc: '目标 +4 攻；若为泽或少女，每命中一项再 +2 攻。' },
    { key: 'guangming', name: '光明', trigram: 'li', element: 'fire', attr: '火', role: '中女', target: 'ally',
      desc: '目标及邻位友军 +2 血；若为火或中女，命中一项目标再 +2 血，命中两项目标及邻位再 +2 血。' },
    { key: 'dong', name: '动', trigram: 'zhen', element: 'wood', attr: '雷', role: '长男', target: 'ally',
      desc: '目标额外行动一次；若为雷或长男，每命中一项再 +1 行动；两项时再给一个邻位友军 +1 行动。' },
    { key: 'ru', name: '入', trigram: 'xun', element: 'wood', attr: '风', role: '长女', target: 'ally',
      desc: '目标下次攻击伤害翻倍；若为风或长女，一项则接下来两次翻倍，两项则接下来两次翻 3 倍。' },
    { key: 'xian', name: '险', trigram: 'kan', element: 'water', attr: '水', role: '中男', target: 'ally',
      desc: '目标攻击翻倍，生命减半；若为水或中男，一项则免去生命减半，两项则攻击与生命都翻倍。' },
    { key: 'zhi', name: '止', trigram: 'gen', element: 'earth', attr: '山', role: '少男', target: 'ally',
      desc: '令目标攻击范围内一名敌人下次攻击失效 3 回合；若为山或少男，一项则另禁技能 3 回合，两项则延长至 5 回合。' },
    { key: 'chengzai', name: '承载', trigram: 'kun', element: 'earth', attr: '地', role: '母', target: 'ally',
      desc: '可立即切换目标装备；若为地或母，一项则保留原装备攻/血加成，两项则保留攻/血加成并去掉减益。' },
  ];
  const SKILL_BY_KEY = Object.fromEntries(SKILLS.map(s => [s.key, s]));

  const TERMS = [
    { name: '立春', zhong: '雨水', element: 'wood',  fx: 'healAll',   desc: '春生：所有单位回 1 血。' },
    { name: '惊蛰', zhong: '春分', element: 'wood',  fx: 'damageAll', desc: '雷动：所有单位受 1 点伤害。' },
    { name: '清明', zhong: '谷雨', element: 'earth', fx: 'shieldAll', desc: '土旺：所有单位护盾 +1。' },
    { name: '立夏', zhong: '小满', element: 'fire',  fx: 'buff',      desc: '火旺：火属性单位 +1 攻。' },
    { name: '芒种', zhong: '夏至', element: 'fire',  fx: 'fireTerm',  desc: '火极：火属性单位 +1 攻，其他单位受 1 伤。' },
    { name: '小暑', zhong: '大暑', element: 'earth', fx: 'debuffAll', desc: '湿热：所有单位 -1 攻。' },
    { name: '立秋', zhong: '处暑', element: 'metal', fx: 'buff',      desc: '金旺：金属性单位 +1 攻。' },
    { name: '白露', zhong: '秋分', element: 'metal', fx: 'metalTerm', desc: '金锐：金属性单位 +1 攻、减伤 +1。' },
    { name: '寒露', zhong: '霜降', element: 'earth', fx: 'healLow',   desc: '土燥：血最少的单位回 2 血。' },
    { name: '立冬', zhong: '小雪', element: 'water', fx: 'waterTerm', desc: '水旺：水属性单位护盾 +1。' },
    { name: '大雪', zhong: '冬至', element: 'water', fx: 'freezeAll', desc: '水寒：所有单位下次攻击失效。' },
    { name: '小寒', zhong: '大寒', element: 'earth', fx: 'debuffAll', desc: '寒极：所有单位 -1 攻。' },
  ];

  const DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const SEATS = {
    N: { label: '北', facing: '南', zhi: '子', toward: '午', text: '坐北朝南（位子向午）' },
    S: { label: '南', facing: '北', zhi: '午', toward: '子', text: '坐南朝北（位午向子）' },
  };

  // 程序化占位肖像：用户后续换成生成图时只替换这个函数即可
  function portraitHtml(card, w, h, cls) {
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
      <rect x="20" y="26" width="6" height="2" fill="${paperInk(ac)}"/>
      <rect x="38" y="26" width="6" height="2" fill="${paperInk(ac)}"/>
      <text x="32" y="49" text-anchor="middle" font-size="10" fill="#F7F3E8" font-family="serif">${card.role}</text>
      <text x="32" y="60" text-anchor="middle" font-size="7" fill="${ac.color}" font-family="monospace">${card.attr}</text>
    </svg>`;
  }
  function paperInk(c) { return c.key === 'fire' ? '#F7F3E8' : '#17191B'; }

  window.DATA = {
    ELEMENTS, RING, TRIGRAMS, ATTRS, ROLES, ROLE_BY_KEY, ATTR_BY_KEY, CARDS,
    WEAPONS, WEAPON_BY_KEY, SKILLS, SKILL_BY_KEY, TERMS, DIRS, SEATS,
    portraitHtml,
  };
})();
