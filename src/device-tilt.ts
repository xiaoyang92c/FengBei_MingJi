import { Euler, Quaternion, Vector3 } from 'three';

export type TiltState = 'permission' | 'starting' | 'active' | 'off' | 'denied' | 'no-data' | 'insecure' | 'unavailable' | 'reduced';
export type TiltPosition = { dx: number; dy: number };
type OrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

const radians = Math.PI / 180;
const limit = (value: number) => Math.max(-.6, Math.min(.6, value));
const response = (degrees: number) => limit(Math.sign(degrees) * Math.max(0, Math.abs(degrees) - .35) / 14 * .6);

/** Relative device rotation avoids Euler jumps when a phone is held upright. */
export class TiltProjector {
  private baseline: Quaternion | null = null;
  private rotation = new Quaternion();
  private relative = new Quaternion();
  private euler = new Euler(0, 0, 0, 'ZXY');
  private axis = new Vector3();

  reset() { this.baseline = null; }

  sample(alpha: number, beta: number, gamma: number, screenAngle: number): TiltPosition {
    this.rotation.setFromEuler(this.euler.set(beta * radians, gamma * radians, alpha * radians, 'ZXY'));
    if (!this.baseline) this.baseline = this.rotation.clone().invert();
    this.relative.multiplyQuaternions(this.baseline, this.rotation);
    // q and -q describe the same rotation. Use the shorter arc at angle wrap.
    if (this.relative.w < 0) this.relative.set(-this.relative.x, -this.relative.y, -this.relative.z, -this.relative.w);
    this.axis.set(this.relative.x, this.relative.y, this.relative.z);
    const length = this.axis.length();
    if (length > .000001) this.axis.multiplyScalar(2 * Math.atan2(length, this.relative.w) / length / radians);
    const angle = screenAngle * radians;
    return {
      dx: response(this.axis.y * Math.cos(angle) + this.axis.x * Math.sin(angle)),
      dy: response(this.axis.x * Math.cos(angle) - this.axis.y * Math.sin(angle)),
    };
  }
}

export class DeviceTilt {
  private mobile = window.matchMedia('(pointer: coarse)');
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  private sensor = window.DeviceOrientationEvent as OrientationConstructor | undefined;
  private projector = new TiltProjector();
  private enabled = false;
  private permissionGranted = !this.sensor?.requestPermission;
  private sceneActive = false;
  private listening = false;
  private pageHidden = false;
  private disposed = false;
  private pending = false;
  private timer = 0;
  private frame = 0;
  private target: TiltPosition = { dx: 0, dy: 0 };
  private filtered: TiltPosition = { dx: 0, dy: 0 };
  private emitted: TiltPosition | null = null;
  private lastFrame = 0;
  state: TiltState = this.sensor?.requestPermission ? 'permission' : 'off';

