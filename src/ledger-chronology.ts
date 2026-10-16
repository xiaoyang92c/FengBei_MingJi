import gsap from 'gsap';

function splitChronologyText(element: HTMLElement) {
  const text = element.textContent ?? '';
  element.setAttribute('aria-label', text);
  element.replaceChildren(...Array.from(text, character => {
    const span = document.createElement('span');
    span.className = 'chronology-char';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = character;
    return span;
  }));
  return [...element.querySelectorAll<HTMLElement>('.chronology-char')];
}

/** Scroll reveals the chronology; each story clears its letters before the next is printed. */
export function createChronology(paper: HTMLElement, reduced: boolean) {
  const section = paper.querySelector<HTMLElement>('#ledger-dates')!;
  const stage = section.querySelector<HTMLElement>('.ledger-chronology')!;
  const heading = section.querySelector<HTMLElement>('.chronology-heading')!;
  const yearRow = stage.querySelector<HTMLElement>('.chronology-years')!;
  const years = [...stage.querySelectorAll<HTMLElement>('.chronology-year')];
  const stories = [...stage.querySelectorAll<HTMLElement>('.chronology-story')];
  const storyWindow = stage.querySelector<HTMLElement>('.chronology-story-window')!;
  const svg = stage.querySelector('svg')!;
  const track = stage.querySelector<SVGPathElement>('.chronology-track')!;
  const ink = stage.querySelector<SVGPathElement>('.chronology-ink')!;
  const stops = [...stage.querySelectorAll<SVGCircleElement>('.chronology-stop')];
  const context = gsap.context(() => {}, section);
  const progress = { value: reduced ? 1 : 0 };
  const entrances: { element: Element; timeline: gsap.core.Timeline; started: boolean }[] = [];
  let measured = false;
  let disposed = false;
  let cycle: gsap.core.Timeline | null = null;
  const paint = () => {
    ink.style.strokeDashoffset = String(1 - progress.value);
    stops.forEach((stop, index) => {
      stop.classList.toggle('is-reached', progress.value + .001 >= index / (stops.length - 1));
    });
  };
  const setActive = (index: number) => {
    years.forEach((year, position) => {
      year.classList.toggle('is-active', position === index);
      if (position === index) year.setAttribute('aria-current', 'step');
      else year.removeAttribute('aria-current');
      stories[position].setAttribute('aria-hidden', String(position !== index));
    });
  };
  const measure = () => {
    const width = stage.clientWidth;
    if (!width) return;
    measured = true;
    const points = years.map(year => year.offsetLeft + year.offsetWidth / 2);
    svg.setAttribute('viewBox', `0 0 ${width} 38`);
    const path = `M${points[0]} 19H${points.at(-1)}`;
    track.setAttribute('d', path);
    track.setAttribute('pathLength', '1');
    ink.setAttribute('d', path);
    stops.forEach((stop, index) => { stop.setAttribute('cx', String(points[index])); stop.setAttribute('cy', '19'); });
    paint();
  };
  const update = () => {
    if (disposed || reduced || !measured) return;
    const viewport = paper.getBoundingClientRect();
    const top = viewport.top + paper.querySelector<HTMLElement>('.ledger-tabs')!.offsetHeight;
    const canPlay = !paper.inert && !document.hidden;
    entrances.forEach(entry => {
      const bounds = entry.element.getBoundingClientRect();
      const visible = canPlay && bounds.top < viewport.bottom - 24 && bounds.bottom > top;
      if (visible) {
        entry.started = true;
        entry.timeline.resume();
      } else if (canPlay && bounds.bottom <= top && entry.timeline.progress() < 1) {
        // Scrolling past a partly printed heading must not hold up the story loop.
        entry.started = true;
        entry.timeline.progress(1);
      } else entry.timeline.pause();
    });
    const bounds = storyWindow.getBoundingClientRect();
    const ready = entrances.every(entry => entry.timeline.progress() === 1);
    if (canPlay && ready && bounds.top < viewport.bottom - 24 && bounds.bottom > top) cycle?.resume();
    else cycle?.pause();
  };
  if (reduced) {
    stage.classList.add('is-static');
    stories.forEach(story => story.removeAttribute('aria-hidden'));
    years.forEach(year => { year.classList.remove('is-active'); year.removeAttribute('aria-current'); });
  } else context.add(() => {
    const entranceFor = (element: Element) => {
      const timeline = gsap.timeline({ paused: true, onComplete: update });
      entrances.push({ element, timeline, started: false });
      return timeline;
    };
    const printText = (timeline: gsap.core.Timeline, element: HTMLElement, at: number, stagger: number) => {
      const letters = splitChronologyText(element);
      gsap.set(letters, { clipPath: 'inset(0 100% 0 0)', y: 3 });
      timeline.to(letters, { clipPath: 'inset(0 0% 0 0)', y: 0, duration: .18, stagger, ease: 'power2.out' }, at);
      return letters;
    };
    const titleEntrance = entranceFor(heading);
    printText(titleEntrance, heading.querySelector<HTMLElement>('.ledger-section-label')!, 0, .025);
    printText(titleEntrance, heading.querySelector('h2')!, .3, .065);
    const yearsEntrance = entranceFor(yearRow);
    years.forEach((year, index) => {
      year.querySelectorAll<HTMLElement>('b,time,span').forEach((text, row) => {
        printText(yearsEntrance, text, index * .2 + row * .16, .04);
      });
    });
    gsap.set(svg, { opacity: 1 });
    gsap.set(stops, { attr: { r: 0 } });
    const routeEntrance = entranceFor(svg);
    routeEntrance.to(track, { strokeDashoffset: 0, duration: .85, ease: 'power2.inOut' }, 0);
    stops.forEach((stop, index) => {
      routeEntrance.to(stop, { attr: { r: index === 0 ? 4 : 2.5 }, duration: .3, ease: 'power2.out' }, index * .3);
    });
    const storyEntrance = entranceFor(storyWindow);
    const storyLetters = stories.map((story, index) => [...story.querySelectorAll<HTMLElement>('.chronology-story-date,h3,p')].flatMap((text, row) => {
      if (index === 0) return printText(storyEntrance, text, row * .28, row === 2 ? .022 : .04);
      const letters = splitChronologyText(text);
      gsap.set(letters, { clipPath: 'inset(0 100% 0 0)' });
      return letters;
    }));
    cycle = gsap.timeline({ paused: true, repeat: -1 });
    const hold = 4.4;
    years.forEach((_, index) => {
      const next = (index + 1) % years.length;
      const at = cycle!.duration() + hold;
      const erasedAt = at + .12 + (storyLetters[index].length - 1) * .018;
      const nextAt = erasedAt + .14;
      cycle!
        .to(storyLetters[index], { clipPath: 'inset(0 0 0 100%)', duration: .12, stagger: .018, ease: 'none' }, at)
        .fromTo(storyLetters[next], { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: .16, stagger: .028, ease: 'none', immediateRender: false }, nextAt)
        .to(progress, { value: next / (years.length - 1), duration: .85, ease: 'power2.inOut', onUpdate: paint }, erasedAt)
        .to(stops[index], { attr: { r: 2.5 }, duration: .3 }, erasedAt)
        .to(stops[next], { attr: { r: 4 }, duration: .3 }, erasedAt + .5)
        .call(() => setActive(next), [], nextAt);
    });
  });
  document.addEventListener('visibilitychange', update);
  return { measure, update, dispose: () => {
    disposed = true;
    document.removeEventListener('visibilitychange', update);
    context.revert();
  } };
}
