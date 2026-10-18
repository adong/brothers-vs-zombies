/* Brothers vs Zombies: the rules. Plain JavaScript with no Three.js, so the same code runs the game, the title-screen
   demo and the headless check (node tools/check.js).

   Positions are in lawn cells: x runs from 0 at the house to 9 at the street (cell c spans c..c+1, its middle is
   c + 0.5) and rows run 0 (back) to 4 (front). The sim never draws anything: it pushes events (s.events) that the
   view turns into poses, effects and sounds. Exposes BVZ.Sim. */
(function (root) {
  'use strict';
  const BVZ = (root.BVZ = root.BVZ || {});

  const COLS = 9, ROWS = 5, STEP = 1 / 60;
  const SPAWN_X = 10.2; // zombies appear on the street, just right of the lawn
  const LAWN_END = 9.3; // shooters only fire at zombies that have stepped onto the lawn
  const DOOR_X = -0.75; // a zombie this far left, with no train left in its lane, gets the cookies
  const SHOT_SPEED = 6, TRAIN_SPEED = 11;

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 'normal x2, cone@1, 3 bucket' -> [{ type, row }]
  function parseWave(text) {
    const out = [];
    for (const raw of String(text).split(',')) {
      const part = raw.trim().toLowerCase();
      if (!part) continue;
      const m = part.match(/^(\d+)?\s*([a-z]+?)\s*(?:x\s*(\d+))?\s*(?:@\s*(\d))?$/);
      if (!m || !BVZ.ZOMBIES[m[2]]) throw new Error(`Brothers vs Zombies: can't read "${raw.trim()}" in wave "${text}"`);
      const n = +(m[1] || m[3] || 1);
      for (let i = 0; i < n; i++) out.push({ type: m[2], row: m[4] !== undefined ? +m[4] : null });
    }
    return out;
  }

  // Every card you have when you start level `idx`: the starting cards plus everything won before it.
  function cardsFor(idx) {
    const L = BVZ.LEVELS[idx];
    const water = (BVZ.WORLDS[L.world].water || []).length > 0;
    const have = new Set(BVZ.START_CARDS);
    for (let i = 0; i < idx; i++) if (BVZ.LEVELS[i].unlock) have.add(BVZ.LEVELS[i].unlock);
    if (!water) have.delete('floatie');
    return BVZ.CARD_ORDER.filter((id) => have.has(id));
  }

  function create(idx, opts = {}) {
    const L = BVZ.LEVELS[idx];
    const W = BVZ.WORLDS[L.world];
    const easy = !!opts.easy;
    const E = BVZ.EASY;
    const rand = mulberry32(opts.seed !== undefined ? opts.seed : (Math.random() * 1e9) | 0);
    const rows = (L.rows || [0, 1, 2, 3, 4]).slice();
    const water = (W.water || []).filter((r) => rows.includes(r));
    const waves = L.waves.map((w) => (typeof w === 'string' ? { z: w } : w));
    waves.push({ z: L.huge, huge: true, wait: L.hugeWait || (L.gap || 22) + 6 });
    const brother = opts.brother === 'tommy' ? 'tommy' : 'teddy';
    const s = {
      idx, level: L, world: L.world, easy, rand, brother, buddy: brother === 'tommy' ? 'teddy' : 'tommy',
      t: 0, acc: 0, nextId: 1, events: [], result: null,
      rows, water, cols: COLS,
      money: (L.stars || 2) + (easy ? E.startStars : 0),
      cards: cardsFor(idx).map((id) => ({ id, cool: 0 })),
      cells: Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ float: null, unit: null }))),
      defenders: [], zombies: [], shots: [], stars: [], heroes: [], pushes: [],
      trains: Array.from({ length: ROWS }, (_, r) => ({ row: r, state: rows.includes(r) ? 'ready' : 'none', x: -0.6 })),
      comp: null,
      waves: waves.map((w) => ({ list: parseWave(w.z), huge: !!w.huge, wait: w.wait })),
      wave: { i: 0, timer: L.first || 22, pending: [], hugeWarned: false, lastRow: -1, gap: L.gap || 22 },
      skyT: 4 + rand() * 2,
      stats: { trains: 0, saves: 0, defeated: 0, built: 0, collected: 0, treats: 0 },
    };
    s.wave.firstTimer = s.wave.timer;
    return s;
  }

  const ev = (s, type, o) => s.events.push(Object.assign({ type, t: s.t }, o));
  const id = (s) => s.nextId++;
  const card = (s, cid) => s.cards.find((c) => c.id === cid);
  const isWater = (s, r) => s.water.includes(r);

  // ------------------------------------------------------------------ building

  // Can this card go on this cell? { ok, why }
  function canPlace(s, cid, r, c) {
    const C = BVZ.CARDS[cid], k = card(s, cid);
    if (!C || !k) return { ok: false, why: 'locked' };
    if (s.result) return { ok: false, why: 'over' };
    if (k.cool > 0) return { ok: false, why: 'cool' };
    if (s.money < C.cost) return { ok: false, why: 'money' };
    if (!s.rows.includes(r)) return { ok: false, why: 'row' };
    if (C.hero) return { ok: true };
    if (c < 0 || c >= COLS) return { ok: false, why: 'cell' };
    const cell = s.cells[r][c];
    if (C.water) {
      if (!isWater(s, r)) return { ok: false, why: 'land' };
      return cell.float ? { ok: false, why: 'taken' } : { ok: true };
    }
    if (isWater(s, r) && !cell.float) return { ok: false, why: 'water' };
    return cell.unit ? { ok: false, why: 'taken' } : { ok: true };
  }

  function place(s, cid, r, c) {
    const can = canPlace(s, cid, r, c);
    if (!can.ok) return can;
    const C = BVZ.CARDS[cid];
    s.money -= C.cost;
    card(s, cid).cool = C.recharge * (s.easy ? BVZ.EASY.recharge : 1);
    if (C.hero) {
      addHero(s, cid, r);
      return can;
    }
    const d = {
      id: id(s), kind: cid, r, c, x: c + 0.5, t: 0, hp: C.hp || 5, maxHp: C.hp || 5,
      fireT: 0.6, burst: 0, armed: false, onFloat: !!s.cells[r][c].float && cid !== 'floatie',
    };
    if (cid === 'ice') d.makeT = (C.first[0] + s.rand() * (C.first[1] - C.first[0])) * (s.easy ? BVZ.EASY.iceEvery : 1);
    if (cid === 'floatie') s.cells[r][c].float = d;
    else s.cells[r][c].unit = d;
    s.defenders.push(d);
    s.stats.built++;
    ev(s, 'build', { id: d.id, kind: cid, r, c });
    return can;
  }

  // The 🧺 pack-up tool: takes the top thing off a cell, and gives half its stars back.
  function remove(s, r, c) {
    const cell = s.cells[r] && s.cells[r][c];
    if (!cell || s.result) return false;
    const d = cell.unit || cell.float;
    if (!d) return false;
    s.money = Math.min(99, s.money + Math.floor(BVZ.CARDS[d.kind].cost / 2));
    knockOut(s, d, 'packed');
    return true;
  }

  function knockOut(s, d, why) {
    if (d.dead) return;
    d.dead = true;
    const cell = s.cells[d.r][d.c];
    if (cell.unit === d) cell.unit = null;
    if (cell.float === d) {
      cell.float = null;
      if (cell.unit) knockOut(s, cell.unit, 'sank'); // no floatie, no float
    }
    ev(s, 'knock', { id: d.id, kind: d.kind, r: d.r, c: d.c, why });
  }

  // ------------------------------------------------------------------ zombies

  function spawnZombie(s, type, row) {
    if (row === null || row === undefined || !s.rows.includes(row)) row = pickRow(s, type);
    if (type === 'boss' && isWater(s, row)) row = landRowNear(s, row);
    if (type === 'skate' && isWater(s, row)) type = 'normal';
    const Z = BVZ.ZOMBIES[type];
    const hpK = s.easy ? BVZ.EASY.zombieHp : 1;
    const z = {
      id: id(s), type, row, x: SPAWN_X + s.rand() * 0.5, state: 'walk', timer: 0,
      hp: Z.hp * hpK, maxHp: Z.hp * hpK, armor: (Z.armor || 0) * hpK, maxArmor: (Z.armor || 0) * hpK,
      hat: Z.hat || null, skating: !!Z.skateSpeed, floating: !!Z.balloon, swim: isWater(s, row), boss: !!Z.boss,
      slowT: 0, bubbleT: 0, held: false, target: null,
    };
    s.zombies.push(z);
    ev(s, 'spawn', { id: z.id, ztype: type, row });
    return z;
  }

  function pickRow(s, type) {
    let rows = s.rows.slice();
    if (type === 'boss' || type === 'skate') {
      const land = rows.filter((r) => !isWater(s, r));
      if (land.length) rows = land;
    }
    if (rows.length > 1) rows = rows.filter((r) => r !== s.wave.lastRow);
    const r = rows[Math.floor(s.rand() * rows.length)];
    s.wave.lastRow = r;
    return r;
  }

  function landRowNear(s, r) {
    const land = s.rows.filter((x) => !isWater(s, x));
    if (!land.length) return r;
    return land.reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a));
  }

  const blocks = (d) => !d.dead && d.kind !== 'bounce' && !(d.kind === 'popcorn' && d.armed);

  // The defender this zombie is up against, if any (the thing on top of a floatie first).
  function blockerFor(s, z) {
    if (z.floating || z.state === 'air' || z.state === 'slide') return null;
    let best = null;
    for (const d of s.defenders) {
      if (d.r !== z.row || !blocks(d)) continue;
      const gap = z.x - d.x;
      if (gap > 0.45 || gap < -0.3) continue;
      if (!best || d.x > best.x || (d.x === best.x && best.kind === 'floatie')) best = d;
    }
    return best;
  }

  // Teddy (or the buddy) standing in front of a zombie stops it: it can't get past, and it never hurts him.
  function heldByHero(s, z) {
    if (z.state === 'air' || z.state === 'slide') return false;
    const check = (h) => h && h.row === z.row && h.fighting && h.x < z.x && z.x - h.x < 0.6;
    return s.heroes.some(check) || check(s.comp);
  }

  function speedMul(s, z) {
    let k = 1;
    if (z.slowT > 0 && z.bubbleT > 0) k = 0.4;
    else if (z.slowT > 0) k = 0.5;
    else if (z.bubbleT > 0) k = 0.6;
    return k * (s.easy ? BVZ.EASY.zombieSpeed : 1);
  }

  function hurt(s, z, dmg, src, extra) {
    if (z.dead) return;
    if (z.floating) {
      popBalloon(s, z);
      return;
    }
    if (z.armor > 0) {
      z.armor -= dmg;
      if (z.armor <= 0) {
        dmg = -z.armor;
        z.armor = 0;
        ev(s, 'hatOff', { id: z.id, hat: z.hat });
        z.hat = null;
      } else dmg = 0;
    }
    z.hp -= dmg;
    ev(s, 'hit', Object.assign({ id: z.id, src }, extra));
    if (z.hp <= 0.0001) defeat(s, z, src);
  }

  function popBalloon(s, z) {
    z.floating = false;
    z.state = 'drop';
    z.timer = 0.5;
    ev(s, 'balloonPop', { id: z.id });
  }

  function defeat(s, z, by) {
    if (z.dead) return;
    z.dead = true;
    s.stats.defeated++;
    ev(s, 'poof', { id: z.id, by, row: z.row });
  }

  // Bounce pads, Tommy's waves: slide a zombie back along its lane.
  function shove(s, z, cells, dur, airborne) {
    z.state = airborne ? 'air' : 'slide';
    z.timer = 0;
    z.dur = dur;
    z.from = z.x;
    z.to = Math.min(SPAWN_X - 0.2, z.x + cells);
    z.target = null;
  }

  function stepZombies(s, dt) {
    for (const z of s.zombies) {
      if (z.dead) continue;
      const Z = BVZ.ZOMBIES[z.type];
      z.slowT = Math.max(0, z.slowT - dt);
      z.bubbleT = Math.max(0, z.bubbleT - dt);
      z.held = false;
      const k = speedMul(s, z);
      switch (z.state) {
        case 'walk': {
          const b = blockerFor(s, z);
          if (b) {
            if (z.skating) {
              z.skating = false;
              z.state = 'stumble';
              z.timer = 0.8;
              ev(s, 'boardOff', { id: z.id });
            } else {
              z.state = 'bonk';
              z.target = b;
            }
            break;
          }
          if (heldByHero(s, z)) {
            z.held = true;
            break;
          }
          const v = z.skating ? Z.skateSpeed : z.floating ? Z.floatSpeed : Z.speed;
          z.x -= v * k * dt;
          break;
        }
        case 'bonk': {
          const b = blockerFor(s, z);
          if (!b) {
            z.state = 'walk';
            z.target = null;
            break;
          }
          z.target = b;
          b.hp -= Z.bonk * (k / (s.easy ? BVZ.EASY.zombieSpeed : 1)) * dt;
          if (b.hp <= 0) knockOut(s, b, 'bonked');
          break;
        }
        case 'air':
        case 'slide': {
          z.timer += dt;
          const u = Math.min(1, z.timer / z.dur);
          z.x = z.from + (z.to - z.from) * (1 - (1 - u) * (1 - u));
          if (u >= 1) {
            z.state = 'dizzy';
            z.timer = z.boss ? 0.6 : 1.4;
          }
          break;
        }
        default: // dizzy, stumble, drop
          z.timer -= dt;
          if (z.timer <= 0) z.state = 'walk';
      }
      if (!z.dead && z.x < 0 && z.state !== 'air') reachHouse(s, z);
    }
  }

  function reachHouse(s, z) {
    const tr = s.trains[z.row];
    const c = s.comp;
    if (c && c.visit > 0 && c.save) {
      c.save = false;
      s.stats.saves++;
      defeat(s, z, 'save');
      ev(s, 'save', { row: z.row, who: c.who });
      return;
    }
    if (tr.state === 'ready') {
      tr.state = 'go';
      tr.x = -0.6;
      s.stats.trains++;
      ev(s, 'train', { row: z.row });
      return;
    }
    if (tr.state === 'go') return; // the train is on its way
    if (z.x < DOOR_X && !s.result) {
      s.result = 'lose';
      ev(s, 'lose', { id: z.id, row: z.row });
    }
  }

  function stepTrains(s, dt) {
    for (const tr of s.trains) {
      if (tr.state !== 'go') continue;
      tr.x += TRAIN_SPEED * dt;
      for (const z of s.zombies) if (!z.dead && z.row === tr.row && z.x <= tr.x + 0.3) defeat(s, z, 'train');
      if (tr.x > 10.8) {
        tr.state = 'used';
        ev(s, 'trainDone', { row: tr.row });
      }
    }
  }

  // ------------------------------------------------------------------ defenders and shots

  function zombieAhead(s, d) {
    for (const z of s.zombies) {
      if (z.dead || z.row !== d.r || z.state === 'air') continue;
      if (z.x > d.x - 0.2 && z.x < LAWN_END) return true;
    }
    return false;
  }

  function fire(s, d, kind) {
    const C = BVZ.CARDS[d.kind];
    const shot = { id: id(s), kind, r: d.r, x: d.x + 0.3, dmg: C.damage, slow: C.slow || 0, from: d.id };
    s.shots.push(shot);
    ev(s, 'shoot', { id: shot.id, from: d.id, kind, r: d.r, x: shot.x });
  }

  function stepDefenders(s, dt) {
    const E = BVZ.EASY;
    for (const d of s.defenders) {
      if (d.dead) continue;
      const C = BVZ.CARDS[d.kind];
      d.t += dt;
      switch (d.kind) {
        case 'ice':
          d.makeT -= dt;
          if (d.makeT <= 0) {
            d.makeT = C.every * (s.easy ? E.iceEvery : 1);
            addStar(s, 'stand', d.x + 0.25, d.r + 0.3, d.id);
          }
          break;
        case 'hoop':
        case 'peace':
        case 'double':
          d.fireT = Math.max(0, d.fireT - dt);
          if (d.burst > 0) {
            d.burst -= dt;
            if (d.burst <= 0) fire(s, d, 'ball');
          }
          if (d.fireT <= 0 && zombieAhead(s, d)) {
            fire(s, d, d.kind === 'peace' ? 'star' : 'ball');
            if (d.kind === 'double') d.burst = 0.22;
            d.fireT = C.every;
          }
          break;
        case 'bubble': {
          let any = false;
          for (const z of s.zombies) {
            if (z.dead || z.row !== d.r || z.x < d.x || z.x > d.x + C.reach || z.x > LAWN_END) continue;
            z.bubbleT = 0.3;
            any = true;
          }
          d.blowing = any;
          break;
        }
        case 'popcorn':
          if (!d.armed && d.t >= C.arm * (s.easy ? E.popcornArm : 1)) {
            d.armed = true;
            ev(s, 'armed', { id: d.id });
          }
          if (d.armed && s.zombies.some((z) => grounded(z) && z.row === d.r && Math.abs(z.x - d.x) < 0.45)) {
            for (const z of s.zombies) {
              if (grounded(z) && z.row === d.r && Math.abs(z.x - d.x) < C.reach) hurt(s, z, C.damage, 'popcorn');
            }
            ev(s, 'pop', { id: d.id, r: d.r, x: d.x });
            knockOut(s, d, 'used');
          }
          break;
        case 'bounce': {
          const z = s.zombies.find((z) => grounded(z) && z.row === d.r && Math.abs(z.x - d.x) < 0.35);
          if (z) {
            shove(s, z, z.boss ? C.bossPush : C.push, 0.9, true);
            ev(s, 'boing', { id: d.id, zid: z.id, r: d.r, x: d.x });
            knockOut(s, d, 'used');
          }
          break;
        }
      }
    }
  }

  const grounded = (z) => !z.dead && !z.floating && z.state !== 'air';

  function stepShots(s, dt) {
    for (const p of s.shots) {
      if (p.dead) continue;
      p.x += SHOT_SPEED * dt;
      let hitZ = null;
      for (const z of s.zombies) {
        if (z.dead || z.row !== p.r || z.state === 'air') continue;
        if (p.x >= z.x - 0.25 && p.x <= z.x + 0.4 && (!hitZ || z.x < hitZ.x)) hitZ = z;
      }
      if (hitZ) {
        p.dead = true;
        const wasFloating = hitZ.floating;
        hurt(s, hitZ, p.dmg, p.kind);
        if (p.slow && !hitZ.dead && !wasFloating) hitZ.slowT = BVZ.CARDS.peace.slow;
        ev(s, 'shotHit', { id: p.id, zid: hitZ.id, kind: p.kind });
      } else if (p.x > 10.6) {
        p.dead = true;
        ev(s, 'shotGone', { id: p.id });
      }
    }
  }

  // ------------------------------------------------------------------ stars

  function addStar(s, kind, x, d, from) {
    const st = { id: id(s), kind, x, d, fall: kind === 'sky' ? 4.5 : 0.6, life: s.easy ? BVZ.EASY.starAutoCollect : BVZ.STAR_LIFE, value: 1, from };
    s.stars.push(st);
    ev(s, 'star', { id: st.id, kind, x, d, from });
    return st;
  }

  function collect(s, sid, auto) {
    const st = s.stars.find((x) => x.id === sid && !x.dead);
    if (!st) return false;
    st.dead = true;
    s.money = Math.min(99, s.money + st.value);
    s.stats.collected++;
    ev(s, 'collect', { id: sid, value: st.value, auto: !!auto });
    return true;
  }

  function stepStars(s, dt) {
    const W = BVZ.WORLDS[s.world];
    if (W.sky && !s.result) {
      s.skyT -= dt;
      if (s.skyT <= 0) {
        s.skyT = W.sky * (0.8 + s.rand() * 0.4) * (s.easy ? BVZ.EASY.skyEvery : 1);
        const r0 = Math.min(...s.rows), r1 = Math.max(...s.rows);
        addStar(s, 'sky', 0.6 + s.rand() * 7.6, r0 - 0.2 + s.rand() * (r1 - r0 + 0.4));
      }
    }
    for (const st of s.stars) {
      if (st.dead) continue;
      if (st.fall > 0) {
        st.fall -= dt;
        continue;
      }
      st.life -= dt;
      if (st.life <= 0) {
        if (s.easy) collect(s, st.id, true);
        else {
          st.dead = true;
          ev(s, 'starGone', { id: st.id });
        }
      }
    }
  }

  // ------------------------------------------------------------------ heroes: Teddy and Tommy cards

  function addHero(s, who, row) {
    const h = { id: id(s), who, row, x: -0.5, t: 0, state: who === 'teddy' ? 'walk' : 'in', fighting: who === 'teddy', punchT: 0, hand: 0 };
    s.heroes.push(h);
    ev(s, 'hero', { id: h.id, who, row });
    return h;
  }

  // the zombie right in front of a boxer, if any
  function inFront(s, h, reach) {
    let best = null;
    for (const z of s.zombies) {
      if (z.dead || z.row !== h.row || z.state === 'air') continue;
      const gap = z.x - h.x;
      if (gap >= -0.1 && gap <= reach && (!best || z.x < best.x)) best = z;
    }
    return best;
  }

  function stepHeroes(s, dt) {
    const T = BVZ.CARDS.teddy, M = BVZ.CARDS.tommy;
    for (const h of s.heroes) {
      if (h.dead) continue;
      h.t += dt;
      if (h.who === 'teddy') {
        if (h.state === 'walk' || h.state === 'box') {
          const z = inFront(s, h, 0.75);
          if (z) {
            h.state = 'box';
            h.punchT -= dt;
            if (h.punchT <= 0) {
              h.punchT = T.punch;
              h.hand ^= 1;
              ev(s, 'punch', { id: h.id, zid: z.id, hand: h.hand });
              hurt(s, z, T.damage, 'teddy');
              if (!z.dead && z.state !== 'air') z.x = Math.min(SPAWN_X, z.x + (z.boss ? 0.02 : 0.07));
            }
          } else {
            h.state = 'walk';
            h.punchT = Math.min(h.punchT, 0.1);
            h.x += T.speed * dt;
          }
          if (h.t >= T.time || h.x > 9.2) {
            h.state = 'bye';
            h.fighting = false;
            h.timer = 1.4;
            ev(s, 'heroBye', { id: h.id });
          }
        } else if (h.state === 'bye') {
          h.timer -= dt;
          if (h.timer <= 0) h.state = 'home';
        } else if (h.state === 'home') {
          h.x -= 4.5 * dt;
          if (h.x < -1.3) h.dead = true;
        }
      } else {
        // Tommy: runs to the front of the lane, does his Y, and the ✌️ wave rolls down the lane
        if (h.state === 'in') {
          h.x += 3 * dt;
          if (h.x >= 0.45) {
            h.state = 'pose';
            h.timer = 0.6;
            ev(s, 'peace', { id: h.id });
          }
        } else if (h.state === 'pose') {
          h.timer -= dt;
          if (h.timer <= 0) {
            s.pushes.push({ id: id(s), row: h.row, x: h.x + 0.2, end: 10.4, v: 8, push: M.push, bossPush: M.bossPush, dmg: M.damage, hit: new Set(), big: true });
            ev(s, 'peaceWave', { row: h.row, x: h.x, big: true });
            h.state = 'cheer';
            h.timer = 1.6;
          }
        } else if (h.state === 'cheer') {
          h.timer -= dt;
          if (h.timer <= 0) h.state = 'home';
        } else if (h.state === 'home') {
          h.x -= 4 * dt;
          if (h.x < -1.3) h.dead = true;
        }
      }
    }
    s.heroes = s.heroes.filter((h) => !h.dead);
  }

  // ✌️ waves: roll down a lane and push each zombie back once
  function stepPushes(s, dt) {
    for (const w of s.pushes) {
      w.x += w.v * dt;
      for (const z of s.zombies) {
        if (z.dead || z.row !== w.row || w.hit.has(z.id) || z.x > w.x || z.x < w.x - 1.2 || z.state === 'air') continue;
        w.hit.add(z.id);
        const wasFloating = z.floating;
        hurt(s, z, w.dmg, 'peace', { push: true });
        if (!z.dead && !wasFloating) shove(s, z, z.boss ? w.bossPush : w.push, 0.5, false);
      }
      if (w.x > w.end) w.dead = true;
    }
    s.pushes = s.pushes.filter((w) => !w.dead);
  }

  // ------------------------------------------------------------------ the buddy (companion)

  // The lane in the most trouble: the zombie closest to the house, plus a little for crowds.
  function dangerRow(s) {
    let best = null, bestScore = -1;
    for (const r of s.rows) {
      let minX = 99, n = 0;
      for (const z of s.zombies) {
        if (z.dead || z.row !== r || z.x > LAWN_END + 0.5) continue;
        n++;
        minX = Math.min(minX, z.x);
      }
      if (!n) continue;
      const score = 12 - minX + n * 0.4;
      if (score > bestScore) (bestScore = score), (best = r);
    }
    return best;
  }

  const TREATS = [
    ['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA'],
  ];

  function callBuddy(s) {
    if (s.result) return null;
    const B = BVZ.BUDDY;
    let c = s.comp;
    if (!c) {
      const row = dangerRow(s);
      c = s.comp = {
        who: s.buddy, row: row === null ? s.rows[Math.floor(s.rows.length / 2)] : row, x: -0.6, t: 0,
        visit: B.visit, save: true, state: 'run', fighting: true, actT: 0.3, hand: 0, treatStarT: s.compTreatStarT || 0,
      };
      ev(s, 'buddy', { who: c.who, row: c.row });
    } else {
      c.visit = B.visit;
      if (c.state === 'bye' || c.state === 'home') {
        c.state = 'run';
        c.fighting = true;
        ev(s, 'buddyBack', { who: c.who });
      }
    }
    // every call brings a treat; bonus stars come with it at most once every 12 s
    const [emoji, name] = TREATS[s.stats.treats % TREATS.length];
    s.stats.treats++;
    let stars = 0;
    if (c.treatStarT <= 0) {
      stars = B.treatStars;
      c.treatStarT = B.treatStarsEvery;
      s.money = Math.min(99, s.money + stars);
    }
    ev(s, 'treat', { who: c.who, emoji, name, stars });
    return c;
  }

  function stepBuddy(s, dt) {
    const c = s.comp;
    if (!c) {
      s.compTreatStarT = Math.max(0, (s.compTreatStarT || 0) - dt);
      return;
    }
    const B = BVZ.BUDDY;
    c.t += dt;
    c.treatStarT = Math.max(0, c.treatStarT - dt);
    s.compTreatStarT = c.treatStarT;
    if (c.state === 'run' || c.state === 'fight') {
      c.visit -= dt;
      // move to the lane in trouble when his own lane is quiet
      c.retarget = (c.retarget || 0) - dt;
      if (c.retarget <= 0) {
        c.retarget = 1;
        const r = dangerRow(s);
        const mine = s.zombies.some((z) => !z.dead && z.row === c.row && z.x < LAWN_END + 0.5);
        if (r !== null && r !== c.row && !mine) {
          c.row = r;
          c.x = Math.min(c.x, 1.5);
          ev(s, 'buddyLane', { row: r });
        }
      }
      const reach = c.who === 'teddy' ? 0.75 : B.tommyReach;
      const z = inFront(s, c, reach);
      if (z) {
        c.state = 'fight';
        c.actT -= dt;
        if (c.actT <= 0) {
          if (c.who === 'teddy') {
            c.actT = B.teddyPunch;
            c.hand ^= 1;
            ev(s, 'punch', { buddy: true, zid: z.id, hand: c.hand });
            hurt(s, z, B.teddyDamage, 'teddy');
            if (!z.dead && z.state !== 'air') z.x = Math.min(SPAWN_X, z.x + (z.boss ? 0.02 : 0.1));
          } else {
            c.actT = B.tommyEvery;
            s.pushes.push({ id: id(s), row: c.row, x: c.x + 0.2, end: c.x + B.tommyReach + 0.6, v: 7, push: B.tommyPush, bossPush: 0.3, dmg: B.tommyDamage, hit: new Set() });
            ev(s, 'peace', { buddy: true });
            ev(s, 'peaceWave', { row: c.row, x: c.x, big: false });
          }
        }
      } else {
        c.state = 'run';
        c.actT = Math.min(c.actT, 0.25);
        if (c.x < 8.6) c.x += 2.2 * dt;
      }
      if (c.visit <= 0) {
        c.state = 'bye';
        c.fighting = false;
        c.timer = 1.3;
        ev(s, 'buddyBye', { who: c.who });
      }
    } else if (c.state === 'bye') {
      c.timer -= dt;
      if (c.timer <= 0) c.state = 'home';
    } else if (c.state === 'home') {
      c.x -= 5 * dt;
      if (c.x < -1.4) {
        s.comp = null;
        ev(s, 'buddyGone', {});
      }
    }
  }

  // ------------------------------------------------------------------ waves

  function stepWaves(s, dt) {
    const w = s.wave;
    for (const p of w.pending) {
      if (!p.done && s.t >= p.at) {
        p.done = true;
        spawnZombie(s, p.type, p.row);
      }
    }
    w.pending = w.pending.filter((p) => !p.done);
    const alive = s.zombies.some((z) => !z.dead);
    if (w.i < s.waves.length) {
      const next = s.waves[w.i];
      if (w.i > 0 && !alive && !w.pending.length && w.timer > 5) w.timer = 5; // lawn is clear: hurry up
      w.timer -= dt;
      if (next.huge && !w.hugeWarned && w.timer <= 4) {
        w.hugeWarned = true;
        ev(s, 'huge', {});
      }
      if (w.timer <= 0) {
        next.list.forEach((z, i) => w.pending.push({ at: s.t + (next.huge ? i * 0.9 : i * 1.6) + s.rand() * 0.8, type: z.type, row: z.row }));
        ev(s, 'zwave', { i: w.i, huge: next.huge, n: next.list.length });
        w.i++;
        const after = s.waves[w.i];
        w.timer = after ? after.wait || w.gap : 0;
        w.timerMax = w.timer;
      }
    } else if (!w.pending.length && !alive && !s.result) {
      s.result = 'win';
      ev(s, 'win', { stars: Math.max(1, 3 - s.stats.trains) });
    }
  }

  // 0..1 for the progress meter: whole waves done, plus how far into the wait for the next one
  function progress(s) {
    const w = s.wave, n = s.waves.length;
    if (w.i >= n) return 1;
    const max = w.i === 0 ? w.firstTimer : w.timerMax || w.gap;
    return Math.min(1, (w.i + Math.max(0, 1 - w.timer / max)) / n);
  }

  // ------------------------------------------------------------------ the loop

  function stepOnce(s, dt) {
    s.t += dt;
    for (const k of s.cards) k.cool = Math.max(0, k.cool - dt);
    stepWaves(s, dt);
    stepStars(s, dt);
    stepDefenders(s, dt);
    stepShots(s, dt);
    stepPushes(s, dt);
    stepHeroes(s, dt);
    stepBuddy(s, dt);
    stepZombies(s, dt);
    stepTrains(s, dt);
    s.defenders = s.defenders.filter((d) => !d.dead);
    s.zombies = s.zombies.filter((z) => !z.dead);
    s.shots = s.shots.filter((p) => !p.dead);
    s.stars = s.stars.filter((x) => !x.dead);
  }

  // Advance by dt seconds in fixed 1/60 s steps. After a win or a loss the lawn freezes.
  function step(s, dt) {
    s.acc += Math.min(dt, 0.25);
    while (s.acc >= STEP) {
      s.acc -= STEP;
      if (s.result) {
        s.acc = 0;
        break;
      }
      stepOnce(s, STEP);
    }
  }

  BVZ.Sim = {
    COLS, ROWS, STEP, SPAWN_X, LAWN_END, DOOR_X,
    create, step, canPlace, place, remove, collect, callBuddy, progress, dangerRow, parseWave, cardsFor, spawnZombie,
    TREATS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
