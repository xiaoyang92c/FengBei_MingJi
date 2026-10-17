import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { transform } from 'esbuild';

// Exercise sensor events without launching a browser or requesting real permissions.
const { code } = await transform(readFileSync(new URL('../src/device-tilt.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs', target: 'es2022' });
const require = createRequire(import.meta.url);
class Events {
  listeners = new Map();
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, event = {}) { for (const fn of this.listeners.get(type) ?? []) fn(event); }
  count(type) { return this.listeners.get(type)?.size ?? 0; }
}
function setup({ permission, mobile = true, secure = true, reduced = false, supported = true } = {}) {
  const window = new Events();
  const document = new Events();
  document.hidden = false;
  const coarse = Object.assign(new Events(), { matches: mobile });
  const reduce = Object.assign(new Events(), { matches: reduced });
  const timers = new Map();
  const frames = new Map();
  let serial = 0;
  let time = 0;
  let requests = 0;
  window.matchMedia = query => query.includes('pointer') ? coarse : reduce;
  window.isSecureContext = secure;
  window.screen = { orientation: Object.assign(new Events(), { angle: 0 }) };
  if (supported) window.DeviceOrientationEvent = permission ? { requestPermission() { requests++; return permission(); } } : {};
  window.setTimeout = fn => { const id = ++serial; timers.set(id, fn); return id; };
  window.clearTimeout = id => timers.delete(id);
  const module = { exports: {} };
  vm.runInNewContext(code, {
    require, module, exports: module.exports, window, document,
    requestAnimationFrame: fn => { const id = ++serial; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const positions = [];
  const tilt = new module.exports.DeviceTilt(position => positions.push(position), () => {});
  return {
    window, document, coarse, reduce, timers, frames, positions, tilt, TiltProjector: module.exports.TiltProjector,
    get requests() { return requests; },
    sample(beta, gamma, alpha = 0) { window.emit('deviceorientation', { alpha, beta, gamma }); },
    flush() {
      for (let i = 0; frames.size && i < 200; i++) {
        const callbacks = [...frames.values()]; frames.clear(); time += 16;
        callbacks.forEach(fn => fn(time));
      }
      assert.equal(frames.size, 0, 'filter settles without a permanent animation loop');
    },
  };
}

{
  const { TiltProjector } = setup();
  const p = new TiltProjector();
  const near = value => assert.ok(Math.abs(value) < .00001);
  near(p.sample(20, 65, 3, 0).dx); // Natural grip is the neutral pose.
  p.reset(); p.sample(0, 0, 0, 0);
  assert.ok(p.sample(0, 0, 8, 0).dx > .3, 'a comfortable small tilt has a visible response');
  near(p.sample(0, .3, .3, 0).dx); // Ignore small hand tremor.
  near(p.sample(0, .3, .3, 0).dy);
  assert.equal(p.sample(0, 0, 80, 0).dx, .6); // Clamp large tilts.
  p.reset(); p.sample(0, 0, 0, 90);
  near(p.sample(0, 0, 18, 90).dx);
  assert.ok(p.sample(0, 0, 18, 90).dy < -.58); // Landscape axis and sign.
  p.reset(); p.sample(359, 80, 0, 0);
  const wrapped = p.sample(1, 80, 0, 0);
  const smallTurn = new TiltProjector(); smallTurn.sample(-1, 80, 0, 0);
  near(wrapped.dx - smallTurn.sample(1, 80, 0, 0).dx); // 359→1 equals a two-degree turn.
  assert.ok(Math.abs(wrapped.dx) < .1);
  p.reset(); p.sample(0, 89, 0, 0);
  const upright = p.sample(0, 91, 0, 0);
  near(upright.dx);
  assert.ok(upright.dy > 0 && upright.dy < .1); // Cross upright without a jump.
}
{
  const s = setup();
  s.tilt.setSceneActive(true);
  assert.equal(s.window.count('deviceorientation'), 0, 'every browser starts off, including those without requestPermission');
  assert.equal(s.tilt.state, 'off');
  s.sample(60, 18); s.flush();
  assert.equal(s.positions.length, 0, 'no camera movement before the user opts in');
  await s.tilt.toggle();
  assert.equal(s.window.count('deviceorientation'), 1);
  s.sample(null, null); assert.equal(s.tilt.state, 'starting');
  s.sample(60, 0); s.flush();
  assert.equal(s.tilt.state, 'active'); assert.equal(s.timers.size, 0);
  s.sample(60, 18); s.flush();
  assert.ok(s.positions.at(-1).dx > .58);
  const calls = s.positions.length;
  s.sample(60, 18); s.flush(); assert.equal(s.positions.length, calls, 'still phone does not repeat camera updates');
  s.tilt.setSceneActive(true); s.sample(60, 18); s.flush();
  assert.equal(s.positions.length, calls, 'window and document routes keep the active grip without recentering');
  s.tilt.setSceneActive(false);
  s.tilt.setSceneActive(true); s.sample(60, 18); s.flush();
  assert.ok(s.positions.at(-1).dx > .58, 'suspending and resuming does not reset the offset');
  s.window.screen.orientation.angle = 90;
  s.window.screen.orientation.emit('change');
  s.sample(60, 18); s.flush();
  assert.equal(s.positions.at(-1).dx, 0, 'screen rotation recalibrates');
  s.document.hidden = true; s.document.emit('visibilitychange');
  assert.equal(s.window.count('deviceorientation'), 0); assert.equal(s.frames.size, 0);
  s.document.hidden = false; s.document.emit('visibilitychange');
  assert.equal(s.window.count('deviceorientation'), 1);
  s.sample(60, 26); s.flush();
  const resumed = s.positions.at(-1).dy;
  assert.ok(resumed < -.3, 'the original screen-rotation baseline survives background suspension');
  s.tilt.setSceneActive(false); assert.equal(s.window.count('deviceorientation'), 0);
  s.tilt.setSceneActive(true); s.sample(60, 0); s.flush();
  await s.tilt.toggle(); assert.equal(s.tilt.state, 'off'); assert.equal(s.window.count('deviceorientation'), 0);
  s.tilt.setSceneActive(false); s.tilt.setSceneActive(true);
  assert.equal(s.window.count('deviceorientation'), 0, 'manual off persists across routes');
  await s.tilt.toggle(); assert.equal(s.window.count('deviceorientation'), 1);
  s.reduce.matches = true; s.reduce.emit('change');
  assert.equal(s.window.count('deviceorientation'), 0); assert.equal(s.tilt.state, 'reduced');
  s.tilt.dispose(); assert.equal(s.window.count('pageshow'), 0);
}
{
  let resolve;
  const s = setup({ permission: () => new Promise(done => { resolve = done; }) });
  s.tilt.setSceneActive(true);
  assert.equal(s.requests, 0); assert.equal(s.tilt.state, 'permission');
  const pending = s.tilt.toggle();
  assert.equal(s.requests, 1, 'request begins synchronously inside the user gesture');
  await s.tilt.toggle(); assert.equal(s.requests, 1, 'duplicate click does not re-request');
  resolve('granted'); await pending;
  s.sample(50, 0); s.flush(); assert.equal(s.tilt.state, 'active');
  s.tilt.setSceneActive(false); s.tilt.setSceneActive(true);
  assert.equal(s.requests, 1, 'route changes reuse granted permission');
  s.tilt.dispose();
}
{
  const s = setup({ permission: () => Promise.resolve('denied') });
  s.tilt.setSceneActive(true); await s.tilt.toggle();
  assert.equal(s.tilt.state, 'denied'); assert.equal(s.window.count('deviceorientation'), 0);
  s.tilt.dispose();
}
{
  const s = setup(); s.tilt.setSceneActive(true); await s.tilt.toggle();
  [...s.timers.values()][0]();
  assert.equal(s.tilt.state, 'no-data'); assert.equal(s.window.count('deviceorientation'), 0);
  await s.tilt.toggle(); assert.equal(s.window.count('deviceorientation'), 1);
  s.tilt.dispose();
}
for (const options of [{ mobile: false }, { secure: false }, { reduced: true }, { supported: false }]) {
  const s = setup(options); s.tilt.setSceneActive(true); await s.tilt.toggle();
  assert.equal(s.window.count('deviceorientation'), 0);
  s.tilt.dispose(); assert.equal(s.frames.size, 0); assert.equal(s.timers.size, 0);
}
console.log('Device tilt checks passed: relative rotation, landscape, limits, smoothing, permissions, lifecycle and fallbacks.');
