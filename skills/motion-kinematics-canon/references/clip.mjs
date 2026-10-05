import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';const {chromium}=pw;
const b=await chromium.launch({args:['--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1460,height:1200},deviceScaleFactor:1});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/client-SYMBOL-GALLERY.html'); await p.waitForFunction('window.__SYM_READY');
// прогоняем время по всем карточкам и ищем касание края канваса + пустой кадр
const res=await p.evaluate(async ()=>{
  const cards=[...document.querySelectorAll('.card')];
  const out=[];
  for(const card of cards){
    const id=card.dataset.id, cv=card.querySelector('canvas');
    if(!cv) { out.push({id,err:'нет канваса'}); continue; }
    card.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,120));
    let touch=0, blank=0, frames=0, minInk=1e9, maxInk=0;
    for(let i=0;i<40;i++){
      window.__freeze(i*0.37);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const g=cv.getContext('2d'), W=cv.width, H=cv.height;
      const d=g.getImageData(0,0,W,H).data;
      let ink=0, edge=0;
      const step=2;
      for(let y=0;y<H;y+=step) for(let x=0;x<W;x+=step){
        const a=d[(y*W+x)*4+3];
        if(a>18){ ink++; if(x<step*2||y<step*2||x>=W-step*2||y>=H-step*2) edge++; }
      }
      frames++; if(edge>6) touch++; if(ink<40) blank++;
      minInk=Math.min(minInk,ink); maxInk=Math.max(maxInk,ink);
    }
    out.push({id,touch,blank,frames,minInk,maxInk});
  }
  return out;
});
console.log('pageerrors',errs);
const bad=res.filter(r=>r.err||r.touch>0||r.blank>0);
for(const r of bad) console.log('!', r.id, JSON.stringify(r));
console.log('карточек',res.length,'· с проблемами',bad.length);
await b.close();
