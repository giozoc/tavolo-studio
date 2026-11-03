"""Scenari d'uso reali, con mouse e tastiera, sull'interfaccia completa."""
import asyncio, sys, tempfile, pathlib, re
from playwright.async_api import async_playwright
from harness import open_app, load, warnings, ROOT

results = []
def check(name, ok, detail=''):
    results.append((name, ok)); print(('OK   ' if ok else 'FAIL ')+name+('' if ok else '  → '+str(detail)[:300]))

async def src(pg):
    await pg.wait_for_timeout(120)
    return await pg.evaluate('src')
async def reset_view(pg):
    """vista fissa: l'origine al centro, 50 px per cm"""
    await pg.evaluate('()=>{ const r=cv.getBoundingClientRect(); view.k=50; view.x=-r.width/100; view.y=-r.height/100; applyView(); }')
async def click_page(pg, x, y):
    """clic sul disegno nel punto (x, y) in cm"""
    sx, sy = await pg.evaluate('([x,y])=>{ const r=cv.getBoundingClientRect(); return [r.left+(x-view.x)*view.k, r.top+(-y-view.y)*view.k]; }', [x, y])
    await pg.mouse.click(sx, sy); await pg.wait_for_timeout(120)
async def cell_center(pg, r, c):
    return await pg.evaluate('([r,c])=>{ const n=lastR.cd.cells[r+"-"+c].node; return n.c; }', [r, c])
async def pal_click(pg, pane, label):
    await pg.click(f'#{pane} button:has-text("{label}")'); await pg.wait_for_timeout(80)
async def plot_pts(pg):
    """numero di vertici del primo \\addplot disegnato"""
    return await pg.evaluate("""()=>{ const k=lastR.stmts.findIndex(s=>s.cmd==='addplot'); if (k<0) return 0;
      const p=drawG.querySelector(`[data-s="${k}"] path:not(.hit)`); return p ? (p.getAttribute('d').match(/[ML]/g)||[]).length : 0; }""")
async def errs(pg):
    return [w for w in await warnings(pg) if w['kind']=='e']

