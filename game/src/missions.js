// Senja Air — mission flow: starting a sortie on its runway, tracking rings,
// judging touchdowns and crashes, and scoring the flight.
import * as THREE from 'three';
import { MISSIONS, RUNWAYS, SCORE } from './config.js';
import { groundHeight } from './terrain.js';

export function makeMissionState() {
  return {
    mission: MISSIONS[0],
    ringsGot: 0,
    ringsTotal: 0,
    score: 0,
    timeLeft: 0,
    phase: 'title', // title | flying | landed | crashed | complete | failed
    touchdownVs: 0,
    unlocked: 1,    // how many missions are open
  };
}

// Place the plane at the start of the mission's runway, facing down the strip.
export function startMission(ms, mission, flight) {
  ms.mission = mission;
  ms.ringsGot = 0;
  ms.ringsTotal = mission.rings.length;
  ms.timeLeft = mission.timeLimit;
  ms.phase = 'flying';
  const runway = RUNWAYS[mission.from];
  const c = Math.cos(runway.heading);
  const s = Math.sin(runway.heading);
  // Start near the far end of the strip so the whole runway lies ahead.
  const startAlong = -runway.length / 2 + 45;
  flight.pos.set(
    runway.cx + c * startAlong,
    runway.elev + 1.6,
    runway.cz + s * startAlong,
  );
  flight.yaw = mission.startHeading;
  flight.pitch = 0;
  flight.bank = 0;
  flight.speed = 0;
  flight.throttle = 0;
  flight.fuel = mission.fuel;
  flight.hull = 100;
  flight.verticalSpeed = 0;
  flight.onGround = true;
  flight.airbrake = false;
}

// Is the plane above the destination runway's rectangle?
export function overRunway(pos, runway) {
  const c = Math.cos(-runway.heading);
  const s = Math.sin(-runway.heading);
  const lx = (pos.x - runway.cx) * c - (pos.z - runway.cz) * s;
  const lz = (pos.x - runway.cx) * s + (pos.z - runway.cz) * c;
  return Math.abs(lx) <= runway.length / 2 && Math.abs(lz) <= runway.width / 2;
}

// Is the plane above the landing zone — the strip plus the flat grass
// beside it? A bush strip forgives a touchdown a little wide of the paint.
export function overLandingZone(pos, runway) {
  const c = Math.cos(-runway.heading);
  const s = Math.sin(-runway.heading);
  const lx = (pos.x - runway.cx) * c - (pos.z - runway.cz) * s;
  const lz = (pos.x - runway.cx) * s + (pos.z - runway.cz) * c;
  return Math.abs(lx) <= runway.length / 2 + 60 && Math.abs(lz) <= runway.width / 2 + 75;
}

// Judge what happens when the plane meets the ground. Returns
// 'landed' | 'grounded' | 'hard' | 'crash' | null (still airborne).
// 'grounded' is a gentle wheels-down on a strip that is not the destination
// (a bounced takeoff, a rejected landing): the plane just keeps rolling.
export function judgeGroundContact(ms, flight) {
  const groundY = groundHeight(flight.pos.x, flight.pos.z);
  const dest = RUNWAYS[ms.mission.to];
  const planeY = flight.pos.y - 1.6; // wheels
  if (planeY > groundY + 0.4) return null;
  if (flight.onGround) return null; // already rolling; nothing to judge
  const onDest = overLandingZone(flight.pos, dest);
  const onAny = onDest || Object.values(RUNWAYS).some((r) => overRunway(flight.pos, r));
  const vs = flight.verticalSpeed;
  const aligned = Math.abs(flight.bank) < 1.1;
  if (onDest && vs > -7 && flight.speed < 70 && aligned) {
    ms.touchdownVs = vs;
    return 'landed';
  }
  // Just lifted off, or skimming level over a strip: not a landing, keep flying.
  if (vs >= -0.5) return null;
  if (onAny && vs > -7) return 'grounded';
  if (onAny && vs > -10 && flight.speed < 80) return 'hard';
  if (!onAny && vs > -2 && flight.speed < 25) return 'grounded';
  return 'crash';
}

export function ringBonus(ms) {
  ms.ringsGot += 1;
  ms.score += SCORE.ring;
}

export function landingScore(ms, flight) {
  const smooth = THREE.MathUtils.clamp(1 + ms.touchdownVs / 3.2, 0, 1);
  const smoothBonus = Math.round(SCORE.smoothBonus * smooth);
  const timeBonus = Math.round(Math.max(0, ms.timeLeft) * SCORE.timePerSecond);
  const fuelBonus = Math.round(Math.max(0, flight.fuel) * SCORE.fuelPerUnit);
  const total = SCORE.landing + smoothBonus + timeBonus + fuelBonus;
  ms.score += total;
  return { smoothBonus, timeBonus, fuelBonus, total };
}

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id);
}
