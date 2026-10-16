import gsap from 'gsap';
import type { ClueId } from './content';

/** A single, flat side elevation is shared by both railway illustrations. */
function steamTrain(className: string) {
  const coaches = [-65, -143];
  const mineralWagons = [-221, -299];
  const wheels = [{ x: 26, y: 89, r: 9 }, { x: 52, y: 89, r: 9 }, { x: 78, y: 89, r: 9 }, { x: 100, y: 94, r: 4 },
    ...[...coaches, ...mineralWagons].flatMap(x => [{ x: x + 15, y: 92, r: 6 }, { x: x + 53, y: 92, r: 6 }])];
  return `<g class="steam-engine ${className}">
    ${coaches.map(x => `<g class="train-coach"><path d="M${x} 48h68v33h-68ZM${x-2} 48v-3q36-9 72 0v3ZM${x-2} 81h72v5h-72Z"/><path class="train-detail" d="M${x+70} 82h6M${x+56} 81V52h8v29M${x+3} 72h50"/>${Array.from({length:5},(_,i) => `<path class="coach-window" d="M${x+7+i*10} 55h7v11h-7Z"/>`).join('')}</g>`).join('')}
    ${mineralWagons.map(x => `<g class="train-mineral-wagon"><path d="M${x} 64h68v17h-68ZM${x-2} 81h72v5h-72Z"/><path class="train-coal" d="m${x+2} 64 7-8 9 3 9-8 10 6 9-4 9 7 9 4Z"/><path class="train-detail" d="M${x+70} 82h6M${x+13} 68v10m21-10v10m21-10v10"/></g>`).join('')}
    <path class="train-detail" d="M5 82h5"/>
    <path d="M13 78V34h25v44M8 29h35v5H8Z"/><path d="M19 41h13v18H19Z"/>
    <path d="M38 50h47a7 7 0 0 1 7 7v21H38ZM48 50v-7a4 4 0 0 1 8 0v7M74 50V36h8v14M71 32h14v4H71Z"/>
    <path class="train-detail" d="M58 52v24m20-24v24M43 70h43M87 59h5"/>
    <path d="M10 78h87v6H10ZM96 78l14 18H96Z"/><path class="train-detail" d="m100 85 6 11"/>
    ${wheels.map(wheel => `<g class="train-wheel" data-wheel-x="${wheel.x}" data-wheel-y="${wheel.y}" data-wheel-radius="${wheel.r}"><circle cx="${wheel.x}" cy="${wheel.y}" r="${wheel.r}"/><path d="M${wheel.x-wheel.r*.65} ${wheel.y}h${wheel.r*1.3}m-${wheel.r*.65}-${wheel.r*.65}v${wheel.r*1.3}"/></g>`).join('')}
    <path class="train-rod" d="M31 89H83"/><path class="train-smoke" d="M78 23c-6-5-13 2-19-3s-10-7-16-4m20-4c-5-5-12 1-17-4"/>
  </g>`;
}

function animateTrain(train: Element, trigger: { trigger: HTMLElement; scroller: HTMLElement; start: string; toggleActions: string }, from: number, to: number, duration: number, repeatDelay: number, scale = 1) {
  const wheels = [...train.querySelectorAll<SVGGElement>('.train-wheel')];
  const rod = train.querySelector('.train-rod')!;
  const travel = { x: from };
  const update = () => {
    const distance = (travel.x - from) / scale;
    train.setAttribute('transform', `translate(${travel.x} 0)`);
    wheels.forEach(wheel => wheel.setAttribute('transform', `rotate(${distance / Number(wheel.dataset.wheelRadius) * 180 / Math.PI} ${wheel.dataset.wheelX} ${wheel.dataset.wheelY})`));
    const dx = Math.cos(distance / 9) * 5;
    const y = 89 + Math.sin(distance / 9) * 5;
    rod.setAttribute('d', `M${26 + dx} ${y}H${78 + dx}`);
  };
  update();
  // At either end, even the tender and smoke are outside the clipped viewport.
  gsap.to(travel, { x: to, duration, repeatDelay, ease: 'none', repeat: -1, onUpdate: update, scrollTrigger: trigger });
  gsap.to(train.querySelector('.train-smoke'), { opacity: .25, y: -3, duration: .9, repeat: -1, yoyo: true, ease: 'sine.inOut', scrollTrigger: trigger });
}

