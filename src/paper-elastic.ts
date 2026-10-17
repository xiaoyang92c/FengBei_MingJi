import gsap from 'gsap';

/** Increasing resistance at either edge; the paper itself never moves. */
export function paperResistance(distance: number, limit: number) {
  return Math.sign(distance) * limit * (1 - Math.exp(-Math.abs(distance) * .55 / limit));
}
function unresist(offset: number, limit: number) {
  return -Math.sign(offset) * Math.log(Math.max(.001, 1 - Math.abs(offset) / limit)) * limit / .55;
}
/** Exact critically damped spring, stable across different frame rates. */
export function paperSpring(offset: number, velocity: number, dt: number) {
  const frequency = 18;
  const tail = velocity + frequency * offset;
  const decay = Math.exp(-frequency * dt);
  return { offset: (offset + tail * dt) * decay, velocity: (velocity - frequency * tail * dt) * decay };
}

/** Leave normal scrolling to the browser; own only its boundary feedback. */
export function mountPaperElastic(root: HTMLElement, reduced: boolean) {
  const paper = root.querySelector<HTMLElement>('.unfolding-paper,.dispatch-paper');
  const noop = { reset() {}, dispose() {} };
  if (!paper || reduced || !window.matchMedia('(pointer: coarse)').matches) return noop;
  const contents = [...paper.querySelectorAll<HTMLElement>(':scope > .press-masthead,:scope > .press-body,:scope > .survey-body,:scope > .dispatch-body')];
  if (!contents.length) return noop;
  const paintY = gsap.quickSetter(contents, 'y', 'px');
  let offset = 0, velocity = 0, raw = 0, frame = 0, lastFrame = 0;
  let pointer: number | null = null;
  let startX = 0, startY = 0, lastY = 0, lastMove = 0, vertical = false;
  let range = 0, limit = 60, lastScroll = paper.scrollTop, lastScrollTime = 0, coastUntil = 0;
  const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));
  const measure = () => {
    // A translated body may temporarily enlarge scrollable overflow.
    if (Math.abs(offset) < .01) range = Math.max(0, paper.scrollHeight - paper.clientHeight);
    limit = Math.min(72, paper.clientHeight * .12);
  };
  const paint = (value: number) => {
    offset = value;
    paper.classList.toggle('is-edge-pulling', Math.abs(value) > .01);
    paintY(value);
  };
  const stopFrame = () => { cancelAnimationFrame(frame); frame = 0; lastFrame = 0; };
  const reset = () => {
    stopFrame();
    pointer = null; raw = 0; velocity = 0; coastUntil = 0;
    paint(0);
    gsap.set(contents, { clearProps: 'transform' });
  };
  const tick = (now: number) => {
    frame = 0;
    if (document.hidden) { reset(); return; }
    const dt = lastFrame ? Math.min(.05, (now - lastFrame) / 1000) : 1 / 60;
    lastFrame = now;
    const next = paperSpring(offset, velocity, dt);
    velocity = next.velocity;
    paint(next.offset);
    if (Math.abs(offset) < .05 && Math.abs(velocity) < .8) { reset(); return; }
    frame = requestAnimationFrame(tick);
  };
  const release = () => {
    stopFrame();
    // Keep the finger's release velocity, softened when still pulling outward.
    velocity = clamp(velocity, -400, 400);
    if (offset * velocity > 0) velocity *= .25;
    if (Math.abs(offset) > .05 || Math.abs(velocity) > .8) {
      lastFrame = performance.now();
      frame = requestAnimationFrame(tick);
    }
    else {
      paint(0);
      gsap.set(contents, { clearProps: 'transform' });
    }
  };
  const touch = (event: TouchEvent) => [...event.touches].find(item => item.identifier === pointer);
  const onStart = (event: TouchEvent) => {
    if (event.touches.length !== 1 || paper.inert || paper.classList.contains('paper-is-folding')) return;
    stopFrame();
    measure();
    const point = event.touches[0];
    pointer = point.identifier;
    startX = point.clientX; startY = lastY = point.clientY;
    lastMove = performance.now(); vertical = false; velocity = 0; coastUntil = 0;
    raw = unresist(offset, limit);
    lastScroll = clamp(paper.scrollTop, 0, range); lastScrollTime = lastMove;
  };
  const onMove = (event: TouchEvent) => {
    if (pointer === null) return;
    if (event.touches.length !== 1) { pointer = null; release(); return; }
    const point = touch(event);
    if (!point) return;
    const delta = point.clientY - lastY;
    lastY = point.clientY;
    if (!vertical) {
      const dx = Math.abs(point.clientX - startX), dy = Math.abs(point.clientY - startY);
      if (dy < 6 || dy < dx * 1.1) return;
      vertical = true;
    }
    const now = performance.now(), dt = Math.max(8, now - lastMove);
    lastMove = now;
    const top = clamp(paper.scrollTop, 0, range);
    const next = top - delta;
    if (raw || next < 0 || next > range) {
      if (!event.cancelable) return;
      event.preventDefault();
      if (raw) {
        const previous = raw;
        raw += delta;
        if (previous * raw <= 0) {
          // Consume the resistance before handing the next movement to native scroll.
          paper.scrollTop = clamp(top - raw, 0, range);
          raw = 0;
        }
      } else {
        paper.scrollTop = clamp(next, 0, range);
        raw = next < 0 ? -next : range - next;
      }
      const y = paperResistance(raw, limit);
      velocity = velocity * .35 + (y - offset) / dt * 1000 * .65;
      paint(y);
    }
  };
  const onEnd = (event: TouchEvent) => {
    if (pointer === null || touch(event)) return;
    pointer = null;
    if (vertical && !raw) coastUntil = performance.now() + 1400;
    if (performance.now() - lastMove > 90 || (!raw && Math.abs(offset) < .05)) velocity = 0;
    raw = 0;
    release();
  };
  const onCancel = () => { pointer = null; raw = 0; velocity = 0; release(); };
  const onScroll = () => {
    const now = performance.now(), top = clamp(paper.scrollTop, 0, range);
    const elapsed = now - lastScrollTime;
    const reached = (top <= .5 && lastScroll > .5) || (range > 0 && top >= range - .5 && lastScroll < range - .5);
    if (pointer === null && !frame && now < coastUntil && reached && elapsed > 0 && elapsed < 100) {
      velocity = clamp(-(top - lastScroll) / elapsed * 1000 * .25, -550, 550);
      coastUntil = 0;
      release();
    }
    lastScroll = top; lastScrollTime = now;
  };
  const onHidden = () => { if (document.hidden) reset(); };
  measure();
  paper.classList.add('has-paper-elastic');
  paper.addEventListener('touchstart', onStart, { passive: true });
  paper.addEventListener('touchmove', onMove, { passive: false });
  paper.addEventListener('touchend', onEnd, { passive: true });
  paper.addEventListener('touchcancel', onCancel, { passive: true });
  paper.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onHidden);
  return { reset, dispose() {
    reset();
    paper.classList.remove('has-paper-elastic');
    paper.removeEventListener('touchstart', onStart);
    paper.removeEventListener('touchmove', onMove);
    paper.removeEventListener('touchend', onEnd);
    paper.removeEventListener('touchcancel', onCancel);
    paper.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onHidden);
  } };
}
