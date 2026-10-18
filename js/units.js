/* Brothers vs Zombies: the defender cards and the zombies. Change the numbers here to change how the game feels.

   Stars ⭐ are the money: every star from the sky or from an Ice Cream Stand is worth 1.
   Sizes and speeds are in lawn cells (the lawn is 9 cells long), times are in seconds.
   "hp" is how many basketballs it takes (zombies), or how many seconds one zombie needs to knock it over (defenders). */
(function (root) {
  'use strict';
  const BVZ = (root.BVZ = root.BVZ || {});

  // The order the cards appear in along the top bar. Heroes always sit at the end.
  BVZ.CARD_ORDER = ['ice', 'hoop', 'bag', 'popcorn', 'peace', 'bubble', 'bounce', 'double', 'floatie', 'teddy', 'tommy'];

  BVZ.CARDS = {
    ice: {
      name: 'Ice Cream Stand', short: 'ICE CREAM', emoji: '🍦', cost: 2, recharge: 7.5, hp: 5,
      first: [4, 7], every: 20, // first star after 4 to 7 s, then one every 20 s
      tip: 'Makes a ⭐ star every so often. Build lots of these first!',
    },
    hoop: {
      name: 'Hoop Shooter', short: 'HOOP', emoji: '🏀', cost: 3, recharge: 7.5, hp: 5,
      every: 1.5, damage: 1,
      tip: 'Shoots basketballs at zombies in its lane.',
    },
    bag: {
      name: 'Punching Bag Wall', short: 'BAG', emoji: '🥊', cost: 2, recharge: 25, hp: 50,
      tip: 'Super tough. Zombies get stuck bonking it.',
    },
    popcorn: {
      name: 'Popcorn Mine', short: 'POPCORN', emoji: '🍿', cost: 1, recharge: 25, hp: 5,
      arm: 8, damage: 30, reach: 1.0, // needs 8 s to heat up, then POP! hits every zombie within 1 cell
      tip: 'Heats up, then goes POP! when a zombie steps on it.',
    },
    peace: {
      name: 'Peace Shooter', short: 'PEACE', emoji: '✌️', cost: 5, recharge: 7.5, hp: 5,
      every: 1.5, damage: 1, slow: 5, // a star hit makes the zombie slow for 5 s
      tip: 'Fires ⭐ stars that make zombies slow and sleepy.',
    },
    bubble: {
      name: 'Bubble Machine', short: 'BUBBLES', emoji: '🫧', cost: 3, recharge: 10, hp: 5,
      reach: 5, // zombies up to 5 cells ahead of it walk in slow motion
      tip: 'Blows bubbles down its lane. Zombies in bubbles go slow-mo.',
    },
    bounce: {
      name: 'Bounce Pad', short: 'BOUNCE', emoji: '🤸', cost: 1, recharge: 20,
      push: 3, bossPush: 1, // sends one zombie 3 cells back (the Boss only 1)
      tip: 'BOING! Sends one zombie flying back. Works once.',
    },
    double: {
      name: 'Double Hoop', short: 'DOUBLE', emoji: '⛹️', cost: 6, recharge: 10, hp: 5,
      every: 1.5, damage: 1, shots: 2,
      tip: 'Two basketballs at a time!',
    },
    floatie: {
      name: 'Pool Floatie', short: 'FLOATIE', emoji: '🛟', cost: 1, recharge: 5, hp: 5, water: true,
      tip: 'Put one on the pool, then build on top of it.',
    },
    teddy: {
      name: 'Teddy', short: 'TEDDY', emoji: '🥊', cost: 3, recharge: 45, hero: true,
      time: 14, speed: 1.4, damage: 2, punch: 0.32, // walks down a lane for 14 s, a punch every 0.32 s
      tip: 'Teddy walks down a lane boxing zombies: jab, straight, POW!',
    },
    tommy: {
      name: 'Tommy', short: 'TOMMY', emoji: '✌️', cost: 2, recharge: 35, hero: true,
      push: 2.5, bossPush: 0.8, damage: 2, // his ✌️ wave pushes every zombie in the lane 2.5 cells back
      tip: 'Tommy does his Y pose and a ✌️ wave pushes the zombies back.',
    },
  };

  // The brother you call with the big button (or T): free, as often as you like.
  BVZ.BUDDY = {
    visit: 10, // seconds he stays
    treatStars: 2, // bonus stars with his treat...
    treatStarsEvery: 12, // ...at most once every 12 s (extra taps still bring a treat)
    teddyDamage: 1, teddyPunch: 0.4, // Teddy's jabs
    tommyEvery: 1.8, tommyPush: 1.2, tommyDamage: 1, tommyReach: 2.5, // Tommy's little ✌️ waves
  };

  BVZ.ZOMBIES = {
    normal: { name: 'Zombie', hp: 10, speed: 0.18, bonk: 1 },
    cone: { name: 'Cone-hat Zombie', hp: 10, armor: 16, hat: 'cone', speed: 0.18, bonk: 1 },
    bucket: { name: 'Bucket-hat Zombie', hp: 10, armor: 40, hat: 'bucket', speed: 0.18, bonk: 1 },
    // rides fast until it bumps into something, then the board flies off and it walks
    skate: { name: 'Skateboard Zombie', hp: 10, speed: 0.18, skateSpeed: 0.45, hat: 'helmet', bonk: 1 },
    // floats over defenders; any hit pops the balloon and down it comes
    balloon: { name: 'Balloon Zombie', hp: 10, speed: 0.18, floatSpeed: 0.28, balloon: true, bonk: 1 },
    boss: { name: 'Boss Zombie', hp: 200, speed: 0.11, bonk: 10, boss: true },
  };

  // Easy mode (🐣): on by default for Tommy.
  BVZ.EASY = {
    zombieSpeed: 0.75, zombieHp: 0.8, recharge: 0.6, startStars: 3, skyEvery: 0.8, iceEvery: 0.75,
    popcornArm: 0.6, starAutoCollect: 8, // stars never vanish: after 8 s they fly to the counter by themselves
  };
  BVZ.STAR_LIFE = 12; // normal mode: a star on the grass fades after 12 s
})(typeof window !== 'undefined' ? window : globalThis);