/** Shared drawing coordinates keep contact points and their callouts in agreement. */
export function illustration(id: ClueId) {
  switch (id) {
    case 'tools': return `<svg class="dispatch-sketch tool-sketch" viewBox="0 0 360 230" aria-hidden="true">
      <path class="ink-path rock-line" d="M16 207 45 193 78 201 112 187 150 194 176 184 208 202 240 193 272 202 302 186 344 204M150 194l-9 9 8 6-4 8m5-23 13 9 6 11"/>
      <g class="tool-chisel"><path d="M144 100h12l-2 81-4 13-4-13Z"/><path d="M141 94h18v6h-18Z"/><path class="tool-detail" d="M150 104v68"/></g>
      <g class="tool-hammer"><path class="hammer-handle" d="M150 71h135v10H150Z"/><path class="hammer-head" d="M134 58h32v36h-32Z"/><path class="tool-detail" d="M140 59v34m20-34v34M145 71h10v10h-10Z"/></g>
      <g class="stone-chips"><path d="m135 188-8-5m13-7-1-8m20 14 6-8"/></g>
      <text x="26" y="137">钢钎</text><path class="annotation chisel-pointer" d="M64 133H101L144 137"/><circle class="annotation chisel-pointer-dot" cx="144" cy="137" r="1.8"/>
      <text x="285" y="44">大锤</text><path class="annotation hammer-pointer" d="M284 49H263L166 60"/><circle class="annotation hammer-pointer-dot" cx="166" cy="60" r="1.8"/>
    </svg><div class="figure-footnote">锤面落在钎尾，钎尖抵住石头</div>`;
    case 'together': return `<div class="crew-names"><span><i class="crew-key crew-key-solid" aria-hidden="true"></i>解放军</span><small>一起修路</small><span><i class="crew-key" aria-hidden="true"></i>民工</span></div><svg class="dispatch-sketch crew-sketch" viewBox="0 0 360 240" aria-hidden="true">
      <g class="crew-track"><g class="rail-sleepers">${Array.from({length:12},(_,i) => `<path d="M${22+i*28} 96h10v48h-10Z"/>`).join('')}</g><path d="M16 106h328v5H16Zm0 23h328v5H16Z"/><g class="rail-joint"><path d="M167 104h26v9h-26Zm0 23h26v9h-26Z"/><circle cx="173" cy="108.5" r="1.5"/><circle cx="187" cy="108.5" r="1.5"/><circle cx="173" cy="131.5" r="1.5"/><circle cx="187" cy="131.5" r="1.5"/></g></g>
      ${Array.from({length:24},(_,index) => {
        const team = index < 12 ? 'soldier' : 'civilian';
        const station = index % 12;
        const x = 42 + station * 25;
        const y = team === 'soldier' ? 85 : 156;
        return `<g class="crew-person crew-${team}" data-worker="${index}" data-station-x="${x}" transform="translate(${x} ${y})"><circle class="crew-work-ring" r="8"/><g class="crew-person-core"><circle r="3.4"/><path class="crew-tool" d="${team === 'soldier' ? 'M4 5l4 8m-7-1 7-2' : 'M-4-5l-4-8m-3 2 7-2'}"/></g></g>`;
      }).join('')}
    </svg><div class="figure-footnote">一段接一段，把路接起来</div>`;
    case 'opening': return `<div class="opening-dates"><span><b>1950</b><small>6月15日 · 开工</small></span><i aria-hidden="true">→</i><span><b>1952</b><small>7月1日 · 全线通车</small></span></div><svg class="dispatch-sketch train-sketch" viewBox="0 0 360 125" aria-hidden="true">
      <defs><clipPath id="opening-rail-window" clipPathUnits="userSpaceOnUse"><rect width="360" height="125"/></clipPath></defs>
      <g class="opening-landscape"><path d="M0 79 27 57 45 65 76 31 104 58 122 48 154 77 184 61 210 79M45 65l12-4 19-30 13 23 15 4M7 86l29-8 32 9 33-7 31 7 41-5 35 6"/><path d="M19 98V43m-6 6h12m-12 5h12M19 49q67 19 133 0M152 98V43m-6 6h12m-12 5h12"/></g>
      <g class="opening-sign"><path d="M227 39h72v18h-72ZM236 57v41m54-41v41"/><text x="263" y="51" text-anchor="middle">成渝铁路</text></g>
      <g class="opening-pennant"><path d="M326 98V27m0 1h23l-6 7 6 7h-23"/></g>
      <path class="ink-path track-line" d="M0 98h360M0 104h360${Array.from({length:13},(_,i) => `M${12+i*28} 104v8`).join('')}"/>
      <g clip-path="url(#opening-rail-window)">${steamTrain('print-train')}</g></svg>`;
    case 'title': {
      const letters = Array.from('成渝铁路筑路民工纪念碑').map((letter,index) => `<span class="inscription-letter ${index >= 4 && index < 8 ? 'names-in-stone' : ''}">${letter}</span>`).join('');
      return `<div class="inscription-print" aria-label="成渝铁路筑路民工纪念碑">
        <div class="inscription-guide" aria-hidden="true"><div class="inscription-guide-item"><small>先读路名</small><b>成渝铁路</b></div><div class="inscription-guide-item"><small>再读修路的人</small><b>筑路民工</b></div><div class="inscription-guide-item"><small>为他们而立</small><b>纪念碑</b></div></div>
        <div class="inscription-rubbing" aria-hidden="true"><div class="rubbing-sheet"><div class="inscription-column">${letters}</div><i class="inscription-bracket"></i></div></div>
        <span class="inscription-side">南面 / 北面 · 碑名排印</span>
      </div><div class="figure-footnote">铁路的名字后面，就是修路的人</div>`;
    }
    case 'memorial': return `<div class="memorial-years"><span class="memorial-event"><b>1952</b><small>全线通车</small></span><i>两年后</i><span class="memorial-event"><b>1954</b><small>七月一日 · 奠基</small></span></div><svg class="dispatch-sketch memorial-sketch" viewBox="0 0 360 260" aria-hidden="true">
      <defs><clipPath id="memorial-rail-window" clipPathUnits="userSpaceOnUse"><rect width="360" height="260"/></clipPath></defs>
      <path class="monument-ghost" d="M85 209v-22h20v-31h25v-43h25V23h50v90h25v43h25v31h20v22Z"/>
      ${[{x:85,y:187,w:190,h:22},{x:105,y:156,w:150,h:31},{x:130,y:113,w:100,h:43},{x:155,y:23,w:50,h:90}].map((tier,index) => {
        const contour = `M${tier.x} ${tier.y}h${tier.w}v${tier.h}h-${tier.w}Z`;
        return `<g class="monument-tier tier-${index}"><path class="tier-face" d="${contour}"/><path class="tier-contour" d="${contour}"/></g>`;
      }).join('')}
      <g class="foundation-inscription"><text x="180" y="175" text-anchor="middle">1954.07.01 · 奠基</text><path d="M133 179h94"/></g>
      <path class="height-rule" d="M292 23v186m-5-186h10m-10 186h10"/><text class="height-label" x="305" y="117">14米</text>
      <path class="memorial-rail" d="M0 243h360M0 248h360${Array.from({length:13},(_,i) => `M${8+i*28} 248v5`).join('')}"/>
      <g clip-path="url(#memorial-rail-window)"><g class="memorial-train"><g transform="translate(0 189.1) scale(.55)">${steamTrain('')}</g></g></g>
    </svg><div class="figure-footnote">火车通了，两年后，碑上记下奠基</div>`;
  }
}

