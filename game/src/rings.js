// Senja Air — the glowing target rings: torus meshes with a soft inner
// disc, pulsing gently, collected when the plane threads them.
import * as THREE from 'three';

export function buildRings(scene, ringDefs) {
  const group = new THREE.Group();
  const rings = ringDefs.map((def) => {
    const ring = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(def.r, 1.6, 12, 40),
      new THREE.MeshBasicMaterial({ color: 0xffb347 }),
    );
    ring.add(torus);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(def.r * 0.94, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff9a3c, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    ring.add(disc);
    const glow = new THREE.PointLight(0xff9a3c, 260, 130, 1.8);
    ring.add(glow);
    ring.position.set(def.x, def.y, def.z);
    // Face the ring across the route: its plane is vertical, normal along the
    // direction of travel (roughly toward the destination).
    ring.userData = { def, collected: false, baseY: def.y, phase: Math.random() * Math.PI * 2 };
    group.add(ring);
    return ring;
  });
  scene.add(group);
  return { group, rings };
}

// A ring counts when the plane passes within its opening.
export function checkRings(ringSet, pos) {
  const hit = [];
  for (const ring of ringSet.rings) {
    if (ring.userData.collected) continue;
    const d = pos.distanceTo(ring.position);
    if (d < ring.userData.def.r * 0.95) {
      ring.userData.collected = true;
      ring.visible = false;
      hit.push(ring);
    }
  }
  return hit;
}

export function animateRings(ringSet, t) {
  for (const ring of ringSet.rings) {
    if (ring.userData.collected) continue;
    ring.position.y = ring.userData.baseY + Math.sin(t * 0.8 + ring.userData.phase) * 2.5;
    const s = 1 + Math.sin(t * 1.6 + ring.userData.phase) * 0.03;
    ring.scale.set(s, s, 1);
  }
}

export function ringsLeft(ringSet) {
  return ringSet.rings.filter((r) => !r.userData.collected).length;
}
