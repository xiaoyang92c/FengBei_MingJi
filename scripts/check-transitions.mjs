import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

async function loadModule(name, globals = {}) {
  const { code } = await transform(readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8'), { loader:'ts', format:'cjs' });
  const context = { module: { exports: {} }, ...globals };
  vm.runInNewContext(code, context);
  return context.module.exports;
}
const { portalFlightFrame } = await loadModule('portal-flight');
const { sceneLayout, sceneCoverage } = await loadModule('scene-layout');
const { rooms } = await loadModule('content');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00001, `${actual} != ${expected}`);
for (const room of rooms) for (const sign of [-1,1]) for (const [width, height] of [[320,568],[390,664],[430,844],[844,390]]) {
  const aperture = { left:width*.28, top:height*.3, width:width*.44, height:height*.4 };
  const overscan = width>=700 && width>height ? 1.08 : 1.32;
  const margin = (overscan-1)/2*.85;
  const pose = { x:sign*width*margin, y:-sign*Math.min(height*margin,20.4) };
  const painted = sceneCoverage(sceneLayout(room,width,height));
  let previous = .5;
  for (let step = 0; step <= 200; step++) {
    const frame = portalFlightFrame(aperture,width,height,step/200,.5,pose,painted);
    assert.ok(frame.sceneScale >= previous-.00001 && frame.sceneScale <= 1.00001);
    previous = frame.sceneScale;
    // The independently composited aperture and physical frame must coincide.
    near(width/2 + frame.facadeX + (aperture.left-width/2)*frame.scale, frame.left);
    near(height/2 + frame.facadeY + (aperture.top-height/2)*frame.scale, frame.top);
    assert.ok([frame.left,frame.top,frame.scale,frame.sceneScale].every(Number.isFinite));
    // The part of the aperture visible on-screen must never sample blank pixels.
    assert.ok(frame.imageX-painted.left*frame.sceneScale <= Math.max(0,frame.left)+.001);
    assert.ok(frame.imageX+painted.right*frame.sceneScale >= Math.min(width,frame.left+aperture.width*frame.scale)-.001);
    assert.ok(frame.imageY-painted.top*frame.sceneScale <= Math.max(0,frame.top)+.001);
    assert.ok(frame.imageY+painted.bottom*frame.sceneScale >= Math.min(height,frame.top+aperture.height*frame.scale)-.001);
  }
  const start = portalFlightFrame(aperture,width,height,0,.5,pose,painted);
  const end = portalFlightFrame(aperture,width,height,1,.5,pose,painted);
  near(start.sceneScale,.5); near(end.sceneScale,1);
  near(end.imageX,width/2+pose.x); near(end.imageY,height/2+pose.y);
  assert.ok(end.coverage >= 1.59, 'handoff covers every viewport edge');
  // A phone may keep rotating while the door expands or returns. The image
  // and aperture must still agree without measuring the DOM on every tick.
  for(let step=0;step<=100;step++) {
    const p=step/100, dx=Math.sin(p*Math.PI*2)*.6, dy=Math.cos(p*Math.PI*2)*.6;
    const x=-dx*Math.min(50,width*.1), y=-dy*34;
    const moving={...aperture,left:aperture.left+x,top:aperture.top+y};
    const frame=portalFlightFrame(moving,width,height,p,.5,{x,y},painted);
    near(width/2+frame.facadeX+(moving.left-width/2)*frame.scale,frame.left);
    near(height/2+frame.facadeY+(moving.top-height/2)*frame.scale,frame.top);
    assert.ok(frame.imageX-painted.left*frame.sceneScale<=Math.max(0,frame.left)+.001);
    assert.ok(frame.imageX+painted.right*frame.sceneScale>=Math.min(width,frame.left+moving.width*frame.scale)-.001);
    assert.ok(frame.imageY-painted.top*frame.sceneScale<=Math.max(0,frame.top)+.001);
    assert.ok(frame.imageY+painted.bottom*frame.sceneScale>=Math.min(height,frame.top+moving.height*frame.scale)-.001);
  }
}