async def main():
    async with async_playwright() as p:
        b, pg, errors = await open_app(p)

        # 1. dati da file: avviso se manca, grafico quando il file è caricato
        csv = (ROOT/'esempi'/'misure.csv').read_text()
        await load(pg, r"""\begin{tikzpicture}\begin{axis}
\addplot table[x=tempo, y=temperatura, col sep=comma] {misure.csv};
\end{axis}\end{tikzpicture}""")
        await pg.evaluate('()=>{ for (const k of Object.keys(DATA)) delete DATA[k]; renderNow(); }')
        w = await warnings(pg)
        check('CSV mancante: avviso con il nome del file', any('misure.csv' in x['msg'] for x in w), w)
        d = tempfile.mkdtemp(); f = pathlib.Path(d)/'misure.csv'; f.write_text(csv)
        await pg.set_input_files('#file', str(f)); await pg.wait_for_timeout(300)
        w = await warnings(pg)
        npts = await plot_pts(pg)
        check('CSV caricato da «Apri»: nessun avviso e 9 punti', not w and npts==9, (w, npts))
        check('CSV ricordato nel browser', 'misure.csv' in (await pg.evaluate("localStorage.getItem('tz-data')") or ''))
        await pg.click('#b-data'); await pg.wait_for_selector('#modal:not([hidden]) table.dt')
        txt = await pg.inner_text('#m-b')
        check('finestra Dati: elenca il file e lo segna in uso', 'misure.csv' in txt and 'in uso' in txt, txt[:200])
        await pg.click('#m-x')
        await load(pg, r"""\pgfplotstableread[col sep=comma]{misure.csv}\tab
\begin{tikzpicture}\begin{axis}
\addplot table[x=tempo, y=umidita] {\tab};
\end{axis}\end{tikzpicture}""")
        npts = await plot_pts(pg)
        check('\\pgfplotstableread nel preambolo e table {\\macro}', npts==9 and not await warnings(pg), (npts, await warnings(pg)))
        await load(pg, r"""\begin{tikzpicture}\draw plot file {punti.dat};\end{tikzpicture}""", {'punti.dat':'0 0\n1 1\n2 0\n'})
        n = await pg.evaluate("drawG.querySelectorAll('path').length")
        check('plot file {…} di TikZ', n>0 and not await warnings(pg), await warnings(pg))
        await load(pg, r"""\begin{tikzpicture}\begin{axis}\addplot table {virgole.csv};\end{axis}\end{tikzpicture}""", {'virgole.csv':'x,y\n0,1\n1,2\n'})
        w = await warnings(pg)
        check('CSV con virgole senza col sep: suggerisce col sep=comma', any('col sep=comma' in x['msg'] for x in w), w)

        # 2. pannello tikz-cd: oggetti, frecce, proprietà
        await load(pg, '')
        await pg.keyboard.press('d'); await reset_view(pg)
        check('tasto D apre il pannello tikz-cd', await pg.is_visible('#cdpal'))
        await pal_click(pg, 'cdpal', 'Oggetto'); await click_page(pg, 0, 0)
        inl = await pg.query_selector('#inl')
        if inl: await pg.keyboard.press('Enter')
        s = await src(pg)
        check('Oggetto: crea il diagramma e la prima cella', re.search(r'\\begin\{tikzcd\}\s*A\s*\\end\{tikzcd\}', s) is not None and inl is not None, s)
        a = await cell_center(pg, 1, 1)
        await pal_click(pg, 'cdpal', 'Oggetto'); await click_page(pg, a[0]+1.8, a[1]); await pg.keyboard.press('Enter')
        a = await cell_center(pg, 1, 1)   # il diagramma si ricentra a ogni nuova colonna
        await pal_click(pg, 'cdpal', 'Oggetto'); await click_page(pg, a[0], a[1]-1.4); await pg.keyboard.press('Enter')
        s = await src(pg)
        check('Oggetto a destra e sotto: nuove colonne e righe', re.search(r'A\s*&\s*B\s*\\\\\s*C', s) is not None, s)
        a = await cell_center(pg, 1, 1); b1 = await cell_center(pg, 1, 2); c1 = await cell_center(pg, 2, 1)
        await pal_click(pg, 'cdpal', 'Freccia'); await click_page(pg, *a); await click_page(pg, *b1)
        await pal_click(pg, 'cdpal', 'Inclusione'); await click_page(pg, *a); await click_page(pg, *c1)
        s = await src(pg)
        check('Freccia e Inclusione tra le celle', '\\arrow[r, "f"]' in s and '\\arrow[d, hook, "g"]' in s, s)
        a = await cell_center(pg, 1, 1)
        await pal_click(pg, 'cdpal', 'Oggetto'); await click_page(pg, a[0]-1.8, a[1]+1.4); await pg.keyboard.press('Enter')
        s = await src(pg)
        cells = await pg.evaluate('Object.keys(lastR.cd.cells).filter(k=>/^\\d+-\\d+$/.test(k)).sort().join(" ")')
        check('Oggetto in alto a sinistra: aggiunge riga e colonna senza rompere le frecce', cells=='1-1 2-2 2-3 3-2' and not await errs(pg), (cells, s))
        arrows = await pg.evaluate("lastR.stmts.filter(s=>s.cmd==='arrow' && s.cd.from && s.cd.to).map(s=>s.cd.from.r+'-'+s.cd.from.c+'>'+s.cd.to.r+'-'+s.cd.to.c).join(' ')")
        check('le frecce collegano ancora le stesse celle', arrows=='2-2>2-3 2-2>3-2', arrows)
        # proprietà della freccia: etichetta dall'altro lato e tipo
        si = await pg.evaluate("lastR.stmts.findIndex(s=>s.cmd==='arrow')")
        await pg.evaluate('si=>{ selStart=lastR.stmts[si].start; updateProps(); }', si)
        await pg.check('#cd-swap'); s = await src(pg)
        check('pannello: etichetta dall\'altro lato → "f"\'', '"f"\']' in s, s)
        await pg.select_option('#cd-head', 'Rightarrow'); s = await src(pg)
        check('pannello: tipo Rightarrow', re.search(r'\\arrow\[r, "f"\', Rightarrow\]|\\arrow\[r, Rightarrow, "f"\'\]', s) is not None, s)
        await pg.fill('#cd-lab', '\\phi'); await pg.press('#cd-lab', 'Enter'); s = await src(pg)
        check('pannello: testo dell\'etichetta', '"\\phi"\'' in s, s)
        check('nessun errore nel diagramma', not await errs(pg), await warnings(pg))

        # 3. pannelli che si escludono
        await pg.keyboard.press('Escape'); await pg.click('#b-uml')
        check('aprire UML chiude tikz-cd', await pg.is_visible('#umlpal') and not await pg.is_visible('#cdpal'))
        await pg.keyboard.press('k')
        check('tasto K apre i circuiti e chiude UML', await pg.is_visible('#czpal') and not await pg.is_visible('#umlpal'))

        # 4. pannello circuiti
        await load(pg, '\\begin{circuitikz}\n\\end{circuitikz}\n'); await reset_view(pg)
        # (il pannello proprietà si apre a destra: si lavora a sinistra e si deseleziona con Esc)
        await pal_click(pg, 'czpal', 'Resistore'); await click_page(pg, -4, 0); await click_page(pg, -2, 0); await pg.keyboard.press('Escape')
        await pal_click(pg, 'czpal', 'Condensatore'); await click_page(pg, -2, 0); await click_page(pg, -2, -2); await pg.keyboard.press('Escape')
        await pal_click(pg, 'czpal', 'Massa'); await click_page(pg, -2, -2); await pg.keyboard.press('Escape')
        s = await src(pg)
        check('Resistore, Condensatore e Massa', '\\draw (-4,0) to[R=$R_1$] (-2,0);' in s and '\\draw (-2,0) to[C=$C_1$] (-2,-2);' in s and '\\draw (-2,-2) node[ground]{};' in s, s)
        si = await pg.evaluate("lastR.stmts.findIndex(s=>s.cz && s.cz[0].comp==='R')")
        await pg.evaluate('si=>{ selStart=lastR.stmts[si].start; updateProps(); }', si)
        await pg.select_option('#cz-t0', 'L'); s = await src(pg)
        check('pannello: cambia il tipo di componente tenendo l\'etichetta', 'to[L=$R_1$]' in s, s)
        await pg.fill('#cz-l0', '$L_1$'); await pg.press('#cz-l0', 'Enter'); s = await src(pg)
        check('pannello: cambia l\'etichetta', 'to[L=$L_1$]' in s, s)
        await pg.keyboard.press('Escape')
        await pal_click(pg, 'czpal', 'Amplificatore operazionale'); await click_page(pg, -3, 2)
        s = await src(pg)
        check('Amplificatore con nome e ancore', '\\node[op amp] (A1) at (-3,2) {};' in s and not await errs(pg), s)
        await load(pg, s + '\\draw (A1.-) -- ++(-1,0);')
        check('ancora (A1.-) dell\'amplificatore', not await warnings(pg), await warnings(pg))
        # clic sul simbolo (sopra il filo) seleziona il componente
        await pg.keyboard.press('Escape'); await click_page(pg, -3, 0.18)
        si = await pg.evaluate('curStmt()'); cmd = await pg.evaluate('si=>si>=0 && lastR.stmts[si].cz ? lastR.stmts[si].cz[0].comp : null', si)
        check('clic sul simbolo del resistore lo seleziona', cmd=='L', cmd)
        await pg.keyboard.press('Escape')
        # aggancio ai piedini: il componente parte da (A1.out)
        outp = await pg.evaluate("lastR.pins.find(q=>q.t==='(A1.out)').p")
        await pal_click(pg, 'czpal', 'Resistore'); await click_page(pg, outp[0]+0.05, outp[1]-0.05); await click_page(pg, outp[0]+2, outp[1])
        s = await src(pg)
        check('aggancio al piedino: to[R] da (A1.out)', re.search(r'\\draw \(A1\.out\) to\[R=\$R_\d\$\]', s) is not None, s[-300:])
        await pg.keyboard.press('Escape')
        # collegamento ad angolo: da un capo, un punto libero, doppio clic
        await pal_click(pg, 'czpal', 'Collegamento ad angolo'); await click_page(pg, -4, 0.04); await click_page(pg, -6, 2); await click_page(pg, -6, 2)
        s = await src(pg)
        check('Collegamento ad angolo con doppio clic', '\\draw (-4,0) -| (-6,2);' in s, s[-300:])
        await pg.keyboard.press('Escape')
        # collegamento a più punti che si chiude da solo su un capo
        await pal_click(pg, 'czpal', 'Collegamento'); await click_page(pg, -6, -3); await click_page(pg, -2, -3); await click_page(pg, -2.03, -2.02)
        s = await src(pg)
        check('Collegamento che termina su un capo', '\\draw (-6,-3) -- (-2,-3) -- (-2,-2);' in s and not await errs(pg), s[-300:])

        # spostare un elemento del circuito tiene attaccati i fili e i componenti collegati
        await load(pg, '\\begin{circuitikz}\n  \\draw (0,0) to[R] (2,0);\n  \\draw (2,0) to[C] (2,-2);\n  \\draw (2,-2) node[ground]{};\n  \\draw (4,4) -- (5,4);\n\\end{circuitikz}\n'); await reset_view(pg)
        await pg.keyboard.press('Escape'); await pg.evaluate("()=>{ selStart=lastR.stmts.find(s=>s.cz && s.cz[0].comp==='R').start; updateProps(); }")
        await pg.keyboard.press('ArrowUp'); s = await src(pg)
        check('freccia ↑ sul resistore: il condensatore resta collegato', '(0,0.25) to[R] (2,0.25)' in s and '(2,0.25) to[C] (2,-2)' in s and '(2,-2) node[ground]' in s and '(4,4) -- (5,4)' in s, s)
        await pg.keyboard.press('Escape')
        sx, sy = await pg.evaluate('([x,y])=>{ const r=cv.getBoundingClientRect(); return [r.left+(x-view.x)*view.k, r.top+(-y-view.y)*view.k]; }', [2, -2.15])
        await pg.mouse.move(sx, sy); await pg.mouse.down(); await pg.mouse.move(sx+20, sy+20, steps=4); await pg.mouse.move(sx, sy+50, steps=6); await pg.mouse.up()
        s = await src(pg)
        check('trascinando la massa il condensatore si allunga con lei', '(2,0.25) to[C] (2,-3)' in s and '(2,-3) node[ground]' in s, s)

        # strumenti TikZ su un tikzcd: aprono una nuova figura invece di scrivere nel diagramma
        await load(pg, (ROOT/'esempi'/'pullback.tex').read_text()); await reset_view(pg)
        await pg.keyboard.press('Escape'); await pg.keyboard.press('n'); await click_page(pg, -3, 0); await pg.keyboard.press('Enter')
        s = await src(pg)
        check('Nodo su un tikzcd: nuova tikzpicture, diagramma intatto', '\\begin{tikzpicture}\n  \\node at (-3,0)' in s and s.count('\\arrow')==(ROOT/'esempi'/'pullback.tex').read_text().count('\\arrow') and s.rstrip().endswith('\\end{document}') and await pg.evaluate('figIdx')==1, s[-200:])

        # 5. tutti gli esempi del menu
        names = await pg.evaluate('Object.keys(EXAMPLES)')
        bad = []
        for i, n in enumerate(names):
            await pg.click('#b-ex'); await pg.locator('#m-b [data-ex]').nth(i).click(); await pg.wait_for_timeout(250)
            e = await errs(pg)
            if e: bad.append((n, e))
        check(f'esempi del menu senza errori ({len(names)})', not bad, bad)

        # 6. esportazione: pacchetti giusti
        await load(pg, (ROOT/'esempi'/'pullback.tex').read_text())
        doc = await pg.evaluate('standalone()')
        check('esportazione tikz-cd: \\usepackage{amssymb} e {tikz-cd}', '\\usepackage{tikz-cd}' in doc and 'amssymb' in doc, doc[:300])
        await load(pg, '\\begin{tikzpicture}\\draw (0,0) to[R] (2,0);\\end{tikzpicture}')
        doc = await pg.evaluate('standalone()')
        check('esportazione circuito: \\usepackage{circuitikz}', '\\usepackage{circuitikz}' in doc, doc[:300])

        await pg.click('#b-export'); await pg.wait_for_selector('#x-svg')
        async with pg.expect_download() as dl: await pg.click('#x-svg')
        d = await dl.value; path = await d.path(); body = pathlib.Path(path).read_text()
        check('Esporta: «Scarica SVG» salva un file .svg', d.suggested_filename.endswith('.svg') and body.startswith('<svg') and 'circle' in body or 'path' in body, d.suggested_filename)
        await pg.click('#m-x')
        check('nessun errore JavaScript', not errors, errors)
        await b.close()
    nok = sum(1 for _, ok in results if not ok)
    print(f'{len(results)-nok}/{len(results)} superati')
    sys.exit(1 if nok else 0)

if __name__=="__main__": asyncio.run(main())
