#!/usr/bin/env python3
"""Sparse refresh, stable badge textures and whole-sphere pointer interactions."""
import sys
from playwright.sync_api import sync_playwright
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page(viewport={'width':1440,'height':900},bypass_csp=True,reduced_motion='reduce')
 pg.goto(base+'/lab/desk/v4.html?embed=1&reduced=1');pg.wait_for_function('window.LETTER?.state.last.length===17')
 result=pg.evaluate('''()=>{const c={...KIT.scene.ctx,reduced:false},ids=['hero','bars','gate','rule','counts','npl'];let peak=0,maxActive=0,active=0;
 for(let i=0;i<960;i++){const rs=ids.map(id=>LETTER.refresh(c,id,i/20));maxActive=Math.max(maxActive,rs.filter(Boolean).length);rs.filter(Boolean).forEach(r=>{peak=Math.max(peak,r.weight);active++;});}
 return {peak,maxActive,active,rest:ids.every(id=>!LETTER.refresh(c,id,0)),reduced:ids.every(id=>!LETTER.refresh({...c,reduced:true},id,6)),disabled:ids.every(id=>!LETTER.refresh({...c,P:{...c.P,refresh:0}},id,6))};}''')
 assert result['maxActive']==1 and result['active']>0 and result['peak']<=1.001 and result['rest'] and result['reduced'] and result['disabled'],result
 pg.evaluate('window.badgeCopies=Array.from(LETTER.discs.entries()).map(([k,v])=>[k,v.toDataURL()])')
 pg.evaluate('Scene.set("orbitAngle",90)')
 assert pg.evaluate('badgeCopies.every(([k,v])=>LETTER.discs.get(k)?.toDataURL()===v)')
 pg.evaluate('Scene.set("orbitAngle",0)')
 before=pg.evaluate('Object.fromEntries(ORG.state.last.map(n=>[n.id,[n.sx,n.sy]]))');hero=before['hero']
 pg.mouse.move(*hero);pg.mouse.down();pg.mouse.move(hero[0]+90,hero[1]+35,steps=12)
 during=pg.evaluate('({drag:LETTER.drag,individual:ORG.state.G.drag,positions:Object.fromEntries(ORG.state.last.map(n=>[n.id,[n.sx,n.sy]]))})')
 assert during['individual']==-1 and abs(during['drag']['yaw'])>.4
 assert sum(abs(during['positions'][k][0]-before[k][0])>3 for k in before)>8
 pg.mouse.up();assert not pg.locator('.graph-detail').is_visible()
 hero=pg.evaluate('ORG.state.last.find(n=>n.id==="hero")');pg.mouse.click(hero['sx'],hero['sy']);assert pg.locator('.graph-detail').is_visible()
 pg.keyboard.press('Escape')
 zoom=pg.evaluate('''()=>{const cv=document.querySelector('canvas'),fire=(type,id,x,y)=>cv.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,button:0}));const a=ORG.state.G.view.zoom;fire('pointerdown',71,600,400);fire('pointermove',71,620,400);fire('pointerdown',72,800,400);fire('pointermove',72,880,400);const z=ORG.state.G.view.zoom;fire('pointerup',72,880,400);fire('pointerup',71,620,400);return [a,z,LETTER.drag.held,ORG.state.G.drag];}''')
 assert zoom[1]>zoom[0]*1.2 and zoom[2] is False and zoom[3]==-1,zoom
 transmission=pg.evaluate("""()=>{const c=KIT.scene.ctx,g=c.g,images=new Set([...LETTER.state.textures.values(),...LETTER.discs.values()]),draw=g.drawImage,stroke=g.stroke;let translucentCards=0,ghostLines=0;
 g.drawImage=function(...args){if(images.has(args[0])&&this.globalAlpha<.999)translucentCards++;return draw.apply(this,args);};g.stroke=function(...args){if(Math.abs(this.globalAlpha-.1)<.001)ghostLines++;return stroke.apply(this,args);};
 try{KIT.scene.list()[0].draw(c);}finally{g.drawImage=draw;g.stroke=stroke;}return {translucentCards,ghostLines};}""")
 assert transmission['translucentCards']==0 and transmission['ghostLines']>0,transmission
 print('PASS sparse refresh, reduced motion, stable disc pixels, whole-sphere drag, click details and pinch',result)
 b.close()
