import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';const {chromium}=pw;
const b=await chromium.launch({args:['--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1460,height:1000}});
await p.goto('file:///home/claude/client-SYMBOL-GALLERY.html'); await p.waitForFunction('window.__SYM_READY');
const out=await p.evaluate(()=>{
  const TAU=Math.PI*2, res=[];
  for(const f of window.__fxlist()){
    const V=window.__vals(f.id);
    let per=V.period??V.turn??V.cycle??null;
    if(per==null&&V.move!=null)per=((V.move||0)+(V.pause||0))*Math.max(1,Math.round(V.steps||1));
    if(per==null&&V.coast!=null)per=(V.spin||0)+(V.coast||0)+(V.rest||0);
    if(per==null&&V.every!=null)per=V.every*Math.max(1,V.keep||1);
    if(per==null&&V.rate!=null)per=(2.4/V.rate)*3;
    if(per==null&&V.dur!=null&&V.stay!=null)per=V.dur/1000+V.stay+V.dur/1000*0.9;
    if(per==null)per=4; per/=(V['@tempo']||1);
    const N=3000,h=per/N; let prev=window.__probe(f.id,0).hlRot,acc=0,ang=[];
    for(let i=0;i<=N;i++){ const v=window.__probe(f.id,i*h).hlRot||0;
      let d=v-prev; while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU; acc+=d; ang.push(acc); prev=v; }
    const vel=[]; for(let i=1;i<ang.length;i++) vel.push((ang[i]-ang[i-1])/h);
    const vmax=Math.max(...vel.map(Math.abs)); if(vmax<0.05) continue;
    let jump=0,at=0; for(let i=1;i<vel.length;i++){ const d=Math.abs(vel[i]-vel[i-1]); if(d>jump){jump=d;at=i*h;} }
    res.push({id:f.id,name:f.name,per:+per.toFixed(2),vmax:+(vmax/TAU).toFixed(2),jump:+(jump/TAU).toFixed(2),rel:+(jump/vmax).toFixed(2),at:+at.toFixed(2)});
  }
  // то же для смещения знака: разрыв линейной скорости, в долях R/с
  const pos=[];
  for(const f of window.__fxlist()){
    const V=window.__vals(f.id);
    let per=V.period??V.turn??V.cycle??null; if(per==null&&V.move!=null)per=((V.move||0)+(V.pause||0))*Math.max(1,Math.round(V.steps||1)); if(per==null&&V.coast!=null)per=(V.spin||0)+(V.coast||0)+(V.rest||0); if(per==null&&V.every!=null)per=V.every*Math.max(1,V.keep||1); if(per==null&&V.rate!=null)per=(2.4/V.rate)*3;
    if(per==null&&V.dur!=null&&V.stay!=null)per=V.dur/1000+V.stay+V.dur/1000*0.9;
    if(per==null)per=4; per/=(V['@tempo']||1);
    const N=3000,h=per/N;
    for(const k of ['discX','discY','hlX','hlY','discScale','hlScale']){
      const c=[]; for(let i=0;i<=N;i++) c.push(window.__probe(f.id,i*h)[k]||0);
      const vel=[]; for(let i=1;i<c.length;i++) vel.push((c[i]-c[i-1])/h);
      const vmax=Math.max(...vel.map(Math.abs)); if(vmax<0.02) continue;
      let jump=0,at=0; for(let i=1;i<vel.length;i++){const d=Math.abs(vel[i]-vel[i-1]); if(d>jump){jump=d;at=i*h;}}
      if(jump/vmax>0.34 && jump>0.15) pos.push({id:f.id,name:f.name,k,vmax:+vmax.toFixed(2),jump:+jump.toFixed(2),rel:+(jump/vmax).toFixed(2),at:+at.toFixed(2)});
    }
  }
  return {rot:res,pos};
});
console.log('=== ВРАЩЕНИЕ (об/с) ===');
for(const r of out.rot.sort((a,b)=>b.rel-a.rel)) console.log((r.name+' ['+r.id+']').padEnd(30),'vmax',String(r.vmax).padStart(5),'разрыв',String(r.jump).padStart(5),'=',String(r.rel).padStart(5),'на t='+r.at);
console.log('=== СМЕЩЕНИЕ (R/с), разрыв скорости > 34% ===');
for(const r of out.pos.sort((a,b)=>b.jump-a.jump)) console.log((r.name+' ['+r.id+']').padEnd(30),r.k.padEnd(10),'vmax',String(r.vmax).padStart(6),'разрыв',String(r.jump).padStart(6),'=',r.rel,'на t='+r.at);
await b.close();
