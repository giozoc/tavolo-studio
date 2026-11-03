"""Avvia Tavolo MathTeX in Chromium headless.
Se la variabile LOCAL_LIBS punta a una cartella node_modules con mathlive e mathjax,
le richieste ai CDN vengono servite da lì (utile senza rete)."""
import os, pathlib, asyncio
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
LIBS = os.environ.get('LOCAL_LIBS')
TYPES = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.mjs':'application/javascript'}

async def open_app(p, width=1440, height=900, color_scheme='light'):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={'width':width,'height':height}, color_scheme=color_scheme, permissions=['clipboard-read','clipboard-write'])
    pg = await ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)+' @ '+str(getattr(e,'stack',''))[:600]))
    pg.on('console', lambda m: errors.append('console: '+m.text) if m.type=='error' else None)
    async def serve(route):
        url = route.request.url
        if url.startswith('http://app/'):
            f = ROOT / url[len('http://app/'):].split('?')[0]
        elif LIBS and 'cdn.jsdelivr.net/npm/' in url:
            rest = url.split('cdn.jsdelivr.net/npm/')[1].split('?')[0]
            pkg, _, path = rest.partition('/')
            f = pathlib.Path(LIBS) / pkg.split('@')[0] / path
        elif 'fonts.googleapis' in url or 'fonts.gstatic' in url:
            return await route.fulfill(status=200, body='', content_type='text/css')
        else:
            return await route.continue_()
        if f.is_file():
            await route.fulfill(path=str(f), content_type=TYPES.get(f.suffix, 'application/octet-stream'))
        else:
            await route.fulfill(status=404, body='')
    await ctx.route('**/*', serve)
    await pg.goto('http://app/index.html')
    await pg.wait_for_function('window.__mjReady===true', timeout=20000)
    await pg.wait_for_timeout(400)
    return b, pg, errors
