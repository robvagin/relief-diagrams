import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';const {chromium}=pw;
const b=await chromium.launch({args:['--enable-unsafe-swiftshader']});
for(const W of [1460,1180,900,760,520,360]){
  const p=await b.newPage({viewport:{width:W,height:1000}});
  await p.goto('file:///home/claude/client-SYMBOL-GALLERY.html'); await p.waitForFunction('window.__SYM_READY');
  await p.waitForTimeout(900);
  const r=await p.evaluate(()=>{
    const bad=[], scr=[];
    document.querySelectorAll('.card').forEach(c=>{
      const cr=c.getBoundingClientRect();
      const pan=c.querySelector('.cpanel');
      const canScroll=getComputedStyle(pan).overflowY==='auto'||getComputedStyle(pan).overflowY==='scroll';
      if(pan.scrollHeight > pan.clientHeight + 2 && !canScroll) bad.push({id:c.dataset.id, clip:pan.scrollHeight-pan.clientHeight});
      if(pan.scrollHeight > pan.clientHeight + 2) scr.push(c.dataset.id);
      if(c.scrollHeight > c.clientHeight + 2) bad.push({id:c.dataset.id, cardclip:c.scrollHeight-c.clientHeight});
    });
    const hs=[...new Set([...document.querySelectorAll('.card')].map(c=>Math.round(c.getBoundingClientRect().height)))];
    return {bad, scr, hs, scroll:document.documentElement.scrollWidth-document.documentElement.clientWidth,
            cols:getComputedStyle(document.getElementById('grid')).gridTemplateColumns.split(' ').length};
  });
  console.log(String(W).padStart(5), 'колонок',r.cols,'· высоты',JSON.stringify(r.hs),'· гор.прокрутка',r.scroll,'· обрезано',r.bad.length,'· с прокруткой',r.scr.length, r.scr.slice(0,4).join(' '));
  await p.close();
}
await b.close();
