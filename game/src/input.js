// Senja Air — keyboard and mouse controls. Arrow keys pitch and bank,
// W/S work the throttle, Space is the airbrake; holding the left mouse
// button steers with the pointer. C toggles the camera, M mutes, P pauses.
export function makeInput(canvas) {
  const keys = new Set();
  const state = {
    pitch: 0,      // -1..1, positive = pull up
    roll: 0,       // -1..1, positive = bank right
    throttleDelta: 0,
    airbrake: false,
    mouseSteer: false,
    mouseX: 0,
    mouseY: 0,
    pressed: new Set(), // keys pressed since last poll (for one-shot actions)
  };

  const down = (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    state.pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  };
  const up = (e) => keys.delete(e.code);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      state.mouseSteer = true;
      state.mouseX = e.clientX / window.innerWidth;
      state.mouseY = e.clientY / window.innerHeight;
    }
  });
  window.addEventListener('mouseup', () => { state.mouseSteer = false; });
  window.addEventListener('mousemove', (e) => {
    if (state.mouseSteer) {
      state.mouseX = e.clientX / window.innerWidth;
      state.mouseY = e.clientY / window.innerHeight;
    }
  });

  function poll() {
    // Pitch: Up arrow pushes the nose down, Down pulls it up (stick convention).
    let pitch = 0;
    if (keys.has('ArrowUp')) pitch -= 1;
    if (keys.has('ArrowDown')) pitch += 1;
    // Roll: Left banks left, Right banks right.
    let roll = 0;
    if (keys.has('ArrowLeft')) roll -= 1;
    if (keys.has('ArrowRight')) roll += 1;
    // Mouse steering overrides the keys while held.
    if (state.mouseSteer) {
      roll = clamp01((state.mouseX - 0.5) * 2.4, -1, 1);
      pitch = clamp01((state.mouseY - 0.5) * -2.0, -1, 1);
    }
    let throttleDelta = 0;
    if (keys.has('KeyW') || keys.has('ShiftLeft') || keys.has('ShiftRight')) throttleDelta += 0.55;
    if (keys.has('KeyS') || keys.has('ControlLeft')) throttleDelta -= 0.55;
    state.pitch = pitch;
    state.roll = roll;
    state.throttleDelta = throttleDelta;
    state.airbrake = keys.has('Space');
    const pressed = new Set(state.pressed);
    state.pressed.clear();
    return { pitch, roll, throttleDelta, airbrake: state.airbrake, pressed };
  }

  return { state, poll };
}

function clamp01(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
