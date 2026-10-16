import './style.css';
import './paper-ui.css';
import './reading-ui.css';
import './memory-finish.css';
import './memory-ledger.css';
import './field-notes.css';
import './tv-cover.css';
import './tv-finale.css';
import { tvCoverPage, mountTvCover, leaveTvCover } from './tv-cover';
import { tvFinalePage, mountTvFinale } from './tv-finale';
import { cluePage, mountReadingMotion, leaveReadingPage } from './reading-ui';
import { memoryPaper, chapterSheet, mountPaperMotion, mountPencilWashes, foldPaperAway, pencil, circlePencil, capsulePencil, railIcon, bookIcon } from './paper-ui';
import * as THREE from 'three';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { mountAtmosphere } from './atmosphere';
import { SceneAudio } from './scene-audio';
import { BackgroundMusic } from './background-music';
import { UiAudio } from './ui-audio';
import { TvAudio } from './tv-audio';
import { DeviceTilt, type TiltPosition, type TiltState } from './device-tilt';
import { sceneLayout, sceneBackgroundStyle, clueScenePosition } from './scene-layout';
import { clues, rooms, type Clue, type ClueId, type Room, type RoomId } from './content';

gsap.registerPlugin(CustomEase);
const chapterPull = CustomEase.create('chapter-pull', '.3,0,.16,1');
const portalEnter = CustomEase.create('portal-enter', '.42,0,.22,1');
const portalExit = CustomEase.create('portal-exit', '.44,0,.18,1');

const app = document.querySelector<HTMLDivElement>('#app')!;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const touchDevice = window.matchMedia('(pointer: coarse)');
const progressKey = 'fengbei-memory-v2';
let collected = new Set<ClueId>();
try { collected = new Set(JSON.parse(localStorage.getItem(progressKey) || '[]') as ClueId[]); } catch { /* Private browsing may block storage. */ }
collected = new Set([...collected].filter((id) => clues.some((clue) => clue.id === id)));

type Screen =
  | { kind: 'cover' }
  | { kind: 'select'; room: RoomId }
  | { kind: 'room'; room: RoomId }
  | { kind: 'clue'; clue: ClueId }
  | { kind: 'notebook'; room?: RoomId }
  | { kind: 'chapter'; room: RoomId }
  | { kind: 'finale' };

const roomById = (id: string): Room => rooms.find((room) => room.id === id) ?? rooms[0];
const clueById = (id: string): Clue => clues.find((clue) => clue.id === id) ?? clues[0];
const sceneBackground = (room: Room) => sceneBackgroundStyle(room, innerWidth, innerHeight);
// Keep the complete central subject inside the capped door opening on large
// monitors; the phone preview retains its original half-size composition.
const previewSceneScale = () => Math.min(.5, 820 / Math.max(innerWidth, innerHeight));
const sceneAudio = new SceneAudio();
const uiAudio = new UiAudio(() => {});
const travelWindVolume = .29;
const tvAudio = new TvAudio(() => {});
function readRoute(): Screen {
  const [kind, id] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (kind === 'select') return { kind, room: roomById(id).id };
  if (kind === 'room') return { kind, room: roomById(id).id };
  if (kind === 'clue') return { kind, clue: clueById(id).id };
  if (kind === 'notebook') return { kind, room: id ? roomById(id).id : undefined };
  if (kind === 'chapter') return { kind, room: roomById(id).id };
  if (kind === 'finale') return { kind };
  return { kind: 'cover' };
}
let screen = readRoute();
let soundEnabled = screen.kind === 'cover';
let busy = false;
let pan = 0;
let mousePosition = { dx: 0, dy: 0 };
let deviceTilt: DeviceTilt | undefined;
let roomPointerOrigin = { dx: 0, dy: 0 };
let pointerStart: { x: number; y: number; pan: number } | null = null;
let selectionDrag: { pointerId: number; x: number; y: number; index: number; active: boolean } | null = null;
let suppressSelectionClickUntil = 0;
let moved = false;
let disposeCoverMotion: (() => void) | null = null;
let roomUiMotion: gsap.core.Timeline | null = null;
let disposeReadingMotion: (() => void) | null = null;
let disposeFinaleMotion: (() => void) | null = null;
let notebookEndPending = false;
let notebookScroll: gsap.core.Tween | null = null;
let disposePaperMotion: (() => void) | null = null;
let disposePencilWashes: (() => void) | null = null;

