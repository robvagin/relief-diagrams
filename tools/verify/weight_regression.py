#!/usr/bin/env python3
"""Coupled refresh impulse: load, rebound, propagation and complete settling."""
import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page(viewport={'width':1440,'height':900},bypass_csp=True);pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766')+'/lab/desk/v4.html?embed=1');pg.wait_for_function('window.LETTER?.state.last.length===17')
 r=pg.evaluate('''()=>{const c=KIT.scene.ctx,off={...c,P:{...c.P,orbit:0,refresh:0}},on={...c,P:{...c.P,orbit:0}},baseline=LETTER.world(off,0);let peak=0,neighbours=0,negative=false;for(let i=0;i<720;i++){const t=4+i/180,ns=LETTER.world(on,t);ns.forEach((n,j)=>{const delta=n.y-baseline[j].y;if(n.id==='counts'){peak=Math.max(peak,Math.abs(delta));if(delta<-2)negative=true;}else neighbours=Math.max(neighbours,Math.abs(delta));});}
 const after=LETTER.world(on,8),error=Math.max(...after.map((n,j)=>Math.abs(n.y-baseline[j].y)));const eps=.0001;const boundaries=[0,2.8].map(t=>Math.abs((LETTER.impulse(t)-LETTER.impulse(t-eps))/eps-(LETTER.impulse(t+eps)-LETTER.impulse(t))/eps));return {period:c.P.orbitPeriod,peak,neighbours,negative,error,boundaries};}''');print(r);assert r['period']==384 and r['peak']>10 and r['neighbours']>3 and r['negative'] and r['error']<1e-8 and max(r['boundaries'])<.01
 b.close()
