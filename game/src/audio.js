// Senja Air — all sound is synthesised with WebAudio: the engine hum follows
// the throttle, wind noise follows speed, rings chime, landings thud.
// No audio files, so the game stays fully offline.
export function makeAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let windGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    // Engine: two detuned saws through a low-pass, gain tied to throttle.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 52;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 104;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();
    // Wind: looped noise through a band-pass.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 620;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    noise.start();
    return true;
  }

  function update(throttle, speed, flying) {
    if (!ctx || muted) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(flying ? 0.035 + throttle * 0.055 : 0.012, t, 0.1);
    engineOsc.frequency.setTargetAtTime(48 + throttle * 46, t, 0.1);
    engineOsc2.frequency.setTargetAtTime(96 + throttle * 92, t, 0.1);
    engineFilter.frequency.setTargetAtTime(320 + throttle * 500, t, 0.1);
    windGain.gain.setTargetAtTime(Math.min(0.09, Math.max(0, speed - 15) * 0.0016), t, 0.2);
  }

  function tone(freq, at, dur, type, vol) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol || 0.14, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  function chime() {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    tone(659.25, t, 0.5, 'sine', 0.16);       // E5
    tone(830.61, t + 0.09, 0.5, 'sine', 0.14); // G#5
    tone(987.77, t + 0.18, 0.7, 'sine', 0.14); // B5
  }

  function thud() {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    tone(68, t, 0.35, 'sine', 0.3);
    tone(45, t + 0.02, 0.4, 'triangle', 0.22);
  }

  function crash() {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = ctx.sampleRate * 0.7;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.4;
    src.connect(g);
    g.connect(ctx.destination);
    src.start(t);
    tone(38, t, 0.9, 'sine', 0.35);
  }

  // A gentle generative dusk melody: pentatonic plucks wandering up and down.
  const SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
  function startMusic() {
    if (musicTimer || !ensure()) return;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      musicStep += Math.random() < 0.5 ? -1 : 1;
      if (musicStep < 0) musicStep = 1;
      if (musicStep > SCALE.length - 1) musicStep = SCALE.length - 2;
      tone(SCALE[musicStep], ctx.currentTime, 1.6, 'triangle', 0.035);
      if (Math.random() < 0.3) tone(SCALE[musicStep] / 2, ctx.currentTime, 2.2, 'sine', 0.03);
    }, 950);
  }

  function toggleMute() {
    muted = !muted;
    if (ctx && engineGain) engineGain.gain.value = muted ? 0 : 0.04;
    if (ctx && windGain) windGain.gain.value = muted ? 0 : 0;
    return muted;
  }

  return { ensure, update, chime, thud, crash, startMusic, toggleMute, isMuted: () => muted };
}
