import mastheads from './masthead-shapes.json';

export function mastheadMarkup() {
  const title = mastheads[0];
  return `<h1 class="press-title" aria-label="${title.text}"><svg class="masthead-glyphs" viewBox="0 0 424 100" aria-hidden="true" focusable="false">${title.glyphs.map((shape, index) => `<path class="masthead-glyph" transform="translate(${index * 108} 0)" d="${shape}"/>`).join('')}</svg></h1>`;
}
