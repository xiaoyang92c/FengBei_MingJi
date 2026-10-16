const recordings = {
  on: '/assets/audio/tv-power-on.wav',
  off: '/assets/audio/tv-power-off.wav',
  buzz: '/assets/audio/tv-buzz-loop.wav',
  hover: '/assets/audio/tv-button-hover.mp3',
};
type Recording = keyof typeof recordings;
type Voice = { source: AudioBufferSourceNode; gain: GainNode; end: number; stopAt: number; kind: Recording };
const buzzLevel = .45;

/** PCM cues and the seamless bed use the audio clock, with short release ramps. */
export class TvAudio {
  private context: AudioContext | null = null;
  private loads = new Map<Recording, Promise<AudioBuffer>>();
  private buffers = new Map<Recording, AudioBuffer>();
  private power: Voice | null = null;
  private buzz: Voice | null = null;
  private buttonHover: Voice | null = null;
  private buttonClick: Voice | null = null;
  private active = false;
  private enabled = true;
  private ambience = false;
  private leaving = false;
  private disposed = false;
  private buzzPending: Promise<void> | null = null;
  private powerRevision = 0;
  private hoverRevision = 0;
  private clickRevision = 0;
  private reported = false;

  constructor(private onError: (message: string) => void) {
    document.addEventListener('pointerdown', this.unlock, { capture: true });
    document.addEventListener('keydown', this.unlock, { capture: true });
  }

  /** Warm every recording; the first picture waits only for its ignition cue. */
  ready(): Promise<void> {
    if (!this.context && !this.disposed) {
      try { this.context = new AudioContext({ latencyHint: 'interactive' }); }
      catch (error) { this.report(error); }
    }
    if (!this.context) return Promise.resolve();
    for (const id of Object.keys(recordings) as Recording[]) void this.load(id).catch(error => this.report(error));
    return this.load('on').then(() => {}).catch(error => this.report(error));
  }

  async preload(): Promise<void> {
    await this.ready();
    if (this.context && !this.disposed) {
      await Promise.allSettled((Object.keys(recordings) as Recording[]).map(id => this.load(id)));
    }
  }

  sync(active: boolean, enabled: boolean) {
    this.active = active;
    this.enabled = enabled;
    if (!enabled || document.hidden) {
      this.releaseAll(.16);
      return;
    }
    if (!active) {
      this.stopHover();
      this.clickRevision++;
      this.release(this.buttonClick, .08);
      this.fadeBuzz(.45);
      // The one-second shutdown finishes its faded tail over the handoff.
      if (!this.leaving || this.power?.kind !== 'off') {
        this.powerRevision++;
        this.release(this.power, .16);
      }
      this.ambience = false;
      return;
    }
    if (this.ambience && !this.leaving) this.playBuzz();
  }

  powerOn() {
    this.leaving = false;
    this.ambience = false;
    this.playPower('on');
  }

  startAmbience() {
    if (!this.active || this.leaving) return;
    this.ambience = true;
    this.playBuzz();
  }

  prepareExit() {
    this.leaving = true;
    this.ambience = false;
    this.stopHover();
    this.fadeBuzz(.45);
  }

  powerOff() { this.playPower('off'); }

  hover() {
    if (!this.audible() || this.leaving) return;
    this.stopHover();
    const revision = this.hoverRevision;
    const requested = performance.now();
    this.unlock();
    void this.whenRunning('hover', buffer => {
      if (revision !== this.hoverRevision || !this.audible() || this.leaving || performance.now() - requested > 120) return;
      this.buttonHover = this.voice('hover', buffer, .38);
    });
  }

  stopHover() {
    this.hoverRevision++;
    this.release(this.buttonHover, .045);
  }

  click() {
    if (!this.audible() || this.leaving) return;
    this.stopHover();
    this.release(this.buttonClick, .045);
    const revision = ++this.clickRevision;
    const requested = performance.now();
    this.unlock();
    void this.whenRunning('hover', buffer => {
      if (revision !== this.clickRevision || !this.audible() || this.leaving || performance.now() - requested > 120) return;
      // Click playback survives pointer exit; it is separate from hover release.
      this.buttonClick = this.voice('hover', buffer, .38);
    });
  }

  private audible() { return !this.disposed && this.active && this.enabled && !document.hidden; }
  private wantsBuzz() { return this.audible() && this.ambience && !this.leaving; }

