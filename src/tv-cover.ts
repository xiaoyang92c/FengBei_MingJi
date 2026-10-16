import gsap from 'gsap';
import { crtScreenMarkup, crtLetters, revealCrtLine, mountCrtLens, createCrtNoise } from './crt-display';

type Loader = () => Promise<unknown>;
export type TvSounds = { ready: () => Promise<void>; powerOn: () => void; ambience: () => void; hover: () => void; click: () => void; stopHover: () => void };

export function tvCoverPage() {
  return `<section class="screen cover-screen tv-cover" aria-label="丰碑与铭记：电视序幕" aria-busy="true">${crtScreenMarkup(`      <div class="crt-loader"><span class="crt-loader-label">成渝记忆 / 正在调谐</span><div class="crt-counter" aria-hidden="true"><b>00</b><span>%</span></div><div class="crt-progress" role="progressbar" aria-label="开机与记忆素材载入进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><p role="status" aria-live="polite" aria-atomic="true">接通信号</p></div>
      <div class="crt-signal" inert aria-hidden="true">
        <header class="crt-heading tv-element"><span>成渝铁路</span><span>第二章 / 建设者记忆</span></header>
        <main class="crt-program"><div class="crt-station tv-element"><i aria-hidden="true"></i><span>成渝记忆</span><b>CH 02</b></div><h1 class="crt-title tv-element" data-title="丰碑与铭记">丰碑与铭记</h1>
          <div class="crt-menu tv-element"><div class="crt-menu-heading"><span>声道选择</span><span>AUDIO</span></div>
            <div class="crt-entry-list" role="group" aria-label="选择进入方式，再次确认后进入" aria-describedby="crt-entry-help">
              <button class="crt-entry is-selected" data-tv-entry="sound" aria-pressed="true" disabled><span class="crt-cursor" aria-hidden="true">▸</span><span class="crt-entry-number" aria-hidden="true">01</span><span class="crt-entry-copy"><b>有声进入</b><small>声道开启</small></span><span class="crt-entry-state" aria-hidden="true">ON</span></button>
              <button class="crt-entry" data-tv-entry="silent" aria-pressed="false" disabled><span class="crt-cursor" aria-hidden="true">▸</span><span class="crt-entry-number" aria-hidden="true">02</span><span class="crt-entry-copy"><b>静音进入</b><small>声道关闭</small></span><span class="crt-entry-state" aria-hidden="true">OFF</span></button>
              <div class="crt-selection-frame" aria-hidden="true"><span class="crt-frame-lock"></span></div>
            </div>
            <p class="crt-key-hint"><span id="crt-entry-help" class="crt-confirm-hint" role="status" aria-live="polite" aria-atomic="true">点击选择，再次点击进入</span><span class="crt-keyboard-hint">↑ ↓ 选择　ENTER 确认</span></p>
          </div>
        </main><footer class="crt-footer tv-element"><span>成渝铁路工业遗产数字记忆馆</span><span class="crt-lock"><i aria-hidden="true"></i>信号已锁定</span></footer>
      </div>`)}</section>`;
}

