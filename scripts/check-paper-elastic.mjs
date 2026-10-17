import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

const { code } = await transform(readFileSync(new URL('../src/paper-elastic.ts', import.meta.url), 'utf8'), { loader:'ts', format:'cjs' });
class Events {
  listeners = new Map();
  addEventListener(type, fn) { if(!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type,event={}) { for(const fn of this.listeners.get(type)??[]) fn(event); }
  count(type) { return this.listeners.get(type)?.size??0; }
}
function setup({mobile=true,reduced=false}={}) {
  const document=Object.assign(new Events(),{hidden:false});
  const classes=new Set(), body={y:0}, header={y:0};
  const paper=Object.assign(new Events(),{
    scrollTop:0,scrollHeight:2000,clientHeight:600,inert:false,
    classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v),toggle:(v,on)=>on?classes.add(v):classes.delete(v)},
    querySelectorAll:()=>[body],
  });
  const frames=new Map();let serial=0,now=0;
  const gsap={
    quickSetter:targets=>value=>targets.forEach(target=>{target.y=value;}),
    set:targets=>targets.forEach(target=>{target.y=0;}),
  };
  const context={module:{exports:{}},require:()=>({default:gsap,__esModule:true}),document,window:{matchMedia:()=>({matches:mobile})},performance:{now:()=>now},
    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),
  };
  vm.runInNewContext(code,context);
  const controller=context.module.exports.mountPaperElastic({querySelector:()=>paper},reduced);
  const point=y=>({identifier:1,clientX:100,clientY:y});
  const send=(type,y,elapsed=16,extra={})=>{
    now+=elapsed;
    const event={touches:y===null?[]:[point(y)],cancelable:true,prevented:false,preventDefault(){this.prevented=true;},...extra};
    paper.emit(type,event);return event;
  };
  const frame=()=>{now+=1000/60;const tasks=[...frames.values()];frames.clear();tasks.forEach(fn=>fn(now));};
  const flush=()=>{for(let i=0;frames.size&&i<180;i++)frame();assert.equal(frames.size,0,'spring settles without a permanent ticker');};
  return {paper,body,header,document,classes,frames,send,frame,flush,controller,api:context.module.exports,advance:ms=>{now+=ms;}};
}
const {paperResistance,paperSpring}=setup().api;
for(const distance of [0,1,10,100,1000]) {
  const y=paperResistance(distance,72);
  assert.ok(y>=0&&y<72);
  assert.equal(paperResistance(-distance,72),-y,'top and bottom share the same resistance');
}
for(const offset of [-50,50]) {
  const whole=paperSpring(offset,140,.2);
  let divided={offset,velocity:140};
  for(let i=0;i<24;i++)divided=paperSpring(divided.offset,divided.velocity,1/120);
  assert.ok(Math.abs(whole.offset-divided.offset)<1e-9,'return motion is independent of display refresh rate');
}
for(const bottom of [false,true]) {
  const s=setup();s.paper.scrollTop=bottom?1400:0;
  s.send('touchstart',200);
  const move=s.send('touchmove',bottom?80:320);
  assert.equal(move.prevented,true,'outward edge gesture suppresses browser overscroll');
  const displacement=s.body.y;
  assert.ok(bottom?displacement<0:displacement>0);
  assert.equal(s.header.y,0,'sticky heading stays on the opaque paper frame');
  s.advance(120);s.send('touchend',null);
  assert.equal(s.body.y,displacement,'release preserves the current displacement');
  let previous=Math.abs(displacement);
  for(let i=0;s.frames.size&&i<180;i++) {
    s.frame();assert.ok(Math.abs(s.body.y)<=previous+.0001,'a held pull returns without a second bounce');previous=Math.abs(s.body.y);
  }
  assert.equal(s.body.y,0);assert.equal(s.frames.size,0);
  s.controller.dispose();assert.equal(s.paper.count('touchmove'),0);
}
{
  const s=setup();s.paper.scrollTop=500;s.send('touchstart',200);
  assert.equal(s.send('touchmove',150).prevented,false,'middle scrolling keeps browser momentum');
  assert.equal(s.body.y,0);
  s.paper.scrollTop=550;s.paper.emit('scroll');s.send('touchend',null);
  s.advance(16);s.paper.scrollTop=1370;s.paper.emit('scroll');
  s.advance(16);s.paper.scrollTop=1400;s.paper.emit('scroll');
  assert.ok(s.frames.size>0,'native momentum reaching the bottom gets gentle boundary feedback');
  s.flush();s.controller.dispose();
}
{
  const s=setup();s.send('touchstart',200);s.send('touchmove',300);
  assert.ok(s.body.y>0);
  s.send('touchmove',150);
  assert.equal(s.body.y,0,'reversing the gesture consumes resistance before scrolling inward');
  assert.ok(s.paper.scrollTop>0);
  s.send('touchend',null);
  assert.equal(s.frames.size,0,'handing back to native scrolling does not start a new in-content bounce');
  s.flush();s.controller.dispose();
}
{
  const s=setup();s.send('touchstart',200);s.send('touchmove',320);s.send('touchend',null);
  s.frame();const y=s.body.y;
  s.send('touchstart',200);assert.equal(s.body.y,y,'catching a returning sheet does not snap it to rest');
  s.send('touchmove',210);s.send('touchcancel',null);
  s.document.hidden=true;s.document.emit('visibilitychange');
  assert.equal(s.frames.size,0);assert.equal(s.body.y,0);
  s.controller.dispose();assert.equal(s.document.count('visibilitychange'),0);
}
for(const options of [{mobile:false},{reduced:true}]) {
  const s=setup(options);assert.equal(s.paper.count('touchmove'),0);s.controller.dispose();
}
console.log('Paper elasticity checks passed: both edges, native middle scrolling and momentum, refresh-rate stability, reverse drag, re-grab, reduced motion and cleanup.');
