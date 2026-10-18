/* Brothers vs Zombies: the worlds, the levels and their zombie waves. Edit away!

   A level:
     id, name     shown on the level select and the level banner
     world        'day' | 'night' | 'pool' (see WORLDS below)
     rows         which lanes are open (0 = back, 4 = front); leave it out for all five
     stars        stars you start with
     first        seconds before the first wave
     gap          seconds between waves (when the lawn is clear the next wave hurries up)
     waves        one string per wave, then
     huge         the final HUGE WAVE!
     unlock       the card you win (see js/units.js), shown on the win screen

   A wave string lists zombies separated by commas:
     'normal'              one zombie
     'normal x3'           three of them (or '3 normal')
     'cone, bucket@2'      @2 puts it in lane 2 (0 = back, 4 = front); otherwise the lane is picked for you
   Zombie types: normal, cone, bucket, skate, balloon, boss. In pool lanes they swim in a rubber-duck ring.
   A wave can also be { z: 'normal x2', wait: 30 } to set its own gap.

   After editing, check every level is still winnable:  node tools/check.js */
(function (root) {
  'use strict';
  const BVZ = (root.BVZ = root.BVZ || {});

  BVZ.WORLDS = {
    day: { name: 'Sunny Backyard', emoji: '☀️', sky: 8 }, // a star drops from the sky about every 8 s
    night: { name: 'Moonlight Yard', emoji: '🌙', sky: 11 }, // fewer stars at night
    pool: { name: 'Pool Party', emoji: '🏊', sky: 9, water: [2, 3] }, // lanes 2 and 3 are the pool
  };

  BVZ.START_CARDS = ['ice', 'hoop', 'teddy'];

  BVZ.LEVELS = [
    // ---------------------------------------------------------------- ☀️ Sunny Backyard
    {
      id: '1-1', world: 'day', name: 'Hello, Zombies!', rows: [1, 2, 3], stars: 2, first: 25, gap: 24,
      waves: ['normal', 'normal', 'normal', 'normal x2', 'normal', 'normal x2'],
      huge: 'normal x4',
      unlock: 'bag',
    },
    {
      id: '1-2', world: 'day', name: 'Cookie Smell', rows: [1, 2, 3], stars: 2, first: 22, gap: 22,
      waves: ['normal', 'normal', 'normal x2', 'normal', 'normal x2', 'normal x2', 'normal x3'],
      huge: 'normal x5',
      unlock: 'popcorn',
    },
    {
      id: '1-3', world: 'day', name: 'Cone Party', stars: 2, first: 22, gap: 22,
      waves: ['normal', 'normal', 'cone', 'normal x2', 'normal, cone', 'normal x2', 'cone x2', 'normal x2, cone'],
      huge: 'normal x4, cone x2',
      unlock: 'tommy',
    },
    {
      id: '1-4', world: 'day', name: 'Busy Lawn', stars: 2, first: 22, gap: 21,
      waves: ['normal', 'normal x2', 'cone', 'normal x2', 'cone, normal', 'normal x3', 'cone x2, normal', 'normal x2, cone x2'],
      huge: 'normal x5, cone x3',
      unlock: 'peace',
    },
    {
      id: '1-5', world: 'day', name: 'Boss of the Block', stars: 3, first: 20, gap: 21,
      waves: ['normal', 'normal, cone', 'normal x2', 'cone x2', 'normal x3', 'cone, normal x2', 'normal x2, cone x2', 'cone x3'],
      huge: 'boss, normal x4, cone x2',
      unlock: 'bubble',
    },
    // ---------------------------------------------------------------- 🌙 Moonlight Yard
    {
      id: '2-1', world: 'night', name: 'Night Shift', stars: 3, first: 22, gap: 22,
      waves: ['normal', 'normal', 'cone', 'normal x2', 'bucket', 'normal x2, cone', 'bucket, normal', 'cone x2, normal x2'],
      huge: 'normal x4, cone x2, bucket',
      unlock: 'bounce',
    },
    {
      id: '2-2', world: 'night', name: 'Skate Night', stars: 3, first: 22, gap: 22,
      waves: ['normal', 'skate', 'normal x2', 'cone, skate', 'normal x2', 'bucket, skate', 'normal x2, cone', 'skate x2, cone'],
      huge: 'normal x4, skate x2, cone x2, bucket',
    },
    {
      id: '2-3', world: 'night', name: 'Bucket Brigade', stars: 3, first: 22, gap: 22,
      waves: ['normal', 'cone', 'bucket', 'normal x2', 'skate, cone', 'bucket, normal x2', 'cone x2, skate', 'bucket x2', 'normal x3, cone'],
      huge: 'normal x4, cone x2, bucket x2, skate x2',
      unlock: 'double',
    },
    {
      id: '2-4', world: 'night', name: 'Balloon Night', stars: 3, first: 22, gap: 22,
      waves: ['normal', 'balloon', 'normal x2', 'cone, balloon', 'bucket', 'balloon x2, normal', 'skate, cone x2', 'bucket, balloon, normal x2'],
      huge: 'normal x4, cone x2, bucket, balloon x2, skate',
    },
    {
      id: '2-5', world: 'night', name: 'Big Bedtime Boss', stars: 4, first: 20, gap: 22,
      waves: ['normal', 'cone, normal', 'skate, normal', 'bucket', 'balloon, cone', 'normal x3', 'bucket, skate', 'cone x2, balloon', 'normal x2, bucket'],
      huge: 'boss, normal x4, cone x2, bucket, skate',
      unlock: 'floatie',
    },
    // ---------------------------------------------------------------- 🏊 Pool Party
    {
      id: '3-1', world: 'pool', name: 'Splash Zone', stars: 3, first: 22, gap: 22,
      waves: ['normal', 'normal', 'cone', 'normal x2', 'normal, cone', 'bucket', 'normal x2, cone', 'cone x2, normal'],
      huge: 'normal x5, cone x2, bucket',
    },
    {
      id: '3-2', world: 'pool', name: 'Pool Noodles', stars: 3, first: 22, gap: 22,
      waves: ['normal', 'skate', 'normal x2', 'cone, skate', 'bucket', 'normal x2, skate', 'cone x2, normal', 'bucket, skate, normal'],
      huge: 'normal x4, cone x2, skate x2, bucket',
    },
    {
      id: '3-3', world: 'pool', name: 'Cannonball!', stars: 3, first: 22, gap: 21,
      waves: ['normal', 'cone', 'normal x2', 'bucket', 'cone x2', 'normal x2, skate', 'bucket, cone', 'normal x3, cone', 'bucket x2'],
      huge: 'normal x5, cone x3, bucket x2',
    },
    {
      id: '3-4', world: 'pool', name: 'Balloon Float', stars: 3, first: 22, gap: 21,
      waves: ['normal', 'balloon', 'normal x2', 'cone, balloon', 'bucket, normal', 'balloon x2', 'skate, cone, normal', 'bucket, balloon x2', 'cone x2, normal x2'],
      huge: 'normal x4, cone x2, bucket, balloon x3, skate',
    },
    {
      id: '3-5', world: 'pool', name: 'King of the Pool', stars: 4, first: 20, gap: 22,
      waves: ['normal', 'cone, normal', 'skate', 'bucket, normal', 'balloon, cone', 'normal x3', 'bucket, skate', 'cone x2, balloon', 'bucket x2', 'normal x3, cone'],
      huge: 'boss, normal x5, cone x2, bucket x2, balloon',
    },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
