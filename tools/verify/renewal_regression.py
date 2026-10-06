#!/usr/bin/env python3
"""Content changes while hidden; scale varies, local orbits move and stacks point inward."""
import sys
from playwright.sync_api import sync_playwright
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page(viewport={'width':1440,'height':900},bypass_csp=True)
 for v in [8,9]:
  pg.goto(f'{base}/lab/desk/v{v}.html?embed=1');pg.wait_for_function('window.LETTER?.state.last.length===17')
  r=pg.evaluate('''()=>{const c=KIT.scene.ctx;let swaps=0,prev,scales=new Set(),contents=new Set();for(let t=0;t<340;t+=.025){let n=LETTER.world(c,t).find(n=>n.id==='hero');if(prev&&prev.contentId!==n.contentId){if(n.life!==0||prev.life!==0)throw Error('visible content swap');swaps++;}scales.add(n.entryScale);contents.add(n.contentId);prev=n;}
 const noOrbit={...c,P:{...c.P,orbit:0,refresh:0}},a=LETTER.world(noOrbit,0),b=LETTER.world(noOrbit,24),ag=ns=>{const p=ns.find(n=>n.id==='agents'),n=ns.find(n=>n.id==='ag0');return [n.x-p.x,n.y-p.y];},x=ag(a),y=ag(b);if(Math.hypot(x[0]-y[0],x[1]-y[1])<40)throw Error('local orbit absent');
 const reduced={...c,reduced:true};if(JSON.stringify(LETTER.world(reduced,0))!==JSON.stringify(LETTER.world(reduced,24)))throw Error('reduced motion');
 const F=RELIEF.last,n={x:100,y:100,w:200,h:150,rot:0},rects=[],g={save:()=>{},restore:()=>{},beginPath:()=>{},rect:()=>{},clip:()=>{},fillRect:(x,y,w,h)=>rects.push([x+w/2,y+h/2]),drawImage:(cv,x,y,w,h)=>rects.push([x+w/2,y+h/2]),strokeRect:()=>{}};EXPLORE_WIDGETS.stack(g,n,{...F,hub:{x:500,y:400}});if(!rects.every(p=>p[0]>=-1e-9&&p[1]>=-1e-9))throw Error('stack direction');rects.length=0;EXPLORE_WIDGETS.stack(g,n,{...F,hub:{x:-500,y:-400}});if(!rects.every(p=>p[0]<=1e-9&&p[1]<=1e-9))throw Error('stack fixed offset');return {swaps,scales:scales.size,contents:contents.size};}''')
  print(v,r);assert r['swaps']>=6 and r['contents']==6 and r['scales']>=6
 b.close()
