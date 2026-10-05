import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page(bypass_csp=True)
 for size in [(1440,900),(768,900),(390,844)]:
  pg.set_viewport_size(dict(zip(['width','height'],size)))
  for v in [5,6,7]:
   pg.goto(f'{BASE}/lab/desk/v{v}.html?embed=1');pg.wait_for_function('window.LETTER?.state.last.length===17')
   result=pg.evaluate('''()=>{let overlaps=0,bounds=0,maxStep=0;const c=KIT.scene.ctx;let prev;for(let t=0;t<384;t+=1){let ns=LETTER.world(c,t);ns.forEach((n,i)=>{if(n.x-n.w/2<0||n.x+n.w/2>c.W||n.y-n.h/2<0||n.y+n.h/2>c.H)bounds++;if(prev)maxStep=Math.max(maxStep,Math.hypot(n.x-prev[i].x,n.y-prev[i].y));if(n.shape==='disc'&&n.id!=='hub'&&n.id!=='st0')ns.filter(o=>o.shape==='sheet').forEach(o=>{const dx=n.x-o.x,dy=n.y-o.y,x=Math.cos(o.rot)*dx+Math.sin(o.rot)*dy,y=-Math.sin(o.rot)*dx+Math.cos(o.rot)*dy;if(Math.hypot(Math.max(0,Math.abs(x)-o.w/2),Math.max(0,Math.abs(y)-o.h/2))<n.w/2)overlaps++;});});prev=ns;}return {overlaps,bounds,maxStep}}''')
   print(size,v,result);assert result['overlaps']==0 and result['bounds']==0,result
 b.close()