app.innerHTML = `
  <div class="ambient-layer" aria-hidden="true"></div>
  <div id="optical-stage" aria-hidden="true"><div id="camera-rig">
    <div id="world-stage"><div id="world-camera"><div class="world-image"></div></div><div class="world-light"></div></div>
    <div id="facade-viewport"><div id="facade-stage"><div id="facade-camera"><div id="facade-track"></div></div></div></div>
  </div></div>
  <div id="view"></div>
  <canvas id="grain-canvas" aria-hidden="true"></canvas>
  <canvas id="travel-canvas" aria-hidden="true"></canvas>
  <audio id="background-music" src="/assets/audio/vintage-travelogue-stream-v46.m4a" loop playsinline preload="none" hidden aria-hidden="true"></audio>
  <div id="lens-vignette" aria-hidden="true"></div>
  <div id="transition-veil" aria-hidden="true"><span class="veil-line"></span></div>
`;
const view = document.querySelector<HTMLElement>('#view')!;
function updateTiltButton() {
  const tiltButton = view.querySelector<HTMLButtonElement>('#tilt-toggle');
  if (!deviceTilt || !tiltButton) return;
  const labels: Record<TiltState, string> = {
    permission: '开启体感', starting: '体感连接中', active: '体感 开', off: '体感 关',
    denied: '体感未授权', 'no-data': '重试体感', insecure: '体感需 HTTPS', unavailable: '体感不支持', reduced: '体感已关闭',
  };
  tiltButton.hidden = !deviceTilt.visible || deviceTilt.state === 'unavailable';
  tiltButton.querySelector('b')!.textContent = deviceTilt.state === 'active' ? '开' : deviceTilt.state === 'permission' ? '开启' : deviceTilt.state === 'starting' ? '连接中' : deviceTilt.state === 'denied' || deviceTilt.state === 'no-data' ? '重试' : '关';
  tiltButton.disabled = ['insecure', 'unavailable', 'reduced'].includes(deviceTilt.state);
  tiltButton.setAttribute('aria-pressed', String(deviceTilt.state === 'active'));
  tiltButton.setAttribute('aria-label', deviceTilt.state === 'active' ? '关闭倾斜视差' : labels[deviceTilt.state]);
  tiltButton.title = deviceTilt.state === 'insecure' ? '请通过 HTTPS 打开页面以使用体感'
    : deviceTilt.state === 'denied' ? '请在浏览器设置中允许动作与方向访问，然后重新开启体感'
    : deviceTilt.state === 'reduced' ? '系统已开启减少动态效果'
    : deviceTilt.state === 'active' ? '轻轻倾斜手机环顾场景，点击关闭' : '保持手机自然握姿，点击开启倾斜视差';
}
const worldStage = document.querySelector<HTMLElement>('#world-stage')!;
const worldCamera = document.querySelector<HTMLElement>('#world-camera')!;
const facadeStage = document.querySelector<HTMLElement>('#facade-stage')!;
const facadeCamera = document.querySelector<HTMLElement>('#facade-camera')!;
const facadeTrack = document.querySelector<HTMLElement>('#facade-track')!;
const cameraRig = document.querySelector<HTMLElement>('#camera-rig')!;
// Convert screen bounds back into the common rig's coordinates. The flight
// inherits the same handheld movement, so measuring it twice would cause a jump.
function cinemaBounds(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const rig = cameraRig.getBoundingClientRect();
  const scale = rig.width / innerWidth;
  return { left: (rect.left - rig.left) / scale, top: (rect.top - rig.top) / scale, width: rect.width / scale, height: rect.height / scale };
}
gsap.set(facadeCamera, { scale: 1.25 });
type LensPose = { x: number; y: number; rotationX: number; rotationY: number };
type FlightMotion = {
  entering: boolean;
  basePointer: { dx: number; dy: number };
  baseWorld: LensPose;
  baseFacade: LensPose;
  progress: number;
  zoom: number;
  sceneScale: number;
  scenePose: LensPose;
  image: HTMLElement;
  opening: HTMLElement;
  viewport: HTMLElement;
  innerShade: SVGPathElement;
  shadeBlur: SVGFEGaussianBlurElement;
  dx: number;
  dy: number;
};
let flightMotion: FlightMotion | null = null;
type PortalSurface = Pick<FlightMotion, 'image' | 'opening' | 'viewport' | 'innerShade' | 'shadeBlur'> & { corners: HTMLElement[]; viewportSize?: string; openingWidth?: number };
const portalSurfaces = new Map<HTMLElement, PortalSurface>();
function lensPose(element: HTMLElement): LensPose {
  return {
    x: Number(gsap.getProperty(element, 'x')),
    y: Number(gsap.getProperty(element, 'y')),
    rotationX: Number(gsap.getProperty(element, 'rotationX')),
    rotationY: Number(gsap.getProperty(element, 'rotationY')),
  };
}
function applyFlightMotion() {
  const motion = flightMotion;
  if (!motion) return;
  const dx = motion.dx - motion.basePointer.dx;
  const dy = motion.dy - motion.basePointer.dy;
  const shiftX = -dx * Math.min(50, innerWidth * .1);
  const shiftY = -dy * 34;
  const turnX = -dy * 5;
  const turnY = dx * 7.5;
  const weight = motion.entering ? 0 : 1 - motion.progress;
  const pose = {
    x: motion.baseWorld.x * weight + shiftX,
    y: motion.baseWorld.y * weight + shiftY,
    rotationX: motion.baseWorld.rotationX * weight + turnX,
    rotationY: motion.baseWorld.rotationY * weight + turnY,
  };
  motion.scenePose = pose;
  if (screen.kind === 'room') {
    gsap.set(worldCamera, pose);
    const hotspots = view.querySelector('.hotspot-field');
    if (hotspots) gsap.set(hotspots, { x: pose.x, y: pose.y });
  }
  gsap.set(facadeCamera, {
    x: motion.baseFacade.x + shiftX / motion.zoom,
    y: motion.baseFacade.y + shiftY / motion.zoom,
    rotationX: motion.baseFacade.rotationX + turnX,
    rotationY: motion.baseFacade.rotationY + turnY,
  });
  syncPortalSceneImages();
}
function moveFacadeLens(dx: number, dy: number, duration = .7) {
  const copyCamera = view.querySelector<HTMLElement>('.select-copy-camera, .room-copy-camera');
  gsap.to(facadeCamera, {
    x: -dx * Math.min(50, innerWidth * .1), y: -dy * 34,
    rotationY: dx * 7.5, rotationX: -dy * 5,
    duration, ease: 'power2.out', overwrite: 'auto', onUpdate: syncPortalSceneImages,
  });
  if (copyCamera) gsap.to(copyCamera, {
    x: -dx * Math.min(20, innerWidth * .04), y: -dy * 11,
    rotationY: dx * 1.8, rotationX: -dy * 1.2,
    duration: duration + .1, ease: 'power2.out', overwrite: 'auto',
  });
}
const grainCanvas = document.querySelector<HTMLCanvasElement>('#grain-canvas')!;
const travelCanvas = document.querySelector<HTMLCanvasElement>('#travel-canvas')!;
const disposeAtmosphere = mountAtmosphere(app, cameraRig, grainCanvas, reduced);
if (import.meta.hot) import.meta.hot.dispose(() => { disposeAtmosphere(); uiAudio.stopAll(); tvAudio.dispose(); });
const travelContext = travelCanvas.getContext('2d');
let travelFrame = 0;
function stopTravelBurst() {
  cancelAnimationFrame(travelFrame);
  travelContext?.clearRect(0, 0, travelCanvas.width, travelCanvas.height);
}
function travelBurst(reverse = false, duration = 1050) {
  if (reduced.matches || !travelContext) return;
  cancelAnimationFrame(travelFrame);
  travelCanvas.width = Math.max(1, Math.round(innerWidth * Math.min(devicePixelRatio, 1.5)));
  travelCanvas.height = Math.max(1, Math.round(innerHeight * Math.min(devicePixelRatio, 1.5)));
  const started = performance.now();
  const particles = Array.from({ length: innerWidth < 600 ? 19 : 30 }, (_, index) => ({
    angle: index / (innerWidth < 600 ? 19 : 30) * Math.PI * 2 + (Math.random() - .5) * .28,
    radius: .27 + Math.random() * .42,
    reach: .1 + Math.random() * .2,
    width: .65 + Math.random() * .95,
  }));
  const draw = (now: number) => {
    const t = Math.min((now - started) / duration, 1);
    const { width, height } = travelCanvas;
    travelContext.clearRect(0, 0, width, height);
    if (t >= 1) return;
    const pulse = Math.sin(Math.PI * t) * .13;
    const span = Math.hypot(width, height) * (.58 + t * .66);
    travelContext.lineCap = 'round';
    for (const particle of particles) {
      const drift = reverse ? 1 - t : t;
      const inner = span * (particle.radius + drift * .18);
      const outer = inner + span * particle.reach;
      const cx = width / 2; const cy = height / 2;
      const x1 = cx + Math.cos(particle.angle) * inner;
      const y1 = cy + Math.sin(particle.angle) * inner;
      const x2 = cx + Math.cos(particle.angle) * outer;
      const y2 = cy + Math.sin(particle.angle) * outer;
      const glow = travelContext.createLinearGradient(x1, y1, x2, y2);
      glow.addColorStop(0, 'rgba(245,235,213,0)');
      glow.addColorStop(.52, `rgba(245,235,213,${pulse})`);
      glow.addColorStop(1, 'rgba(245,235,213,0)');
      travelContext.beginPath();
      travelContext.moveTo(x1, y1);
      travelContext.lineTo(x2, y2);
      travelContext.strokeStyle = glow;
      travelContext.lineWidth = particle.width * Math.min(devicePixelRatio, 1.5);
      travelContext.stroke();
    }
    travelFrame = requestAnimationFrame(draw);
  };
  travelFrame = requestAnimationFrame(draw);
}
let worldRoom: RoomId | null = null;
let facadeRoom: RoomId | null = null;
let awaitingSelectReveal: number | null = null;
let outgoingSelectIndex: number | null = null;
const portalStep = () => innerWidth * (innerWidth < 700 ? 1.32 : .62);
const portalX = (index: number) => innerWidth / 2 - (index + .5) * portalStep();
function updateSelectCopy(x: number) {
  const track = view.querySelector<HTMLElement>('.select-copy-track');
  if (!track) return;
  gsap.set(track, { x });
  track.querySelectorAll<HTMLElement>('.select-copy-panel').forEach((panel, index) => {
    const displacement = x + (index + .5) * portalStep() - innerWidth / 2;
    const distance = Math.abs(displacement) / portalStep();
    const depthLimit = Math.min(60, innerWidth * .07);
    gsap.set(panel.querySelector('.select-heading'), { x: THREE.MathUtils.clamp(-displacement * .1, -depthLimit, depthLimit) });
    gsap.set(panel.querySelector('.select-footer'), { x: THREE.MathUtils.clamp(-displacement * .16, -depthLimit, depthLimit) });
    const visibleIndex = awaitingSelectReveal === null ? roomIndex(screen.kind === 'select' ? screen.room : facadeRoom ?? rooms[0].id) : outgoingSelectIndex;
    const opacity = index === visibleIndex ? THREE.MathUtils.clamp((.85 - distance) / .62, 0, 1) : 0;
    panel.style.opacity = String(opacity);
  });
}
function setPortalX(x: number) {
  gsap.set(facadeTrack, { x });
  updateSelectCopy(x);
  syncPortalSceneImages();
}
let dragXTo: ReturnType<typeof gsap.quickTo> | null = null;
function followPortalX(x: number) {
  if (!dragXTo) {
    const updateBlur = chapterMotionBlur();
    dragXTo = gsap.quickTo(facadeTrack, 'x', {
      duration: reduced.matches ? 0 : touchDevice.matches ? .09 : .14, ease: 'power2.out',
      onUpdate: () => { updateBlur(); updateSelectCopy(Number(gsap.getProperty(facadeTrack, 'x'))); syncPortalSceneImages(); },
      onComplete: clearChapterBlur,
    });
  }
  dragXTo(x);
}
function clearChapterBlur() {
  facadeTrack.style.filter = '';
  document.querySelector('#chapter-motion-blur')?.setAttribute('stdDeviation', '0 0');
}
function chapterMotionBlur() {
  // A moving, three-screen-wide SVG blur forces Safari to rasterize the wall.
  if (touchDevice.matches) return () => {};
  let lastX = Number(gsap.getProperty(facadeTrack, 'x'));
  let lastTime = performance.now();
  const blur = document.querySelector('#chapter-motion-blur');
  if (!reduced.matches) facadeTrack.style.filter = 'url(#chapter-motion)';
  return () => {
    const x = Number(gsap.getProperty(facadeTrack, 'x'));
    const now = performance.now();
    const speed = Math.abs(x - lastX) / Math.max(8, now - lastTime);
    const streak = reduced.matches ? 0 : Math.min(innerWidth < 700 ? 9 : 13, Math.max(0, speed - .04) * 3);
    blur?.setAttribute('stdDeviation', `${streak.toFixed(2)} ${(streak * .025).toFixed(2)}`);
    lastX = x; lastTime = now;
  };
}
function finishSelectReveal(index: number) {
  if (awaitingSelectReveal !== index) return;
  awaitingSelectReveal = null;
  outgoingSelectIndex = null;
  const panel = view.querySelectorAll<HTMLElement>('.select-copy-panel')[index];
  if (panel) {
    panel.classList.add('is-readable');
    // Child elements own their entrance; the moving panel keeps positional opacity.
    panel.style.opacity = '1';
  }
}
function slidePortalTo(index: number, duration = 1.05) {
  dragXTo?.tween.kill();
  dragXTo = null;
  const x = portalX(index);
  if (!duration) { clearChapterBlur(); setPortalX(x); finishSelectReveal(index); return; }
  const updateBlur = chapterMotionBlur();
  gsap.to(facadeTrack, {
    x, duration, ease: chapterPull, overwrite: 'auto',
    onUpdate: function () {
      updateBlur();
      if (this.progress() >= .74) finishSelectReveal(index);
      updateSelectCopy(Number(gsap.getProperty(facadeTrack, 'x')));
      syncPortalSceneImages();
    },
    onComplete: () => {
      clearChapterBlur();
      updateSelectCopy(x);
      finishSelectReveal(index);
    },
  });
}
let worldReady = false;
let navigation: gsap.core.Timeline | null = null;
let portalTravelInProgress = false;
let lastWorldPose = '';
const imageCache = new Map<string, Promise<void>>();
function preloadScene(room: Room) {
  const src = sceneLayout(room, innerWidth, innerHeight).src;
  if (!imageCache.has(src)) imageCache.set(src, new Promise<void>((resolve) => {
    const image = new Image(); image.src = src;
    image.decode().then(() => resolve()).catch(() => resolve());
  }));
  return imageCache.get(src)!;
}
function preloadFacade(room: Room) {
  const image = new Image();
  image.src = room.door;
}
const coverImages = new Map<string, Promise<void>>();
function preloadCoverImage(url: string) {
  let pending = coverImages.get(url);
  if (!pending) {
    const image = new Image();
    image.src = url;
    pending = image.decode().catch(() => { coverImages.delete(url); });
    coverImages.set(url, pending);
  }
  return pending;
}
function coverLoaders(): Array<() => Promise<unknown>> {
  return [
    ...rooms.map(room => () => preloadScene(room)),
    ...rooms.map(room => () => preloadCoverImage(room.door)),
    ...['portal-wall-balanced-v22.webp', 'foliage-projection-v19.webp', 'notebook-paper-v4.webp'].map(name => () => preloadCoverImage(`/assets/scenes/${name}`)),
    () => tvAudio.preload(),
    () => document.fonts.ready,
  ];
}
function screenRoom(state: Screen): RoomId {
  if (state.kind === 'finale') return 'monument';
  return state.kind === 'room' || state.kind === 'select' || state.kind === 'chapter' ? state.room
    : state.kind === 'clue' ? clueById(state.clue).roomId
    : rooms[0].id;
}
function roomCameraPose() {
  const dx = mousePosition.dx - roomPointerOrigin.dx;
  const dy = mousePosition.dy - roomPointerOrigin.dy;
  return { x: pan * .35 - dx * Math.min(50, innerWidth * .1), y: -dy * 34, rotationY: dx * 7.5, rotationX: -dy * 5 };
}
function syncHotspotPosition() {
  const field = view.querySelector('.hotspot-field');
  if (field) gsap.set(field, { x: Number(gsap.getProperty(worldCamera, 'x')), y: Number(gsap.getProperty(worldCamera, 'y')) });
}
function layoutHotspots() {
  view.querySelectorAll<HTMLElement>('.clue-marker').forEach(marker => {
    const clue = clueById(marker.dataset.id!);
    const position = clueScenePosition(clue, roomById(clue.roomId), innerWidth, innerHeight);
    marker.style.left = `${position.x}px`;
    marker.style.top = `${position.y}px`;
  });
}
function updateWorld(immediate = false) {
  const id = screen.kind === 'notebook' ? worldRoom ?? rooms[0].id : screenRoom(screen);
  const duration = reduced.matches || immediate || !worldReady || portalTravelInProgress ? 0 : .65;
  const room = roomById(id);
  const image = worldCamera.querySelector<HTMLElement>('.world-image')!;
  const layout = sceneLayout(room, innerWidth, innerHeight);
  image.style.cssText = `${sceneBackground(room)};inset:auto;left:${layout.worldLeft}px;top:${layout.worldTop}px;width:${layout.planeWidth}px;height:${layout.planeHeight}px`;
  worldRoom = id;
  const pose = `${screen.kind}/${screen.kind === 'clue' ? screen.clue : id}`;
  if (pose === lastWorldPose) return;
  lastWorldPose = pose;
  gsap.set(worldStage, { clipPath: 'none' });
  const inScene = screen.kind === 'room' || screen.kind === 'clue';
  const scale = screen.kind === 'clue' ? 1.04 : screen.kind === 'select' || screen.kind === 'room' ? 1 : 1.1;
  const cameraPose = inScene ? roomCameraPose() : { x: 0, y: 0, rotationX: 0, rotationY: 0 };
  worldStage.classList.toggle('room-world', inScene);
  gsap.to(worldCamera, { scale, ...cameraPose, duration, ease: 'power2.inOut', overwrite: 'auto', onUpdate: syncHotspotPosition });
  gsap.killTweensOf(worldStage);
  const behindFacade = screen.kind === 'cover' || screen.kind === 'select' || screen.kind === 'finale';
  gsap.to(worldStage, { opacity: behindFacade ? 0 : screen.kind === 'notebook' ? .35 : 1, duration: behindFacade ? 0 : duration * .7, overwrite: true });
  worldReady = true;
}
function hidePortalSurface(surface: PortalSurface) {
  if (surface.viewport.style.visibility === 'hidden') return;
  surface.viewport.style.visibility = 'hidden';
  surface.innerShade.style.opacity = '0';
  surface.innerShade.removeAttribute('d');
}
function syncPortalSceneImages() {
  // Mobile previews travel inside their small native clipping rectangle. Only
  // doorway flights need screen-sized projected polygons and geometry reads.
  if (touchDevice.matches && screen.kind === 'select' && !flightMotion && !portalTravelInProgress) {
    const size = `${innerWidth}/${innerHeight}`;
    portalSurfaces.forEach(surface => {
      hidePortalSurface(surface);
      if (surface.image.parentElement !== surface.opening) {
        surface.opening.append(surface.image);
        surface.viewportSize = undefined;
      }
      if (surface.viewportSize === size) return;
      const room = roomById(surface.viewport.dataset.room!);
      const layout = sceneLayout(room, innerWidth, innerHeight);
      const scale = previewSceneScale() / Number(gsap.getProperty(facadeCamera, 'scaleX'));
      surface.image.style.cssText = `${sceneBackground(room)};inset:auto;width:${layout.planeWidth}px;height:${layout.planeHeight}px;left:50%;top:50%;transform:translate(-50%,-50%) scale(${scale})`;
      surface.viewportSize = size;
    });
    return;
  }
  portalSurfaces.forEach(surface => {
    if (surface.image.parentElement !== surface.viewport) {
      surface.viewport.prepend(surface.image);
      surface.viewportSize = undefined;
    }
  });
  if (!flightMotion && screen.kind !== 'select') {
    portalSurfaces.forEach(hidePortalSurface);
    return;
  }
  const rig = cameraRig.getBoundingClientRect();
  const rigScale = rig.width / innerWidth;
  const viewportSize = `${innerWidth}/${innerHeight}`;
  const bounds = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return { left: (rect.left - rig.left) / rigScale, top: (rect.top - rig.top) / rigScale, width: rect.width / rigScale, height: rect.height / rigScale };
  };
  // Read all active geometry before touching any style. Hidden rooms need no
  // polygon, image transform, or full-screen shadow work during a flight.
  const positions = [...portalSurfaces.values()].map(surface => {
    const motion = flightMotion?.opening === surface.opening ? flightMotion : null;
    if (flightMotion && !motion) return { surface, geometry: null };
    const rect = bounds(surface.opening);
    if (!motion && (rect.left + rect.width < 0 || rect.left > innerWidth)) return { surface, geometry: null };
    const resized = surface.viewportSize !== viewportSize;
    const openingWidth = resized ? surface.opening.offsetWidth : surface.openingWidth ?? surface.opening.offsetWidth;
    const renderedScale = rect.width / openingWidth;
    if (!Number.isFinite(renderedScale) || renderedScale <= 0) return { surface, geometry: null };
    const corners = surface.corners.map(bounds);
    return { surface, geometry: { rect, renderedScale, motion, resized, openingWidth, corners } };
  });
  positions.forEach(({ surface, geometry }) => {
    if (!geometry) { hidePortalSurface(surface); return; }
    const { rect, renderedScale, motion, resized, openingWidth, corners } = geometry;
    const p = motion ? (motion.entering ? motion.progress : 1 - motion.progress) : 0;
    const openingX = rect.left + rect.width / 2;
    const openingY = rect.top + rect.height / 2;
    const centerX = motion ? openingX * (1 - p) + (innerWidth / 2 + motion.scenePose.x) * p : openingX;
    const centerY = motion ? openingY * (1 - p) + (innerHeight / 2 + motion.scenePose.y) * p : openingY;
    surface.viewport.style.visibility = 'visible';
    surface.viewport.style.clipPath = `polygon(${corners.map(corner => `${corner.left}px ${corner.top}px`).join(',')})`;
    const coverage = Math.min(rect.width / innerWidth, rect.height / innerHeight);
    const shadeStrength = .208 * (1 - THREE.MathUtils.smoothstep(coverage, .92, 1.12));
    surface.innerShade.style.opacity = String(shadeStrength);
    // Explicit "visible" would override a hidden viewport and leave its last
    // clipped shadow at the screen edge after this window slides off screen.
    surface.innerShade.style.visibility = shadeStrength > .0001 ? 'inherit' : 'hidden';
    if (shadeStrength > .0001) {
      const padding = 72;
      surface.innerShade.setAttribute('d', `M${-padding},${-padding}H${innerWidth + padding}V${innerHeight + padding}H${-padding}Z M${corners.map(corner => `${corner.left},${corner.top}`).join('L')}Z`);
      surface.innerShade.setAttribute('transform', `translate(0 ${Math.min(28, 7 * renderedScale)})`);
      surface.shadeBlur.setAttribute('stdDeviation', String(Math.min(20, 9 * renderedScale)));
    }
    if (resized) {
      surface.viewportSize = viewportSize;
      surface.openingWidth = openingWidth;
      const filter = surface.shadeBlur.parentElement!;
      filter.setAttribute('x', '-72');
      filter.setAttribute('y', '-72');
      filter.setAttribute('width', String(innerWidth + 144));
      filter.setAttribute('height', String(innerHeight + 144));
      const room = roomById(surface.viewport.dataset.room!);
      const layout = sceneLayout(room, innerWidth, innerHeight);
      surface.image.style.cssText = `${sceneBackground(room)};width:${layout.planeWidth}px;height:${layout.planeHeight}px;left:${-layout.planeWidth / 2}px;top:${-layout.planeHeight / 2}px`;
    }
    surface.image.style.transform = `translate3d(${centerX}px,${centerY}px,0) rotateY(${(motion?.scenePose.rotationY ?? 0) * p}deg) rotateX(${(motion?.scenePose.rotationX ?? 0) * p}deg) scale(${motion?.sceneScale ?? previewSceneScale()})`;
  });
}

