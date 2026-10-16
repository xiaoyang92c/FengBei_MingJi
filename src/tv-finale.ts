import gsap from 'gsap';
import { clues } from './content';
import { crtScreenMarkup, crtLetters, revealCrtLine, mountCrtLens, createCrtNoise } from './crt-display';
import type { TvSounds } from './tv-cover';

export function tvFinalePage(sound: boolean) {
  const entries = [...clues].sort((a, b) => Number(a.number) - Number(b.number));
  return `<section class="screen finale-screen tv-cover tv-finale" aria-label="终章：记住修路的人" aria-busy="true">${crtScreenMarkup(`
    <div class="crt-signal finale-signal" inert aria-hidden="true">
      <header class="crt-heading tv-element"><span>成渝记忆 / CH 02</span><span>终章 · 回到碑前</span></header>
      <main class="finale-program">
        <p class="finale-era tv-element" data-crt-line>1950 开工　1952 通车　1954 奠基</p>
        <h1 class="finale-title tv-element"><span data-crt-line>路修好了</span><strong data-crt-line>别忘了修路的人</strong></h1>
        <p class="finale-broadcast-copy tv-element"><span data-crt-line>钢钎和大锤放下了，火车从这里开过</span><span data-crt-line>走到碑前，再把修路的人读一遍</span></p>
        <div class="finale-credits tv-element"><span data-crt-line>五条线索</span><div class="finale-credit-window"><div class="finale-credit-roll">${[...entries, entries[0]].map((entry,index) => `<p ${index === entries.length ? 'aria-hidden="true"' : ''}><b>${entry.number}</b><span>${entry.label}</span></p>`).join('')}</div></div><span data-crt-line>都记下了</span></div>
        <p class="finale-inscription tv-element" data-crt-line>成渝铁路筑路民工纪念碑</p>
        <div class="finale-endmark tv-element" data-crt-line>本集终</div>
      </main>
      <div class="crt-menu finale-menu tv-element"><div class="crt-menu-heading"><span data-crt-line>下一次放映</span><span data-crt-line>REPLAY</span></div>
        <div class="crt-entry-list finale-entry-list" role="group" aria-label="选择再次观看的方式，再次确认后执行" aria-describedby="finale-replay-help">
          <button class="crt-entry is-selected" data-finale-choice="rewatch" aria-pressed="true" disabled><span class="crt-cursor" aria-hidden="true">▸</span><span class="crt-entry-number" aria-hidden="true" data-crt-line>01</span><span class="crt-entry-copy"><b data-crt-line>再看一次</b><small data-crt-line>保留收集，回到开场</small></span><span class="crt-entry-state" aria-hidden="true" data-crt-line>KEEP</span></button>
          <button class="crt-entry" data-finale-choice="restart" aria-pressed="false" aria-label="重新开始，清空所有收集进度" disabled><span class="crt-cursor" aria-hidden="true">▸</span><span class="crt-entry-number" aria-hidden="true" data-crt-line>02</span><span class="crt-entry-copy"><b data-crt-line>重新开始</b><small data-crt-line>清空收集，回到开场</small></span><span class="crt-entry-state" aria-hidden="true" data-crt-line>NEW</span></button>
          <div class="crt-selection-frame" aria-hidden="true"><span class="crt-frame-lock"></span></div>
        </div>
        <p class="crt-key-hint"><span id="finale-replay-help" class="crt-confirm-hint" role="status" aria-live="polite" aria-atomic="true" data-crt-line>点击选择，再次点击确认</span></p>
      </div>
      <footer class="finale-footer tv-element"><div class="finale-tools"><button data-action="notebook" disabled><span data-crt-line>记忆册 05 / 05</span></button><button data-action="sound" data-finale-sound data-crt-line aria-pressed="${sound}" disabled>声音 ${sound ? '开' : '关'}</button></div><span data-crt-line>丰碑与铭记 · 成渝铁路工业遗产数字记忆馆</span></footer>
    </div>`)}</section>`;
}