  private load(id: Recording) {
    let pending = this.loads.get(id);
    if (!pending) {
      const context = this.context!;
      pending = fetch(recordings[id]).then(response => {
        if (!response.ok) throw new Error(`TV audio ${response.status}`);
        return response.arrayBuffer();
      }).then(bytes => context.decodeAudioData(bytes)).then(buffer => {
        this.buffers.set(id, buffer);
        return buffer;
      }).catch(error => { this.loads.delete(id); throw error; });
      this.loads.set(id, pending);
    }
    return pending;
  }

  private whenRunning(id: Recording, play: (buffer: AudioBuffer) => void): Promise<void> {
    const context = this.context;
    if (!context || this.disposed) return Promise.resolve();
    const cached = this.buffers.get(id);
    if (context.state === 'running' && cached) { play(cached); return Promise.resolve(); }
    return Promise.all([context.resume(), this.load(id)]).then(([, buffer]) => {
      if (!this.disposed) play(buffer);
    }).catch(error => this.report(error));
  }

  private playPower(kind: 'on' | 'off') {
    if (!this.audible()) return;
    const revision = ++this.powerRevision;
    const requested = performance.now();
    // Never queue an old power cue until after the matching picture has passed.
    void this.whenRunning(kind, buffer => {
      if (revision !== this.powerRevision || !this.audible() || performance.now() - requested > 120) return;
      this.release(this.power, .08);
      this.power = this.voice(kind, buffer, .48);
    });
  }

  private playBuzz() {
    if (!this.wantsBuzz() || this.buzzPending) return;
    if (this.buzz && this.buzz.stopAt === Infinity) return;
    const pending = this.whenRunning('buzz', buffer => {
      if (!this.wantsBuzz() || (this.buzz && this.buzz.stopAt === Infinity)) return;
      this.buzz = this.voice('buzz', buffer, buzzLevel);
    }).finally(() => { if (this.buzzPending === pending) this.buzzPending = null; });
    this.buzzPending = pending;
  }

  private voice(kind: Recording, buffer: AudioBuffer, level: number): Voice {
    const context = this.context!;
    const now = context.currentTime;
    const loop = kind === 'buzz';
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    const gain = context.createGain();
    const end = loop ? Infinity : now + buffer.duration;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + (loop ? .8 : .008));
    if (!loop) {
      // Power WAVs have their own longer release; this also softens hover tails.
      gain.gain.setValueAtTime(level, end - .045);
      gain.gain.linearRampToValueAtTime(0, end);
    }
    source.connect(gain).connect(context.destination);
    const voice: Voice = { source, gain, end, stopAt: Infinity, kind };
    source.onended = () => {
      if (this.power === voice) this.power = null;
      if (this.buzz === voice) this.buzz = null;
      if (this.buttonHover === voice) this.buttonHover = null;
      if (this.buttonClick === voice) this.buttonClick = null;
      source.disconnect();
      gain.disconnect();
    };
    source.start(now);
    if (!loop) source.stop(end + .01);
    return voice;
  }

  private release(voice: Voice | null, duration: number) {
    const context = this.context;
    if (!voice || !context || context.state === 'closed') return;
    const now = context.currentTime;
    const end = Math.min(voice.end, voice.stopAt, now + duration);
    if (end <= now) return;
    voice.stopAt = end;
    voice.gain.gain.cancelAndHoldAtTime(now);
    voice.gain.gain.linearRampToValueAtTime(0, end);
    voice.source.stop(end + .01);
  }

  private fadeBuzz(duration: number) { this.release(this.buzz, duration); }

  private releaseAll(duration: number) {
    this.powerRevision++;
    this.clickRevision++;
    this.stopHover();
    this.release(this.buttonClick, duration);
    this.release(this.power, duration);
    this.fadeBuzz(duration);
  }

  private report(error: unknown) {
    if (this.disposed || !this.active || !this.enabled) return;
    if (error instanceof DOMException && ['NotAllowedError', 'AbortError'].includes(error.name)) return;
    if (this.reported) return;
    this.reported = true;
    this.onError('电视音效暂时无法播放，刷新后可重试。');
  }

  private unlock = () => {
    if (!this.audible()) return;
    void this.context?.resume().catch(error => this.report(error));
    // Current ambience can resume after interaction; expired power/hover cannot.
    if (this.wantsBuzz()) this.playBuzz();
  };

  dispose() {
    this.disposed = true;
    this.releaseAll(.06);
    document.removeEventListener('pointerdown', this.unlock, { capture: true });
    document.removeEventListener('keydown', this.unlock, { capture: true });
    const context = this.context;
    if (context) window.setTimeout(() => { void context.close().catch(() => {}); }, 100);
  }
}
