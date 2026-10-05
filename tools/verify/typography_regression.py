#!/usr/bin/env python3
"""Measure actual glyph bounds inside every Desk paper widget. Needs served site and Playwright."""
from playwright.sync_api import sync_playwright
import json,sys
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page(bypass_csp=True,reduced_motion='reduce')
 for scene,size in [(scene,size) for scene in ['v1','v2','v3','v4'] for size in [(1440,900),(928,900),(768,900),(390,844)]]:
  pg.set_viewport_size({'width':size[0],'height':size[1]});pg.goto(base+'/lab/desk/'+scene+'.html?embed=1&reduced=1');pg.wait_for_function('window.ORG?.state.last.length > 0')
  result=pg.evaluate('''() => {
    const R=RELIEF,K=RINK,F=R.last,I=K.inks(F),out=[];
    for(const item of ORG.state.last){const n=item.node;if(!WIDGETS.W[n.id])continue;
      const g=document.createElement('canvas').getContext('2d'),calls=[],text=K.text;
      K.text=function(g,F,s,x,y,o){text(g,F,s,x,y,o);const m=g.measureText(o?.caps?String(s).toUpperCase():String(s));const t=g.getTransform();const box={s,x0:(x-m.actualBoundingBoxLeft)*t.a,x1:(x+m.actualBoundingBoxRight)*t.a,y0:(y-m.actualBoundingBoxAscent)*t.d,y1:(y+m.actualBoundingBoxDescent)*t.d};calls.push(box)};
      try{WIDGETS.W[n.id](g,F,I,n.w,n.h)}finally{K.text=text}
      const bad=calls.filter(t=>t.x0 < -n.w/2+2 || t.x1 > n.w/2-2 || t.y0 < -n.h/2+2 || t.y1 > n.h/2-2).map(t=>t.s);
      const collisions=[];for(let a=0;a<calls.length;a++)for(let b=a+1;b<calls.length;b++){const x=calls[a],y=calls[b];if(Math.min(x.x1,y.x1)-Math.max(x.x0,y.x0)>1 && Math.min(x.y1,y.y1)-Math.max(x.y0,y.y0)>1)collisions.push([x.s,y.s])}
      out.push({id:n.id,w:n.w,h:n.h,ui:F.ui,bad,collisions});
    }return out;
  }''')
  bad=[row for row in result if row['bad'] or row['collisions']]
  assert not bad,(scene,size,bad)
  print('PASS',scene,size,len(result),'widgets: no clipped or overlapping text',flush=True)
 b.close()
