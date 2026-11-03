"""Avvia Tavolo Studio in Chromium headless.
I file del repository (la cornice e i tre editor in apps/) sono serviti da http://app/ senza server.
Se la variabile LOCAL_LIBS punta a una cartella node_modules con mathlive e mathjax,
le richieste ai CDN vengono servite da lì (utile senza rete)."""
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
LIBS = os.environ.get('LOCAL_LIBS')
TYPES = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.mjs':'application/javascript','.tex':'text/plain','.csv':'text/plain'}

async def open_studio(p, width=1440, height=900, color_scheme='light', path='index.html'):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={'width':width,'height':height}, color_scheme=color_scheme, permissions=['clipboard-read','clipboard-write'])
    errors = []
    async def serve(route):
        url = route.request.url
        if url.startswith('http://app/'):
            f = ROOT / (url[len('http://app/'):].split('?')[0].split('#')[0] or 'index.html')
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
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)+' @ '+str(getattr(e,'stack',''))[:600]))
    pg.on('console', lambda m: errors.append('console: '+m.text) if m.type=='error' else None)
    await pg.goto('http://app/index.html')
    await pg.evaluate('localStorage.clear()')
    await pg.goto('http://app/'+path)
    return b, pg, errors

async def frame(pg, app, timeout=30000):
    """Attende che l'editor della scheda sia pronto (MathJax compreso) e ne restituisce il Frame di Playwright."""
    await pg.wait_for_function(f'(()=>{{ const f=TavoloStudio.frames.{app}; return f && f.contentWindow && f.contentWindow.__mjReady===true && f.contentDocument.getElementById("studio-css"); }})()', timeout=timeout)
    await pg.wait_for_timeout(300)
    h = await pg.query_selector(f'#frames iframe[data-app="{app}"]')
    return await h.content_frame()
