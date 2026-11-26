// Senja Air — world constants, island layout, runways and mission definitions.
// All distances are metres, speeds metres per second, angles radians.
// The archipelago is analytic: terrain height is a sum of Gaussian island bumps
// plus a volcanic crater dip, flattened to a table near each runway.

export const WORLD = {
  size: 5600,          // terrain mesh spans -2800..2800 in x and z
  seaLevel: 0,
  maxSpeed: 95,        // m/s at full throttle (~185 kt)
  stallSpeed: 26,      // below this the wing stops flying and she sinks
  rotateSpeed: 42,     // speed at which the nose can lift off the runway
  maxPitch: 0.42,      // radians of pitch authority
  maxBank: 1.05,       // radians of bank authority
  turnFactor: 1.5,     // arcade turn authority over the coordinated-turn rate
  gearHeight: 1.6,     // wheels sit this far below the plane origin
  gravity: 9.81,
};

// Each island is a Gaussian bump: height * exp(-d^2 / (2*sigma^2)).
// The volcano carries a craterDip that carves its summit out.
export const ISLANDS = [
  { name: 'Pulau Senja', cx: 0, cz: 300, height: 58, sigma: 330, craterDip: 0, craterSigma: 1, kind: 'home' },
  { name: 'Pulau Api', cx: 1500, cz: -1000, height: 150, sigma: 500, craterDip: 60, craterSigma: 130, kind: 'volcano' },
  { name: 'Pulau Padi', cx: -1400, cz: 800, height: 95, sigma: 550, craterDip: 0, craterSigma: 1, kind: 'terraces' },
  { name: 'Pulau Karang', cx: -350, cz: -1550, height: 42, sigma: 210, craterDip: 0, craterSigma: 1, kind: 'rock' },
  { name: 'Pulau Kecil', cx: 1750, cz: 1150, height: 30, sigma: 170, craterDip: 0, craterSigma: 1, kind: 'rock' },
  { name: 'Pulau Ombak', cx: 700, cz: 1700, height: 24, sigma: 150, craterDip: 0, craterSigma: 1, kind: 'rock' },
  { name: 'Pulau Senyum', cx: -1900, cz: -600, height: 36, sigma: 190, craterDip: 0, craterSigma: 1, kind: 'rock' },
];

// A runway is a flat table carved into its island: heading is the runway
// direction in radians (0 = east along +x, PI/2 = south along +z).
export const RUNWAYS = {
  senja: { island: 'Pulau Senja', cx: -40, cz: 180, heading: 0, length: 460, width: 52, elev: 12 },
  api: { island: 'Pulau Api', cx: 1500, cz: -330, heading: Math.PI / 2, length: 480, width: 50, elev: 20 },
  padi: { island: 'Pulau Padi', cx: -1400, cz: 560, heading: 0, length: 460, width: 50, elev: 16 },
};

// Ring: a glowing torus the pilot threads. x, z place it, y is its altitude.
export const MISSIONS = [
  {
    id: 1,
    name: 'Senja Pertama',
    subtitle: 'First Dusk — Senja to Api',
    from: 'senja',
    to: 'api',
    startHeading: Math.PI / 2,   // face east (+x) down the Senja runway, toward the first ring
    fuel: 100,
    timeLimit: 420,
    wind: 0.0,                   // m/s sideways gust strength
    night: 0.0,                  // 0 = golden dusk, 1 = full night
    brief: 'Take off from Pulau Senja, thread 5 rings over the strait, and land on Pulau Api beneath the volcano.',
    rings: [
      { x: 350, y: 95, z: 60, r: 26 },
      { x: 700, y: 120, z: -120, r: 26 },
      { x: 1050, y: 160, z: -180, r: 26 },
      { x: 1350, y: 140, z: -120, r: 26 },
      { x: 1500, y: 110, z: 400, r: 24 },
    ],
  },
  {
    id: 2,
    name: 'Lintasi Badai',
    subtitle: 'Storm Crossing — Api to Padi',
    from: 'api',
    to: 'padi',
    startHeading: 0,           // face south (+z) down the Api runway, toward the first ring
    fuel: 100,
    timeLimit: 420,
    wind: 2.5,
    night: 0.35,
    brief: 'A squall is crossing the strait. Fight the gusts, thread 6 rings, and set down on Pulau Padi’s terraced slopes.',
    rings: [
      { x: 1150, y: 190, z: -350, r: 26 },
      { x: 600, y: 170, z: -350, r: 26 },
      { x: 100, y: 150, z: -100, r: 26 },
      { x: -400, y: 180, z: 150, r: 26 },
      { x: -900, y: 140, z: 380, r: 26 },
      { x: -800, y: 150, z: 560, r: 24 },
    ],
  },
  {
    id: 3,
    name: 'Pulang Malam',
    subtitle: 'Night Return — Padi to Senja',
    from: 'padi',
    to: 'senja',
    startHeading: Math.PI / 2,   // face east (+x) down the Padi runway, toward home
    fuel: 85,
    timeLimit: 420,
    wind: 1.5,
    night: 1.0,
    brief: 'Night has fallen. Follow the ring lights home and land on Senja’s runway by its edge lights alone.',
    rings: [
      { x: -1000, y: 120, z: 500, r: 26 },
      { x: -550, y: 150, z: 420, r: 26 },
      { x: -100, y: 130, z: 330, r: 26 },
      { x: 350, y: 120, z: 200, r: 24 },
    ],
  },
];

export const SCORE = {
  ring: 250,
  landing: 500,
  smoothBonus: 300,   // scaled by how gentle the touchdown was
  timePerSecond: 2,   // bonus per second left on the clock
  fuelPerUnit: 3,      // bonus per unit of fuel left
};

export const COLOURS = {
  skyTopDay: 0x2a1b5e,
  skyMidDay: 0x7a4a8f,
  skyHorizonDay: 0xff8c42,
  skyTopNight: 0x05030f,
  skyMidNight: 0x141038,
  skyHorizonNight: 0x3a1c4d,
  sunDay: 0xffd27a,
  seaDay: 0x1d4a63,
  seaNight: 0x0a1626,
  fogDay: 0xd98a5f,
  fogNight: 0x120a24,
};
