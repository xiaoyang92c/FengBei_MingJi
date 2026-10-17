import gsap from 'gsap';
import { createPaperFold } from './paper-fold';
import { createChronology } from './ledger-chronology';
import { mountLedgerWords } from './ledger-words';

function splitLine(element: HTMLElement) {
  element.setAttribute('aria-label', element.textContent ?? '');
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach(node => {
    const fragment = document.createDocumentFragment();
    for (const character of Array.from(node.data)) {
      const span = document.createElement('span');
      span.className = 'typeset-char';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = character;
      fragment.append(span);
    }
    node.replaceWith(fragment);
  });
}

/** Newspaper fold, typesetting and local reading navigation share one lifecycle. */
export function mountMemoryLedger(paper: HTMLElement, reduced: boolean, onReady?: () => void): () => void {
  let disposed = false;
  let opened = false;
  let words: ReturnType<typeof mountLedgerWords> | null = null;
  let frame = 0;
  let packet: ReturnType<typeof createPaperFold> | null = null;
  let jump: gsap.core.Tween | null = null;
  let opening: gsap.core.Timeline | null = null;
  const context = gsap.context(() => {}, paper.parentElement!);
  const sections = ['ledger-front', 'ledger-records', 'ledger-dates', 'notebook-finale']
    .map(id => paper.querySelector<HTMLElement>(`#${id}`)!);
  const tabs = [...paper.querySelectorAll<HTMLButtonElement>('.ledger-tabs [data-ledger-target]')];
  const chronology = createChronology(paper, reduced);
  const observer = new IntersectionObserver(entries => {
    if (disposed || !opened) return;
    context.add(() => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const element = entry.target as HTMLElement;
      if (element.hasAttribute('data-typeset')) {
        const letters = element.querySelectorAll('.typeset-char');
        gsap.to(letters, { opacity: 1, y: 0, duration: .38, stagger: Math.min(.028, .8 / Math.max(1, letters.length)), ease: 'power2.out', clearProps: 'transform,opacity' });
      } else if (element.matches('.press-record')) {
        const title = element.querySelectorAll('.press-record-heading .typeset-char');
        const description = element.querySelectorAll('.press-record-lead .typeset-char');
        gsap.timeline()
          .to(title, { opacity: 1, y: 0, duration: .16, stagger: .065, ease: 'power2.out', clearProps: 'transform,opacity' }, 0)
          .to(description, { opacity: 1, y: 0, duration: .12, stagger: .028, ease: 'power1.out', clearProps: 'transform,opacity' }, '>-.04')
          .to(element.querySelector('.press-record-rule'), { scaleX: 1, duration: .65, ease: 'power2.out' }, 0);
      } else if (element.matches('.press-ending')) {
        gsap.fromTo(element.querySelector('.ending-rule'), { scaleX: 0 }, { scaleX: 1, duration: .85, ease: 'power2.inOut' });
      }
      observer.unobserve(element);
    }));
  }, { root: paper, threshold: .12 });

  const updatePosition = () => {
    frame = 0;
    if (disposed) return;
    const viewport = paper.getBoundingClientRect();
    const line = viewport.top + Math.min(160, paper.clientHeight * .25);
    const range = paper.scrollHeight - paper.clientHeight;
    const pageProgress = range > 0 ? Math.min(1, paper.scrollTop / range) : 1;
    let active = sections[0];
    for (const section of sections) if (section.getBoundingClientRect().top <= line) active = section;
    // The last leaf can be shorter than the scroll viewport.
    if (range > 0 && paper.scrollTop >= range - 3 && sections.at(-1)!.getBoundingClientRect().top <= viewport.top + paper.clientHeight * .55) active = sections[sections.length - 1];
    paper.style.setProperty('--ledger-page', String(pageProgress));
    chronology.update();
    words?.update();
    tabs.forEach(tab => {
      if (tab.dataset.ledgerTarget === active.id) tab.setAttribute('aria-current', 'location');
      else tab.removeAttribute('aria-current');
    });
  };
  const schedulePosition = () => { if (!frame) frame = requestAnimationFrame(updatePosition); };
  const onNavigate = (event: MouseEvent) => {
    const record = (event.target as Element).closest<HTMLElement>('.press-record');
    if (opened && record) { record.classList.add('is-opening'); return; }
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-ledger-target]');
    if (!opened || !button) return;
    const target = paper.querySelector<HTMLElement>(`#${button.dataset.ledgerTarget}`);
    if (!target) return;
    jump?.kill();
    gsap.killTweensOf(paper, 'scrollTop');
    const offset = paper.querySelector<HTMLElement>('.ledger-tabs')!.offsetHeight + 20;
    const destination = gsap.utils.clamp(0, paper.scrollHeight - paper.clientHeight,
      paper.scrollTop + target.getBoundingClientRect().top - paper.getBoundingClientRect().top - offset);
    jump = gsap.to(paper, {
      scrollTop: destination, duration: reduced ? 0 : .85, ease: 'power2.inOut', overwrite: 'auto',
      onComplete: () => { if (!disposed) { target.focus({ preventScroll: true }); updatePosition(); } },
    });
  };
  const cancelJump = () => { jump?.kill(); };
  paper.addEventListener('click', onNavigate);
  paper.addEventListener('scroll', schedulePosition, { passive: true });
  paper.addEventListener('wheel', cancelJump, { passive: true });
  paper.addEventListener('touchstart', cancelJump, { passive: true });
  sections.forEach(section => { section.tabIndex = -1; });
  const resize = new ResizeObserver(() => { chronology.measure(); schedulePosition(); });
  resize.observe(paper);
  resize.observe(paper.querySelector('.press-body')!);

  const finishOpening = () => {
    if (opened || disposed) return;
    opened = true;
    paper.inert = false;
    paper.setAttribute('aria-busy', 'false');
    if (packet) packet.handoff();
    else context.add(() => gsap.set(paper, { visibility: 'visible' }));
    if (!reduced) context.add(() => {
      const viewport = paper.getBoundingClientRect();
      paper.querySelectorAll<HTMLElement>('[data-typeset]').forEach(element => {
        // Already printed on the unfolding paper; the picture never re-enters.
        if (element.getBoundingClientRect().top < viewport.bottom - 12) return;
        splitLine(element);
        gsap.set(element.querySelectorAll('.typeset-char'), { opacity: 0, y: 5 });
        observer.observe(element);
      });
      paper.querySelectorAll<HTMLElement>('.press-record,.press-ending').forEach(element => {
        if (element.matches('.press-record')) {
          const title = element.querySelector<HTMLElement>('.press-record-heading>strong')!;
          const description = element.querySelector<HTMLElement>('.press-record-lead')!;
          splitLine(title);
          splitLine(description);
          gsap.set(title.querySelectorAll('.typeset-char'), { opacity: 0, y: 4 });
          gsap.set(description.querySelectorAll('.typeset-char'), { opacity: 0, y: 3 });
          gsap.set(element.querySelector('.press-record-rule'), { scaleX: 0 });
        }
        observer.observe(element);
      });
    });
    words = mountLedgerWords(paper, reduced);
    chronology.measure();
    updatePosition();
    onReady?.();
  };
  const finishOnResize = () => { opening?.progress(1); finishOpening(); schedulePosition(); };
  window.addEventListener('resize', finishOnResize, { passive: true });
  if (reduced) finishOpening();
  else {
    const openingPacket = createPaperFold(paper);
    packet = openingPacket;
    paper.inert = true;
    paper.setAttribute('aria-busy', 'true');
    context.add(() => {
      paper.classList.add('paper-is-folding');
      openingPacket.motion.angle = 180;
      openingPacket.render();
      opening = gsap.timeline({ onComplete: finishOpening })
        .fromTo(openingPacket.fold, { y: -paper.offsetTop - openingPacket.height / 2 - 40 }, { y: 0, duration: .6, ease: 'power3.out' })
        .to(openingPacket.motion, { angle: 0, duration: .9, ease: 'power2.inOut', onUpdate: openingPacket.render }, .52);
    });
  }
  updatePosition();
  void document.fonts.ready.then(() => { if (!disposed) { chronology.measure(); schedulePosition(); } });
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    resize.disconnect();
    jump?.kill();
    chronology.dispose();
    words?.dispose();
    context.revert();
    packet?.dispose();
    paper.removeEventListener('click', onNavigate);
    paper.removeEventListener('scroll', schedulePosition);
    paper.removeEventListener('wheel', cancelJump);
    paper.removeEventListener('touchstart', cancelJump);
    window.removeEventListener('resize', finishOnResize);
  };
}
