#!/usr/bin/env python3
"""Public-repo hygiene: no client names, no secrets, no licensed font names in code.

The forbidden words are stored as hashes in tools/names.h16 (sha256, first 16 hex of
the lower-cased word or word pair), so this file never spells what it hunts for:
a detector that names its targets would itself be a mention.

    python3 tools/clean_check.py              # every text file in the repo (private/ skipped)
    python3 tools/clean_check.py --staged     # only files staged for commit (pre-commit hook)
    python3 tools/clean_check.py PATH ...     # given files or folders
    python3 tools/clean_check.py --add "word" # append a hash (do this from a private shell)

Exit 0 clean · 1 hits · 2 the check itself is broken. A hit prints the file, the line
and the first two letters of the word, never the word.
"""
import hashlib, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIST = os.path.join(ROOT, 'tools', 'names.h16')
ALLOW = os.path.join(ROOT, 'tools', 'clean_allow.txt')   # 'path<TAB>h16(line)': fixtures of detectors, reviewed by hand
SKIP_DIRS = {'.git', 'node_modules', 'private', '__pycache__', '_site'}
TEXT_EXT = {'.md', '.txt', '.html', '.htm', '.js', '.mjs', '.cjs', '.css', '.json', '.py',
            '.sh', '.yml', '.yaml', '.svg', '.csv', '.toml'}
CODE_EXT = {'.html', '.htm', '.js', '.mjs', '.css', '.svg'}
WORD = re.compile(r"[A-Za-zА-Яа-яЁёІіЇїЄєҐґ0-9]+")
SECRET = re.compile(r"(?i)(?:\bBearer\s+[A-Za-z0-9._-]{12,}|\b(?:api[_-]?key|token|secret)\s*[:=]\s*['\"][A-Za-z0-9._-]{12,}|\bsk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,})")


def h16(s):
    return hashlib.sha256(s.encode('utf-8')).hexdigest()[:16]


def load():
    if not os.path.exists(LIST):
        print('names.h16 missing: the check cannot run'); sys.exit(2)
    names, fonts = set(), set()
    for line in open(LIST, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        kind, _, h = line.partition(' ')
        (fonts if kind == 'font' else names).add(h.strip())
    if not names:
        print('names.h16 is empty: the check cannot run'); sys.exit(2)
    return names, fonts


def files_from(args):
    out = []
    for a in args:
        p = os.path.join(ROOT, a) if not os.path.isabs(a) else a
        if os.path.isdir(p):
            for dp, dn, fn in os.walk(p):
                dn[:] = [d for d in dn if d not in SKIP_DIRS]
                out += [os.path.join(dp, f) for f in fn]
        elif os.path.isfile(p):
            out.append(p)
    return [f for f in out if os.path.splitext(f)[1].lower() in TEXT_EXT]


def staged():
    r = subprocess.run(['git', '-C', ROOT, 'diff', '--cached', '--name-only', '--diff-filter=ACMR'],
                       capture_output=True, text=True)
    paths = [p for p in r.stdout.splitlines() if p]
    bad = [p for p in paths if p.split('/')[0] == 'private']
    if bad:
        print('private/ must never be committed: %s' % bad[0]); sys.exit(1)
    return files_from(paths)


def allowed():
    out = set()
    if os.path.exists(ALLOW):
        for line in open(ALLOW, encoding='utf-8'):
            if line.strip() and not line.startswith('#'):
                rel, _, h = line.rstrip('\n').partition('\t')
                out.add((rel, h.strip()))
    return out


ALLOWED = None


def scan(path, names, fonts):
    global ALLOWED
    if ALLOWED is None:
        ALLOWED = allowed()
    try:
        src = open(path, encoding='utf-8').read()
    except (UnicodeDecodeError, OSError):
        return []
    rel = os.path.relpath(path, ROOT)
    lines_src = src.split('\n')
    hits = []
    words = [(m.group(0).lower(), m.start()) for m in WORD.finditer(src)]
    code = os.path.splitext(path)[1].lower() in CODE_EXT
    for i, (w, pos) in enumerate(words):
        cands = [w]
        if i + 1 < len(words):
            nxt = words[i + 1][0]
            cands += [w + ' ' + nxt, w + nxt]
        for c in cands:
            h = h16(c)
            if h in names or (code and h in fonts):
                hits.append((src.count('\n', 0, pos) + 1, c[:2] + '…'))
                break
    for m in SECRET.finditer(src):
        ln = src.count('\n', 0, m.start()) + 1
        if (rel, h16(lines_src[ln - 1])) in ALLOWED:
            continue
        hits.append((ln, 'secret'))
    return hits


def main(argv):
    if argv[:1] == ['--add']:
        word = ' '.join(argv[1:]).strip().lower()
        if not word:
            print('usage: --add "word"'); return 2
        with open(LIST, 'a', encoding='utf-8') as f:
            f.write('name %s\n' % h16(word))
        print('added hash %s' % h16(word)); return 0
    names, fonts = load()
    paths = staged() if argv[:1] == ['--staged'] else files_from(argv or ['.'])
    me = os.path.abspath(__file__)
    total = 0
    for p in sorted(set(paths)):
        if os.path.abspath(p) in (me, os.path.abspath(LIST)):
            continue
        for line, what in scan(p, names, fonts):
            total += 1
            if total <= 40:
                print('%s:%d  %s' % (os.path.relpath(p, ROOT), line, what))
    print('clean_check: %d file(s), %d hit(s)' % (len(paths), total))
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
