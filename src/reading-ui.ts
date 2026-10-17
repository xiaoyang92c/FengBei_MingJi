import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { rooms, sources, type Clue, type ClueId } from './content';
import { pencil } from './paper-ui';
import { memoryPhoto } from './memory-photo';
import { illustration, mountIllustration } from './clue-illustrations';

gsap.registerPlugin(ScrollTrigger);

const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 17 7M5 7H17V19"/></svg>';
const close = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg>';
const readingPhases = ['看现场', '读资料', '再想一想'];


const editions: Record<ClueId, { column: string; note: string; quote: string; caption: string }> = {
  tools: { column: '工地记', note: '一根钎，一把锤，一下一下地干。', quote: '一锤下去，还得再抡一锤。', caption: '钢钎与大锤 / 作业原理示意，非实物测绘' },
  together: { column: '修路的人', note: '解放军，民工。做的是同一件事。', quote: '车轮下面，有他们一起干过的活。', caption: '解放军与民工 / 依资料绘制的协作示意' },
  opening: { column: '通车记', note: '两个日期之间，是一天天修路的日子。', quote: '火车要开到哪里，路就得先修到哪里。', caption: '1950年开工，1952年全线通车 / 通车示意' },
  title: { column: '碑名录', note: '走到碑前，把这四个字读清楚。', quote: '“筑路民工”后面，紧跟着“纪念碑”。', caption: '第四级主碑体南、北两面 / 碑名依资料排印，非拓片' },
  memorial: { column: '通车之后', note: '路修好了，修路的人还要被想起。', quote: '路通了，又过两年，碑上记下奠基。', caption: '四级叠收、黄砂石、高14米 / 层级示意，非测绘图' },
};

export function cluePage(clue: Clue, recorded: boolean) {
  const room = rooms.find(item => item.id === clue.roomId)!;
  const edition = editions[clue.id];
  const source = sources[clue.sourceId];
  return `<section class="screen clue-screen dispatch-screen dispatch-${clue.id}" aria-label="${edition.column}：${clue.label}">
    <div class="clue-visual"><div class="clue-view-label dispatch-scene-label"><span class="field-note">筑路手记 / ${clue.number} ${edition.column}</span><strong>${clue.label}</strong><small>${edition.note}</small><span class="dispatch-chapter">第${String(rooms.indexOf(room) + 1).padStart(2, '0')}章 · ${room.title}</span></div></div>
    <article class="clue-paper dispatch-paper" aria-label="${clue.label}专页" tabindex="0">
      <header class="dispatch-topline"><span>成渝记忆 <i>/</i> ${edition.column}</span><button class="dispatch-close pencil-control" data-action="close-clue" aria-label="关闭${clue.label}，返回${room.title}">${pencil}${close}</button></header>
      <div class="dispatch-body">
        <header class="dispatch-headline"><div class="dispatch-heading-meta"><p class="dispatch-kicker" data-print>${room.title} / ${clue.label}</p><span class="dispatch-number">线索 ${clue.number} / 05</span></div><h1 data-print>${clue.title}</h1><p class="dispatch-deck" data-print>${clue.lead}</p></header>
        ${memoryPhoto(room, `dispatch-photo photo-${clue.id}`)}
        <div class="dispatch-front"><figure class="dispatch-figure" data-figure="${clue.id}">${illustration(clue.id)}<figcaption>${edition.caption}</figcaption></figure><aside class="dispatch-pullquote"><span>手记 / ${clue.number}</span><p data-print>${edition.quote.replace(/[。.]$/, '')}</p><small>往下读，看看资料怎么说。</small></aside></div>
        <div class="dispatch-sections">${clue.steps.map((step, index) => `<section class="dispatch-section" data-step="${index}"><div class="dispatch-section-index"><b>0${index + 1}</b><span>${readingPhases[index]}</span></div><div class="dispatch-section-copy"><h2 data-print>${step.title}</h2><p data-print>${step.body}</p>${index === 1 ? '<span class="dispatch-source-note">文字依据 / 内江广播电视台地方资料</span>' : ''}</div></section>`).join('')}</div>
        <footer class="dispatch-sources"><h2>本页资料</h2><div><p>${source.title}</p>${source.url ? `<a href="${source.url}" target="_blank" rel="noopener noreferrer">查看原文 ↗</a>` : ''}</div><p class="dispatch-disclosure">${clue.roomId === 'monument' ? '场景中的方体仅标示位置；碑名与层级按资料排印、示意，不是原碑拓片或实物测绘。' : '场景和工具图为艺术化示意，非历史现场照片。图中人物不指代某个真实的人。'}</p></footer>
        <button class="collect-button dispatch-collect pencil-control ${recorded ? 'is-collected' : ''}" data-action="collect" data-id="${clue.id}">${pencil}<span>${recorded ? '已收录，返回空间' : '把这条记在记忆册里'}</span>${arrow}</button><p class="dispatch-colophon">成渝铁路 / 丰碑与铭记 <span>${clue.number} — 05</span></p>
      </div>
    </article>
  </section>`;
}

