/** Stream the long recording, but mix its level on the audio clock (also on iOS). */
export class BackgroundMusic {
  private context: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private wanted = false;
  private level = 0;
  private appliedLevel = -1;
  private playing: Promise<void> | null = null;
  private retry = 0;
  private attempts = 0;
  private unlocked = false;
  private awaitingGesture = false;
  private disposed = false;

  constructor(private element: HTMLAudioElement) {
    element.loop = true;
    element.volume = 1;
    element.setAttribute('playsinline', '');
    for (const event of ['canplay', 'playing', 'pause', 'ended', 'waiting', 'stalled', 'error']) {
      element.addEventListener(event, this.recover);
    }
    window.addEventListener('online', this.recover);
  }

  get primed() { return this.unlocked; }

  /** Call synchronously from the user's first touch, before navigation awaits. */
  unlock(context: AudioContext) {
    if (this.disposed) return;
    this.attach(context);
    this.unlocked = true;
    this.awaitingGesture = false;
    this.wanted = true;
    void context.resume().catch(() => {});
    this.play();
  }

  sync(context: AudioContext | null, wanted: boolean, level: number) {
    if (this.disposed) return;
    if (context) this.attach(context);
    this.wanted = wanted;
    this.level = wanted ? level : 0;
    this.applyLevel();
    if (!wanted) {
      window.clearTimeout(this.retry);
      this.retry = 0;
      this.element.pause();
      return;
    }
    if (context && context.state !== 'running' && context.state !== 'closed') void context.resume().catch(() => {});
    this.play();
  }

  private attach(context: AudioContext) {
    if (this.source) return;
    this.context = context;
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.source = context.createMediaElementSource(this.element);
    this.source.connect(this.gain).connect(context.destination);
  }

  private applyLevel() {
    if (!this.context || !this.gain || this.appliedLevel === this.level) return;
    const now = this.context.currentTime;
    const parameter = this.gain.gain;
    parameter.cancelScheduledValues(now);
    parameter.setTargetAtTime(this.level, now, .24);
    this.appliedLevel = this.level;
  }

  private play() {
    if (!this.wanted || !this.source || this.playing || !this.element.paused || document.hidden) return;
    this.playing = this.element.play().then(() => {
      this.attempts = 0;
      window.clearTimeout(this.retry);
      this.retry = 0;
      // Read current state: a slow play() can finish after entering another scene.
      if (!this.wanted || document.hidden || this.disposed) this.element.pause();
      else this.applyLevel();
    }).catch(error => {
      // Autoplay needs another gesture; network/buffering failures retry quietly.
      this.awaitingGesture = error?.name === 'NotAllowedError';
      if (!this.awaitingGesture && error?.name !== 'AbortError') this.scheduleRetry();
    }).finally(() => {
      this.playing = null;
      if (this.wanted && this.element.paused && !this.awaitingGesture) this.scheduleRetry();
    });
  }

  private recover = () => {
    if (!this.wanted || document.hidden || this.disposed) return;
    if (this.element.error || this.element.paused) this.scheduleRetry();
  };

  private scheduleRetry() {
    if (this.retry || !this.wanted || this.disposed) return;
    this.retry = window.setTimeout(() => {
      this.retry = 0;
      if (!this.wanted || document.hidden || this.disposed) return;
      if (this.element.error) {
        // Reload only an actual failed request; waiting is normal buffering.
        const position = this.element.currentTime;
        this.element.load();
        if (position > 0) this.element.currentTime = position;
      }
      this.play();
    }, Math.min(12000, 800 * 2 ** this.attempts++));
  }

  dispose() {
    this.disposed = true;
    this.wanted = false;
    window.clearTimeout(this.retry);
    this.element.pause();
    for (const event of ['canplay', 'playing', 'pause', 'ended', 'waiting', 'stalled', 'error']) {
      this.element.removeEventListener(event, this.recover);
    }
    window.removeEventListener('online', this.recover);
    this.source?.disconnect();
    this.gain?.disconnect();
  }
}
