#!/usr/bin/env python3
"""Browser regressions. Serve tools/site.py output, pass its base URL."""
import json, sys
from playwright.sync_api import sync_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce',bypass_csp=True)
 page.add_init_script("""(() => {
 const add=EventTarget.prototype.addEventListener, remove=EventTarget.prototype.removeEventListener;
 window.listenerBalance=0;
 EventTarget.prototype.addEventListener=function(t,f,o){if(this instanceof HTMLCanvasElement) window.listenerBalance++;return add.call(this,t,f,o)};
 EventTarget.prototype.removeEventListener=function(t,f,o){if(this instanceof HTMLCanvasElement) window.listenerBalance--;return remove.call(this,t,f,o)};
 })()""")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def ready(): page.wait_for_function("document.querySelector('#view iframe')?.contentWindow?.KIT?.scene?.ctx && document.querySelectorAll('#knobs input,#knobs select').length>0",timeout=30000)
 page.goto(BASE+'/?v=lab/gate/v1.html');ready()
 for scene in ['stack/v3','desk/v1','ledger/v1','cascade/v1','gate/v3']:
  page.locator('.it[title="lab/'+scene+'.html"]').click();ready()
  assert page.locator('#knobs input,#knobs select').count()>10,scene
 print('PASS controls survive 5 switches, including desk/ledger',flush=True)
 page.locator('#pauseb').click()
 page.locator('.it[title="lab/stack/v3.html"]').click();ready();page.wait_for_timeout(300)
 assert page.evaluate("document.querySelector('iframe').contentWindow.RELIEF.graph.paused")
 print('PASS pause preserved after navigation',flush=True)
 page.goto(BASE+'/lab/stack/v3.html?embed=1&reduced=1')
 page.wait_for_function('window.KIT?.scene.ctx && document.querySelector("canvas")._graph')
 canvas=page.locator('canvas').first
 canvas.focus();page.keyboard.press('ArrowRight');page.keyboard.press('Enter')
 assert page.evaluate('document.querySelector("canvas")._graph.view.zoom')>1
 assert page.locator('.graph-detail').is_visible()
 zoom=page.evaluate('document.querySelector("canvas")._graph.view.zoom')
 page.evaluate("Scene.set('grain',1.1)")
 assert page.evaluate('document.querySelector("canvas")._graph.view.zoom')==zoom
 balance=page.evaluate('listenerBalance')
 for v in [1.1,1.2,1.3]: page.evaluate('(v)=>Scene.set("explode",v)',v)
 assert page.locator('.graph-detail').count()==1
 assert page.evaluate('listenerBalance')==balance
 canvas.focus();page.keyboard.press('ArrowRight');page.keyboard.press('Enter')
 page.evaluate('window.liveGraph=document.querySelector("canvas")._graph; window.liveZoom=liveGraph.view.zoom')
 result=page.evaluate('''async () => {let url=RELIEF.export.png('16:9',2);let im=new Image();im.src=url;await im.decode();return [im.width,im.height,document.querySelector('canvas')._graph===liveGraph,liveGraph.view.zoom===liveZoom]}''')
 assert result==[3840,2160,True,True],result
 page.keyboard.press('Escape');assert page.evaluate('liveGraph.view.zoom')==1
 print('PASS reduced keyboard/details, cosmetic stability, binding cleanup, export isolation 3840x2160',flush=True)
 page.goto(BASE+'/lab/desk/v1.html?embed=1&reduced=1')
 page.wait_for_function('window.ORG?.state.G')
 page.evaluate('window.liveGraph=ORG.state.G')
 result=page.evaluate('''async () => {let url=RELIEF_APP.renderOffscreen(1920,1080,2);let im=new Image();im.src=url;await im.decode();return [im.width,im.height,ORG.state.G===liveGraph,document.querySelector('canvas')._graph===liveGraph]}''')
 assert result==[3840,2160,True,True],result
 page.set_viewport_size({'width':768,'height':900});page.wait_for_timeout(200)
 page.locator('canvas').first.focus();page.keyboard.press('ArrowRight');page.keyboard.press('Enter')
 assert page.evaluate('ORG.state.G.view.zoom')>1
 print('PASS desk export isolation and resize/rebind keyboard',flush=True)
 page.set_viewport_size({'width':390,'height':844})
 page.goto(BASE+'/?v=lab/desk/v1.html');ready()
 assert page.locator('#view').bounding_box()['height']>600
 page.locator('#controls-toggle').click()
 assert page.locator('#controls-toggle').get_attribute('aria-expanded')=='true'
 assert page.locator('#top').is_visible()
 assert page.evaluate('document.documentElement.scrollWidth')==390
 page.screenshot(path='/tmp/relief-mobile-controls.png')
 print('PASS mobile canvas space, controls disclosure and no horizontal overflow',flush=True)
 assert not errors,errors
 print('PASS no browser errors',flush=True)
 b.close()
