// Senja Air — deterministic screenshot setups. ?shot=cover|takeoff|landing|night
// places the plane, the rings and the light for a composed frame, and returns
// the synthetic stick input that holds the pose while the shot is taken.
import { MISSIONS } from './config.js';
import { startMission } from './missions.js';

function faceToward(flight, tx, tz) {
  const dx = tx - flight.pos.x;
  const dz = tz - flight.pos.z;
  flight.yaw = Math.atan2(dx, dz);
}

export function applyShot(name, api) {
  const { flight, ms, ringSet, setNight } = api;
  const input = { pitch: 0, roll: 0, throttleDelta: 0 };

  if (name === 'cover') {
    // Mid-flight through the strait, banking right toward the next ring,
    // volcano and setting sun in the frame.
    startMission(ms, MISSIONS[0], flight);
    ringSet.rings[0].userData.collected = true;
    ringSet.rings[0].visible = false;
    ringSet.rings[1].userData.collected = true;
    ringSet.rings[1].visible = false;
    ms.ringsGot = 2;
    flight.pos.set(950, 150, -60);
    faceToward(flight, 1350, -120);
    flight.speed = 58;
    flight.throttle = 0.72;
    flight.pitch = 0.04;
    flight.bank = 0.38;
    flight.onGround = false;
    flight.fuel = 78;
    setNight(0);
    input.pitch = 0.08;
    input.roll = 0.45;
    return { input, label: 'cover — banking through the strait toward Pulau Api' };
  }

  if (name === 'takeoff') {
    // Rolling down Senja's runway at dusk, throttle open, runway ahead.
    startMission(ms, MISSIONS[0], flight);
    flight.speed = 34;
    flight.throttle = 0.8;
    flight.fuel = 100;
    setNight(0);
    input.throttleDelta = 0.25;
    return { input, label: 'takeoff — rolling down the Senja runway' };
  }

  if (name === 'landing') {
    // Final approach to Pulau Api's runway from the south, all rings collected.
    startMission(ms, MISSIONS[0], flight);
    for (const ring of ringSet.rings) {
      ring.userData.collected = true;
      ring.visible = false;
    }
    ms.ringsGot = 5;
    flight.pos.set(1500, 45, -220);
    faceToward(flight, 1500, -330);
    flight.speed = 48;
    flight.throttle = 0.36;
    flight.pitch = -0.05;
    flight.bank = 0;
    flight.onGround = false;
    flight.fuel = 61;
    setNight(0.12);
    input.pitch = -0.05;
    return { input, label: 'landing — final approach to Pulau Api' };
  }

  if (name === 'night') {
    // Night leg home: village lights below, ring lights ahead, stars out.
    startMission(ms, MISSIONS[2], flight);
    ringSet.rings[0].userData.collected = true;
    ringSet.rings[0].visible = false;
    ms.ringsGot = 1;
    flight.pos.set(-700, 165, 450);
    faceToward(flight, -100, 330);
    flight.speed = 62;
    flight.throttle = 0.72;
    flight.pitch = 0.05;
    flight.bank = 0.22;
    flight.onGround = false;
    flight.fuel = 64;
    setNight(1);
    input.pitch = 0.06;
    input.roll = 0.3;
    return { input, label: 'night — the long way home under the stars' };
  }

  return null;
}
