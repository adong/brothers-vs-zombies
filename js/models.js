/* Brothers vs Zombies: everything you see, built from boxes, spheres and canvas textures (no image files).
   The yard for each world, the defenders, zombie hats and props, the mini-trains, projectiles and effect textures.
   Exposes BVZ.M. World units are metres: a lawn cell is CW wide (x) and RD deep (z); people are about 2 m tall. */
(function () {
  'use strict';
  const T = THREE;
  const BVZ = window.BVZ;
  const { makeCanvas, toTexture, shade, roundRect, FONT } = Kit.gfx;

  const CW = 2.0, RD = 1.9;
  const X = (x) => x * CW;
  const Z = (r) => (r - 2) * RD;

  // ---------------------------------------------------------------- small helpers
  const matCache = {};
  function mat(color, o) {
    const key = color + (o ? JSON.stringify(o) : '');
    if (!o || !o.map) if (matCache[key]) return matCache[key];
    const m = new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.65, metalness: 0 }, o));
    if (!o || !o.map) {
      matCache[key] = m;
      m.userData.shared = true;
    }
    return m;
  }
  const basic = (color, o) => {
    const m = new T.MeshBasicMaterial(Object.assign({ color }, o));
    m.userData.shared = true;
    return m;
  };
  const geoCache = {};
  const geo = (key, make) => {
    if (!geoCache[key]) {
      geoCache[key] = make();
      geoCache[key].userData.shared = true; // cached: never disposed with a model
    }
    return geoCache[key];
  };
  function add(g, m, x, y, z, parent) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }
  const box = (w, h, d, m, x, y, z, p) => add(geo(`b${w},${h},${d}`, () => new T.BoxGeometry(w, h, d)), m, x, y, z, p);
  const ball = (r, m, x, y, z, p, seg = 14) => add(geo(`s${r},${seg}`, () => new T.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0))), m, x, y, z, p);
  const cyl = (rt, rb, h, m, x, y, z, p, seg = 14) => add(geo(`c${rt},${rb},${h},${seg}`, () => new T.CylinderGeometry(rt, rb, h, seg)), m, x, y, z, p);
  const torus = (r, t, m, x, y, z, p, arc = Math.PI * 2) => add(geo(`t${r},${t},${arc}`, () => new T.TorusGeometry(r, t, 8, 24, arc)), m, x, y, z, p);

  function stripes(c1, c2, n = 8, vertical = true, w = 128, h = 64) {
    const [c, g] = makeCanvas(w, h);
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? c2 : c1;
      if (vertical) g.fillRect((i * w) / n, 0, w / n + 1, h);
      else g.fillRect(0, (i * h) / n, w, h / n + 1);
    }
    return toTexture(c);
  }

  // cute googly eyes looking toward the camera, a little to the right (where the zombies come from)
  const eyeWhite = basic('#ffffff'), eyeDark = basic('#1b1a22');
  function eyes(parent, x, y, z, s = 1, gap = 0.17) {
    const g = new T.Group();
    g.position.set(x, y, z);
    for (const side of [-1, 1]) {
      const e = ball(0.085 * s, eyeWhite, side * gap * s, 0, 0, g, 10);
      e.scale.z = 0.6;
      ball(0.045 * s, eyeDark, side * gap * s + 0.025 * s, -0.005, 0.05 * s, g, 8);
    }
    parent.add(g);
    return g;
  }

  // ---------------------------------------------------------------- textures
  const texCache = {};
  const memo = (k, f) => texCache[k] || (texCache[k] = f());

  function ballTexture() {
    return memo('ball', () => {
      const [c, g] = makeCanvas(128, 64);
      g.fillStyle = '#f07f22';
      g.fillRect(0, 0, 128, 64);
      g.strokeStyle = '#2b1608';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 32); g.lineTo(128, 32); g.stroke();
      for (const x of [32, 96]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
      g.beginPath(); g.ellipse(64, 32, 18, 30, 0, 0, Math.PI * 2); g.stroke();
      return toTexture(c);
    });
  }

  // The ⭐ money: a chubby yellow star with a happy face and a soft glow.
  function starTexture() {
    return memo('star', () => {
      const [c, g] = makeCanvas(128, 128);
      const glow = g.createRadialGradient(64, 66, 10, 64, 66, 64);
      glow.addColorStop(0, 'rgba(255,240,150,0.9)');
      glow.addColorStop(0.5, 'rgba(255,220,80,0.35)');
      glow.addColorStop(1, 'rgba(255,220,80,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, 128, 128);
      starPath(g, 64, 68, 46, 21);
      g.fillStyle = '#ffd21f';
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = '#e08a00';
      g.stroke();
      g.fillStyle = '#fff6b8';
      starPath(g, 58, 60, 18, 8);
      g.fill();
      g.fillStyle = '#3a2410';
      g.beginPath(); g.ellipse(55, 66, 4, 6, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(73, 66, 4, 6, 0, 0, Math.PI * 2); g.fill();
      g.lineWidth = 3.5;
      g.beginPath(); g.arc(64, 74, 8, 0.2, Math.PI - 0.2); g.stroke();
      g.fillStyle = 'rgba(255,120,120,0.6)';
      g.beginPath(); g.arc(47, 76, 4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(81, 76, 4, 0, Math.PI * 2); g.fill();
      return toTexture(c);
    });
  }

  function starPath(g, cx, cy, R, r, n = 5) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r : R;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
  }

  // The Peace Shooter's sleepy-blue star.
  function peaceStarTexture() {
    return memo('pstar', () => {
      const [c, g] = makeCanvas(64, 64);
      const glow = g.createRadialGradient(32, 32, 4, 32, 32, 32);
      glow.addColorStop(0, 'rgba(200,240,255,1)');
      glow.addColorStop(1, 'rgba(120,200,255,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, 64, 64);
      starPath(g, 32, 33, 24, 10);
      g.fillStyle = '#9fe8ff';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#ffffff';
      g.stroke();
      return toTexture(c);
    });
  }

  function sparkTexture() {
    return memo('spark', () => {
      const [c, g] = makeCanvas(64, 64);
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.2, 'rgba(255,255,255,0.8)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#ffffff';
      starPath(g, 32, 32, 30, 6, 4);
      g.fill();
      return toTexture(c);
    });
  }

  function bubbleTexture() {
    return memo('bubble', () => {
      const [c, g] = makeCanvas(64, 64);
      const gr = g.createRadialGradient(32, 32, 18, 32, 32, 30);
      gr.addColorStop(0, 'rgba(180,230,255,0.08)');
      gr.addColorStop(0.8, 'rgba(200,160,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(32, 32, 27, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.ellipse(22, 20, 7, 4, -0.6, 0, Math.PI * 2); g.fill();
      return toTexture(c);
    });
  }

  function shadowTexture() {
    return memo('shadow', () => {
      const [c, g] = makeCanvas(64, 64);
      const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,0,0,0.42)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return toTexture(c);
    });
  }

  // Comic word bursts: POW! BOP! POP! BOING! POOF! ...
  const burstColors = { 'POW!': '#ffd21f', 'BOP!': '#7fe0ff', 'BONK!': '#ffd21f', 'POP!': '#ffffff', 'BOING!': '#8cff7a', 'POOF!': '#ffe680', 'SWISH!': '#ffb02e', 'WHOOSH!': '#bfe6ff', 'YAY!': '#ff9bd2', 'PLINK!': '#d0d8ff', 'BAM!': '#ff8a5c', 'TOOT TOOT!': '#ffe066' };
  function burstTexture(word) {
    return memo('burst' + word, () => {
      const [c, g] = makeCanvas(256, 160);
      g.translate(128, 80);
      g.beginPath();
      const n = 14;
      for (let i = 0; i < n * 2; i++) {
        const a = (i * Math.PI) / n, r = i % 2 ? 52 : 78;
        g.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.95);
      }
      g.closePath();
      g.fillStyle = burstColors[word] || '#ffd21f';
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = '#1b1a22';
      g.stroke();
      g.font = `${word.length > 6 ? 30 : 42}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 8;
      g.strokeStyle = '#ffffff';
      g.strokeText(word, 0, 4);
      g.fillStyle = '#e8331f';
      g.fillText(word, 0, 4);
      return toTexture(c);
    });
  }

  // A bar for the Boss's health, redrawn as he loses it.
  function hpBar() {
    const [c, g] = makeCanvas(128, 24);
    const tex = toTexture(c);
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.scale.set(1.6, 0.3, 1);
    s.renderOrder = 5;
    s.userData.draw = (k) => {
      g.clearRect(0, 0, 128, 24);
      g.fillStyle = '#1b1a22';
      roundRect(g, 2, 2, 124, 20, 10);
      g.fill();
      g.fillStyle = k > 0.5 ? '#7bd93f' : k > 0.25 ? '#ffc21f' : '#ff5a3c';
      roundRect(g, 5, 5, Math.max(10, 118 * k), 14, 7);
      g.fill();
      tex.needsUpdate = true;
    };
    s.userData.draw(1);
    return s;
  }

  // ---------------------------------------------------------------- the yard

  const WORLD_LOOK = {
    day: { sky: '#9fd8ff', ground: '#5fa83e', grassA: '#86d35a', grassB: '#73c24a', fog: '#bfe6ff', hemi: ['#ffffff', '#6a7a4a', 1.0], sun: ['#fff4dc', 1.0], house: '#f6e3c3', roof: '#c4553c', glass: '#bfe3ff', fence: '#ffffff' },
    night: { sky: '#1b2350', ground: '#2c5a3c', grassA: '#4d8f4a', grassB: '#437f40', fog: '#26306a', hemi: ['#a9b8ff', '#26334a', 0.75], sun: ['#c9d4ff', 0.55], house: '#bfb3a3', roof: '#7a3b33', glass: '#ffd97a', fence: '#d9d4e8' },
    pool: { sky: '#8fdcff', ground: '#6bb64a', grassA: '#8edc60', grassB: '#7bcb50', fog: '#c6f0ff', hemi: ['#ffffff', '#6a8a6a', 1.0], sun: ['#fff8e8', 1.05], house: '#fff0d6', roof: '#3c8fc4', glass: '#c8f0ff', fence: '#ffffff' },
  };

  function lawnTexture(look, rows, water) {
    const [c, g] = makeCanvas(9 * 64, 5 * 64);
    for (let r = 0; r < 5; r++) {
      for (let col = 0; col < 9; col++) {
        const x = col * 64, y = r * 64;
        if (!rows.includes(r)) {
          g.fillStyle = (r + col) % 2 ? '#a77a4e' : '#9b7046';
          g.fillRect(x, y, 64, 64);
          g.fillStyle = 'rgba(60,35,15,0.35)';
          for (let i = 0; i < 6; i++) g.fillRect(x + ((i * 23 + col * 7) % 58), y + ((i * 37 + r * 11) % 58), 5, 3);
          continue;
        }
        if (water.includes(r)) {
          g.fillStyle = '#5ab9e8';
          g.fillRect(x, y, 64, 64);
          continue;
        }
        g.fillStyle = (r + col) % 2 ? look.grassA : look.grassB;
        g.fillRect(x, y, 64, 64);
        g.fillStyle = 'rgba(255,255,255,0.06)';
        g.fillRect(x, y, 64, 6);
        g.fillStyle = 'rgba(0,40,0,0.10)';
        for (let i = 0; i < 9; i++) g.fillRect(x + ((i * 19 + col * 13) % 60), y + ((i * 29 + r * 17) % 58), 2, 6);
      }
    }
    const t = toTexture(c);
    t.magFilter = T.NearestFilter;
    return t;
  }

  function waterTexture() {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = '#3fb0e6';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const y = (i * 41) % 128, x = (i * 67) % 128;
      g.beginPath();
      g.moveTo(x - 14, y);
      g.quadraticCurveTo(x, y - 6, x + 14, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 6; i++) g.fillRect((i * 53) % 128, (i * 31) % 128, 20, 3);
    return toTexture(c, true);
  }

  // Builds the whole backyard for a world. Returns { group, porch, jar, trainSpots, update(t) }.
  function buildYard(world, rows, water) {
    const look = WORLD_LOOK[world];
    const yard = new T.Group();
    const anim = [];

    // ground all around, and the lawn grid
    const ground = new T.Mesh(new T.PlaneGeometry(220, 160), mat(look.ground));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(9, -0.02, 0);
    yard.add(ground);
    const lawn = new T.Mesh(new T.PlaneGeometry(9 * CW, 5 * RD), new T.MeshStandardMaterial({ map: lawnTexture(look, rows, water), roughness: 0.9 }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(X(4.5), 0, 0);
    yard.add(lawn);
    // a soft edge along the lawn: little brick border
    const brick = mat('#c96f4a');
    box(9 * CW + 0.3, 0.12, 0.18, brick, X(4.5), 0.05, Z(-0.5) - 0.02, yard);
    box(9 * CW + 0.3, 0.12, 0.18, brick, X(4.5), 0.05, Z(4.5) + 0.02, yard);

    // the pool
    if (water.length) {
      const z0 = Z(Math.min(...water)) - RD / 2, z1 = Z(Math.max(...water)) + RD / 2;
      const tex = waterTexture();
      tex.repeat.set(9, 2);
      const wmat = new T.MeshStandardMaterial({ map: tex, color: '#ffffff', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
      const w = new T.Mesh(new T.PlaneGeometry(9 * CW, z1 - z0), wmat);
      w.rotation.x = -Math.PI / 2;
      w.position.set(X(4.5), -0.12, (z0 + z1) / 2);
      yard.add(w);
      const tile = mat('#f4fbff');
      box(9 * CW + 0.6, 0.14, 0.3, tile, X(4.5), 0.02, z0 - 0.05, yard);
      box(9 * CW + 0.6, 0.14, 0.3, tile, X(4.5), 0.02, z1 + 0.05, yard);
      box(0.3, 0.14, z1 - z0 + 0.4, tile, X(9) + 0.15, 0.02, (z0 + z1) / 2, yard);
      box(0.3, 0.14, z1 - z0 + 0.4, tile, -0.15, 0.02, (z0 + z1) / 2, yard);
      // a lane rope between the pool lanes, red and white floats
      for (let i = 1; i < water.length; i++) {
        const zr = Z(water[i]) - RD / 2;
        for (let k = 0; k < 36; k++) ball(0.07, mat(k % 2 ? '#ff4d4d' : '#ffffff'), 0.25 + k * 0.5, -0.06, zr, yard, 8);
      }
      // the pool walls under the water
      const deep = mat('#2a86c0');
      box(9 * CW, 0.6, 0.05, deep, X(4.5), -0.4, z0, yard);
      const bottom = new T.Mesh(new T.PlaneGeometry(9 * CW, z1 - z0), mat('#2a95cf'));
      bottom.rotation.x = -Math.PI / 2;
      bottom.position.set(X(4.5), -0.7, (z0 + z1) / 2);
      yard.add(bottom);
      anim.push((t) => { tex.offset.x = (t * 0.03) % 1; tex.offset.y = Math.sin(t * 0.7) * 0.04; });
      // a rubber duck bobbing in the corner
      const duck = rubberDuck(0.5);
      duck.position.set(X(8.75), -0.05, z1 - 0.35);
      yard.add(duck);
      anim.push((t) => { duck.position.y = -0.05 + Math.sin(t * 2) * 0.04; duck.rotation.y = Math.sin(t * 0.6) * 0.4 - 0.6; });
    }

    // the house, on the left, its front door facing the lawn
    const house = new T.Group();
    house.position.set(-6.8, 0, 0);
    yard.add(house);
    const wall = mat(look.house);
    box(7, 4.4, 15, wall, 0, 2.2, 0, house);
    // roof: a long triangular prism
    const roofShape = new T.Shape();
    roofShape.moveTo(-4.1, 0); roofShape.lineTo(4.1, 0); roofShape.lineTo(0, 2.6); roofShape.closePath();
    const roofGeo = new T.ExtrudeGeometry(roofShape, { depth: 15.8, bevelEnabled: false });
    roofGeo.translate(0, 0, -7.9);
    const roof = new T.Mesh(roofGeo, mat(look.roof));
    roof.position.set(0, 4.4, 0);
    house.add(roof);
    const trim = mat('#ffffff');
    box(0.12, 0.2, 15.2, trim, 3.55, 4.35, 0, house);
    // door, windows (glowing at night), a little lamp
    box(0.12, 2.3, 1.3, mat('#7a4a2a'), 3.55, 1.15 + 0.25, 0.0, house);
    box(0.16, 0.12, 0.12, mat('#ffd21f'), 3.63, 1.3, 0.42, house);
    const glass = world === 'night' ? basic(look.glass) : mat(look.glass, { roughness: 0.2, metalness: 0.2 });
    for (const z of [-4.6, -2.3, 2.3, 4.6]) {
      box(0.1, 1.3, 1.3, trim, 3.53, 2.5, z, house);
      box(0.12, 1.08, 1.08, glass, 3.56, 2.5, z, house);
      box(0.14, 0.08, 1.08, trim, 3.58, 2.5, z, house);
      box(0.14, 1.08, 0.08, trim, 3.58, 2.5, z, house);
    }
    // the front face (toward the camera) gets windows too
    for (const x of [-2, 1.2]) {
      box(1.3, 1.3, 0.1, trim, x, 2.4, 7.53, house);
      box(1.08, 1.08, 0.12, glass, x, 2.4, 7.56, house);
    }
    // porch, table and the cookie jar the zombies are after
    const wood = mat('#b9814f');
    box(1.6, 0.25, 5.0, wood, 4.3, 0.125, 0.3, house);
    // a striped awning over the door (no porch roof: it would hide the cookie jar from the camera)
    const awning = new T.Mesh(new T.BoxGeometry(0.8, 0.08, 1.5), new T.MeshStandardMaterial({ map: stripes('#ff6b6b', '#ffffff', 10), roughness: 0.7 }));
    awning.position.set(3.95, 2.9, 0);
    awning.rotation.z = -0.35;
    house.add(awning);
    const jar = cookieJar();
    jar.position.set(4.25, 0.25 + 0.75, 2.2);
    house.add(jar);
    box(0.7, 0.06, 0.7, wood, 4.25, 0.95, 2.2, house);
    cyl(0.05, 0.05, 0.7, wood, 4.25, 0.6, 2.2, house, 6);
    if (world === 'night') {
      const lamp = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.glowTexture(), color: '#ffd27a', transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      lamp.scale.set(2.6, 2.6, 1);
      lamp.position.set(3.75, 2.3, -1.6);
      house.add(lamp);
      ball(0.13, basic('#fff1b8'), 3.7, 2.3, -1.6, house, 8);
    }

    // mini-train tracks in front of the porch, one for each open lane
    const rail = mat('#8a8f99', { metalness: 0.5, roughness: 0.4 }), sleeper = mat('#6b4a32');
    for (const r of rows) {
      for (const dz of [-0.28, 0.28]) box(2.0, 0.06, 0.06, rail, -1.25, 0.04, Z(r) + dz, yard);
      for (let i = 0; i < 5; i++) box(0.16, 0.04, 0.82, sleeper, -2.05 + i * 0.4, 0.02, Z(r), yard);
    }

    // back fence with bushes and trees behind it, string lights at night
    const fenceZ = Z(-0.5) - 0.9;
    const pickets = new T.InstancedMesh(geo('picket', () => new T.BoxGeometry(0.16, 1.3, 0.06)), mat(look.fence), 70);
    const m4 = new T.Matrix4();
    for (let i = 0; i < 70; i++) {
      m4.makeTranslation(-3 + i * 0.36, 0.65, fenceZ);
      pickets.setMatrixAt(i, m4);
    }
    yard.add(pickets);
    box(25.4, 0.1, 0.05, mat(look.fence), 9.4, 0.95, fenceZ + 0.05, yard);
    box(25.4, 0.1, 0.05, mat(look.fence), 9.4, 0.35, fenceZ + 0.05, yard);
    const leaf = mat(world === 'night' ? '#2f6b3b' : '#3f9a45'), leaf2 = mat(world === 'night' ? '#285c33' : '#4fb04f');
    for (let i = 0; i < 14; i++) {
      const b = ball(0.9 + (i % 3) * 0.2, i % 2 ? leaf : leaf2, -2 + i * 1.75, 0.6, fenceZ - 1.0 - (i % 2) * 0.4, yard, 10);
      b.scale.y = 0.8;
    }
    for (const [x, s] of [[1.5, 1], [9, 1.25], [15.5, 1.05]]) tree(yard, x, fenceZ - 2.6, s, leaf, leaf2);
    if (world === 'night') {
      const cols = ['#ff6b6b', '#ffd93b', '#6bff9a', '#6bc8ff', '#ff8bf0'];
      for (let i = 0; i < 26; i++) {
        const x = -2.5 + i * 0.95;
        ball(0.07, basic(cols[i % 5]), x, 1.5 + Math.sin(i * 1.3) * 0.05 - ((i % 2) * 0.08), fenceZ + 0.06, yard, 6);
      }
      box(25, 0.02, 0.02, mat('#333333'), 9.4, 1.55, fenceZ + 0.05, yard);
      // moon, high up behind the trees
      const moon = new T.Sprite(new T.SpriteMaterial({ map: moonTexture(), transparent: true, depthWrite: false, fog: false }));
      moon.scale.set(5, 5, 1);
      moon.position.set(17, 8.5, fenceZ - 9);
      yard.add(moon);
      // fireflies
      const flies = fireflies(40);
      yard.add(flies.points);
      anim.push(flies.update);
    }

    // a flower bed along the front edge
    const petals = ['#ff6b9a', '#ffd23b', '#ffffff', '#b38bff', '#ff8a3c'];
    for (let i = 0; i < 30; i++) {
      const x = 0.2 + i * 0.62 + ((i * 37) % 5) * 0.05, z = Z(4.5) + 0.55 + ((i * 13) % 3) * 0.12;
      cyl(0.02, 0.02, 0.3, mat('#3f8f3f'), x, 0.15, z, yard, 5);
      ball(0.1, mat(petals[i % 5]), x, 0.32, z, yard, 8);
    }
    box(18.4, 0.08, 0.9, mat('#7a5232'), X(4.5), 0.02, Z(4.5) + 0.65, yard);

    // the sidewalk and the street on the right, where the zombies come from
    box(1.8, 0.1, 30, mat('#cfcfc6'), X(9) + 1.0, 0.03, 0, yard);
    box(9, 0.04, 30, mat(world === 'night' ? '#2a2b33' : '#4a4c55'), X(9) + 6.4, 0.0, 0, yard);
    for (let i = 0; i < 9; i++) box(0.14, 0.05, 1.2, mat('#ffd23b'), X(9) + 5.5, 0.02, -12 + i * 3, yard);
    // a street lamp and a mailbox
    cyl(0.07, 0.09, 3.6, mat('#3a3d46'), X(9) + 1.6, 1.8, Z(-0.5) - 0.3, yard, 8);
    box(0.5, 0.25, 0.3, mat('#3a3d46'), X(9) + 1.4, 3.6, Z(-0.5) - 0.3, yard);
    const bulb = ball(0.14, world === 'night' ? basic('#fff3b0') : mat('#fffbe0'), X(9) + 1.25, 3.45, Z(-0.5) - 0.3, yard, 8);
    if (world === 'night') {
      const glow = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.glowTexture(), color: '#ffe9a0', transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      glow.scale.set(3, 3, 1);
      glow.position.copy(bulb.position);
      yard.add(glow);
    }
    cyl(0.05, 0.05, 1.0, mat('#6b4a32'), X(9) + 0.6, 0.5, Z(4.5) + 0.7, yard, 6);
    box(0.32, 0.3, 0.5, mat('#2f6fd0'), X(9) + 0.6, 1.1, Z(4.5) + 0.7, yard);

    // pool world: a beach umbrella and a lounge chair by the house
    if (water.length) {
      const um = new T.Group();
      um.position.set(-1.6, 0, Z(-0.5) - 0.2);
      cyl(0.04, 0.04, 2.3, mat('#ffffff'), 0, 1.15, 0, um, 6);
      const top = new T.Mesh(new T.ConeGeometry(1.1, 0.5, 10, 1, true), new T.MeshStandardMaterial({ map: stripes('#ff5d73', '#ffffff', 10), side: T.DoubleSide }));
      top.position.y = 2.3;
      um.add(top);
      yard.add(um);
    }

    return {
      group: yard,
      jar,
      porch: new T.Vector3(-2.55, 0.25, 1.0), // you stand here, out from under the awning so the camera sees you
      jarPos: new T.Vector3(-6.8 + 4.25, 1.2, 2.2),
      update: (t) => anim.forEach((f) => f(t)),
    };
  }

  function tree(parent, x, z, s, leaf, leaf2) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    box(0.4, 2.2, 0.4, mat('#7a5232'), 0, 1.1, 0, g);
    box(2.2, 1.3, 2.2, leaf, 0, 2.6, 0, g);
    box(1.6, 1.0, 1.6, leaf2, 0.1, 3.5, 0.1, g);
    parent.add(g);
  }

  function moonTexture() {
    const [c, g] = makeCanvas(128, 128);
    const glow = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    glow.addColorStop(0, 'rgba(255,250,220,0.8)');
    glow.addColorStop(1, 'rgba(255,250,220,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#fff6d0';
    g.beginPath(); g.arc(64, 64, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(200,190,150,0.6)';
    for (const [x, y, r] of [[54, 56, 6], [74, 70, 8], [60, 78, 4]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    return toTexture(c);
  }

  function fireflies(n) {
    const g = new T.BufferGeometry();
    const pos = new Float32Array(n * 3), seed = [];
    for (let i = 0; i < n; i++) seed.push([Math.random() * 22 - 2, 0.4 + Math.random() * 2, Math.random() * 11 - 6, Math.random() * 6]);
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    const points = new T.Points(g, new T.PointsMaterial({ map: sparkTexture(), color: '#d8ff7a', size: 0.35, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    return {
      points,
      update(t) {
        for (let i = 0; i < n; i++) {
          const [x, y, z, p] = seed[i];
          pos[i * 3] = x + Math.sin(t * 0.3 + p) * 0.8;
          pos[i * 3 + 1] = y + Math.sin(t * 0.9 + p * 2) * 0.3;
          pos[i * 3 + 2] = z + Math.cos(t * 0.25 + p) * 0.6;
        }
        g.attributes.position.needsUpdate = true;
        points.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;
      },
    };
  }

  function cookieJar() {
    const g = new T.Group();
    const jarMat = new T.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: 0.45, roughness: 0.1 });
    cyl(0.3, 0.3, 0.55, jarMat, 0, 0.28, 0, g);
    const lid = cyl(0.32, 0.32, 0.08, mat('#e8463c'), 0, 0.6, 0, g);
    ball(0.07, mat('#e8463c'), 0, 0.68, 0, g, 8);
    const cookie = mat('#c98a4a'), chip = mat('#4a2a14');
    for (let i = 0; i < 4; i++) {
      const c = cyl(0.2, 0.2, 0.05, cookie, (i % 2) * 0.05 - 0.02, 0.08 + i * 0.11, 0, g, 12);
      c.rotation.z = (i % 2 ? 0.15 : -0.12);
      for (let k = 0; k < 3; k++) box(0.04, 0.02, 0.04, chip, Math.cos(k * 2.1) * 0.1, 0.105 + i * 0.11, Math.sin(k * 2.1) * 0.1, g);
    }
    g.userData.lid = lid;
    return g;
  }

  function rubberDuck(s) {
    const g = new T.Group();
    const y = mat('#ffd21f');
    const body = ball(0.3 * s, y, 0, 0.18 * s, 0, g, 12);
    body.scale.set(1.25, 0.8, 1);
    ball(0.18 * s, y, 0.22 * s, 0.42 * s, 0, g, 12);
    box(0.14 * s, 0.05 * s, 0.12 * s, mat('#ff8a1f'), 0.4 * s, 0.4 * s, 0, g);
    for (const z of [-0.1, 0.1]) ball(0.03 * s, eyeDark, 0.33 * s, 0.48 * s, z * s, g, 6);
    return g;
  }

  // ---------------------------------------------------------------- defenders (they face +x, toward the zombies)

  function iceStand() {
    const g = new T.Group();
    const cart = new T.MeshStandardMaterial({ map: stripes('#ffffff', '#ff8fbf', 8), roughness: 0.6 });
    box(1.0, 0.6, 0.74, cart, 0, 0.52, 0, g);
    box(1.12, 0.08, 0.84, mat('#c97c4a'), 0, 0.86, 0, g);
    for (const x of [-0.32, 0.32]) {
      const w = cyl(0.17, 0.17, 0.08, mat('#3a3a44'), x, 0.17, 0.4, g, 12);
      w.rotation.x = Math.PI / 2;
    }
    cyl(0.03, 0.03, 0.8, mat('#ffffff'), -0.38, 1.25, -0.25, g, 6);
    const top = new T.Mesh(geo('umb', () => new T.ConeGeometry(0.5, 0.24, 8, 1, true)), new T.MeshStandardMaterial({ map: stripes('#ff6fa8', '#fff3a0', 8), side: T.DoubleSide }));
    top.position.set(-0.38, 1.66, -0.25);
    g.add(top);
    const treat = new T.Group();
    treat.position.set(0.18, 0.9, 0.05);
    const cone = new T.Mesh(geo('icecone', () => new T.ConeGeometry(0.16, 0.42, 10).rotateX(Math.PI)), mat('#e0a25a'));
    cone.position.y = 0.22;
    treat.add(cone);
    ball(0.2, mat('#ff9cc4'), 0, 0.47, 0, treat, 12);
    ball(0.17, mat('#9ff0cf'), 0, 0.7, 0, treat, 12);
    ball(0.06, mat('#e8333f'), 0, 0.88, 0, treat, 8);
    g.add(treat);
    eyes(g, 0.05, 0.56, 0.38, 1.1);
    g.userData.bob = treat;
    return g;
  }

  function shooter(base, two) {
    const g = new T.Group();
    cyl(0.44, 0.52, 0.3, mat(base), 0, 0.15, 0, g);
    const body = new T.MeshStandardMaterial({ map: ballTexture(), roughness: 0.6 });
    const b = ball(0.42, body, 0, 0.72, 0, g, 16);
    b.scale.set(1, 0.92, 1);
    const gun = new T.Group();
    gun.position.set(0.3, 0.78, 0);
    gun.rotation.z = 0.12;
    for (const z of two ? [-0.17, 0.17] : [0]) {
      const barrel = cyl(0.15, 0.17, 0.55, mat('#33363f'), 0.28, 0, z, gun, 12);
      barrel.rotation.z = -Math.PI / 2;
      const ring = torus(0.15, 0.04, mat('#ff8a1f'), 0.56, 0, z, gun);
      ring.rotation.y = Math.PI / 2;
    }
    g.add(gun);
    // a little backboard and hoop on top
    cyl(0.03, 0.03, 0.55, mat('#dddddd'), -0.25, 1.32, 0, g, 6);
    box(0.06, 0.38, 0.52, mat('#ffffff'), -0.25, 1.62, 0, g);
    box(0.07, 0.16, 0.2, mat('#e8463c'), -0.22, 1.56, 0, g);
    const hoop = torus(0.13, 0.025, mat('#ff6a1f'), -0.08, 1.48, 0, g);
    hoop.rotation.x = Math.PI / 2;
    eyes(g, 0.1, 0.86, 0.36, 1.1);
    g.userData.gun = gun;
    return g;
  }

  function peaceShooter() {
    const g = new T.Group();
    cyl(0.42, 0.5, 0.46, mat('#62d3b0'), 0, 0.23, 0, g);
    cyl(0.44, 0.44, 0.06, mat('#ffffff'), 0, 0.47, 0, g);
    eyes(g, 0.0, 0.26, 0.42, 1.0);
    box(0.16, 0.035, 0.02, eyeDark, 0, 0.14, 0.455, g); // smile
    const hand = new T.Group();
    hand.position.set(0, 0.5, 0);
    hand.rotation.x = -0.15;
    const skin = mat('#f2c9a5');
    cyl(0.13, 0.15, 0.24, skin, 0, 0.12, 0, hand, 10); // wrist
    box(0.46, 0.4, 0.2, skin, 0, 0.42, 0, hand); // palm
    // the ✌️: two long fingers spread wide
    for (const side of [-1, 1]) {
      const f = new T.Group();
      f.position.set(side * 0.12, 0.6, 0);
      f.rotation.z = -side * 0.45;
      box(0.11, 0.58, 0.13, skin, 0, 0.29, 0, f);
      box(0.08, 0.07, 0.02, mat('#ffe3e3'), 0, 0.52, 0.07, f); // fingernail
      hand.add(f);
    }
    // ring finger and pinkie curled down, the thumb across them
    for (const x of [0.06, 0.16]) ball(0.075, skin, x, 0.56, 0.1, hand, 8);
    const thumb = box(0.26, 0.1, 0.11, skin, -0.04, 0.47, 0.14, hand);
    thumb.rotation.z = 0.3;
    g.add(hand);
    g.userData.hand = hand;
    return g;
  }

  function punchingBag() {
    const g = new T.Group();
    const metal = mat('#4a4f5c', { metalness: 0.4, roughness: 0.4 });
    box(0.9, 0.08, 0.9, metal, 0, 0.04, 0, g);
    box(0.12, 2.1, 0.12, metal, -0.42, 1.05, 0, g);
    box(0.62, 0.1, 0.12, metal, -0.15, 2.08, 0, g);
    const bag = new T.Group();
    bag.position.set(0.05, 2.0, 0);
    cyl(0.015, 0.015, 0.36, metal, 0, -0.18, 0, bag, 4);
    const red = new T.MeshStandardMaterial({ color: '#d9322e', roughness: 0.55 });
    cyl(0.34, 0.34, 1.12, red, 0, -0.96, 0, bag, 16);
    cyl(0.35, 0.35, 0.12, mat('#ffffff'), 0, -0.48, 0, bag, 16);
    cyl(0.35, 0.35, 0.08, mat('#1b1a22'), 0, -1.46, 0, bag, 16);
    const face = eyes(bag, 0.06, -0.78, 0.32, 1.2);
    box(0.2, 0.045, 0.02, eyeDark, -0.14, -0.64, 0.335, bag).rotation.z = -0.3; // determined brows
    box(0.2, 0.045, 0.02, eyeDark, 0.26, -0.64, 0.335, bag).rotation.z = 0.3;
    box(0.18, 0.05, 0.02, mat('#7a1a1a'), 0.06, -1.0, 0.338, bag);
    // tape patches, shown as it gets bonked
    const tape = mat('#c8c8c8');
    const patches = [];
    for (const [y, a] of [[-0.75, 0.6], [-1.2, -0.5], [-0.95, 1.4]]) {
      const p = new T.Group();
      box(0.3, 0.07, 0.02, tape, 0, 0, 0, p).rotation.z = 0.7;
      box(0.3, 0.07, 0.02, tape, 0, 0, 0, p).rotation.z = -0.7;
      p.position.set(Math.sin(a) * 0.35, y, Math.cos(a) * 0.35);
      p.rotation.y = a;
      p.visible = false;
      bag.add(p);
      patches.push(p);
    }
    g.add(bag);
    // Teddy's boxing gloves hanging from the bar
    for (const z of [-0.18, 0.18]) {
      cyl(0.008, 0.008, 0.4, mat('#ffffff'), -0.32, 1.84, z, g, 4);
      const glove = ball(0.13, mat('#e53935'), -0.32, 1.56, z, g, 12);
      glove.scale.set(0.9, 1.15, 1.0);
      cyl(0.09, 0.09, 0.1, mat('#ffffff'), -0.32, 1.7, z, g, 10);
    }
    g.userData.bag = bag;
    g.userData.patches = patches;
    g.userData.face = face;
    return g;
  }

  function bubbleMachine() {
    const g = new T.Group();
    const purple = mat('#9b6bff');
    for (const x of [-0.25, 0.25]) for (const z of [-0.22, 0.22]) cyl(0.04, 0.04, 0.2, mat('#5a5f6b'), x, 0.1, z, g, 6);
    box(0.78, 0.62, 0.62, purple, 0, 0.5, 0, g);
    box(0.82, 0.1, 0.66, mat('#c9a8ff'), 0, 0.84, 0, g);
    const ring = torus(0.24, 0.05, mat('#ffffff'), 0.4, 0.52, 0, g);
    ring.rotation.y = Math.PI / 2;
    const fan = new T.Group();
    fan.position.set(0.41, 0.52, 0);
    for (let i = 0; i < 4; i++) {
      const b = box(0.02, 0.36, 0.1, mat('#e6d8ff'), 0, 0, 0, fan);
      b.rotation.x = (i * Math.PI) / 4;
    }
    g.add(fan);
    cyl(0.03, 0.03, 0.5, mat('#ffd21f'), -0.15, 1.12, 0, g, 6);
    const wand = torus(0.14, 0.03, mat('#ffd21f'), -0.15, 1.5, 0, g);
    const tank = new T.Mesh(geo('tank', () => new T.SphereGeometry(0.2, 12, 10)), new T.MeshStandardMaterial({ color: '#9fe2ff', transparent: true, opacity: 0.6, roughness: 0.1 }));
    tank.position.set(0.18, 1.05, 0);
    g.add(tank);
    eyes(g, -0.05, 0.56, 0.32, 1.1);
    g.userData.fan = fan;
    g.userData.wand = wand;
    return g;
  }

  function bouncePad() {
    const g = new T.Group();
    const top = new T.Group();
    top.position.y = 0.28;
    const rim = torus(0.5, 0.07, mat('#1e88e5'), 0, 0, 0, top);
    rim.rotation.x = Math.PI / 2;
    cyl(0.45, 0.45, 0.03, mat('#22232b'), 0, 0, 0, top, 20);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      cyl(0.04, 0.04, 0.3, mat('#5a5f6b'), Math.cos(a) * 0.46, 0.14, Math.sin(a) * 0.46, g, 6);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const sp = cyl(0.025, 0.025, 0.12, mat('#cfd6e0', { metalness: 0.6, roughness: 0.3 }), Math.cos(a) * 0.48, 0, Math.sin(a) * 0.48, top, 4);
      sp.rotation.z = Math.PI / 2;
      sp.rotation.y = -a;
    }
    eyes(top, 0, 0.06, 0.36, 1.0);
    g.add(top);
    g.userData.top = top;
    return g;
  }

  function popcornMine() {
    const g = new T.Group();
    const mound = ball(0.52, mat('#8a5a32'), 0, -0.05, 0, g, 12);
    mound.scale.set(1, 0.38, 1);
    const bucket = new T.Mesh(geo('pcb', () => new T.CylinderGeometry(0.32, 0.23, 0.55, 14, 1, true)), new T.MeshStandardMaterial({ map: stripes('#e8333f', '#ffffff', 10), side: T.DoubleSide, roughness: 0.6 }));
    bucket.position.y = 0.3;
    g.add(bucket);
    cyl(0.23, 0.23, 0.02, mat('#ffffff'), 0, 0.04, 0, g, 12);
    const lid = cyl(0.33, 0.33, 0.06, mat('#e8333f'), 0, 0.58, 0, g, 14);
    const corn = new T.Group();
    corn.position.y = 0.58;
    const pop = mat('#fff6d8');
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4, r = 0.08 + (i % 4) * 0.05;
      const k = ball(0.075, pop, Math.cos(a) * r, 0.02 + (i % 3) * 0.06, Math.sin(a) * r, corn, 6);
      k.scale.set(1, 0.85, 1.1);
    }
    corn.visible = false;
    g.add(corn);
    eyes(g, 0, 0.32, 0.31, 0.9);
    g.userData.lid = lid;
    g.userData.corn = corn;
    g.userData.bucket = bucket;
    return g;
  }

  function floatie() {
    const g = new T.Group();
    const ring = new T.Mesh(geo('floatie', () => new T.TorusGeometry(0.62, 0.2, 10, 24)), new T.MeshStandardMaterial({ map: stripes('#ff7a3c', '#ffffff', 12), roughness: 0.45 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.0;
    g.add(ring);
    const pad = cyl(0.5, 0.5, 0.06, mat('#7fd0ff', { transparent: true, opacity: 0.7 }), 0, 0.08, 0, g, 18);
    pad.renderOrder = 1;
    return g;
  }

  const DEFENDERS = {
    ice: iceStand,
    hoop: () => shooter('#2d6fd0', false),
    double: () => shooter('#2fb36a', true),
    peace: peaceShooter,
    bag: punchingBag,
    bubble: bubbleMachine,
    bounce: bouncePad,
    popcorn: popcornMine,
    floatie,
  };

  function defender(kind) {
    const inner = DEFENDERS[kind]();
    const g = new T.Group();
    inner.rotation.y = 0.18;
    g.add(inner);
    g.userData.inner = inner;
    Object.assign(g.userData, inner.userData);
    return g;
  }

  // ---------------------------------------------------------------- zombie hats and props

  const ZOMBIE_TOPS = ['#6d5a8c', '#5a7d9a', '#8c5a6a', '#6a8c4a', '#9a7a4a'];

  function zombieLook(type, i) {
    const base = Kit.roster.get('zombie').look;
    const look = Object.assign({}, base, { top: ZOMBIE_TOPS[i % ZOMBIE_TOPS.length] });
    if (type === 'boss') Object.assign(look, { belly: true, top: '#7a3fb0', bottom: '#3a2f50' });
    if (type === 'skate') Object.assign(look, { top: '#ff7a3c', shorts: true });
    if (type === 'balloon') Object.assign(look, { top: '#4fa3ff' });
    return look;
  }

  function hat(kind, world) {
    const g = new T.Group();
    if (kind === 'cone') {
      cyl(0.03, 0.28, 0.6, mat('#ff7a1a'), 0, 0.3, 0, g, 14);
      cyl(0.155, 0.19, 0.12, mat('#ffffff'), 0, 0.3, 0, g, 14);
      cyl(0.3, 0.3, 0.05, mat('#ff7a1a'), 0, 0.02, 0, g, 14);
    } else if (kind === 'bucket') {
      cyl(0.27, 0.32, 0.42, mat('#3a8de0'), 0, 0.2, 0, g, 16);
      cyl(0.33, 0.33, 0.04, mat('#2a6fc0'), 0, 0.02, 0, g, 16);
      const h = torus(0.31, 0.02, mat('#ffd21f'), 0, 0.18, 0, g, Math.PI);
      h.rotation.x = Math.PI;
      box(0.12, 0.12, 0.02, mat('#ffd21f'), 0, 0.24, -0.29, g).rotation.z = 0.78;
    } else if (kind === 'helmet') {
      const h = new T.Mesh(geo('helmet', () => new T.SphereGeometry(0.31, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), mat('#e8333f'));
      g.add(h);
      box(0.08, 0.02, 0.6, mat('#ffffff'), 0, 0.31, 0, g);
    } else if (kind === 'crown') {
      const gold = mat('#ffcc1f', { metalness: 0.5, roughness: 0.3 });
      cyl(0.3, 0.3, 0.2, gold, 0, 0.1, 0, g, 12);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const s = new T.Mesh(geo('crownSpike', () => new T.ConeGeometry(0.07, 0.2, 4)), gold);
        s.position.set(Math.cos(a) * 0.26, 0.28, Math.sin(a) * 0.26);
        g.add(s);
        ball(0.04, mat(i % 2 ? '#e8333f' : '#3fa0ff'), Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3, g, 6);
      }
    } else if (kind === 'nightcap') {
      const c = new T.Mesh(geo('nightcap', () => new T.ConeGeometry(0.3, 0.75, 12)), new T.MeshStandardMaterial({ map: stripes('#3a5fd0', '#ffd23b', 6, false), roughness: 0.8 }));
      c.position.set(0.05, 0.33, 0.08);
      c.rotation.x = 0.5;
      g.add(c);
      ball(0.09, mat('#ffffff'), 0.06, 0.6, 0.32, g, 8);
      cyl(0.31, 0.31, 0.08, mat('#ffffff'), 0, 0.03, 0, g, 12);
    } else if (kind === 'swimcap') {
      const h = new T.Mesh(geo('swimcap', () => new T.SphereGeometry(0.31, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), mat('#ff5fa8'));
      g.add(h);
      for (let i = 0; i < 5; i++) ball(0.05, mat('#ffffff'), Math.cos(i * 1.3) * 0.2, 0.2 + (i % 2) * 0.05, Math.sin(i * 1.3) * 0.2, g, 6);
      // goggles over the eyes
      for (const x of [-0.11, 0.11]) {
        const lens = torus(0.07, 0.025, mat('#3fd0ff'), x, -0.27, -0.26, g);
        lens.rotation.y = 0;
      }
      box(0.5, 0.03, 0.02, mat('#3fd0ff'), 0, -0.27, -0.26, g);
    }
    return g;
  }

  function skateboard() {
    const g = new T.Group();
    box(0.36, 0.06, 1.0, mat('#3fbf6a'), 0, 0.14, 0, g);
    box(0.36, 0.02, 1.0, mat('#22232b'), 0, 0.18, 0, g);
    for (const z of [-0.32, 0.32]) for (const x of [-0.14, 0.14]) {
      const w = cyl(0.06, 0.06, 0.06, mat('#ffd21f'), x, 0.06, z, g, 8);
      w.rotation.z = Math.PI / 2;
    }
    return g;
  }

  function balloon() {
    const g = new T.Group();
    const b = ball(0.45, mat('#ff4d6d', { roughness: 0.3 }), 0, 1.25, 0, g, 16);
    b.scale.set(1, 1.15, 1);
    ball(0.09, mat('#ffffff', { roughness: 0.2 }), -0.16, 1.45, -0.3, g, 6);
    const knot = new T.Mesh(geo('knot', () => new T.ConeGeometry(0.06, 0.1, 6)), mat('#ff4d6d'));
    knot.position.y = 0.73;
    g.add(knot);
    cyl(0.008, 0.008, 0.72, mat('#ffffff'), 0, 0.36, 0, g, 4);
    return g;
  }

  function duckRing() {
    const g = new T.Group();
    const ring = torus(0.42, 0.15, mat('#ffd21f', { roughness: 0.4 }), 0, 0, 0, g);
    ring.rotation.x = Math.PI / 2;
    const head = new T.Group();
    head.position.set(0, 0.2, -0.46);
    ball(0.16, mat('#ffd21f', { roughness: 0.4 }), 0, 0, 0, head, 10);
    box(0.12, 0.05, 0.14, mat('#ff8a1f'), 0, -0.02, -0.17, head);
    for (const x of [-0.08, 0.08]) ball(0.03, eyeDark, x, 0.05, -0.13, head, 6);
    g.add(head);
    return g;
  }

  // ---------------------------------------------------------------- mini-train

  function train() {
    const g = new T.Group();
    const body = mat('#eef2f6', { metalness: 0.3, roughness: 0.35 });
    const blue = mat('#1e6fd9');
    box(1.4, 0.72, 0.74, body, 0, 0.62, 0, g);
    box(1.42, 0.12, 0.76, blue, 0, 0.5, 0, g);
    box(1.3, 0.08, 0.6, mat('#c9d2dc'), 0, 1.02, 0, g);
    // rounded nose facing +x
    const nose = cyl(0.37, 0.37, 0.72, body, 0.7, 0.62, 0, g, 16);
    nose.rotation.x = Math.PI / 2;
    nose.scale.set(0.55, 1, 1);
    box(0.08, 0.3, 0.56, mat('#24324a', { roughness: 0.2 }), 0.86, 0.78, 0, g);
    for (const x of [-0.4, 0.05, 0.45]) for (const z of [-0.375, 0.375]) box(0.3, 0.24, 0.02, mat('#24324a', { roughness: 0.2 }), x, 0.78, z, g);
    for (const z of [-0.22, 0.22]) ball(0.06, basic('#fff6b0'), 0.92, 0.42, z, g, 8);
    // our own little metro badge
    const [c, gx] = makeCanvas(64, 64);
    gx.fillStyle = '#1e6fd9';
    gx.beginPath(); gx.arc(32, 32, 30, 0, Math.PI * 2); gx.fill();
    gx.fillStyle = '#ffffff';
    gx.font = `38px ${FONT}`;
    gx.textAlign = 'center';
    gx.textBaseline = 'middle';
    gx.fillText('M', 32, 35);
    const badge = new T.Mesh(new T.PlaneGeometry(0.3, 0.3), new T.MeshBasicMaterial({ map: toTexture(c), transparent: true }));
    badge.position.set(-0.15, 0.62, 0.381);
    g.add(badge);
    for (const x of [-0.45, 0.45]) for (const z of [-0.3, 0.3]) {
      const w = cyl(0.13, 0.13, 0.08, mat('#2a2b33'), x, 0.17, z, g, 10);
      w.rotation.x = Math.PI / 2;
    }
    box(0.05, 0.25, 0.05, mat('#555a66'), -0.2, 1.18, 0, g);
    box(0.4, 0.04, 0.04, mat('#555a66'), -0.2, 1.3, 0, g);
    g.scale.setScalar(1.05);
    return g;
  }

  // ---------------------------------------------------------------- projectiles

  let ballGeo = null, ballMat = null;
  function basketball() {
    if (!ballGeo) {
      ballGeo = new T.SphereGeometry(0.22, 14, 10);
      ballMat = new T.MeshStandardMaterial({ map: ballTexture(), roughness: 0.6 });
      ballGeo.userData.shared = ballMat.userData.shared = true;
    }
    return new T.Mesh(ballGeo, ballMat);
  }

  BVZ.M = {
    CW, RD, X, Z, WORLD_LOOK,
    mat, basic, box, ball, cyl, torus, stripes, eyes,
    starTexture, peaceStarTexture, sparkTexture, bubbleTexture, shadowTexture, burstTexture, ballTexture, hpBar,
    buildYard, defender, zombieLook, hat, skateboard, balloon, duckRing, train, basketball, rubberDuck, cookieJar,
  };
})();