/** Called inside the reading page's GSAP context so every loop is disposed together. */
export function mountIllustration(figure: HTMLElement, paper: HTMLElement) {
  const trigger = { trigger: figure, scroller: paper, start: 'top bottom-=40', toggleActions: 'play pause resume pause' };
  figure.querySelectorAll<SVGPathElement>('.ink-path').forEach(path => {
    const length = path.getTotalLength();
    gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, {
      strokeDashoffset: 0, duration: 1.5, ease: 'power1.inOut', scrollTrigger: { ...trigger, once: true },
    });
  });
  if (figure.dataset.figure === 'tools') {
    const pose = { angle: 20, lift: 0 };
    const hammer = figure.querySelector('.tool-hammer')!;
    const chisel = figure.querySelector('.tool-chisel')!;
    const hammerPointer = figure.querySelector('.hammer-pointer')!;
    const chiselPointer = figure.querySelector('.chisel-pointer')!;
    const hammerDot = figure.querySelector('.hammer-pointer-dot')!;
    const chiselDot = figure.querySelector('.chisel-pointer-dot')!;
    const update = () => {
      // The hammer swings around the grip. At zero, its face meets the cap at y=94.
      const angle = pose.angle * Math.PI / 180;
      const x = 279 + (166 - 279) * Math.cos(angle) - (60 - 76) * Math.sin(angle);
      const y = 76 + (166 - 279) * Math.sin(angle) + (60 - 76) * Math.cos(angle);
      hammer.setAttribute('transform', `rotate(${pose.angle} 279 76)`);
      chisel.setAttribute('transform', `translate(0 ${pose.lift})`);
      hammerPointer.setAttribute('d', `M284 49H263L${x} ${y}`);
      hammerDot.setAttribute('cx', String(x));
      hammerDot.setAttribute('cy', String(y));
      chiselPointer.setAttribute('d', `M64 133H101L144 ${137 + pose.lift}`);
      chiselDot.setAttribute('cy', String(137 + pose.lift));
    };
    update();
    gsap.timeline({ repeat: -1, repeatDelay: 1.2, scrollTrigger: trigger, onUpdate: update })
      .to(pose, { angle: 0, duration: .52, ease: 'power2.in' }, .4)
      .fromTo(figure.querySelector('.stone-chips'), { opacity: 0, x: 0, y: 0 }, { opacity: .85, x: -3, y: -4, duration: .1 }, .92)
      .to(pose, { lift: -1.1, duration: .08, ease: 'sine.out' }, .95)
      .to(pose, { lift: 0, duration: .16, ease: 'sine.in' }, 1.03)
      .to(figure.querySelector('.stone-chips'), { opacity: 0, y: -9, duration: .28 }, 1.02)
      .to(pose, { angle: 20, duration: .78, ease: 'sine.inOut' }, 1.12);
  } else if (figure.dataset.figure === 'opening') {
    animateTrain(figure.querySelector('.print-train')!, trigger, -124, 674, 13, .6);
  } else if (figure.dataset.figure === 'together') {
    const crowd = gsap.timeline({ scrollTrigger: trigger });
    figure.querySelectorAll<SVGGElement>('[data-worker]').forEach(person => {
      const index = Number(person.dataset.worker);
      const soldier = index < 12;
      const station = index % 12;
      const direction = soldier ? 1 : -1;
      const x = Number(person.dataset.stationX);
      const workY = soldier ? 85 : 156;
      const laneY = soldier ? 24 + station % 3 * 13 : 194 + station % 3 * 12;
      const startX = soldier ? -18 : 378;
      const finishX = soldier ? 378 : -18;
      const ring = person.querySelector('.crew-work-ring');
      const core = person.querySelector('.crew-person-core');
      const tool = person.querySelector('.crew-tool');
      gsap.set(person, { x: startX, y: laneY });
      gsap.set(tool, { opacity: 0, transformOrigin: '0 0' });
      const walk = gsap.timeline({ repeat: -1, repeatDelay: 1 + station % 3 * .3 });
      walk.to(person, { x: x - direction * 18, duration: Math.abs(x - startX) / 110 + .5, ease: 'none' })
        .to(person, { x, y: workY, duration: .8, ease: 'sine.inOut' })
        .addLabel('work')
        .to(tool, { opacity: .8, duration: .15 }, 'work')
        .to(core, { y: soldier ? 1.4 : -1.4, duration: .23, repeat: 7, yoyo: true, ease: 'sine.inOut' }, 'work')
        .fromTo(ring, { opacity: 0, scale: .65, transformOrigin: '0 0' }, { opacity: .45, scale: 1, duration: .46, repeat: 3, yoyo: true, ease: 'sine.inOut', immediateRender: false }, 'work')
        .fromTo(tool, { rotation: -13 }, { rotation: 13, duration: .23, repeat: 7, yoyo: true, ease: 'sine.inOut', immediateRender: false }, 'work')
        .to([tool, ring], { opacity: 0, duration: .18 })
        .to(person, { x: x + direction * 18, y: laneY, duration: .8, ease: 'sine.inOut' })
        .to(person, { x: finishX, duration: Math.abs(finishX - x) / 110 + .5, ease: 'none' });
      // Every reset happens beyond the clipped drawing; arrivals are deliberately staggered.
      crowd.add(walk, station * .32 + (soldier ? 0 : .45));
    });
  } else if (figure.dataset.figure === 'title') {
    const letters = [...figure.querySelectorAll('.inscription-column .inscription-letter')];
    const bracket = figure.querySelector('.inscription-bracket')!;
    const guides = [...figure.querySelectorAll('.inscription-guide-item')];
    gsap.set(letters, { opacity: 0, y: 2 });
    gsap.set(bracket, { scaleY: 0, opacity: 0, transformOrigin: '50% 0%' });
    gsap.set(guides, { opacity: .5, color: '#796c54' });
    const rubbing = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 1.4, scrollTrigger: trigger });
    rubbing.to(letters.slice(0,4), { opacity: 1, y: 0, duration: .22, stagger: .09 }, .7)
      .to(letters.slice(4,8), { opacity: 1, y: 0, duration: .22, stagger: .09 }, 1.6)
      .to(letters.slice(8), { opacity: 1, y: 0, duration: .22, stagger: .09 }, 2.5)
      .to(bracket, { scaleY: 1, opacity: 1, duration: .55, ease: 'power1.out' }, 1.65);
    guides.forEach((guide,index) => {
      rubbing.to(guide, { color: '#a23727', opacity: 1, duration: .3 }, .7 + index * .9);
      if (index < guides.length - 1) {
        rubbing.to(guide, { color: '#796c54', opacity: .5, duration: .35 }, 1.4 + index * .9);
      }
    });
    // After the reading pause, yoyo retracts each group in reverse order.
    // The guide highlights and bracket follow the same return.
  } else if (figure.dataset.figure === 'memorial') {
    const faces = [...figure.querySelectorAll('.tier-face')];
    const contours = [...figure.querySelectorAll<SVGPathElement>('.tier-contour')];
    const date = figure.querySelector('.foundation-inscription')!;
    const dateText = date.querySelector('text')!;
    const underline = date.querySelector('path')!;
    const measure = figure.querySelector<SVGPathElement>('.height-rule')!;
    const heightLabel = figure.querySelector('.height-label')!;
    const years = [...figure.querySelectorAll('.memorial-event')];
    const measureLength = measure.getTotalLength();
    gsap.set(faces, { clipPath: 'inset(100% 0 0 0)' });
    contours.forEach(path => {
      const length = path.getTotalLength();
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    });
    gsap.set([dateText, heightLabel], { clipPath: 'inset(0 100% 0 0)' });
    gsap.set(underline, { scaleX: 0, transformOrigin: '50% 50%' });
    gsap.set(measure, { strokeDasharray: measureLength, strokeDashoffset: measureLength });
    const remembrance = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 1.4, scrollTrigger: trigger });
    remembrance.fromTo(years[0], { opacity: .5 }, { opacity: 1, duration: .35 }, 0)
      .to(years[0], { opacity: .5, duration: .5 }, 2.4)
      .fromTo(years[1], { opacity: .5 }, { opacity: 1, duration: .4 }, 2.4);
    contours.forEach((path,index) => {
      remembrance.to(path, { strokeDashoffset: 0, duration: .8, ease: 'power1.inOut' }, .9 + index * .5)
        .to(faces[index], { clipPath: 'inset(0% 0 0 0)', duration: .8, ease: 'power1.inOut' }, .9 + index * .5);
    });
    remembrance.to(measure, { strokeDashoffset: 0, duration: 1.2, ease: 'power1.inOut' }, 2.8)
      .to(heightLabel, { clipPath: 'inset(0 0% 0 0)', duration: .5, ease: 'power1.inOut' }, 3.6)
      .to(dateText, { clipPath: 'inset(0 0% 0 0)', duration: .75, ease: 'power1.inOut' }, 3.2)
      .to(underline, { scaleX: 1, duration: .8, ease: 'power2.out' }, 3.5);
    // Reverse the actual drawing: labels, ruler, upper tiers, then the base.
    // The locomotive keeps travelling forward on its own loop.
    animateTrain(figure.querySelector('.memorial-train')!, trigger, -74, 536, 10.2, 1.4, .55);
  }
}