function installPortalSurfaces() {
  facadeTrack.querySelectorAll<HTMLElement>('.portal-scene').forEach((opening, index) => {
    const image = opening.querySelector<HTMLElement>('.portal-scene-image')!;
    const corners: HTMLElement[] = [];
    for (const [left, top] of [[0, 0], [100, 0], [100, 100], [0, 100]]) {
      const corner = document.createElement('i');
      corner.className = 'portal-aperture-corner';
      corner.style.cssText = `position:absolute;left:${left}%;top:${top}%;width:0;height:0;pointer-events:none`;
      opening.append(corner);
      corners.push(corner);
    }
    const viewport = document.createElement('div');
    viewport.className = 'portal-live-scene';
    viewport.dataset.room = rooms[index].id;
    const shade = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    shade.classList.add('portal-live-shade');
    const filterId = `portal-inner-shade-${index}`;
    shade.innerHTML = `<defs><filter id="${filterId}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0"/></filter></defs><path fill="#28221b" fill-rule="evenodd" filter="url(#${filterId})"/>`;
    viewport.append(image, shade);
    cameraRig.append(viewport);
    portalSurfaces.set(opening, { image, opening, viewport, corners, innerShade: shade.querySelector('path')!, shadeBlur: shade.querySelector('feGaussianBlur')! });
  });
}
function updateFacade(immediate = false) {
  if (portalTravelInProgress) return;
  const id = screen.kind === 'notebook' ? facadeRoom ?? rooms[0].id : screenRoom(screen);
  const select = screen.kind === 'select';
  const first = facadeRoom === null;
  const duration = immediate || reduced.matches || first ? 0 : 1.5;
  if (first) {
    facadeTrack.innerHTML = `<div class="masonry-surface"><i></i><i></i></div><div class="foliage-projection"><i></i><b></b></div><div class="architectural-shadow"><i></i></div>` + rooms.map((room, index) => `<div class="facade-page" style="left:calc(${index} * var(--portal-step))"><div class="portal-panel"><div class="portal-scene"><div class="portal-scene-image" style="${sceneBackground(room)}"></div></div><img class="portal-frame" src="${room.door}" alt=""></div></div>`).join('');
    installPortalSurfaces();
  }
  if (facadeRoom !== id) {
    slidePortalTo(roomIndex(id), duration && select ? 1.05 : 0);
    facadeRoom = id;
  } else if (select) updateSelectCopy(Number(gsap.getProperty(facadeTrack, 'x')));
  // Cancel delayed fades as well as active tweens before exposing a new
  // window. Only travelRoom owns the physical push through the doorway.
  gsap.killTweensOf(facadeStage);
  gsap.set(facadeStage, { scale: 1, x: 0, y: 0, opacity: select ? 1 : 0, visibility: select ? 'visible' : 'hidden' });
  syncPortalSceneImages();
}

