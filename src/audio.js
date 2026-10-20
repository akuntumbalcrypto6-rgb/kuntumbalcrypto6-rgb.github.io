// Procedural Web Audio API sound generator & ambient music synthesizer
class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.isPlayingMusic = false;
    this.ambientTimer = null;
    this.masterGain = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.ensureContext();
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      if (!this.isPlayingMusic) {
        this.startAmbientMusic();
      }
    } else {
      this.stopAmbientMusic();
    }
    return !this.isMuted;
  }

  playKeyClick() {
    if (this.isMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600 + Math.random() * 300, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playChime(freq = 523.25, duration = 0.8) {
    if (this.isMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playBookOpen() {
    if (this.isMuted || !this.ctx) return;
    // Gentle page flutter sound + high chime
    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(1400, this.ctx.currentTime + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start();

    // Magical chime when pages open
    setTimeout(() => {
      this.playChime(659.25, 0.8);
      setTimeout(() => this.playChime(880.00, 1.0), 120);
    }, 250);
  }

  playBookClose() {
    if (this.isMuted || !this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.07, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start();
  }

  playExtinguish() {
    if (this.isMuted || !this.ctx) return;
    // White noise swoosh for blowing candle
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.35);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start();
    whiteNoise.stop(this.ctx.currentTime + 0.4);

    // Warm chord after blowing
    setTimeout(() => {
      this.playChime(440, 1.2);
      setTimeout(() => this.playChime(554.37, 1.2), 150);
      setTimeout(() => this.playChime(659.25, 1.5), 300);
    }, 400);
  }

  startAmbientMusic() {
    if (this.isPlayingMusic) return;
    this.isPlayingMusic = true;

    // Peaceful celestial progression: Fmaj7 -> G -> Em -> Am
    const chords = [
      [349.23, 440.00, 523.25, 659.25], // Fmaj7
      [392.00, 493.88, 587.33, 783.99], // G
      [329.63, 392.00, 493.88, 659.25], // Em
      [440.00, 523.25, 659.25, 880.00]  // Am
    ];

    let chordIdx = 0;
    const playNextChord = () => {
      if (!this.isPlayingMusic || this.isMuted) return;
      const chord = chords[chordIdx % chords.length];
      chordIdx++;

      chord.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq / 2, this.ctx.currentTime); // warm lower octave pad

        // Soft attack & release
        const startTime = this.ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.03, startTime + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 4.0);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + 4.2);
      });

      // Sparkle high note
      if (Math.random() > 0.4) {
        setTimeout(() => {
          if (!this.isPlayingMusic || this.isMuted) return;
          const highNotes = [523.25, 659.25, 783.99, 880.00, 1046.50];
          const note = highNotes[Math.floor(Math.random() * highNotes.length)];
          this.playChime(note, 2.0);
        }, 1800);
      }

      this.ambientTimer = setTimeout(playNextChord, 4200);
    };

    playNextChord();
  }

  stopAmbientMusic() {
    this.isPlayingMusic = false;
    if (this.ambientTimer) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
  }
}

export const soundManager = new SoundManager();
