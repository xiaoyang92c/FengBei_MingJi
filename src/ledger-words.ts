import gsap from 'gsap';

/** Quiet loops describe the words while retaining the existing character entrance. */
export function mountLedgerWords(paper: HTMLElement, reduced: boolean) {
  const loops: { element: HTMLElement; timeline: gsap.core.Timeline }[] = [];
  const context = gsap.context(() => {}, paper);
  const ink = getComputedStyle(paper).getPropertyValue('--press-ink').trim() || '#292b27';
  const red = getComputedStyle(paper).getPropertyValue('--press-red').trim() || '#a23727';
  let disposed = false;
  if (!reduced) context.add(() => {
    const soundTitle = paper.querySelector<HTMLElement>('.memory-sound-title')!;
    const hammer = soundTitle.querySelector('.memory-hammer-word')!;
    const train = soundTitle.querySelector('.memory-train-word')!;
    const glyphs = train.querySelectorAll('.memory-note-glyph');
    gsap.set(hammer, { transformOrigin: '50% 100%' });
    const sound = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 2.2 });
    [.4, 1.35].forEach(at => {
      sound.to(hammer, { y: -6, scaleY: 1.035, duration: .32, ease: 'power2.out' }, at)
        .to(hammer, { y: 1, scaleY: .94, duration: .13, ease: 'power3.in' }, at + .32)
        .to(hammer, { y: 0, scaleY: 1, duration: .26, ease: 'back.out(1.4)' }, at + .45);
    });
    sound.to(train, { color: red, duration: .4 }, 2.5)
      .to(glyphs, { y: -3, scaleY: 1.045, duration: .34, stagger: .12, ease: 'sine.out' }, 2.5)
      .to(glyphs, { y: 0, scaleY: 1, duration: .55, stagger: .12, ease: 'sine.inOut' }, 3.15)
      .to(train, { color: ink, duration: .6 }, 3.45);
    loops.push({ element: soundTitle, timeline: sound });

    const endingTitle = paper.querySelector<HTMLElement>('.memory-ending-title')!;
    const firstLine = endingTitle.querySelector('.memory-ending-line')!;
    const settledLetters = firstLine.querySelectorAll('.memory-ending-glyph');
    gsap.set(settledLetters, { transformOrigin: '50% 85%' });
    const people = endingTitle.querySelector('.memory-people-word')!;
    const rule = people.querySelector('.memory-people-rule')!;
    const ending = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 2.6 });
    ending.to(settledLetters, { y: -3, rotation: index => index % 2 ? 2 : -2, scaleY: 1.04, duration: .24, stagger: .09, ease: 'power2.out' }, .2)
      .to(settledLetters, { y: 1, rotation: 0, scaleY: .95, duration: .12, stagger: .09, ease: 'power2.in' }, .54)
      .to(settledLetters, { y: 0, scaleY: 1, duration: .45, stagger: .09, ease: 'back.out(1.7)' }, .72)
      .to(people, { color: red, duration: .7, ease: 'sine.inOut' }, 1.5)
      .to(rule, { scaleX: 1, duration: 1.1, ease: 'power2.inOut' }, 1.8)
      .set(rule, { transformOrigin: '100% 50%' }, 4.75)
      .to(rule, { scaleX: 0, duration: .85, ease: 'power2.inOut' }, 4.75)
      .to(people, { color: ink, duration: .65, ease: 'sine.inOut' }, 4.9)
      .set(rule, { transformOrigin: '0 50%' });
    loops.push({ element: endingTitle, timeline: ending });
  });
  const update = () => {
    if (disposed || reduced) return;
    const viewport = paper.getBoundingClientRect();
    const top = viewport.top + paper.querySelector<HTMLElement>('.ledger-tabs')!.offsetHeight;
    loops.forEach(({ element, timeline }) => {
      const bounds = element.getBoundingClientRect();
      if (!document.hidden && !paper.inert && bounds.top < viewport.bottom - 20 && bounds.bottom > top + 10) timeline.resume();
      else timeline.pause();
    });
  };
  document.addEventListener('visibilitychange', update);
  update();
  return { update, dispose: () => {
    disposed = true;
    document.removeEventListener('visibilitychange', update);
    context.revert();
  } };
}