/** Assets and the phosphor warm-up jointly determine progress; all work is scoped. */
export function mountTvCover(container: HTMLElement, reduced: boolean, loaders: Loader[], sounds: TvSounds, onEnter: (sound: boolean) => void): () => void {
  const root = container.querySelector<HTMLElement>('.tv-cover');
  if (!root) return () => {};
  const startup = root.querySelector<HTMLElement>('.crt-startup')!;
  const ignition = root.querySelector<HTMLElement>('.crt-ignition')!;
  const phosphor = root.querySelector<HTMLElement>('.crt-phosphor')!;
  const loader = root.querySelector<HTMLElement>('.crt-loader')!;
  const number = root.querySelector<HTMLElement>('.crt-counter>b')!;
  const loaderLabel = root.querySelector<HTMLElement>('.crt-loader-label')!;
  const progressbar = root.querySelector('.crt-progress')!;
  const fill = progressbar.querySelector<HTMLElement>('i')!;
  const status = loader.querySelector<HTMLElement>('p')!;
  const signal = root.querySelector<HTMLElement>('.crt-signal')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('.crt-entry')];
  const entryList = root.querySelector<HTMLElement>('.crt-entry-list')!;
  const selectionFrame = root.querySelector<HTMLElement>('.crt-selection-frame')!;
  const frameLock = selectionFrame.querySelector('.crt-frame-lock')!;
  const entryHelp = root.querySelector<HTMLElement>('.crt-confirm-hint')!;
  const textLines = [...signal.querySelectorAll<HTMLElement>('.crt-heading>span,.crt-station>span,.crt-station>b,.crt-title,.crt-menu-heading>span,.crt-entry-number,.crt-entry-copy>b,.crt-entry-copy>small,.crt-entry-state,.crt-key-hint>span,.crt-footer>span')];
  const allLetters = textLines.flatMap(crtLetters);
  const disposeLens = mountCrtLens(root);
  const drawNoise = createCrtNoise(root, reduced);
  let disposed = false;
  let complete = 0;
  let finishing = false;
  let ready = false;
  let lastNumber = -1;
  let value = 0;
  let statusEntered = false;
  let started = Infinity;
  const warmup = reduced ? .25 : 3.2;
  const soundReady = sounds.ready().catch(() => {});
  const context = gsap.context(() => {
    gsap.set(signal, { opacity: 0 });
    gsap.set(selectionFrame, { autoAlpha: 0 });
    gsap.set(frameLock, { opacity: 0, x: 0 });
    if (reduced) void soundReady.then(() => {
      if (disposed) return;
      started = performance.now();
      sounds.powerOn();
      sounds.ambience();
    });
    if (!reduced) {
      gsap.set(startup, { opacity: 1 });
      gsap.set(ignition, { opacity: 0, scaleX: .04 });
      gsap.set(loader, { opacity: 1 });
      gsap.set(allLetters, { opacity: 0 });
      gsap.set([number, root.querySelector('.crt-counter>span'), progressbar, status], { opacity: 0 });
      const labelLetters = crtLetters(loaderLabel);
      gsap.set(labelLetters, { opacity: 0 });
      // The trace blooms into diffuse phosphor light while the fixed glass
      // gradually gains luminance. No sudden background swap or panel scaling.
      gsap.set(phosphor, { opacity: 0, scaleY: .015 });
      const ignitionTimeline = gsap.timeline({ paused: true });
      ignitionTimeline.call(sounds.powerOn, [], .08)
        .call(sounds.ambience, [], 1.6)
        .to(ignition, { opacity: .72, scaleX: 1, duration: .22, ease: 'power2.out' }, .12)
        .to(phosphor, { opacity: .42, scaleY: .16, duration: .3, ease: 'sine.out' }, .2)
        .to(startup, { opacity: .88, duration: .25, ease: 'sine.in' }, .3)
        .to(ignition, { opacity: 0, duration: .65, ease: 'sine.out' }, .34)
        .to(phosphor, { opacity: .18, scaleY: 1, duration: .65, ease: 'power1.out' }, .5)
        .to(startup, { opacity: 0, duration: 1, ease: 'sine.inOut' }, .55)
        .to(phosphor, { opacity: 0, duration: .45, ease: 'sine.out' }, 1.15)
        .to([number, root.querySelector('.crt-counter>span')], { opacity: 1, duration: .65, stagger: .1, ease: 'sine.out' }, 1.17)
        .to(progressbar, { opacity: 1, duration: .65, ease: 'sine.out' }, 1.28)
        .set(startup, { visibility: 'hidden' }, 1.62)
        .call(() => {
          statusEntered = true;
          context.add(() => {
            gsap.set(status, { opacity: 1 });
            revealCrtLine(gsap.timeline(), status, 0, .42, .055);
          });
        }, [], 1.43);
      revealCrtLine(ignitionTimeline, loaderLabel, .94, .48, .032);
      void soundReady.then(() => {
        if (disposed) return;
        started = performance.now();
        ignitionTimeline.play(0);
      });
    }
  }, root);
  const writeStatus = (label: string) => {
    if (status.textContent === label) return;
    gsap.killTweensOf(status.querySelectorAll('.crt-letter'));
    status.textContent = label;
    status.classList.remove('crt-glitch-line');
    if (statusEntered && !reduced) context.add(() => revealCrtLine(gsap.timeline(), status, 0, .35, .045));
  };
  let selectedButton = buttons[0];
  let armedButton: HTMLButtonElement | null = null;
  let committing = false;
  let frameShown = false;
  const writeMenuLine = (element: HTMLElement, text: string) => {
    if (element.textContent === text) return;
    gsap.killTweensOf(element.querySelectorAll('.crt-letter'));
    element.textContent = text;
    element.classList.remove('crt-glitch-line');
    if (!reduced) context.add(() => revealCrtLine(gsap.timeline(), element, 0, .22, .018));
    else crtLetters(element);
  };
  const placeFrame = (animate = false) => {
    const height = selectedButton.offsetHeight + 8;
    gsap.set(selectionFrame, { height });
    context.add(() => gsap.to(selectionFrame, {
      y: selectedButton.offsetTop - 4, duration: animate && !reduced ? .38 : 0,
      ease: 'power3.out', overwrite: 'auto',
    }));
  };
  const revealFrame = () => {
    if (frameShown) return;
    frameShown = true;
    placeFrame();
    context.add(() => {
      gsap.set(selectionFrame, { autoAlpha: 1 });
      if (reduced) { gsap.set(frameLock, { opacity: 1, x: 0 }); return; }
      // Two brief tracking errors, then a complete OSD outline locks in place.
      // The border always stays outside the label; nothing expands through it.
      gsap.timeline()
        .set(frameLock, { opacity: 1, x: -2 }, 0)
        .set(frameLock, { opacity: 0 }, .055)
        .set(frameLock, { opacity: 1, x: 2 }, .12)
        .set(frameLock, { opacity: 0 }, .175)
        .set(frameLock, { opacity: 1, x: 0 }, .25);
    });
  };
  const updateSelection = () => {
    buttons.forEach(button => {
      const selected = button === selectedButton;
      button.classList.toggle('is-selected', selected);
      button.classList.toggle('is-armed', button === armedButton);
      button.setAttribute('aria-pressed', String(selected));
      writeMenuLine(button.querySelector<HTMLElement>('.crt-entry-copy>small')!, button === armedButton
        ? '再次确认进入' : button.dataset.tvEntry === 'sound' ? '声道开启' : '声道关闭');
    });
    writeMenuLine(entryHelp, armedButton
      ? `已选${armedButton.dataset.tvEntry === 'sound' ? '有声' : '静音'}进入，再次确认`
      : '点击选择，再次点击进入');
  };
  const select = (button: HTMLButtonElement) => {
    if (button === selectedButton) return;
    selectedButton = button;
    armedButton = null;
    updateSelection();
    placeFrame(frameShown);
  };
  let hoveredButton: HTMLButtonElement | null = null;
  let automaticFocus = false;
  const previewHover = (button: HTMLButtonElement | null) => {
    entryList.classList.toggle('is-previewing', button !== null);
    buttons.forEach(item => item.classList.toggle('is-previewed', item === button));
  };
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    const button = (event.target as Element).closest<HTMLButtonElement>('.crt-entry');
    if (!ready || committing || !button || (event.relatedTarget instanceof Node && button.contains(event.relatedTarget))) return;
    hoveredButton = button;
    previewHover(button);
    sounds.hover();
  };
  const onPointerOut = (event: PointerEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('.crt-entry');
    if (!button || (event.relatedTarget instanceof Node && button.contains(event.relatedTarget))) return;
    hoveredButton = null;
    previewHover(null);
    sounds.stopHover();
  };
  const onFocus = (event: FocusEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('.crt-entry');
    if (!ready || committing || !button) return;
    // Mouse focus precedes click; only keyboard focus moves the chosen channel.
    if (!automaticFocus && button.matches(':focus-visible')) {
      select(button);
      if (hoveredButton !== button) sounds.hover();
    }
  };
  const onFocusOut = () => {
    if (!hoveredButton) sounds.stopHover();
  };
  const onKey = (event: KeyboardEvent) => {
    if (!ready || committing || root.classList.contains('is-leaving')) return;
    if (event.repeat && ['Enter', ' '].includes(event.key)) { event.preventDefault(); return; }
    if (event.key === 'Escape') {
      armedButton = null;
      updateSelection();
      return;
    }
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    previewHover(null);
    const index = buttons.indexOf(selectedButton);
    const next = buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length];
    select(next);
    next.focus({ preventScroll: true });
  };
  const onClick = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('.crt-entry');
    if (!ready || committing || !button || root.classList.contains('is-leaving')) return;
    sounds.click();
    if (armedButton === button && selectedButton === button) {
      committing = true;
      root.setAttribute('aria-busy', 'true');
      // Let the 235ms confirmation recording finish before shutdown/muting.
      context.add(() => gsap.delayedCall(.26, () => {
        if (!disposed) onEnter(button.dataset.tvEntry === 'sound');
      }));
      return;
    }
    select(button);
    armedButton = button;
    updateSelection();
    revealFrame();
  };
  const frameResize = new ResizeObserver(() => { if (!disposed) placeFrame(); });
  frameResize.observe(entryList);
  signal.addEventListener('pointerover', onPointer);
  signal.addEventListener('pointerout', onPointerOut);
  signal.addEventListener('focusin', onFocus);
  signal.addEventListener('focusout', onFocusOut);
  signal.addEventListener('keydown', onKey);
  signal.addEventListener('click', onClick);
  const showProgram = () => {
    if (disposed || finishing) return;
    finishing = true;
    number.textContent = '100';
    progressbar.setAttribute('aria-valuenow', '100');
    fill.style.transform = 'scaleX(1)';
    writeStatus('信号已锁定');
    root.classList.add('is-locked');
    context.add(() => {
      const reveal = gsap.timeline({ onComplete: () => {
        if (disposed) return;
        ready = true;
        root.classList.add('is-ready');
        root.setAttribute('aria-busy', 'false');
        signal.inert = false;
        signal.removeAttribute('aria-hidden');
        buttons.forEach(button => { button.disabled = false; });
        placeFrame();
        if (document.activeElement === document.body || root.contains(document.activeElement)) {
          automaticFocus = true;
          buttons[0].focus({ preventScroll: true });
          automaticFocus = false;
        }
      } });
      reveal.to(loader, { opacity: 0, duration: reduced ? 0 : .4 }, reduced ? 0 : .42)
        .set(loader, { visibility: 'hidden' })
        .to(signal, { opacity: 1, duration: reduced ? 0 : .45, ease: 'sine.out' }, reduced ? 0 : .68);
      if (!reduced) {
        const groups: Array<[string, number, number]> = [
          ['.crt-heading>span', .7, .018],
          ['.crt-station>span,.crt-station>b', .8, .026],
          ['.crt-title', .92, .095],
          ['.crt-menu-heading>span', 1.1, .025],
          ['.crt-entry[data-tv-entry="sound"] .crt-glitch-line', 1.22, .023],
          ['.crt-entry[data-tv-entry="silent"] .crt-glitch-line', 1.38, .023],
          ['.crt-key-hint>span,.crt-footer>span', 1.4, .012],
        ];
        groups.forEach(([selector, at, stagger]) => signal.querySelectorAll<HTMLElement>(selector).forEach(line => revealCrtLine(reveal, line, at, .48, stagger)));
        reveal.fromTo(signal.querySelector('.crt-menu'), { opacity: 0 }, { opacity: 1, duration: .6, ease: 'sine.out' }, 1.08);
      }
    });
  };
  const tick = (time: number) => {
    if (disposed || document.hidden) return;
    const elapsed = (performance.now() - started) / 1000;
    if (!finishing && Number.isFinite(started)) {
      const assets = loaders.length ? complete / loaders.length : 1;
      const warm = Math.min(1, elapsed / warmup);
      const target = Math.min(99, (assets * .74 + warm * .26) * 99);
      value += (target - value) * .14;
      const integer = Math.max(0, Math.floor(value));
      if (integer !== lastNumber) {
        lastNumber = integer;
        number.textContent = String(integer).padStart(2, '0');
        progressbar.setAttribute('aria-valuenow', String(integer));
        fill.style.transform = `scaleX(${integer / 100})`;
      }
      const label = elapsed < .65 ? '接通信号' : assets < 1 ? '载入记忆' : '校准画面';
      writeStatus(label);
      if (assets === 1 && warm === 1) showProgram();
    }
    drawNoise(time);
  };
  gsap.ticker.add(tick);
  loaders.forEach(load => {
    void Promise.resolve().then(load).catch(() => {}).finally(() => { if (!disposed) complete++; });
  });
  return () => {
    disposed = true;
    gsap.ticker.remove(tick);
    frameResize.disconnect();
    disposeLens();
    context.revert();
    sounds.stopHover();
    signal.removeEventListener('pointerover', onPointer);
    signal.removeEventListener('pointerout', onPointerOut);
    signal.removeEventListener('focusin', onFocus);
    signal.removeEventListener('focusout', onFocusOut);
    signal.removeEventListener('keydown', onKey);
    signal.removeEventListener('click', onClick);
  };
}