window.addEventListener('resize', () => {
  lastWorldPose = '';
  updateWorld(true);
  layoutHotspots();
  void preloadScene(roomById(worldRoom ?? screenRoom(screen)));
  if (facadeRoom && !portalTravelInProgress) {
    gsap.killTweensOf(facadeTrack);
    clearChapterBlur();
    const index = roomIndex(facadeRoom);
    setPortalX(portalX(index));
    finishSelectReveal(index);
  }
  syncPortalSceneImages();
}, { passive: true });

const bgm = document.querySelector<HTMLAudioElement>('#background-music')!;
const backgroundMusic = new BackgroundMusic(bgm);
let audioContext: AudioContext | null = null;
function startAudioContext() {
  if (audioContext) { void audioContext.resume().catch(() => {}); uiAudio.preload(audioContext); return; }
  try {
    audioContext = new AudioContext();
    uiAudio.preload(audioContext);
  } catch { /* Audio can be unlocked by a later gesture. */ }
}
function syncBgm() {
  const television = screen.kind === 'cover' || screen.kind === 'finale';
  tvAudio.sync(television, soundEnabled);
  uiAudio.setEnabled(soundEnabled && !document.hidden);
  if (document.hidden) uiAudio.stopAll();
  const sceneId = screen.kind === 'room' || screen.kind === 'chapter' ? screen.room : screen.kind === 'clue' ? clueById(screen.clue).roomId : screen.kind === 'notebook' ? worldRoom : null;
  sceneAudio.sync(audioContext, sceneId, soundEnabled && !document.hidden, screen.kind === 'clue' || screen.kind === 'notebook' || screen.kind === 'chapter');
  const shouldPlay = soundEnabled && !document.hidden && (screen.kind !== 'cover' || backgroundMusic.primed);
  const musicLevel = screen.kind === 'cover' ? 0 : sceneId || screen.kind === 'finale' ? .075 : .36;
  backgroundMusic.sync(audioContext, shouldPlay, musicLevel);
}
function setSound(value: boolean) {
  soundEnabled = value;
  uiAudio.setEnabled(value && !document.hidden);
  if (!value) uiAudio.stopAll();
  if (value) { startAudioContext(); if (audioContext) backgroundMusic.unlock(audioContext); }
  updateSoundButton();
  syncBgm();
}
function updateSoundButton() {
  const finaleSound = view.querySelector<HTMLButtonElement>('[data-finale-sound]');
  if (finaleSound) {
    finaleSound.textContent = `声音 ${soundEnabled ? '开' : '关'}`;
    finaleSound.setAttribute('aria-pressed', String(soundEnabled));
    finaleSound.setAttribute('aria-label', soundEnabled ? '关闭声音' : '开启声音');
  }
  const sound = view.querySelector<HTMLButtonElement>('[data-action="sound"]');
  if (!sound) return;
  // Keep the existing bars so toggling sound can animate from their current height.
  if (!sound.querySelector('.sound-wave')) {
    sound.innerHTML = `${capsulePencil}<span class="sound-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="sound-label">声音</span><b aria-hidden="true"></b>`;
  }
  sound.querySelector('b')!.textContent = soundEnabled ? '开' : '关';
  sound.classList.toggle('is-on', soundEnabled);
  sound.setAttribute('aria-label', soundEnabled ? '关闭声音' : '开启声音');
  sound.setAttribute('aria-pressed', String(soundEnabled));
}
document.addEventListener('visibilitychange', syncBgm);
window.addEventListener('pageshow', syncBgm);
document.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
document.addEventListener('keydown', unlockAudio, { capture: true });
function unlockAudio() {
  if (!soundEnabled || document.hidden) return;
  startAudioContext();
  if (audioContext) backgroundMusic.unlock(audioContext);
  syncBgm();
}
if (import.meta.hot) import.meta.hot.dispose(() => {
  backgroundMusic.dispose();
  document.removeEventListener('visibilitychange', syncBgm);
  window.removeEventListener('pageshow', syncBgm);
  document.removeEventListener('pointerdown', unlockAudio, true);
  document.removeEventListener('keydown', unlockAudio, true);
});
const roomIndex = (id: RoomId) => rooms.findIndex((room) => room.id === id);
const soundButton = `<div class="scene-controls"><button id="tilt-toggle" class="tilt-toggle sound-toggle pencil-control" type="button" data-action="tilt" hidden aria-pressed="false" aria-label="开启体感">${capsulePencil}<span class="sound-label">体感</span><b>开启</b></button><button class="sound-toggle pencil-control" data-action="sound" aria-label="切换声音"></button></div>`;
function passageButton(room: Room, leaving = false) {
  const label = leaving ? '切换空间' : '进入空间';
  const arrow = 'M5 19 17 7M5 7H17V19';
  return `<button class="ticket-button sketch-control passage-pass pencil-control" data-action="${leaving ? 'change-room' : 'enter-room'}" aria-label="${label}">${pencil}<svg class="pass-outline" viewBox="0 0 216 54" preserveAspectRatio="none" aria-hidden="true"><path d="M.75 .75H46L50 4.5 54 .75H215.25V53.25H54L50 49.5 46 53.25H.75Z"/></svg><span class="pass-stub" aria-hidden="true"><i>${String(roomIndex(room.id)+1).padStart(2,'0')}</i></span><span class="pass-label">${label}</span><b class="pass-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${arrow}"/></svg></b></button>`;
}
function chapterTitle(room: Room) {
  return `<span class="chapter-eyebrow"><span>记忆空间</span><i aria-hidden="true">/</i><small lang="en">MEMORY SPACE</small></span><h1 aria-label="${room.title}">${Array.from(room.title).map((letter, i) => `<span class="title-glyph" style="--glyph:${i}" aria-hidden="true"><i class="glyph-ink" data-ink="${letter}">${letter}</i></span>`).join('')}</h1>`;
}
const doodle = {
  enter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 17 7M5 7H17V19"/></svg>',
  left: '<svg viewBox="0 0 42 28" aria-hidden="true"><path d="M35 14.8c-9-.6-18 .3-28-.4m.3 0 8-7.3M7.3 14.5l8.4 6.8"/></svg>',
  right: '<svg viewBox="0 0 42 28" aria-hidden="true"><path d="M6 13.3c9.8.9 18.1-.2 28.6.5m-.2 0-7.6-7.1m7.6 7.1-8.3 7.4"/></svg>',
  book: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4.2 5.5c4.3-2.7 8.4-1.6 11.4.8 3.2-2.3 7.7-3.1 11.9-.9l-.5 21c-4.2-1.3-8-.8-11.4 1.3-3.7-2.5-7.5-2.9-11.4-1.4zM15.6 6.3v21.3M7.3 10.2c2.3-.9 4-.4 5.3.1m7.1 0c1.5-.6 3.2-.7 5-.2M7.4 14c2-.5 3.8-.3 5.2.1"/></svg>',
  sound: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4.8 12.4l5.3-.3 6.6-5.2.2 18.4-6.8-5.4-5.3.1zM21 11.2c2.1 2.3 2.2 7.1.1 9.5m3.3-13c4.3 4.4 4.5 13.7-.1 18"/></svg>',
  mute: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4.8 12.4l5.3-.3 6.6-5.2.2 18.4-6.8-5.4-5.3.1zM21.3 12.5l7.1 7.2m.2-7.1-7.3 7.3"/></svg>',
};
function coverMarkup() {
  return tvCoverPage();
}
function selectMarkup(room: Room) {
  const index = roomIndex(room.id);
  return `<section class="screen select-screen" aria-label="选择记忆空间"><div class="select-copy-camera"><div class="select-copy-track">${rooms.map((item, i) => `<div class="select-copy-panel ${i === index ? 'is-active is-readable' : ''}" data-room="${item.id}" style="left:calc(${i} * var(--portal-step))" ${i === index ? '' : 'inert'}><div class="select-heading">${chapterTitle(item)}</div><div class="select-footer"><div class="pass-arrival">${passageButton(item)}</div></div></div>`).join('')}</div></div><button class="portal-entry" data-action="enter-room" aria-label="穿过门，进入${room.title}"></button><div class="select-navigation"><button class="sketch-control pencil-control" data-action="prev-room" ${index === 0 ? 'disabled' : ''} aria-label="上一处空间">${circlePencil}${doodle.left}</button><button class="sketch-control pencil-control" data-action="next-room" ${index === 2 ? 'disabled' : ''} aria-label="下一处空间">${circlePencil}${doodle.right}</button></div>${soundButton}</section>`;
}
function syncSelectionUi(room: Room) {
  const index = roomIndex(room.id);
  view.querySelectorAll<HTMLElement>('.select-copy-panel').forEach((panel, i) => {
    panel.classList.toggle('is-active', i === index);
    panel.classList.toggle('is-readable', i === index && awaitingSelectReveal === null);
    panel.inert = i !== index;
  });
  const entry = view.querySelector('.portal-entry');
  entry?.setAttribute('aria-label', `穿过门，进入${room.title}`);
  view.querySelector<HTMLButtonElement>('[data-action="prev-room"]')!.disabled = index === 0;
  view.querySelector<HTMLButtonElement>('[data-action="next-room"]')!.disabled = index === rooms.length - 1;
}
function observationMarker(clue: Clue) {
  const recorded = collected.has(clue.id);
  const position = clueScenePosition(clue, roomById(clue.roomId), innerWidth, innerHeight);
  return `<button class="clue-marker pencil-control clue-${clue.id} ${recorded ? 'done' : ''}" data-action="clue" data-id="${clue.id}" style="left:${position.x}px;top:${position.y}px" aria-label="${clue.number} ${clue.label}${recorded ? '，已收录' : '，点击观察'}">
    ${circlePencil}<i aria-hidden="true"><b>${clue.number}</b></i>
    ${recorded ? '<svg class="marker-recorded" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7"/><path d="m4.5 8 2.3 2.3 4.7-4.7"/></svg>' : ''}
    <span class="marker-caption" aria-hidden="true"><small>${recorded ? '已收录' : '现场观察'}</small><strong>${clue.label}</strong></span>
  </button>`;
}
function roomMarkup(room: Room) {
  const roomClues = clues.filter((clue) => clue.roomId === room.id);
  const localCount = roomClues.filter((clue) => collected.has(clue.id)).length;
  return `<section class="screen room-screen room-${room.id}" aria-label="${room.title}"><div class="room-controls room-hud"><button class="room-hud-side hud-left" data-action="chapter-notes" data-id="${room.id}" aria-label="查看${room.title}线索，已收录${localCount}条，共${roomClues.length}条"><span class="hud-fill" aria-hidden="true"></span><span class="hud-board">${pencil}<span class="hud-compact"><span class="hud-symbol">${railIcon}</span><strong>现场手记</strong><b class="hud-count">${localCount}<em>/</em>${roomClues.length}</b></span></span></button><button class="room-hud-side hud-right" data-action="notebook" aria-label="打开记忆册，已收录${collected.size}条线索"><span class="hud-fill" aria-hidden="true"></span><span class="hud-board">${pencil}<span class="hud-compact"><span class="hud-symbol">${bookIcon}</span><strong>记忆册</strong><b class="hud-count">${collected.size}<em>/</em>5</b></span></span></button></div><div class="hotspot-field" aria-label="场景线索">${roomClues.map(observationMarker).join('')}</div><div class="room-copy-camera"><div class="room-footer"><div class="pass-arrival">${passageButton(room, true)}</div></div></div>${soundButton}</section>`;
}
function clueMarkup(clue: Clue) {
  return cluePage(clue, collected.has(clue.id));
}
function setupClueMotion() {
  disposeReadingMotion = mountReadingMotion(view, reduced.matches, phase => {
    gsap.to(worldCamera, { scale: [1.03, 1.06, 1.03][phase], duration: reduced.matches ? 0 : .85, ease: 'power2.out', overwrite: 'auto' });
  });
}
function notebookMarkup() {
  return memoryPaper(collected, roomById(worldRoom ?? 'worksite'));
}
function finaleMarkup() {
  return tvFinalePage(soundEnabled);
}
function mountFinaleMotion() {
  if (screen.kind !== 'finale') return;
  disposeFinaleMotion = mountTvFinale(view, reduced.matches, {
    ready: () => tvAudio.ready(),
    powerOn: () => tvAudio.powerOn(), ambience: () => tvAudio.startAmbience(),
    hover: () => tvAudio.hover(), click: () => tvAudio.click(), stopHover: () => tvAudio.stopHover(),
  }, action => handleAction(action));
}
async function scrollNotebookToEnding() {
  const paper = view.querySelector<HTMLElement>('.memory-newspaper');
  if (!paper) return;
  await Promise.allSettled([document.fonts.ready, ...[...paper.querySelectorAll('img')].map(image => image.decode())]);
  if (!paper.isConnected || screen.kind !== 'notebook') return;
  const ending = paper.querySelector<HTMLElement>('#notebook-finale');
  if (!ending) return;
  const offset = (paper.querySelector<HTMLElement>('.ledger-tabs')?.offsetHeight ?? 10) + 20;
  const target = Math.min(paper.scrollHeight - paper.clientHeight, paper.scrollTop + ending.getBoundingClientRect().top - paper.getBoundingClientRect().top - offset);
  notebookScroll = gsap.to(paper, { scrollTop: Math.max(0, target), duration: reduced.matches ? 0 : 1.6, ease: 'power2.inOut', overwrite: 'auto' });
}

