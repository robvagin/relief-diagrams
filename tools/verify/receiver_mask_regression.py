"""Receiver clips must contain every stack-shadow pixel; palette has no orange."""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox'])
 pg=b.new_page(viewport={'width':1440,'height':900},bypass_csp=True)
 for v in [8,9]:
  pg.goto(f'http://127.0.0.1:8766/lab/desk/v{v}.html?embed=1');pg.wait_for_function('window.LETTER?.state.last.length===17')
  print(v,pg.evaluate('''()=>{const F=RELIEF.last; if(F.T.accent.join()!==F.T.ink2.join())throw Error('orange accent');
 const cv=document.createElement('canvas');cv.width=cv.height=400;const g=cv.getContext('2d');g.translate(200,200);
 const n={x:0,y:0,w:180,h:140,rot:0};EXPLORE_WIDGETS.stack(g,n,{...F,ui:1,hub:{x:500,y:0}});
 const data=g.getImageData(0,0,400,400).data;let outside=0,inside=0,tones=new Set();
 for(let y=0;y<400;y++)for(let x=0;x<400;x++){const i=(y*400+x)*4;if(!data[i+3])continue;const xx=x-200+.5,yy=y-200+.5;const contained=[1,2].some(j=>Math.abs(xx-j*7)<=180*(1-j*.018)/2+1&&Math.abs(yy)<=140*(1-j*.018)/2+1);if(!contained)outside++;else{inside++;tones.add(data[i]);}}
 if(outside||inside<10000||tones.size<3)throw Error(JSON.stringify({outside,inside,tones:tones.size}));return {outside,inside,tones:tones.size,accent:F.T.accent};}'''))
  for w,h in [(1440,900),(768,1024),(390,844)]:
   pg.set_viewport_size({'width':w,'height':h});pg.evaluate('RELIEF.graph.paused=true;RELIEF.motion.clock.override=0;KIT.scene.list()[0].draw(KIT.scene.ctx)');pg.screenshot(path=f'/tmp/masked-{v}-{w}.png')
  pg.set_viewport_size({'width':1440,'height':900})
 b.close()
