// Senja Air — the game itself: renderer, world, loop, camera, screens and
// the mission state machine. A small prop plane, three Indonesian islands,
// glowing rings and a runway at the end of each sortie, all at dusk.
import * as THREE from 'three';
import { COLOURS, MISSIONS, RUNWAYS, SCORE } from './config.js';
import {
  buildTerrain, buildSea, animateSea, buildRunways, buildVillages,
  buildPalms, buildTerraces, buildVolcano, animateVolcano, groundHeight,
} from './terrain.js';
import { buildSky, setNight, animateClouds } from './sky.js';
import { buildPlaneMesh, makeFlightState, stepFlight, posePlane } from './plane.js';
import { buildRings, checkRings, animateRings, ringsLeft } from './rings.js';
import { makeHud } from './hud.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import {
  makeMissionState, startMission, judgeGroundContact, ringBonus,
  landingScore, missionById, overRunway, overLandingZone,
} from './missions.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

// ---------- renderer, scene, camera ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COLOURS.fogDay, 900, 5400);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 14000);
camera.position.set(-260, 90, 700);

const ambient = new THREE.AmbientLight(0x8a6ab0, 0.75);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0x7a5aa8, 0x2a1a2a, 0.65);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xff9a4d, 2.4);
sunLight.position.set(-3200, 420, -1500);
scene.add(sunLight);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- world ----------
buildTerrain(scene);
const sea = buildSea(scene);
buildRunways(scene);
buildVillages(scene);
buildPalms(scene);
buildTerraces(scene);
const volcano = buildVolcano(scene);
const skyObj = buildSky(scene);

// ---------- aircraft ----------
const planeMesh = buildPlaneMesh();
scene.add(planeMesh);
const flight = makeFlightState();
posePlane(planeMesh, flight);

// ---------- systems ----------
const hud = makeHud();
const input = makeInput(canvas);
const audio = makeAudio();
const ms = makeMissionState();
let ringSet = null;
let cameraMode = 'chase'; // chase | cockpit
let paused = false;
let shotInput = null;
let crashTimer = 0;
let totalScore = 0;

function loadUnlocked() {
  try {
    return Math.max(1, Math.min(3, Number(localStorage.getItem('senja-air-unlocked') || 1)));
  } catch {
    return 1;
  }
}
function saveUnlocked(n) {
  try {
    localStorage.setItem('senja-air-unlocked', String(n));
  } catch { /* storage unavailable; progress lasts the session */ }
}
ms.unlocked = loadUnlocked();

function applyNight(night) {
  setNight(skyObj, night);
  const fog = new THREE.Color(COLOURS.fogDay).lerp(new THREE.Color(COLOURS.fogNight), night);
  scene.fog.color.copy(fog);
  sunLight.intensity = 2.4 - night * 1.7;
  ambient.intensity = 0.75 + night * 0.1;
  hemi.intensity = 0.65 - night * 0.2;
}

function beginMission(mission) {
  // Rebuild the rings for this sortie.
  if (ringSet) {
    scene.remove(ringSet.group);
    ringSet.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  ringSet = buildRings(scene, mission.rings);
  startMission(ms, mission, flight);
  applyNight(mission.night);
  posePlane(planeMesh, flight);
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('end-screen').classList.add('hidden');
  hud.setVisible(true);
  audio.ensure();
  audio.startMusic();
  hud.showMessage(mission.name, mission.brief, 4.5);
}

// ---------- title and end screens ----------
function buildMissionList() {
  const list = document.getElementById('mission-list');
  list.innerHTML = '';
  for (const m of MISSIONS) {
    const locked = m.id > ms.unlocked;
    const btn = document.createElement('button');
    btn.className = 'mission-btn' + (locked ? ' locked' : '');
    btn.innerHTML = `<b>Mission ${m.id} — ${m.name}</b> · ${m.subtitle}${locked ? ' · 🔒 finish the previous sortie to unlock' : ''}<br><span style="font-size:13px;color:#d8c4a0">${m.brief}</span>`;
    if (!locked) btn.addEventListener('click', () => beginMission(m));
    list.appendChild(btn);
  }
}

function showEnd(title, sub, detailHtml, buttons) {
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-sub').textContent = sub;
  document.getElementById('end-detail').innerHTML = detailHtml;
  const box = document.getElementById('end-buttons');
  box.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = 'btn' + (b.ghost ? ' ghost' : '');
    el.textContent = b.label;
    el.addEventListener('click', b.onClick);
    box.appendChild(el);
  }
  document.getElementById('end-screen').classList.remove('hidden');
}