function stageRoomHud() {
  const hud = view.querySelector<HTMLElement>('.room-hud');
  if (!hud || reduced.matches) return;
  gsap.set(hud.querySelectorAll('.room-hud-side'), { autoAlpha: 0, y: -22 });
  gsap.set(hud.querySelectorAll('.hud-fill'), { scaleX: 0 });
  gsap.set(hud.querySelector('.hud-left .hud-board'), { x: -42, autoAlpha: 0 });
  gsap.set(hud.querySelector('.hud-right .hud-board'), { x: 42, autoAlpha: 0 });
  gsap.set(hud.querySelectorAll('.hud-compact'), { autoAlpha: 0, y: -8 });
}
function stageRoomUi() {
  if (screen.kind !== 'room' || reduced.matches) return;
  stageRoomHud();
  gsap.set(view.querySelectorAll('.room-footer,.room-screen .scene-controls,.voice-marker,.clue-marker'), { autoAlpha: 0, y: -24 });
}
function revealRoomHud() {
  const hud = view.querySelector<HTMLElement>('.room-hud');
  if (!hud || screen.kind !== 'room' || reduced.matches) return;
  const left = hud.querySelector<HTMLElement>('.hud-left')!;
  const right = hud.querySelector<HTMLElement>('.hud-right')!;
  const timeline = gsap.timeline();
  timeline.to([left, right], { autoAlpha: 1, y: 0, duration: .28, stagger: .07, ease: 'power2.out' }, 0);
  timeline.to(left.querySelector('.hud-fill'), { scaleX: 1, duration: .3, ease: 'power2.out' }, .08);
  timeline.to(right.querySelector('.hud-fill'), { scaleX: 1, duration: .3, ease: 'power2.out' }, .15);
  timeline.to(left.querySelector('.hud-board'), { x: 0, autoAlpha: 1, duration: .42, ease: 'power3.out' }, .33);
  timeline.to(right.querySelector('.hud-board'), { x: 0, autoAlpha: 1, duration: .42, ease: 'power3.out' }, .4);
  timeline.to(hud.querySelectorAll('.hud-compact'), { autoAlpha: 1, y: 0, duration: .3, stagger: .035, ease: 'power2.out' }, .56);
  return timeline;
}
/** Door arrival and returning from a document share exactly the same scene UI. */
function revealRoomUi() {
  if (screen.kind !== 'room' || reduced.matches) return;
  roomUiMotion?.kill();
  const chrome = view.querySelectorAll('.room-footer,.room-screen .scene-controls,.voice-marker');
  const markers = view.querySelectorAll('.clue-marker');
  roomUiMotion = gsap.timeline()
    .to(chrome, { autoAlpha: 1, y: 0, duration: .44, stagger: .035, ease: 'power2.out' }, 0)
    .to(markers, { autoAlpha: 1, y: 0, duration: .44, stagger: .08, ease: 'power2.out' }, .07);
  const hud = revealRoomHud();
  if (hud) roomUiMotion.add(hud, 0);
}
/** Finish every control's departure before replacing the room with a document. */
function leaveRoomUi(): gsap.core.Timeline {
  roomUiMotion?.kill();
  const timeline = gsap.timeline();
  roomUiMotion = timeline;
  const chrome = view.querySelectorAll('.room-footer,.room-screen .scene-controls,.voice-marker,.clue-marker');
  timeline.to(chrome, { autoAlpha: 0, y: -24, duration: .22, stagger: .02, ease: 'power2.in' }, 0);
  const hud = view.querySelector('.room-hud');
  if (hud) {
    timeline.to(hud.querySelectorAll('.hud-compact'), { autoAlpha: 0, y: -9, duration: .16, ease: 'power2.in' }, 0)
      .to(hud.querySelector('.hud-left .hud-board'), { x: -40, autoAlpha: 0, duration: .23, ease: 'power2.in' }, .08)
      .to(hud.querySelector('.hud-right .hud-board'), { x: 40, autoAlpha: 0, duration: .23, ease: 'power2.in' }, .08)
      .to(hud.querySelectorAll('.hud-fill'), { scaleX: 0, duration: .2, ease: 'power2.in' }, .21)
      .to(hud.querySelectorAll('.room-hud-side'), { autoAlpha: 0, y: -22, duration: .2, ease: 'power2.in' }, .28);
  }
  return timeline;
}
function render(finaleBackdrop?: HTMLElement) {
  roomUiMotion?.kill();
  roomUiMotion = null;
  disposeCoverMotion?.();
  disposeCoverMotion = null;
  uiAudio.stop('pencil');
  const previousRoute = view.dataset.route;
  notebookScroll?.kill();
  notebookScroll = null;
  disposeFinaleMotion?.();
  disposeFinaleMotion = null;
  disposeReadingMotion?.();
  disposeReadingMotion = null;
  disposePaperMotion?.();
  disposePaperMotion = null;
  disposePencilWashes?.();
  disposePencilWashes = null;
  screen = readRoute();
  // Every visit to the TV starts with sound; the entry choice applies afterward.
  if (screen.kind === 'cover') soundEnabled = true;
  if (screen.kind === 'finale' && collected.size < 5) {
    location.hash = '#notebook';
    return;
  }
  view.innerHTML = screen.kind === 'cover' ? coverMarkup()
    : screen.kind === 'select' ? selectMarkup(roomById(screen.room))
    : screen.kind === 'room' ? roomMarkup(roomById(screen.room))
    : screen.kind === 'clue' ? clueMarkup(clueById(screen.clue))
    : screen.kind === 'notebook' ? notebookMarkup()
    : screen.kind === 'chapter' ? chapterSheet(roomById(screen.room), collected)
    : screen.kind === 'finale' ? finaleMarkup()
    : roomMarkup(roomById('worksite'));
  if (screen.kind === 'finale' && finaleBackdrop) {
    const root = view.firstElementChild as HTMLElement;
    root.classList.add('is-over-paper');
    root.prepend(finaleBackdrop);
    finaleBackdrop.querySelectorAll<HTMLElement>('[data-final-scroll]').forEach(element => {
      element.scrollTop = Number(element.dataset.finalScroll);
      element.removeAttribute('data-final-scroll');
    });
  }
  view.dataset.screen = screen.kind;
  view.dataset.route = location.hash;
  deviceTilt?.setSceneActive(screen.kind === 'select' || screen.kind === 'room' || screen.kind === 'clue');
  if (screen.kind === 'room') { stageRoomUi(); if (!busy) revealRoomUi(); }
  const copyCamera = view.querySelector<HTMLElement>('.select-copy-camera, .room-copy-camera');
  if (copyCamera) gsap.set(copyCamera, {
    scale: 1.25,
    x: Number(gsap.getProperty(facadeCamera, 'x')) * .4,
    y: Number(gsap.getProperty(facadeCamera, 'y')) * .32,
    rotationX: Number(gsap.getProperty(facadeCamera, 'rotationX')) * .24,
    rotationY: Number(gsap.getProperty(facadeCamera, 'rotationY')) * .24,
  });
  updateSoundButton();
  updateTiltButton();
  syncBgm();
  if (previousRoute !== location.hash && (screen.kind === 'clue' || screen.kind === 'notebook' || screen.kind === 'chapter')) {
    uiAudio.play(audioContext, 'paper', { volume: .48 });
  }
  updateWorld();
  updateFacade();
  setupClueMotion();
  disposePencilWashes = screen.kind === 'finale' ? null : mountPencilWashes(view);
  const revealEnding = screen.kind === 'notebook' && notebookEndPending;
  if (revealEnding) notebookEndPending = false;
  disposePaperMotion = screen.kind === 'finale' ? null : mountPaperMotion(view, reduced.matches, revealEnding ? () => { void scrollNotebookToEnding(); } : undefined);
  mountFinaleMotion();
  if (screen.kind === 'cover') disposeCoverMotion = mountTvCover(view, reduced.matches, coverLoaders(), {
    ready: () => tvAudio.ready(),
    powerOn: () => tvAudio.powerOn(), ambience: () => tvAudio.startAmbience(),
    hover: () => tvAudio.hover(), click: () => tvAudio.click(), stopHover: () => tvAudio.stopHover(),
  }, enterFromTv);
  if (screen.kind === 'room') syncHotspotPosition();
}
async function travelRoom(entering: boolean) {
  if (busy || (entering ? screen.kind !== 'select' : screen.kind !== 'room')) return;
  busy = true;
  const room = roomById(screenRoom(screen));
  await preloadScene(room);
  uiAudio.play(audioContext, 'wind', { volume: travelWindVolume, duration: entering ? 1.65 : 1.45 });
  if (reduced.matches) {
    pan = 0;
    history.pushState(null, '', entering ? `#room/${room.id}` : `#select/${room.id}`);
    render();
    busy = false;
    return;
  }
  navigation?.kill();
  clearChapterBlur();
  portalTravelInProgress = true;
  app.classList.add('portal-travelling');
  document.querySelector<SVGSVGElement>('.optical-definitions')?.pauseAnimations();
  gsap.killTweensOf([facadeStage, facadeCamera, worldCamera, worldStage]);
  gsap.set(facadeStage, { visibility: 'visible', opacity: 1, scale: 1, x: 0, y: 0, filter: 'none' });
  syncPortalSceneImages();
  const panel = facadeTrack.querySelectorAll<HTMLElement>('.portal-panel')[roomIndex(room.id)];
  const openingElement = panel.querySelector<HTMLElement>('.portal-scene')!;
  const opening = cinemaBounds(openingElement);
  const surface = portalSurfaces.get(openingElement)!;
  const apertureCenter = { x: opening.left + opening.width / 2, y: opening.top + opening.height / 2 };
  const finalScale = Math.max(innerWidth / opening.width, innerHeight / opening.height) * 1.6;
  const firstFill = THREE.MathUtils.clamp(Math.log(Math.min(innerWidth / opening.width, innerHeight / opening.height)) / Math.log(finalScale), .02, .98);
  // Tall windows fill one screen dimension early. Ease the scene up to 86%
  // there, leaving overscan for pointer motion without an abrupt size clamp.
  const sceneTailRate = .14 / (1 - firstFill);
  const doorBlur = document.querySelector('#door-motion-blur');
  const doorShadow = document.querySelector('#door-projection');
  const wallBlur = document.querySelector('#wall-motion-blur');
  doorShadow?.setAttribute('dy', '7');
  doorShadow?.setAttribute('stdDeviation', '9');
  const motion: FlightMotion = {
    entering,
    basePointer: { ...mousePosition },
    baseWorld: entering ? { x: 0, y: 0, rotationX: 0, rotationY: 0 } : lensPose(worldCamera),
    baseFacade: lensPose(facadeCamera), progress: 0, zoom: entering ? 1 : finalScale,
    sceneScale: entering ? previewSceneScale() : 1, scenePose: lensPose(worldCamera),
    ...surface,
    dx: mousePosition.dx, dy: mousePosition.dy,
  };
  flightMotion = motion;
  if (entering) roomPointerOrigin = { ...mousePosition };
  const updateFlight = () => {
    const p = entering ? motion.progress : 1 - motion.progress;
    // Logarithmic distance keeps the first few pixels gentle rather than
    // spending the entire enlargement in the first instant of the tween.
    const scale = Math.pow(finalScale, p);
    const cx = apertureCenter.x + (innerWidth / 2 - apertureCenter.x) * p;
    const cy = apertureCenter.y + (innerHeight / 2 - apertureCenter.y) * p;
    const floatY = -Math.sin(Math.PI * p) * Math.min(12, innerHeight * .012);
    // The original wall, frame and projection share one transform. No clone is
    // exchanged at the end, so the return has no rasterization or focus jump.
    gsap.set(facadeStage, {
      scale,
      x: cx - innerWidth / 2 - (apertureCenter.x - innerWidth / 2) * scale,
      y: cy - innerHeight / 2 - (apertureCenter.y - innerHeight / 2) * scale + floatY,
    });
    motion.zoom = scale;
    // A separate, continuous half-to-full zoom keeps the photograph moving
    // with the frame, without the old near-instant catch-up to full size.
    const t = Math.min(1, p / firstFill);
    const sceneScale = p >= firstFill ? .86 + (p - firstFill) * sceneTailRate
      : (2 * t ** 3 - 3 * t ** 2 + 1) * previewSceneScale()
        + (t ** 3 - 2 * t ** 2 + t) * .54
        + (-2 * t ** 3 + 3 * t ** 2) * .86
        + (t ** 3 - t ** 2) * sceneTailRate * firstFill;
    motion.sceneScale = sceneScale;
    const coverage = Math.min(opening.width * scale / innerWidth, opening.height * scale / innerHeight);
    // Defocus is driven by proximity, not speed: it starts only after the wall
    // has left the viewport. The scene itself stays in focus throughout travel.
    const proximity = THREE.MathUtils.smoothstep(coverage, 1, 1.28);
    const blur = 18 * proximity / (scale * 1.25);
    doorBlur?.setAttribute('stdDeviation', `${blur.toFixed(2)} ${blur.toFixed(2)}`);
    // A projection needs a wall to receive it. Fade as that surface leaves,
    // then restore the exact original strength as the frame returns.
    const shadow = .208 * (1 - THREE.MathUtils.smoothstep(coverage, .92, 1.12));
    doorShadow?.setAttribute('flood-opacity', shadow.toFixed(4));
    // Defocus only the receiving wall and frame. The shared optical filter
    // must never blur the photograph, including the handoff to the room.
    wallBlur?.setAttribute('stdDeviation', (12 * proximity / (scale * 1.25)).toFixed(3));
    applyFlightMotion();
  };
  updateFlight();
  if (!entering) gsap.set(worldStage, { opacity: 0 });
  const duration = entering ? 1.65 : 1.45;
  const clean = () => {
    gsap.killTweensOf(motion);
    if (flightMotion === motion) flightMotion = null;
    gsap.set(facadeStage, { scale: 1, x: 0, y: 0 });
    doorBlur?.setAttribute('stdDeviation', '0 0');
    doorShadow?.setAttribute('flood-opacity', '.208');
    wallBlur?.setAttribute('stdDeviation', '0');
    portalTravelInProgress = false;
    app.classList.remove('portal-travelling');
    syncPortalSceneImages();
    document.querySelector<SVGSVGElement>('.optical-definitions')?.unpauseAnimations();
    if (screen.kind === 'room') gsap.set(facadeStage, { visibility: 'hidden', opacity: 0, scale: 1 });
    busy = false;
  };
  navigation = gsap.timeline({ onComplete: clean });
  navigation.to(motion, { progress: 1, duration, ease: entering ? portalEnter : portalExit, onUpdate: updateFlight }, 0);
  if (entering) {
    pan = 0;
    travelBurst();
    const leaving = view.querySelectorAll<HTMLElement>('.select-heading, .select-footer, .select-navigation, .select-screen .scene-controls');
    navigation.to(leaving, { autoAlpha: 0, y: -22, duration: .22, ease: 'power2.in' }, 0);
    navigation.call(() => {
      history.pushState(null, '', `#room/${room.id}`);
      render();
      gsap.killTweensOf([worldCamera, worldStage]);
      gsap.set(worldCamera, { scale: 1 });
      gsap.set(worldStage, { opacity: 0 });
      applyFlightMotion();
    }, [], duration * .86);
    navigation.call(() => {
      gsap.set(worldStage, { opacity: 1 });
      gsap.set(facadeStage, { visibility: 'hidden', opacity: 0, scale: 1 });
      revealRoomUi();
    }, [], duration);
  } else {
    travelBurst(true);
    navigation.add(leaveRoomUi(), 0);
    navigation.call(() => {
      history.pushState(null, '', `#select/${room.id}`);
      render();
      updateSelectCopy(Number(gsap.getProperty(facadeTrack, 'x')));
      const copy = view.querySelector<HTMLElement>('.select-copy-panel.is-active');
      copy?.classList.remove('is-readable');
      const selectionUi = view.querySelectorAll<HTMLElement>('.select-heading, .select-footer, .select-navigation, .select-screen .scene-controls');
      gsap.set(selectionUi, { autoAlpha: 0, y: -12 });
      applyFlightMotion();
      copy?.classList.add('is-readable');
      gsap.to(selectionUi, { autoAlpha: 1, y: 0, duration: .4, stagger: .025, ease: 'power2.out' });
    }, [], duration * .92);
  }
}
function revealWindowAfterTv(veil: HTMLElement): gsap.core.Timeline {
  const screenElement = view.querySelector<HTMLElement>('.select-screen')!;
  const panel = screenElement.querySelector<HTMLElement>('.select-copy-panel.is-active');
  const layers = [facadeStage, ...[...portalSurfaces.values()].map(surface => surface.viewport)];
  const chrome = screenElement.querySelectorAll('.select-navigation,.scene-controls');
  const copy = panel?.querySelectorAll('.select-heading,.select-footer') ?? [];
  panel?.classList.remove('is-readable');
  const timeline = gsap.timeline({ onComplete: () => {
    gsap.set(veil, { clearProps: 'backgroundColor' });
    gsap.set(veil.querySelector('.veil-line'), { clearProps: 'opacity' });
  } });
  timeline.fromTo(layers, { opacity: 0 }, { opacity: 1, duration: .78, ease: 'sine.out' }, 0)
    .to(veil, { autoAlpha: 0, duration: .65, ease: 'sine.inOut' }, .08)
    .fromTo(copy, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .58, stagger: .12, ease: 'power2.out' }, .27)
    .fromTo(chrome, { autoAlpha: 0, y: 7 }, { autoAlpha: 1, y: 0, duration: .42, stagger: .07, ease: 'power2.out' }, .48)
    .call(() => { panel?.classList.add('is-readable'); }, [], .28);
  return timeline;
}
async function go(hash: string, transition = false) {
  if (busy) return;
  busy = true;
  const [kind, id] = hash.slice(1).split('/');
  const nextRoom = kind === 'clue' ? clueById(id).roomId : id;
  const switching = screen.kind === 'select' && kind === 'select';
  if (switching) {
    if (nextRoom === screenRoom(screen)) { busy = false; return; }
    if (nextRoom) {
      void preloadScene(roomById(nextRoom));
      preloadFacade(roomById(nextRoom));
    }
    if (location.hash !== hash) history.pushState(null, '', hash);
    const room = roomById(nextRoom);
    outgoingSelectIndex = roomIndex(screenRoom(screen));
    awaitingSelectReveal = roomIndex(room.id);
    screen = { kind: 'select', room: room.id };
    facadeRoom = room.id;
    syncSelectionUi(room);
    const target = portalX(roomIndex(room.id));
    const distance = Math.abs(Number(gsap.getProperty(facadeTrack, 'x')) - target);
    const duration = reduced.matches ? 0 : THREE.MathUtils.clamp(distance / portalStep() * .9, .28, 1.05);
    uiAudio.play(audioContext, 'wind', { volume: travelWindVolume, duration: Math.max(.6, duration) });
    slidePortalTo(roomIndex(room.id), duration);
    gsap.delayedCall(duration, () => { busy = false; });
    return;
  }
  if (nextRoom) await preloadScene(roomById(nextRoom));
  if (nextRoom && rooms.some((room) => room.id === nextRoom)) preloadFacade(roomById(nextRoom));
  const setRoute = (backdrop?: HTMLElement) => { if (location.hash !== hash) history.pushState(null, '', hash); render(backdrop); };
  if (screen.kind === 'notebook' && kind === 'finale') {
    const snapshot = view.firstElementChild!.cloneNode(true) as HTMLElement;
    snapshot.classList.add('finale-paper-underlay');
    snapshot.inert = true;
    snapshot.setAttribute('aria-hidden', 'true');
    snapshot.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    const originalScroll = view.querySelector<HTMLElement>('.memory-ledger')!.scrollTop;
    snapshot.querySelector<HTMLElement>('.memory-ledger')!.dataset.finalScroll = String(originalScroll);
    navigation?.kill();
    setRoute(snapshot);
    if (reduced.matches) busy = false;
    else navigation = gsap.timeline({ onComplete: () => { busy = false; } }).to({}, { duration: 4.5 });
    return;
  }

  const closingDocument = screen.kind === 'notebook' || screen.kind === 'chapter' || screen.kind === 'clue';
  if (closingDocument) uiAudio.play(audioContext, 'paper', { volume: .48 });
  if (!transition || reduced.matches) { if ((screen.kind === 'cover' && kind === 'select') || screen.kind === 'finale') { tvAudio.prepareExit(); if (screen.kind !== 'finale' || kind !== 'cover') tvAudio.powerOff(); } setRoute(); busy = false; return; }
  navigation?.kill();
  const outgoing = view.firstElementChild;
  const leavingPaper = screen.kind === 'notebook' || screen.kind === 'chapter';
  const leavingDocument = leavingPaper || screen.kind === 'clue';
  const enteringDocument = kind === 'notebook' || kind === 'chapter' || kind === 'clue';
  const leavingTv = (screen.kind === 'cover' && kind === 'select') || screen.kind === 'finale';
  const enteringTv = kind === 'cover' || kind === 'finale';
  const restartingTv = screen.kind === 'finale' && kind === 'cover';
  const documentTravel = (leavingDocument || enteringDocument) && !leavingTv && !enteringTv;
  const veil = document.querySelector<HTMLElement>('#transition-veil')!;
  navigation = gsap.timeline({ onComplete: () => { app.classList.remove('document-travelling'); busy = false; } });
  if (documentTravel) app.classList.add('document-travelling');
  if (leavingTv) tvAudio.prepareExit();
  const departure = leavingPaper ? foldPaperAway(view) : screen.kind === 'clue' ? leaveReadingPage(view) : leavingTv ? leaveTvCover(outgoing as HTMLElement, veil, () => tvAudio.powerOff(), !restartingTv) : screen.kind === 'room' && enteringDocument ? leaveRoomUi() : null;
  const swapAt = departure?.duration() ?? .18;
  if (leavingDocument && documentTravel) travelBurst(true, swapAt * 1000);
  if (departure) navigation.add(departure, 0);
  else navigation.to(outgoing, { opacity: 0, duration: .18, ease: 'sine.in' }, 0);
  // Let the paper's surrounding surface leave with it, instead of cutting away
  // the opaque backdrop after the last folded sheet has left the screen.
  if (leavingPaper) navigation.to(outgoing, { opacity: 0, duration: .35, ease: 'sine.in' }, Math.max(0, swapAt - .35));
  if (enteringTv && !leavingTv) {
    navigation.set(veil, { backgroundColor: '#030805' }, 0)
      .set(veil.querySelector('.veil-line'), { opacity: 0 }, 0)
      .to(veil, { autoAlpha: 1, duration: .28, ease: 'sine.inOut' }, Math.max(0, swapAt - .28));
  }
  navigation.call(() => {
    setRoute();
    if (leavingTv) {
      if (kind === 'select') navigation?.add(revealWindowAfterTv(veil), swapAt);
      else if (enteringTv) gsap.set(veil, { autoAlpha: 0 });
      else navigation?.to(veil, { autoAlpha: 0, duration: .3 }, swapAt);
      return;
    }
    if (enteringTv) {
      gsap.set(veil, { autoAlpha: 0 });
      return;
    }
    const incoming = view.firstElementChild;
    if (documentTravel) travelBurst(!enteringDocument, enteringDocument && kind !== 'clue' ? 1450 : 1000);
    if (screen.kind !== 'room') gsap.fromTo(incoming, { opacity: 0 }, { opacity: 1, duration: .36, ease: 'sine.out' });
  }, [], swapAt);
  // As with the door flight, reveal controls only after the scene camera has settled.
  if (kind === 'room') navigation.call(() => { if (screen.kind === 'room') revealRoomUi(); }, [], swapAt + .7);
  navigation.to({}, { duration: kind === 'finale' ? 3.8 : kind === 'room' ? 1.7 : kind === 'notebook' || kind === 'chapter' ? 1.45 : leavingTv ? 1.1 : 1 }, swapAt);
}
function restoreHistory() { navigation?.kill(); stopTravelBurst(); app.classList.remove('document-travelling'); gsap.killTweensOf('#transition-veil'); gsap.set('#transition-veil', { autoAlpha: 0, clearProps: 'backgroundColor' }); gsap.set('.veil-line', { clearProps: 'opacity' }); portalSurfaces.forEach(surface => { surface.viewport.style.opacity = ''; }); gsap.killTweensOf(facadeTrack); clearChapterBlur(); if (flightMotion) { gsap.killTweensOf(flightMotion); } flightMotion = null; gsap.set(facadeStage, { scale: 1, x: 0, y: 0 }); document.querySelector('#wall-motion-blur')?.setAttribute('stdDeviation', '0'); document.querySelector('#door-motion-blur')?.setAttribute('stdDeviation', '0 0'); document.querySelector('#door-projection')?.setAttribute('flood-opacity', '.208'); document.querySelector('.portal-flight')?.remove(); facadeTrack.querySelectorAll<HTMLElement>('.portal-panel').forEach((panel) => { panel.style.visibility = ''; }); portalTravelInProgress = false; app.classList.remove('portal-travelling'); document.querySelector<SVGSVGElement>('.optical-definitions')?.unpauseAnimations(); busy = false; awaitingSelectReveal = null; outgoingSelectIndex = null; render(); if (screen.kind === 'select') { gsap.killTweensOf(facadeTrack); slidePortalTo(roomIndex(screen.room), 0); } }
window.addEventListener('hashchange', restoreHistory);
window.addEventListener('popstate', restoreHistory);
render();
void preloadScene(roomById(screenRoom(screen)));
window.setTimeout(() => rooms.forEach((room) => void preloadScene(room)), 1600);

