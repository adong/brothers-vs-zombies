/* Brothers vs Zombies: scripted players. They drive the headless check (node tools/check.js) and the demo behind the
   title screen. Exposes BVZ.Bot.create(sim, { style, delay, heroes, buddy }).

   style 'simple': a plain build order. Collect every star, an Ice Cream Stand in each lane, a shooter wherever a
                   zombie shows up, then more shooters, punching bags and bubbles; the hero cards and a Popcorn Mine
                   when a lane is in trouble. It never calls the buddy unless { buddy: true }.
   style 'kid':    a little kid: collects stars late, builds whatever it can afford in random cells near the house.
   style 'idle':   does nothing at all (the check needs it to lose, to prove it can fail). */
(function (root) {
  'use strict';
  const BVZ = (root.BVZ = root.BVZ || {});
  const SHOOTERS = ['hoop', 'peace', 'double'];

  function create(s, opts = {}) {
    const style = opts.style || 'simple';
    const delay = opts.delay !== undefined ? opts.delay : style === 'kid' ? 2.5 : 0.5;
    const Sim = BVZ.Sim;
    const seen = new Map(); // star id -> time first seen
    let thinkT = 0, buddyT = opts.buddyEvery || 25;
    const rand = s.rand;

    const has = (cid) => s.cards.some((k) => k.id === cid);
    const ready = (cid) => {
      const k = s.cards.find((x) => x.id === cid);
      return k && k.cool <= 0 && s.money >= BVZ.CARDS[cid].cost;
    };
    const unitAt = (r, c) => s.cells[r][c].unit;
    const inRow = (r, kinds) => s.defenders.filter((d) => d.r === r && kinds.includes(d.kind)).length;
    const zombiesIn = (r) => s.zombies.filter((z) => !z.dead && z.row === r && z.x < Sim.LAWN_END + 0.3);
    const water = (r) => s.water.includes(r);

    // Build cid on (r, c), putting a floatie down first on the pool. True if something was built.
    function build(cid, r, c) {
      if (c < 0 || c >= Sim.COLS) return false;
      if (water(r) && !s.cells[r][c].float && !BVZ.CARDS[cid].hero) {
        if (!ready('floatie') || s.cells[r][c].unit) return false;
        return Sim.place(s, 'floatie', r, c).ok;
      }
      return Sim.place(s, cid, r, c).ok;
    }

    function threat(r) {
      let t = 0;
      for (const z of zombiesIn(r)) t += (z.hp + z.armor) * (1 + (9 - Math.max(0, z.x)) / 6);
      return t;
    }

    function bestShooter() {
      if (has('double') && ready('double')) return 'double';
      if (has('peace') && ready('peace')) return 'peace';
      return ready('hoop') ? 'hoop' : null;
    }

    function firstFree(r, cols) {
      for (const c of cols) if (!unitAt(r, c)) return c;
      return -1;
    }

    function simpleThink() {
      const rows = s.rows;
      const middleFirst = (list) => list.slice().sort((a, b) => Math.abs(a - 2) - Math.abs(b - 2));
      const land = middleFirst(rows.filter((r) => !water(r)));
      const shooters = (r) => inRow(r, SHOOTERS);
      const nearest = (r) => Math.min(99, ...zombiesIn(r).map((z) => z.x));
      // 1. a lane with a zombie and nothing to shoot it: a shooter right away (save up for it if need be)
      const bare = rows.filter((r) => zombiesIn(r).length && !shooters(r)).sort((a, b) => nearest(a) - nearest(b));
      if (bare.length) {
        if (opts.heroes !== false && heroHelp()) return true;
        const r = bare[0];
        const c = firstFree(r, [2, 3, 1, 4]);
        if (c < 0) return false;
        if (water(r) && !s.cells[r][c].float) return build('hoop', r, c); // the floatie goes down first
        const k = bestShooter();
        return k ? build(k, r, c) : false;
      }
      // 2. trouble: a zombie close to the house, or the Boss
      if (opts.heroes !== false && heroHelp()) return true;
      for (const r of rows) {
        const zs = zombiesIn(r);
        const boss = zs.find((z) => z.boss);
        if (boss && boss.x < 8.5) {
          const bc = Math.floor(boss.x) - 2;
          if (bc >= 1 && has('popcorn') && ready('popcorn') && !unitAt(r, bc) && build('popcorn', r, bc)) return true;
          const wc = Math.min(7, Math.floor(boss.x) - 1);
          if (wc >= 2 && has('bag') && ready('bag') && !unitAt(r, wc) && build('bag', r, wc)) return true;
        }
        const near = zs.filter((z) => z.x < 4.5 && !z.floating);
        if (near.length) {
          const c = Math.floor(near[0].x) - 1;
          if (c >= 1 && has('popcorn') && ready('popcorn') && !unitAt(r, c) && build('popcorn', r, c)) return true;
        }
      }
      // 3. an Ice Cream Stand in every grass lane, the middle lanes first
      for (const r of land) if (!inRow(r, ['ice'])) return ready('ice') ? build('ice', r, 0) : false;
      // 4. two shooters in every lane, the lane with the fewest (and the most zombies) first
      const lanes = rows.slice().sort((a, b) => shooters(a) - shooters(b) || threat(b) - threat(a));
      const addShooter = (max) => {
        const r = lanes.find((x) => shooters(x) < max);
        if (r === undefined) return null;
        const c = firstFree(r, [2, 3, 4, 5]);
        if (c < 0) return null;
        if (water(r) && !s.cells[r][c].float) return build('hoop', r, c);
        const k = bestShooter();
        return k ? build(k, r, c) : false;
      };
      let done = addShooter(2);
      if (done !== null) return done;
      // 5. a second column of Ice Cream Stands
      for (const r of land) if (inRow(r, ['ice']) < 2 && !unitAt(r, 1)) return ready('ice') ? build('ice', r, 1) : false;
      // 6. a punching bag in front of every lane
      for (const r of lanes) if (has('bag') && !inRow(r, ['bag']) && !unitAt(r, 7)) return ready('bag') ? build('bag', r, 7) : false;
      // 7. up to four shooters a lane, then bubbles
      done = addShooter(4);
      if (done !== null) return done;
      for (const r of lanes) if (has('bubble') && !inRow(r, ['bubble']) && !unitAt(r, 6)) return ready('bubble') ? build('bubble', r, 6) : false;
      return false;
    }

    // Teddy for a crowded lane or the Boss, Tommy when a zombie gets close to the house.
    function heroHelp() {
      let worst = null, worstX = 99, crowd = null, crowdN = 0;
      for (const r of s.rows) {
        const zs = zombiesIn(r);
        for (const z of zs) if (z.x < worstX) (worstX = z.x), (worst = r);
        const n = zs.filter((z) => z.x < 7).reduce((a, z) => a + (z.boss ? 6 : z.armor > 0 ? 2 : 1), 0);
        if (n > crowdN) (crowdN = n), (crowd = r);
      }
      if (worst !== null && worstX < 2.6 && has('tommy') && ready('tommy')) return Sim.place(s, 'tommy', worst, 0).ok;
      if (crowd !== null && crowdN >= 3 && has('teddy') && ready('teddy')) return Sim.place(s, 'teddy', crowd, 0).ok;
      if (worst !== null && worstX < 2.2 && has('teddy') && ready('teddy')) return Sim.place(s, 'teddy', worst, 0).ok;
      return false;
    }

    function kidThink() {
      const affordable = s.cards.filter((k) => ready(k.id));
      if (!affordable.length || rand() < 0.6) return false;
      const k = affordable[Math.floor(rand() * affordable.length)].id;
      const r = s.rows[Math.floor(rand() * s.rows.length)];
      if (BVZ.CARDS[k].hero) return zombiesIn(r).length ? Sim.place(s, k, r, 0).ok : false;
      const c = k === 'ice' ? Math.floor(rand() * 2) : k === 'bag' ? 5 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 5);
      return build(k, r, c);
    }

    return {
      style,
      think(dt) {
        if (style === 'idle') return;
        for (const st of s.stars) {
          if (!seen.has(st.id)) seen.set(st.id, s.t);
          if (s.t - seen.get(st.id) >= delay) Sim.collect(s, st.id);
        }
        if (opts.buddy) {
          buddyT -= dt;
          if (buddyT <= 0 && Sim.dangerRow(s) !== null) {
            buddyT = opts.buddyEvery || 25;
            Sim.callBuddy(s);
          }
        }
        thinkT -= dt;
        if (thinkT > 0) return;
        thinkT = style === 'kid' ? 1.0 : 0.25;
        if (style === 'kid') kidThink();
        else simpleThink();
      },
    };
  }

  BVZ.Bot = { create };
})(typeof window !== 'undefined' ? window : globalThis);
