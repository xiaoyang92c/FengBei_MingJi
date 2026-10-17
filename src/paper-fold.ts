/** A shared newspaper fold, with the current publication printed on its back. */
export function createPaperFold(paper: HTMLElement) {
  const fold = document.createElement('div');
  fold.className = 'paper-fold-stage';
  fold.setAttribute('aria-hidden', 'true');
  fold.inert = true;
  const width = paper.offsetWidth;
  const height = paper.offsetHeight;
  const flat = window.matchMedia('(pointer: coarse)').matches;
  fold.classList.toggle('is-flat-fold', flat);
  Object.assign(fold.style, { left: `${paper.offsetLeft}px`, top: `${paper.offsetTop}px`, width: `${width}px`, height: `${height}px` });
  fold.style.setProperty('--paper-full-height', `${height}px`);
  fold.style.setProperty('--paper-half-height', `${height / 2}px`);
  const copy = () => {
    const clone = paper.cloneNode(true) as HTMLElement;
    clone.classList.remove('paper-is-folding');
    clone.classList.add('fold-copy');
    clone.removeAttribute('id');
    clone.removeAttribute('aria-busy');
    clone.style.opacity = '1';
    clone.style.visibility = 'visible';
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    return clone;
  };
  const top = document.createElement('div');
  top.className = 'fold-top';
  top.append(copy());
  const bottom = document.createElement('div');
  bottom.className = 'fold-bottom';
  const front = document.createElement('div');
  front.className = 'fold-front';
  front.append(copy());
  const back = document.createElement('div');
  back.className = 'fold-back';
  const label = document.createElement('span');
  label.textContent = paper.dataset.foldLabel ?? '建设者档案 / 记忆专刊';
  const edition = document.createElement('header');
  edition.className = 'fold-edition';
  const issue = document.createElement('span');
  issue.textContent = paper.dataset.foldEdition ?? '第二章';
  edition.append(label, issue);
  const title = document.createElement('strong');
  title.textContent = paper.dataset.foldTitle ?? '成渝记忆';
  const titleBlock = document.createElement('div');
  titleBlock.className = 'fold-title-block';
  titleBlock.append(title);
  const note = document.createElement('p');
  note.textContent = paper.dataset.foldNote ?? '从开山筑路，走到纪念碑前。';
  const frontmatter = document.createElement('div');
  frontmatter.className = 'fold-frontmatter';
  frontmatter.append(titleBlock, note);
  const imprint = document.createElement('footer');
  imprint.className = 'fold-imprint';
  const progress = document.createElement('span');
  progress.textContent = paper.dataset.foldProgress ?? '建设者记忆';
  const series = document.createElement('span');
  series.textContent = '丰碑与铭记';
  imprint.append(progress, series);
  back.append(edition, frontmatter, imprint);
  for (const face of [front, back]) {
    const shade = document.createElement('i');
    shade.className = 'fold-face-shade';
    face.append(shade);
  }
  bottom.append(front, back);
  fold.append(top, bottom);
  paper.parentElement!.append(fold);
  fold.querySelectorAll<HTMLElement>('.fold-copy').forEach(clone => { clone.scrollTop = paper.scrollTop; });
  const motion = { angle: 0 };
  const shades = [...fold.querySelectorAll<HTMLElement>('.fold-face-shade')];
  const render = () => {
    if (!flat) { bottom.style.transform = `rotateX(${motion.angle}deg)`; return; }
    const projection = foldProjection(motion.angle);
    front.style.visibility = projection.front ? 'visible' : 'hidden';
    back.style.visibility = projection.back ? 'visible' : 'hidden';
    front.style.opacity = projection.front ? '1' : '0';
    back.style.opacity = projection.back ? '1' : '0';
    front.style.transform = `scale(${projection.width},${projection.height})`;
    back.style.transform = `translateY(${-height / 2}px) scale(${projection.width},${projection.height})`;
    shades.forEach(shade => { shade.style.opacity = String(projection.shade); });
  };
  render();
  let firstFrame = 0, secondFrame = 0;
  const handoff = () => {
    // Opacity hides descendants too, including sticky elements with visibility:visible.
    paper.classList.remove('paper-is-folding');
    paper.style.opacity = '1';
    paper.style.visibility = 'visible';
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => fold.remove());
    });
  };
  const dispose = () => {
    cancelAnimationFrame(firstFrame);
    cancelAnimationFrame(secondFrame);
    paper.classList.remove('paper-is-folding');
    fold.remove();
  };
  return { fold, bottom, height, motion, render, handoff, dispose };
}

/** Two explicitly selected faces avoid nested 3D backface bugs in mobile WebViews. */
export function foldProjection(angle: number) {
  const radians = Math.max(0, Math.min(180, angle)) * Math.PI / 180;
  return {
    front: angle < 89.9,
    back: angle > 90.1,
    height: Math.max(.0001, Math.abs(Math.cos(radians))),
    width: 1 + Math.sin(radians) * .025,
    shade: Math.sin(radians) * .18,
  };
}