function endMissionComplete() {
  const res = landingScore(ms, flight);
  totalScore = ms.score;
  ms.unlocked = Math.max(ms.unlocked, Math.min(3, ms.mission.id + 1));
  saveUnlocked(ms.unlocked);
  buildMissionList();
  const next = missionById(ms.mission.id + 1);
  showEnd(
    'Landed — welcome to ' + RUNWAYS[ms.mission.to].island + '!',
    `Mission ${ms.mission.id} · ${ms.mission.name} complete`,
    `Touchdown ${Math.round(-ms.touchdownVs * 196.85)} ft/min · Landing +${SCORE.landing} · Smooth +${res.smoothBonus} · Time +${res.timeBonus} · Fuel +${res.fuelBonus}<br>Total score <b>${ms.score.toLocaleString('en-US')}</b>`,
    [
      ...(next ? [{ label: 'Next mission: ' + next.name, onClick: () => beginMission(next) }] : []),
      { label: 'Fly it again', onClick: () => beginMission(ms.mission), ghost: true },
      { label: 'Mission menu', onClick: showTitle, ghost: true },
    ],
  );
  ms.phase = 'complete';
}

function endMissionFailed(title, sub, detail) {
  showEnd(title, sub, detail, [
    { label: 'Try again', onClick: () => beginMission(ms.mission) },
    { label: 'Mission menu', onClick: showTitle, ghost: true },
  ]);
  ms.phase = 'failed';
}

function showTitle() {
  ms.phase = 'title';
  buildMissionList();
  document.getElementById('title-screen').classList.remove('hidden');
  document.getElementById('end-screen').classList.add('hidden');
  hud.setVisible(false);
  document.getElementById('cockpit-frame').style.display = 'none';
}

// ---------- camera ----------
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _fwd = new THREE.Vector3();
let camSnapped = false;

function updateCamera(dt) {
  _fwd.set(Math.sin(flight.yaw), 0, Math.cos(flight.yaw));
  if (cameraMode === 'cockpit') {
    planeMesh.visible = false;
    document.getElementById('cockpit-frame').style.display = 'block';
    _camDesired.copy(flight.pos).addScaledVector(_fwd, 1.2);
    _camDesired.y += 1.35;
    camera.position.copy(_camDesired);
    _camTarget.copy(flight.pos).addScaledVector(_fwd, 160);
    _camTarget.y += flight.pitch * 60 - 4;
    camera.lookAt(_camTarget);
    camera.fov = 66;
  } else {
    planeMesh.visible = true;
    document.getElementById('cockpit-frame').style.display = 'none';
    _camDesired.copy(flight.pos).addScaledVector(_fwd, -15.5);
    _camDesired.y += 5.2;
    if (!camSnapped) {
      camera.position.copy(_camDesired);
      camSnapped = true;
    } else {
      camera.position.lerp(_camDesired, 1 - Math.exp(-dt * 3.4));
    }
    _camTarget.copy(flight.pos).addScaledVector(_fwd, 55);
    _camTarget.y += 2;
    camera.lookAt(_camTarget);
    camera.fov = 62 + flight.speed * 0.10;
  }
  camera.updateProjectionMatrix();
}

// Title-screen cinematic: a slow orbit over the home island at dusk.
function updateTitleCamera(t) {
  const a = t * 0.045;
  camera.position.set(Math.sin(a) * 620, 150 + Math.sin(t * 0.1) * 18, 300 + Math.cos(a) * 620);
  camera.lookAt(-100, 40, -100);
  camera.fov = 58;
  camera.updateProjectionMatrix();
}

