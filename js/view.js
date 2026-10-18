/* Brothers vs Zombies: the 3D view. Builds the yard, keeps a 3D object for everything in the sim, animates people with
   the kit's poses, and turns sim events into effects and sounds. It never changes the rules.
   Exposes BVZ.View(canvas). */
(function () {
  'use strict';
  const T = THREE;
  const BVZ = window.BVZ;
  const M = BVZ.M, P = Kit.people, sfx = BVZ.sfx;
  const { X, Z, CW, RD } = M;
  const { emojiTexture, glowTexture, nameTag } = Kit.gfx;

  // Facing: a person faces -z; these turn them to walk left or right while still showing their face to the camera.
  const FACE_LEFT = Math.PI / 2 + 0.55, FACE_RIGHT = -(Math.PI / 2 + 0.55), FACE_CAM_RIGHT = -2.2, FACE_CAM = -(Math.PI - 0.35);
  // turn toward an angle the short way round
  const turn = (o, to, k) => { let d = to - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, k); };
  const easeOutBack = (k) => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DEF_SCALE = 1.15; // defenders a little bigger than life, so they read well on a phone
  const LANE_FRONT = 0.5; // Teddy and Tommy walk along the front edge of a lane, in front of its defenders

  function disposeTree(o) {
    o.traverse((m) => {
      if (!m.isMesh && !m.isSprite) return;
      if (m.userData.shared) return;
      if (m.isMesh && m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const x of mats) if (x && !x.userData.shared) x.dispose();
    });
  }

  // ---------------------------------------------------------------- particles: one Points draw, per-particle size and colour
  function makeParticles(max, texture, additive) {
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(max * 3), tint = new Float32Array(max * 4), size = new Float32Array(max);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('tint', new T.BufferAttribute(tint, 4));
    geo.setAttribute('size', new T.BufferAttribute(size, 1));
    const material = new T.ShaderMaterial({
      uniforms: { map: { value: texture }, scale: { value: 600 } },
      vertexShader: `
        attribute float size;
        attribute vec4 tint;
        uniform float scale;
        varying vec4 vTint;
        void main() {
          vTint = tint;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec4 vTint;
        void main() {
          vec4 c = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(c.rgb * vTint.rgb, c.a * vTint.a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? T.AdditiveBlending : T.NormalBlending,
    });
    const points = new T.Points(geo, material);
    points.frustumCulled = false;
    const parts = [];
    for (let i = 0; i < max; i++) parts.push({ life: 0 });
    let cursor = 0;
    const col = new T.Color();
    return {
      points,
      emit(p, o = {}) {
        const n = o.n || 10;
        for (let i = 0; i < n; i++) {
          const q = parts[cursor];
          cursor = (cursor + 1) % max;
          const a = Math.random() * Math.PI * 2, sp = (o.speed || 3) * (0.4 + Math.random() * 0.6);
          q.x = p.x + (Math.random() - 0.5) * (o.spread || 0.3);
          q.y = p.y + (Math.random() - 0.5) * (o.spread || 0.3);
          q.z = p.z + (Math.random() - 0.5) * (o.spread || 0.3);
          q.vx = Math.cos(a) * sp * (o.flat ? 1 : 0.8) + (o.vx || 0);
          q.vz = Math.sin(a) * sp * 0.6 + (o.vz || 0);
          q.vy = (o.up !== undefined ? o.up : 2) * (0.5 + Math.random() * 0.8);
          q.g = o.gravity !== undefined ? o.gravity : 6;
          q.drag = o.drag || 0.5;
          q.max = q.life = (o.life || 0.8) * (0.7 + Math.random() * 0.6);
          q.size = (o.size || 0.3) * (0.7 + Math.random() * 0.6);
          const c = Array.isArray(o.color) ? o.color[Math.floor(Math.random() * o.color.length)] : o.color || '#ffe680';
          col.set(c);
          q.r = col.r; q.gg = col.g; q.b = col.b;
          q.spin = o.shrink === false;
        }
      },
      update(dt) {
        for (let i = 0; i < max; i++) {
          const q = parts[i];
          if (q.life <= 0) {
            size[i] = 0;
            continue;
          }
          q.life -= dt;
          q.vy -= q.g * dt;
          const d = Math.exp(-q.drag * dt);
          q.vx *= d; q.vz *= d;
          q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
          if (q.y < 0.03) { q.y = 0.03; q.vy *= -0.3; q.vx *= 0.7; q.vz *= 0.7; }
          const k = Math.max(0, q.life / q.max);
          pos[i * 3] = q.x; pos[i * 3 + 1] = q.y; pos[i * 3 + 2] = q.z;
          tint[i * 4] = q.r; tint[i * 4 + 1] = q.gg; tint[i * 4 + 2] = q.b; tint[i * 4 + 3] = Math.min(1, k * 2.5);
          size[i] = q.spin ? q.size : q.size * (0.4 + 0.6 * k);
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.tint.needsUpdate = true;
        geo.attributes.size.needsUpdate = true;
      },
    };
  }

  // Confetti texture: a little square
  function squareTexture() {
    const [c, g] = Kit.gfx.makeCanvas(16, 16);
    g.fillStyle = '#ffffff';
    g.fillRect(2, 4, 12, 8);
    return Kit.gfx.toTexture(c);
  }
  function popcornTexture() {
    const [c, g] = Kit.gfx.makeCanvas(32, 32);
    g.fillStyle = '#fff8e0';
    for (const [x, y, r] of [[12, 14, 8], [20, 12, 7], [16, 20, 8], [22, 20, 6]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffd36b';
    g.beginPath(); g.arc(17, 17, 3, 0, Math.PI * 2); g.fill();
    return Kit.gfx.toTexture(c);
  }

  function View(canvas) {
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, 0.5, 400);
    const hemi = new T.HemisphereLight('#ffffff', '#6a7a4a', 1);
    scene.add(hemi);
    const sun = new T.DirectionalLight('#fff4dc', 1);
    sun.position.set(-6, 14, 9);
    scene.add(sun);

    const dyn = new T.Group(); // everything that moves
    scene.add(dyn);
    let yard = null, world = null;

    const sparks = makeParticles(500, M.sparkTexture(), true);
    const confetti = makeParticles(260, squareTexture(), false);
    const popcorn = makeParticles(120, popcornTexture(), false);
    scene.add(sparks.points, confetti.points, popcorn.points);

    const shadowGeo = new T.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);
    shadowGeo.userData.shared = true;
    const shadowMat = new T.MeshBasicMaterial({ map: M.shadowTexture(), transparent: true, depthWrite: false });
    shadowMat.userData.shared = true;
    function blob(parent, w, d) {
      const s = new T.Mesh(shadowGeo, shadowMat);
      s.scale.set(w, 1, d || w);
      s.position.y = 0.025;
      s.userData.shared = true;
      s.renderOrder = -1;
      parent.add(s);
      return s;
    }

    // ---------------------------------------------------------------- camera fit
    const cam = { target: new T.Vector3(8.7, 0.4, 0.3), dist: 40, el: 0.88, shake: 0, focus: null, focusK: 0 };
    let hud = { top: 90, bottom: 10 };
    const tmpV = new T.Vector3();
    let W = 1, H = 1;

    function placeCamera(target, dist) {
      const dir = tmpV.set(0, Math.sin(cam.el), Math.cos(cam.el));
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
    }

    function fits(dist) {
      placeCamera(cam.target, dist);
      const pts = [[-3.4, 0, -5.0], [20.9, 0, -5.0], [-3.4, 0, 5.2], [20.9, 0, 5.2], [-3.4, 2.2, -5.0], [20.9, 2.2, -5.0]];
      for (const [x, y, z] of pts) {
        const v = new T.Vector3(x, y, z).project(camera);
        const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
        if (sx < 2 || sx > W - 2 || sy < hud.top || sy > H - hud.bottom) return false;
      }
      return true;
    }

    function fit(top, bottom) {
      if (top !== undefined) hud = { top, bottom };
      W = Math.max(1, window.innerWidth);
      H = Math.max(1, window.innerHeight);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      const shift = (hud.top - hud.bottom) / 2;
      camera.setViewOffset(W, H, 0, -shift, W, H);
      camera.updateProjectionMatrix();
      let lo = 8, hi = 160;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) hi = mid;
        else lo = mid;
      }
      cam.dist = hi;
      for (const m of [sparks, confetti, popcorn]) m.points.material.uniforms.scale.value = (H * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    }

    // ---------------------------------------------------------------- entities
    const defs = new Map(), zs = new Map(), shots = new Map(), stars = new Map(), heroes = new Map();
    const trains = [];
    const leaving = [], fx = [], bubbles = [];
    let comp = null, porch = null, celebrators = [], loser = null;
    let t = 0;

    function clearAll() {
      for (const m of [defs, zs, shots, stars, heroes]) {
        for (const v of m.values()) {
          dyn.remove(v.obj || v.root);
          disposeTree(v.obj || v.root);
        }
        m.clear();
      }
      for (const l of leaving) { dyn.remove(l.root); disposeTree(l.root); }
      leaving.length = 0;
      for (const f of fx) if (f.obj) { (f.parent || dyn).remove(f.obj); }
      fx.length = 0;
      for (const b of bubbles) dyn.remove(b.s);
      bubbles.length = 0;
      for (const tr of trains) if (tr) dyn.remove(tr.obj);
      trains.length = 0;
      if (comp) { dyn.remove(comp.root); disposeTree(comp.root); comp = null; }
      for (const c of celebrators) { dyn.remove(c.root); disposeTree(c.root); }
      celebrators = [];
      if (porch) { dyn.remove(porch.root); disposeTree(porch.root); porch = null; }
      loser = null;
      ghostHide();
    }

    // Set up the lawn for a new sim (a level, or the demo).
    function setLevel(sim) {
      clearAll();
      const look = M.WORLD_LOOK[sim.world];
      const key = sim.world + sim.rows.join('') + sim.water.join('');
      if (!yard || yard.key !== key) {
        if (yard) { scene.remove(yard.group); }
        yard = M.buildYard(sim.world, sim.rows, sim.water);
        yard.key = key;
        scene.add(yard.group);
      }
      world = sim.world;
      scene.background = new T.Color(look.sky);
      scene.fog = new T.Fog(look.fog, 70, 160);
      hemi.color.set(look.hemi[0]);
      hemi.groundColor.set(look.hemi[1]);
      hemi.intensity = look.hemi[2];
      sun.color.set(look.sun[0]);
      sun.intensity = look.sun[1];
      yard.jar.userData.lid.position.y = 0.6;
      yard.jar.userData.lid.rotation.z = 0;
      for (const r of sim.rows) {
        const obj = M.train();
        obj.position.set(X(-0.6), 0, Z(r));
        dyn.add(obj);
        trains[r] = { obj, state: 'ready' };
      }
      porch = person(sim.brother, false);
      porch.root.position.copy(yard.porch);
      porch.p.root.rotation.y = FACE_CAM_RIGHT;
      porch.home = true;
      dyn.add(porch.root);
      cam.focus = null;
      cam.fc = null;
      cam.focusK = 0;
    }

    // ---------------------------------------------------------------- people (Teddy, Tommy)
    function person(who, tag) {
      const entry = Kit.roster.get(who);
      const p = P.build(entry.look);
      const root = new T.Group();
      root.add(p.root);
      const s = who === 'tommy' ? 0.78 : 0.88;
      p.root.scale.setScalar(s);
      blob(root, 1.1);
      let tagS = null;
      if (tag) {
        tagS = nameTag(entry.name, entry.tag || '#ffffff');
        tagS.position.y = 2.25 * s + 0.35;
        tagS.scale.multiplyScalar(0.85);
        root.add(tagS);
      }
      return { who, p, root, s, tag: tagS, phase: Math.random() * 6, act: null, actT: 0, held: null, y: 0 };
    }

    // Damp the legs after a pose so a standing person doesn't stride (the kit's wave/peace poses run).
    function still(p) {
      p.legL.rotation.x *= 0.2;
      p.legR.rotation.x *= 0.2;
    }

    function poseHero(h, dt, mode, opts = {}) {
      h.phase += dt * (opts.speed || 8);
      P.pose(h.p, h.phase, mode, 1 - Math.exp(-18 * dt));
      if (opts.still) still(h.p);
    }

    // ---------------------------------------------------------------- zombies
    function makeZombie(z) {
      const look = M.zombieLook(z.type, z.id);
      const p = P.build(look);
      const root = new T.Group();
      root.add(p.root);
      const s = z.boss ? 1.65 : 0.95;
      p.root.scale.setScalar(s);
      p.root.rotation.y = FACE_LEFT;
      const mats = [];
      p.root.traverse((o) => {
        if (o.isMesh && o.material && !mats.includes(o.material)) mats.push(o.material);
      });
      const v = { id: z.id, type: z.type, p, root, s, mats, phase: Math.random() * 6, flash: 0, tint: 0, y: 0, hatObj: null };
      const hatKind = z.boss ? ({ day: 'crown', night: 'nightcap', pool: 'swimcap' })[world] : z.hat;
      if (hatKind) {
        v.hatObj = M.hat(hatKind, world);
        v.hatObj.position.y = 0.3;
        p.head.add(v.hatObj);
      }
      if (z.skating) {
        v.board = M.skateboard();
        v.board.rotation.y = Math.PI / 2;
        v.board.scale.setScalar(s * 1.1);
        root.add(v.board);
      }
      if (z.floating) {
        v.balloon = M.balloon();
        v.balloon.position.set(0.1, 1.9, 0.25);
        p.root.add(v.balloon);
      }
      if (z.swim) {
        v.ring = M.duckRing();
        v.ring.position.y = 0.95;
        v.ring.rotation.y = 0;
        p.root.add(v.ring);
      } else v.shadow = blob(root, z.boss ? 1.8 : 1.0);
      if (z.boss) {
        v.bar = M.hpBar();
        v.bar.position.y = 2.25 * s + 0.6;
        root.add(v.bar);
        v.lastK = 1;
      }
      root.position.set(X(z.x), 0, Z(z.row));
      dyn.add(root);
      zs.set(z.id, v);
      return v;
    }

    function setEmissive(v, color, k) {
      for (const m of v.mats) {
        if (!m.emissive) continue;
        m.emissive.set(color);
        m.emissiveIntensity = k;
      }
    }

    function updateZombie(v, z, dt) {
      const p = v.p;
      v.root.position.x = X(z.x);
      v.root.position.z += (Z(z.row) - v.root.position.z) * Math.min(1, dt * 8);
      const swimY = z.swim ? -0.78 : 0;
      let mode = 'walk', speed = 3.2, y = swimY;
      const slowK = z.slowT > 0 ? 0.5 : 1;
      switch (z.state) {
        case 'walk':
          if (z.held) { mode = 'walk'; speed = 9; }
          else if (z.skating) { mode = 'idle'; y += 0.2; }
          else if (z.floating) { mode = 'idle'; y = 1.1 + Math.sin(t * 2 + v.phase) * 0.12; }
          else speed = z.boss ? 2.2 : 3.4;
          break;
        case 'bonk': mode = 'walk'; speed = 0; break;
        case 'air': {
          const u = clamp(z.timer / z.dur, 0, 1);
          y = swimY + 2.4 * 4 * u * (1 - u);
          mode = 'fall';
          p.root.rotation.z = Math.sin(u * Math.PI) * 0.6;
          break;
        }
        case 'slide': mode = 'fall'; y = swimY + 0.15; break;
        case 'dizzy': mode = 'idle'; break;
        case 'stumble': mode = 'fall'; break;
        case 'drop': mode = 'fall'; y = swimY + Math.max(0, z.timer / 0.5) * 1.1; break;
      }
      if (z.state !== 'air') p.root.rotation.z *= 0.8;
      v.y += (y - v.y) * Math.min(1, dt * (z.state === 'drop' || z.state === 'air' ? 30 : 10));
      p.root.position.y = v.y;
      v.phase += dt * speed * slowK * (z.bubbleT > 0 ? 0.6 : 1);
      P.pose(p, v.phase, mode, 1 - Math.exp(-14 * dt));
      if (z.state === 'bonk') {
        // bonk-bonk on the defender with both fists
        const b = Math.max(0, Math.sin(t * 9 * slowK + v.phase));
        p.armL.rotation.x = 1.2 + b * 0.8;
        p.armR.rotation.x = 1.2 + Math.max(0, Math.sin(t * 9 * slowK + v.phase + Math.PI)) * 0.8;
        p.head.rotation.x = 0.2 + b * 0.12;
        if (b > 0.98 && Math.random() < 0.3) sfx.bonk();
      }
      if (z.state === 'dizzy') {
        p.root.rotation.z = Math.sin(t * 6) * 0.08;
        dizzy(v, true);
      } else dizzy(v, false);
      if (v.board) v.board.position.y = z.skating ? 0 : -10;
      if (v.shadow) v.shadow.scale.setScalar((z.boss ? 1.8 : 1.0) * (1 - Math.min(0.6, Math.max(0, v.y) * 0.25)));
      // bubbles around a zombie walking through a Bubble Machine's lane
      if (z.bubbleT > 0) {
        if (!v.bub) {
          v.bub = new T.Sprite(new T.SpriteMaterial({ map: M.bubbleTexture(), transparent: true, depthWrite: false }));
          v.root.add(v.bub);
        }
        v.bub.visible = true;
        const k = 1.6 * v.s + Math.sin(t * 5) * 0.08;
        v.bub.scale.set(k, k * 1.15, 1);
        v.bub.position.y = 1.0 * v.s + v.y;
      } else if (v.bub) v.bub.visible = false;
      // hit flash and the sleepy blue of a peace star
      v.flash = Math.max(0, v.flash - dt);
      const want = v.flash > 0 ? 2 : z.slowT > 0 ? 1 : 0;
      if (want !== v.tint) {
        v.tint = want;
        if (want === 2) setEmissive(v, '#ffffff', 0.55);
        else if (want === 1) setEmissive(v, '#4a7dff', 0.45);
        else setEmissive(v, '#000000', 0);
      }
      if (v.bar) {
        const k = (z.hp + z.armor) / (z.maxHp + z.maxArmor);
        if (Math.abs(k - v.lastK) > 0.01) {
          v.bar.userData.draw(k);
          v.lastK = k;
        }
      }
    }

    function dizzy(v, on) {
      if (!on) {
        if (v.dz) v.dz.visible = false;
        return;
      }
      if (!v.dz) {
        v.dz = new T.Group();
        for (let i = 0; i < 3; i++) {
          const s = new T.Sprite(new T.SpriteMaterial({ map: M.starTexture(), transparent: true, depthWrite: false }));
          s.scale.setScalar(0.32);
          v.dz.add(s);
        }
        v.root.add(v.dz);
      }
      v.dz.visible = true;
      v.dz.position.y = 2.25 * v.s + v.y;
      v.dz.children.forEach((s, i) => {
        const a = t * 4 + (i * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 0.4 * v.s, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.3 * v.s);
      });
    }

    // Defeated: a puff of stars, then the zombie runs off to the street holding its hat.
    function poofZombie(v, by) {
      zs.delete(v.id);
      const c = v.root.position.clone();
      c.y += 1.1 * v.s;
      sparks.emit(c, { n: v.type === 'boss' ? 60 : 24, color: ['#ffe066', '#ffffff', '#ffd21f', '#ff9bd2'], speed: 3.5, up: 3, life: 0.9, size: 0.45 });
      if (by !== 'train' && Math.random() < 0.55) burst('POOF!', c, 1.2);
      if (v.balloon) { v.balloon.visible = false; }
      if (v.bub) v.bub.visible = false;
      if (v.dz) v.dz.visible = false;
      if (v.bar) v.bar.visible = false;
      setEmissive(v, '#ffffff', 0.18);
      v.p.root.rotation.y = FACE_RIGHT;
      v.p.root.rotation.z = 0;
      leaving.push({ root: v.root, p: v.p, s: v.s, t: 0, phase: 0, swim: v.ring ? true : false, y: v.y, by });
      sfx.poof();
    }

    function updateLeaving(dt) {
      for (let i = leaving.length - 1; i >= 0; i--) {
        const l = leaving[i];
        l.t += dt;
        l.phase += dt * 12;
        if (l.by === 'train' && l.t < 0.6) {
          // knocked up and over by the train, then off he runs
          l.root.position.y = Math.sin((l.t / 0.6) * Math.PI) * 1.4;
          l.p.root.rotation.z = l.t * 10;
          l.root.position.x += 9 * dt;
        } else {
          l.root.position.y *= 0.8;
          l.p.root.rotation.z = 0;
          l.root.position.x += 6.5 * dt;
        }
        l.y += ((l.swim ? -0.78 : 0) - l.y) * Math.min(1, dt * 8);
        l.p.root.position.y = l.y;
        P.pose(l.p, l.phase, 'run', 1 - Math.exp(-16 * dt));
        // both hands on the head, holding the hat on
        l.p.armL.rotation.x = 2.75; l.p.armL.rotation.z = -0.55;
        l.p.armR.rotation.x = 2.75; l.p.armR.rotation.z = 0.55;
        if (l.t > 3.2 || l.root.position.x > 30) {
          dyn.remove(l.root);
          disposeTree(l.root);
          leaving.splice(i, 1);
        }
      }
    }

    // ---------------------------------------------------------------- defenders
    function makeDefender(d) {
      const obj = M.defender(d.kind);
      obj.position.set(X(d.x), d.onFloat ? 0.1 : d.kind === 'floatie' ? -0.08 : 0, Z(d.r));
      obj.scale.setScalar(0.01);
      if (d.kind !== 'floatie') blob(obj, d.kind === 'bag' ? 1.1 : 1.2);
      dyn.add(obj);
      const v = { obj, kind: d.kind, age: 0, recoil: 0, squash: 0, wob: 0, bubbleT: 0, armed: false };
      defs.set(d.id, v);
      sparks.emit(new T.Vector3(X(d.x), 0.3, Z(d.r)), { n: 14, color: ['#ffffff', '#ffe680', '#a8ff8a'], speed: 2.5, up: 2.5, life: 0.6, size: 0.35 });
      return v;
    }

    function updateDefender(v, d, dt, sim) {
      v.age += dt;
      const u = v.obj.userData;
      const k = Math.min(1, v.age / 0.28);
      let sc = (v.age < 0.28 ? Math.max(0.01, easeOutBack(k)) : 1) * DEF_SCALE;
      v.squash = Math.max(0, v.squash - dt * 4);
      const sq = Math.sin(v.squash * Math.PI) * 0.18;
      v.obj.scale.set(sc * (1 + sq * 0.5), sc * (1 - sq), sc * (1 + sq * 0.5));
      if (d.kind === 'floatie') v.obj.position.y = -0.08 + Math.sin(t * 2 + d.c) * 0.03;
      else if (d.onFloat) v.obj.position.y = 0.1 + Math.sin(t * 2 + d.c) * 0.03;
      // being bonked by a zombie: wobble
      const bonked = sim.zombies.some((z) => z.target === d && z.state === 'bonk');
      v.wob += ((bonked ? 1 : 0) - v.wob) * Math.min(1, dt * 6);
      u.inner.rotation.z = Math.sin(t * 16) * 0.05 * v.wob;
      switch (d.kind) {
        case 'ice':
          u.bob.position.y = 0.9 + Math.sin(t * 3 + d.c) * 0.03;
          u.bob.rotation.y = Math.sin(t * 1.5) * 0.3;
          break;
        case 'hoop':
        case 'double':
          v.recoil = Math.max(0, v.recoil - dt * 5);
          u.gun.position.x = 0.3 - v.recoil * 0.12;
          break;
        case 'peace':
          v.recoil = Math.max(0, v.recoil - dt * 5);
          u.hand.rotation.z = Math.sin(t * 2 + d.c) * 0.08 - v.recoil * 0.25;
          break;
        case 'bag': {
          u.bag.rotation.z = Math.sin(t * 13) * 0.12 * v.wob;
          u.bag.rotation.x = Math.sin(t * 9) * 0.05 * v.wob;
          const f = d.hp / d.maxHp;
          u.patches.forEach((p, i) => (p.visible = f < 0.75 - i * 0.22));
          break;
        }
        case 'bubble':
          u.fan.rotation.x += dt * (d.blowing ? 18 : 3);
          u.wand.rotation.y = Math.sin(t * 3) * 0.4;
          if (d.blowing) {
            v.bubbleT -= dt;
            if (v.bubbleT <= 0) {
              v.bubbleT = 0.18;
              addBubble(X(d.x) + 0.5, 0.6, Z(d.r), X(d.x + BVZ.CARDS.bubble.reach));
              sfx.bubble();
            }
          }
          break;
        case 'bounce':
          u.top.scale.y = 1 + Math.sin(t * 4 + d.c) * 0.05;
          break;
        case 'popcorn':
          if (d.armed && !v.armed) {
            v.armed = true;
            u.lid.visible = false;
            u.corn.visible = true;
            popcorn.emit(new T.Vector3(X(d.x), 0.7, Z(d.r)), { n: 6, speed: 1.2, up: 3, life: 0.8, size: 0.35 });
          }
          if (d.armed) {
            u.corn.position.y = 0.58 + Math.abs(Math.sin(t * 8 + d.c)) * 0.04;
            u.bucket.material.emissive.set('#ff3b1f');
            u.bucket.material.emissiveIntensity = 0.25 + Math.sin(t * 8) * 0.25;
          } else {
            u.lid.position.y = 0.58 + Math.max(0, Math.sin(t * 5 + d.c)) * 0.04 * Math.min(1, d.t / 3);
          }
          break;
      }
    }

    function knockDefender(id, why) {
      const v = defs.get(id);
      if (!v) return;
      defs.delete(id);
      const pos = v.obj.position.clone();
      if (why === 'used') {
        dyn.remove(v.obj);
        disposeTree(v.obj);
        return;
      }
      if (why === 'bonked') {
        sfx.knock();
        sparks.emit(pos.clone().setY(0.6), { n: 18, color: ['#ffffff', '#ffe680'], speed: 2.5, up: 2, life: 0.7, size: 0.4 });
      }
      const sink = why === 'sank';
      fx.push({
        obj: v.obj, dur: 0.45,
        update(k) {
          if (sink) v.obj.position.y = -k * 1.2;
          else {
            v.obj.rotation.z = -k * 1.4;
            v.obj.scale.setScalar(Math.max(0.01, 1 - k));
          }
        },
        end() { dyn.remove(v.obj); disposeTree(v.obj); },
      });
    }

    function addBubble(x, y, z, maxX) {
      let b = bubbles.find((q) => !q.live);
      if (!b) {
        if (bubbles.length > 70) return;
        const s = new T.Sprite(new T.SpriteMaterial({ map: M.bubbleTexture(), transparent: true, depthWrite: false }));
        dyn.add(s);
        b = { s };
        bubbles.push(b);
      }
      b.live = true;
      b.x = x; b.y = y; b.z = z + (Math.random() - 0.5) * 0.8; b.maxX = maxX; b.ph = Math.random() * 6;
      b.size = 0.25 + Math.random() * 0.25;
      b.s.visible = true;
    }

    function updateBubbles(dt) {
      for (const b of bubbles) {
        if (!b.live) continue;
        b.x += dt * 2.6;
        b.ph += dt * 4;
        b.s.position.set(b.x, b.y + Math.sin(b.ph) * 0.25 + 0.3, b.z);
        const left = (b.maxX - b.x) / 2;
        const sz = b.size * Math.min(1, left * 2 + 0.2);
        b.s.scale.set(sz, sz, 1);
        if (b.x > b.maxX) {
          b.live = false;
          b.s.visible = false;
        }
      }
    }

    // ---------------------------------------------------------------- shots and stars
    const pStarMat = new T.SpriteMaterial({ map: M.peaceStarTexture(), transparent: true, depthWrite: false });
    function makeShot(e) {
      let obj;
      if (e.kind === 'ball') obj = M.basketball();
      else {
        obj = new T.Sprite(pStarMat);
        obj.scale.setScalar(0.6);
        obj.userData.shared = true;
      }
      obj.position.set(X(e.x), 0.9, Z(e.r));
      dyn.add(obj);
      shots.set(e.id, { obj, kind: e.kind, x0: e.x });
    }

    const starMat = new T.SpriteMaterial({ map: M.starTexture(), transparent: true, depthWrite: false });
    function makeStar(e, sim) {
      const mat = starMat.clone();
      const s = new T.Sprite(mat);
      s.scale.setScalar(1.35);
      s.renderOrder = 3;
      dyn.add(s);
      const v = { obj: s, kind: e.kind, x: X(e.x), z: (e.d - 2) * RD, ph: Math.random() * 6 };
      if (e.kind === 'stand') {
        const d = defs.get(e.from);
        v.from = d ? d.obj.position.clone().setY(1.8) : new T.Vector3(v.x, 1.8, v.z);
        if (d) d.squash = 1;
      }
      stars.set(e.id, v);
      sfx.starAppear();
    }

    function updateStar(v, st, dt) {
      v.ph += dt;
      if (st.kind === 'sky' && st.fall > 0) {
        const k = st.fall / 4.5;
        v.obj.position.set(v.x + Math.sin(v.ph * 1.6) * 0.3 * k, 0.75 + k * 8.5, v.z);
      } else if (st.kind !== 'sky' && st.fall > 0) {
        const k = 1 - st.fall / 0.6;
        v.obj.position.set(v.from.x + (v.x - v.from.x) * k, v.from.y + (0.75 - v.from.y) * k + Math.sin(k * Math.PI) * 1.2, v.from.z + (v.z - v.from.z) * k);
      } else {
        v.obj.position.set(v.x, 0.75 + Math.sin(v.ph * 2.5) * 0.08, v.z);
      }
      v.obj.material.rotation = Math.sin(v.ph * 1.8) * 0.18;
      const blink = st.fall <= 0 && st.life < 3 && !st.autoCollect ? (Math.sin(v.ph * 14) > 0 ? 1 : 0.35) : 1;
      v.obj.material.opacity = blink;
    }

    function removeStar(id, fade) {
      const v = stars.get(id);
      if (!v) return;
      stars.delete(id);
      if (!fade) {
        dyn.remove(v.obj);
        v.obj.material.dispose();
        sparks.emit(v.obj.position, { n: 10, color: ['#ffe066', '#ffffff'], speed: 2, up: 1.5, life: 0.4, size: 0.35 });
        return;
      }
      fx.push({ obj: v.obj, dur: 0.4, update(k) { v.obj.material.opacity = 1 - k; v.obj.scale.setScalar(1.35 * (1 - k * 0.5)); }, end() { dyn.remove(v.obj); v.obj.material.dispose(); } });
    }

    // ---------------------------------------------------------------- effect helpers
    function burst(word, pos, size = 1.4) {
      const m = new T.SpriteMaterial({ map: M.burstTexture(word), transparent: true, depthWrite: false, depthTest: false });
      const s = new T.Sprite(m);
      s.position.copy(pos);
      s.renderOrder = 10;
      dyn.add(s);
      const rot = (Math.random() - 0.5) * 0.5;
      m.rotation = rot;
      fx.push({
        obj: s, dur: 0.75,
        update(k) {
          const g = k < 0.2 ? easeOutBack(k / 0.2) : 1;
          s.scale.set(size * 1.6 * g, size * g, 1);
          s.position.y = pos.y + k * 0.4;
          m.opacity = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
        },
        end() { dyn.remove(s); m.dispose(); },
      });
    }

    function emojiSprite(emoji, size) {
      const m = new T.SpriteMaterial({ map: emojiTexture(emoji), transparent: true, depthWrite: false });
      const s = new T.Sprite(m);
      s.scale.setScalar(size);
      s.renderOrder = 6;
      return s;
    }

    // ✌️ wave rolling down a lane
    function peaceWave(e) {
      const g = new T.Group();
      const n = e.big ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const s = emojiSprite('✌️', e.big ? 1.1 : 0.8);
        s.position.set(0, 0.7 + i * 0.55, (i - (n - 1) / 2) * 0.5);
        g.add(s);
      }
      const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), color: '#bff4ff', transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      glow.scale.set(2.2, 3.0, 1);
      glow.position.y = 1.0;
      g.add(glow);
      const x0 = X(e.x + 0.2), end = e.big ? X(10.4) : X(e.x + 0.2 + BVZ.BUDDY.tommyReach + 0.6), v = (e.big ? 8 : 7) * CW;
      g.position.set(x0, 0, Z(e.row));
      dyn.add(g);
      const dur = (end - x0) / v;
      fx.push({
        obj: g, dur,
        update(k) {
          g.position.x = x0 + (end - x0) * k;
          g.children.forEach((c, i) => { if (c.material.map !== glowTexture()) c.material.rotation = Math.sin(t * 10 + i) * 0.3; });
          if (Math.random() < 0.5) sparks.emit(g.position.clone().setY(1), { n: 2, color: ['#9ff0ff', '#ffffff', '#ffe066'], speed: 1, up: 1, life: 0.5, size: 0.35 });
          g.children.forEach((c) => (c.material.opacity = k > 0.85 ? (1 - k) / 0.15 : 1));
        },
        end() { dyn.remove(g); g.children.forEach((c) => c.material.dispose()); },
      });
      sfx.peace();
    }

    // a thrown thing (treat, ball) along an arc; onLand runs at the end
    function toss(obj, from, to, dur, height, onLand) {
      obj.position.copy(from);
      dyn.add(obj);
      fx.push({
        obj, dur,
        update(k) {
          obj.position.lerpVectors(from, to, k);
          obj.position.y += Math.sin(k * Math.PI) * height;
          if (obj.material) obj.material.rotation = k * 6;
        },
        end() { if (onLand) onLand(obj); else dyn.remove(obj); },
      });
    }

    // ---------------------------------------------------------------- events from the sim
    function handle(evs, sim) {
      for (const e of evs) {
        switch (e.type) {
          case 'build': {
            const d = sim.defenders.find((x) => x.id === e.id);
            if (d) makeDefender(d);
            sfx.build();
            break;
          }
          case 'knock': knockDefender(e.id, e.why); break;
          case 'spawn': {
            const z = sim.zombies.find((x) => x.id === e.id);
            if (z) makeZombie(z);
            if (Math.random() < 0.35) sfx.groan();
            break;
          }
          case 'hit': {
            const v = zs.get(e.id);
            if (v) v.flash = 0.09;
            if (e.src === 'ball' || e.src === 'star') sfx.hit();
            break;
          }
          case 'hatOff': hatOff(e.id); break;
          case 'balloonPop': {
            const v = zs.get(e.id);
            if (v && v.balloon) {
              const p = new T.Vector3();
              v.balloon.children[0].getWorldPosition(p);
              v.balloon.visible = false;
              burst('POP!', p, 1.1);
              sparks.emit(p, { n: 16, color: ['#ff4d6d', '#ffffff'], speed: 3, up: 1, life: 0.5, size: 0.35 });
              sfx.pop();
            }
            break;
          }
          case 'boardOff': {
            const v = zs.get(e.id);
            if (v && v.board) {
              const b = v.board;
              const from = v.root.position.clone();
              v.root.remove(b);
              b.position.copy(from);
              dyn.add(b);
              fx.push({ obj: b, dur: 1.0, update(k) { b.position.x = from.x - k * 3; b.position.y = Math.sin(k * Math.PI) * 1.4; b.rotation.z = k * 9; b.scale.setScalar(v.s * 1.1 * (1 - k * 0.6)); }, end() { dyn.remove(b); } });
              v.board = null;
              burst('BONK!', from.clone().setY(1.2), 1.0);
              sfx.boing();
            }
            break;
          }
          case 'poof': {
            const v = zs.get(e.id);
            if (v) poofZombie(v, e.by);
            if (porch && e.by !== 'train' && e.by !== 'save' && Math.random() < 0.3) porch.cheer = 1.2;
            break;
          }
          case 'shoot': {
            makeShot(e);
            const d = defs.get(e.from);
            if (d) d.recoil = 1;
            if (e.kind === 'ball') sfx.shootBall();
            else sfx.shootStar();
            break;
          }
          case 'shotHit': {
            const v = shots.get(e.id);
            if (v) {
              sparks.emit(v.obj.position, { n: 6, color: v.kind === 'ball' ? ['#ffb36b', '#ffffff'] : ['#9ff0ff', '#ffffff'], speed: 2, up: 1.5, life: 0.35, size: 0.3 });
              if (v.kind === 'star') sfx.sleepy();
              dyn.remove(v.obj);
              shots.delete(e.id);
            }
            break;
          }
          case 'shotGone': {
            const v = shots.get(e.id);
            if (v) { dyn.remove(v.obj); shots.delete(e.id); }
            break;
          }
          case 'star': makeStar(e, sim); break;
          case 'collect': removeStar(e.id, false); break;
          case 'starGone': removeStar(e.id, true); break;
          case 'armed': sfx.armed(); break;
          case 'pop': {
            const p = new T.Vector3(X(e.x), 0.6, Z(e.r));
            popcorn.emit(p, { n: 45, speed: 4, up: 5, gravity: 7, life: 1.4, size: 0.5, drag: 1 });
            sparks.emit(p, { n: 20, color: ['#ffe066', '#ff8a3c', '#ffffff'], speed: 4, up: 3, life: 0.6, size: 0.6 });
            burst('POP!', p.clone().setY(1.6), 1.8);
            cam.shake = 0.35;
            sfx.pop();
            break;
          }
          case 'boing': {
            const p = new T.Vector3(X(e.x), 0.8, Z(e.r));
            burst('BOING!', p.clone().setY(1.8), 1.5);
            sparks.emit(p, { n: 14, color: ['#8cff7a', '#ffffff'], speed: 3, up: 3, life: 0.6, size: 0.4 });
            sfx.boing();
            break;
          }
          case 'train': {
            const tr = trains[e.row];
            if (tr) tr.state = 'go';
            burst('TOOT TOOT!', new T.Vector3(X(0.3), 2.0, Z(e.row)), 1.6);
            sfx.train();
            cam.shake = 0.2;
            break;
          }
          case 'trainDone': {
            const tr = trains[e.row];
            if (tr) { tr.state = 'used'; tr.obj.visible = false; }
            break;
          }
          case 'hero': makeHero(e); break;
          case 'punch': punch(e, sim); break;
          case 'heroBye': {
            const h = heroes.get(e.id);
            if (h) { h.byeT = 0; }
            break;
          }
          case 'peace': {
            const h = e.buddy ? comp : heroes.get(e.id);
            if (h) { h.act = 'peace'; h.actT = 0.9; }
            break;
          }
          case 'peaceWave': peaceWave(e); break;
          case 'buddy': makeComp(e, sim); break;
          case 'buddyBack': if (comp) comp.byeT = null; break;
          case 'buddyBye': if (comp) comp.byeT = 0; break;
          case 'buddyGone': if (comp) { dyn.remove(comp.root); disposeTree(comp.root); comp = null; } break;
          case 'treat': treat(e); break;
          case 'save': {
            const p = new T.Vector3(X(0.1), 1.2, Z(e.row));
            burst('BAM!', p.clone().setY(1.8), 1.6);
            sparks.emit(p, { n: 40, color: ['#ffe066', '#ffffff', '#9ff0ff'], speed: 4, up: 3, life: 0.8, size: 0.5 });
            const s = emojiSprite(e.who === 'tommy' ? '✌️' : '🥊', 1.4);
            toss(s, p.clone(), p.clone().setY(3.2), 0.9, 0.3, (o) => { dyn.remove(o); o.material.dispose(); });
            if (comp) { comp.act = comp.who === 'tommy' ? 'peace' : 'straight'; comp.actT = 0.8; }
            sfx.saved();
            break;
          }
          case 'zwave': if (e.i === 0) sfx.groan(); break;
        }
      }
    }

    function hatOff(id) {
      const v = zs.get(id);
      if (!v || !v.hatObj) return;
      const h = v.hatObj;
      const p = new T.Vector3();
      h.getWorldPosition(p);
      v.p.head.remove(h);
      h.position.copy(p);
      h.scale.setScalar(v.s);
      dyn.add(h);
      v.hatObj = null;
      const vx = 2 + Math.random() * 1.5, spin = (Math.random() - 0.5) * 14;
      fx.push({ obj: h, dur: 1.2, update(k) { h.position.x = p.x + vx * k; h.position.y = Math.max(0.15, p.y + 3 * k - 7 * k * k); h.rotation.z = spin * k; h.rotation.x = spin * 0.5 * k; if (k > 0.75) h.scale.setScalar(v.s * (1 - (k - 0.75) * 4)); }, end() { dyn.remove(h); } });
      burst('PLINK!', p.clone().setY(p.y + 0.4), 0.9);
      sfx.plink();
    }

    // ---------------------------------------------------------------- heroes and the buddy
    function makeHero(e) {
      const h = person(e.who, false);
      h.id = e.id;
      h.root.position.set(X(-0.5), 0, Z(e.row) + LANE_FRONT);
      dyn.add(h.root);
      heroes.set(e.id, h);
      sparks.emit(h.root.position.clone().setY(1), { n: 20, color: ['#ffe066', '#ffffff', '#8cc2ff'], speed: 3, up: 2, life: 0.6, size: 0.4 });
      sfx.whoosh();
    }

    function punch(e, sim) {
      const h = e.buddy ? comp : heroes.get(e.id);
      if (h) {
        h.act = e.hand ? 'straight' : 'jab';
        h.actT = 0.17;
      }
      const z = zs.get(e.zid);
      if (z) {
        z.flash = 0.1;
        const p = z.root.position.clone();
        p.y += 1.2 * z.s + z.y;
        p.x -= 0.3;
        if (Math.random() < 0.6) burst(e.hand ? 'POW!' : 'BOP!', p, 1.0);
        sparks.emit(p, { n: 8, color: ['#ffe066', '#ffffff'], speed: 2.5, up: 1.5, life: 0.4, size: 0.35 });
      }
      sfx.punch();
    }

    function makeComp(e, sim) {
      if (comp) { dyn.remove(comp.root); disposeTree(comp.root); }
      comp = person(e.who, true);
      comp.root.position.set(X(-0.6), 0, Z(e.row) + LANE_FRONT);
      dyn.add(comp.root);
      sparks.emit(comp.root.position.clone().setY(1), { n: 24, color: ['#ffe066', '#ffffff', '#ffb02e'], speed: 3, up: 2, life: 0.7, size: 0.45 });
      comp.act = e.who === 'tommy' ? 'peace' : 'boxing';
      comp.actT = 0.9;
      sfx.whoosh();
    }

    // the buddy tosses a treat to you on the porch
    function treat(e) {
      if (!porch) return;
      const from = comp ? comp.root.position.clone().setY(1.4) : new T.Vector3(X(1), 1.4, 0);
      const to = porch.root.position.clone().setY(1.25);
      const s = emojiSprite(e.emoji, 0.8);
      toss(s, from, to, 0.85, 2.2, (o) => {
        if (porch.held) { porch.root.remove(porch.held); porch.held.material.dispose(); }
        porch.held = o;
        dyn.remove(o);
        porch.root.add(o);
        o.position.set(0.25, 1.75, 0.2);
        porch.heldT = 3.5;
        porch.cheer = 1.0;
        sparks.emit(to, { n: 14, color: ['#ffe066', '#ff9bd2', '#ffffff'], speed: 2, up: 2, life: 0.6, size: 0.4 });
      });
      if (comp) { comp.act = 'give'; comp.actT = 0.6; }
      sfx.treat();
    }

    function updateHeroes(sim, dt) {
      const live = new Set();
      for (const h of sim.heroes) {
        live.add(h.id);
        let v = heroes.get(h.id);
        if (!v) {
          makeHero({ id: h.id, who: h.who, row: h.row });
          v = heroes.get(h.id);
        }
        v.root.position.x = X(h.x);
        v.root.position.z += (Z(h.row) + LANE_FRONT - v.root.position.z) * Math.min(1, dt * 8);
        animateBrother(v, h, dt);
      }
      for (const [id, v] of heroes) {
        if (!live.has(id)) {
          dyn.remove(v.root);
          disposeTree(v.root);
          heroes.delete(id);
        }
      }
      if (!comp && sim.comp) makeComp({ who: sim.comp.who, row: sim.comp.row }, sim);
      if (comp && sim.comp) {
        const c = sim.comp;
        comp.root.position.x += (X(c.x) - comp.root.position.x) * Math.min(1, dt * 12);
        comp.root.position.z += (Z(c.row) + LANE_FRONT - comp.root.position.z) * Math.min(1, dt * 5);
        animateBrother(comp, c, dt);
      }
      if (porch) {
        // you, on the porch: hidden while your own hero card is out on the lawn
        porch.root.visible = !sim.heroes.some((h) => h.who === porch.who) && !celebrators.length;
        porch.cheer = Math.max(0, (porch.cheer || 0) - dt);
        porch.heldT = Math.max(0, (porch.heldT || 0) - dt);
        if (porch.held && porch.heldT <= 0) { porch.root.remove(porch.held); porch.held.material.dispose(); porch.held = null; }
        if (loser) poseHero(porch, dt, 'idle', { speed: 2 });
        else if (porch.cheer > 0) poseHero(porch, dt, porch.who === 'tommy' ? 'peace' : 'boxing', { speed: 9, still: true });
        else if (porch.held) { poseHero(porch, dt, 'idle', { speed: 2 }); porch.p.armR.rotation.x = 2.6; porch.p.armR.rotation.z = 0.3; }
        else poseHero(porch, dt, 'idle', { speed: 2 });
        if (loser) { porch.p.armL.rotation.x = 2.9; porch.p.armR.rotation.x = 2.9; porch.p.armL.rotation.z = -0.6; porch.p.armR.rotation.z = 0.6; }
        porch.root.position.y = yard.porch.y + (porch.cheer > 0 && porch.who === 'tommy' ? Math.abs(Math.sin(t * 9)) * 0.15 : 0);
      }
    }

    // Poses for Teddy and Tommy, from the hero card or the buddy's sim state.
    function animateBrother(v, h, dt) {
      const st = h.state;
      v.actT = Math.max(0, v.actT - dt);
      let y = 0;
      const right = st !== 'home';
      turn(v.p.root, right ? FACE_RIGHT : FACE_LEFT, dt * 10);
      if (st === 'home') poseHero(v, dt, 'run', { speed: 13 });
      else if (st === 'bye') {
        // goodbye: Teddy's jump shot, Tommy's Y
        if (v.who === 'teddy') {
          if (v.byeT === null || v.byeT === undefined) v.byeT = 0;
          v.byeT += dt;
          const k = clamp(v.byeT / 0.8, 0, 1);
          y = Math.sin(k * Math.PI) * 0.7;
          turn(v.p.root, FACE_CAM, dt * 12);
          poseHero(v, dt, 'jumpshot', { speed: 4 });
          if (v.byeT > 0.35 && !v.shot) {
            v.shot = true;
            const b = M.basketball();
            const from = v.root.position.clone().setY(2.1);
            toss(b, from, from.clone().add(new T.Vector3(1.6, -0.4, -0.4)), 0.7, 1.6, (o) => {
              dyn.remove(o);
              burst('SWISH!', o.position.clone(), 1.2);
              sfx.swish();
            });
          }
        } else {
          turn(v.p.root, FACE_CAM, dt * 12);
          poseHero(v, dt, 'peace', { speed: 6, still: true });
          y = Math.abs(Math.sin(t * 8)) * 0.12;
        }
      } else if (v.who === 'teddy') {
        v.shot = false;
        if (st === 'box' || st === 'fight') {
          if (v.actT > 0 && (v.act === 'jab' || v.act === 'straight')) poseHero(v, dt, v.act, { speed: 6 });
          else if (v.actT > 0 && v.act) poseHero(v, dt, v.act === 'give' ? 'give' : 'boxing', { speed: 8, still: true });
          else poseHero(v, dt, 'guard', { speed: 6 });
        } else if (v.actT > 0 && v.act) poseHero(v, dt, v.act === 'give' ? 'give' : v.act, { speed: 9, still: v.act !== 'give' });
        else poseHero(v, dt, st === 'walk' ? 'walk' : 'run', { speed: st === 'walk' ? 7 : 12 });
      } else {
        // Tommy
        if (st === 'pose' || st === 'cheer' || (v.actT > 0 && v.act === 'peace')) {
          poseHero(v, dt, 'peace', { speed: 6, still: true });
          turn(v.p.root, FACE_CAM, dt * 12);
          y = st === 'cheer' ? Math.abs(Math.sin(t * 8)) * 0.3 : 0;
        } else if (v.actT > 0 && v.act === 'give') poseHero(v, dt, 'give', { speed: 12 });
        else if (st === 'fight') poseHero(v, dt, 'idle', { speed: 3 });
        else poseHero(v, dt, 'run', { speed: 12 });
      }
      v.y += (y - v.y) * Math.min(1, dt * 14);
      v.p.root.position.y = v.y;
    }

    // ---------------------------------------------------------------- win and lose scenes
    function celebrate(brother) {
      for (const c of celebrators) { dyn.remove(c.root); disposeTree(c.root); }
      celebrators = [];
      // on the path in front of the lawn, where no defender can hide them
      const spots = [[X(5.0), Z(4.5) + 0.75], [X(6.3), Z(4.5) + 0.95]];
      ['teddy', 'tommy'].forEach((who, i) => {
        const c = person(who, false);
        c.root.position.set(X(-0.4), 0, Z(4.5) + 0.8);
        c.to = new T.Vector3(spots[i][0], 0, spots[i][1]);
        c.t = -i * 0.25;
        dyn.add(c.root);
        celebrators.push(c);
      });
      cam.focus = new T.Vector3(X(5.65), 1.0, Z(4.5) + 0.2);
      cam.focusDist = 0.42;
      cam.fc = null;
    }

    function updateCelebrators(dt) {
      for (const c of celebrators) {
        c.t += dt;
        const pos = c.root.position;
        const d = c.to.clone().sub(pos);
        if (c.t < 0) continue;
        if (d.length() > 0.1 && !c.arrived) {
          pos.addScaledVector(d.normalize(), Math.min(d.length(), dt * 6));
          c.p.root.rotation.y = Math.atan2(-d.x, -d.z);
          poseHero(c, dt, 'run', { speed: 12 });
          continue;
        }
        c.arrived = true;
        turn(c.p.root, FACE_CAM, dt * 6);
        if (c.who === 'teddy') {
          // boxing combo, then a jump shot, over and over
          const cyc = (c.t % 3.6);
          if (cyc < 2.2) {
            poseHero(c, dt, 'boxing', { speed: 9 });
            c.root.position.y = 0;
            if (Math.floor(c.t * 4.5) !== c.beat && cyc < 2.1) {
              c.beat = Math.floor(c.t * 4.5);
              if (c.beat % 2 === 0) {
                const hp = c.root.position.clone().add(new T.Vector3(0.7, 1.4, 0.4));
                sparks.emit(hp, { n: 5, color: ['#ffe066', '#ffffff'], speed: 2, up: 1, life: 0.3, size: 0.3 });
              }
            }
          } else {
            const k = clamp((cyc - 2.2) / 0.9, 0, 1);
            c.root.position.y = Math.sin(k * Math.PI) * 0.8;
            poseHero(c, dt, 'jumpshot', { speed: 4 });
            if (k > 0.4 && c.shotCycle !== Math.floor(c.t / 3.6)) {
              c.shotCycle = Math.floor(c.t / 3.6);
              const b = M.basketball();
              const from = c.root.position.clone().setY(2.6);
              toss(b, from, from.clone().add(new T.Vector3(1.4, 0.6, -1.2)), 0.8, 1.8, (o) => {
                dyn.remove(o);
                burst('SWISH!', o.position.clone(), 1.2);
                confetti.emit(o.position, { n: 16, color: ['#ff6b9a', '#ffd23b', '#6bc8ff', '#8cff7a'], speed: 3, up: 3, gravity: 3, life: 1.6, size: 0.25, shrink: false });
                sfx.swish();
              });
            }
          }
        } else {
          poseHero(c, dt, 'peace', { speed: 7, still: true });
          c.root.position.y = Math.abs(Math.sin(c.t * 6)) * 0.22;
          if (Math.random() < dt * 2.5) {
            const s = emojiSprite(Math.random() < 0.6 ? '✌️' : '⭐', 0.6);
            const from = c.root.position.clone().setY(2.0);
            toss(s, from, from.clone().add(new T.Vector3((Math.random() - 0.5) * 2, 1.5, 0)), 1.2, 0.5, (o) => { dyn.remove(o); o.material.dispose(); });
          }
        }
      }
      if (celebrators.length && Math.random() < dt * 6) {
        confetti.emit(new T.Vector3(X(5.65) + (Math.random() - 0.5) * 7, 5.5, Z(4.5) + (Math.random() - 0.5) * 3), { n: 4, color: ['#ff6b9a', '#ffd23b', '#6bc8ff', '#8cff7a', '#ffffff'], speed: 1, up: 0, gravity: 1.5, life: 3.5, size: 0.28, drag: 1.5, shrink: false });
      }
    }

    // The zombie that got through strolls up to the porch and munches the cookies.
    function loseScene(zid) {
      const v = zs.get(zid);
      if (!v || !yard) return;
      loser = { v, t: 0, from: v.root.position.clone(), to: yard.jarPos.clone().add(new T.Vector3(0.9, -1.2, 0.4)) };
      cam.focus = new T.Vector3(-2.0, 0.9, 2.1);
      cam.focusDist = 0.5;
      cam.fc = null;
    }

    function updateLoser(dt) {
      if (!loser) return;
      const l = loser, v = l.v;
      l.t += dt;
      const k = clamp(l.t / 2.2, 0, 1);
      if (k < 1) {
        v.root.position.lerpVectors(l.from, l.to, k);
        v.root.position.y = Math.max(0, v.root.position.y);
        v.phase += dt * 4;
        P.pose(v.p, v.phase, 'walk', 1 - Math.exp(-14 * dt));
        v.p.root.position.y += (0 - v.p.root.position.y) * 0.2;
      } else {
        // munch munch: a cookie in hand, happy head bobs, crumbs
        turn(v.p.root, FACE_CAM_RIGHT - 0.4, dt * 5);
        P.pose(v.p, t * 3, 'idle', 1 - Math.exp(-10 * dt));
        v.p.armR.rotation.x = 2.2 + Math.sin(t * 10) * 0.25;
        v.p.armR.rotation.z = 0.1;
        v.p.head.rotation.x = Math.sin(t * 10) * 0.12;
        if (!l.cookie) {
          l.cookie = emojiSprite('🍪', 0.45);
          v.root.add(l.cookie);
          yard.jar.userData.lid.position.y = 0.9;
          yard.jar.userData.lid.rotation.z = 0.6;
        }
        l.cookie.position.set(0.15, 1.75 * v.s + Math.sin(t * 10) * 0.05, 0.4);
        if (Math.random() < dt * 8) {
          crumbs(v.root.position.clone().setY(1.6 * v.s));
          sfx.munch();
        }
      }
      v.flash = 0;
    }

    function crumbs(p) {
      confetti.emit(p, { n: 2, color: ['#c98a4a', '#8a5a2a'], speed: 1, up: 1.5, gravity: 6, life: 0.7, size: 0.12, shrink: false });
    }

    // ---------------------------------------------------------------- placement preview
    const ghosts = {};
    const cellMat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
    const cell = new T.Mesh(new T.PlaneGeometry(CW * 0.96, RD * 0.94).rotateX(-Math.PI / 2), cellMat);
    cell.position.y = 0.03;
    cell.visible = false;
    cell.renderOrder = 1;
    scene.add(cell);
    const laneMat = new T.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.25, depthWrite: false });
    const lane = new T.Mesh(new T.PlaneGeometry(CW * 9, RD * 0.94).rotateX(-Math.PI / 2), laneMat);
    lane.position.set(X(4.5), 0.035, 0);
    lane.visible = false;
    scene.add(lane);
    let ghostObj = null;

    function ghostHide() {
      cell.visible = false;
      lane.visible = false;
      if (ghostObj) ghostObj.visible = false;
    }

    function ghost(kind, row, col, ok, water) {
      if (!kind || row === null) return ghostHide();
      const hero = BVZ.CARDS[kind] && BVZ.CARDS[kind].hero;
      if (hero) {
        cell.visible = false;
        if (ghostObj) ghostObj.visible = false;
        lane.visible = true;
        lane.position.z = Z(row);
        laneMat.color.set(ok ? '#ffe066' : '#ff6b6b');
        return;
      }
      lane.visible = false;
      cell.visible = true;
      cell.position.set(X(col + 0.5), water ? -0.05 : 0.03, Z(row));
      cellMat.color.set(ok ? '#ffffff' : '#ff4d4d');
      if (kind === 'pack') { if (ghostObj) ghostObj.visible = false; return; }
      if (!ghosts[kind]) {
        const g = M.defender(kind);
        g.traverse((o) => {
          if (o.isMesh) {
            o.material = o.material.clone();
            o.material.transparent = true;
            o.material.opacity = 0.5;
            o.material.depthWrite = false;
          }
        });
        scene.add(g);
        ghosts[kind] = g;
      }
      if (ghostObj && ghostObj !== ghosts[kind]) ghostObj.visible = false;
      ghostObj = ghosts[kind];
      ghostObj.visible = ok;
      ghostObj.position.set(X(col + 0.5), water ? 0.1 : 0, Z(row));
    }

    // ---------------------------------------------------------------- per frame
    function sync(sim, dt) {
      t += dt;
      cam.focusK += ((cam.focus ? 1 : 0) - cam.focusK) * Math.min(1, dt * 2.5);
      if (cam.focus) {
        // ease toward the focus point too, so moving it (for the result card) glides instead of jumping
        if (!cam.fc) cam.fc = cam.focus.clone();
        cam.fc.lerp(cam.focus, Math.min(1, dt * 3));
      }
      if (yard) yard.update(t);
      // zombies
      const seen = new Set();
      for (const z of sim.zombies) {
        if (z.dead) continue;
        let v = zs.get(z.id);
        if (!v) v = makeZombie(z);
        seen.add(z.id);
        if (loser && loser.v === v) continue;
        updateZombie(v, z, dt);
      }
      for (const [id, v] of zs) if (!seen.has(id) && !(loser && loser.v === v)) poofZombie(v, 'gone');
      updateLeaving(dt);
      updateLoser(dt);
      // defenders
      for (const d of sim.defenders) {
        let v = defs.get(d.id);
        if (!v) v = makeDefender(d);
        updateDefender(v, d, dt, sim);
      }
      // shots
      for (const p of sim.shots) {
        const v = shots.get(p.id);
        if (!v) continue;
        const x = X(p.x);
        v.obj.position.x = x;
        if (v.kind === 'ball') {
          v.obj.position.y = 0.3 + 0.62 * Math.abs(Math.cos((Math.PI * (p.x - v.x0)) / 1.25));
          v.obj.rotation.z -= dt * 12;
        } else {
          v.obj.position.y = 1.25;
          v.obj.material.rotation = t * 8;
        }
      }
      // stars
      for (const st of sim.stars) {
        const v = stars.get(st.id);
        if (v) updateStar(v, st, dt);
      }
      // trains
      for (const tr of sim.trains) {
        const v = trains[tr.row];
        if (!v) continue;
        if (tr.state === 'used' && v.state !== 'used') { v.state = 'used'; v.obj.visible = false; }
        if (tr.state === 'go') {
          v.obj.position.x = X(tr.x);
          if (Math.random() < 0.7) sparks.emit(v.obj.position.clone().add(new T.Vector3(-0.8, 0.6, 0)), { n: 2, color: ['#ffffff', '#bfe6ff'], speed: 1, up: 0.5, gravity: 0, life: 0.4, size: 0.4 });
        }
      }
      updateHeroes(sim, dt);
      updateCelebrators(dt);
      updateBubbles(dt);
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i];
        f.t = (f.t || 0) + dt;
        const k = Math.min(1, f.t / f.dur);
        f.update(k);
        if (k >= 1) {
          fx.splice(i, 1);
          if (f.end) f.end();
        }
      }
      sparks.update(dt);
      confetti.update(dt);
      popcorn.update(dt);
    }

    function render(dt) {
      // camera: the board view, eased toward a close-up for the win and lose scenes (eased in sync())
      const target = cam.target.clone();
      let dist = cam.dist;
      if (cam.fc && cam.focusK > 0.001) {
        target.lerp(cam.fc, cam.focusK);
        dist = cam.dist * (1 - cam.focusK * (1 - cam.focusDist));
      }
      cam.shake = Math.max(0, cam.shake - dt);
      if (cam.shake > 0) target.add(new T.Vector3((Math.random() - 0.5) * cam.shake, (Math.random() - 0.5) * cam.shake * 0.5, 0));
      placeCamera(target, dist);
      renderer.render(scene, camera);
    }

    // ---------------------------------------------------------------- picking
    const ray = new T.Raycaster();
    const ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
    function ndc(cx, cy) {
      const r = canvas.getBoundingClientRect();
      return new T.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    }
    function pick(cx, cy) {
      ray.setFromCamera(ndc(cx, cy), camera);
      const hit = new T.Vector3();
      if (!ray.ray.intersectPlane(ground, hit)) return null;
      return { col: Math.floor(hit.x / CW), row: Math.round(hit.z / RD + 2), x: hit.x, z: hit.z };
    }
    function toScreen(v) {
      const p = v.clone().project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
    }
    function starAt(cx, cy, radius) {
      let best = null, bd = radius;
      for (const [id, v] of stars) {
        const s = toScreen(v.obj.position);
        const d = Math.hypot(s.x - cx, s.y - cy);
        if (d < bd) (bd = d), (best = id);
      }
      return best;
    }
    const starScreen = (id) => (stars.has(id) ? toScreen(stars.get(id).obj.position) : null);
    const brotherScreen = () => (comp ? toScreen(comp.root.position.clone().setY(2.2)) : null);

    // Render a defender to a PNG for its card (once, at start-up).
    function icons(kinds, size = 128) {
      const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1);
      r.setSize(size, size, false);
      r.outputEncoding = T.sRGBEncoding;
      const sc = new T.Scene();
      sc.add(new T.HemisphereLight('#ffffff', '#8a7a68', 1.1));
      const key = new T.DirectionalLight('#fff4e0', 0.9);
      key.position.set(3, 5, 6);
      sc.add(key);
      const c = new T.PerspectiveCamera(30, 1, 0.1, 50);
      const out = {};
      try {
        for (const k of kinds) {
          const g = M.defender(k);
          const tall = k === 'bag' ? 2.2 : k === 'ice' ? 2.0 : k === 'bounce' || k === 'popcorn' || k === 'floatie' ? 0.7 : 1.7;
          sc.add(g);
          c.position.set(1.4, tall * 0.6 + 1.3, 4.2 * Math.max(0.7, tall / 1.9));
          c.lookAt(0, tall * 0.45, 0);
          r.render(sc, c);
          out[k] = r.domElement.toDataURL('image/png');
          sc.remove(g);
        }
        const z = P.build(M.zombieLook('normal', 0));
        P.pose(z, 0, 'idle', 1);
        sc.add(z.root);
        c.position.set(0.6, 1.95, -2.6);
        c.lookAt(0, 1.7, 0);
        r.render(sc, c);
        out.zombie = r.domElement.toDataURL('image/png');
      } finally {
        r.dispose();
        r.forceContextLoss();
      }
      return out;
    }

    return {
      renderer, scene, camera, fit, setLevel, handle, sync, render, pick, starAt, starScreen, toScreen, brotherScreen,
      celebrate, loseScene, ghost, icons, clearAll,
      focus(p, k = 0.45) { cam.focus = p ? new T.Vector3(p.x, p.y || 0.8, p.z) : null; cam.fc = cam.focus && cam.focus.clone(); cam.focusDist = k; cam.focusK = p ? 1 : 0; },
      // slide the close-up so its subject sits lower on screen (under the result card)
      lowerFocus(dz) { if (cam.focus) cam.focus.z -= dz; },
      get counts() { return { zombies: zs.size, defenders: defs.size, stars: stars.size, leaving: leaving.length, fx: fx.length, calls: renderer.info.render.calls }; },
    };
  }

  BVZ.View = View;
})();
