/**
 * Lightweight Web Audio synthesizer producing soothing underwater rumble
 * and soft aerator bubble pops without external audio files.
 */
class AmbientAquariumAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bubbleTimer: number | null = null;
  private running = false;

  start(): void {
    if (this.running || typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.masterGain.gain.exponentialRampToValueAtTime(0.14, this.ctx.currentTime + 0.8);
    this.masterGain.connect(this.ctx.destination);

    // Filtered brown/pink noise for gentle water filter hum
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 2.8;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;

    const humGain = this.ctx.createGain();
    humGain.gain.value = 0.25;

    noise.connect(filter);
    filter.connect(humGain);
    humGain.connect(this.masterGain);
    noise.start();

    this.running = true;
    this.scheduleBubble();
  }

  private scheduleBubble(): void {
    if (!this.running || !this.ctx || !this.masterGain) return;
    const delayMs = 260 + Math.random() * 680;
    this.bubbleTimer = window.setTimeout(() => {
      this.playBubblePop();
      this.scheduleBubble();
    }, delayMs);
  }

  private playBubblePop(): void {
    if (!this.ctx || !this.masterGain || !this.running) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = 320 + Math.random() * 440;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 1.9, now + 0.085);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.bubbleTimer !== null) {
      window.clearTimeout(this.bubbleTimer);
      this.bubbleTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
  }
}

export const ambientAudio = new AmbientAquariumAudio();
