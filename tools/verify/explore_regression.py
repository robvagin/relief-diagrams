#!/usr/bin/env python3
"""Parent-local satellites: compact links, bounded avoidance and viewport containment."""
import sys
from playwright.sync_api import sync_playwright
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page(bypass_csp=True)
 for size in [(1440,900),(768,900),(390,844)]:
  pg.set_viewport_size(dict(zip(['width','height'],size)))
  for v in [5,6,7]:
   pg.goto(f'{base}/lab/desk/v{v}.html?embed=1');pg.wait_for_function('window.LETTER?.state.last.length===17')
   result=pg.evaluate('''()=>{const c=KIT.scene.ctx,route=EXPLORE_WIDGETS.route,unit=Math.min(c.W,c.H);let bounds=0,excess=0,checks=0,before=0,after=0;
 function collisions(ns){let count=0;ns.filter(n=>/^ag[0-9]|^st[12]/.test(n.id)).forEach(n=>ns.filter(o=>o.shape==='sheet').forEach(o=>{let dx=n.x-o.x,dy=n.y-o.y,x=Math.cos(o.rot)*dx+Math.sin(o.rot)*dy,y=-Math.sin(o.rot)*dx+Math.cos(o.rot)*dy;if(Math.hypot(Math.max(0,Math.abs(x)-o.w/2),Math.max(0,Math.abs(y)-o.h/2))<n.w/2)count++;}));return count;}
 for(let t=0;t<384;t++){EXPLORE_WIDGETS.route=()=>{};let raw;try{raw=LETTER.world(c,t);}finally{EXPLORE_WIDGETS.route=route;}const ns=LETTER.world(c,t),lookup=Object.fromEntries(ns.map(n=>[n.id,n])),orig=Object.fromEntries(raw.map(n=>[n.id,n]));before+=collisions(raw);after+=collisions(ns);
 ns.forEach(n=>{if(n.x-n.w/2<0||n.x+n.w/2>c.W||n.y-n.h/2<0||n.y+n.h/2>c.H)bounds++;let parent=/^ag[0-9]/.test(n.id)?'agents':/^st[0-9]/.test(n.id)?'stages':null;if(parent){let o=orig[n.id],p=lookup[parent],op=orig[parent];excess=Math.max(excess,Math.hypot(n.x-p.x,n.y-p.y)-(/^ag/.test(n.id)?unit*(.105+(Number(n.id.slice(2))%2)*.032):n.w/2+unit*.065));checks++;}});
 }return {bounds,excess,budget:unit*.035,checks,before,after};}''')
   print(size,v,result);assert result['bounds']==0 and result['checks']==3072 and result['excess']<=result['budget']+1e-6,result
 b.close()
