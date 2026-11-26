// Senja Air — the archipelago: analytic terrain height, the displaced terrain
// mesh with painted vertex colours, the animated sea, runways with lights,
// villages, palms, rice terraces and the smoking volcano.
import * as THREE from 'three';
import { ISLANDS, RUNWAYS, WORLD } from './config.js';
import { makeRng, pickRng } from './rng.js';

// Analytic ground height at (x, z): island Gaussians minus the volcanic
// crater, then flattened to a table inside each runway rectangle.
export function groundHeight(x, z) {
  let h = 0;
  for (const isl of ISLANDS) {
    const dx = x - isl.cx;
    const dz = z - isl.cz;
    const d2 = dx * dx + dz * dz;
    h += isl.height * Math.exp(-d2 / (2 * isl.sigma * isl.sigma));
    if (isl.craterDip > 0) {
      h -= isl.craterDip * Math.exp(-d2 / (2 * isl.craterSigma * isl.craterSigma));
    }
  }
  // Flatten near runways so the strip is a table, blended at its edges.
  for (const key of Object.keys(RUNWAYS)) {
    const r = RUNWAYS[key];
    const c = Math.cos(-r.heading);
    const s = Math.sin(-r.heading);
    const lx = (x - r.cx) * c - (z - r.cz) * s;
    const lz = (x - r.cx) * s + (z - r.cz) * c;
    const hx = Math.max(0, Math.abs(lx) - r.length / 2);
    const hz = Math.max(0, Math.abs(lz) - r.width / 2 - 30);
    const edge = Math.sqrt(hx * hx + hz * hz);
    const blend = Math.max(0, 1 - edge / 250);
    if (blend > 0) h = h * (1 - blend) + r.elev * blend;
  }
  return Math.max(h, -6);
}

function terrainColour(h, slope, x, z) {
  // Sand at the shore, grass on the slopes, rock high up, ash near the volcano.
  const c = new THREE.Color();
  if (h < 4) c.setHex(0xd9b380);
  else if (h < 60) c.setHex(0x4a7a3d);
  else if (h < 130) c.setHex(0x3c6b34);
  else c.setHex(0x6e6a63);
  // Dusk tint: warm low, cooler high.
  const warm = Math.max(0, 1 - h / 160);
  c.r += warm * 0.10;
  c.g += warm * 0.02;
  // Volcanic ash around Pulau Api.
  const dx = x - 1500;
  const dz = z + 700;
  const dv = Math.sqrt(dx * dx + dz * dz);
  if (dv < 480) {
    const ash = Math.max(0, 1 - dv / 480) * 0.7;
    c.lerp(new THREE.Color(0x3a3230), ash);
  }
  // Slope darkening for relief.
  c.multiplyScalar(1 - Math.min(0.35, slope * 0.9));
  return c;
}

export function buildTerrain(scene) {
  const size = WORLD.size;
  const seg = 150;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    const hx = groundHeight(x + 8, z) - groundHeight(x - 8, z);
    const hz = groundHeight(x, z + 8) - groundHeight(x, z - 8);
    const slope = Math.sqrt(hx * hx + hz * hz) / 16;
    const c = terrainColour(h, slope, x, z);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  scene.add(mesh);
  return mesh;
}

export function buildSea(scene) {
  const geo = new THREE.PlaneGeometry(9000, 9000, 24, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x1d4a63, specular: 0xff9a4d, shininess: 90, transparent: true, opacity: 0.94,
  });
  const sea = new THREE.Mesh(geo, mat);
  sea.position.y = WORLD.seaLevel;
  scene.add(sea);
  return sea;
}

// Gentle swell: displace the sea vertices with two travelling sine waves.
// Normals are refreshed every third call; the swell is slow enough that
// nobody sees the lag, and it keeps the frame budget sane.
let _seaTick = 0;
export function animateSea(sea, t) {
  _seaTick++;
  const pos = sea.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, Math.sin(x * 0.008 + t * 0.7) * 0.55 + Math.cos(z * 0.011 - t * 0.5) * 0.45);
  }
  pos.needsUpdate = true;
  if (_seaTick % 3 === 0) sea.geometry.computeVertexNormals();
}

