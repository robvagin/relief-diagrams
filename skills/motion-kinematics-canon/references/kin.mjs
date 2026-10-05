import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';const {chromium}=pw;
const b=await chromium.launch({args:['--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1460,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/client-SYMBOL-GALLERY.html'); await p.waitForFunction('window.__SYM_READY');
const only=process.argv.slice(2);
const out = await p.evaluate((only)=>{
  const TAU=Math.PI*2;
  const KEYS=['discScale','discAlpha','discX','discY','sx','sy','tone','hlX','hlY','hlScale','hlRot','hlAlpha','hlSquash','hlLid','hlBlur','waist','rays','cross','thick','rim','shade','halo'];
  const ONESHOT={wake:1};
  const list=window.__fxlist().filter(f=>!only.length||only.includes(f.id));
  function series(id,per,N){                       // выборка состояния по сетке
    const rows=[];
    for(let i=0;i<=N;i++){ const s=window.__probe(id, i*per/N); rows.push(s); }
    return rows;
  }
  function col(rows,k){
    let c=rows.map(s=>{ const v=s[k]; return (typeof v==='number'&&isFinite(v))?v:null; });
    if(k==='hlRot'){ let acc=0,prev=c[0]||0,un=[];    // угол разворачиваем
      for(const v of c){ let d=(v==null?prev:v)-prev; while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU; acc+=d; un.push(acc); prev=(v==null?prev:v); } c=un; }
    return c;
  }
  const res=[];
  for(const f of list){
    const V=window.__vals(f.id);
    let per = V.period ?? V.turn ?? V.cycle ?? null;
    if(per==null && V.move!=null) per=((V.move||0)+(V.pause||0))*Math.max(1,Math.round(V.steps||1));
    if(per==null && V.coast!=null) per=(V.spin||0)+(V.coast||0)+(V.rest||0);
    if(per==null && V.every!=null) per=V.every*Math.max(1,V.keep||1);
    if(per==null && V.rate!=null) per=(2.4/V.rate)*3;
    if(per==null && V.dur!=null && V.stay!=null) per=V.dur/1000+V.stay+V.dur/1000*0.9;
    if(per==null) per=4;
    per=per/(V['@tempo']||1);
    const N1=900, N2=1800;
    const r1=series(f.id,per,N1), r2=series(f.id,per,N2);
    const rep={id:f.id,name:f.name,group:f.group,per:+per.toFixed(2),nan:[],loop:[],c0:[],c1:[]};
    for(const s of r1) for(const k of KEYS){ const v=s[k];
      if(v!==undefined && (typeof v!=='number'||!isFinite(v))) rep.nan.push(k); }
    rep.nan=[...new Set(rep.nan)];
    for(const k of KEYS){
      const c1a=col(r1,k), c2a=col(r2,k);
      const amp=Math.max(...c1a)-Math.min(...c1a);
      if(amp<=1e-5) continue;
      // замкнутость: state(t) против state(t+per) в 8 точках
      if(!ONESHOT[f.id]){
        // приём может жить на кратном периоде — проверяем 1,2,3,4,5,6 циклов
        let best=Infinity, bestM=1;
        for(const mlt of [1,2,3,4,5,6]){
          let worst=0;
          for(const q of [0,.13,.27,.41,.55,.69,.83,.96]){
            const a=window.__probe(f.id,q*per)[k], b2=window.__probe(f.id,q*per+per*mlt)[k];
            if(typeof a!=='number'||typeof b2!=='number') continue;
            let d=Math.abs(a-b2);
            if(k==='hlRot'){ let m=((a-b2)%TAU+TAU)%TAU; d=Math.min(m,TAU-m); }
            worst=Math.max(worst,d);
          }
          if(worst<best-1e-9){ best=worst; bestM=mlt; }
        }
        const rel = k==='hlRot' ? best/0.05 : best/amp;
        if(rel>0.03) rep.loop.push({k,rel:+rel.toFixed(2)});
        else if(bestM>1) rep.mult=Math.max(rep.mult||1,bestM);
      }
      // сходимость по сетке: у гладкой функции max|Δ| падает вдвое при удвоении N,
      // у разрыва позиции остаётся; max|Δ²| падает вчетверо, у излома скорости — вдвое
      const d1=(c)=>{const o=[];for(let i=1;i<c.length;i++)o.push(Math.abs(c[i]-c[i-1]));return o;};
      const D1a=d1(c1a), D1b=d1(c2a);
      const m1a=Math.max(...D1a), m1b=Math.max(...D1b);
      const d2=(c)=>{const o=[];for(let i=2;i<c.length;i++)o.push(Math.abs(c[i]-2*c[i-1]+c[i-2]));return o;};
      const D2a=d2(c1a), D2b=d2(c2a);
      const m2a=Math.max(...D2a), m2b=Math.max(...D2b);
      if(m1a/amp>0.004 && m1b/m1a>0.72) rep.c0.push({k,size:+(m1b/amp).toFixed(3)});     // разрыв позиции
      else if(m2a/amp>0.004 && m2b/m2a>0.40) rep.c1.push({k,size:+(m2b/amp).toFixed(3)}); // излом скорости
    }
    res.push(rep);
  }
  return res;
}, only);
console.log('pageerrors',errs);
let bad=0;
for(const r of out){
  const t=[];
  if(r.nan.length) t.push('NaN['+r.nan.join(',')+']');
  if(r.loop.length) t.push('НЕЗАМКНУТ '+r.loop.map(x=>x.k+'='+x.rel).join(' '));
  if(r.c0.length)  t.push('РАЗРЫВ '+r.c0.map(x=>x.k+'='+x.size).join(' '));
  if(r.c1.length)  t.push('излом '+r.c1.map(x=>x.k+'='+x.size).join(' '));
  if(r.mult>1) t.push('цикл ×'+r.mult+' = '+(r.per*r.mult).toFixed(1)+'с');
  if(t.length){ bad++; console.log(('· '+r.name+' ['+r.id+'] '+r.per+'с').padEnd(40), t.join(' | ')); }
}
console.log('--- проблемных',bad,'из',out.length,'· чисто:',out.filter(r=>!r.nan.length&&!r.loop.length&&!r.c0.length&&!r.c1.length).map(r=>r.id).join(' '));
await b.close();
