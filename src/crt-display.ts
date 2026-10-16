/** Keep real text and semantics while exposing small phosphor glyphs to the timeline. */
export function crtLetters(element: HTMLElement): HTMLElement[] {
  if (element.classList.contains('crt-glitch-line') && element.querySelector('.crt-letter')) return [...element.querySelectorAll<HTMLElement>('.crt-letter')];
  element.classList.add('crt-glitch-line');
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    for (const character of Array.from(node.textContent ?? '')) {
      const span = document.createElement('span');
      span.className = 'crt-letter';
      span.textContent = character;
      fragment.append(span);
    }
    const run = document.createElement('span');
    run.className = 'crt-glyph-run';
    run.append(fragment);
    node.replaceWith(run);
  }
  return [...element.querySelectorAll<HTMLElement>('.crt-letter')];
}
export function revealCrtLine(timeline: gsap.core.Timeline, element: HTMLElement, at: number, duration = .42, stagger = .025) {
  const letters = crtLetters(element);
  timeline.fromTo(letters, { opacity: 0, x: -1.5 }, { opacity: 1, x: 0, duration, stagger, ease: 'power2.out' }, at);
}

export function crtScreenMarkup(content: string) {
  return `    <svg class="crt-definitions" aria-hidden="true"><defs><filter id="crt-display-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage class="crt-lens-field" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="crt-lens-map"/><feDisplacementMap in="SourceGraphic" in2="crt-lens-map" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>
    <div class="crt-glass"><div class="crt-picture"><canvas class="crt-snow" aria-hidden="true"></canvas><div class="crt-display">
${content}<div class="crt-raster" aria-hidden="true"></div></div><div class="crt-roll" aria-hidden="true"></div></div><div class="crt-phosphor" aria-hidden="true"></div><div class="crt-curve" aria-hidden="true"></div><div class="crt-startup" aria-hidden="true"></div><div class="crt-ignition" aria-hidden="true"></div>
    </div>`;
}

/** Both broadcasts bend their actual text through the same fixed lens. */
export function mountCrtLens(root: HTMLElement) {
  // A static barrel field bends the actual type, menu rows and scanlines.
  // Noise and the rolling band stay outside it, avoiding a full lens repaint per frame.
  const lensCanvas = document.createElement('canvas');
  lensCanvas.width = lensCanvas.height = 256;
  const lensContext = lensCanvas.getContext('2d')!;
  const field = lensContext.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const nx = x / 255 * 2 - 1;
    const ny = y / 255 * 2 - 1;
    const offset = (y * 256 + x) * 4;
    field.data[offset] = Math.round(127.5 + nx * (ny * ny + nx * nx * .18) * 100);
    field.data[offset + 1] = Math.round(127.5 + ny * (nx * nx + ny * ny * .18) * 100);
    field.data[offset + 2] = 128;
    field.data[offset + 3] = 255;
  }
  lensContext.putImageData(field, 0, 0);
  root.querySelector('.crt-lens-field')!.setAttribute('href', lensCanvas.toDataURL());
  const resizeLens = () => root.querySelector('feDisplacementMap')!.setAttribute('scale', String(Math.min(34, Math.min(innerWidth, innerHeight) * .055)));
  resizeLens();
  window.addEventListener('resize', resizeLens, { passive: true });
  return () => window.removeEventListener('resize', resizeLens);
}

/** One low-resolution noise frame is shared with each screen's animation clock. */
export function createCrtNoise(root: HTMLElement, reduced: boolean) {
  const canvas = root.querySelector<HTMLCanvasElement>('.crt-snow')!;
  canvas.width = 192;
  canvas.height = 128;
  const graphics = canvas.getContext('2d');
  const noise = graphics?.createImageData(canvas.width, canvas.height);
  let lastNoise = 0;
  return (time: number) => {
    if (reduced || document.hidden || !graphics || !noise || time - lastNoise < .15) return;
    lastNoise = time;
    for (let i = 0; i < noise.data.length; i += 4) {
      const shade = Math.floor(Math.random() * 256);
      noise.data[i] = shade * .82;
      noise.data[i + 1] = shade;
      noise.data[i + 2] = shade * .7;
      noise.data[i + 3] = 255;
    }
    graphics.putImageData(noise, 0, 0);
  };
}
