import outlines from './loading-digits.json';

/** Center the visible ink, including %, without a device-dependent font fallback. */
export function loadingNumber(value: number) {
  const text = String(Math.max(0, Math.min(100, Math.floor(value)))).padStart(2, '0');
  const shapes = outlines as Record<string, { path: string; width: number }>;
  let x = 0;
  const paths = [...text, '%'].map((letter, index) => {
    const shape = shapes[letter];
    const path = `<path d="${shape.path}" transform="translate(${x.toFixed(3)} 76)"${letter === '%' ? ' opacity=".77"' : ''}/>`;
    x += shape.width + (index === text.length - 1 ? 12 : 4);
    return path;
  }).join('');
  const width = x - 4;
  return `<svg class="crt-counter-vector" aria-hidden="true" viewBox="0 0 ${width.toFixed(3)} 82" style="width:${(width / 100).toFixed(4)}em">${paths}</svg>`;
}
