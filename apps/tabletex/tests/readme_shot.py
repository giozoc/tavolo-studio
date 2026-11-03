"""Immagine del README: il file degli esempi aperto come documento, con una selezione nella griglia."""
import asyncio, sys, pathlib
from playwright.async_api import async_playwright
from harness import open_app, ROOT

async def main():
    out = sys.argv[1] if len(sys.argv)>1 else str(ROOT/'docs'/'anteprima.png')
    async with async_playwright() as p:
        b, pg, errors = await open_app(p, width=1440, height=860)
        doc = (ROOT/'esempi'/'tabelle.tex').read_text()
        await pg.set_input_files('#file', files=[{'name':'tabelle.tex','mimeType':'text/x-tex','buffer':doc.encode()}])
        await pg.wait_for_timeout(300)
        await pg.click('#grid td[data-r="3"][data-c="1"]'); await pg.click('#grid td[data-r="4"][data-c="2"]', modifiers=['Shift'])
        await pg.evaluate("$('ed').scrollTop=0")
        await pg.wait_for_timeout(2200)
        await pg.screenshot(path=out)
        print('salvata', out, errors)
        await b.close()
asyncio.run(main())
