import gsap from 'gsap';
import { clues, rooms, type ClueId, type Room } from './content';
import { mastheadMarkup } from './masthead';
import { memoryPhoto } from './memory-photo';
import { mountMemoryLedger } from './memory-ledger';
import { createPaperFold } from './paper-fold';
import { mountFieldNotes } from './field-notes';

const close = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg>';
export const pencil = `<svg class="pencil-wash pencil-rounded pencil-rect" viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M10 9 190 10 10 18 190 19 10 27 190 28 10 36 190 37"/><path pathLength="1" d="M12 10 188 11M11 27 189 28"/></svg>`;
export const circlePencil = `<svg class="pencil-wash pencil-rounded" viewBox="0 0 44 44" aria-hidden="true"><path pathLength="1" d="m16 8 12 1-18 5 25 1-28 5 30 1-29 5 27 1-22 5 17 1"/><path pathLength="1" d="m16 6 13 3m-18 5 24 2M7 22l29 2M13 31l18 3"/></svg>`;
export const capsulePencil = `<svg class="pencil-wash pencil-rounded pencil-capsule" viewBox="0 0 111 42" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="m23 8 65 1-75 5 85 1-89 5 93 1-89 5 84 1-76 5 67 1"/><path pathLength="1" d="m22 6 67 3m-75 5 85 2M10 22l91 2m-78 9 66 2"/></svg>`;
export const railIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3 5 21M16 3l3 18M7 7h10M6 12h12M5 18h14"/></svg>';
export const bookIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h13l3 3v14H4zM8 4v17M11 9h5M11 13h5M11 17h4"/></svg>';

