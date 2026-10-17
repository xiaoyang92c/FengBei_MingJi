export type Aperture = { left: number; top: number; width: number; height: number };

/** Pure projection: one initial measurement, compositor transforms throughout. */
export function portalFlightFrame(aperture: Aperture, width: number, height: number, p: number, preview: number, pose = { x: 0, y: 0 }, painted = { left: width * .66, right: width * .66, top: height * .66, bottom: height * .66 }) {
  p = Math.max(0, Math.min(1, p));
  const startX = aperture.left + aperture.width / 2;
  const startY = aperture.top + aperture.height / 2;
  const finalScale = Math.max(width / aperture.width, height / aperture.height) * 1.6;
  const scale = finalScale ** p;
  const firstFill = Math.max(.02, Math.min(.98, Math.log(Math.min(width / aperture.width, height / aperture.height)) / Math.log(finalScale)));
  const tailRate = .14 / (1 - firstFill);
  const t = Math.min(1, p / firstFill);
  const authoredScale = p >= firstFill ? .86 + (p - firstFill) * tailRate
    : (2 * t ** 3 - 3 * t ** 2 + 1) * preview
      + (t ** 3 - 2 * t ** 2 + t) * .54
      + (-2 * t ** 3 + 3 * t ** 2) * .86
      + (t ** 3 - t ** 2) * tailRate * firstFill;
  const centerX = startX + (width / 2 - startX) * p;
  const centerY = startY + (height / 2 - startY) * p - Math.sin(Math.PI * p) * Math.min(12, height * .012);
  const left = centerX - aperture.width * scale / 2;
  const top = centerY - aperture.height * scale / 2;
  const imageX = startX * (1 - p) + (width / 2 + pose.x) * p;
  const imageY = startY * (1 - p) + (height / 2 + pose.y) * p;
  // The viewport can fill before the authored photo zoom catches up. Include
  // current panning and focal cropping so no intermediate frame exposes a gap.
  const requiredScale = Math.max(
    (imageX - Math.max(0, left) + 1) / painted.left,
    (Math.min(width, left + aperture.width * scale) - imageX + 1) / painted.right,
    (imageY - Math.max(0, top) + 1) / painted.top,
    (Math.min(height, top + aperture.height * scale) - imageY + 1) / painted.bottom,
  );
  const sceneScale = Math.max(authoredScale, requiredScale);
  const coverage = Math.min(aperture.width * scale / width, aperture.height * scale / height);
  return {
    scale, sceneScale, left, top, coverage,
    facadeX: centerX - width / 2 - (startX - width / 2) * scale,
    facadeY: centerY - height / 2 - (startY - height / 2) * scale,
    viewportTransform: `translate3d(${left}px,${top}px,0) scale(${scale})`,
    imageTransform: `translate3d(${(imageX - left) / scale}px,${(imageY - top) / scale}px,0) scale(${sceneScale / scale})`,
    imageX, imageY,
  };
}
