"""Scenari d'uso reali, con mouse e tastiera, sull'interfaccia completa."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import open_app

results = []
def check(name, ok, detail=''):
    results.append((name, ok)); print(('OK   ' if ok else 'FAIL ')+name+('' if ok else '  → '+str(detail)))

async def src(pg):
    await pg.wait_for_timeout(90)
    return await pg.evaluate('St.src')
async def mfv(pg):
    await pg.wait_for_timeout(90)
    return await pg.evaluate('MF.value()')
async def set_src(pg, t): await pg.evaluate('t=>{ setSource(t); }', t); await pg.wait_for_timeout(60)
async def click_mf_end(pg):
    await pg.click('#mf'); await pg.keyboard.press('End'); await pg.wait_for_timeout(50)
async def gallery(pg, struct, label):
    await pg.click(f'[data-st="{struct}"]'); await pg.wait_for_selector('#pop:not([hidden]) .gi')
    await pg.click(f'#pop .gi[title^="{label} —"]'); await pg.wait_for_timeout(80)

async def main():
    async with async_playwright() as p:
        b, pg, errors = await open_app(p)
        # 1. frazione dal menu, poi numeratore, Tab, denominatore
        await set_src(pg, ''); await click_mf_end(pg)
        await gallery(pg, 'frac', 'In pila')
        await pg.keyboard.type('1'); await pg.keyboard.press('Tab'); await pg.keyboard.type('2')
        await pg.wait_for_timeout(100)
        check('frazione: struttura, numeratore, Tab, denominatore', await src(pg)=='\\frac{1}{2}', await src(pg))
        # 2. si continua a scrivere dopo la frazione
        await pg.keyboard.press('ArrowRight'); await pg.keyboard.type('+x')
        check('si esce dalla frazione e si continua', await src(pg)=='\\frac{1}{2}+x', await src(pg))
        # 3. radice che avvolge la selezione
        await set_src(pg, 'a+b'); await pg.click('#mf'); await pg.keyboard.press('ControlOrMeta+a')
        await gallery(pg, 'rad', 'Radice quadrata')
        check('radicale applicato alla selezione', await src(pg)=='\\sqrt{a+b}', await src(pg))
        # 4. esponente sostituito
        await set_src(pg, 'x^{2}+1'); await pg.click('#mf'); await pg.keyboard.press('Home')
        for _ in range(3): await pg.keyboard.press('ArrowRight')   # dopo x, nell'esponente, dopo il 2
        await pg.keyboard.press('Backspace'); await pg.keyboard.type('3')
        check('esponente sostituito, graffe e resto intatti', await src(pg)=='x^{3}+1', await src(pg))
        # 5. simbolo dalla galleria
        await set_src(pg, 'a='); await click_mf_end(pg)
        await pg.select_option('#symcat', 'greek'); await click_mf_end(pg)
        await pg.click('#symgrid [data-tpl="\\\\alpha"]'); await pg.wait_for_timeout(60)
        check('simbolo inserito al cursore', await src(pg)=='a=\\alpha', await src(pg))
        # 6. conservazione del sorgente: commento, a capo e spazi restano
        orig = "% formula risolutiva\nx_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"
        await set_src(pg, orig); await click_mf_end(pg); await pg.keyboard.type('+c')
        s = await src(pg)
        check('modifica visuale: il resto del sorgente è identico', s==orig+'+c', s)
        # 7. modifica in mezzo: denominatore
        await set_src(pg, orig)
        await pg.click('#mf'); await pg.keyboard.press('End')
        await pg.keyboard.press('ArrowLeft')          # dentro il denominatore, dopo la a
        await pg.keyboard.press('Backspace'); await pg.keyboard.type('b')
        s = await src(pg)
        check('denominatore modificato in posto', s==orig.replace('{2a}','{2b}'), s)
        # 8. annulla e ripeti dalla formula
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(60)
        check('Ctrl+Z dalla formula ripristina il sorgente', await src(pg)==orig, await src(pg))
        await pg.keyboard.press('Control+y'); await pg.wait_for_timeout(60)
        check('Ctrl+Y ripete', await src(pg)==orig.replace('{2a}','{2b}'), await src(pg))
        # 9. dal codice alla formula
        await set_src(pg, ''); await pg.click('#ed'); await pg.keyboard.type('\\frac{x}{y}', delay=8)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(120)
        check('digitando nel codice la formula si aggiorna', await mfv(pg)=='\\frac{x}{y}', await mfv(pg))
        # 10. menu con il codice attivo: inserimento nel sorgente al cursore
        await pg.click('#ed'); await pg.keyboard.press('Control+End')
        await gallery(pg, 'rad', 'Radice n-esima')
        s = await src(pg); caret = await pg.evaluate('ed.selectionStart')
        check('menu con il codice attivo: inserito nel sorgente', s=='\\frac{x}{y}\\sqrt[]{}', s)
        check('cursore nella prima casella', caret==len('\\frac{x}{y}\\sqrt['), caret)
        # 11. errori senza blocchi
        await set_src(pg, '\\frac{1}{'); await pg.wait_for_timeout(600)
        msg = await pg.inner_text('#st-msg'); msgs = await pg.inner_text('#msgs')
        check('graffa mancante segnalata', 'errore' in msg and 'graffa' in msgs, (msg, msgs))
        await set_src(pg, 'x + \\foo{y}'); await pg.wait_for_timeout(600)
        msgs = await pg.inner_text('#msgs')
        check('comando sconosciuto segnalato', '\\foo' in msgs, msgs)
        await pg.click('#mf'); await pg.keyboard.press('Home'); await pg.keyboard.press('ArrowRight')
        await pg.keyboard.type('^2'); await pg.wait_for_timeout(80)
        check("si modifica anche con un errore nel sorgente", await src(pg)=='x^2 + \\foo{y}', await src(pg))
        # 12. ambiente align* con commenti
        mx = await pg.evaluate("EXAMPLES.find(e=>e[0]==='Equazioni di Maxwell')[1]")
        await set_src(pg, mx); await click_mf_end(pg); await pg.keyboard.type('+0')
        s = await src(pg)
        check('align*: delimitatori e commenti conservati', s.startswith('\\begin{align*}') and '% Gauss' in s and '% Faraday' in s and s.count('\\begin{aligned}')==0, s)
        # 13. matrice personalizzata 2×3
        await set_src(pg, ''); await click_mf_end(pg)
        await pg.click('[data-st="mat"]'); await pg.wait_for_selector('#mx-r')
        await pg.fill('#mx-r', '2'); await pg.fill('#mx-c', '3'); await pg.select_option('#mx-t', 'bmatrix')
        await pg.click('#mx-go'); await pg.wait_for_timeout(80)
        await pg.keyboard.type('a'); await pg.keyboard.press('Tab'); await pg.keyboard.type('b')
        s = await src(pg)
        check('matrice 2×3 personalizzata', s.replace(' ','').startswith('\\begin{bmatrix}a&b') and s.count('&')==4 and s.count('\\\\')==1, s)
        # 14. delimitatori dal menu Ambiente, avanti e indietro
        await set_src(pg, 'E = mc^2'); await pg.select_option('#envsel', 'equation'); await pg.wait_for_timeout(60)
        s1 = await src(pg); await pg.select_option('#envsel', ''); await pg.wait_for_timeout(60); s2 = await src(pg)
        check('ambiente equation aggiunto e tolto', s1=='\\begin{equation}\nE = mc^2\n\\end{equation}' and s2=='E = mc^2', (s1, s2))
        # 15. cancella e ripristina
        await pg.click('#b-clear'); c1 = await src(pg); await pg.click('#b-restore'); c2 = await src(pg)
        check('cancella e ripristina', c1=='' and c2=='E = mc^2', (c1,c2))
        # 16. copia del LaTeX
        await pg.evaluate("()=>{ window.__clip=null; Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{ window.__clip=t; }}}); }")
        await pg.keyboard.press('Control+Shift+C'); await pg.wait_for_timeout(100)
        clip = await pg.evaluate('window.__clip')
        check('Ctrl+Maiusc+C copia il LaTeX', clip=='E = mc^2', clip)
        # 17. scorciatoia Alt+F e tastiera nella galleria
        await set_src(pg, ''); await click_mf_end(pg)
        await pg.keyboard.press('Alt+KeyF'); await pg.wait_for_selector('#pop:not([hidden]) .gi')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(80)
        await pg.keyboard.type('p'); await pg.keyboard.press('Tab'); await pg.keyboard.type('q')
        check('Alt+F apre la galleria, Invio inserisce', await src(pg)=='\\frac{p}{q}', await src(pg))
        # 18. integrale definito: limiti con Tab
        await set_src(pg, ''); await click_mf_end(pg)
        await gallery(pg, 'int', 'Definito con differenziale')
        for t in ['0', 'TAB', '1', 'TAB', 'f(x)', 'TAB', 'x']:
            if t=='TAB': await pg.keyboard.press('Tab')
            else: await pg.keyboard.type(t)
        s = await src(pg)
        same = await pg.evaluate("t=>MF.normalize(St.src)===MF.normalize(t)", '\\int_0^1 f(x)\\,{\\mathrm{d}}x')
        check('integrale: argomento, limiti e differenziale', same, s)
        # 19. limite
        await set_src(pg, ''); await click_mf_end(pg)
        await gallery(pg, 'lim', 'Limite')
        for t in ['x', 'TAB', '\\infty', 'TAB', 'f(x)']:
            if t=='TAB': await pg.keyboard.press('Tab')
            elif t.startswith('\\'): await pg.keyboard.type(t); await pg.keyboard.press('Enter')
            else: await pg.keyboard.type(t)
        s = await src(pg)
        check('limite: variabile, punto e funzione', s.replace(' ','') in ('\\lim_{x\\to\\infty}f(x)',), s)
        # 20. stile di carattere sulla selezione
        await set_src(pg, 'R'); await pg.click('#mf'); await pg.keyboard.press('ControlOrMeta+a')
        await pg.click('[data-pop="fonts"]'); await pg.wait_for_selector('#pop .gi'); await pg.click('#pop .gi[title^="Lavagna"]'); await pg.wait_for_timeout(60)
        check('stile Lavagna sulla selezione', await src(pg)=='\\mathbb{R}', await src(pg))
        # 21. annidamento profondo
        await set_src(pg, ''); await click_mf_end(pg)
        for k in range(3):
            await gallery(pg, 'frac', 'In pila'); await pg.keyboard.type('1+')
        s = await src(pg)
        check('frazioni annidate su tre livelli', s=='\\frac{1+\\frac{1+\\frac{1+}{}}{}}{}', s)
        rep = await pg.evaluate("MF.normalize(feedOf(St.src))===MF.value()")
        check('sorgente e formula coincidono dopo l\'annidamento', rep)
        # 21b. matrici a una colonna e sistemi: le righe vuote restano, anche rileggendo il sorgente
        for label, rows in [('2×1', 2), ('3×1', 3), ('Sistema di 2 equazioni', 2), ('Sistema di 3 equazioni', 3)]:
            await set_src(pg, ''); await click_mf_end(pg)
            await gallery(pg, 'mat', label)
            await pg.keyboard.type('a'); await pg.keyboard.press('Tab'); await pg.keyboard.type('b')
            s = await src(pg)
            boxes = await pg.evaluate("()=>{ MF.fromSource(); return (MF.el.getValue('latex-expanded').match(/placeholder/g)||[]).length; }")
            check(f'{label}: {rows} righe e caselle conservate', s.count('\\\\')==rows-1 and 'a' in s and 'b' in s and boxes==rows-2, (s, boxes))
        # 21c. argomenti vuoti scritti nel codice: la formula mostra le caselle
        await set_src(pg, '\\frac{}{}+x^{}+\\sqrt[]{}')
        boxes = await pg.evaluate("(MF.el.getValue('latex-expanded').match(/placeholder/g)||[]).length")
        check('argomenti vuoti dal codice mostrati come caselle', boxes==5 and await mfv(pg)=='\\frac{}{}+x^{}+\\sqrt[]{}', boxes)
        # 22. esportazione
        out = await pg.evaluate('''async()=>{ setSource('\\\\frac{a}{b} + \\\\cancel{x}'); const tex=texDocument(); const svg=await svgString(); const png=await pngBlob(); return [tex, svg.slice(0,60), svg.length, png.size, png.type, wrapAs('$'), wrapAs('\\\\['), wrapAs('equation')]; }''')
        check('documento .tex con i pacchetti necessari', '\\usepackage{amsmath,amssymb,cancel}' in out[0] and '\\[' in out[0] and '\\frac{a}{b}' in out[0], out[0])
        check('SVG e PNG generati', out[1].startswith('<?xml') and out[2]>1000 and out[3]>1000 and out[4]=='image/png', out[1:5])
        check('copia con delimitatori', out[5]=='$\\frac{a}{b} + \\cancel{x}$' and out[6].startswith('\\[\n') and out[7].startswith('\\begin{equation}'), out[5:])
        await pg.click('#b-export'); await pg.wait_for_selector('#ex-code'); await pg.wait_for_timeout(300)
        check('finestra Esporta', 'cancel' in await pg.inner_text('#m-b'))
        await pg.click('#m-x')
        # 23. apertura di un documento: lista delle formule, macro del preambolo, modifiche riscritte nel file
        doc = "\\documentclass{article}\n\\usepackage{amssymb}\n\\newcommand{\\R}{\\mathbb{R}}\n\\DeclareMathOperator{\\sen}{sen}\n\\begin{document}\nTesto $a$ e una riga\\\\[2pt] spaziata.\n\\[ x^2 \\]\n% \\[ commentata \\]\n\\begin{equation}\n  E=mc^2 \\label{eq:e}\n\\end{equation}\n\\begin{align*} f\\colon \\R\\to\\R, \\quad f(x) &= \\sen x \\end{align*}\n\\end{document}"
        await pg.evaluate("t=>loadText(t,'prova.tex')", doc); await pg.wait_for_timeout(400)
        n = await pg.evaluate("document.querySelectorAll('#fl-items .fi').length")
        check('file .tex: lista delle formule (commenti e \\\\[2pt] esclusi)', n==3, n)
        check('la prima formula è nell\'editor', await src(pg)=='\\[ x^2 \\]', await src(pg))
        check('macro lette dal preambolo', await pg.evaluate('Macros.count()')==2, await pg.evaluate('Macros.text()'))
        await click_mf_end(pg); await pg.keyboard.type('+1'); await pg.wait_for_timeout(500)
        t = await pg.evaluate('Formulas.text()')
        check('modifica riscritta nel documento, il resto è identico', t==doc.replace('x^2 ','x^2+1 '), t)
        check('formula modificata segnata nella lista', await pg.evaluate("document.querySelectorAll('#fl-items .fi.mod').length")==1)
        await pg.click('#fl-items .fi[data-k="1"]'); await pg.wait_for_timeout(200)
        s = await src(pg)
        check('formula scelta caricata con il suo ambiente', s.startswith('\\begin{equation}') and '\\label{eq:e}' in s, s)
        await pg.click('#mf'); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)
        check('cronologia separata: Ctrl+Z su un\'altra formula non tocca la modifica', await pg.evaluate('Formulas.text()')==t, await pg.evaluate('Formulas.text()'))
        await pg.click('#fl-items .fi[data-k="0"]'); await pg.click('#mf'); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)
        check('Ctrl+Z annulla la modifica della sua formula', await pg.evaluate('Formulas.text()')==doc, await src(pg))
        await pg.click('#fl-items .fi[data-k="1"]')
        await pg.keyboard.press('Alt+PageDown'); await pg.wait_for_timeout(500)
        s = await src(pg); iss = await pg.evaluate('St.issues.map(x=>x.msg)')
        check('Alt+PagGiù: formula successiva; macro senza avvisi', s.startswith('\\begin{align*}') and not iss, iss)
        await click_mf_end(pg); await pg.keyboard.type('+1'); await pg.wait_for_timeout(300)
        s = await src(pg)
        check('formula con macro modificata: \\R e \\sen restano', '\\R\\to\\R' in s and '\\sen x+1' in s, s)
        await pg.evaluate('Formulas.close(false)'); await pg.wait_for_timeout(100)
        check('documento chiuso: lista nascosta', await pg.evaluate("document.getElementById('flist').hidden"))
        # 23e. più formule incollate nel codice: diventano l'elenco, il testo resta identico
        paste = "\\[\n  e^{i\\pi} + 1 = 0\n\\]\n\n\\[\n  \\int_{-\\infty}^{+\\infty} e^{-x^2}\\,dx % risultato notevole\n  = \\sqrt{\\pi}\n\\]\n\n\\begin{equation}\n  \n  x_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n\\end{equation}\n\n\\begin{equation}\n  \\norma{\\mathbf{v}} = \\sqrt{\\sum_{k=1}^{n} v_k^2}\n\\end{equation}\n\n\n\n\\begin{align*}\n  (a+b)^2 &= a^2 + 2ab + b^2 \\\\\n  (a-b)^2 &= a^2 - 2ab + b^2 \\\\\n  a^2 - b^2 &= (a+b)(a-b)\n\\end{align*}\n\n\\begin{gather*}\n  \\lim_{x \\to 0} \\frac{\\sin x}{x} = 1 \\\\\n  \\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}\n\\end{gather*}\n\n\n\\[\n  |x| =\n  \\begin{cases}\n    x  & \\text{se } x \\geq 0 \\\\\n    -x & \\text{se } x < 0\n  \\end{cases}\n\\]\n\n\\[\n  \\begin{pmatrix}\n    2 & -1 & 0 \\\\\n    -1 & 2 & -1 \\\\\n    0 & -1 & 2\n  \\end{pmatrix}\n  \\begin{pmatrix} x \\\\ y \\\\ z \\end{pmatrix}\n  =\n  \\begin{pmatrix} 1 \\\\ 0 \\\\ 1 \\end{pmatrix}\n\\]\n\n\n\\[ \\det A = \\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc,\n  \\qquad\n  e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}\n\\]\n"
        # incolla com'è nel browser: evento paste, poi il testo inserito nell'area del codice (gli appunti del browser di prova non sono affidabili)
        await set_src(pg, ''); await pg.click('#ed')
        await pg.evaluate("t=>{ ed.dispatchEvent(new ClipboardEvent('paste', {bubbles:true})); document.execCommand('insertText', false, t); }", paste); await pg.wait_for_timeout(800)
        n = await pg.evaluate("document.querySelectorAll('#fl-items .fi').length")
        check('formule incollate: 9 voci nell\'elenco', n==9, n)
        check('testo incollato conservato identico', await pg.evaluate('Formulas.text()')==paste)
        iss = await pg.evaluate('St.issues.map(x=>x.msg)')
        check('prima formula senza errori di annidamento', await src(pg)=='\\[\n  e^{i\\pi} + 1 = 0\n\\]' and not iss, (await src(pg), iss))
        bad = await pg.evaluate("async()=>{ const bad=[]; for (let k=0;k<9;k++){ Formulas.select(k); await Preview.check(); const e=St.issues.filter(x=>x.kind==='e'); if (e.length) bad.push([k, e.map(x=>x.msg)]); } return bad; }")
        check('ogni formula incollata compila (\\norma solo avviso)', not bad, bad)
        # 23f. due formule scritte nel codice di una voce: messaggio cliccabile che le divide
        await pg.evaluate("Formulas.select(0)"); await set_src(pg, '\\[ a \\]\n\\[ b \\]'); await pg.wait_for_timeout(700)
        await pg.click('#msgs [data-split]'); await pg.wait_for_timeout(300)
        n = await pg.evaluate("document.querySelectorAll('#fl-items .fi').length")
        t = await pg.evaluate('Formulas.text()')
        check('due formule in una voce: divise in due voci', n==10 and await src(pg)=='\\[ a \\]' and t.startswith('\\[ a \\]\n\\[ b \\]\n\n\\[\n  \\int'), (n, t[:60]))
        await pg.evaluate('Formulas.close(false)')
        # 23g. un align* dentro il corpo non blocca la formula nell'ambiente per i valori successivi
        await set_src(pg, '\\[ a \\] \\begin{align*} c \\end{align*}'); await set_src(pg, 'x^2')
        check('dopo un align* annidato la formula torna normale', await mfv(pg)=='x^2', await mfv(pg))
        # 23c. tasti premuti subito dopo il clic sulla formula, venendo dal codice: vanno alla formula, non al codice
        await set_src(pg, 'x^2'); await pg.click('#ed'); await pg.wait_for_timeout(100)
        await pg.click('#mf'); await pg.keyboard.press('End'); await pg.keyboard.type('+1'); await pg.wait_for_timeout(200)
        check('digitazione immediata dopo il clic: arriva alla formula', await src(pg)=='x^2+1' and await mfv(pg)=='x^2+1', (await src(pg), await mfv(pg)))
        # 23d. scrittura all'inizio di una formula con \label: a capo e rientro restano prima
        await set_src(pg, '\\begin{equation}\n  E=mc^2 \\label{eq:e}\n\\end{equation}'); await pg.click('#ed'); await pg.wait_for_timeout(100)
        await pg.click('#mf'); await pg.keyboard.press('Home'); await pg.keyboard.type('k'); await pg.wait_for_timeout(200)
        check('inizio di una formula con \\label', await src(pg)=='\\begin{equation}\n  kE=mc^2 \\label{eq:e}\n\\end{equation}', await src(pg))
        # 23b. finestra delle macro
        await pg.click('#b-mac'); await pg.fill('#mac-t', '\\newcommand{\\norm}[1]{\\left\\lVert #1\\right\\rVert}'); await pg.click('#mac-ok')
        await set_src(pg, '\\norm{v} \\geq 0'); await pg.wait_for_timeout(700)
        iss = await pg.evaluate('St.issues.map(x=>x.msg)'); pv = await pg.evaluate("document.getElementById('pvst').textContent")
        check('macro scritta a mano: nessun avviso e MathJax compila', not iss and pv=='compila', (iss, pv))
        tex = await pg.evaluate('texDocument()')
        check('documento .tex esportato con le macro nel preambolo', '\\newcommand{\\norm}' in tex.split('\\begin{document}')[0], tex)
        await pg.evaluate("Macros.set('')")
        # 24. esempi: tutti compilano
        bad = await pg.evaluate('''async()=>{ const bad=[]; for (const [t,s] of EXAMPLES){ setSource(s); await Preview.check(); if (St.issues.some(x=>x.kind==='e')) bad.push(t); } return bad; }''')
        check('tutti gli esempi sono LaTeX valido', not bad, bad)
        # 25. tema scuro e screenshot
        await set_src(pg, mx)
        await pg.screenshot(path=sys.argv[1] if len(sys.argv)>1 else 'ui.png')
        check('nessun errore JavaScript', not errors, errors)
        await b.close()
        bad = [n for n,o in results if not o]
        print(f"\n{len(results)-len(bad)}/{len(results)} superati")
        sys.exit(1 if bad else 0)
asyncio.run(main())