  constructor(private onMove: (position: TiltPosition) => void, private onState: () => void) {
    this.mobile.addEventListener('change', this.sync);
    this.reduced.addEventListener('change', this.sync);
    document.addEventListener('visibilitychange', this.sync);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onPageShow);
    window.addEventListener('orientationchange', this.recenter);
    window.screen.orientation?.addEventListener('change', this.recenter);
  }

  get visible() { return this.mobile.matches && this.sceneActive; }
  get usingSensor() { return this.listening && this.state === 'active'; }

  /** A new room starts from the current grip, without carrying an old offset. */
  calibrate() {
    this.recenter();
    this.filtered = { dx: 0, dy: 0 };
    this.emitted = null;
    this.onMove({ dx: 0, dy: 0 });
  }

  setSceneActive(active: boolean) {
    if (active === this.sceneActive) return;
    this.sceneActive = active;
    this.sync();
  }

  async toggle() {
    if (this.pending || this.disposed || !this.mobile.matches || this.reduced.matches || !window.isSecureContext || !this.sensor) return;
    if (this.enabled && (this.state === 'active' || this.state === 'starting')) {
      this.enabled = false;
      this.sync();
      this.onMove({ dx: 0, dy: 0 });
      return;
    }
    this.pending = true;
    this.state = 'starting';
    this.onState();
    try {
      // Invoke directly in the click handler, before any await: required by iOS.
      if (!this.permissionGranted && this.sensor.requestPermission) {
        this.permissionGranted = await this.sensor.requestPermission() === 'granted';
        if (!this.permissionGranted) {
          this.enabled = false;
          this.state = 'denied';
          return;
        }
      }
      this.enabled = true;
    } catch {
      this.enabled = false;
      this.state = 'denied';
    } finally {
      this.pending = false;
      if (!this.disposed) this.sync();
    }
  }

  private sync = () => {
    if (this.disposed) return;
    if (!window.isSecureContext) this.state = 'insecure';
    else if (!this.sensor) this.state = 'unavailable';
    else if (this.reduced.matches) this.state = 'reduced';
    else if (!this.enabled && this.state !== 'denied' && this.state !== 'no-data') this.state = this.permissionGranted ? 'off' : 'permission';
    const shouldListen = !!this.sensor && window.isSecureContext && this.mobile.matches && !this.reduced.matches
      && this.enabled && this.sceneActive && !document.hidden && !this.pageHidden;
    if (shouldListen && !this.listening) {
      this.listening = true;
      this.projector.reset();
      this.state = 'starting';
      window.addEventListener('deviceorientation', this.onOrientation, { passive: true });
      this.timer = window.setTimeout(() => {
        this.enabled = false;
        this.state = 'no-data';
        this.sync();
      }, 3500);
    } else if (!shouldListen) this.stop();
    this.onState();
  };

  private onOrientation = (event: DeviceOrientationEvent) => {
    if (!this.listening || event.beta === null || event.gamma === null || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    const angle = window.screen.orientation?.angle ?? Number((window as Window & { orientation?: number }).orientation ?? 0);
    this.target = this.projector.sample(Number.isFinite(event.alpha) ? event.alpha! : 0, event.beta, event.gamma, angle);
    if (this.state !== 'active') {
      window.clearTimeout(this.timer);
      this.state = 'active';
      this.onState();
    }
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  };

  private tick = (now: number) => {
    this.frame = 0;
    if (!this.listening) return;
    const dt = this.lastFrame ? Math.min(64, now - this.lastFrame) : 16;
    this.lastFrame = now;
    const blend = 1 - Math.exp(-dt / 100);
    this.filtered.dx += (this.target.dx - this.filtered.dx) * blend;
    this.filtered.dy += (this.target.dy - this.filtered.dy) * blend;
    const settled = Math.abs(this.target.dx - this.filtered.dx) + Math.abs(this.target.dy - this.filtered.dy) < .0005;
    if (settled) this.filtered = { ...this.target };
    if (!this.emitted || Math.abs(this.filtered.dx - this.emitted.dx) + Math.abs(this.filtered.dy - this.emitted.dy) >= .0005) {
      this.emitted = { ...this.filtered };
      this.onMove({ ...this.filtered });
    }
    if (!settled) this.frame = requestAnimationFrame(this.tick);
    else this.lastFrame = 0;
  };

  private recenter = () => {
    this.projector.reset();
    this.target = { dx: 0, dy: 0 };
  };
  private onPageHide = () => { this.pageHidden = true; this.sync(); };
  private onPageShow = () => { this.pageHidden = false; this.sync(); };

  private stop() {
    window.removeEventListener('deviceorientation', this.onOrientation);
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.frame);
    this.listening = false;
    this.frame = 0;
    this.lastFrame = 0;
    this.target = { dx: 0, dy: 0 };
    this.filtered = { dx: 0, dy: 0 };
    this.emitted = null;
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.mobile.removeEventListener('change', this.sync);
    this.reduced.removeEventListener('change', this.sync);
    document.removeEventListener('visibilitychange', this.sync);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onPageShow);
    window.removeEventListener('orientationchange', this.recenter);
    window.screen.orientation?.removeEventListener('change', this.recenter);
  }
}
