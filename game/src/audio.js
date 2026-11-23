// All of Port Solenne's sound is synthesized live with WebAudio — no audio files exist.
// A two-oscillator engine hum that follows the player's speed, police sirens that swell as
// cruisers close in, a slow synthwave bass loop for the streets, and one-shot effects for
// shots, punches, crashes, cash and chapter endings. M mutes everything.
import { EV } from './world.js';

const BASS_LINE = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0]; // A1 groove
const PAD_CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];

export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;
  let engineOsc = null;
  let engineSub = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let beat = 0;
  let nextBeatAt = 0;
  let chordAt = 0;

  function start() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.42;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineSub = ctx.createOscillator();
    engineSub.type = 'square';
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineSub.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineSub.start();

    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    nextBeatAt = ctx.currentTime + 0.1;
  }

  function tone(freq, at, dur, type, gain, slideTo) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  function noiseBurst(at, dur, gain, filterFreq) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(at);
    src.stop(at + dur + 0.02);
  }

  /** Schedule the music loop a few beats ahead of the playhead. */
  function scheduleMusic() {
    const beatLen = 60 / 92 / 2; // 92 bpm, eighth notes
    while (nextBeatAt < ctx.currentTime + 0.18) {
      const step = beat % BASS_LINE.length;
      const freq = BASS_LINE[step];
      if (freq) tone(freq, nextBeatAt, beatLen * 1.8, 'triangle', 0.16);
      if (step % 2 === 1) noiseBurst(nextBeatAt, 0.03, 0.035, 6000);
      if (beat % 32 === 0) {
        const chord = PAD_CHORDS[(beat / 32) % PAD_CHORDS.length | 0];
        for (const f of chord) tone(f, nextBeatAt, beatLen * 30, 'sine', 0.028);
        chordAt = beat;
      }
      beat += 1;
      nextBeatAt += beatLen;
    }
    void chordAt;
  }

  /** Per-frame: engine pitch from speed, siren volume from the nearest cruiser, the loop. */
  function update(world) {
    if (!ctx) return;
    const p = world.player;
    const now = ctx.currentTime;
    if (p.car) {
      const speed = Math.abs(p.car.speed);
      const freq = 46 + speed * 0.5;
      engineOsc.frequency.setTargetAtTime(freq, now, 0.06);
      engineSub.frequency.setTargetAtTime(freq / 2, now, 0.06);
      engineGain.gain.setTargetAtTime(0.05 + Math.min(0.05, speed / 6000), now, 0.09);
    } else {
      engineGain.gain.setTargetAtTime(0, now, 0.08);
    }
    let nearest = Infinity;
    for (const car of world.cars) {
      if (car.kind !== 'police') continue;
      nearest = Math.min(nearest, Math.hypot(car.x - p.x, car.y - p.y));
    }
    if (nearest < 640) {
      sirenOsc.frequency.setTargetAtTime(810 + Math.sin(now * 4.4) * 170, now, 0.03);
      sirenGain.gain.setTargetAtTime(0.045 * (1 - nearest / 700), now, 0.1);
    } else {
      sirenGain.gain.setTargetAtTime(0, now, 0.12);
    }
    scheduleMusic();
  }

  /** One-shot effects for the step's event flags. */
  function playEvents(events) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    if (events & EV.SHOT) {
      noiseBurst(now, 0.13, 0.30, 2600);
      tone(140, now, 0.1, 'square', 0.12, 50);
    }
    if (events & EV.PUNCH) tone(170, now, 0.09, 'sine', 0.22, 55);
    if (events & EV.CRASH) {
      noiseBurst(now, 0.22, 0.26, 900);
      tone(70, now, 0.2, 'sine', 0.2, 38);
    }
    if (events & EV.PICKUP) {
      tone(660, now, 0.09, 'sine', 0.14);
      tone(990, now + 0.08, 0.14, 'sine', 0.14);
    }
    if (events & EV.CASH) {
      tone(880, now, 0.07, 'square', 0.07);
      tone(1318, now + 0.06, 0.12, 'square', 0.07);
    }
    if (events & EV.ENTER_CAR) tone(95, now, 0.12, 'sine', 0.2, 60);
    if (events & EV.MISSION_DONE) {
      const notes = [523.3, 659.3, 784, 1046.5];
      notes.forEach((f, i) => tone(f, now + i * 0.11, 0.22, 'triangle', 0.13));
    }
    if (events & EV.BUSTED) {
      tone(392, now, 0.2, 'square', 0.1);
      tone(311, now + 0.18, 0.2, 'square', 0.1);
      tone(233, now + 0.36, 0.42, 'square', 0.1);
    }
    if (events & EV.WASTED) {
      tone(330, now, 0.3, 'sawtooth', 0.08, 110);
      tone(165, now + 0.25, 0.6, 'sawtooth', 0.08, 55);
    }
  }

  function toggleMute() {
    muted = !muted;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.42, ctx.currentTime, 0.03);
    return muted;
  }

  return { start, update, playEvents, toggleMute, isMuted: () => muted };
}
