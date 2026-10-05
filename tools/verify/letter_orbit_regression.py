#!/usr/bin/env python3
"""v4 follows the original mobile geometry, with an undistorted common orbit."""
import sys
from playwright.sync_api import sync_playwright
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page(viewport={'width':1440,'height':900},bypass_csp=True,reduced_motion='reduce')
 pg.goto(base+'/lab/desk/v1.html?embed=1&reduced=1');pg.wait_for_function('window.ORG?.state.last.length===17')
 original=pg.evaluate('Object.fromEntries(ORG.state.last.map(s=>[s.id,{w:s.node.w,h:s.node.h}]))')
 pg.goto(base+'/lab/desk/v4.html?embed=1&reduced=1');pg.wait_for_function('window.LETTER?.state.last.length===17')
 rows=pg.evaluate('LETTER.world(KIT.scene.ctx,0).map(n=>({id:n.id,w:n.w,h:n.h}))')
 for n in rows:
  assert abs(n['w']-original[n['id']]['w'])<1e-7 and abs(n['h']-original[n['id']]['h'])<1e-7
 result=pg.evaluate('''()=>{
 const ctx=KIT.scene.ctx,c={...ctx,reduced:false,P:{...ctx.P,orbit:1,orbitAngle:0}},period=c.P.orbitPeriod;
 const sample=t=>LETTER.world(c,t).flatMap(n=>[n.x,n.y,n.w,n.h,n.rot]);
 const a=sample(0),z=sample(period),eps=.001,left=sample(period-eps),right=sample(eps);
 const closure=Math.max(...a.map((v,i)=>Math.abs(v-z[i]))),velocity=Math.max(...a.map((v,i)=>Math.abs((v-left[i])/eps-(right[i]-z[i])/eps)));
 let maxStep=0;for(const count of [360,720]){let prev=sample(0);for(let i=1;i<=count;i++){const next=sample(i*period/count);maxStep=Math.max(maxStep,...next.map((v,j)=>Math.abs(v-prev[j])));prev=next;}}
 const reduced=JSON.stringify(LETTER.world({...c,reduced:true},0))===JSON.stringify(LETTER.world({...c,reduced:true},99));
 const start=LETTER.world(c,0),quarter=LETTER.world(c,period/4);const moved=Math.max(...start.map((n,i)=>Math.hypot(n.x-quarter[i].x,n.y-quarter[i].y)));
 const volume=points=>{let best=0;points.forEach(a=>points.forEach(b=>points.forEach(c=>{const d=[b[1]*c[2]-b[2]*c[1],b[2]*c[0]-b[0]*c[2],b[0]*c[1]-b[1]*c[0]];best=Math.max(best,Math.abs(a.reduce((s,x,i)=>s+x*d[i],0)));})));return best;};
 const coords=start.map(n=>n.volume),solid=volume(coords),flat=volume(coords.map(v=>[v[0],v[1],v[1]*.48]));
 return {closure,velocity,maxStep,reduced,moved,solid,flat,undeformed:start.every(n=>!n.bend&&!n.shear),links:LETTER.state.links.length};}''')
 assert result['closure']<1e-7 and result['velocity']<.02 and result['maxStep']<15 and result['reduced'],result
 assert result['solid']>.08 and result['flat']<1e-8,result
 assert result['moved']>100 and result['undeformed'] and result['links']==16,result
 pg.evaluate('Scene.set("orbitAngle",90)');positions=pg.evaluate('ORG.state.last.map(n=>[n.sx,n.sy])');assert all(0<x<1440 and 0<y<900 for x,y in positions)
 print('PASS v1 dimensions, 17 undistorted nodes, 16 links, shared orbit, loop continuity, reduced motion',result)
 b.close()
