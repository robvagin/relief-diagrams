#!/usr/bin/env python3
"""Letter geometry and shared-axis camera regression; needs a served site."""
import sys
from playwright.sync_api import sync_playwright
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page(viewport={'width':1440,'height':900},bypass_csp=True,reduced_motion='reduce')
 pg.goto(base+'/lab/desk/v4.html?embed=1&reduced=1');pg.wait_for_function('window.ORG?.state.last.length===6')
 frames=[]
 for angle in [0,45,90,180,270,360]:
  pg.evaluate('(v)=>Scene.set("orbitAngle",v)',angle)
  rows=pg.evaluate('ORG.state.last.map(s=>({id:s.id,w:s.node.w,h:s.node.h,x:s.sx,y:s.sy,rot:s.node.rot}))')
  assert all(abs(max(n['w'],n['h'])/min(n['w'],n['h'])-11/8.5)<1e-9 for n in rows)
  assert all(n['rot']==0 for n in rows)
  assert all(0<n['x']<1440 and 0<n['y']<900 for n in rows)
  frames.append({n['id']:n for n in rows})
 for name in frames[0]:
  assert max(f[name]['w'] for f in frames)/min(f[name]['w'] for f in frames)<1.12
  assert abs(frames[0][name]['x']-frames[-1][name]['x'])<1e-6
  assert abs(frames[0][name]['y']-frames[-1][name]['y'])<1e-6
 assert abs(frames[0]['hero']['x']-frames[2]['hero']['x'])>100
 print('PASS 6 orbit angles: Letter ratios, common orbit, no local spin, small scale range, closed turn')
 b.close()
