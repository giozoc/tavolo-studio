"""Scenari d'uso reali, con mouse e tastiera, sull'interfaccia completa."""
import asyncio, sys, json, os
from playwright.async_api import async_playwright
from harness import open_app

results = []
def check(name, ok, detail=''):
    results.append((name, ok)); print(('OK   ' if ok else 'FAIL ')+name+('' if ok else '  → '+str(detail)[:600]))

async def src(pg):
    await pg.wait_for_timeout(60)
    return await pg.evaluate('St.src')
async def set_src(pg, t):
    await pg.evaluate('t=>{ Docs.close(false); St.ti=0; St.sel={r:0,c:0,r2:0,c2:0}; setSource(t); }', t); await pg.wait_for_timeout(60)
async def cell(pg, r, c):
    return await pg.evaluate('([r,c])=>{ const x=View.srcCell(r,c); return x&&x.cell ? x.cell.t : null; }', [r, c])
async def click(pg, r, c, shift=False):
    sel = f'#grid td[data-r="{r}"][data-c="{c}"]'
    if shift: await pg.click(sel, modifiers=['Shift'])
    else: await pg.click(sel)
    await pg.wait_for_timeout(40)
async def act(pg, name):
    await pg.click(f'#ribbon [data-act="{name}"]'); await pg.wait_for_timeout(80)
def changed_only(a, b):
    """tratto cambiato tra due testi: (prefisso comune, parte tolta, parte messa)"""
    p=0
    while p<len(a) and p<len(b) and a[p]==b[p]: p+=1
    q=0
    while q<len(a)-p and q<len(b)-p and a[-1-q]==b[-1-q]: q+=1
    return a[p:len(a)-q], b[p:len(b)-q]

SIMPLE = r"""\begin{tabular}{@{}lcr@{}}
  \toprule
  Nome & Valore & Note \\ % intestazione
  \midrule
  a & 1 & x \\
  b & 2 & y \\ % seconda riga
  \bottomrule
\end{tabular}"""
GRID = r"""\begin{tabular}{|l|c|c|}
\hline
A & B & C \\
\hline
1 & 2 & 3 \\
\hline
\end{tabular}"""

