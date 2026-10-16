import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

class Events {
  listeners = new Map();
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type) { for (const fn of this.listeners.get(type) ?? []) fn(); }
}
const timers = new Map();
let timerId = 0;
const window = Object.assign(new Events(), {
  setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); },
});
const document = { hidden: false };
const { code } = await transform(readFileSync(new URL('../src/background-music.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' });
const sandbox = { module: { exports: {} }, window, document };
vm.runInNewContext(code, sandbox);
const { BackgroundMusic } = sandbox.module.exports;
const gains = [];
let sources = 0;
const context = {
  state: 'running', currentTime: 1, destination: {}, resume: () => Promise.resolve(),
  createGain() { const gain = { gain: { value: 0, cancelScheduledValues() {}, setTargetAtTime(value) { gains.push(value); } }, connect() { return this; }, disconnect() {} }; return gain; },
  createMediaElementSource() { sources++; return { connect(gain) { return gain; }, disconnect() {} }; },
};
class Media extends Events {
  paused = true; currentTime = 0; error = null; plays = 0; loads = 0; pending = null;
  setAttribute() {}
  play() { this.plays++; this.paused = false; return new Promise((resolve, reject) => { this.pending = { resolve, reject }; }); }
  pause() { this.paused = true; this.emit('pause'); }
  load() { this.loads++; this.error = null; }
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const runTimer = async () => { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); await flush(); };
const element = new Media();
const music = new BackgroundMusic(element);
music.unlock(context);
music.sync(context, true, .36);
// Slow media playback resolves after the route has entered the room.
music.sync(context, true, .075);
element.pending.resolve();
await flush();
assert.equal(gains.at(-1), .075, 'A late play promise must retain the room mix');
assert.equal(sources, 1, 'Only one source may connect the HTML audio element');
music.sync(context, false, 0);
assert.equal(element.paused, true);
assert.equal(gains.at(-1), 0);
music.sync(context, true, .36);
element.pending.reject({ name: 'NotAllowedError' });
element.paused = true;
await flush();
assert.equal(timers.size, 0, 'Autoplay rejection waits for a user gesture');
music.unlock(context);
element.pending.resolve();
await flush();
assert.equal(element.paused, false, 'A new gesture recovers blocked audio');
element.error = { code: 2 };
element.pause();
await runTimer();
assert.equal(element.loads, 1, 'Only actual network errors reload the stream');
element.pending.resolve();
await flush();
document.hidden = true;
music.sync(context, false, 0);
element.emit('pause');
assert.equal(timers.size, 0, 'Backgrounded pages do not restart playback');
document.hidden = false;
music.sync(context, true, .075);
music.dispose();
element.pending.resolve();
await flush();
assert.equal(element.paused, true, 'A disposed controller cannot resume from a late promise');

// Check outline geometry for every displayed value, not just 99 and 100.
const outlines = JSON.parse(readFileSync(new URL('../src/loading-digits.json', import.meta.url), 'utf8'));
const numberCode = await transform(readFileSync(new URL('../src/loading-number.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' });
const numberSandbox = { module: { exports: {} }, require: () => outlines };
vm.runInNewContext(numberCode.code, numberSandbox);
for (let value = 0; value <= 100; value++) {
  const markup = numberSandbox.module.exports.loadingNumber(value);
  const width = Number(markup.match(/viewBox="0 0 ([\d.]+) 82"/)[1]);
  const translations = [...markup.matchAll(/translate\(([\d.]+) 76\)/g)].map(match => Number(match[1]));
  assert.equal(translations[0], 0);
  assert.ok(Math.abs(width - translations.at(-1) - outlines['%'].width) < .002, `${value}% is centered on the complete ink bounds`);
  assert.equal(translations.length, value === 100 ? 4 : 3);
}
console.log('Mobile runtime checks passed: iOS gain mixing, slow loads, gesture recovery, network retry, page visibility, cleanup, and 0–100% centering.');
