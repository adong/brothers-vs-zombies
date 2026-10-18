/* 中文 for Brothers vs Zombies: every word on the page, the toasts and banners, the cards, the levels and the ? panel
   (Kit.lang, from kit/lang.js). The comic word bursts drawn on the lawn (POW! BOING!) ask for theirs through
   Kit.lang.t in js/models.js.
   Staying English on purpose: the kids' names (TEDDY, TOMMY), the game's name and logo (Alan picks it), the name tags
   above the brothers, and the "M" badge on the mini-trains. */
(function () {
  const L = Kit.lang;
  const TITLE = window.BVZ_TITLE || 'Brothers vs Zombies';
  L.keep([TITLE, 'Brothers vs Zombies', 'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'TEDDY!', 'TOMMY!', 'Esc']); // Esc: a key's name

  // names used inside the sentences below
  const WORLDS = { 'Sunny Backyard': '阳光后院', 'Moonlight Yard': '月光院子', 'Pool Party': '泳池派对' };
  const LEVELS = {
    'Hello, Zombies!': '你好，僵尸！', 'Cookie Smell': '饼干好香', 'Cone Party': '尖帽子派对', 'Busy Lawn': '热闹的草坪',
    'Boss of the Block': '街区大老大', 'Night Shift': '夜班', 'Skate Night': '滑板之夜', 'Bucket Brigade': '水桶大队',
    'Balloon Night': '气球之夜', 'Big Bedtime Boss': '睡衣大老大', 'Splash Zone': '水花区', 'Pool Noodles': '泳池浮条',
    'Cannonball!': '炸弹跳水！', 'Balloon Float': '气球漂漂', 'King of the Pool': '泳池大王',
  };
  const CARDS = {
    'Ice Cream Stand': '冰淇淋车', 'Hoop Shooter': '投篮机', 'Punching Bag Wall': '沙袋墙', 'Popcorn Mine': '爆米花桶',
    'Peace Shooter': '比耶发射器', 'Bubble Machine': '泡泡机', 'Bounce Pad': '蹦床', 'Double Hoop': '双投篮机',
    'Pool Floatie': '游泳圈',
  };
  const SHORT = {
    'ICE CREAM': '冰淇淋车', HOOP: '投篮机', BAG: '沙袋墙', POPCORN: '爆米花桶', PEACE: '比耶发射器', BUBBLES: '泡泡机',
    BOUNCE: '蹦床', DOUBLE: '双投篮机', FLOATIE: '游泳圈',
  };
  const TIPS = {
    'Makes a ⭐ star every so often. Build lots of these first!': '时不时变出一颗 ⭐ 星星。先多放几个！',
    'Shoots basketballs at zombies in its lane.': '朝这条路上的僵尸投篮球。',
    'Super tough. Zombies get stuck bonking it.': '超级结实，僵尸会卡在这儿一直捶它。',
    'Heats up, then goes POP! when a zombie steps on it.': '先加热，僵尸一踩就“嘭”地爆开！',
    'Fires ⭐ stars that make zombies slow and sleepy.': '发射 ⭐ 星星，让僵尸变慢、犯困。',
    'Blows bubbles down its lane. Zombies in bubbles go slow-mo.': '顺着这条路吹泡泡，泡泡里的僵尸变成慢动作。',
    'BOING! Sends one zombie flying back. Works once.': '嘣！把一个僵尸弹回去。只能用一次。',
    'Two basketballs at a time!': '一次投两个篮球！',
    'Put one on the pool, then build on top of it.': '先放进泳池，再在上面放别的。',
    'Teddy walks down a lane boxing zombies: jab, straight, POW!': 'Teddy 沿着一条路打拳：刺拳、直拳，砰！',
    'Tommy does his Y pose and a ✌️ wave pushes the zombies back.': 'Tommy 摆出 Y 字比耶，✌️ 波把僵尸推回去。',
  };
  const TREATS = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const LOSE_TIPS = {
    'Build lots of 🍦 Ice Cream Stands first: more stars, more defenders!': '先多放 🍦 冰淇淋车：星星多了，防守员就多！',
    'Put a 🥊 Punching Bag in front of your shooters.': '在投篮机前面放一个 🥊 沙袋墙。',
    'Call your brother with the big button (or T) when a lane is in trouble!': '哪条路危险了，就点大按钮（或按 T）叫兄弟来帮忙！',
    'Two or three 🏀 Hoop Shooters in every lane stop bucket-hat zombies.': '每条路放两三个 🏀 投篮机，水桶帽僵尸也挡得住。',
    'Tap 🐣 EASY on the title screen to make the zombies slower.': '在标题页点 🐣 简单，僵尸会走得慢一点。',
    'Each lane has one mini-train 🚇. After that, the cookies are in danger!': '每条路只有一辆小火车 🚇，用完了饼干就危险啦！',
  };
  const name = (s) => WORLDS[s] || LEVELS[s] || CARDS[s] || s;

  L.add(Object.assign({}, WORLDS, LEVELS, CARDS, TIPS, LOSE_TIPS, {
    // title screen and level select
    'Save the cookies! 🍪': '保护饼干！🍪',
    '🐣 EASY': '🐣 简单', '🐣 EASY: ON': '🐣 简单：开', '🐣 EASY: OFF': '🐣 简单：关',
    '◀ BACK': '◀ 返回', 'Pick a level': '选一关',
    '↻ Turn sideways for a bigger lawn': '↻ 把屏幕横过来，草坪更大',
    // the HUD and its tooltips
    'PACK UP': '收起', 'Pack up a defender (half the stars back)': '收起一个防守员（退回一半星星）',
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Call your brother (T)': '叫兄弟来帮忙 (T)',
    // banners
    'SET...': '预备……', 'DEFEND!': '开始防守！', 'YOU DID IT!': '你做到啦！', 'OH NO!': '哎呀！',
    'HUGE WAVE!': '大波僵尸来啦！', 'Here come lots of zombies!': '好多好多僵尸！',
    // toasts
    '🧟 Here come the zombies!': '🧟 僵尸来啦！',
    '🚇 TOOT TOOT! The mini-train saved that lane!': '🚇 嘟嘟！小火车守住了这条路！',
    'Put a 🛟 Floatie on the pool first!': '先在泳池里放一个 🛟 游泳圈！',
    'Floaties go on the pool!': '游泳圈要放在泳池里！',
    'That lane is closed.': '这条路没开放。',
    'Not enough ⭐ yet!': '⭐ 还不够！',
    'Still getting ready…': '还在准备中…',
    '🐣 Easy mode is on from the next try': '🐣 下一局开始用简单模式',
    'Easy mode is off from the next try': '下一局开始不用简单模式',
    // lessons in 1-1
    'Tap the falling ⭐ stars!': '点一点掉下来的 ⭐ 星星！',
    'Tap the 🍦 card, then tap the grass!': '先点 🍦 卡片，再点草地！',
    'Collect ⭐ stars to build an Ice Cream Stand.': '收集 ⭐ 星星，就能放冰淇淋车。',
    'A zombie! Put a 🏀 Hoop Shooter in its lane!': '僵尸来了！在它那条路上放一个 🏀 投篮机！',
    'A zombie is coming! Save 3 ⭐ for a 🏀 Hoop Shooter.': '僵尸要来了！攒 3 颗 ⭐ 放 🏀 投篮机。',
    // pause and results
    '↻ AGAIN': '↻ 再玩一次', LEVELS: '关卡', '↻ TRY AGAIN': '↻ 再试一次', 'NEXT ▶': '下一关 ▶', 'THE END 🎉': '全部通关 🎉',
    'YOU SAVED THE COOKIES! 🍪': '饼干保住啦！🍪', 'The zombies got the cookies!': '僵尸把饼干拿走啦！',
    'Great job! Keep all the mini-trains for 3 stars.': '真棒！一辆小火车都不用，就能拿 3 颗星。',
    'You did it! Use fewer mini-trains to get more stars.': '过关啦！少用几辆小火车，能拿更多星星。',
    'NEW CARD!': '新卡片！',
    // the ? panel (js/keys.js)
    'pick a card': '选卡片', 'take a defender back': '收回防守员', 'put the card back': '放下卡片',
    'title: pick · easy · play': '标题页：选人 · 简单 · 开始',
    'Tap a card, then the grass. Tap ⭐ stars to collect them. The big face (bottom left) calls your brother.':
      '点卡片，再点草地。点 ⭐ 星星把它们收起来。点左下角的大头像，叫兄弟来帮忙。',
    // the comic word bursts on the lawn (canvas, through Kit.lang.t)
    'POW!': '砰！', 'BOP!': '啪！', 'BONK!': '咚！', 'POP!': '啵！', 'BOING!': '嘣！', 'POOF!': '噗！', 'SWISH!': '唰！',
    'WHOOSH!': '呼！', 'YAY!': '耶！', 'PLINK!': '叮！', 'BAM!': '嘭！', 'TOOT TOOT!': '嘟嘟！',
  }));

  // the meter: "☀️ 1-3  Cone Party  🐣"
  L.rule(/^(\S+) (\d-\d) {2}(.+?)( {2}🐣)?$/u, (m, e, id, n, egg) => `${e} ${id}  ${name(n)}${egg || ''}`);
  // the level banner: "1-3 Cone Party", and its world: "☀️ Sunny Backyard"
  L.rule(/^(\d-\d) (.+)$/, (m, id, n) => `${id} ${name(n)}`);
  L.rule(/^(\S+) (Sunny Backyard|Moonlight Yard|Pool Party)$/u, (m, e, w) => `${e} ${WORLDS[w]}`);
  // the buddy
  L.rule(/^Your buddy (\w+) comes when you call him!$/, '你的兄弟 $1，一叫就来！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (\w+)!( {2}\+(\d+) ⭐)?$/u,
    (m, e, item, who, more, n) => `${e} ${who} 送来的${TREATS[item]}！${more ? `  +${n} ⭐` : ''}`);
  L.rule(/^(\w+) SAVED THE COOKIES!$/, '$1 保住了饼干！');
  L.rule(/^Tap (\w+) \(bottom left\) or press T, and he runs out to help!$/, '点左下角的 $1（或按 T），他就跑出来帮忙！');
  L.rule(/^Win levels to get new cards\. Your buddy (\w+) is always free to call!$/, '过关就能拿到新卡片。兄弟 $1 随时都能叫来帮忙！');
  // cards
  L.rule(/^Need (\d+) ⭐ for the (.+)$/u, (m, n, c) => `要 ${n} 颗 ⭐ 才能放${name(c)}`);
  L.rule(/^(\S+) (.+) is getting ready…$/u, (m, e, s) => `${e} ${SHORT[s] || s} 还在准备中…`);
  L.rule(/^NEW CARD: (\S+) (.+?)! (.+)$/u, (m, e, c, tip) => `新卡片：${e} ${name(c)}！${TIPS[tip] || tip}`);
  L.rule(/^Win it: (.+)$/, (m, c) => `过关得到：${name(c)}`);
  L.rule(/^(Ice Cream Stand|Hoop Shooter|Punching Bag Wall|Popcorn Mine|Peace Shooter|Bubble Machine|Bounce Pad|Double Hoop|Pool Floatie|Teddy|Tommy): (.+)$/,
    (m, c, tip) => `${name(c)}：${TIPS[tip] || tip}`);
  // results
  L.rule(/^(\w+) and (\w+) kept every mini-train safe!$/, '$1 和 $2 保住了每一辆小火车！');
  L.rule(/^Don't worry, try again! (.+)$/u, (m, tip) => `别担心，再试一次！${LOSE_TIPS[tip] || tip}`);
})();