function collect(id: ClueId) {
  if (collected.has(id)) { go(`#room/${clueById(id).roomId}`, true); return; }
  collected.add(id);
  try { localStorage.setItem(progressKey, JSON.stringify([...collected])); } catch { /* Session still works. */ }
  const complete = collected.size === 5;
  if (complete) notebookEndPending = true;
  void go(complete ? '#notebook' : `#room/${clueById(id).roomId}`, true);
}
function restartExperience() {
  if (busy || screen.kind !== 'finale') return;
  collected.clear();
  notebookEndPending = false;
  pan = 0;
  try {
    localStorage.removeItem(progressKey);
  } catch { /* The new run still starts empty when storage is unavailable. */ }
  void go('#cover', true);
}
function enterFromTv(enabled: boolean) {
  const cover = view.querySelector<HTMLElement>('.tv-cover.is-ready');
  if (busy || !cover) return;
  setSound(enabled);
  void go('#select/worksite', true);
}

function handleAction(action: string, id?: string) {
  switch (action) {
    case 'sound': setSound(!soundEnabled); break;
    case 'tilt': void deviceTilt?.toggle(); break;
    case 'prev-room': case 'next-room': {
      if (screen.kind !== 'select') break;
      const index = roomIndex(screen.room) + (action === 'next-room' ? 1 : -1);
      if (rooms[index]) go(`#select/${rooms[index].id}`, true);
      break;
    }
    case 'enter-room': if (screen.kind === 'select') void travelRoom(true); break;
    case 'change-room': if (screen.kind === 'room') void travelRoom(false); break;
    case 'clue': if (id) go(`#clue/${id}`, true); break;
    case 'close-clue': if (screen.kind === 'clue') go(`#room/${clueById(screen.clue).roomId}`, true); break;
    case 'collect': if (id) collect(id as ClueId); break;
    case 'notebook': go('#notebook', true); break;
    case 'chapter-notes': if (id) go(`#chapter/${id}`, true); break;
    case 'close-notebook': go(`#room/${(screen.kind === 'notebook' || screen.kind === 'chapter') && screen.room ? screen.room : worldRoom ?? 'worksite'}`, true); break;
    case 'book-clue': if (id) go(collected.has(id as ClueId) ? `#clue/${id}` : `#room/${clueById(id).roomId}`, true); break;
    case 'finale': if (collected.size === 5) go('#finale', true); break;
    case 'rewatch': go('#cover', true); break;
    case 'restart': restartExperience(); break;
    case 'museum': case 'next': break;
  }
}
// Delegate to the hosts that actually own the pencil wash; child crossings
// do not retrigger it, and leaving/focus loss cancels pending playback too.
const hoverSounds = new WeakMap<HTMLElement, () => void>();
function pencilHost(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const host = target.closest<HTMLElement>('.pencil-control,.room-hud-side');
  return host && !host.matches(':disabled') && !host.closest('[inert]') && host.querySelector('.pencil-wash') ? host : null;
}
function beginPencil(host: HTMLElement | null) {
  if (!host || hoverSounds.has(host)) return;
  hoverSounds.set(host, uiAudio.play(audioContext, 'pencil', { volume: .3, duration: .72 }));
}
function endPencil(host: HTMLElement | null) {
  if (!host || host.matches(':hover,:focus-visible')) return;
  hoverSounds.get(host)?.();
  hoverSounds.delete(host);
}
view.addEventListener('pointerover', event => {
  if (event.pointerType === 'touch') return;
  const host = pencilHost(event.target);
  if (host && event.relatedTarget instanceof Node && host.contains(event.relatedTarget)) return;
  beginPencil(host);
});
view.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') beginPencil(pencilHost(event.target));
});
view.addEventListener('pointerout', event => {
  const host = pencilHost(event.target);
  if (host && event.relatedTarget instanceof Node && host.contains(event.relatedTarget)) return;
  endPencil(host);
});
view.addEventListener('focusin', event => {
  const host = pencilHost(event.target);
  if (host?.matches(':focus-visible')) beginPencil(host);
});
view.addEventListener('focusout', event => { endPencil(pencilHost(event.target)); });
app.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!button || button.hasAttribute('disabled')) return;
  if (screen.kind === 'select' && performance.now() < suppressSelectionClickUntil) return;
  if (moved && button.classList.contains('clue-marker')) { moved = false; return; }
  handleAction(button.dataset.action!, button.dataset.id);
});
app.addEventListener('pointerdown', (event) => {
  moved = false;
  const element = event.target as HTMLElement;
  const selection = element.closest<HTMLElement>('.select-screen');
  if (selection && screen.kind === 'select' && !busy && (event.pointerType !== 'mouse' || event.button === 0)
    && !element.closest('.select-navigation, .select-footer, .scene-controls')) {
    selectionDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, index: roomIndex(screen.room), active: false };
    return;
  }
  if (busy || !element.closest('.room-screen') || (element.closest('button') && !element.closest('.clue-marker'))) return;
  pointerStart = { x: event.clientX, y: event.clientY, pan };
});
/** Pointer and device tilt share camera transforms, including hotspot tracking. */
function applySceneParallax({ dx, dy }: TiltPosition, fromTilt = false) {
  if (reduced.matches || document.hidden || selectionDrag?.active || (busy && !flightMotion)) return;
  mousePosition = { dx, dy };
  if (screen.kind === 'chapter') gsap.to('.newspaper-pan', { x: -dx * 9, y: -dy * 6, rotation: dx * .18, duration: 1.1, ease: 'power2.out', overwrite: 'auto' });
  if (flightMotion) {
    gsap.to(flightMotion, { dx, dy, duration: .18, ease: 'power2.out', overwrite: 'auto', onUpdate: applyFlightMotion });
  } else if (screen.kind === 'select' || screen.kind === 'room' || screen.kind === 'clue') {
    moveFacadeLens(dx, dy, fromTilt ? .22 : .7);
    if (screen.kind === 'room' || screen.kind === 'clue') {
      gsap.to(worldCamera, { ...roomCameraPose(), duration: fromTilt ? .22 : .7, ease: 'power2.out', overwrite: 'auto', onUpdate: syncHotspotPosition });
    }
  }
}
app.addEventListener('pointermove', (event) => {
  if (selectionDrag && selectionDrag.pointerId === event.pointerId && screen.kind === 'select') {
    const dx = event.clientX - selectionDrag.x;
    const dy = event.clientY - selectionDrag.y;
    if (!selectionDrag.active && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      selectionDrag.active = true;
      app.querySelector<HTMLElement>('.select-screen')?.setPointerCapture(event.pointerId);
      gsap.killTweensOf(facadeTrack, 'x');
    }
    if (selectionDrag.active) {
      const edge = (selectionDrag.index === 0 && dx > 0) || (selectionDrag.index === rooms.length - 1 && dx < 0);
      const edgeLimit = Math.min(100, innerWidth * .18);
      const offset = edge
        ? THREE.MathUtils.clamp(dx * .32, -edgeLimit, edgeLimit)
        : THREE.MathUtils.clamp(dx * .82, -portalStep() * .94, portalStep() * .94);
      followPortalX(portalX(selectionDrag.index) + offset);
    }
  }
  if (event.pointerType === 'mouse' && !deviceTilt?.usingSensor) {
    applySceneParallax({ dx: event.clientX / innerWidth - .5, dy: event.clientY / innerHeight - .5 });
  }
  if (!pointerStart || screen.kind !== 'room') return;
  if (Math.abs(event.clientX - pointerStart.x) > 7) moved = true;
  pan = THREE.MathUtils.clamp(pointerStart.pan + (event.clientX - pointerStart.x) * 0.6, -55, 55);
  const worldX = pan * .35 - (mousePosition.dx - roomPointerOrigin.dx) * Math.min(50, innerWidth * .1);
  gsap.to(worldCamera, { x: worldX, duration: .65, ease: 'power3.out', overwrite: 'auto', onUpdate: syncHotspotPosition });
});
app.addEventListener('pointerleave', event => {
  if (event.pointerType !== 'mouse' || deviceTilt?.usingSensor) return;
  mousePosition = { dx: 0, dy: 0 };
  if (flightMotion) {
    gsap.to(flightMotion, { dx: 0, dy: 0, duration: .3, ease: 'power2.out', overwrite: 'auto', onUpdate: applyFlightMotion });
    return;
  }
  moveFacadeLens(0, 0);
  if (screen.kind === 'chapter') gsap.to('.newspaper-pan', { x: 0, y: 0, rotation: 0, duration: 1.1, ease: 'power2.out' });
  if (screen.kind === 'room' || screen.kind === 'clue') {
    gsap.to(worldCamera, { ...roomCameraPose(), duration: .8, ease: 'power2.out', overwrite: 'auto', onUpdate: syncHotspotPosition });
  }
});
window.addEventListener('pointerup', (event) => {
  pointerStart = null;
  if (!selectionDrag || event.pointerId !== selectionDrag.pointerId) return;
  const drag = selectionDrag;
  selectionDrag = null;
  if (!drag.active || screen.kind !== 'select') return;
  suppressSelectionClickUntil = performance.now() + 350;
  const distance = event.clientX - drag.x;
  const next = drag.index + (distance < 0 ? 1 : -1);
  if (Math.abs(distance) >= Math.max(55, innerWidth * .12) && rooms[next]) {
    void go(`#select/${rooms[next].id}`, true);
  } else {
    slidePortalTo(drag.index, reduced.matches ? 0 : .42);
  }
});
window.addEventListener('pointercancel', () => {
  uiAudio.stop('pencil');
  pointerStart = null; moved = false;
  if (selectionDrag) {
    slidePortalTo(selectionDrag.index, .35);
    selectionDrag = null;
  }
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (screen.kind === 'clue') go(`#room/${clueById(screen.clue).roomId}`, true);
    else if (screen.kind === 'notebook' || screen.kind === 'chapter') handleAction('close-notebook');
  }
  if (screen.kind === 'select' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) handleAction(event.key === 'ArrowRight' ? 'next-room' : 'prev-room');
});

deviceTilt = new DeviceTilt(position => {
  if (!pointerStart) {
    if (deviceTilt?.state === 'off') roomPointerOrigin = { dx: 0, dy: 0 };
    applySceneParallax(position, true);
  }
}, updateTiltButton);
deviceTilt.setSceneActive(screen.kind === 'select' || screen.kind === 'room' || screen.kind === 'clue');
if (import.meta.hot) import.meta.hot.dispose(() => deviceTilt?.dispose());
