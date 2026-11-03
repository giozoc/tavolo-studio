"""Scenari della cornice di Tavolo Studio: schede, pagina iniziale, tema comune e ponte delle formule
tra TableTeX e MathTeX dentro lo Studio. I test di ciascun editor sono in apps/<nome>/tests/."""
import asyncio, sys
from playwright.async_api import async_playwright
from harness import open_studio, frame

results=[]
def check(name, ok, detail=''):
    results.append((name, ok)); print(('OK   ' if ok else 'FAIL ')+name+('' if ok else '  → '+str(detail)[:400]))

TAB = '\\begin{tabular}{ll}\n  Energia & $E=mc^2$ \\\\ % Einstein\n\\end{tabular}'

async def main():
    async with async_playwright() as p:
        b, pg, errors = await open_studio(p)
        await pg.wait_for_timeout(300)
        check('al primo avvio si vede la pagina iniziale', await pg.is_visible('#home') and not await pg.evaluate('Object.keys(TavoloStudio.frames).length'))

        # le tre schede
        for app in ['tikz', 'mathtex', 'tabletex']:
            await pg.click(f'.tab[data-app="{app}"]')
            fr = await frame(pg, app)
            check(f'{app}: l\'editor si carica nella sua scheda', await fr.evaluate('!!document.getElementById("ed")'))
            check(f'{app}: nome e tema dell\'editor nascosti', not await fr.is_visible('.brand') and not await fr.is_visible('#b-theme'))
            check(f'{app}: la scheda è selezionata e l\'indirizzo la ricorda', await pg.get_attribute(f'.tab[data-app="{app}"]', 'aria-selected')=='true' and pg.url.endswith('#'+app), pg.url)
            vis = await pg.evaluate('Object.entries(TavoloStudio.frames).filter(([k,f])=>getComputedStyle(f).visibility==="visible").map(([k])=>k)')
            check(f'{app}: si vede solo il suo editor', vis==[app], vis)

        # tema comune
        await pg.click('#s-theme'); await pg.wait_for_timeout(100)
        th = await pg.evaluate('[document.documentElement.dataset.theme, ...Object.values(TavoloStudio.frames).map(f=>f.contentDocument.documentElement.dataset.theme)]')
        check('il tema scuro vale per lo Studio e per i tre editor', th==['dark']*4, th)
        keys = await pg.evaluate("['tz-theme','tl-theme','tt-theme'].map(k=>localStorage.getItem(k))")
        check('il tema è salvato anche per gli editor', keys==['dark']*3, keys)
        await pg.click('#s-theme'); await pg.wait_for_timeout(100)

        # ponte delle formule: TableTeX → MathTeX nella sua scheda → TableTeX
        mt = await frame(pg, 'mathtex')
        await mt.evaluate("setSource('a^2+b^2=c^2')"); await pg.wait_for_timeout(300)
        tt = await frame(pg, 'tabletex')
        await tt.evaluate('t=>{ Docs.close(false); St.ti=0; setSource(t); }', TAB)
        await tt.click('#grid td[data-r="0"][data-c="1"]'); await pg.keyboard.press('Control+e'); await pg.wait_for_timeout(200)
        pages_before = len(pg.context.pages)
        await tt.click('#fp-mt')
        await pg.wait_for_function('TavoloStudio.frames.mathtex.contentWindow.__ponteTableTeX', timeout=20000)
        mt = await frame(pg, 'mathtex')
        check('nessuna finestra in più: la formula si apre nella scheda MathTeX', len(pg.context.pages)==pages_before)
        check('la scheda MathTeX è in primo piano e segnala il ponte',
              await pg.get_attribute('.tab[data-app="mathtex"]', 'aria-selected')=='true' and 'ponte' in (await pg.get_attribute('.tab[data-app="mathtex"]', 'class')))
        check('MathTeX riceve la formula della cella', await mt.evaluate('St.src')=='E=mc^2', await mt.evaluate('St.src'))
        check('la barra del ponte indica la cella', 'B1' in await mt.evaluate('document.getElementById("ponte").textContent'))
        await mt.evaluate("setSource('E=mc^{2}\\\\,\\\\gamma')"); await pg.wait_for_timeout(800)
        s = await tt.evaluate('St.src')
        check('la modifica torna nella cella di TableTeX', 'Energia & $E=mc^{2}\\,\\gamma$ \\\\ % Einstein' in s, s)
        await mt.click('#pt-done'); await pg.wait_for_timeout(300)
        check('«Fatto» riporta alla scheda TableTeX', await pg.get_attribute('.tab[data-app="tabletex"]', 'aria-selected')=='true' and 'ponte' not in (await pg.get_attribute('.tab[data-app="mathtex"]', 'class')))
        mt = await frame(pg, 'mathtex')
        check('MathTeX torna alla formula su cui si lavorava prima', await mt.evaluate('St.src')=='a^2+b^2=c^2' and not await mt.evaluate('!!document.getElementById("ponte")'), await mt.evaluate('St.src'))

        # messaggi estranei ignorati
        await pg.evaluate("window.postMessage({type:'studio:open', app:'mathtex', hash:'#tabletex=xx'}, '*')"); await pg.wait_for_timeout(200)
        check('messaggi che non vengono dagli editor ignorati', await pg.get_attribute('.tab[data-app="tabletex"]', 'aria-selected')=='true')

        # indirizzo diretto e ultima scheda
        await pg.goto('http://app/index.html#tikz'); await frame(pg, 'tikz')
        check('index.html#tikz apre direttamente TikZ', await pg.get_attribute('.tab[data-app="tikz"]', 'aria-selected')=='true')
        await pg.goto('http://app/index.html'); await pg.wait_for_timeout(300)
        check('senza indirizzo si riapre l\'ultimo editor usato', await pg.get_attribute('.tab[data-app="tikz"]', 'aria-selected')=='true' and not await pg.is_visible('#home'))
        await pg.click('#s-home')
        check('il nome Tavolo Studio torna alla pagina iniziale', await pg.is_visible('#home') and not pg.url.endswith('#tikz'))
        await pg.click('.card[data-app="tabletex"]'); await frame(pg, 'tabletex')
        check('le schede della pagina iniziale aprono l\'editor', await pg.get_attribute('.tab[data-app="tabletex"]', 'aria-selected')=='true')

        # telefono
        await pg.set_viewport_size({'width':390, 'height':800}); await pg.click('#s-home'); await pg.wait_for_timeout(200)
        sw = await pg.evaluate('[document.documentElement.scrollWidth, innerWidth]')
        check('a larghezza di telefono niente scorrimento orizzontale', sw[0]<=sw[1], sw)

        check('nessun errore JavaScript', not errors, errors)
        await pg.screenshot(path=str(__import__('pathlib').Path(__file__).parent/'studio.png'))
        await b.close()
    ok=sum(1 for _,o in results if o); print(f'\n{ok}/{len(results)} scenari superati'); sys.exit(0 if ok==len(results) else 1)
asyncio.run(main())
