#!/usr/bin/env python3
"""A stale unversioned iframe must not survive a catalog content revision."""
import subprocess,sys
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
old_scene=subprocess.check_output(['git','show','abbea92:lab/desk/v7.html']).decode()
old_shell=subprocess.check_output(['git','show','01d3b6d:dist/index.html']).decode()
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox'])
 for negative in [True,False]:
  pg=b.new_page(bypass_csp=True)
  def handle(route):
   u=urlparse(route.request.url)
   if u.path.endswith('/lab/desk/v7.html') and not parse_qs(u.query).get('rev'):
    route.fulfill(body=old_scene,content_type='text/html')
   elif negative and u.path=='/':route.fulfill(body=old_shell,content_type='text/html')
   else:route.continue_()
  pg.route('**/*',handle)
  pg.goto(base+'/?v=lab%2Fdesk%2Fv7.html&rev=outer-only')
  pg.wait_for_timeout(900)
  f=next(f for f in pg.frames if '/lab/desk/v7.html' in f.url)
  f.wait_for_function('window.EXPLORE_WIDGETS&&window.LETTER?.state.last.length===17')
  stale=f.evaluate('EXPLORE_WIDGETS.route.toString().includes("Reserve a continuous outer lane")')
  assert stale==negative,(negative,f.url,stale)
  assert bool(parse_qs(urlparse(f.url).query).get('rev'))!=negative
  print('PASS', 'old shell reproduces stale scene' if negative else 'content revision bypasses stale scene',f.url)
  pg.close()
 b.close()
