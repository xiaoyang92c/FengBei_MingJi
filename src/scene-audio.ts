import type { RoomId } from './content';

type Clip = { id: string; path: string; level: number; variation: number; period: number; phase: number; overlap: number };
type Voice = { source: AudioBufferSourceNode; gain: GainNode };
type Layer = { clip: Clip; buffer: AudioBuffer; gain: GainNode; next: number; voices: Set<Voice> };
type Mix = { room: RoomId; context: AudioContext; master: GainNode; limiter: DynamicsCompressorNode; layers: Layer[]; timer: number };

const tracks: Record<RoomId, Clip[]> = {
  worksite: [
    { id: 'mining', path: '/assets/audio/mining-ambience.mp3', level: 1.35, variation: .21, period: 17, phase: 0, overlap: 1.7 },
    { id: 'crowd', path: '/assets/audio/crowd-noise.mp3', level: .36, variation: .25, period: 23, phase: 2.1, overlap: 1.4 },
  ],
  archive: [
    { id: 'train', path: '/assets/audio/old-train.mp3', level: .64, variation: .12, period: 31, phase: .7, overlap: 2.8 },
    { id: 'crowd', path: '/assets/audio/crowd-noise.mp3', level: .26, variation: .25, period: 23, phase: 2.1, overlap: 1.4 },
  ],
  monument: [
    { id: 'sunrise', path: '/assets/audio/3-sunrise.mp3', level: .19, variation: .18, period: 29, phase: .3, overlap: 1.8 },
    { id: 'forest', path: '/assets/audio/3-forest-nature.mp3', level: .24, variation: .23, period: 19, phase: 2.4, overlap: 2.2 },
  ],
};

/** User-provided recordings, independently overlapped and mixed on the audio clock. */
export class SceneAudio {
  private cache = new Map<string, Promise<AudioBuffer>>();
  private mix: Mix | null = null;
  private requested: RoomId | null = null;
  private revision = 0;
  private reading = false;
  private retry = 0;
  private failed = new Set<RoomId>();

  constructor(private onError: (message: string) => void = () => {}) {}

  sync(context: AudioContext | null, room: RoomId | null, enabled: boolean, reading = false) {
    this.reading = reading;
    const wanted = enabled && room && tracks[room].length ? room : null;
    if (!context || !wanted) {
      window.clearTimeout(this.retry);
      this.requested = null;
      this.revision++;
      if (this.mix) this.release(this.mix);
      this.mix = null;
      return;
    }
    if (this.mix?.room === wanted) {
      this.mix.master.gain.setTargetAtTime(reading ? .72 : 1, context.currentTime, .4);
      return;
    }
    if (this.requested === wanted) return;
    this.requested = wanted;
    window.clearTimeout(this.retry);
    const revision = ++this.revision;
    if (this.mix) this.release(this.mix);
    this.mix = null;
    void this.activate(context, wanted, revision).catch(() => {
      if (revision !== this.revision) return;
      this.requested = null;
      this.retry = window.setTimeout(() => {
        if (revision === this.revision && !document.hidden) this.sync(context, wanted, true, this.reading);
      }, 4000);
      if (!this.failed.has(wanted)) {
        this.failed.add(wanted);
        this.onError('场景音效暂时未加载成功，可重新开启声音重试。');
      }
    });
  }

  private load(context: AudioContext, clip: Clip) {
    let buffer = this.cache.get(clip.id);
    if (!buffer) {
      buffer = fetch(clip.path).then(response => {
        if (!response.ok) throw new Error('Audio ' + response.status);
        return response.arrayBuffer();
      }).then(bytes => context.decodeAudioData(bytes)).catch(error => {
        this.cache.delete(clip.id);
        throw error;
      });
      this.cache.set(clip.id, buffer);
    }
    return buffer;
  }

  private async activate(context: AudioContext, room: RoomId, revision: number) {
    const clips = tracks[room];
    const buffers = await Promise.all(clips.map(clip => this.load(context, clip)));
    // Muting, hiding or changing rooms cancels an in-flight load.
    if (revision !== this.revision || this.requested !== room) return;
    const now = context.currentTime;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -7;
    limiter.knee.value = 14;
    limiter.ratio.value = 5;
    limiter.attack.value = .006;
    limiter.release.value = .28;
    const master = context.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(this.reading ? .72 : 1, now + 1.2);
    limiter.connect(master).connect(context.destination);
    const layers = clips.map((clip, index) => {
      const gain = context.createGain();
      gain.gain.value = clip.level;
      gain.connect(limiter);
      return { clip, buffer: buffers[index], gain, next: now + .04, voices: new Set<Voice>() };
    });
    const mix: Mix = { room, context, master, limiter, layers, timer: 0 };
    this.mix = mix;
    this.tick(mix);
    mix.timer = window.setInterval(() => this.tick(mix), 180);
  }

  private tick(mix: Mix) {
    const now = mix.context.currentTime;
    for (const layer of mix.layers) {
      const { clip } = layer;
      // Independent slow swells, with no random gain jumps or common loop reset.
      const swell = 1 + clip.variation * Math.sin(now * 2 * Math.PI / clip.period + clip.phase)
        + clip.variation * .28 * Math.sin(now * 2 * Math.PI / (clip.period * 1.83) + .8);
      layer.gain.gain.setTargetAtTime(clip.level * swell, now, .8);
      // JS only wakes the scheduler; exact joins run on the audio clock.
      if (layer.next < now - .1) layer.next = now + .03;
      while (layer.next < now + .7) this.schedule(mix, layer);
    }
  }

  private schedule(mix: Mix, layer: Layer) {
    const context = mix.context;
    const start = layer.next;
    const duration = layer.buffer.duration;
    const overlap = Math.min(layer.clip.overlap, duration * .15);
    const end = start + duration;
    const source = context.createBufferSource();
    source.buffer = layer.buffer;
    const gain = context.createGain();
    const fadeIn = new Float32Array(64);
    const fadeOut = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
      fadeIn[i] = Math.sin(i / 63 * Math.PI / 2);
      fadeOut[i] = Math.cos(i / 63 * Math.PI / 2);
    }
    gain.gain.setValueCurveAtTime(fadeIn, start, overlap);
    gain.gain.setValueAtTime(1, end - overlap);
    gain.gain.setValueCurveAtTime(fadeOut, end - overlap, overlap);
    source.connect(gain).connect(layer.gain);
    const voice = { source, gain };
    layer.voices.add(voice);
    source.onended = () => { layer.voices.delete(voice); source.disconnect(); gain.disconnect(); };
    source.start(start);
    source.stop(end);
    layer.next = end - overlap;
  }

  private release(mix: Mix) {
    window.clearInterval(mix.timer);
    const now = mix.context.currentTime;
    mix.master.gain.cancelScheduledValues(now);
    mix.master.gain.setTargetAtTime(0, now, .16);
    for (const layer of mix.layers) for (const voice of layer.voices) voice.source.stop(now + .85);
    window.setTimeout(() => {
      mix.layers.forEach(layer => layer.gain.disconnect());
      mix.limiter.disconnect();
      mix.master.disconnect();
    }, 950);
  }
}
