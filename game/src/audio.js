// Synthesized sound: every effect is a few oscillators through one
// WebAudio graph — no audio files, no network. Audio starts only after a
// user gesture (the browser's rule), so ensure() is called on first input.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || !master || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, cutoff) {
    if (!ctx || !master || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    ensure,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    throwEmber() { tone(520, 0.12, 'sine', 0.5, 880); noise(0.08, 0.12, 2400); },
    hit() { tone(180, 0.08, 'square', 0.25, 120); },
    kill() { tone(320, 0.18, 'triangle', 0.5, 60); noise(0.14, 0.2, 1200); },
    stoke() { noise(0.35, 0.3, 900); tone(140, 0.3, 'sine', 0.35, 260); },
    flare() { tone(880, 0.4, 'sine', 0.45, 220); noise(0.3, 0.25, 3200); },
    hurt() { tone(110, 0.22, 'sawtooth', 0.5, 55); },
    pickup() { tone(660, 0.09, 'sine', 0.35, 990); },
    brazier() { noise(0.4, 0.3, 1400); tone(220, 0.35, 'triangle', 0.4, 440); },
    nightStart() { tone(196, 0.5, 'triangle', 0.4, 196); tone(294, 0.5, 'triangle', 0.3, 294); },
    dawn() { tone(523, 0.3, 'sine', 0.4, 523); tone(659, 0.3, 'sine', 0.35, 659); tone(784, 0.5, 'sine', 0.35, 784); },
    boss() { tone(65, 0.9, 'sawtooth', 0.5, 40); tone(98, 0.9, 'sawtooth', 0.35, 49); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'sine', 0.4, f), i * 140)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.45, 'triangle', 0.4, f), i * 170)); },
  };
}
