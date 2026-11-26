// Senja Air — the HUD: DOM readouts for altitude, speed, vertical speed,
// heading tape, rings, score and time, throttle/fuel/hull bars, and a
// canvas artificial horizon that rolls and pitches with the aircraft.
import { WORLD } from './config.js';

const $ = (id) => document.getElementById(id);

const COMPASS_POINTS = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];

export function makeHud() {
  const horizon = $('horizon');
  const hctx = horizon.getContext('2d');
  const els = {
    alt: $('hud-alt'), spd: $('hud-spd'), vs: $('hud-vs'),
    hdg: $('compass-hdg'), tape: $('compass-tape'),
    mission: $('hud-mission'), rings: $('hud-rings'), score: $('hud-score'), time: $('hud-time'),
    barThr: $('bar-thr'), barFuel: $('bar-fuel'), barHull: $('bar-hull'),
    msgBig: $('msg-big'), msgSub: $('msg-sub'), warn: $('hud-warn'),
  };
  let msgTimer = 0;

  function showMessage(big, sub, seconds = 2.6) {
    els.msgBig.textContent = big;
    els.msgSub.textContent = sub || '';
    msgTimer = seconds;
  }

  function showWarning(text) {
    els.warn.textContent = text;
    els.warn.style.display = text ? 'block' : 'none';
  }

  function drawHorizon(pitch, bank) {
    const w = 150;
    const h = 150;
    const cx = w / 2;
    const cy = h / 2;
    hctx.clearRect(0, 0, w, h);
    hctx.save();
    hctx.beginPath();
    hctx.arc(cx, cy, 72, 0, Math.PI * 2);
    hctx.clip();
    // Sky and ground halves, rotated by bank and shifted by pitch.
    hctx.translate(cx, cy);
    hctx.rotate(-bank);
    const pitchPx = pitch * 110;
    hctx.fillStyle = '#e8823f';
    hctx.fillRect(-90, -90 + pitchPx, 180, 90 - pitchPx + 90);
    hctx.fillStyle = '#2a4a6b';
    hctx.fillRect(-90, pitchPx, 180, 180);
    // Horizon line and pitch ladder.
    hctx.strokeStyle = '#ffffff';
    hctx.lineWidth = 2;
    hctx.beginPath();
    hctx.moveTo(-72, pitchPx);
    hctx.lineTo(72, pitchPx);
    hctx.stroke();
    hctx.restore();
    // Fixed wings marker and centre dot.
    hctx.strokeStyle = '#ffe9c4';
    hctx.lineWidth = 3;
    hctx.beginPath();
    hctx.moveTo(cx - 34, cy);
    hctx.lineTo(cx - 12, cy);
    hctx.moveTo(cx + 12, cy);
    hctx.lineTo(cx + 34, cy);
    hctx.stroke();
    hctx.fillStyle = '#ffe9c4';
    hctx.beginPath();
    hctx.arc(cx, cy, 3, 0, Math.PI * 2);
    hctx.fill();
  }

  function update(st, mission, ringsGot, ringsTotal, score, timeLeft, dt) {
    const altFt = Math.max(0, Math.round((st.pos.y - 0) * 3.28084));
    const kt = Math.round(st.speed * 1.94384);
    const vsFpm = Math.round(st.verticalSpeed * 196.85);
    els.alt.textContent = altFt.toLocaleString('en-US');
    els.spd.textContent = kt;
    els.vs.textContent = (vsFpm >= 0 ? '+' : '') + vsFpm.toLocaleString('en-US');
    // Compass heading: North is -z, East is +x. yaw 0 faces +z (South, 180).
    const hdgDeg = (((180 - (st.yaw * 180) / Math.PI) % 360) + 360) % 360;
    els.hdg.innerHTML = String(Math.round(hdgDeg)).padStart(3, '0') + '&deg;';
    // Compass tape: the point nearest the heading sits in the middle.
    const idx = Math.round(hdgDeg / 30) % 12;
    const tape = [];
    for (let i = -2; i <= 2; i++) {
      tape.push(COMPASS_POINTS[(idx + i + 12) % 12]);
    }
    els.tape.textContent = tape.join('   ');
    els.mission.textContent = `Mission ${mission.id} · ${mission.name}`;
    els.rings.textContent = `${ringsGot}/${ringsTotal}`;
    els.score.textContent = score.toLocaleString('en-US');
    const mm = Math.floor(Math.max(0, timeLeft) / 60);
    const ss = Math.floor(Math.max(0, timeLeft) % 60);
    els.time.textContent = `${mm}:${String(ss).padStart(2, '0')}`;
    els.barThr.style.height = `${Math.round(st.throttle * 100)}%`;
    els.barFuel.style.height = `${Math.round(st.fuel)}%`;
    els.barHull.style.height = `${Math.round(st.hull)}%`;
    drawHorizon(st.pitch, st.bank);
    if (msgTimer > 0) {
      msgTimer -= dt;
      if (msgTimer <= 0) {
        els.msgBig.textContent = '';
        els.msgSub.textContent = '';
      }
    }
    // Warnings.
    if (st.fuel <= 0) showWarning('OUT OF FUEL — GLIDE TO THE RUNWAY');
    else if (st.fuel < 20) showWarning('LOW FUEL');
    else if (st.speed < WORLD.stallSpeed && !st.onGround) showWarning('STALL — NOSE DOWN, THROTTLE UP');
    else showWarning('');
  }

  function setVisible(on) {
    for (const id of ['hud-left', 'hud-compass', 'hud-right', 'hud-throttle', 'hud-horizon', 'crosshair']) {
      $(id).classList.toggle('hidden', !on);
    }
  }

  return { update, showMessage, showWarning, setVisible };
}
