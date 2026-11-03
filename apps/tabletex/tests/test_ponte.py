"""Ponte con Tavolo MathTeX: una formula di una cella si apre nell'altro editor e le modifiche tornano nella tabella.
Usa Tavolo MathTeX di apps/mathtex (o la copia indicata da MATHTEX_DIR)."""
import asyncio, sys, os
from playwright.async_api import async_playwright
from harness import open_app

results=[]
def check(name, ok, detail=''):
    results.append((name, ok)); print(('OK   ' if ok else 'FAIL ')+name+('' if ok else '  → '+str(detail)[:400]))

async def main():
    async with async_playwright() as p:
        b, pg, errors = await open_app(p)
        await pg.evaluate("""()=>{ localStorage.setItem('tt-mathtex-url','http://mathtex/index.html'); Docs.close(false); St.ti=0;
          setSource('\\\\begin{tabular}{ll}\\n  Energia & $E=mc^2$ \\\\\\\\ % Einstein\\n\\\\end{tabular}'); }""")
        await pg.click('#grid td[data-r="0"][data-c="1"]'); await pg.keyboard.press('Control+e'); await pg.wait_for_timeout(200)
        # il lavoro già salvato in MathTeX non deve sparire
        async with pg.context.expect_page() as pi:
            await pg.click('#fp-mt')
        mt = await pi.value
        mt_err=[]; mt.on('pageerror', lambda e: mt_err.append(str(e)))
        await mt.wait_for_function('window.__mjReady===true && window.__ponteTableTeX', timeout=20000)
        await mt.wait_for_timeout(300)
        check('Tavolo MathTeX riceve la formula della cella', await mt.evaluate('St.src')=='E=mc^2', await mt.evaluate('St.src'))
        check('la barra del ponte indica la cella', 'B1' in await mt.evaluate('document.getElementById("ponte").textContent'))
        check('l\'indirizzo non conserva la formula', '#tabletex' not in mt.url)
        # modifica nella formula di MathTeX (come se fosse fatta con i menu)
        await mt.evaluate("setSource('E=mc^{2}\\\\,\\\\gamma')"); await mt.wait_for_timeout(700)
        s = await pg.evaluate('St.src')
        check('la modifica torna nella cella', 'Energia & $E=mc^{2}\\,\\gamma$ \\\\ % Einstein' in s, s)
        check('nel sorgente della tabella cambia solo la formula', s.count('\n')==2 and s.startswith('\\begin{tabular}{ll}'), s)
        # delimitatori e commenti scelti in MathTeX non finiscono nella cella
        await mt.evaluate("setSource('\\\\begin{equation}\\n  x+1 % nota\\n\\\\end{equation}')"); await mt.wait_for_timeout(700)
        s = await pg.evaluate('St.src')
        check('senza delimitatori né commenti', 'Energia & $x+1$ \\\\ % Einstein' in s, s)
        await mt.click('#pt-done'); await pg.wait_for_timeout(300)
        check('«Fatto» chiude la finestra', mt.is_closed())
        # un messaggio da un'altra origine viene ignorato
        await pg.evaluate("""()=>window.postMessage({type:'tavolo:formula', id:'x', tex:'\\\\hacked'}, '*')"""); await pg.wait_for_timeout(200)
        check('messaggi da altre origini ignorati', 'hacked' not in await pg.evaluate('St.src'))
        check('nessun errore JavaScript', not errors and not mt_err, errors+mt_err)
        await b.close()
    ok=sum(1 for _,o in results if o); print(f'\n{ok}/{len(results)} scenari superati'); sys.exit(0 if ok==len(results) else 1)
asyncio.run(main())