/** Fit loose hand-drawn strokes to each control without stretching their round tips. */
export function mountPencilWashes(root: HTMLElement): () => void {
  const washes = new Map<HTMLElement, SVGSVGElement>();
  const redraw = (host: HTMLElement, wash: SVGSVGElement) => {
    const area = host.querySelector<HTMLElement>('[data-pencil-area]') ?? host;
    const width = area.clientWidth;
    const height = area.clientHeight;
    if (width < 1 || height < 1) return;
    const size = `${width} ${height}`;
    if (wash.dataset.size === size) return;
    wash.dataset.size = size;
    wash.setAttribute('viewBox', `0 0 ${size}`);
    // Compact chrome needs coverage behind every icon, number and label.
    // Use the same overlapping rounded strokes as the circular controls;
    // reserve the larger slant and ragged edges for the roomy paper cards.
    const fitted = host.matches('.hud-board, .passage-pass, .cover-enter, .dispatch-collect');
    const wideRecord = host.matches('.press-record, .survey-observation');
    wash.classList.toggle('pencil-fitted', fitted);
    const stroke = fitted ? 5.5 : Math.min(10, Math.max(4, Math.min(width, height) * .14));
    const padding = fitted ? 4.5 : Math.min(9, Math.max(3, Math.min(width, height) * .1));
    const tilt = fitted ? 2 : Math.min(14, height * .13);
    const top = padding + stroke / 2 + tilt / 2 + (fitted ? 0 : stroke * .25);
    const span = Math.max(1, height - 2 * top);
    const rows = Math.max(2, Math.ceil(span / (stroke * (fitted ? .94 : 1.05))) + 1);
    const step = span / (rows - 1);
    const inset = (wideRecord ? 2 : padding) + stroke / 2;
    const variation = fitted ? 2.2 : wideRecord ? Math.min(8, width * .015) : Math.min(22, width * .05, height * .24);
    // A stable seed gives each control its own handwriting without flicker on resize.
    const seed = Array.from(host.textContent ?? '').reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
    const noise = (index: number) => {
      const value = Math.sin(index * 12.9898 + seed % 10000) * 43758.5453;
      return value - Math.floor(value);
    };
    const fill: string[] = [];
    const grain: string[] = [];
    let previousEnd: { x: number; y: number } | null = null;
    for (let row = 0; row < rows; row++) {
      const progress = row / (rows - 1);
      const y = top + row * step + (row > 0 && row < rows - 1 ? (noise(row * 5 + 2) - .5) * step * (fitted ? .12 : .4) : 0);
      const radius = Math.min(9, height * .2);
      const cornerY = Math.min(radius, Math.max(0, Math.abs(y - height / 2) - (height / 2 - padding - radius)));
      const taper = fitted
        ? radius - Math.sqrt(radius * radius - cornerY * cornerY)
        : Math.pow(Math.abs(progress - .5) * 2, 2) * variation;
      const left = inset + taper * .8 + variation * (noise(row * 5) + progress * .25);
      const right = width - inset - taper * .55 - variation * (noise(row * 5 + 1) + (1 - progress) * .2);
      const slope = tilt * (.55 + noise(row * 5 + 3) * .45);
      const leftY = y + slope / 2;
      const rightY = y - slope / 2;
      const bow = (noise(row * 5 + 4) - .5) * stroke * (fitted ? .3 : 1);
      const length = right - left;
      const c1x = left + length * .32;
      const c2x = left + length * .72;
      const c1y = leftY - slope * .32 + bow;
      const c2y = leftY - slope * .72 - bow * .6;
      const rightward = row % 2 === 0;
      const startX = rightward ? left : right;
      const startY = rightward ? leftY : rightY;
      // A single continuous path lets the dash reveal travel through every row.
      // Separate M subpaths restart the dash and make all strokes appear together.
      if (previousEnd) {
        const turnX = rightward
          ? Math.min(previousEnd.x, startX) - step * .3
          : Math.max(previousEnd.x, startX) + step * .3;
        fill.push(`Q${turnX} ${(previousEnd.y + startY) / 2} ${startX} ${startY}`);
      } else fill.push(`M${startX} ${startY}`);
      fill.push(rightward
        ? `C${c1x} ${c1y} ${c2x} ${c2y} ${right} ${rightY}`
        : `C${c2x} ${c2y} ${c1x} ${c1y} ${left} ${leftY}`);
      previousEnd = { x: rightward ? right : left, y: rightward ? rightY : leftY };
      if (row % 3 === 1) grain.push(`M${left + stroke} ${leftY + stroke * .2} Q${c2x} ${c2y + stroke * .3} ${right - stroke * 1.5} ${rightY + stroke * .15}`);
    }
    wash.style.setProperty('--pencil-width', `${stroke}px`);
    const paths = wash.querySelectorAll('path');
    paths[0].setAttribute('d', fill.join(' '));
    paths[1].setAttribute('d', grain.join(' '));
  };
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const host = entry.target as HTMLElement;
      const wash = washes.get(host);
      if (wash) redraw(host, wash);
    }
  });
  root.querySelectorAll<SVGSVGElement>('.pencil-rect').forEach(wash => {
    const host = wash.parentElement!;
    washes.set(host, wash);
    redraw(host, wash);
    observer.observe(host);
  });
  return () => observer.disconnect();
}

