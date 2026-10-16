const files = {
  wind: '/assets/audio/ui-travel-wind.mp3',
  paper: '/assets/audio/ui-paper-open.mp3',
  pencil: '/assets/audio/ui-pencil-hover.mp3',
};
export type UiSound = keyof typeof files;
type Options = { volume?: number; duration?: number };
type Voice = { source: AudioBufferSourceNode; gain: GainNode; released: boolean };

/** One decoded recording per sound, with cancellable loads and short release fades. */
export class UiAudio {
  private enabled = false;
  private revision = 0;
  private buffers = new Map<UiSound, Promise<AudioBuffer>>();
  private playing = new Map<UiSound, () => void>();
  private failed = new Set<UiSound>();

  constructor(private onError: (message: string) => void) {}

  setEnabled(value: boolean) {
    if (this.enabled === value) return;
    this.enabled = value;
    if (!value) this.stopAll();
  }

  preload(context: AudioContext) {
    void Promise.allSettled((Object.keys(files) as UiSound[]).map(id => this.load(context, id)));
  }

  stop(id: UiSound) { this.playing.get(id)?.(); }

  stopAll() {
    this.revision++;
    [...this.playing.values()].forEach(stop => stop());
  }

  play(context: AudioContext | null, id: UiSound, options: Options = {}): () => void {
    if (!context || document.hidden || !this.enabled) return () => {};
    this.stop(id);
    const revision = this.revision;
    const requested = performance.now();
    let cancelled = false;
    let voice: Voice | null = null;
    const stop = () => {
      cancelled = true;
      if (this.playing.get(id) === stop) this.playing.delete(id);
      if (!voice || voice.released) return;
      voice.released = true;
      const now = context.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, .012);
      voice.source.stop(now + .06);
    };
    this.playing.set(id, stop);
    void Promise.all([context.resume(), this.load(context, id)]).then(([, buffer]) => {
      // A hover that has ended, a muted page, or a slow load must not sound later.
      if (cancelled || revision !== this.revision || document.hidden || performance.now() - requested > 650) { stop(); return; }
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      const now = context.currentTime;
      const duration = Math.max(.05, Math.min(buffer.duration, options.duration ?? buffer.duration));
      const level = options.volume ?? .45;
      const attack = Math.min(.018, duration * .1);
      const release = Math.min(id === 'wind' ? .2 : .08, duration * .25);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level, now + attack);
      gain.gain.setValueAtTime(level, now + duration - release);
      gain.gain.linearRampToValueAtTime(0, now + duration);
      source.connect(gain).connect(context.destination);
      voice = { source, gain, released: false };
      source.onended = () => {
        if (this.playing.get(id) === stop) this.playing.delete(id);
        source.disconnect();
        gain.disconnect();
      };
      source.start(now, 0, duration);
    }).catch(() => {
      const stale = cancelled || revision !== this.revision;
      stop();
      if (stale) return;
      if (!this.failed.has(id)) {
        this.failed.add(id);
        this.onError('界面音效暂时无法加载，重新开启声音可重试。');
      }
    });
    return stop;
  }

  private load(context: AudioContext, id: UiSound): Promise<AudioBuffer> {
    let pending = this.buffers.get(id);
    if (!pending) {
      pending = fetch(files[id]).then(response => {
        if (!response.ok) throw new Error(`Audio ${response.status}`);
        return response.arrayBuffer();
      }).then(bytes => context.decodeAudioData(bytes)).catch(error => {
        this.buffers.delete(id);
        throw error;
      });
      this.buffers.set(id, pending);
    }
    return pending;
  }
}