// One step of the flying game: physics, rings, water and ground contact,
// the clock and the fuel-out rules. The frame loop calls it every frame;
// the test driver calls it directly to fly a whole sortie without rendering.
function tickFlying(dt, stick) {
  if (ms.phase === 'flying') {
    const events = stepFlight(flight, stick, dt, ms.mission.wind, elapsed);
    if (events.includes('stalled')) hud.showWarning('STALL — NOSE DOWN, THROTTLE UP');
    ms.timeLeft -= dt;

    // Rings.
    const hits = checkRings(ringSet, flight.pos);
    for (const hit of hits) {
      ringBonus(ms);
      flight.fuel = Math.min(100, flight.fuel + 10);
      audio.chime();
      hud.showMessage(`Ring ${ms.ringsGot}/${ms.ringsTotal}`, `+${SCORE.ring} points · +10 fuel`, 1.8);
    }

    // Water: ditching.
    if (!flight.onGround && flight.pos.y <= 1.1 && groundHeight(flight.pos.x, flight.pos.z) < 2) {
      crashPlane('Ditched in the sea');
    } else if (!flight.onGround && flight.pos.y <= 1.1) {
      crashPlane('Hit the water');
    } else {
      // Ground contact: landing, hard landing or crash.
      const contact = judgeGroundContact(ms, flight);
      if (contact === 'landed') {
        flight.onGround = true;
        flight.throttle = 0;
        audio.thud();
        hud.showMessage('Touchdown!', 'Rolling out…', 2.2);
        ms.phase = 'landed';
      } else if (contact === 'grounded') {
        // Gentle wheels-down on a strip that is not the destination:
        // just keep rolling, the sortie goes on.
        flight.onGround = true;
      } else if (contact === 'hard') {
        flight.hull -= 25;
        flight.onGround = false;
        flight.pos.y += 5;
        flight.verticalSpeed = 2.5;
        flight.pitch = 0.12;
        audio.thud();
        hud.showMessage('Hard landing!', `Hull ${Math.max(0, Math.round(flight.hull))}% — go around`, 2.5);
        if (flight.hull <= 0) crashPlane('The airframe gave out');
      } else if (contact === 'crash') {
        crashPlane('Crashed into terrain');
      }
    }

    // A gentle touchdown that rolled out on the destination strip counts:
    // if she is on the ground, on the strip, and nearly stopped, that is
    // a landing even if the first touch was a little banked or firm.
    if (ms.phase === 'flying' && flight.onGround && flight.speed < 8) {
      const dest = RUNWAYS[ms.mission.to];
      if (overLandingZone(flight.pos, dest)) {
        flight.throttle = 0;
        ms.phase = 'landed';
        audio.thud();
        hud.showMessage('Touchdown!', 'Rolling out…', 2.2);
      }
    }

    if (ms.phase === 'flying' && ms.timeLeft <= 0) {
      endMissionFailed('Out of time', `Mission ${ms.mission.id} · ${ms.mission.name}`, 'The dusk ran out before you reached the runway. The rings and the strip will still be there tomorrow — try again.');
    }
    if (ms.phase === 'flying' && flight.fuel <= 0 && flight.speed < 8 && flight.onGround) {
      endMissionFailed('Out of fuel', `Mission ${ms.mission.id} · ${ms.mission.name}`, 'She ran dry on the ground, short of the runway. Watch the fuel gauge — rings top it up.');
    }
  } else if (ms.phase === 'landed') {
    // Landed rollout: bleed speed, then the sortie is complete.
    flight.speed = Math.max(0, flight.speed - 13 * dt);
    flight.pos.y = groundHeight(flight.pos.x, flight.pos.z) + 1.6;
    const fwd = new THREE.Vector3(Math.sin(flight.yaw), 0, Math.cos(flight.yaw));
    flight.pos.addScaledVector(fwd, flight.speed * dt);
    flight.throttle = 0;
    if (flight.speed < 4) endMissionComplete();
  }
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let elapsed = 0;
let simHold = false; // when true the frame loop stops stepping the flight (tests drive tick() instead)

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  const t = elapsed;

  animateSea(sea, t);
  animateVolcano(volcano, t);
  animateClouds(skyObj, dt);
  if (ringSet) animateRings(ringSet, t);

  const keys = input.poll();
  if (keys.pressed.has('KeyM')) {
    const muted = audio.toggleMute();
    hud.showMessage(muted ? 'Sound off' : 'Sound on', '', 1.2);
  }
  if (keys.pressed.has('KeyC') && ms.phase === 'flying') {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
  }
  if (keys.pressed.has('KeyP') && (ms.phase === 'flying' || ms.phase === 'paused')) {
    paused = !paused;
    ms.phase = paused ? 'paused' : 'flying';
    hud.showMessage(paused ? 'Paused' : '', 'Press P to resume', 1.5);
  }
  if (keys.pressed.has('KeyR') && ms.phase !== 'title') beginMission(ms.mission);

  if (ms.phase === 'title') {
    updateTitleCamera(t);
  } else if (!simHold && (ms.phase === 'flying' || ms.phase === 'landed')) {
    // Stick input: shot mode injects its own, otherwise the player's.
    const stick = shotInput || { pitch: keys.pitch, roll: keys.roll, throttleDelta: keys.throttleDelta, airbrake: keys.airbrake };
    tickFlying(dt, stick);
    posePlane(planeMesh, flight);
    updateCamera(dt);
    hud.update(flight, ms.mission, ms.ringsGot, ms.ringsTotal, ms.score, ms.timeLeft, dt);
    audio.update(flight.throttle, flight.speed, ms.phase === 'flying');
  } else if (ms.phase === 'crashed') {
    crashTimer += dt;
    // Shudder the camera as the wreck settles.
    camera.position.x += (Math.random() - 0.5) * 0.4;
    camera.position.y += (Math.random() - 0.5) * 0.3;
    camera.lookAt(flight.pos);
    if (crashTimer > 1.5) {
      crashTimer = 0;
      ms.phase = 'failed';
    }
  }

  renderer.render(scene, camera);
}