/** Newspaper reading, scoped to the current page and disposed before navigation. */
export function mountReadingMotion(root: HTMLElement, reduced: boolean, onPhase?: (phase: number) => void): () => void {
  const paper = root.querySelector<HTMLElement>('.dispatch-paper');
  if (!paper) return () => {};
  let disposed = false;
  let refreshFrame = 0;
  const sections = [...paper.querySelectorAll<HTMLElement>('.dispatch-section')];
  let active = -1;
  const updatePhase = () => {
    const marker = paper.getBoundingClientRect().top + paper.clientHeight * .58;
    let next = 0;
    sections.forEach((section, index) => { if (section.getBoundingClientRect().top <= marker) next = index; });
    if (active === next || !sections.length) return;
    active = next;
    sections.forEach((section, index) => section.classList.toggle('is-active', index === next));
    onPhase?.(next);
  };
  paper.addEventListener('scroll', updatePhase, { passive: true });
  updatePhase();
  if (reduced) return () => { paper.removeEventListener('scroll', updatePhase); };
  const context = gsap.context(() => {
    paper.querySelectorAll<HTMLElement>('[data-print]').forEach(block => {
      block.setAttribute('aria-label', block.textContent ?? '');
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
      textNodes.forEach(node => {
        const fragment = document.createDocumentFragment();
        Array.from(node.textContent ?? '').forEach(letter => {
          const span = document.createElement('span');
          span.className = 'dispatch-char';
          span.setAttribute('aria-hidden', 'true');
          span.textContent = letter;
          fragment.append(span);
        });
        node.replaceWith(fragment);
      });
      const chars = block.querySelectorAll('.dispatch-char');
      gsap.fromTo(chars, { opacity: 0, y: 7 }, {
        opacity: 1, y: 0, duration: .36, stagger: Math.min(.025, 1.3 / Math.max(1, chars.length)), ease: 'power2.out',
        scrollTrigger: { trigger: block, scroller: paper, start: 'top bottom-=28', once: true },
      });
    });
    const photograph = paper.querySelector('.memory-photo');
    if (photograph) {
      const photoTrigger = { trigger: photograph, scroller: paper, start: 'top bottom-=25', once: true };
      gsap.fromTo(photograph.querySelector('img'), { opacity: .35, scale: 1.035 }, { opacity: 1, scale: 1, duration: 1.15, ease: 'sine.out', scrollTrigger: photoTrigger });
      gsap.from(photograph.querySelector('.photo-date'), { opacity: 0, y: -4, duration: .5, delay: .45, scrollTrigger: photoTrigger });
    }
    const figure = paper.querySelector<HTMLElement>('.dispatch-figure');
    if (figure) mountIllustration(figure, paper);

    const label = root.querySelector<HTMLElement>('.dispatch-scene-label')!;
    const rise = window.innerHeight - paper.getBoundingClientRect().top + 24;
    const drop = -label.getBoundingClientRect().bottom - 24;
    gsap.timeline({ onComplete: () => { if (!disposed) ScrollTrigger.refresh(); } })
      .fromTo(label, { y: drop }, { y: 0, duration: .7, ease: 'power3.out', clearProps: 'transform' }, 0)
      .fromTo(paper, { y: rise }, { y: 0, duration: .85, ease: 'power3.out', clearProps: 'transform' }, .08);

  }, root);
  refreshFrame = requestAnimationFrame(() => { if (!disposed) ScrollTrigger.refresh(); });
  void document.fonts.ready.then(() => { if (!disposed) ScrollTrigger.refresh(); });
  return () => {
    disposed = true;
    cancelAnimationFrame(refreshFrame);
    paper.removeEventListener('scroll', updatePhase);
    context.revert();
  };
}

/** Reverse the sheet's entrance before changing the route or clearing its contents. */
export function leaveReadingPage(root: HTMLElement): gsap.core.Timeline {
  const paper = root.querySelector<HTMLElement>('.dispatch-paper')!;
  const label = root.querySelector<HTMLElement>('.dispatch-scene-label')!;
  const down = Number(gsap.getProperty(paper, 'y')) + window.innerHeight - paper.getBoundingClientRect().top + 24;
  const up = Number(gsap.getProperty(label, 'y')) - label.getBoundingClientRect().bottom - 24;
  gsap.killTweensOf([paper, label]);
  paper.inert = true;
  return gsap.timeline()
    .to(paper, { y: down, duration: .65, ease: 'power2.in' }, 0)
    .to(label, { y: up, duration: .5, ease: 'power2.in' }, .05);
}
