"""Immagine del README: il file di esempi aperto come documento, con una macro e una selezione nella formula.
Uso: python readme_shot.py ../docs/anteprima.png"""
import asyncio, sys, pathlib
from playwright.async_api import async_playwright
from harness import open_app, ROOT
async def main():
    async with async_playwright() as p:
        b, pg, errors = await open_app(p, width=1440, height=820)
        doc = (ROOT / 'esempi' / 'formule.tex').read_text()
        doc = doc.replace('\\usepackage{amsmath,amssymb}', '\\usepackage{amsmath,amssymb}\n\\newcommand{\\R}{\\mathbb{R}}', 1)
        await pg.evaluate("t=>loadText(t,'formule.tex')", doc); await pg.wait_for_timeout(1200)
        await pg.evaluate("Formulas.select(3)")
        await pg.evaluate("t=>setSource(t)", "% Serie di Taylor centrata in x_0\nf(x) = \\sum_{n=0}^{\\infty}\n       \\frac{f^{(n)}(x_0)}{n!}\\,(x - x_0)^n, \\quad x \\in \\R")
        await pg.wait_for_timeout(900); await pg.click('#mf')
        await pg.evaluate("()=>{ const m=MF.el; m.position=m.lastOffset; for (let k=0;k<6;k++) m.executeCommand('moveToPreviousChar'); for (let k=0;k<7;k++) m.executeCommand('extendSelectionBackward'); }")
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=sys.argv[1])
        print(errors); await b.close()
asyncio.run(main())
