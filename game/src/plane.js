// Senja Air — the aircraft: a little cream-and-teal prop plane built from
// primitives, and the arcade flight model that flies it (throttle, pitch,
// bank-to-turn, stall sink, ground roll, wind drift).
import * as THREE from 'three';
import { WORLD } from './config.js';
import { groundHeight } from './terrain.js';

export function buildPlaneMesh() {
  const plane = new THREE.Group();
  const cream = new THREE.MeshLambertMaterial({ color: 0xf3e2c2 });
  const teal = new THREE.MeshLambertMaterial({ color: 0x2f7f7a });
  const orange = new THREE.MeshLambertMaterial({ color: 0xff7a3c });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c2c34 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x9fd8ff, shininess: 120, specular: 0xffffff });

  // Fuselage: a tapered cylinder pointing +z (the nose).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 6.4, 12), cream);
  fuselage.rotation.x = Math.PI / 2;
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 12), orange);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 3.9;
  plane.add(nose);
  // Orange cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.06, 5.6, 12, 1, true), orange);
  stripe.rotation.x = Math.PI / 2;
  stripe.scale.set(1, 1, 0.35);
  stripe.position.y = 0.05;
  plane.add(stripe);
  // Cockpit canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8), glass);
  canopy.scale.set(0.85, 0.7, 1.5);
  canopy.position.set(0, 0.85, 1.1);
  plane.add(canopy);
  // Main wings.
  const wingGeo = new THREE.BoxGeometry(11.5, 0.22, 2.1);
  const wing = new THREE.Mesh(wingGeo, teal);
  wing.position.set(0, -0.1, 0.4);
  plane.add(wing);
  const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 2.1), orange);
  tipL.position.set(-5.9, -0.1, 0.4);
  plane.add(tipL);
  const tipR = tipL.clone();
  tipR.position.x = 5.9;
  plane.add(tipR);
  // Tail: horizontal stabiliser and vertical fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 1.4), teal);
  stab.position.set(0, 0.15, -3.1);
  plane.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 1.6), orange);
  fin.position.set(0, 1.0, -3.1);
  plane.add(fin);
  // Propeller: hub + two blades, spinning with throttle.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 8), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.34, 4.6, 0.12);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
  const b1 = new THREE.Mesh(bladeGeo, bladeMat);
  const b2 = new THREE.Mesh(bladeGeo, bladeMat);
  b2.rotation.z = Math.PI / 2;
  prop.add(b1);
  prop.add(b2);
  prop.position.z = 4.8;
  plane.add(prop);
  // Landing gear: three little legs with wheels.
  const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [gx, gz] of [[-1.1, 1.6], [1.1, 1.6], [0, -2.6]]) {
    const leg = new THREE.Mesh(legGeo, dark);
    leg.position.set(gx, -1.1, gz);
    plane.add(leg);
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(gx, -1.6, gz);
    plane.add(wheel);
  }
  // Navigation lights: red port, green starboard, white tail.
  const navMat = (color) => new THREE.MeshBasicMaterial({ color });
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), navMat(0xff2a2a));
  navL.position.set(-5.9, -0.05, 0.4);
  plane.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), navMat(0x2aff66));
  navR.position.set(5.9, -0.05, 0.4);
  plane.add(navR);
  const navT = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), navMat(0xffffff));
  navT.position.set(0, 0.3, -3.9);
  plane.add(navT);

  plane.userData.prop = prop;
  plane.userData.navL = navL;
  plane.userData.navR = navR;
  return plane;
}

export function makeFlightState() {
  return {
    pos: new THREE.Vector3(0, 14, 180),
    yaw: 0,            // heading, 0 = +z (south), increases toward +x (east)
    pitch: 0,          // nose up positive
    bank: 0,           // right wing down positive
    speed: 0,          // m/s along the nose
    throttle: 0,       // 0..1
    fuel: 100,
    hull: 100,
    verticalSpeed: 0,  // m/s, for the HUD and landing judgement
    onGround: true,
    airbrake: false,
    windX: 0,          // sideways drift from gusts
    windZ: 0,
  };
}