function runwayLights(runway, scene) {
  const group = new THREE.Group();
  const c = Math.cos(runway.heading);
  const s = Math.sin(runway.heading);
  const px = -s; // perpendicular unit vector
  const pz = c;
  const lampGeo = new THREE.SphereGeometry(1.5, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  for (let d = -runway.length / 2 + 8; d <= runway.length / 2 - 8; d += 24) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(
        runway.cx + c * d + px * side * (runway.width / 2 + 3),
        runway.elev + 0.8,
        runway.cz + s * d + pz * side * (runway.width / 2 + 3),
      );
      group.add(lamp);
    }
  }
  // Approach lights: a bright bar leading to each threshold, set on the ground.
  const appMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const end of [-1, 1]) {
    for (let k = 1; k <= 4; k++) {
      const ax = runway.cx + c * end * (runway.length / 2 + k * 18);
      const az = runway.cz + s * end * (runway.length / 2 + k * 18);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 6), appMat);
      lamp.position.set(ax, groundHeight(ax, az) + 1.2, az);
      group.add(lamp);
    }
  }
  scene.add(group);
  return group;
}

export function buildRunways(scene) {
  const groups = {};
  for (const key of Object.keys(RUNWAYS)) {
    const r = RUNWAYS[key];
    const group = new THREE.Group();
    // Asphalt strip.
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(r.length, 0.5, r.width),
      new THREE.MeshLambertMaterial({ color: 0x2c2c34 }),
    );
    strip.position.set(r.cx, r.elev + 0.2, r.cz);
    strip.rotation.y = -r.heading;
    group.add(strip);
    // Centreline dashes.
    const dashGeo = new THREE.BoxGeometry(9, 0.15, 1.6);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f0dc });
    const c = Math.cos(r.heading);
    const s = Math.sin(r.heading);
    for (let d = -r.length / 2 + 18; d <= r.length / 2 - 18; d += 26) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(r.cx + c * d, r.elev + 0.55, r.cz + s * d);
      dash.rotation.y = -r.heading;
      group.add(dash);
    }
    // Threshold bars at both ends.
    const barGeo = new THREE.BoxGeometry(2.2, 0.15, r.width * 0.7);
    for (const end of [-1, 1]) {
      const bar = new THREE.Mesh(barGeo, dashMat);
      bar.position.set(r.cx + c * end * (r.length / 2 - 8), r.elev + 0.55, r.cz + s * end * (r.length / 2 - 8));
      bar.rotation.y = -r.heading;
      group.add(bar);
    }
    // Windsock near the strip.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0xcccccc }),
    );
    pole.position.set(r.cx - s * (r.width / 2 + 14), r.elev + 4.5, r.cz + c * (r.width / 2 + 14));
    group.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 4.5, 8),
      new THREE.MeshLambertMaterial({ color: 0xff7a3c }),
    );
    sock.rotation.z = Math.PI / 2;
    sock.position.set(r.cx - s * (r.width / 2 + 14) + 2.4, r.elev + 8.6, r.cz + c * (r.width / 2 + 14));
    group.add(sock);
    scene.add(group);
    groups[key] = group;
    runwayLights(r, scene);
  }
  return groups;
}

// Small villages: warm-lit huts near the runways and coasts.
export function buildVillages(scene) {
  const rng = makeRng(20261126);
  const group = new THREE.Group();
  const hutGeo = new THREE.BoxGeometry(7, 5, 6);
  const roofGeo = new THREE.ConeGeometry(5.4, 3.4, 4);
  const hutMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4d });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x7a3a28 });
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const spots = [
    { cx: -40, cz: 260, n: 9, r: 90 },
    { cx: 1500, cz: -260, n: 7, r: 80 },
    { cx: -1400, cz: 640, n: 8, r: 85 },
    { cx: 1750, cz: 1150, n: 4, r: 60 },
  ];
  for (const spot of spots) {
    for (let i = 0; i < spot.n; i++) {
      const a = rng() * Math.PI * 2;
      const d = 20 + rng() * spot.r;
      const x = spot.cx + Math.cos(a) * d;
      const z = spot.cz + Math.sin(a) * d;
      const y = groundHeight(x, z);
      if (y < 3) continue;
      const hut = new THREE.Mesh(hutGeo, hutMat);
      hut.position.set(x, y + 2.5, z);
      hut.rotation.y = rng() * Math.PI;
      group.add(hut);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(x, y + 6.6, z);
      roof.rotation.y = Math.PI / 4 + hut.rotation.y;
      group.add(roof);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), winMat);
      win.position.set(x + Math.sin(hut.rotation.y) * 3.1, y + 2.6, z + Math.cos(hut.rotation.y) * 3.1);
      win.rotation.y = hut.rotation.y;
      group.add(win);
    }
  }
  scene.add(group);
  return group;
}