/** The current page closes completely before the final broadcast ignites. */
export function mountTvFinale(container: HTMLElement, reduced: boolean, sounds: TvSounds, onConfirm: (action: 'rewatch' | 'restart') => void): () => void {
  const root = container.querySelector<HTMLElement>('.tv-finale')!;
  const signal = root.querySelector<HTMLElement>('.crt-signal')!;
  const startup = root.querySelector('.crt-startup')!;
  const ignition = root.querySelector('.crt-ignition')!;
  const phosphor = root.querySelector('.crt-phosphor')!;
  const buttons = [...signal.querySelectorAll<HTMLButtonElement>('button')];
  const entries = [...signal.querySelectorAll<HTMLButtonElement>('.crt-entry')];
  const entryList = root.querySelector<HTMLElement>('.finale-entry-list')!;
  const selectionFrame = entryList.querySelector<HTMLElement>('.crt-selection-frame')!;
  const frameLock = selectionFrame.querySelector('.crt-frame-lock')!;
  const help = root.querySelector<HTMLElement>('.crt-confirm-hint')!;
  let selected = entries[0];
  let armed: HTMLButtonElement | null = null;
  let frameShown = false;
  let committing = false;
  let hovered: HTMLButtonElement | null = null;
  const lines = [...signal.querySelectorAll<HTMLElement>('[data-crt-line]')];
  const letters = lines.flatMap(crtLetters);
  signal.querySelectorAll<HTMLElement>('.finale-credit-roll b,.finale-credit-roll p>span').forEach(crtLetters);
  const disposeLens = mountCrtLens(root);
  const drawNoise = createCrtNoise(root, reduced);
  let disposed = false;
  let ready = false;
  let entry: gsap.core.Timeline;
  let credits: gsap.core.Timeline | null = null;
  const overPaper = root.classList.contains('is-over-paper');
  const bootAt = overPaper ? .7 : 0;
  const picture = root.querySelector('.crt-picture')!;
  const curve = root.querySelector('.crt-curve')!;
  const finish = () => {
    if (disposed) return;
    ready = true;
    root.classList.add('is-ready');
    root.setAttribute('aria-busy', 'false');
    signal.inert = false;
    signal.removeAttribute('aria-hidden');
    buttons.forEach(button => { button.disabled = false; });
    credits?.play();
    placeFrame();
  };
  function clearPaper() {
    root.querySelector('.finale-paper-underlay')?.remove();
    root.classList.remove('is-over-paper');
  }
  const context = gsap.context(() => {
    gsap.set(signal, { opacity: 0 });
    gsap.set(startup, { opacity: overPaper ? 0 : 1 });
    gsap.set(selectionFrame, { autoAlpha: 0 });
    gsap.set(frameLock, { opacity: 0, x: 0 });
    if (overPaper) {
      gsap.set(root, { backgroundColor: '#030805' });
      gsap.set([picture, curve], { opacity: 0 });
    }
    gsap.set(ignition, { opacity: 0, scaleX: .04 });
    gsap.set(phosphor, { opacity: 0, scaleY: .015 });
    entry = gsap.timeline({ paused: true, onComplete: finish });
    if (reduced) {
      entry.call(sounds.powerOn).set(startup, { autoAlpha: 0 }).set(root.querySelector('.crt-picture'), { opacity: 1 }).set(signal, { opacity: 1 }).call(clearPaper).call(sounds.ambience);
      return;
    }
    gsap.set(letters, { opacity: 0 });
    gsap.set(root.querySelectorAll('.finale-credit-window,.crt-cursor'), { opacity: 0 });
    if (overPaper) {
      // Close the entire captured page into a trace before starting the new signal.
      entry.to(root.querySelector('.finale-paper-underlay'), { scaleY: .006, transformOrigin: '50% 50%', duration: .38, ease: 'power2.in' }, 0)
        .set(ignition, { opacity: .65, scaleX: 1.35 }, .32)
        .set(startup, { opacity: 1 }, .4)
        .set([picture, curve], { opacity: 1 }, .4)
        .call(clearPaper, [], .4)
        .to(ignition, { scaleX: .025, duration: .18, ease: 'power2.in' }, .4)
        .to(ignition, { opacity: 0, duration: .08 }, .58);
    }
    entry.call(sounds.powerOn, [], bootAt + .08)
      .to(ignition, { opacity: .72, scaleX: 1, duration: .22, ease: 'power2.out' }, bootAt + .12)
      .to(phosphor, { opacity: .42, scaleY: .16, duration: .3, ease: 'sine.out' }, bootAt + .2)
      .to(startup, { opacity: .88, duration: .25, ease: 'sine.in' }, bootAt + .3)
      .to(ignition, { opacity: 0, duration: .65, ease: 'sine.out' }, bootAt + .34)
      .to(phosphor, { opacity: .18, scaleY: 1, duration: .65, ease: 'power1.out' }, bootAt + .5)
      .to(startup, { opacity: 0, duration: 1, ease: 'sine.inOut' }, bootAt + .55)
      .to(phosphor, { opacity: 0, duration: .45, ease: 'sine.out' }, bootAt + 1.15)
      .set(startup, { visibility: 'hidden' }, bootAt + 1.62)
      .set(signal, { opacity: 1 }, bootAt + .94)
      .call(sounds.ambience, [], bootAt + 1.6);
    const reveal = (selector: string, at: number, stagger = .025) => {
      root.querySelectorAll<HTMLElement>(selector).forEach(line => revealCrtLine(entry, line, bootAt + at, .28, stagger));
    };
    reveal('.crt-heading>span', 1.0, .018);
    reveal('.finale-era', 1.15, .028);
    reveal('.finale-title>span', 1.3, .08);
    reveal('.finale-title>strong', 1.62, .075);
    reveal('.finale-broadcast-copy>span', 1.98, .022);
    reveal('.finale-credits>span', 2.25);
    reveal('.finale-inscription', 2.42, .035);
    reveal('.finale-endmark', 2.7, .14);
    reveal('.finale-menu [data-crt-line]', 2.92, .018);
    reveal('.finale-footer [data-crt-line]', 3.08, .012);
    entry.to(root.querySelector('.finale-credit-window'), { opacity: 1, duration: .4 }, bootAt + 2.4)
      .to(root.querySelectorAll('.crt-cursor'), { opacity: 1, duration: .2 }, bootAt + 3.15);
    const roll = root.querySelector<HTMLElement>('.finale-credit-roll')!;
    const count = roll.children.length - 1;
    credits = gsap.timeline({ paused: true, repeat: -1 });
    for (let index = 0; index < count; index++) {
      credits.to(roll, { y: -(index + 1) * 28, duration: .7, ease: 'power1.inOut' }, 2.6 + index * 3.3);
    }
  }, root);
  const writeLine = (element: HTMLElement, text: string) => {
    if (element.textContent === text) return;
    gsap.killTweensOf(element.querySelectorAll('.crt-letter'));
    element.textContent = text;
    element.classList.remove('crt-glitch-line');
    if (reduced) crtLetters(element);
    else context.add(() => revealCrtLine(gsap.timeline(), element, 0, .22, .018));
  };
  function placeFrame(animate = false) {
    if (disposed) return;
    context.add(() => {
      gsap.set(selectionFrame, { height: selected.offsetHeight + 8 });
      gsap.to(selectionFrame, { y: selected.offsetTop - 4, duration: animate && !reduced ? .38 : 0, ease: 'power3.out', overwrite: 'auto' });
    });
  }
  const updateSelection = () => {
    entries.forEach(button => {
      button.classList.toggle('is-selected', button === selected);
      button.classList.toggle('is-armed', button === armed);
      button.setAttribute('aria-pressed', String(button === selected));
      writeLine(button.querySelector<HTMLElement>('.crt-entry-copy>small')!, button === armed
        ? button.dataset.finaleChoice === 'restart' ? '再次确认，清空收集重看' : '再次确认，保留收集重看'
        : button.dataset.finaleChoice === 'restart' ? '清空收集，回到开场' : '保留收集，回到开场');
    });
    writeLine(help, armed ? `已选${armed.dataset.finaleChoice === 'restart' ? '重新开始' : '再看一次'}，再次确认` : '点击选择，再次点击确认');
  };
  const choose = (button: HTMLButtonElement) => {
    if (selected === button) return;
    selected = button;
    armed = null;
    updateSelection();
    placeFrame(frameShown);
  };
  const showFrame = () => {
    if (frameShown) return;
    frameShown = true;
    placeFrame();
    context.add(() => {
      gsap.set(selectionFrame, { autoAlpha: 1 });
      if (reduced) { gsap.set(frameLock, { opacity: 1 }); return; }
      gsap.timeline().set(frameLock, { opacity: 1, x: -2 }, 0)
        .set(frameLock, { opacity: 0 }, .055)
        .set(frameLock, { opacity: 1, x: 2 }, .12)
        .set(frameLock, { opacity: 0 }, .175)
        .set(frameLock, { opacity: 1, x: 0 }, .25);
    });
  };
  const preview = (button: HTMLButtonElement | null) => {
    entryList.classList.toggle('is-previewing', button !== null);
    entries.forEach(entry => entry.classList.toggle('is-previewed', entry === button));
  };
  const onHover = (event: PointerEvent) => {
    if (!ready || committing || root.classList.contains('is-leaving') || event.pointerType === 'touch') return;
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || (event.relatedTarget instanceof Node && button.contains(event.relatedTarget))) return;
    if (button.matches('.crt-entry')) { hovered = button; preview(button); }
    sounds.hover();
  };
  const onOut = (event: PointerEvent) => {
    const button = (event.target as Element).closest('button');
    if (button && !(event.relatedTarget instanceof Node && button.contains(event.relatedTarget))) {
      if (button.matches('.crt-entry')) { hovered = null; preview(null); }
      sounds.stopHover();
    }
  };
  const onFocus = (event: FocusEvent) => {
    const button = event.target as HTMLButtonElement;
    if (!ready || committing || !button.matches('button:focus-visible') || root.classList.contains('is-leaving')) return;
    if (button.matches('.crt-entry')) choose(button);
    if (hovered !== button) sounds.hover();
  };
  const onClick = (event: MouseEvent) => {
    if (!ready || committing || root.classList.contains('is-leaving')) return;
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button) return;
    sounds.click();
    if (!button.matches('.crt-entry')) return;
    if (armed === button && selected === button) {
      committing = true;
      root.setAttribute('aria-busy', 'true');
      context.add(() => gsap.delayedCall(.26, () => {
        if (!disposed) onConfirm(button.dataset.finaleChoice as 'rewatch' | 'restart');
      }));
      return;
    }
    choose(button);
    armed = button;
    updateSelection();
    showFrame();
  };
  const onKey = (event: KeyboardEvent) => {
    if (!ready || committing || root.classList.contains('is-leaving')) return;
    if (event.repeat && ['Enter', ' '].includes(event.key)) { event.preventDefault(); return; }
    if (event.key === 'Escape') { armed = null; updateSelection(); return; }
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    preview(null);
    const index = entries.indexOf(selected);
    const next = entries[(index + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length];
    choose(next);
    next.focus({ preventScroll: true });
  };
  const frameResize = new ResizeObserver(() => placeFrame());
  frameResize.observe(entryList);
  const freezeSignal = () => { entry.pause(); credits?.pause(); sounds.stopHover(); };
  root.addEventListener('crt:leave', freezeSignal);
  const syncPlayback = () => {
    if (disposed) return;
    if (document.hidden) { entry.pause(); credits?.pause(); }
    else if (!root.classList.contains('is-leaving')) { entry.resume(); if (ready) credits?.resume(); }
  };
  root.addEventListener('pointerover', onHover);
  root.addEventListener('pointerout', onOut);
  root.addEventListener('focusin', onFocus);
  root.addEventListener('focusout', sounds.stopHover);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', syncPlayback);
  gsap.ticker.add(drawNoise);
  void sounds.ready().catch(() => {}).then(() => { if (!disposed) syncPlayback(); });
  return () => {
    disposed = true;
    gsap.ticker.remove(drawNoise);
    frameResize.disconnect();
    disposeLens();
    context.revert();
    sounds.stopHover();
    root.removeEventListener('pointerover', onHover);
    root.removeEventListener('pointerout', onOut);
    root.removeEventListener('focusin', onFocus);
    root.removeEventListener('focusout', sounds.stopHover);
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKey);
    root.removeEventListener('crt:leave', freezeSignal);
    document.removeEventListener('visibilitychange', syncPlayback);
  };
}
