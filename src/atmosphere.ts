import gsap from 'gsap';

/** One optical treatment shared by the wall, door flight and room. */
export function mountAtmosphere(app: HTMLElement, rig: HTMLElement, grain: HTMLCanvasElement, reduced: MediaQueryList) {
  const definitions = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  definitions.classList.add('optical-definitions');
  definitions.setAttribute('aria-hidden', 'true');
  definitions.innerHTML = `<defs>
    <filter id="barrel-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feImage id="lens-field" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="radial-field"/>
      <feDisplacementMap id="lens-displacement" in="SourceGraphic" in2="radial-field" scale="64" xChannelSelector="R" yChannelSelector="G"/>
      <feComponentTransfer><feFuncR type="linear" slope="1.18" intercept="-.06"/><feFuncG type="linear" slope="1.18" intercept="-.06"/><feFuncB type="linear" slope="1.18" intercept="-.06"/></feComponentTransfer>
      <feComponentTransfer><feFuncR type="gamma" amplitude="1.08" exponent=".9"/><feFuncG type="gamma" amplitude="1.08" exponent=".9"/><feFuncB type="gamma" amplitude="1.08" exponent=".9"/></feComponentTransfer>
    </filter>
    <filter id="masonry-detail" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feConvolveMatrix order="3" kernelMatrix="0 -.025 0 -.025 1.1 -.025 0 -.025 0" preserveAlpha="true" edgeMode="duplicate"/><feGaussianBlur id="wall-motion-blur" stdDeviation="0"/></filter>
    <filter id="chapter-motion" x="-10%" y="-5%" width="120%" height="110%" color-interpolation-filters="sRGB"><feGaussianBlur id="chapter-motion-blur" stdDeviation="0 0"/></filter>
    <filter id="door-motion" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
      <feDropShadow id="door-projection" dx="0" dy="7" stdDeviation="9" flood-color="#28221b" flood-opacity=".208"/>
      <feGaussianBlur id="door-motion-blur" stdDeviation="0 0"/>
    </filter>
    <filter id="shadow-ink" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .157 0 0 0 0 .2 0 0 0 0 .169 0 0 0 1 0"/></filter>
    <filter id="foliage-flow" x="-3%" y="-6%" width="106%" height="112%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".009 .013" numOctaves="1" seed="7" stitchTiles="stitch" result="flow-field"/>
      <feOffset in="flow-field" result="flowing-field">
        <animate attributeName="dx" values="0;65;0;-50;0" dur="8.4s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.25;.5;.75;1" keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1;.42 0 .58 1"/>
        <animate attributeName="dy" values="-20;35;48;-20" dur="11s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.33;.67;1" keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1"/>
      </feOffset>
      <feDisplacementMap in="SourceGraphic" in2="flowing-field" scale="52" xChannelSelector="R" yChannelSelector="G">
        <animate attributeName="scale" values="42;64;51;42" dur="7s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.33;.67;1" keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1"/>
      </feDisplacementMap>
      <feGaussianBlur stdDeviation="3.5"/>
      <feColorMatrix type="matrix" values="0 0 0 0 .157 0 0 0 0 .2 0 0 0 0 .169 0 0 0 1 0"/>
    </filter>
  </defs>`;
  app.prepend(definitions);

  // A radial map bends masonry courses toward the edges without blurring them.
  // The displacement falls back to zero at the exact frame boundary so the
  // barrel curve never samples transparent pixels beyond a scene's edges.
  const field = document.createElement('canvas');
  field.width = field.height = 256;
  const fieldContext = field.getContext('2d')!;
  const radial = fieldContext.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const nx = x / 255 * 2 - 1;
      const ny = y / 255 * 2 - 1;
      const radius = (nx * nx + ny * ny) * .5;
      const index = (y * 256 + x) * 4;
      radial.data[index] = Math.round(127.5 + nx * radius * (1 - nx ** 8) * 88);
      radial.data[index + 1] = Math.round(127.5 + ny * radius * (1 - ny ** 8) * 88);
      radial.data[index + 2] = 128;
      radial.data[index + 3] = 255;
    }
  }
  fieldContext.putImageData(radial, 0, 0);
  definitions.querySelector('#lens-field')!.setAttribute('href', field.toDataURL());

  const context = grain.getContext('2d');
  const view = app.querySelector<HTMLElement>('#view');
  const mobile = window.matchMedia('(pointer: coarse)');
  let noise: ImageData | null = null;
  function resize() {
    grain.width = Math.min(mobile.matches ? 200 : 480, Math.ceil(innerWidth * .45));
    grain.height = Math.min(mobile.matches ? 130 : 300, Math.ceil(innerHeight * .35));
    noise = context?.createImageData(grain.width, grain.height) ?? null;
    definitions.querySelector('#lens-displacement')!.setAttribute('scale', String(Math.min(innerWidth, innerHeight) * .105));
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });
  let lastGrain = 0;
  const tick = (time: number) => {
    if (document.hidden) return;
    if (app.classList.contains('portal-travelling') || app.classList.contains('document-travelling')) return;
    const scene = view?.dataset.screen;
    if (scene !== 'select' && scene !== 'room' && scene !== 'clue') return;
    if (reduced.matches) {
      rig.style.transform = 'none';
      return;
    }
    const x = Math.sin(time * .71) * 2.3 + Math.sin(time * 1.83 + .4) * .75;
    const y = Math.sin(time * .57 + 1.1) * 1.8 + Math.sin(time * 1.49) * .55;
    rig.style.transform = `translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) scale(1.024)`;
    if (!context || !noise || time - lastGrain < (mobile.matches ? .125 : .083)) return;
    lastGrain = time;
    for (let i = 0; i < noise.data.length; i += 4) {
      const shade = Math.floor(Math.random() * 256);
      noise.data[i] = noise.data[i + 1] = noise.data[i + 2] = shade;
      noise.data[i + 3] = 255;
    }
    context.putImageData(noise, 0, 0);
  };
  gsap.ticker.add(tick);
  return () => {
    gsap.ticker.remove(tick);
    window.removeEventListener('resize', resize);
    definitions.remove();
  };
}