function crashPlane(reason) {
  if (ms.phase !== 'flying') return;
  ms.phase = 'crashed';
  flight.bank = 0.85;
  flight.pitch = -0.3;
  posePlane(planeMesh, flight);
  audio.crash();
  hud.showMessage('Crashed', reason, 3);
  setTimeout(() => {
    if (ms.phase === 'failed') {
      endMissionFailed('Crashed — ' + reason, `Mission ${ms.mission.id} · ${ms.mission.name}`,
        'The little plane did her best. Check the rings, mind the fuel, and come in slower and flatter next time.');
    }
  }, 1600);
}

// ---------- boot ----------
buildMissionList();
if (shotName) {
  // Screenshot mode: skip the menu, fly the composed setup.
  const mission = shotName === 'night' ? MISSIONS[2] : MISSIONS[0];
  ringSet = buildRings(scene, mission.rings);
  const res = applyShot(shotName, {
    flight, ms, ringSet,
    setNight: (n) => applyNight(n),
  });
  if (res) {
    shotInput = res.input;
    ms.phase = 'flying';
    document.getElementById('title-screen').classList.add('hidden');
    hud.setVisible(true);
    camSnapped = false;
    window.SENJA_SHOT = res.label;
  } else {
    showTitle();
  }
} else {
  showTitle();
}

window.SENJA = {
  flight, ms, MISSIONS, RUNWAYS,
  version: '1.0.0',
  shot: shotName,
  ready: true,
  beginMission,
  showTitle,
  groundHeight,
  // Test hook: advance the flight simulation by dt seconds with a stick
  // input {pitch, roll, throttleDelta, airbrake}, without waiting for a frame.
  tick: (stick, dt) => { elapsed += dt; tickFlying(dt, stick); posePlane(planeMesh, flight); },
  // Test hook: hold the frame loop's own flight steps while a test drives tick().
  holdSim: (v) => { simHold = !!v; },
};

frame();