async def main():
    async with async_playwright() as p:
        b, pg, errors = await open_app(p)
        # 1. avvio con l'esempio
        n = await pg.evaluate('[curT().rows.length, curT().ncols, document.querySelectorAll("#grid td[data-r]").length]')
        check('avvio: esempio con 6 righe e 4 colonne nella griglia', n[0]==6 and n[1]==4 and n[2]>=20, n)
        # 2. modifica di una cella: cambia solo il numero, il commento resta
        before = await src(pg)
        await click(pg, 2, 1); await pg.keyboard.type('13.5'); await pg.keyboard.press('Enter')
        after = await src(pg)
        check('cella modificata scrivendo: cambia solo «12.4»', changed_only(before, after)==('12.4','13.5') or changed_only(before,after)==('2.4','3.5'), changed_only(before, after))
        check('commento della riga conservato', '% pivot casuale' in after)
        check('Invio scende alla cella sotto', await pg.evaluate('[St.sel.r, St.sel.c]')==[3,1])
        # 3. il codice aggiorna la griglia
        await set_src(pg, SIMPLE)
        await pg.click('#ed'); await pg.evaluate("()=>{ const i=St.src.indexOf('a & 1'); ed.setSelectionRange(i+1,i+1); }")
        await pg.keyboard.type('bc'); await pg.wait_for_timeout(120)
        check('scrivere nel codice aggiorna la griglia', await cell(pg, 1, 0)=='abc', await cell(pg,1,0))
        check('il cursore nel codice seleziona la cella', await pg.evaluate('[St.sel.r, St.sel.c]')==[1,0])
        # 4. riga sotto con Ctrl+Invio
        await set_src(pg, SIMPLE); await click(pg, 1, 1)
        before = await src(pg)
        await pg.keyboard.press('Control+Enter'); await pg.wait_for_timeout(80)
        after = await src(pg)
        rem, add = changed_only(before, after)
        check('riga inserita sotto: si aggiunge solo una riga di «&»', rem=='' and add.strip() in ('& & \\\\','& & \\\\\n') and after.count('\n')==before.count('\n')+1, (rem, add))
        check('riga nuova selezionata', await pg.evaluate('St.sel.r')==2)
        # 5. eliminazione della riga
        await pg.click('#ribbon [data-act="rowdel"]'); await pg.wait_for_timeout(80)
        check('riga eliminata: il sorgente torna com\'era', await src(pg)==before, await src(pg))
        # 6. colonna a destra: specifica e righe
        await set_src(pg, SIMPLE); await click(pg, 0, 1); await act(pg, 'colins-right')
        s = await src(pg)
        check('colonna inserita: specifica lccr', '{@{}lccr@{}}' in s, s)
        check('colonna inserita: ogni riga ha una cella in più', 'Nome & Valore & & Note' in s and 'a & 1 & & x' in s, s)
        check('commenti intatti dopo l\'inserimento di colonna', '% intestazione' in s and '% seconda riga' in s)
        await act(pg, 'coldel')
        check('colonna eliminata: sorgente come prima', await src(pg)==SIMPLE, await src(pg))
        # 7. unione orizzontale con Ctrl+M e divisione
        await set_src(pg, SIMPLE); await click(pg, 0, 1); await click(pg, 0, 2, shift=True)
        await pg.keyboard.press('Control+m'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('Ctrl+M: \\multicolumn{2}{c}{Valore Note}', 'Nome & \\multicolumn{2}{c}{Valore Note} \\\\ % intestazione' in s, s)
        check('la griglia mostra la cella unita', await pg.evaluate('document.querySelector(\'#grid td[data-r="0"][data-c="1"]\').colSpan')==2)
        await act(pg, 'split')
        s = await src(pg)
        check('divisione: la cella torna in due', 'Nome & Valore Note & \\\\' in s, s)
        # 8. unione verticale
        await set_src(pg, SIMPLE); await click(pg, 1, 0); await click(pg, 2, 0, shift=True); await act(pg, 'mergev')
        s = await src(pg)
        check('unione verticale: \\multirow{2}{*}{a b}', '\\multirow{2}{*}{a b} & 1 & x' in s and '\n  & 2 & y' in s, s)
        check('la griglia mostra la cella alta due righe', await pg.evaluate('document.querySelector(\'#grid td[data-r="1"][data-c="0"]\').rowSpan')==2)
        # 9. colonna S: table-format e intestazione tra graffe
        await set_src(pg, SIMPLE.replace('1 & x','12.5 & x').replace('2 & y','3.25 & y')); await click(pg, 1, 1)
        await pg.click('#ribbon [data-al="S"]'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('allineamento S con table-format calcolato', 'S[table-format=2.2]' in s, s)
        check('intestazione della colonna S tra graffe', '{Valore}' in s, s)
        await pg.click('#ribbon [data-al="c"]'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('tornando a c le graffe se ne vanno', '{@{}lcr@{}}' in s and '& Valore &' in s, s)
        # 10. regola sopra la selezione dal menu
        await set_src(pg, SIMPLE); await click(pg, 2, 0)
        await pg.click('[data-pop="ruleabove"]'); await pg.click('#pop [data-rule="midrule"]'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('\\midrule aggiunta sopra la riga, su una riga sua', '1 & x \\\\\n  \\midrule\n  b & 2' in s, s)
        await pg.click('[data-pop="ruleabove"]'); await pg.click('#pop [data-rule="none"]'); await pg.wait_for_timeout(80)
        check('regola tolta: sorgente come prima', await src(pg)==SIMPLE, await src(pg))
        # 11. regola parziale
        await click(pg, 0, 1); await click(pg, 0, 2, shift=True); await act(pg, 'cmid')
        s = await src(pg)
        check('\\cmidrule(lr){2-3} sotto la selezione', '\\midrule\n  \\cmidrule(lr){2-3}' in s or '\\cmidrule(lr){2-3}' in s, s)
        # 12. da griglia a booktabs
        await set_src(pg, GRID); await pg.click('[data-pop="style"]'); await pg.click('#pop [data-style="booktabs"]'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('stile booktabs: | tolti e regole convertite', s=="\\begin{tabular}{lcc}\n\\toprule\nA & B & C \\\\\n\\midrule\n1 & 2 & 3 \\\\\n\\bottomrule\n\\end{tabular}", s)
        await pg.click('[data-pop="style"]'); await pg.click('#pop [data-style="grid"]'); await pg.wait_for_timeout(80)
        check('e di nuovo griglia', await src(pg)==GRID, await src(pg))
        # 13. ambiente tabularx: una colonna diventa X
        await set_src(pg, SIMPLE); await pg.select_option('#envsel', 'tabularx'); await pg.wait_for_timeout(100)
        s = await src(pg)
        check('tabularx con larghezza e colonna X', s.startswith('\\begin{tabularx}{\\textwidth}{@{}Xcr@{}}') and s.rstrip().endswith('\\end{tabularx}'), s[:80])
        await pg.select_option('#envsel', 'tabular'); await pg.wait_for_timeout(100)
        check('e di nuovo tabular', await src(pg)==SIMPLE, await src(pg))
        # 14. & e % scritti in una cella vengono protetti
        await set_src(pg, SIMPLE); await click(pg, 1, 2); await pg.keyboard.press('Enter')
        await pg.keyboard.press('ControlOrMeta+a'); await pg.keyboard.type('A & B 50% x_1'); await pg.keyboard.press('Enter')
        s = await src(pg)
        check('& % _ protetti nella cella', 'a & 1 & A \\& B 50\\% x\\_1 \\\\' in s, s)
        check('la tabella resta di 3 colonne', await pg.evaluate('curT().rows.every(r=>r.cells.length===3)'))
        # 15. annulla e ripeti
        await pg.keyboard.press('ControlOrMeta+z'); await pg.wait_for_timeout(80)
        check('annulla', await src(pg)==SIMPLE)
        await pg.keyboard.press('ControlOrMeta+y'); await pg.wait_for_timeout(80)
        check('ripeti', 'A \\& B' in await src(pg))
        # 16. incolla da Excel: HTML con una cella unita
        await set_src(pg, SIMPLE); await click(pg, 1, 0)
        await pg.evaluate("""()=>{ const dt=new DataTransfer(); dt.setData('text/plain','p\\tq\\nr\\ts\\n'); dt.setData('text/html','<table><tr><td>p</td><td>q</td></tr><tr><td colspan="2">r &amp; s</td></tr></table>');
          document.getElementById('gridbox').focus(); document.dispatchEvent(new ClipboardEvent('paste', {clipboardData:dt, bubbles:true})); }""")
        await pg.wait_for_timeout(120)
        s = await src(pg)
        check('incolla da Excel: valori e cella unita con & protetta', 'p & q & x' in s and '\\multicolumn{2}{c}{r \\& s} & y' in s, s)
        # 17. incolla testo con più righe di quelle esistenti: la tabella cresce
        await set_src(pg, SIMPLE); await click(pg, 2, 2)
        await pg.evaluate("""()=>{ const dt=new DataTransfer(); dt.setData('text/plain','1\\t2\\n3\\t4\\n5\\t6'); document.getElementById('gridbox').focus(); document.dispatchEvent(new ClipboardEvent('paste', {clipboardData:dt, bubbles:true})); }""")
        await pg.wait_for_timeout(120)
        d = await pg.evaluate('[curT().rows.length, curT().ncols]')
        check('incolla oltre i bordi: righe e colonne aggiunte', d==[5,4], d)
        check('commenti intatti dopo l\'incolla', '% intestazione' in await src(pg))
        # 18. Tab nell'ultima cella aggiunge una riga
        await set_src(pg, SIMPLE); await click(pg, 2, 2); await pg.keyboard.press('Tab'); await pg.wait_for_timeout(80)
        check('Tab nell\'ultima cella: nuova riga', await pg.evaluate('curT().rows.length')==4 and await pg.evaluate('[St.sel.r,St.sel.c]')==[3,0])
        # 19. copia: testo separato da tabulazioni
        await set_src(pg, SIMPLE); await click(pg, 1, 0); await click(pg, 2, 1, shift=True)
        check('copia delle celle selezionate come TSV', await pg.evaluate('View.selText()')=='a\t1\nb\t2')
        # 20. Canc svuota la selezione
        await pg.keyboard.press('Delete'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('Canc svuota le celle', '\n  & & x \\\\' in s and '\n  & & y \\\\ % seconda riga' in s, s)
        # 21. formula nella cella con Ctrl+E
        await set_src(pg, r"""\begin{tabular}{ll}
  $x^n$ & $n x^{n-1}$ \\
\end{tabular}""")
        await click(pg, 0, 1); await pg.keyboard.press('Control+e'); await pg.wait_for_timeout(300)
        check('Ctrl+E apre la finestra della formula', await pg.evaluate('!$("fpop").hidden && $("fp-src").value')=='n x^{n-1}')
        await pg.fill('#fp-src', 'n\\,x^{n-1}'); await pg.click('#fp-ok'); await pg.wait_for_timeout(120)
        s = await src(pg)
        check('formula applicata nella cella', '$x^n$ & $n\\,x^{n-1}$ \\\\' in s, s)
        has_mf = await pg.evaluate('!!document.querySelector("#fp-mfbox math-field")')
        check('la finestra usa MathLive', has_mf)
        # 22. formula nuova in una cella di testo
        await click(pg, 0, 0); await pg.keyboard.press('Control+e'); await pg.wait_for_timeout(200)
        await pg.fill('#fp-src', '\\alpha'); await pg.click('#fp-ok'); await pg.wait_for_timeout(120)
        check('seconda formula: si modifica la prima della cella', '$\\alpha$ & $n' in await src(pg), await src(pg))
        # 23. longtable: la didascalia resta una riga a sé
        await pg.evaluate('setSource(EXAMPLES[4][1])'); await pg.wait_for_timeout(80)
        special = await pg.evaluate('curT().rows[0].special')
        check('longtable: riga della didascalia riconosciuta', special=='caption')
        await click(pg, 1, 1); await act(pg, 'colins-right')
        s = await src(pg)
        check('longtable: colonna aggiunta senza toccare la didascalia', '\\caption{Elementi della tavola periodica}\\label{tab:elementi} \\\\' in s and '1 & Idrogeno & & 1.008' in s and '{@{}rllr@{}}' in s, s[:300])
        # 24. documento intero: lista delle tabelle, modifica, file aggiornato
        doc = "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\nTesto.\n" + SIMPLE + "\n\nAltro testo % commento\n\\begin{table}\n  \\centering\n  \\caption{Seconda}\n" + GRID + "\n\\end{table}\n\\end{document}\n"
        await pg.set_input_files('#file', files=[{'name':'tesi.tex','mimeType':'text/x-tex','buffer':doc.encode()}]); await pg.wait_for_timeout(200)
        check('documento: due tabelle nella lista', await pg.evaluate('document.querySelectorAll("#tl-items .ti").length')==2)
        await pg.click('#tl-items .ti[data-k="1"]'); await pg.wait_for_timeout(100)
        check('la seconda voce è l\'ambiente table con la didascalia', (await src(pg)).startswith('\\begin{table}') and await pg.evaluate('curT().env')=='tabular')
        await click(pg, 1, 2); await pg.keyboard.type('9'); await pg.keyboard.press('Enter')
        await pg.wait_for_timeout(400)
        full = await pg.evaluate('Docs.text()')
        check('documento: cambia solo la cella toccata', changed_only(doc, full)==('3','9'), changed_only(doc, full))
        check('voce segnata come modificata', await pg.evaluate('document.querySelector("#tl-items .ti[data-k=\\"1\\"]").classList.contains("mod")'))
        await pg.keyboard.press('Alt+PageUp'); await pg.wait_for_timeout(100)
        check('Alt+PagSu: tabella precedente', await pg.evaluate('St.src')==SIMPLE)
        async with pg.expect_download() as dl:
            await pg.keyboard.press('ControlOrMeta+s')
        d = await dl.value; path = await d.path()
        check('Ctrl+S scarica il file intero aggiornato', open(path).read()==full and d.suggested_filename=='tesi.tex')
        await pg.evaluate('Docs.close(false)')
        # 25. importazione CSV con virgola decimale
        await set_src(pg, '')
        await pg.click('#b-import'); await pg.fill('#im-t', 'Nome;Altezza;Peso\nAnna;1,68;57\nLuca;1,82;79'); await pg.wait_for_timeout(80)
        pv = await pg.evaluate('$("im-pv").textContent')
        check('CSV: separatore riconosciuto e colonne S', 'S[table-format=1.2]' in pv and 'Anna & 1,68 & 57' in pv and '{Altezza}' in pv, pv)
        await pg.click('#im-ok'); await pg.wait_for_timeout(120)
        check('CSV: tabella creata', await pg.evaluate('curT() && curT().rows.length')==3)
        # 26. nuova tabella dal selettore
        await set_src(pg, '')
        await pg.click('#b-new'); await pg.hover('#pk i[data-r="3"][data-c="4"]'); await pg.click('#pk i[data-r="3"][data-c="4"]'); await pg.wait_for_timeout(120)
        check('nuova tabella 3×4', await pg.evaluate('[curT().rows.length, curT().ncols]')==[3,4])
        check('nuova tabella dentro table, con booktabs', (await src(pg)).startswith('\\begin{table}') and '\\toprule' in await src(pg))
        # 27. errori del sorgente segnalati, griglia che resta usabile
        await set_src(pg, SIMPLE.replace('a & 1 & x', 'a & 1 & x & z'))
        msgs = await pg.evaluate('$("msgs").textContent')
        check('troppe celle segnalate', 'troppe' in msgs, msgs)
        # 28. sposta riga
        await set_src(pg, SIMPLE); await click(pg, 2, 0); await pg.keyboard.press('Alt+ArrowUp'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('Alt+Su: righe scambiate, commento al suo posto', 'b & 2 & y \\\\\n  a & 1 & x \\\\ % seconda riga' in s, s)
        # 29. grassetto
        await set_src(pg, SIMPLE); await click(pg, 0, 0); await click(pg, 0, 2, shift=True); await pg.keyboard.press('Control+b'); await pg.wait_for_timeout(80)
        check('Ctrl+B sull\'intestazione', '\\textbf{Nome} & \\textbf{Valore} & \\textbf{Note} \\\\ % intestazione' in await src(pg), await src(pg))
        await pg.keyboard.press('Control+b'); await pg.wait_for_timeout(80)
        check('Ctrl+B di nuovo lo toglie', await src(pg)==SIMPLE)
        # 30. sposta colonna con Alt+Destra: specifica e celle, commenti fermi
        await set_src(pg, SIMPLE); await click(pg, 1, 0); await pg.keyboard.press('Alt+ArrowRight'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('Alt+Destra: colonna spostata (specifica clr)', '{@{}clr@{}}' in s and 'Valore & Nome & Note \\\\ % intestazione' in s and '1 & a & x \\\\' in s, s)
        check('la selezione segue la colonna', await pg.evaluate('St.sel.c')==1)
        await act(pg, 'colmove-left')
        check('e di nuovo a sinistra: sorgente come prima', await src(pg)==SIMPLE, await src(pg))
        # 31. ordina dal menu: il commento a fine riga segue la sua riga
        await pg.evaluate('setSource(EXAMPLES[0][1])'); await click(pg, 3, 1)
        await pg.click('[data-pop="sort"]'); await pg.click('#pop [data-sort="asc"]'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('ordina per numero: Timsort (9.6) in cima, intestazione ferma', s.index('Timsort') < s.index('Quicksort') < s.index('Mergesort') < s.index('Heapsort') and s.index('Algoritmo') < s.index('Timsort'), s)
        check('il commento segue la sua riga', 'Timsort    & 9.6   & 15.2  & 0.63 \\\\ % implementazione di Python' in s and 'Quicksort  & 12.4  & 98.7  & 0.13 \\\\ % pivot casuale' in s, s)
        await click(pg, 3, 0); await pg.click('[data-pop="sort"]'); await pg.click('#pop [data-sort="desc"]'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('ordina per testo, decrescente', s.index('Timsort') < s.index('Quicksort') < s.index('Mergesort') < s.index('Heapsort'), s)
        await pg.evaluate('setSource(EXAMPLES[2][1])'); await click(pg, 3, 1)
        await pg.click('[data-pop="sort"]'); await pg.click('#pop [data-sort="asc"]'); await pg.wait_for_timeout(80)
        check('righe legate da \\multirow: ordinamento rifiutato', await src(pg)==await pg.evaluate('EXAMPLES[2][1]') and 'multirow' in await pg.evaluate('$("toast").textContent'))
        # 32. trasponi
        await pg.evaluate('setSource(EXAMPLES[1][1])'); await act(pg, 'transpose')
        s = await src(pg)
        check('trasponi la griglia: 3 righe × 4 colonne, | e \\hline restano', s.startswith('\\begin{tabular}{|l|r|r|r|}') and 'Prodotto & Quaderno & Penna & Zaino \\\\' in s and s.count('\\hline')==4 and await pg.evaluate('[curT().rows.length, curT().ncols]')==[3,4], s)
        await act(pg, 'transpose')
        s = await src(pg)
        check('due volte: stesse celle di prima', await pg.evaluate('JSON.stringify(Grid.of(curT(),St.src).rows.map(r=>r.cells.map(c=>c.t)))')==await pg.evaluate('(()=>{ const t=parseAll(EXAMPLES[1][1])[0]; return JSON.stringify(Grid.of(t,EXAMPLES[1][1]).rows.map(r=>r.cells.map(c=>c.t))); })()'), s)
        # 33. allineamento di una cella sola, e ritorno
        await set_src(pg, SIMPLE); await click(pg, 0, 2); await pg.click('#ribbon [data-cal="c"]'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('cella centrata: \\multicolumn{1}{c}{Note}', 'Nome & Valore & \\multicolumn{1}{c}{Note} \\\\ % intestazione' in s, s)
        await pg.click('#ribbon [data-cal="r"]'); await pg.wait_for_timeout(80)
        check('di nuovo come la colonna: il \\multicolumn se ne va', await src(pg)==SIMPLE, await src(pg))
        # 34. colori dal menu
        await set_src(pg, SIMPLE); await click(pg, 1, 1)
        await pg.click('[data-pop="color"]'); await pg.click('#pop .swb[data-tg="cell"][data-color="red!15"]'); await pg.wait_for_timeout(80)
        check('\\cellcolor nella cella', 'a & \\cellcolor{red!15} 1 & x' in await src(pg), await src(pg))
        check('la griglia colora la cella', await pg.evaluate('getComputedStyle(document.querySelector(\'#grid td[data-r="1"][data-c="1"]\')).backgroundColor')!='rgba(0, 0, 0, 0)')
        await pg.click('[data-pop="color"]'); await pg.click('#pop .swb[data-tg="cell"][data-color=""]'); await pg.wait_for_timeout(80)
        check('colore tolto: sorgente come prima', await src(pg)==SIMPLE, await src(pg))
        await click(pg, 1, 0); await click(pg, 2, 0, shift=True)
        await pg.click('[data-pop="color"]'); await pg.click('#pop .swb[data-tg="row"][data-color="gray!10"]'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('\\rowcolor su due righe, su una riga sua', '\\midrule\n  \\rowcolor{gray!10}\n  a & 1' in s and '\\rowcolor{gray!10}\n  b & 2' in s, s)
        await pg.click('[data-pop="color"]'); await pg.click('#pop .swb[data-tg="alt"][data-color="gray!10"]'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('righe alterne: \\rowcolors prima della tabella', s.startswith('\\rowcolors{2}{gray!10}{}\n\\begin{tabular}'), s[:60])
        check('il documento dichiara xcolor con table', '\\usepackage[table]{xcolor}' in await pg.evaluate('texDocument()'))
        # 35. decimali e massimo
        await pg.evaluate('setSource(EXAMPLES[0][1])'); await click(pg, 3, 1)
        await pg.click('[data-pop="round"]'); await pg.click('#pop [data-dec="2"]'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('due decimali: valori riscritti e table-format aggiornato', 'S[table-format=2.2] S[table-format=3.1]' in s and 'Quicksort  & 12.40  & 98.7' in s and 'Timsort    & 9.60   & 15.2' in s, s)
        await click(pg, 3, 2); await pg.click('[data-pop="round"]'); await pg.check('#pop input[value="si"]'); await pg.click('#pop [data-dec="0"]'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('arrotondamento di siunitx: opzioni nella colonna, valori intatti', 'S[table-format=2.0, round-mode=places, round-precision=0]' in s and '98.7' in s, s)
        await click(pg, 3, 3); await act(pg, 'max')
        check('massimo in grassetto (tra graffe nella colonna S)', '{\\textbf{0.94}}' in await src(pg), await src(pg))
        await act(pg, 'max')
        check('di nuovo: niente da cambiare', 'già in grassetto' in await pg.evaluate('$("toast").textContent'))
        # 36. cerca e sostituisci con Ctrl+H
        await pg.evaluate('setSource(EXAMPLES[0][1])'); await click(pg, 2, 0)
        await pg.keyboard.press('Control+h'); await pg.keyboard.type('sort'); await pg.wait_for_timeout(80)
        check('Ctrl+H: celle trovate segnate', await pg.evaluate('document.querySelectorAll("#grid td.found").length')==4 and await pg.evaluate('$("fd-n").textContent')=='4 celle')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(60)
        check('Invio va alla prima cella trovata', await pg.evaluate('[St.sel.r, St.sel.c]')==[3,0])
        await pg.fill('#fd-r', 'sort & co'); await pg.click('#fd-all'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('sostituisci tutto: & protetta, commenti intatti', 'Quicksort \\& co  & 12.4' in s and s.count('sort \\& co')==4 and '% pivot casuale' in s and await pg.evaluate('curT().rows.every(r=>r.cells.reduce((a,c)=>a+(c.mc?c.mc.n:1),0)===4)'), s)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(60)
        check('Esc chiude la ricerca e toglie i segni', await pg.evaluate('$("pop").hidden && !document.querySelector("#grid td.found")'))
        # 37. longtable: intestazione ripetuta
        await set_src(pg, "\\begin{longtable}{lr}\n  \\toprule\n  Voce & N \\\\\n  \\midrule\n  a & 1 \\\\\n  b & 2 \\\\\n  \\bottomrule\n\\end{longtable}")
        await click(pg, 0, 0); await act(pg, 'endhead')
        check('\\endhead dopo l\'intestazione e la sua regola', '\\midrule\n  \\endhead\n  a & 1' in await src(pg), await src(pg))
        # 38. unione e divisione conservano i commenti dentro le celle
        await set_src(pg, "\\begin{tabular}{lll}\n  a % prima\n  & b & c \\\\\n\\end{tabular}"); await click(pg, 0, 0); await click(pg, 0, 1, shift=True)
        await pg.keyboard.press('Control+m'); await pg.wait_for_timeout(80)
        s = await src(pg)
        check('unione: il commento tra le celle resta', '% prima' in s and '\\multicolumn{2}{c}{a b % prima' in s, s)
        await act(pg, 'split')
        check('divisione: il commento resta', '% prima' in await src(pg) and await pg.evaluate('curT().rows[0].cells.length')==3, await src(pg))
        # 39. tabularray e nicematrix
        await set_src(pg, "\\begin{tblr}{colspec={Q[l] X[2,c] r}, row{1}={font=\\bfseries}}\n  \\toprule\n  A & B & C \\\\\n  \\midrule\n  \\SetCell[c=2]{c} unite & & 3 \\\\\n  \\bottomrule\n\\end{tblr}")
        check('tblr con colspec={…}: tre colonne Q, X, r', await pg.evaluate('[curT().env, curT().ncols, curT().cols.map(colAlign).join("")]')==['tblr', 3, 'lcr'])
        await click(pg, 1, 2); await pg.keyboard.type('9'); await pg.keyboard.press('Enter')
        check('tblr: cella modificata, il resto intatto', '\\SetCell[c=2]{c} unite & & 9 \\\\' in await src(pg) and 'row{1}={font=\\bfseries}' in await src(pg), await src(pg))
        check('tblr: documento con \\UseTblrLibrary{booktabs}', '\\usepackage{tabularray}\n\\UseTblrLibrary{booktabs}' in await pg.evaluate('texDocument()'))
        await set_src(pg, SIMPLE); await pg.select_option('#envsel', 'NiceTabular'); await pg.wait_for_timeout(80)
        check('ambiente NiceTabular (nicematrix)', (await src(pg)).startswith('\\begin{NiceTabular}{@{}lcr@{}}') and '\\usepackage{nicematrix}' in await pg.evaluate('texDocument()'))
        # 40. immagine della tabella
        await pg.evaluate('setSource(EXAMPLES[0][1])'); await pg.click('#b-export')
        async with pg.expect_download() as dl: await pg.click('#x-svg')
        d = await dl.value; svg = open(await d.path()).read()
        check('SVG: tabella senza intestazioni della griglia', d.suggested_filename=='tabella.svg' and '<foreignObject' in svg and 'Quicksort' in svg and '<th' not in svg)
        async with pg.expect_download() as dl: await pg.click('#x-png')
        d = await dl.value; png = open(await d.path(),'rb').read()
        check('PNG scaricato', d.suggested_filename=='tabella.png' and png[:4]==b'\x89PNG' and len(png)>10000, len(png))
        await pg.click('#m-x')
        # 41. tema scuro e schermo stretto senza errori
        await pg.click('#b-theme'); await pg.set_viewport_size({'width':420,'height':860}); await pg.wait_for_timeout(200)
        check('schermo stretto: griglia visibile', await pg.evaluate('document.querySelector("#grid table").getBoundingClientRect().width>0'))
        await pg.set_viewport_size({'width':1440,'height':900}); await pg.click('#b-theme')
        check('nessun errore JavaScript', not errors, errors)
        shot = sys.argv[1] if len(sys.argv)>1 else 'ui.png'
        await pg.evaluate('setSource(EXAMPLES[0][1])'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=shot)
        await b.close()
    ok = sum(1 for _,o in results if o)
    print(f'\n{ok}/{len(results)} scenari superati')
    sys.exit(0 if ok==len(results) else 1)
asyncio.run(main())
