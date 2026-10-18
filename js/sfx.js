/* Brothers vs Zombies: the game's own sounds, synthesised with Kit.sound.tone / hiss (no audio files).
   Exposes BVZ.sfx. Everything is a no-op until Kit.sound.init() runs on the first tap or key. */
(function () {
  'use strict';
  const S = Kit.sound;
  const tone = (o) => S.tone(o), hiss = (o) => S.hiss(o);
  let quiet = false; // the title-screen demo plays silently
  let last = {}; // rate-limit busy sounds
  const every = (key, gap) => {
    const now = performance.now();
    if (last[key] && now - last[key] < gap) return false;
    last[key] = now;
    return true;
  };

  const sfx = {
    setQuiet(q) { quiet = q; },
    get quiet() { return quiet; },
    build() {
      tone({ type: 'triangle', f: 330, to: 180, dur: 0.14, vol: 0.22 });
      hiss({ filter: 'lowpass', f: 900, to: 200, dur: 0.18, vol: 0.18 });
      tone({ type: 'sine', f: 880, to: 1320, at: 0.06, dur: 0.12, vol: 0.06 });
    },
    nope() { tone({ type: 'square', f: 220, to: 180, dur: 0.12, vol: 0.05, lp: 1200 }); },
    select() { S.click(); },
    shootBall() {
      if (!every('ball', 60)) return;
      tone({ type: 'sine', f: 420, to: 250, dur: 0.07, vol: 0.09 });
      hiss({ filter: 'lowpass', f: 1500, to: 400, dur: 0.05, vol: 0.05 });
    },
    shootStar() {
      if (!every('pstar', 60)) return;
      tone({ type: 'triangle', f: 1250, to: 1700, dur: 0.09, vol: 0.05 });
    },
    hit() {
      if (!every('hit', 50)) return;
      tone({ type: 'sine', f: 240, to: 120, dur: 0.07, vol: 0.12 });
    },
    sleepy() {
      if (!every('sleepy', 120)) return;
      tone({ type: 'sine', f: 900, to: 500, dur: 0.25, vol: 0.05 });
    },
    plink() {
      tone({ type: 'square', f: 1100, to: 700, dur: 0.12, vol: 0.05, lp: 3000 });
      tone({ type: 'triangle', f: 1600, at: 0.05, dur: 0.15, vol: 0.06 });
    },
    poof() {
      if (!every('poof', 70)) return;
      hiss({ f: 1800, to: 600, dur: 0.25, vol: 0.12, q: 0.8 });
      [660, 880, 1320].forEach((f, i) => tone({ type: 'triangle', f, at: 0.05 + i * 0.05, dur: 0.12, vol: 0.07 }));
    },
    bonk() {
      if (!every('bonk', 220)) return;
      tone({ type: 'sine', f: 180, to: 140, dur: 0.06, vol: 0.06 });
    },
    knock() {
      tone({ type: 'sine', f: 300, to: 90, dur: 0.3, vol: 0.18 });
      hiss({ filter: 'lowpass', f: 1200, to: 200, dur: 0.25, vol: 0.12 });
    },
    starAppear() {
      if (!every('starA', 150)) return;
      tone({ type: 'sine', f: 1568, dur: 0.12, vol: 0.035 });
      tone({ type: 'sine', f: 2093, at: 0.08, dur: 0.16, vol: 0.03 });
    },
    collect(streak) {
      S.coin(streak);
    },
    groan() {
      if (!every('groan', 2500)) return;
      // a grumpy, silly "mmmm-cookies" mumble (not the scary kit groan)
      tone({ type: 'sawtooth', f: 150, to: 120, dur: 0.35, vol: 0.05, lp: 700 });
      tone({ type: 'sawtooth', f: 135, to: 105, at: 0.32, dur: 0.45, vol: 0.05, lp: 600 });
    },
    pop() {
      for (let i = 0; i < 7; i++) hiss({ filter: 'highpass', f: 1800 + i * 300, dur: 0.04, vol: 0.18, at: i * 0.035 });
      tone({ f: 160, to: 50, dur: 0.35, vol: 0.4 });
      hiss({ filter: 'lowpass', f: 3000, to: 300, dur: 0.4, vol: 0.25 });
    },
    armed() { tone({ type: 'square', f: 1200, dur: 0.05, vol: 0.03, lp: 3000 }); tone({ type: 'square', f: 1500, at: 0.08, dur: 0.05, vol: 0.03, lp: 3000 }); },
    boing() {
      tone({ type: 'sine', f: 160, to: 520, dur: 0.18, vol: 0.25 });
      tone({ type: 'sine', f: 520, to: 260, at: 0.16, dur: 0.25, vol: 0.18 });
    },
    bubble() {
      if (!every('bubble', 400)) return;
      tone({ type: 'sine', f: 700 + Math.random() * 500, to: 1400, dur: 0.06, vol: 0.03 });
    },
    train() {
      S.horn(1.3);
      tone({ type: 'square', f: 880, dur: 0.12, vol: 0.05, lp: 2400 });
      tone({ type: 'square', f: 880, at: 0.18, dur: 0.12, vol: 0.05, lp: 2400 });
      hiss({ filter: 'bandpass', f: 400, to: 2400, dur: 0.9, vol: 0.2, attack: 0.1 });
    },
    huge() {
      for (let i = 0; i < 2; i++) {
        tone({ type: 'sawtooth', f: 330, to: 660, at: i * 0.7, dur: 0.35, vol: 0.08, lp: 1800 });
        tone({ type: 'sawtooth', f: 660, to: 330, at: i * 0.7 + 0.35, dur: 0.35, vol: 0.08, lp: 1800 });
      }
      [0, 0.25, 0.5].forEach((at) => tone({ f: 120, to: 50, at, dur: 0.2, vol: 0.4 }));
    },
    punch() { S.punch(); },
    swish() { S.swish(); },
    peace() {
      [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.05, dur: 0.25, vol: 0.07 }));
      hiss({ f: 3000, to: 6000, dur: 0.4, vol: 0.05, attack: 0.05 });
    },
    whoosh() { hiss({ f: 600, to: 2400, dur: 0.35, vol: 0.12, q: 0.8 }); },
    treat() { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.07, dur: 0.2, vol: 0.1 })); },
    saved() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f, at: i * 0.08, dur: 0.18, vol: 0.05, lp: 3000 }));
      S.punch();
    },
    win() {
      const notes = [523, 659, 784, 1047, 784, 1047, 1319];
      notes.forEach((f, i) => tone({ type: 'square', f, at: i * 0.13, dur: i === notes.length - 1 ? 0.6 : 0.15, vol: 0.07, lp: 3200 }));
      notes.forEach((f, i) => tone({ type: 'triangle', f: f / 2, at: i * 0.13, dur: 0.2, vol: 0.08 }));
    },
    lose() {
      [392, 370, 349, 330].forEach((f, i) => tone({ type: 'sawtooth', f, to: i === 3 ? 280 : f, at: i * 0.38, dur: i === 3 ? 0.9 : 0.34, vol: 0.08, lp: 1100 }));
    },
    munch() {
      if (!every('munch', 180)) return;
      hiss({ filter: 'bandpass', f: 1400, q: 2, dur: 0.06, vol: 0.12 });
    },
    countdown(k) { tone({ type: 'triangle', f: k ? 660 : 990, dur: k ? 0.12 : 0.3, vol: 0.12 }); },
  };

  // When the demo is running, every sound is skipped.
  for (const k of Object.keys(sfx)) {
    if (typeof sfx[k] !== 'function' || k === 'setQuiet') continue;
    const f = sfx[k];
    sfx[k] = (...a) => (quiet ? undefined : f(...a));
  }
  window.BVZ.sfx = sfx;
})();
