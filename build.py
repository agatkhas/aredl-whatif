#!/usr/bin/env python3
"""Builds dist/: the extension zip and the userscript."""
import io, json, os, zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')
SRC  = ['src/core.js', 'src/ui.js']

read = lambda p: io.open(os.path.join(ROOT, p), encoding='utf-8').read()

manifest = json.loads(read('manifest.json'))
version  = manifest['version']
os.makedirs(DIST, exist_ok=True)

# ---------------------------------------------------------------- extension
zip_path = os.path.join(DIST, 'aredl-whatif-%s.zip' % version)
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(os.path.join(ROOT, 'manifest.json'), 'manifest.json')
    for rel in SRC:
        z.write(os.path.join(ROOT, rel), rel)
    for name in sorted(os.listdir(os.path.join(ROOT, 'icons'))):
        if name.endswith('.png'):
            z.write(os.path.join(ROOT, 'icons', name), 'icons/' + name)
print('%-42s %6d bytes' % (os.path.relpath(zip_path, ROOT), os.path.getsize(zip_path)))

# ---------------------------------------------------------------- userscript
# @grant none puts the script in the page context, which is where it has to run
# to wrap window.fetch and reach window.__TSR_ROUTER__.
header = '\n'.join([
    '// ==UserScript==',
    '// @name         AREDL What-If',
    '// @namespace    https://aredl.net/',
    '// @version      %s' % version,
    '// @description  %s' % manifest['description'],
    '// @match        https://aredl.net/*',
    '// @match        https://www.aredl.net/*',
    '// @run-at       document-start',
    '// @grant        none',
    '// ==/UserScript==',
    '',
])
body = '\n\n'.join(read(p) for p in SRC)
us_path = os.path.join(DIST, 'aredl-whatif.user.js')
io.open(us_path, 'w', encoding='utf-8', newline='\n').write(header + '\n' + body)
print('%-42s %6d bytes' % (os.path.relpath(us_path, ROOT), os.path.getsize(us_path)))