// Exercise the real fold controller without a browser or a GPU-specific mock.
class Classes {
  values = new Set();
  add(...values) { values.forEach(value=>this.values.add(value)); }
  remove(...values) { values.forEach(value=>this.values.delete(value)); }
  toggle(value,on) { on ? this.add(value) : this.remove(value); }
  contains(value) { return this.values.has(value); }
}
class Element {
  classList = new Classes(); style={setProperty(key,value){this[key]=value;}}; dataset={}; attrs={}; children=[]; parentElement=null;
  offsetWidth=366; offsetHeight=800; offsetLeft=12; offsetTop=12; scrollTop=0;
  set className(value) {this.classList.values=new Set(value.split(' '));}
  setAttribute(key,value) {this.attrs[key]=value;}
  removeAttribute(key) {delete this.attrs[key];}
  append(...children) {children.forEach(child=>{child.parentElement=this;this.children.push(child);});}
  remove() {if(this.parentElement) this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
  cloneNode(deep) {
    const clone=new Element(); clone.classList.values=new Set(this.classList.values); clone.attrs={...this.attrs}; clone.dataset={...this.dataset}; Object.assign(clone.style,this.style);
    if(deep) clone.append(...this.children.map(child=>child.cloneNode(true)));
    return clone;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child=>[
      ...(selector==='[id]' ? ('id' in child.attrs) : child.classList.contains(selector.slice(1))) ? [child] : [],
      ...child.querySelectorAll(selector),
    ]);
  }
}
const frames=new Map(); let next=0;
let coarse=true;
const foldModule=await loadModule('paper-fold',{
  window:{matchMedia:()=>({matches:coarse})}, document:{createElement:()=>new Element()},
  requestAnimationFrame(fn){frames.set(++next,fn);return next;}, cancelAnimationFrame(id){frames.delete(id);},
});
for(let angle=0;angle<=180;angle+=.25) {
  const face=foldModule.foldProjection(angle);
  assert.ok(!(face.front&&face.back), 'front and back never paint together');
  assert.ok(face.height>0 && face.height<=1.000001);
}
const parent=new Element(), paper=new Element(); parent.append(paper);
paper.scrollTop=920; paper.attrs.id='ledger';
const heading=new Element(); heading.attrs.id='heading'; heading.style.visibility='visible'; paper.append(heading);
const packet=foldModule.createPaperFold(paper);
assert.equal(packet.fold.querySelectorAll('[id]').length,0,'snapshot does not duplicate live IDs');
for(const clone of packet.fold.querySelectorAll('.fold-copy')) assert.equal(clone.scrollTop,920,'closing from a scrolled page keeps its contents');
packet.motion.angle=180; packet.render();
assert.equal(packet.fold.querySelectorAll('.fold-front')[0].style.opacity,'0','explicit opacity suppresses visible descendants of the hidden face');
assert.equal(packet.fold.querySelectorAll('.fold-back')[0].style.opacity,'1');
packet.motion.angle=0; packet.render();
paper.classList.add('paper-is-folding'); packet.handoff();
assert.equal(paper.classList.contains('paper-is-folding'),false);
assert.ok(parent.children.includes(packet.fold),'snapshot stays until the live paper paints');
const flush=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn());};
flush(); assert.ok(parent.children.includes(packet.fold));
flush(); assert.ok(!parent.children.includes(packet.fold));
const cancelled=foldModule.createPaperFold(paper); cancelled.handoff(); cancelled.dispose();
assert.equal(frames.size,0,'route changes cancel pending handoff frames');
coarse=false;
const desktop=foldModule.createPaperFold(paper);
assert.equal(desktop.fold.classList.contains('is-flat-fold'),false,'desktop retains its 3D fold');
assert.equal(desktop.bottom.style.transformOrigin,'50% 0%','desktop fold hinges at the sheet midpoint');
for(const angle of [0,45,90,135,180]) {
  desktop.motion.angle=angle; desktop.render();
  assert.equal(desktop.bottom.style.transform,`rotateX(${angle}deg)`);
  const front=desktop.fold.querySelectorAll('.fold-front')[0];
  const back=desktop.fold.querySelectorAll('.fold-back')[0];
  assert.equal(front.style.opacity,angle<89.9?'1':'0');
  assert.equal(back.style.opacity,angle>90.1?'1':'0','desktop never leaks the reverse cover over the open page');
}
desktop.dispose();
console.log('Transition checks passed: viewport coverage, forward/reverse geometry, exclusive fold faces, scroll snapshots and paint-safe cleanup.');