// One physics step. input: { pitch: -1..1 (1 = pull up), roll: -1..1 (1 = bank right),
// throttleDelta, airbrake }. Returns events: 'lifted', 'stalled'.
export function stepFlight(st, input, dt, windStrength, t) {
  const events = [];
  // Throttle.
  st.throttle = THREE.MathUtils.clamp(st.throttle + input.throttleDelta * dt, 0, 1);
  if (st.fuel <= 0) st.throttle = 0;
  const targetSpeed = st.throttle * WORLD.maxSpeed * (st.airbrake ? 0.55 : 1);
  const accel = st.onGround ? 14 : 9;
  st.speed += THREE.MathUtils.clamp(targetSpeed - st.speed, -accel * dt * 2.2, accel * dt);

  // Pitch and bank chase their targets; authority stays strong at low speed
  // so the plane can still flare and descend on final instead of floating
  // over the strip.
  const authority = THREE.MathUtils.clamp(0.6 + 0.4 * (st.speed / WORLD.maxSpeed), 0.6, 1);
  const pitchTarget = input.pitch * WORLD.maxPitch * authority;
  const bankTarget = input.roll * WORLD.maxBank;
  st.pitch += THREE.MathUtils.clamp(pitchTarget - st.pitch, -1.4 * dt, 1.4 * dt);
  st.bank += THREE.MathUtils.clamp(bankTarget - st.bank, -1.8 * dt, 1.8 * dt);

  // Coordinated turn: banking turns the nose. Forward is (sin yaw, 0, cos yaw),
  // so increasing yaw turns left; banking right (positive bank) must decrease it.
  // turnFactor gives the arcade responsiveness a tight island course needs.
  const turnRate = (WORLD.turnFactor * WORLD.gravity * Math.tan(st.bank)) / Math.max(st.speed, 12);
  st.yaw -= THREE.MathUtils.clamp(turnRate, -0.6, 0.6) * dt;

  // Gusts: slow sinusoidal sideways push, scaled by the mission's wind.
  const gust = Math.sin(t * 0.45) * 0.6 + Math.sin(t * 0.13 + 1.7) * 0.4;
  st.windX = Math.cos(st.yaw) * gust * windStrength;
  st.windZ = -Math.sin(st.yaw) * gust * windStrength;

  const forward = new THREE.Vector3(Math.sin(st.yaw), 0, Math.cos(st.yaw));
  const groundY = groundHeight(st.pos.x, st.pos.z) + WORLD.gearHeight;

  if (st.onGround) {
    // Roll along the runway; the nose lifts once fast enough and pulled up.
    st.pos.y = groundY;
    st.pitch *= 0.9;
    st.bank *= 0.9;
    if (st.speed > WORLD.rotateSpeed && input.pitch > 0.25) {
      st.onGround = false;
      events.push('lifted');
    }
  } else {
    // Climb from pitch, sink when slow (stall).
    let climb = Math.sin(st.pitch) * st.speed;
    if (st.speed < WORLD.stallSpeed) {
      climb -= (WORLD.stallSpeed - st.speed) * 0.55;
      if (st.speed < WORLD.stallSpeed * 0.7) events.push('stalled');
    }
    st.verticalSpeed = climb;
    st.pos.y += climb * dt;
  }

  // Advance along the nose, plus wind drift.
  st.pos.addScaledVector(forward, st.speed * dt);
  st.pos.x += st.windX * dt;
  st.pos.z += st.windZ * dt;

  // Fuel burn: thirstier at high throttle; rings top the tank back up.
  if (st.speed > 1) st.fuel = Math.max(0, st.fuel - (0.08 + st.throttle * 0.20) * dt);

  return events;
}

// Apply the flight state to the visible mesh.
export function posePlane(mesh, st) {
  mesh.position.copy(st.pos);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = st.yaw;
  mesh.rotation.x = -st.pitch;
  mesh.rotation.z = -st.bank;
  mesh.userData.prop.rotation.z += (2 + st.throttle * 26) * 0.016;
}
