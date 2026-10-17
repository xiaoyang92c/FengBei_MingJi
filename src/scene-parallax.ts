type Coverage = { left: number; right: number; top: number; bottom: number };
type Pose = { x: number; y: number; rotationX: number; rotationY: number };
type Clip = { left: number; right: number; top: number; bottom: number };

/** Ray-cast the visible corners onto the tilted photo, keeping its edges outside
 * the aperture. The rotation order matches GSAP's rotateY / rotateX transform. */
export function sceneParallaxScale(width: number, height: number, painted: Coverage, pose: Pose, zoom = 1, clip: Clip = { left: 0, right: width, top: 0, bottom: height }) {
  const perspective = 780;
  const rx = pose.rotationX * Math.PI / 180, ry = pose.rotationY * Math.PI / 180;
  const sx = Math.sin(rx), cx = Math.cos(rx), sy = Math.sin(ry), cy = Math.cos(ry);
  const nx = sy * cx, ny = -sx, nz = cy * cx;
  const numerator = nz * perspective - nx * pose.x - ny * pose.y;
  let required = 1;
  for (const x of [clip.left - 2, clip.right + 2]) for (const y of [clip.top - 2, clip.bottom + 2]) {
    const px = x - width / 2, py = y - height / 2;
    const t = numerator / (nz * perspective - nx * px - ny * py);
    const vx = t * px - pose.x, vy = t * py - pose.y, vz = perspective * (1 - t);
    const localX = (cy * vx - sy * vz) / zoom;
    const localY = (cx * vy + sx * (sy * vx + cy * vz)) / zoom;
    required = Math.max(required, localX / painted.right, -localX / painted.left, localY / painted.bottom, -localY / painted.top);
  }
  return required;
}
