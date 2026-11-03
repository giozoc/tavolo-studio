"""Avvia Tavolo TikZ in Chromium headless.
I file del progetto sono serviti da http://app/ senza server; MathJax arriva dal CDN.
Se la variabile LOCAL_LIBS punta a una cartella node_modules con mathjax, le richieste
al CDN vengono servite da lì (utile senza rete)."""
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
LIBS = os.environ.get('LOCAL_LIBS')
TYPES = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.tex':'text/plain','.csv':'text/plain'}

async def open_app(p, width=1440, height=900, color_scheme='light', fresh=True):
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
    if fresh:
        await ctx.add_init_script('try{ if(!sessionStorage.getItem("t")){ localStorage.clear(); sessionStorage.setItem("t","1"); } }catch(e){}')
    await pg.goto('http://app/index.html')
    await pg.wait_for_function('window.__mjReady===true', timeout=30000)
    await pg.wait_for_timeout(300)
    return b, pg, errors

async def load(pg, text, data=None):
    """Carica un sorgente (ed eventuali file di dati) e attende che MathJax abbia composto i testi."""
    await pg.evaluate('([t,d])=>{ if (d) setData(d); figIdx=0; selStart=null; setSource(t,{record:false}); }', [text, data])
    for _ in range(40):
        if await pg.evaluate('!mjPending.size'): break
        await pg.wait_for_timeout(100)
    await pg.wait_for_timeout(80)

async def warnings(pg):
    return await pg.evaluate('lastR.warns.map(w=>({kind:w.kind, line:lineOfSrc(w.pos), msg:w.msg}))')
