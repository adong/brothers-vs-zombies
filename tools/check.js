#!/usr/bin/env node
/* Brothers vs Zombies: headless check that every level can be won. No npm, no browser: it loads the game's own rules
   (js/units.js, js/levels.js, js/sim.js, js/bot.js) into a sandbox and plays each level with scripted players.

     node tools/check.js            every level, 6 seeds each
     node tools/check.js 20         20 seeds each
     node tools/check.js 20 1-5     just level 1-5
     node tools/check.js --verbose  one line per run

   What must hold:
     simple bot, normal mode   wins every run (a plain build order; no buddy)
     simple bot, easy mode     wins every run
     idle bot (does nothing)   loses every run: proves the check can fail
   Also reported, not required: a sloppy "kid" bot in easy mode, with and without calling the buddy. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Set, Map, Array, Object, JSON, Error, String, Number };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/units.js', 'js/levels.js', 'js/sim.js', 'js/bot.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const { BVZ } = ctx;
const { Sim, Bot, LEVELS } = BVZ;

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const nums = args.filter((a) => /^\d+$/.test(a));
const seeds = +(nums[0] || 6);
const only = args.find((a) => /^\d-\d$/.test(a));

function play(idx, seed, { easy = false, style = 'simple', buddy = false, maxT = 900 } = {}) {
  const s = Sim.create(idx, { easy, seed, brother: 'teddy' });
  const bot = Bot.create(s, { style, buddy });
  const dt = 1 / 30;
  while (!s.result && s.t < maxT) {
    bot.think(dt);
    Sim.step(s, dt);
    s.events.length = 0;
  }
  return { result: s.result || 'timeout', t: s.t, trains: s.stats.trains, defeated: s.stats.defeated, built: s.stats.built, saves: s.stats.saves };
}

let failures = 0;
const fmt = (n) => String(n).padStart(3);

// ---- rule checks: the buddy, the mini-trains, the cookies
function rules() {
  const out = [];
  const ok = (name, cond) => {
    out.push(`  ${cond ? 'ok  ' : 'FAIL'} ${name}`);
    if (!cond) failures++;
  };
  const run = (s, sec) => {
    for (let i = 0; i < sec * 60; i++) Sim.step(s, 1 / 60);
  };
  // a zombie at the house with the buddy there: he saves the cookies, the train stays parked
  let s = Sim.create(2, { seed: 1, brother: 'teddy' });
  const m0 = s.money;
  Sim.callBuddy(s);
  ok('calling the buddy brings the other brother (Tommy for Teddy)', s.comp && s.comp.who === 'tommy');
  ok('his first treat comes with +2 stars', s.money === m0 + 2);
  Sim.callBuddy(s);
  ok('a second tap brings another treat but no more stars yet', s.money === m0 + 2 && s.stats.treats === 2);
  // (zombies are dropped right at the house, -0.01: any further out and he pushes them back before they get there)
  let z = Sim.spawnZombie(s, 'normal', 1);
  z.x = -0.01;
  run(s, 1);
  ok('he stops a zombie at the house: TOMMY SAVED THE COOKIES', s.stats.saves === 1 && s.trains[1].state === 'ready' && !s.result);
  z = Sim.spawnZombie(s, 'normal', 1);
  z.x = -0.01;
  run(s, 1);
  ok('only one save per visit: the next one sends the mini-train', s.stats.saves === 1 && s.stats.trains === 1);
  run(s, 12);
  ok('the train clears the lane and is used up', s.trains[1].state === 'used' && !s.zombies.some((q) => q.row === 1));
  ok('the visit ends after about 10 s', !s.comp);
  z = Sim.spawnZombie(s, 'normal', 1);
  z.x = -0.01;
  run(s, 5);
  ok('no train left and no buddy: the zombies get the cookies', s.result === 'lose');
  // Tommy plays: Teddy is the buddy
  s = Sim.create(0, { seed: 2, brother: 'tommy' });
  Sim.callBuddy(s);
  ok('Tommy calls Teddy', s.comp.who === 'teddy');
  // heroes
  s = Sim.create(6, { seed: 3 });
  s.money = 20;
  z = Sim.spawnZombie(s, 'normal', 2);
  z.x = 3;
  ok('the Tommy card can be played', Sim.place(s, 'tommy', 2, 0).ok);
  run(s, 2.5);
  ok("Tommy's peace wave pushes the zombie back", z.x > 3.8);
  z = Sim.spawnZombie(s, 'bucket', 3);
  z.x = 2;
  Sim.place(s, 'teddy', 3, 0);
  run(s, 14);
  ok('Teddy boxes a bucket-hat zombie until it poofs', z.dead);
  // defenders on the pool need a floatie
  s = Sim.create(10, { seed: 4 });
  s.money = 20;
  ok('no Hoop Shooter straight on the water', !Sim.place(s, 'hoop', 2, 3).ok);
  ok('a floatie first, then the Hoop Shooter', Sim.place(s, 'floatie', 2, 3).ok && Sim.place(s, 'hoop', 2, 3).ok);
  console.log('Rules\n' + out.join('\n') + '\n');
}
rules();
console.log(`Brothers vs Zombies level check: ${seeds} seeds per level\n`);
console.log('level  name                 simple/normal       simple/easy   idle   kid/easy  kid+buddy/easy');
LEVELS.forEach((L, idx) => {
  if (only && L.id !== only) return;
  const row = { sn: [], se: [], idle: [], kid: [], kidb: [] };
  for (let i = 0; i < seeds; i++) {
    const seed = 1000 + i * 7919;
    row.sn.push(play(idx, seed));
    row.se.push(play(idx, seed, { easy: true }));
    row.idle.push(play(idx, seed, { style: 'idle' }));
    row.kid.push(play(idx, seed, { easy: true, style: 'kid' }));
    row.kidb.push(play(idx, seed, { easy: true, style: 'kid', buddy: true }));
  }
  const wins = (a) => a.filter((r) => r.result === 'win').length;
  const trains = (a) => a.reduce((n, r) => n + r.trains, 0) / a.length;
  const time = (a) => Math.round(a.reduce((n, r) => n + r.t, 0) / a.length);
  const ok = wins(row.sn) === seeds && wins(row.se) === seeds && wins(row.idle) === 0;
  if (!ok) failures++;
  console.log(
    `${L.id.padEnd(6)} ${L.name.padEnd(20)} ${fmt(wins(row.sn))}/${seeds} trains ${trains(row.sn).toFixed(1)} ${time(row.sn)}s` +
      `   ${fmt(wins(row.se))}/${seeds} tr ${trains(row.se).toFixed(1)}   ${fmt(wins(row.idle))}/${seeds}` +
      `   ${fmt(wins(row.kid))}/${seeds}   ${fmt(wins(row.kidb))}/${seeds}   ${ok ? 'ok' : 'FAIL'}`,
  );
  if (verbose) {
    for (const k of Object.keys(row)) {
      console.log('   ', k, row[k].map((r) => `${r.result[0]}${Math.round(r.t)}/${r.trains}`).join(' '));
    }
  }
});
console.log(failures ? `\n${failures} level(s) FAILED` : '\nAll levels pass: winnable with the simple build order (normal and easy), and the idle bot always loses.');
process.exit(failures ? 1 : 0);
