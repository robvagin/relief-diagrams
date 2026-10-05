import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';const {chromium}=pw;
const b=await chromium.launch({args:['--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1460,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/client-SYMBOL-GALLERY.html'); await p.waitForFunction('window.__SYM_READY');
const out=await p.evaluate(()=>{
  const KEYS=['discScale','discAlpha','discX','discY','sx','sy','tone','hlX','hlY','hlScale','hlRot','hlAlpha','hlSquash','hlLid','hlBlur','waist','rays','cross','thick','rim','shade','halo'];
  const dead=[], weak=[];
  for(const f of window.__fxlist()){
    const V=window.__vals(f.id), base={};
    for(const k in V) base[k]=V[k];
    const traj=()=>{ const o=[]; for(let i=0;i<=60;i++){ const s=window.__probe(f.id, i*0.13);
      o.push(KEYS.map(k=>typeof s[k]==='number'?s[k]:0).join(','),
             (s.outRays||[]).map(r=>[r.ang,r.len,r.a,r.dot,r.glow].map(v=>(+v||0).toFixed(4)).join(':')).join(';'),
             s.extra?Object.keys(s.extra).map(k=>(+s.extra[k]||0).toFixed(3)).join(':'):'',
             (s.trail||[]).map(r=>[r.x,r.y,r.alpha].map(v=>(+v||0).toFixed(4)).join(':')).join(';')); }
      return o.join('|'); };
    for(const pr of f.params){
      const [key,label,mn,mx]=pr;
      if(Array.isArray(mn)) continue;
      const b0=V[key];
      V[key]=mn; const a=traj();
      V[key]=mx; const c=traj();
      V[key]=b0;
      if(a===c) dead.push(f.id+' · '+label+' ('+key+')');
    }
    // темп
    const t0=V['@tempo']; V['@tempo']=0.4; const a=traj(); V['@tempo']=3; const c=traj(); V['@tempo']=t0;
    if(a===c) dead.push(f.id+' · темп');
    for(const k in base) V[k]=base[k];
  }
  return {dead};
});
console.log('pageerrors',errs);
console.log('мёртвых ручек:', out.dead.length);
out.dead.forEach(d=>console.log('  !', d));
await b.close();
