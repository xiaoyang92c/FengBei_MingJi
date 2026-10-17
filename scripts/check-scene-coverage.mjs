import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { Euler, Vector3 } from 'three';

async function load(name) {
  const { code } = await transform(readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' });
  const context = { module: { exports: {} } };
  vm.runInNewContext(code, context);
  return context.module.exports;
}
const { sceneParallaxScale } = await load('scene-parallax');
const { sceneLayout, sceneCoverage } = await load('scene-layout');
const { rooms } = await load('content');
function projectQuad(width, height, bounds, pose, scale) {
  const rotation = new Euler(pose.rotationX * Math.PI / 180, pose.rotationY * Math.PI / 180, 0, 'YXZ');
  return [[-bounds.left,-bounds.top],[bounds.right,-bounds.top],[bounds.right,bounds.bottom],[-bounds.left,bounds.bottom]].map(([x,y]) => {
    const point = new Vector3(x*scale,y*scale,0).applyEuler(rotation);
    point.x += pose.x; point.y += pose.y;
    assert.ok(point.z < 780, 'painted quad stays in front of the perspective eye');
    return { x: width/2+point.x*780/(780-point.z), y: height/2+point.y*780/(780-point.z) };
  });
}
function contains(quad, x, y) {
  return quad.every((point,index) => {
    const next = quad[(index+1)%quad.length];
    return (next.x-point.x)*(y-point.y)-(next.y-point.y)*(x-point.x) >= -.001;
  });
}
let previouslyExposed = 0, cases = 0;
for(const room of rooms) for(const [width,height] of [[390,844],[844,390],[1366,768],[1920,1080],[2559,1238],[3440,1440],[3840,2160],[5120,1440]]) {
  const bounds = sceneCoverage(sceneLayout(room,width,height));
  assert.equal(sceneParallaxScale(width,height,bounds,{ x:0,y:0,rotationX:0,rotationY:0 }),1,'resting composition is unchanged');
  for(const dx of [-.5,-.25,0,.25,.5]) for(const dy of [-.5,0,.5]) for(const pan of [-19.25,0,19.25]) for(const zoom of [1,1.04,1.1]) {
    const pose = { x:pan-dx*Math.min(50,width*.1),y:-dy*34,rotationY:dx*7.5,rotationX:-dy*5 };
    const guard = sceneParallaxScale(width,height,bounds,pose,zoom);
    const protectedQuad = projectQuad(width,height,bounds,pose,zoom*guard);
    const originalQuad = projectQuad(width,height,bounds,pose,zoom);
    for(const x of [0,width]) for(const y of [0,height]) {
      assert.ok(contains(protectedQuad,x,y),`${room.id} ${width}×${height}: viewport corner (${x},${y}) exposed`);
      if(!contains(originalQuad,x,y)) previouslyExposed++;
    }
    cases++;
  }
  // The same photo passes through a smaller aperture before covering the screen.
  for(let step=0;step<=100;step++) {
    const p=step/100, zoom=.5+.5*p;
    const clip={left:width*.35*(1-p),right:width*(1-.35*(1-p)),top:height*.28*(1-p),bottom:height*(1-.28*(1-p))};
    const pose={x:20*p,y:-17*p,rotationX:2.5*p,rotationY:3.75*p};
    const guard=sceneParallaxScale(width,height,bounds,pose,zoom,clip);
    const quad=projectQuad(width,height,bounds,pose,zoom*guard);
    for(const x of [clip.left,clip.right]) for(const y of [clip.top,clip.bottom]) assert.ok(contains(quad,x,y),'doorway photo covers every visible aperture corner');
  }
}
assert.ok(previouslyExposed>0,'regression check reproduces the previous exposed-edge failure');
console.log(`Scene coverage checks passed: ${cases} poses across 8 viewports and 3 rooms, including doorway coverage; reproduced ${previouslyExposed} previously exposed corners.`);
