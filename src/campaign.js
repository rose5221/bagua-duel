/* 剧情关卡：八卦八关 + 太极关
   第一关没有 boss 角色/福缘，作为新手关；之后每关给 boss 一个固定天时效果。
   头像复用 64 张人物牌，太极关用像素太极图标。 */
(function () {
  'use strict';
  const LEVELS = [
    {
      key: 'qian', name: '乾·天关', num: '第一关', boss: '无相道人', portrait: 'qian-fu',
      difficulty: 'easy', effect: null,
      story: '山门初开。无相道人不言不语，只以最普通的牌局试你。',
      desc: '无特殊效果 · 新手关',
    },
    {
      key: 'dui', name: '兑·泽关', num: '第二关', boss: '泽语娘', portrait: 'dui-shaonv',
      difficulty: 'easy', effect: 's_xiazhi',
      story: '泽水边的说书人，专挑人心里的那句话说。',
      desc: '每轮第一次技能使目标本回合 +2 攻；匹配两项时 +4 攻。',
    },
    {
      key: 'li', name: '离·火关', num: '第三关', boss: '烛照童子', portrait: 'li-shaonan',
      difficulty: 'easy', effect: 's_dashu',
      story: '一盏不肯熄的灯，烧的是来路不明的旧账。',
      desc: '每轮开始随机敌人获得灼烧；落后时改为两名。',
    },
    {
      key: 'zhen', name: '震·雷关', num: '第四关', boss: '雷鼓力士', portrait: 'zhen-changnan',
      difficulty: 'normal', effect: 's_jingzhe',
      story: '鼓声一响，山石都在替你数拍子。',
      desc: '每轮第一次攻击 +2 伤；目标满血时再 +2。',
    },
    {
      key: 'xun', name: '巽·风关', num: '第五关', boss: '风剪婆婆', portrait: 'xun-changnv',
      difficulty: 'normal', effect: 's_chunfen',
      story: '她不杀人，只把你的阵型剪成她想看的样子。',
      desc: '每轮第一次移动不消耗行动。',
    },
    {
      key: 'kan', name: '坎·水关', num: '第六关', boss: '寒潭鬼母', portrait: 'kan-zhongnv',
      difficulty: 'normal', effect: 's_hanlu',
      story: '潭水照不见底，照见的都是你不敢承认的败局。',
      desc: '敌方每轮第一次攻击伤害 -2；落后时 -4。',
    },
    {
      key: 'gen', name: '艮·山关', num: '第七关', boss: '镇山石君', portrait: 'gen-fu',
      difficulty: 'hard', effect: 's_lidong',
      story: '山不会让路，它只会问你为什么上山。',
      desc: '本局第一张入场牌获得 5 护盾；落后时 8。',
    },
    {
      key: 'kun', name: '坤·地关', num: '第八关', boss: '厚土娘娘', portrait: 'kun-mu',
      difficulty: 'hard', effect: 's_xiaoxue',
      story: '她记得每一个倒下的人，也记得每一张被丢弃的牌。',
      desc: '每轮开始，己方全体 +1 护盾。',
    },
    {
      key: 'taiji', name: '太极关', num: '终关', boss: '道影', portrait: '', taiji: true,
      difficulty: 'hard', effect: 's_liqiu',
      story: '没有名字的影子，用你走过的每一步来和你对局。',
      desc: '每轮首次攻击无视护盾；目标半血以下再 +2。',
    },
  ];
  window.Campaign = {
    LEVELS,
    get(i) { return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i))]; },
    count: LEVELS.length,
  };
})();
