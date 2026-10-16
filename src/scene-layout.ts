import type { Clue, ClueId, Room } from './content';

/** Positions are measured in each source photograph, before cover cropping. */
const desktopStoneGap = .02;
const anchors: Record<ClueId, { mobile: [number, number]; desktop: [number, number] }> = {
  tools: { mobile: [.418, .33], desktop: [.296, .46] },
  together: { mobile: [.545, .535], desktop: [.581, .52] },
  opening: { mobile: [.5, .585], desktop: [.5, .63] },
  // Measured shaft left edge and plinth right edge, with identical clearance.
  title: { mobile: [.46, .505], desktop: [.48 - desktopStoneGap, .305] },
  memorial: { mobile: [.555, .691], desktop: [.545 + desktopStoneGap, .60] },
};

export function sceneLayout(room: Room, width: number, height: number) {
  const desktop = width >= 700 && width > height;
  const sourceWidth = desktop ? 1672 : 1254;
  const sourceHeight = desktop ? 941 : 1254;
  const overscan = desktop ? 1.08 : 1.32;
  const planeWidth = width * overscan;
  const planeHeight = height * overscan;
  const scale = Math.max(planeWidth / sourceWidth, planeHeight / sourceHeight);
  const photoWidth = sourceWidth * scale;
  const photoHeight = sourceHeight * scale;
  const focusY = desktop ? room.desktopFocusY ?? .5 : room.sceneFocusY ?? .5;
  const worldLeft = (width - planeWidth) / 2;
  const worldTop = (height - planeHeight) / 2;
  const photoLeft = planeWidth / 2 - photoWidth / 2;
  // Focal shifts must not reveal an unpainted strip at the edge of the screen.
  const guard = Math.min(40, (photoHeight - height) / 2);
  const wantedTop = height / 2 - photoHeight * focusY;
  const photoTop = Math.max(height + guard - photoHeight, Math.min(-guard, wantedTop)) - worldTop;
  return {
    desktop, src: desktop ? room.desktopScene : room.scene,
    planeWidth, planeHeight, photoWidth, photoHeight, photoLeft, photoTop,
    worldLeft, worldTop,
  };
}

export function sceneBackgroundStyle(room: Room, width: number, height: number) {
  const layout = sceneLayout(room, width, height);
  return `background-image:url('${layout.src}');background-size:${layout.photoWidth}px ${layout.photoHeight}px;background-position:${layout.photoLeft}px ${layout.photoTop}px`;
}

export function clueScenePosition(clue: Clue, room: Room, width: number, height: number) {
  const layout = sceneLayout(room, width, height);
  const [x, y] = anchors[clue.id][layout.desktop ? 'desktop' : 'mobile'];
  const rawX = layout.worldLeft + layout.photoLeft + x * layout.photoWidth;
  const rawY = layout.worldTop + layout.photoTop + y * layout.photoHeight;
  // Keep the touch target reachable even on unusually narrow or short windows.
  const margin = width < 700 ? 32 : 64;
  return {
    x: Math.max(margin, Math.min(width - margin, rawX)),
    y: Math.max(116, Math.min(height - 100, rawY)),
  };
}
