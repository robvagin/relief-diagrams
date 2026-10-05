from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page(viewport={'width':1440,'height':900},bypass_csp=True);errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 for v in [8,9]:
  pg.goto(f'http://127.0.0.1:8766/lab/desk/v{v}.html?embed=1');pg.wait_for_function('window.LETTER?.state.last.length===17')
  print(v,pg.evaluate('''()=>{const F=RELIEF.last,cv=document.createElement('canvas');cv.width=1440;cv.height=900;const raw=cv.getContext('2d');let arcs=0,images=0,strokes=0,labels=0,frames=0;const g=new Proxy(raw,{get(o,k){if(k==='arc')return (...a)=>{arcs++;return o.arc(...a)};if(k==='drawImage')return (...a)=>{images++;return o.drawImage(...a)};if(k==='stroke')return ()=>{strokes++;o.stroke()};if(k==='fillText')return (...a)=>{labels++;o.fillText(...a)};const v=o[k];return typeof v==='function'?v.bind(o):v},set(o,k,v){o[k]=v;return true}});
 for(let age=0;age<13;age+=.05){images=strokes=0;EXPLORE_WIDGETS.buds(g,[{id:'hero',contentId:'hero',generation:1,kind:'rect',x:400,y:400,w:240,h:200,birthAge:age}],F);if(images!==strokes)throw Error('line outlives card '+age);frames++;}
 if(arcs||!labels)throw Error('rings or missing content');let max=0;for(let t=0;t<100;t+=.1)for(const n of LETTER.world(KIT.scene.ctx,t))if(n.shape==='sheet')max=Math.max(max,Math.abs(n.rot));if(max>Math.PI/90+1e-8)throw Error('tilt');return {frames,arcs,textDraws:labels,maxTiltDegrees:max*180/Math.PI};}'''))
  for width,height in [(1440,900),(768,1024),(390,844)]:
   pg.set_viewport_size({'width':width,'height':height})
   pg.evaluate('()=>{RELIEF.graph.paused=true;RELIEF.motion.clock.override=10;KIT.scene.list()[0].draw(KIT.scene.ctx)}');pg.screenshot(path=f'/tmp/mini-cards-{v}-{width}.png')
  pg.set_viewport_size({'width':1440,'height':900})
 assert not errors,errors
 b.close()
