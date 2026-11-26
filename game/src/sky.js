// Senja Air — the dusk sky: a gradient dome shader that slides from golden
// hour to night, a low sun, stars that fade in, and drifting clouds.
import * as THREE from 'three';
import { COLOURS } from './config.js';
import { makeRng, pickRng } from './rng.js';

const skyVertex = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w;
}`;

const skyFragment = `
uniform vec3 topColor;
uniform vec3 midColor;
uniform vec3 horizonColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, -0.08, 1.0);
  vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.28, h));
  col = mix(col, topColor, smoothstep(0.22, 0.75, h));
  float sunAmount = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 18.0);
  col += sunColor * sunAmount * 0.9;
  float halo = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 4.0);
  col += sunColor * halo * 0.18;
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildSky(scene) {
  const uniforms = {
    topColor: { value: new THREE.Color(COLOURS.skyTopDay) },
    midColor: { value: new THREE.Color(COLOURS.skyMidDay) },
    horizonColor: { value: new THREE.Color(COLOURS.skyHorizonDay) },
    sunDir: { value: new THREE.Vector3(-0.75, 0.10, -0.35).normalize() },
    sunColor: { value: new THREE.Color(COLOURS.sunDay) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(6500, 32, 18),
    new THREE.ShaderMaterial({
      uniforms, vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false,
    }),
  );
  scene.add(sky);

  // The sun disc itself, low over the western sea.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(150, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
  );
  sun.position.set(-4800, 620, -2200);
  sun.lookAt(0, 0, 0);
  scene.add(sun);

  // Stars, invisible at dusk, fading in as night falls.
  const starGeo = new THREE.BufferGeometry();
  const rng = makeRng(4242);
  const starPos = new Float32Array(700 * 3);
  for (let i = 0; i < 700; i++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(pickRng(rng, 0.08, 1));
    const r = 6000;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi) + 200;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 3.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false,
  }));
  scene.add(stars);

  // Soft billboard clouds, pink at dusk, drifting east.
  const clouds = [];
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 256;
  cloudCanvas.height = 128;
  const ctx = cloudCanvas.getContext('2d');
  const grad = ctx.createRadialGradient(128, 64, 8, 128, 64, 120);
  grad.addColorStop(0, 'rgba(255,225,205,0.85)');
  grad.addColorStop(0.55, 'rgba(255,190,160,0.45)');
  grad.addColorStop(1, 'rgba(255,180,150,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);
  const cloudTex = new THREE.CanvasTexture(cloudCanvas);
  const crng = makeRng(99);
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: pickRng(crng, 0.5, 0.85), depthWrite: false });
    const cloud = new THREE.Sprite(mat);
    cloud.position.set(pickRng(crng, -3200, 3200), pickRng(crng, 260, 480), pickRng(crng, -3200, 3200));
    cloud.scale.set(pickRng(crng, 420, 900), pickRng(crng, 130, 260), 1);
    cloud.userData.drift = pickRng(crng, 2, 6);
    clouds.push(cloud);
    scene.add(cloud);
  }

  return { sky, uniforms, sun, stars, clouds };
}

const _topDay = new THREE.Color(COLOURS.skyTopDay);
const _topNight = new THREE.Color(COLOURS.skyTopNight);
const _midDay = new THREE.Color(COLOURS.skyMidDay);
const _midNight = new THREE.Color(COLOURS.skyMidNight);
const _horDay = new THREE.Color(COLOURS.skyHorizonDay);
const _horNight = new THREE.Color(COLOURS.skyHorizonNight);

// night: 0 = golden dusk, 1 = full night. Slides the sky, sun and stars.
export function setNight(skyObj, night) {
  const n = THREE.MathUtils.clamp(night, 0, 1);
  skyObj.uniforms.topColor.value.copy(_topDay).lerp(_topNight, n);
  skyObj.uniforms.midColor.value.copy(_midDay).lerp(_midNight, n);
  skyObj.uniforms.horizonColor.value.copy(_horDay).lerp(_horNight, n);
  skyObj.sun.material.color.setHex(n > 0.7 ? 0x8a6a8a : 0xffe9a8);
  skyObj.sun.material.opacity = 1 - n * 0.85;
  skyObj.sun.material.transparent = true;
  skyObj.stars.material.opacity = n * 0.95;
  skyObj.clouds.forEach((c) => { c.material.opacity = (0.5 + (c.userData.drift % 1) * 0.35) * (1 - n * 0.45); });
}

export function animateClouds(skyObj, dt) {
  for (const cloud of skyObj.clouds) {
    cloud.position.x += cloud.userData.drift * dt;
    if (cloud.position.x > 3400) cloud.position.x = -3400;
  }
}