export function memoryPaper(collected: Set<ClueId>, photo: Room) {
  const count = collected.size;
  const dates = [
    { year: '1950', day: '6月15日', iso: '1950-06-15', event: '开工', title: '先把石头凿开', body: '钢钎抵住石头，大锤一下一下落下。成渝铁路从这一天开修。' },
    { year: '1952', day: '7月1日', iso: '1952-07-01', event: '全线通车', title: '火车从这一天开过', body: '两年修路的日子，接成一条铁路。这一天，火车沿全线开过去。' },
    { year: '1954', day: '7月1日', iso: '1954-07-01', event: '建碑奠基', title: '把修路的人写上碑', body: '通车以后又过了两年。碑上留下奠基日期，也留下“筑路民工”。' },
  ];
  return `<section class="screen notebook-screen paper-screen ledger-screen" aria-label="记忆册"><div class="newspaper-pan"><article class="memory-newspaper unfolding-paper memory-ledger" data-fold-progress="收录 ${String(count).padStart(2,'0')} / 05" aria-label="成渝记忆档案册">
    <nav class="ledger-tabs" aria-label="册页目录"><div>${[['ledger-front','卷首'],['ledger-records','线索'],['ledger-dates','年表'],['notebook-finale','终章']].map(([id,label],index) => `<button data-ledger-target="${id}" ${index === 0 ? 'aria-current="location"' : ''}>${label}</button>`).join('')}</div><button class="paper-close pencil-control" data-action="close-notebook" aria-label="合上记忆册">${pencil}${close}</button><i class="ledger-page-progress" aria-hidden="true"></i></nav>
    <header class="press-masthead" id="ledger-front"><div class="ledger-catalog"><span>成渝铁路 · 建设者档案</span><span>第二章 / 记忆册</span></div>
    <div class="press-name">${mastheadMarkup()}</div>
    <div class="press-running"><span>从开山筑路，走到纪念碑前</span><b>收录 ${String(count).padStart(2,'0')} / 05</b></div>
    </header>
    <div class="press-body"><section class="press-front"><div class="press-editorial"><p class="press-red" data-typeset>这条路，是人修的</p><h2 data-typeset class="memory-sound-title"><span class="memory-sound-line">先有<span class="memory-hammer-word"><span class="memory-note-glyph">锤</span><span class="memory-note-glyph">声</span></span></span><span class="memory-sound-line">才有<span class="memory-train-word"><span class="memory-note-glyph">火</span><span class="memory-note-glyph">车</span><span class="memory-note-glyph">声</span></span></span></h2><p data-typeset>一把大锤，一根钢钎。石头要凿开，路基要修好，铁轨才能铺上去。后来火车通了。碑名里，留下“筑路民工”四个字。</p><div class="ledger-collection-note"><i aria-hidden="true"></i><span>${count === 5 ? '五条线索，都记下了' : `已记下 ${count} 条，还有 ${5-count} 条等你发现`}</span></div></div>
    ${memoryPhoto(photo, 'press-photo')}</section>
    <section class="press-records" id="ledger-records"><div class="press-section-heading"><div><span class="ledger-section-label">五条线索 / 从工具到碑文</span><h2 data-typeset>他们怎样修成这条路</h2></div><span>01—05</span></div><div class="press-record-grid">${clues.map(clue => `<button id="ledger-record-${clue.id}" class="press-record pencil-control ${collected.has(clue.id) ? 'is-collected' : ''}" data-action="book-clue" data-id="${clue.id}">${pencil}<span class="press-record-meta"><span class="press-record-no">${clue.number}</span><small>${rooms.find(room => room.id === clue.roomId)!.title}</small><span class="press-record-status">${collected.has(clue.id) ? '已收录' : '待发现'}</span></span><span class="press-record-heading"><strong>${clue.label}</strong><span class="press-record-open" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 18 18 6M6 6h12v12"/></svg></span></span><span class="press-record-lead">${clue.lead}</span><span class="press-record-rule" aria-hidden="true"></span></button>`).join('')}</div></section>
    <section class="press-time" id="ledger-dates" aria-label="铁路年表"><header class="chronology-heading"><span class="ledger-section-label">三个日期 / 一条铁路</span><h2>开工、通车、奠基</h2></header><div class="ledger-chronology"><div class="chronology-years" role="list" aria-label="铁路年表">${dates.map((item,index) => `<div id="ledger-year-${item.year}" class="chronology-year ${index === 0 ? 'is-active' : ''}" role="listitem" ${index === 0 ? 'aria-current="step"' : ''}><b>${item.year}</b><time datetime="${item.iso}">${item.day}</time><span>${item.event}</span></div>`).join('')}</div><svg class="chronology-route" aria-hidden="true"><path class="chronology-track"/><path class="chronology-ink" pathLength="1"/>${dates.map((_,index) => `<circle class="chronology-stop" data-stop="${index}" r="2.5"/>`).join('')}</svg><div class="chronology-stories"><div class="chronology-story-window">${dates.map((item,index) => `<article class="chronology-story" id="ledger-story-${item.year}" aria-labelledby="ledger-year-${item.year}" aria-hidden="${index !== 0}"><span class="chronology-story-date">${item.year} 年 · ${item.day}</span><h3>${item.title}</h3><p>${item.body}</p></article>`).join('')}</div></div></div></section>
    <section class="press-ending ${count === 5 ? 'is-unlocked' : ''}" id="notebook-finale" aria-label="终章入口"><div class="ledger-ending-top"><span class="ending-label">终章 / 回到碑前</span><span>${String(count).padStart(2,'0')} / 05</span></div><div class="ending-rule" aria-hidden="true"></div><h2 data-typeset class="memory-ending-title"><span class="memory-ending-line"><span class="memory-ending-glyph">路</span><span class="memory-ending-glyph">修</span><span class="memory-ending-glyph">好</span><span class="memory-ending-glyph">了</span></span><span class="memory-ending-line">别忘了<span class="memory-people-word">修路的人<i class="memory-people-rule" aria-hidden="true"></i></span></span></h2><p data-typeset>${count === 5 ? '五条线索都在这里了。再到碑前，把修路的人记住。' : '看过一条，就记下一条。收齐五条线索，再到碑前。'}</p><button class="pencil-control" data-action="finale" ${count < 5 ? 'disabled' : ''}>${pencil}<span>${count === 5 ? '读终章' : '收齐五条后读终章'}</span><b aria-hidden="true">↗</b></button></section><footer class="press-footer"><small>成渝铁路工业遗产数字记忆馆 · 丰碑与铭记</small></footer></div>
    </article></div></section>`;
}

export function chapterSheet(room: Room, collected: Set<ClueId>) {
  const entries = clues.filter(clue => clue.roomId === room.id);
  const count = entries.filter(clue => collected.has(clue.id)).length;
  const number = String(rooms.indexOf(room) + 1).padStart(2, '0');
  const prompts: Record<string, [string,string]> = {
    worksite: ['一把锤，一根钎，先把石头凿开','点开钢钎和大锤，再看看是谁在一起修路。'],
    archive: ['1952年7月1日，路通了','从1950年开工，到1952年通车。把这两个日期记在一起。'],
    monument: ['路通了，为什么还要立碑？','看清碑名里的“筑路民工”，再读碑上的奠基时间。'],
  };
  return `<section class="screen chapter-screen paper-screen" aria-label="${room.title}现场手记"><div class="newspaper-pan"><article class="chapter-sheet unfolding-paper field-notes" data-fold-title="${room.title}" data-fold-label="成渝铁路 / 现场手记" data-fold-note="${room.subtitle.replace(/[。.]$/, '')}" data-fold-edition="场景 ${number} / 03" data-fold-progress="收录 ${count} / ${entries.length}" aria-label="${room.title}现场手记">
    <header class="survey-top"><div class="survey-topline"><div class="survey-publication"><span>现场手记</span><small>${room.title}</small></div><span class="survey-count">收录 ${count} / ${entries.length}</span><button class="paper-close pencil-control" data-action="close-notebook" aria-label="关闭现场手记">${pencil}${close}</button></div></header>
    <div class="survey-body"><section id="survey-front"><div class="survey-title"><div class="survey-title-meta"><span>现场手记</span><b>第 ${number} 章</b></div><h1 data-typeset>${room.title}</h1><p class="survey-title-deck" data-typeset>${room.subtitle.replace(/[。.]$/, '')}</p></div><div class="survey-layout">${memoryPhoto(room, 'survey-image')}
    <div class="survey-instructions"><span class="survey-kicker">现场观察</span><h2 data-typeset>${prompts[room.id][0]}</h2><p data-typeset>${prompts[room.id][1]}</p></div></div></section>
    <section class="survey-observations" id="survey-observations"><header class="survey-section-heading"><h2 data-typeset>本章观察点</h2><span>${entries.length} 条线索</span></header>${entries.map(clue => `<button class="survey-observation pencil-control" data-action="clue" data-id="${clue.id}">${pencil}<span class="survey-observation-meta"><i>${clue.number}</i><small>${collected.has(clue.id) ? '已收录' : '待发现'}</small></span><span class="survey-observation-heading"><strong data-typeset>${clue.label}</strong><span class="survey-observation-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 18 18 6M6 6h12v12"/></svg></span></span><span class="survey-observation-deck" data-typeset>${clue.lead}</span></button>`).join('')}</section><footer class="survey-footer"><span>观察 → 释读 → 收录</span><span>${room.title} / 现场手记</span></footer></div></article></div></section>`;
}

/** Close the visible spread before the folded packet retreats above the viewport. */
export function foldPaperAway(root: HTMLElement): gsap.core.Timeline {
  const paper = root.querySelector<HTMLElement>('.unfolding-paper')!;
  const packet = createPaperFold(paper);
  const { fold, height } = packet;
  // The snapshot now owns the fold; hide the live surface including its descendants.
  return gsap.timeline({ onComplete: packet.dispose, onInterrupt: packet.dispose })
    .to({}, { duration: .05 })
    .call(() => paper.classList.add('paper-is-folding'))
    .to(packet.motion, { angle: 180, duration: .72, ease: 'power2.inOut', onUpdate: packet.render })
    .to(fold, { y: -paper.offsetTop - height / 2 - 50, duration: .52, ease: 'power2.in' });
}

/** Own every paper tween/observer so route changes never leave timers behind. */
export function mountPaperMotion(root: HTMLElement, reduced: boolean, onReady?: () => void): () => void {
  const paper = root.querySelector<HTMLElement>('.unfolding-paper');
  if (!paper) return () => {};
  if (paper.classList.contains('memory-ledger')) return mountMemoryLedger(paper, reduced, onReady);
  const disposeFieldNotes = paper.classList.contains('field-notes') ? mountFieldNotes(paper) : () => {};
  if (reduced) { onReady?.(); return disposeFieldNotes; }
  const packet = createPaperFold(paper);
  const { fold, height } = packet;
  let activateReading = () => {};
  let opened = false;
  let opening: gsap.core.Timeline | null = null;
  const finishFold = () => {
    if (opened) return;
    opened = true;
    activateReading();
    packet.handoff();
    onReady?.();
  };
  const context = gsap.context(() => {
    paper.classList.add('paper-is-folding');
    packet.motion.angle = 180;
    packet.render();
    opening = gsap.timeline({ onComplete: finishFold })
      .fromTo(fold, { y: -paper.offsetTop - height / 2 - 40 }, { y: 0, duration: .6, ease: 'power3.out' })
      .to(packet.motion, { angle: 0, duration: .9, ease: 'power2.inOut', onUpdate: packet.render }, .52);
  }, root);
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target as HTMLElement;
      const chars = el.querySelectorAll('.typeset-char');
      const tween = gsap.to(chars, { opacity: 1, y: 0, duration: .52, stagger: Math.min(.035, 1.1 / chars.length), ease: 'power2.out', delay: .05, clearProps: 'transform,opacity' });
      textTweens.push(tween);
      observer.unobserve(el);
    });
  }, { root: paper, threshold: .12 });
  const textTweens: gsap.core.Tween[] = [];
  paper.querySelectorAll<HTMLElement>('[data-typeset]').forEach(el => {
    const label = el.textContent ?? '';
    el.setAttribute('aria-label', label);
    el.innerHTML = el.innerHTML.split(/(<br\s*\/?>)/gi).map(part => part.startsWith('<br') ? part : Array.from(part).map(char => `<span class="typeset-char" aria-hidden="true">${char}</span>`).join('')).join('');
    gsap.set(el.querySelectorAll('.typeset-char'), { y: -14, opacity: 0 });
  });
  const visualObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target as HTMLElement;
      if (el.matches('.press-ending')) {
        textTweens.push(gsap.fromTo(el.querySelector('.ending-rule'), { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power2.inOut' }));
      } else {
        textTweens.push(gsap.fromTo(el.querySelectorAll('.press-time>div>div'), { opacity: .25, y: 12 }, { opacity: 1, y: 0, duration: .65, stagger: .12, ease: 'power2.out' }));
      }
      visualObserver.unobserve(el);
    });
  }, { root: paper, threshold: .18 });
  activateReading = () => {
    paper.querySelectorAll<HTMLElement>('.press-ending,.press-time').forEach(el => visualObserver.observe(el));
    const viewport = paper.getBoundingClientRect();
    paper.querySelectorAll<HTMLElement>('[data-typeset]').forEach(el => {
      const rect = el.getBoundingClientRect();
      // The fold already showed these lines. Hand them over fully printed.
      if (rect.bottom > viewport.top && rect.top < viewport.bottom) {
        gsap.set(el.querySelectorAll('.typeset-char'), { clearProps: 'transform,opacity' });
      } else observer.observe(el);
    });
  };
  const finishOnResize = () => { opening?.progress(1); finishFold(); };
  window.addEventListener('resize', finishOnResize, { once: true });
  return () => { disposeFieldNotes(); observer.disconnect(); visualObserver.disconnect(); textTweens.forEach(tween => tween.kill()); context.revert(); packet.dispose(); window.removeEventListener('resize', finishOnResize); };
}

