#!/usr/bin/env python3
"""Сайт GitHub Pages из репозитория: тот же шаг, что в .github/workflows/pages.yml.

    python3 tools/site.py              собрать _site/ (dist/ + lab/ + образец гейта + lab/index.json)
    python3 tools/site.py --serve      собрать и поднять http://127.0.0.1:8000/ (playground по http, не file://)
    python3 tools/site.py --index      только напечатать lab/index.json

lab/index.json: каждый lab/<сцена>/<вариант>.html одной строкой {scene, id, path, title}; title из <title>.
"""
import functools
import http.server
import io
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, '_site')
SCENES = ['gate', 'desk', 'cascade', 'stack', 'horizon', 'agents', 'ledger', 'glyph']
TITLE = re.compile(r'<title>(.*?)</title>', re.I | re.S)


def lab_index():
    items = []
    lab = os.path.join(ROOT, 'lab')
    if os.path.isdir(lab):
        for scene in sorted(os.listdir(lab), key=lambda s: (SCENES.index(s) if s in SCENES else 99, s)):
            d = os.path.join(lab, scene)
            if not os.path.isdir(d):
                continue
            files = [f for f in os.listdir(d) if f.endswith('.html') and not f.endswith('.src.html')]
            num = lambda f: (int(re.sub(r'\D', '', f) or 0), f)
            for f in sorted(files, key=num):
                head = io.open(os.path.join(d, f), encoding='utf-8', errors='replace').read(8192)
                m = TITLE.search(head)
                items.append({'scene': scene, 'id': f[:-5], 'path': 'lab/%s/%s' % (scene, f),
                              'title': re.sub(r'\s+', ' ', m.group(1)).strip() if m else f})
    return {'schema': 1, 'scenes': SCENES, 'items': items}


def build():
    if os.path.isdir(SITE):
        shutil.rmtree(SITE)
    os.makedirs(SITE)
    if os.path.isdir(os.path.join(ROOT, 'dist')):
        shutil.copytree(os.path.join(ROOT, 'dist'), SITE, dirs_exist_ok=True)
    if os.path.isdir(os.path.join(ROOT, 'lab')):
        shutil.copytree(os.path.join(ROOT, 'lab'), os.path.join(SITE, 'lab'), dirs_exist_ok=True)
    os.makedirs(os.path.join(SITE, 'sample'), exist_ok=True)
    shutil.copy(os.path.join(ROOT, 'vendor', 'gate', 'sample', 'index.html'), os.path.join(SITE, 'sample', 'index.html'))
    os.makedirs(os.path.join(SITE, 'lab'), exist_ok=True)
    idx = lab_index()
    with io.open(os.path.join(SITE, 'lab', 'index.json'), 'w', encoding='utf-8') as f:
        f.write(json.dumps(idx, ensure_ascii=False, indent=1) + '\n')
    if not os.path.exists(os.path.join(SITE, 'index.html')):
        with io.open(os.path.join(SITE, 'index.html'), 'w', encoding='utf-8') as f:
            f.write('<!doctype html><meta charset="utf-8"><title>relief</title><p style="font:16px system-ui;margin:48px">The playground is not built yet. See README.</p>')
    open(os.path.join(SITE, '.nojekyll'), 'w').close()
    print('_site: %d вариантов в lab/index.json' % len(idx['items']))


def main():
    if '--index' in sys.argv:
        print(json.dumps(lab_index(), ensure_ascii=False, indent=1))
        return 0
    build()
    if '--serve' in sys.argv:
        port = 8000
        h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SITE)
        print('http://127.0.0.1:%d/' % port)
        http.server.ThreadingHTTPServer(('127.0.0.1', port), h).serve_forever()
    return 0


if __name__ == '__main__':
    sys.exit(main())
