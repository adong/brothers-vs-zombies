/* Brothers vs Zombies: the game itself. Screens (title, level select, pause, results), the HUD and card bar, input
   (mouse, touch, keys), saving, the buddy button, and the main loop that steps the sim and draws the view.
   window.game has test hooks for the browser console (see README). */
(function () {
  'use strict';
  const BVZ = window.BVZ, Sim = BVZ.Sim, Bot = BVZ.Bot, sfx = BVZ.sfx;
  const $ = (id) => document.getElementById(id);
  const TITLE = window.BVZ_TITLE || 'Brothers vs Zombies';
  const KEY = 'brothersVsZombies.v1';
  const LEVELS = BVZ.LEVELS;
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY' };

  // ---------------------------------------------------------------- saved progress (per brother)
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  const saved = load();
  const save = {
    brother: saved.brother === 'tommy' ? 'tommy' : 'teddy',
    easy: Object.assign({ teddy: false, tommy: true }, saved.easy),
    stars: Object.assign({ teddy: {}, tommy: {} }, saved.stars),
  };
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* storage blocked: progress lasts this visit */ }
  }
  let allOpen = /[?#&]all\b/.test(location.search + location.hash);
  const buddyOf = (b) => (b === 'tommy' ? 'teddy' : 'tommy');
  function unlockedUpTo(b) {
    if (allOpen) return LEVELS.length - 1;
    let u = 0;
    while (u + 1 < LEVELS.length && (save.stars[b][LEVELS[u].id] || 0) >= 1) u++;
    return u;
  }

  // ---------------------------------------------------------------- set-up
  const view = BVZ.View($('view'));
  const roster = Kit.roster;
  const pics = Kit.portraits([
    Object.assign({}, roster.get('teddy'), { pose: 'guard' }),
    roster.get('tommy'),
  ], { size: 220 });
  const faces = Kit.portraits([
    { id: 'teddy', look: roster.get('teddy').look },
    { id: 'tommy', look: roster.get('tommy').look },
  ], { size: 160 });
  const icons = view.icons(BVZ.CARD_ORDER.filter((k) => !BVZ.CARDS[k].hero));
  const cardImg = (id) => (BVZ.CARDS[id].hero ? faces[id] : icons[id]);

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  document.title = TITLE;
  $('logo').innerHTML = esc(TITLE).replace(/\bvs\.?(?=\s)/i, '<em>$&</em>');
  $('meterHead').src = icons.zombie;

  const G = {
    state: 'boot', mode: null, sim: null, bot: null, idx: 0, sel: null, drag: null, hover: null, pdown: false,
    held: false, keepAwake: false, autoplay: false, toasts: [], flyers: [], bannerT: 0, streak: 0, streakT: 0,
    cardEls: [], newCards: [], hintText: '', newHintT: 0, buddyUsed: false, endT: 0, result: null, demoT: 0, demoI: 0,
  };

  // ---------------------------------------------------------------- sound
  let soundOn = false;
  function initSound() {
    if (soundOn) return Kit.sound.resume();
    soundOn = true;
    Kit.sound.init();
    Kit.sound.music(G.state === 'play' || G.state === 'intro' ? 'play' : 'title');
    muteIcon();
  }
  const muteIcon = () => ($('btnMute').textContent = Kit.sound.isMuted() ? '🔇' : '🔊');
  function toggleMute() {
    initSound();
    Kit.sound.toggleMute();
    muteIcon();
  }

  // ---------------------------------------------------------------- screens
  const SCREENS = ['title', 'levels', 'pause', 'result'];
  function showScreen(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  }
  function showHud(on) {
    $('hud').classList.toggle('hidden', !on);
    fitView();
  }
  function fitView() {
    const hudOn = !$('hud').classList.contains('hidden');
    const top = hudOn ? $('topbar').getBoundingClientRect().bottom + 4 : 8;
    const bottom = hudOn ? Math.min(96, window.innerHeight * 0.08) : 8;
    view.fit(top, bottom);
  }

  // The demo behind the title: the bot plays a level (silently), in a different world each time.
  const DEMOS = [2, 8, 12, 4, 13, 6];
  function startDemo() {
    const idx = DEMOS[G.demoI++ % DEMOS.length];
    sfx.setQuiet(true);
    G.mode = 'demo';
    G.sim = Sim.create(idx, { brother: save.brother, seed: (Math.random() * 1e9) | 0 });
    G.bot = Bot.create(G.sim, { style: 'simple', buddy: true, buddyEvery: 16 });
    for (let i = 0; i < 60 * 85; i++) {
      G.bot.think(1 / 60);
      Sim.step(G.sim, 1 / 60);
    }
    G.sim.events.length = 0;
    G.demoT = 0;
    view.setLevel(G.sim);
  }

  function toTitle() {
    G.state = 'title';
    clearPlayUi();
    showScreen('title');
    showHud(false);
    if (G.mode !== 'demo') startDemo();
    refreshTitle();
    Kit.sound.music('title');
  }

  function refreshTitle() {
    for (const el of document.querySelectorAll('.pick')) {
      const who = el.dataset.who;
      el.classList.toggle('on', who === save.brother);
      el.querySelector('img').src = pics[who];
    }
    const bud = buddyOf(save.brother);
    $('titleBuddy').src = faces[bud];
    $('titleBuddyText').textContent = `Your buddy ${NAMES[bud]} comes when you call him!`;
    for (const id of ['btnEasy', 'btnEasy2']) $(id).classList.toggle('on', !!save.easy[save.brother]);
    $('btnEasy').textContent = save.easy[save.brother] ? '🐣 EASY: ON' : '🐣 EASY: OFF';
    $('btnEasy2').textContent = save.easy[save.brother] ? '🐣 EASY: ON' : '🐣 EASY: OFF';
    $('buddyImg').src = faces[bud];
    $('buddyFace').src = faces[bud];
    $('buddyName').textContent = NAMES[bud] + '!';
  }

  function pickBrother(who) {
    save.brother = who === 'tommy' ? 'tommy' : 'teddy';
    persist();
    refreshTitle();
    if (G.mode === 'demo' && G.sim) {
      // the demo behind the menu swaps brothers too: you on the porch, the other one as the buddy
      G.sim.brother = save.brother;
      G.sim.buddy = buddyOf(save.brother);
      if (G.sim.comp) G.sim.comp.who = G.sim.buddy;
      view.setLevel(G.sim);
    }
  }

  function setEasy(on) {
    save.easy[save.brother] = !!on;
    persist();
    refreshTitle();
  }

  function toLevels() {
    G.state = 'levels';
    clearPlayUi();
    showScreen('levels');
    showHud(false);
    if (G.mode !== 'demo') startDemo();
    buildLevels();
    Kit.sound.music('title');
  }

  function buildLevels() {
    const wrap = $('worlds');
    wrap.innerHTML = '';
    const b = save.brother, upTo = unlockedUpTo(b);
    for (const w of Object.keys(BVZ.WORLDS)) {
      const W = BVZ.WORLDS[w];
      const row = document.createElement('div');
      row.className = 'world ' + w;
      row.innerHTML = `<h3><b>${W.emoji}</b>${esc(W.name)}</h3>`;
      LEVELS.forEach((L, i) => {
        if (L.world !== w) return;
        const st = save.stars[b][L.id] || 0;
        const btn = document.createElement('button');
        btn.className = 'lvl' + (i > upTo ? ' locked' : '') + (i === upTo && !st ? ' next' : '');
        const starsHtml = '★★★'.split('').map((s, k) => (k < st ? s : `<i>${s}</i>`)).join('');
        btn.innerHTML = `<b>${L.id}</b><small>${esc(L.name)}</small><span class="st">${starsHtml}</span>` +
          (/boss/.test(L.huge) ? '<span class="boss">👑</span>' : '') +
          (L.unlock ? `<img class="unlock" src="${cardImg(L.unlock)}" alt="" title="Win it: ${esc(BVZ.CARDS[L.unlock].name)}">` : '');
        btn.addEventListener('click', () => {
          initSound();
          if (i > upTo) {
            sfx.nope();
            return;
          }
          sfx.select();
          startLevel(i);
        });
        row.appendChild(btn);
      });
      wrap.appendChild(row);
    }
  }

  // ---------------------------------------------------------------- a level
  function startLevel(idx, opts = {}) {
    G.idx = idx;
    G.mode = 'play';
    sfx.setQuiet(false);
    const easy = opts.easy !== undefined ? opts.easy : !!save.easy[save.brother];
    G.sim = Sim.create(idx, { easy, brother: save.brother, seed: opts.seed });
    G.bot = G.autoplay ? Bot.create(G.sim, { style: 'simple' }) : null;
    view.setLevel(G.sim);
    clearPlayUi();
    const before = idx > 0 ? Sim.cardsFor(idx - 1) : [];
    G.newCards = G.sim.cards.map((k) => k.id).filter((id) => idx > 0 && !before.includes(id) && !BVZ.START_CARDS.includes(id));
    buildCards();
    refreshTitle();
    showScreen(null);
    showHud(true);
    const L = G.sim.level;
    $('levelName').textContent = `${BVZ.WORLDS[L.world].emoji} ${L.id}  ${L.name}${easy ? '  🐣' : ''}`;
    G.state = 'intro';
    G.introT = 0;
    G.introStep = -1;
    G.buddyUsed = false;
    G.endT = 0;
    G.result = null;
    G.resultShown = false;
    G.loseZ = null;
    G.newHintT = G.newCards.length ? 9 : 0;
    Kit.sound.music('play');
  }

  function clearPlayUi() {
    select(null);
    G.drag = null;
    for (const t of G.toasts) t.el.remove();
    G.toasts = [];
    for (const f of G.flyers) f.el.remove();
    G.flyers = [];
    $('banner').className = '';
    $('banner').innerHTML = '';
    G.bannerT = 0;
    setHint('');
    view.ghost(null);
  }

  const INTRO = [
    [0, () => banner(`${esc(G.sim.level.id)} ${esc(G.sim.level.name)}<small>${BVZ.WORLDS[G.sim.level.world].emoji} ${esc(BVZ.WORLDS[G.sim.level.world].name)}</small>`, 1.4)],
    [1.5, () => { banner('READY?', 0.7); sfx.countdown(1); }],
    [2.2, () => { banner('SET...', 0.7); sfx.countdown(1); }],
    [2.9, () => { banner('DEFEND!', 0.9); sfx.countdown(0); }],
  ];
  function intro(dt) {
    G.introT += dt;
    while (G.introStep + 1 < INTRO.length && G.introT >= INTRO[G.introStep + 1][0]) INTRO[++G.introStep][1]();
    if (G.introT >= 3.4) G.state = 'play';
  }

  function onWin() {
    G.state = 'won';
    G.endT = 0;
    select(null);
    setHint('');
    const s = G.sim, L = s.level, b = save.brother;
    const stars = Math.max(1, 3 - s.stats.trains);
    const prev = save.stars[b][L.id] || 0;
    save.stars[b][L.id] = Math.max(prev, stars);
    persist();
    G.result = { win: true, stars, newCard: L.unlock && !prev ? L.unlock : null };
    view.celebrate(b);
    banner('YOU DID IT!', 2.6);
    sfx.win();
    Kit.sound.music('over');
  }

  function onLose() {
    G.state = 'lost';
    G.endT = 0;
    select(null);
    setHint('');
    G.result = { win: false };
    if (G.loseZ) view.loseScene(G.loseZ);
    banner('OH NO!', 2.4, 'huge');
    sfx.lose();
    Kit.sound.music('over');
  }

  const TIPS = [
    'Build lots of 🍦 Ice Cream Stands first: more stars, more defenders!',
    'Put a 🥊 Punching Bag in front of your shooters.',
    `Call your brother with the big button (or T) when a lane is in trouble!`,
    'Two or three 🏀 Hoop Shooters in every lane stop bucket-hat zombies.',
    'Tap 🐣 EASY on the title screen to make the zombies slower.',
    'Each lane has one mini-train 🚇. After that, the cookies are in danger!',
  ];

  function showResult() {
    G.resultShown = true;
    const r = G.result, L = G.sim.level;
    $('resTitle').textContent = r.win ? 'YOU SAVED THE COOKIES! 🍪' : 'The zombies got the cookies!';
    $('resStars').innerHTML = r.win ? [0, 1, 2].map((k) => (k < r.stars ? '⭐' : '<i>⭐</i>')).join('') : '🧟🍪';
    const bud = NAMES[buddyOf(save.brother)], me = NAMES[save.brother];
    $('resText').textContent = r.win
      ? (r.stars === 3 ? `${me} and ${bud} kept every mini-train safe!` : r.stars === 2 ? 'Great job! Keep all the mini-trains for 3 stars.' : 'You did it! Use fewer mini-trains to get more stars.')
      : `Don't worry, try again! ${TIPS[Math.floor(Math.random() * TIPS.length)]}`;
    if (r.win && r.newCard) {
      const C = BVZ.CARDS[r.newCard];
      $('resCard').innerHTML = `<div class="newcard"><img src="${cardImg(r.newCard)}" alt=""><div><b>NEW CARD!</b><strong>${esc(C.name)}</strong><br>${esc(C.tip)}</div></div>`;
    } else $('resCard').innerHTML = '';
    const hasNext = G.idx + 1 < LEVELS.length;
    $('btnNext').classList.toggle('hidden', !r.win);
    $('btnNext').textContent = hasNext ? 'NEXT ▶' : 'THE END 🎉';
    $('btnAgain').className = r.win ? 'btn small' : 'btn go';
    $('btnAgain').textContent = r.win ? '↻ AGAIN' : '↻ TRY AGAIN';
    showScreen('result');
    showHud(false);
    view.lowerFocus(2.4);
  }

  function pause() {
    if (G.state !== 'play' && G.state !== 'intro') return;
    G.paused = G.state;
    G.state = 'paused';
    select(null);
    showScreen('pause');
    Kit.sound.music('pause');
  }
  function resume() {
    if (G.state !== 'paused') return;
    G.state = G.paused || 'play';
    showScreen(null);
    Kit.sound.music('play');
  }

  // ---------------------------------------------------------------- card bar
  function buildCards() {
    const wrap = $('cards');
    wrap.innerHTML = '';
    G.cardEls = G.sim.cards.map((k, i) => {
      const C = BVZ.CARDS[k.id];
      const el = document.createElement('button');
      el.className = 'card' + (C.hero ? ' hero ' + k.id : '') + (G.newCards.includes(k.id) ? ' new' : '');
      el.innerHTML = `<img alt="" src="${cardImg(k.id)}"><div class="cost">⭐${C.cost}</div><div class="key">${i < 9 ? i + 1 : i === 9 ? 0 : ''}</div><div class="cool"></div>`;
      el.title = `${C.name}: ${C.tip}`;
      el.addEventListener('pointerdown', (e) => cardDown(e, k.id));
      wrap.appendChild(el);
      return { el, id: k.id, cool: el.querySelector('.cool') };
    });
    sizeCards();
  }

  function sizeCards() {
    const n = Math.max(1, (G.cardEls || []).length);
    const W = window.innerWidth;
    const cw = Math.max(44, Math.min(84, (W - 24 - (n + 3) * 6) / (n + 1.15 + 0.8 + 0.6)));
    document.documentElement.style.setProperty('--cw', cw.toFixed(1) + 'px');
  }

  function select(id) {
    G.sel = id;
    for (const c of G.cardEls) c.el.classList.toggle('sel', c.id === id);
    $('pack').classList.toggle('sel', id === 'pack');
    if (!id) view.ghost(null);
  }

  function cardDown(e, id) {
    e.preventDefault();
    initSound();
    if (G.state !== 'play' && G.state !== 'intro') return;
    if (G.sel === id) {
      select(null);
      return;
    }
    const C = BVZ.CARDS[id], k = G.sim.cards.find((x) => x.id === id);
    if (G.sim.money < C.cost) {
      toast(`Need ${C.cost} ⭐ for the ${C.name}`, 'warn', 1.6);
      bump('shake');
      sfx.nope();
      return;
    }
    if (k.cool > 0) {
      toast(`${C.emoji} ${C.short} is getting ready…`, 'warn', 1.4);
      sfx.nope();
      return;
    }
    sfx.select();
    select(id);
    G.drag = { id, x0: e.clientX, y0: e.clientY, moved: false };
  }

  function bump(cls) {
    const m = $('money');
    m.classList.remove(cls);
    void m.offsetWidth;
    m.classList.add(cls);
  }

  const WHY = {
    water: 'Put a 🛟 Floatie on the pool first!',
    land: 'Floaties go on the pool!',
    row: 'That lane is closed.',
    money: 'Not enough ⭐ yet!',
    cool: 'Still getting ready…',
  };

  function tryPlace(cx, cy) {
    const s = G.sim;
    const p = view.pick(cx, cy);
    if (!p || p.row < 0 || p.row > 4) return false;
    if (G.sel === 'pack') {
      if (p.col < 0 || p.col > 8) return false;
      const ok = Sim.remove(s, p.row, p.col);
      if (ok) {
        sfx.whoosh();
        select(null);
      }
      return ok;
    }
    const C = BVZ.CARDS[G.sel];
    if (!C) return false;
    if (!C.hero && (p.col < 0 || p.col > 8)) return false;
    const r = Sim.place(s, G.sel, p.row, C.hero ? 0 : p.col);
    if (r.ok) {
      select(null);
      return true;
    }
    if (WHY[r.why]) toast(WHY[r.why], 'warn', 1.6);
    sfx.nope();
    return false;
  }

  function callBuddy() {
    initSound();
    if (G.state !== 'play' && G.state !== 'intro') return;
    if (G.state === 'intro') G.state = 'play';
    Sim.callBuddy(G.sim);
    G.buddyUsed = true;
    const b = $('buddyBtn');
    b.style.transform = 'scale(0.92)';
    setTimeout(() => (b.style.transform = ''), 120);
  }

  // ---------------------------------------------------------------- toasts, banner, hints, flyers
  function toast(text, cls, life = 2.4) {
    const el = document.createElement('div');
    el.className = 'toast ' + (cls || '');
    el.textContent = text;
    $('toasts').appendChild(el);
    G.toasts.push({ el, life });
    while (G.toasts.length > 3) G.toasts.shift().el.remove();
  }
  function banner(html, life, cls) {
    const b = $('banner');
    b.className = '';
    b.innerHTML = html;
    void b.offsetWidth;
    b.className = 'show ' + (cls || '');
    G.bannerT = life;
  }
  function setHint(text) {
    if (text === G.hintText) return;
    G.hintText = text;
    $('hint').textContent = text;
  }
  function flyer(from, n = 1) {
    if (!from) return;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.textContent = '⭐';
      $('flyers').appendChild(el);
      G.flyers.push({ el, from: { x: from.x + i * 14, y: from.y - i * 8 }, t: -i * 0.08 });
    }
  }
  function tickUi(dt) {
    for (let i = G.toasts.length - 1; i >= 0; i--) {
      const t = G.toasts[i];
      t.life -= dt;
      if (t.life < 0.3) t.el.style.opacity = Math.max(0, t.life / 0.3);
      if (t.life <= 0) {
        t.el.remove();
        G.toasts.splice(i, 1);
      }
    }
    if (G.bannerT > 0) {
      G.bannerT -= dt;
      if (G.bannerT <= 0) {
        $('banner').className = '';
        $('banner').innerHTML = '';
      }
    }
    const mr = $('money').getBoundingClientRect();
    const to = { x: mr.left + mr.width / 2, y: mr.top + mr.height * 0.35 };
    for (let i = G.flyers.length - 1; i >= 0; i--) {
      const f = G.flyers[i];
      f.t += dt;
      const k = Math.max(0, Math.min(1, f.t / 0.55)), e = 1 - Math.pow(1 - k, 3);
      const x = f.from.x + (to.x - f.from.x) * e, y = f.from.y + (to.y - f.from.y) * e - Math.sin(k * Math.PI) * 60;
      f.el.style.transform = `translate(${x}px, ${y}px) scale(${1.2 - k * 0.4})`;
      if (k >= 1) {
        f.el.remove();
        G.flyers.splice(i, 1);
        bump('pulse');
      }
    }
    G.streakT -= dt;
    if (G.streakT <= 0) G.streak = 0;
    G.newHintT = Math.max(0, G.newHintT - dt);
  }

  // the little lessons in 1-1, and a note about each new card
  function hints() {
    const s = G.sim, L = s.level;
    let text = '';
    const zombieOnLawn = s.zombies.some((z) => z.x < 9.4);
    const bud = NAMES[s.buddy];
    if (L.id === '1-1') {
      if (!s.stats.collected && s.stars.length) text = 'Tap the falling ⭐ stars!';
      else if (!s.defenders.some((d) => d.kind === 'ice')) text = s.money >= 2 ? 'Tap the 🍦 card, then tap the grass!' : 'Collect ⭐ stars to build an Ice Cream Stand.';
      else if (zombieOnLawn && !s.defenders.some((d) => d.kind === 'hoop')) text = s.money >= 3 ? 'A zombie! Put a 🏀 Hoop Shooter in its lane!' : 'A zombie is coming! Save 3 ⭐ for a 🏀 Hoop Shooter.';
      else if (s.t > 75 && s.t < 95 && !G.buddyUsed) text = `Tap ${bud} (bottom left) or press T, and he runs out to help!`;
    }
    if (!text && G.newHintT > 0 && G.newCards.length) {
      const C = BVZ.CARDS[G.newCards[0]];
      text = `NEW CARD: ${C.emoji} ${C.name}! ${C.tip}`;
    }
    if (!text && L.id === '1-2' && s.t < 12) text = `Win levels to get new cards. Your buddy ${bud} is always free to call!`;
    setHint(text);
  }

  // sim events that the HUD cares about (the view handles the rest)
  function uiEvents(evs) {
    const s = G.sim;
    const bud = NAMES[s.buddy];
    for (const e of evs) {
      switch (e.type) {
        case 'collect':
          flyer(view.starScreen(e.id));
          G.streak++;
          G.streakT = 1.2;
          sfx.collect(G.streak);
          break;
        case 'treat': {
          toast(`${e.emoji} ${e.name} FROM ${bud}!${e.stars ? `  +${e.stars} ⭐` : ''}`, 'big', 2.6);
          if (e.stars) flyer(view.brotherScreen() || { x: 120, y: window.innerHeight - 160 }, e.stars);
          break;
        }
        case 'save':
          toast(`${bud} SAVED THE COOKIES!`, 'big', 3);
          break;
        case 'huge':
          banner('HUGE WAVE!<small>Here come lots of zombies!</small>', 2.8, 'huge');
          sfx.huge();
          break;
        case 'zwave':
          if (e.i === 0) toast('🧟 Here come the zombies!', '', 2.2);
          break;
        case 'train':
          if (s.stats.trains === 1) toast('🚇 TOOT TOOT! The mini-train saved that lane!', '', 2.6);
          break;
        case 'lose':
          G.loseZ = e.id;
          break;
      }
    }
  }

  function hudUpdate() {
    const s = G.sim;
    const flying = G.flyers.length;
    $('moneyN').textContent = Math.max(0, s.money - flying);
    for (const c of G.cardEls) {
      const C = BVZ.CARDS[c.id], k = s.cards.find((x) => x.id === c.id);
      const max = C.recharge * (s.easy ? BVZ.EASY.recharge : 1);
      c.el.classList.toggle('poor', s.money < C.cost);
      c.cool.style.height = (k.cool > 0 ? (k.cool / max) * 100 : 0).toFixed(1) + '%';
    }
    const comp = s.comp;
    const here = !!(comp && comp.visit > 0 && comp.state !== 'bye' && comp.state !== 'home');
    $('buddyBtn').classList.toggle('here', here);
    $('buddyBar').classList.toggle('hidden', !here);
    if (here) $('buddyBar').querySelector('i').style.width = ((comp.visit / BVZ.BUDDY.visit) * 100).toFixed(1) + '%';
    const p = Sim.progress(s);
    $('meter').querySelector('.track i').style.width = (p * 100).toFixed(1) + '%';
    $('meterHead').style.right = `calc(${(p * 100).toFixed(1)}% - 17px)`;
    // placement preview
    if (G.sel && G.hover && (G.state === 'play' || G.state === 'intro')) {
      const h = G.hover, C = BVZ.CARDS[G.sel];
      if (h.row < 0 || h.row > 4 || (!C?.hero && (h.col < 0 || h.col > 8))) view.ghost(null);
      else if (G.sel === 'pack') {
        const cell = s.cells[h.row][h.col];
        view.ghost('pack', h.row, h.col, !!(cell.unit || cell.float), s.water.includes(h.row));
      } else {
        const ok = Sim.canPlace(s, G.sel, h.row, C.hero ? 0 : h.col).ok;
        view.ghost(G.sel, h.row, h.col, ok, s.water.includes(h.row));
      }
    } else view.ghost(null);
  }

  // ---------------------------------------------------------------- the loop
  function update(dt) {
    tickUi(dt);
    const s = G.sim;
    if (!s) return;
    switch (G.state) {
      case 'title':
      case 'levels': {
        G.bot.think(dt);
        Sim.step(s, dt);
        view.handle(s.events.splice(0), s);
        view.sync(s, dt);
        if (s.result || s.t > 300) {
          G.demoT += dt;
          if (G.demoT > 3) startDemo();
        }
        break;
      }
      case 'intro':
        intro(dt);
        view.handle(s.events.splice(0), s);
        view.sync(s, dt);
        hudUpdate();
        break;
      case 'play': {
        if (G.bot) G.bot.think(dt);
        Sim.step(s, dt);
        const evs = s.events.splice(0);
        uiEvents(evs);
        view.handle(evs, s);
        view.sync(s, dt);
        hints();
        hudUpdate();
        if (s.result === 'win') onWin();
        else if (s.result === 'lose') onLose();
        break;
      }
      case 'won':
      case 'lost':
        G.endT += dt;
        view.handle(s.events.splice(0), s);
        view.sync(s, dt);
        hudUpdate();
        if (!G.resultShown && G.endT > (G.state === 'won' ? 3.4 : 3.8)) showResult();
        break;
      case 'paused':
      case 'result':
        view.sync(s, 0);
        break;
    }
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!G.held) update(dt);
    view.render(dt);
  }

  // ---------------------------------------------------------------- input
  const canvas = $('view');
  const starRadius = () => Math.max(46, Math.min(window.innerWidth, window.innerHeight) * 0.065);
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    initSound();
    if (G.state !== 'play' && G.state !== 'intro') return;
    G.pdown = true;
    G.hover = view.pick(e.clientX, e.clientY);
    const sid = view.starAt(e.clientX, e.clientY, starRadius());
    if (sid) {
      Sim.collect(G.sim, sid);
      return;
    }
    if (G.sel) tryPlace(e.clientX, e.clientY);
  });
  window.addEventListener('pointermove', (e) => {
    if (G.state !== 'play' && G.state !== 'intro') return;
    if (G.drag) {
      if (Math.hypot(e.clientX - G.drag.x0, e.clientY - G.drag.y0) > 14) G.drag.moved = true;
      G.hover = view.pick(e.clientX, e.clientY);
      return;
    }
    if (e.pointerType === 'mouse' || G.pdown) G.hover = view.pick(e.clientX, e.clientY);
    // swipe across stars to grab them
    if (G.pdown && e.target === canvas) {
      const sid = view.starAt(e.clientX, e.clientY, starRadius());
      if (sid) Sim.collect(G.sim, sid);
    }
  });
  window.addEventListener('pointerup', (e) => {
    G.pdown = false;
    if (G.drag) {
      const d = G.drag;
      G.drag = null;
      const overBar = e.clientY < $('topbar').getBoundingClientRect().bottom;
      if (d.moved && !overBar && G.sel === d.id) tryPlace(e.clientX, e.clientY);
    }
    if (e.pointerType !== 'mouse') G.hover = null;
  });
  window.addEventListener('pointercancel', () => { G.pdown = false; G.drag = null; });
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); select(null); });

  $('pack').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    initSound();
    if (G.state !== 'play' && G.state !== 'intro') return;
    select(G.sel === 'pack' ? null : 'pack');
    sfx.select();
  });
  $('btnPause').addEventListener('click', () => { initSound(); pause(); });
  $('btnMute').addEventListener('click', toggleMute);
  $('buddyBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); callBuddy(); });
  for (const el of document.querySelectorAll('.pick')) {
    el.addEventListener('click', () => {
      initSound();
      sfx.select();
      pickBrother(el.dataset.who);
    });
  }
  $('btnPlay').addEventListener('click', () => { initSound(); sfx.select(); toLevels(); });
  $('btnEasy').addEventListener('click', () => { initSound(); sfx.select(); setEasy(!save.easy[save.brother]); });
  $('btnEasy2').addEventListener('click', () => {
    initSound();
    setEasy(!save.easy[save.brother]);
    toast(save.easy[save.brother] ? '🐣 Easy mode is on from the next try' : 'Easy mode is off from the next try', '', 2);
  });
  $('btnBack').addEventListener('click', () => { sfx.select(); toTitle(); });
  $('btnResume').addEventListener('click', () => { sfx.select(); resume(); });
  $('btnRestart').addEventListener('click', () => { sfx.select(); startLevel(G.idx); });
  $('btnPauseLevels').addEventListener('click', () => { sfx.select(); toLevels(); });
  $('btnNext').addEventListener('click', () => {
    sfx.select();
    G.resultShown = false;
    if (G.idx + 1 < LEVELS.length) startLevel(G.idx + 1);
    else toLevels();
  });
  $('btnAgain').addEventListener('click', () => { sfx.select(); G.resultShown = false; startLevel(G.idx); });
  $('btnResLevels').addEventListener('click', () => { sfx.select(); G.resultShown = false; toLevels(); });

  window.addEventListener('keydown', (e) => {
    initSound();
    const k = e.key.toLowerCase();
    if (k === 'm') return toggleMute();
    if (G.state === 'play' || G.state === 'intro') {
      if (/^[0-9]$/.test(k)) {
        const i = k === '0' ? 9 : +k - 1;
        const c = G.cardEls[i];
        if (c) cardDown({ preventDefault() {}, clientX: 0, clientY: 0 }, c.id), (G.drag = null);
      } else if (k === 't') callBuddy();
      else if (k === 'escape') (G.sel ? select(null) : pause());
      else if (k === 'p') pause();
      else if (k === 'q') select(G.sel === 'pack' ? null : 'pack');
    } else if (G.state === 'paused') {
      if (k === 'p' || k === 'escape' || k === 'enter' || k === ' ') resume();
    } else if (G.state === 'title') {
      if (k === 'enter' || k === ' ') toLevels();
      else if (k === 'arrowleft' || k === 'a') pickBrother('teddy');
      else if (k === 'arrowright' || k === 'd') pickBrother('tommy');
      else if (k === 'e') setEasy(!save.easy[save.brother]);
    } else if (G.state === 'levels') {
      if (k === 'escape') toTitle();
      else if (k === 'enter' || k === ' ') startLevel(unlockedUpTo(save.brother));
    } else if (G.state === 'won' || G.state === 'lost' || !$('result').classList.contains('hidden')) {
      if ((k === 'enter' || k === ' ') && G.resultShown) (G.result.win ? $('btnNext') : $('btnAgain')).click();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!G.keepAwake) {
        if (G.state === 'play') pause();
        Kit.sound.suspend();
      }
    } else if (soundOn) Kit.sound.resume();
  });
  window.addEventListener('resize', () => {
    sizeCards();
    fitView();
  });

  // ---------------------------------------------------------------- test hooks (browser console)
  const info = () => {
    const s = G.sim;
    return s && {
      state: G.state, level: s.level.id, t: +s.t.toFixed(1), money: s.money, zombies: s.zombies.length, defenders: s.defenders.length,
      stars: s.stars.length, wave: s.wave.i + '/' + s.waves.length, trains: s.trains.map((t) => t.state[0]).join(''),
      result: s.result, buddy: s.comp && { who: s.comp.who, row: s.comp.row, x: +s.comp.x.toFixed(2), visit: +s.comp.visit.toFixed(1), state: s.comp.state, save: s.comp.save },
      heroes: s.heroes.map((h) => `${h.who}@${h.row}:${h.state}`), view: view.counts,
    };
  };
  window.game = {
    get state() { return G.state; },
    get sim() { return G.sim; },
    view, info,
    step(sec = 1, fps = 60) {
      const n = Math.max(1, Math.round(sec * fps));
      for (let i = 0; i < n; i++) update(1 / fps);
      view.render(1 / fps);
      return info();
    },
    hold(on = true) { G.held = on; return G.held; },
    keepAwake(on = true) { G.keepAwake = on; return on; },
    calm(on = true) { document.body.classList.toggle('calm', on); },
    start(id = '1-1', opts = {}) {
      if (opts.brother) pickBrother(opts.brother);
      const idx = Math.max(0, LEVELS.findIndex((L) => L.id === id));
      startLevel(idx, opts);
      if (opts.skipIntro) {
        G.state = 'play';
        $('banner').className = '';
        $('banner').innerHTML = '';
      }
      return info();
    },
    title: toTitle,
    levels: toLevels,
    pause, resume,
    brother: pickBrother,
    easy: setEasy,
    place(card, row, col) { return Sim.place(G.sim, card, row, col); },
    remove(row, col) { return Sim.remove(G.sim, row, col); },
    money(n) { G.sim.money = n; return n; },
    collectAll() { for (const st of G.sim.stars.slice()) Sim.collect(G.sim, st.id); },
    buddy() { callBuddy(); return info().buddy; },
    spawn(type = 'normal', row = 2, x) {
      const z = Sim.spawnZombie(G.sim, type, row);
      if (x !== undefined) z.x = x;
      return z.id;
    },
    autoplay(on = true) {
      G.autoplay = on;
      G.bot = on && G.sim && G.mode === 'play' ? Bot.create(G.sim, { style: 'simple' }) : null;
      return on;
    },
    select,
    win() {
      const s = G.sim;
      s.zombies.length = 0;
      s.wave.i = s.waves.length;
      s.wave.pending = [];
      return game.step(0.1);
    },
    lose(row = 2) {
      const s = G.sim;
      s.trains[row].state = 'used';
      const z = Sim.spawnZombie(s, 'normal', row);
      z.x = -0.5;
      return game.step(0.1);
    },
    unlockAll() { allOpen = true; if (G.state === 'levels') buildLevels(); },
    resetSave() {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      save.stars = { teddy: {}, tommy: {} };
    },
    pointer(type, x, y) {
      // drive the canvas like a finger: game.pointer('down', 300, 400)
      const ev = new PointerEvent('pointer' + type, { clientX: x, clientY: y, bubbles: true, pointerType: 'touch', pointerId: 7 });
      (type === 'down' ? canvas : window).dispatchEvent(ev);
    },
    // close-up camera for screenshots: game.peek(2, 4) looks at lane 2, cell 4; game.peek() goes back
    peek(row, col, k = 0.42) {
      if (row === undefined) return view.focus(null);
      view.focus({ x: BVZ.M.X(col + 0.5), y: 0.8, z: BVZ.M.Z(row) }, k);
    },
    screenOf(row, col) {
      return view.toScreen(new THREE.Vector3(BVZ.M.X(col + 0.5), 0, BVZ.M.Z(row)));
    },
  };

  // ---------------------------------------------------------------- go
  sizeCards();
  toTitle();
  requestAnimationFrame(frame);
})();