// Palm trees on the beaches: a trunk and a crown of fronds.
export function buildPalms(scene) {
  const rng = makeRng(777);
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2c });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a, side: THREE.DoubleSide });
  let placed = 0;
  let tries = 0;
  while (placed < 70 && tries < 600) {
    tries++;
    const x = pickRng(rng, -2400, 2400);
    const z = pickRng(rng, -2400, 2400);
    const h = groundHeight(x, z);
    if (h < 2 || h > 14) continue;
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 6), trunkMat);
    trunk.position.y = 4.5;
    trunk.rotation.z = pickRng(rng, -0.12, 0.12);
    palm.add(trunk);
    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.5, 7, 4), frondMat);
      frond.position.y = 9.4;
      frond.rotation.z = Math.PI / 2.4;
      frond.rotation.y = (f / 6) * Math.PI * 2;
      frond.translateY(2.2);
      palm.add(frond);
    }
    palm.position.set(x, h, z);
    palm.rotation.y = rng() * Math.PI * 2;
    group.add(palm);
    placed++;
  }
  scene.add(group);
  return group;
}

// Stepped rice terraces ringing Pulau Padi's slopes.
export function buildTerraces(scene) {
  const group = new THREE.Group();
  const cx = -1400;
  const cz = 800;
  const greens = [0x5da244, 0x6fb34e, 0x4c8a3a, 0x7cc25a];
  for (let ring = 0; ring < 6; ring++) {
    const radius = 90 + ring * 42;
    const y = groundHeight(cx + radius, cz);
    if (y < 8) continue;
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 7, 6, 48),
      new THREE.MeshLambertMaterial({ color: greens[ring % greens.length] }),
    );
    band.rotation.x = Math.PI / 2;
    band.position.set(cx, Math.max(y, 10), cz);
    band.scale.z = 0.35;
    group.add(band);
  }
  scene.add(group);
  return group;
}

// The volcano's glowing crater and its drifting smoke.
export function buildVolcano(scene) {
  const group = new THREE.Group();
  const crater = new THREE.Mesh(
    new THREE.CircleGeometry(72, 24),
    new THREE.MeshBasicMaterial({ color: 0xff5a1e }),
  );
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(1500, groundHeight(1500, -700) + 2, -700);
  group.add(crater);
  const glow = new THREE.PointLight(0xff6a2a, 900, 700, 1.6);
  glow.position.set(1500, groundHeight(1500, -700) + 30, -700);
  group.add(glow);
  // Smoke puffs: soft radial sprites that rise and fade (each own material).
  const smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = 128;
  smokeCanvas.height = 128;
  const sctx = smokeCanvas.getContext('2d');
  const sgrad = sctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  sgrad.addColorStop(0, 'rgba(200,190,200,0.55)');
  sgrad.addColorStop(0.6, 'rgba(180,170,180,0.25)');
  sgrad.addColorStop(1, 'rgba(180,170,180,0)');
  sctx.fillStyle = sgrad;
  sctx.fillRect(0, 0, 128, 128);
  const smokeTex = new THREE.CanvasTexture(smokeCanvas);
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const puffMat = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0.35, depthWrite: false });
    const puff = new THREE.Sprite(puffMat);
    puff.position.set(1500 + (i % 3 - 1) * 26, groundHeight(1500, -700) + 40 + i * 26, -700 + ((i * 37) % 50) - 25);
    const sc = 34 + i * 9;
    puff.scale.set(sc, sc, 1);
    puffs.push(puff);
    group.add(puff);
  }
  scene.add(group);
  return { group, puffs };
}

export function animateVolcano(volcano, t) {
  // Crater floor sits near y=142 (235 summit minus the 95 crater dip).
  volcano.puffs.forEach((puff, i) => {
    const rise = (t * 6 + i * 40) % 220;
    puff.position.y = 148 + rise;
    puff.material.opacity = 0.32 * (1 - rise / 260);
  });
}