/** Every glyph loses sync before the emission collapses into a line and a dot. */
export function leaveTvCover(root: HTMLElement, veil: HTMLElement, powerOff: () => void, shutdown = true): gsap.core.Timeline {
  root.classList.remove('is-ready');
  root.classList.add('is-leaving');
  root.dispatchEvent(new Event('crt:leave'));
  root.inert = true;
  root.setAttribute('aria-busy', 'true');
  root.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
  const selected = root.querySelector('.crt-entry.is-selected');
  const picture = root.querySelector('.crt-picture');
  const phosphor = root.querySelector('.crt-phosphor');
  const ignition = root.querySelector('.crt-ignition');
  const signal = root.querySelector('.crt-signal');
  const selectionFrame = root.querySelector('.crt-selection-frame');
  root.querySelectorAll<HTMLElement>('.finale-credit-roll b,.finale-credit-roll p>span,[data-finale-sound]').forEach(crtLetters);
  const letters = root.querySelectorAll('.crt-signal .crt-letter');
  const echoes: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>('.crt-signal .crt-glitch-line').forEach(line => {
    const echo = document.createElement('span');
    echo.className = 'crt-exit-echo';
    echo.textContent = line.textContent;
    echo.setAttribute('aria-hidden', 'true');
    line.append(echo);
    echoes.push(echo);
  });
  const timeline = gsap.timeline();
  timeline.set(veil, { autoAlpha: 0, backgroundColor: '#040905' }, 0)
    .set(veil.querySelector('.veil-line'), { opacity: 0 }, 0)
    .set(echoes, { opacity: 0 }, 0)
    .to(selected, { opacity: .55, duration: .07, repeat: 1, yoyo: true, ease: 'none' }, 0)
    .to(letters, {
      keyframes: [
        { x: index => index % 2 ? 2.5 : -2, opacity: .45, duration: .045 },
        { x: index => index % 3 ? -3 : 4, opacity: .95, duration: .045 },
        { x: index => index % 2 ? 5 : -4, opacity: .18, duration: .05 },
        { x: index => index % 3 ? -1 : 2, opacity: .7, duration: .04 },
        { x: index => (index % 5 - 2) * 3, opacity: 0, scaleY: .6, duration: .1 },
      ],
      stagger: { amount: .32, from: 'random' }, ease: 'none',
    }, .16)
    .to(echoes, { opacity: .65, x: index => index % 2 ? 8 : -8, duration: .04, stagger: { amount: .07 }, ease: 'none' }, .18)
    .to(echoes, { opacity: .24, x: index => index % 2 ? -6 : 6, duration: .05, ease: 'none' }, .3)
    .to(echoes, { opacity: 0, x: 2, duration: .12, ease: 'none' }, .4)
    .to(root.querySelectorAll('.crt-station>i,.crt-lock>i,.crt-cursor'), { x: 3, opacity: 0, duration: .18, stagger: .04, ease: 'steps(3)' }, .44)
    .to(root.querySelector('.crt-menu'), { opacity: 0, duration: .18, ease: 'steps(3)' }, .66)
    .to(signal, { opacity: 0, duration: .12 }, .83);
  if (selectionFrame) timeline.to(selectionFrame, { x: -3, opacity: 0, duration: .2, ease: 'steps(3)' }, .46);
  if (!shutdown) {
    // Retune directly into the opening; no power-off cue or line collapse.
    return timeline.to(picture, { opacity: 0, duration: .14, ease: 'sine.in' }, .83)
      .to(veil, { autoAlpha: 1, duration: .14, ease: 'sine.in' }, .83);
  }
  timeline.call(powerOff, [], .78)
    .set(phosphor, { scaleY: 1, opacity: .08 }, .98)
    .to(picture, { scaleY: .004, duration: .23, ease: 'power2.in' }, 1)
    .to(phosphor, { scaleY: .006, opacity: .28, duration: .23, ease: 'power2.in' }, 1)
    .set(ignition, { opacity: .7, scaleX: 1 }, 1.2)
    .to(ignition, { scaleX: .025, opacity: .55, duration: .23, ease: 'power2.in' }, 1.23)
    .to(ignition, { opacity: 0, duration: .12, ease: 'sine.out' }, 1.46)
    .to(phosphor, { opacity: 0, duration: .15 }, 1.3)
    .to(veil, { autoAlpha: 1, duration: .16, ease: 'sine.inOut' }, 1.46)
    .to(root, { opacity: 0, duration: .18, ease: 'sine.in' }, 1.48);
  return timeline;
}
