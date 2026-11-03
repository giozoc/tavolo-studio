"""Prova a caso della riscrittura griglia → sorgente.
Per molte tabelle (booktabs, griglia, siunitx, celle unite, longtable, tabularx, commenti, specifiche con *{n}{…})
esegue operazioni casuali della griglia, come farebbe l'interfaccia, e controlla dopo ognuna che:
  1. il sorgente riletto dia esattamente la griglia attesa (lo verifica Ops.run, che altrimenti rifiuta);
  2. fuori dal tratto cambiato il sorgente resti identico, carattere per carattere;
  3. le operazioni che non tolgono righe, colonne o celle conservino tutti i commenti;
  4. un sorgente senza errori non ne acquisti.
Le tabelle ottenute vengono salvate in fuzz_out.json per la prova con pdfLaTeX.
Uso: python test_fuzz.py [passi per tabella] [numero di semi]"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright
from harness import open_app

TABLES = [
r"""\begin{tabular}{@{}lcr@{}}
  \toprule
  Nome & Valore & Note \\ % intestazione
  \midrule
  a & 1 & x \\
  b & 2 & y \\ % seconda
  \bottomrule
\end{tabular}""",
r"""\begin{tabular}{|l|c|c|}
\hline
A & B & C \\
\hline
1 & 2 & 3 \\ \cline{2-3}
4 & 5 & 6 \\
\hline
\end{tabular}""",
r"""\begin{tabular}{l *{2}{S[table-format=2.2]}}
  \toprule
  & \multicolumn{2}{c}{Misure} \\
  \cmidrule(lr){2-3}
  Prova & {A} & {B} \\
  \midrule
  \multirow{2}{*}{X} & 1.25 & 2.5 \\ % gruppo X
   & 3.1 & 4 \\
  Y & 10.5 & 7.75 \\
  \bottomrule
\end{tabular}""",
r"""\begin{longtable}{lr}
\caption{Lunga}\\
\toprule
Voce & N \\ \midrule
\endhead
uno & 1 \\ % primo
due & 2
\end{longtable}""",
r"""\begin{tabularx}{\textwidth}{lX} a & b \\ c & d \\ \end{tabularx}""",
r"""% tabella con commenti ovunque
\begin{tabular}{ l c }  % specifica con spazi
  % prima della prima riga
  \hline
  $\alpha$ & $\beta^{2}$ \\  % greche
  \hline
  \textbf{x} & {\itshape y} \\
  % riga commentata: x & y \\
  z & \multicolumn{1}{c}{w} \\
  \hline
\end{tabular}""",
r"""\begin{tblr}{colspec={Q[l] X[c] r}, row{1}={font=\bfseries}}
  \toprule
  A & B & C \\ % testa
  \midrule
  x & 1.5 & 2 \\
  y & 3 & 4.25 \\
  \bottomrule
\end{tblr}""",
r"""\begin{NiceTabular}{lcc}[hvlines]
  \rowcolor{gray!10}
  p & 1 & 2 \\
  q & 3 & 4 \\ \cmidrule(lr){2-2}
  r & 5 & 6 \\ % ultima
\end{NiceTabular}""",
]
JS = r"""
async ([t0, seed, steps]) => {
  let rnd=seed; const R=n=>{ rnd=(rnd*1103515245+12345)%2147483648; return rnd%n; };
  const words=['x','$\\alpha$','12','3.5','\\textbf{h}','','A \\& B','$\\frac{1}{2}$','-0.25'];
  const comments = s => (s.match(/(^|[^\\])%[^\n]*/g)||[]).map(c=>c.replace(/^[^%]/,''));
  const errs = s => parseAll(s).flatMap(t=>t.issues).filter(x=>x.kind==='e').length;
  setSource(t0); St.ti=0;
  const st={total:0, minima:0, righe:0, corpo:0, rifiutate:0, outside:0, comments:0, broken:0, chars:0, len:0}; const log=[];
  for (let s=0;s<steps;s++){
    const T=curT(); const nr=T.rows.length, nc=T.ncols; const g=Grid.of(T, St.src);
    const kinds=['set','set','set','set','rowins','rowdel','colins','coldel','align','rule','cmid','cmidx','mergeh','mergev','split','rowmove','bold','paste','style','env',
      'colmove','sort','cellalign','color','round','max','endhead','transpose'];
    let k=kinds[R(kinds.length)]; let op=null;
    const tblr = TBLR_ENVS.has(T.env);
    if (tblr && /^(mergeh|mergev|split)$/.test(k)) continue;   /* in tabularray le celle si uniscono con \SetCell, come nell'interfaccia */
    const okRow = r => !T.rows[r].special;
    const at = (r, c, r2=r, c2=c) => { St.sel={r, c, r2, c2}; View.render(); };
    /* il testo scritto passa dalla stessa preparazione dell'interfaccia (graffe nelle colonne S, & protetti) */
    const typed = (r, c, w) => { const f=Grid.find(g.rows[r], c); return View.prepCell(w, c, f ? g.rows[r].cells[f.k].t : ''); };
    if (k==='set'){ const r=R(nr), c=R(nc); if (okRow(r)){ const t=typed(r, c, words[R(words.length)]); if (t!==null) op={op:'set', r, c, t}; } }
    else if (k==='rowins') op={op:'rowins', at:R(nr+1)};
    else if (k==='rowdel' && nr>1) op={op:'rowdel', r:R(nr)};
    else if (k==='colins') op={op:'colins', at:R(nc+1), type:['l','c','r','p{2cm}'][R(4)]};
    else if (k==='coldel' && nc>1) op={op:'coldel', c:R(nc)};
    else if (k==='align') op={op:'align', c:R(nc), type:['l','c','r','p{3cm}'][R(4)]};
    else if (k==='rule') op={op:'rule', b:R(nr+1), kind:['none','toprule','midrule','bottomrule','hline'][R(5)]};
    else if (k==='cmid'){ const a=1+R(nc); const z=Math.min(nc, a+R(2)); op={op:'cmid', b:R(nr+1), text:`\\cmidrule(lr){${a}-${z}}`}; }
    else if (k==='cmidx') op={op:'cmidx', b:R(nr+1)};
    else if (k==='mergeh' && nc>1){ const r=R(nr); const c1=R(nc-1); const f1=Grid.find(g.rows[r],c1), f2=Grid.find(g.rows[r],c1+1); if (okRow(r) && !(f1&&f2&&f1.k===f2.k)) op={op:'mergeh', r, c1, c2:c1+1, spec:'c'}; }
    else if (k==='mergev' && nr>1){ const r1=R(nr-1), c=R(nc); if (okRow(r1) && okRow(r1+1) && Grid.find(g.rows[r1],c)) op={op:'mergev', c, r1, r2:r1+1}; }
    else if (k==='split'){ const r=R(nr), c=R(nc); if (okRow(r) && Grid.find(g.rows[r],c)) op={op:'split', r, c}; }
    else if (k==='rowmove' && nr>1) op={op:'rowmove', r:R(nr-1), d:1};
    else if (k==='bold'){ const r=R(nr), c=R(nc); const f=Grid.find(g.rows[r],c); if (okRow(r) && f && g.rows[r].cells[f.k].t && !/^\\multirow/.test(g.rows[r].cells[f.k].t)){ St.sel={r, c, r2:r, c2:c}; View.render(); op={op:'ui', a:'bold'}; } }
    else if (k==='paste'){ const r=R(nr), c=R(nc); const ops=[]; for (let i=0;i<2;i++) for (let j=0;j<2;j++){ if (r+i<nr && c+j<nc && okRow(r+i)) ops.push({op:'set', r:r+i, c:c+j, t:String(R(100))}); } if (ops.length) op={op:'batch', ops}; }
    else if (k==='style' && R(4)===0) op={op:'style', to:['booktabs','grid','plain'][R(3)]};
    else if (k==='env' && R(3)===0 && !tblr) op={op:'ui', a:'env', arg:['tabular','tabularx','longtable','NiceTabular'][R(4)]};
    /* strumenti nuovi: passano dall'interfaccia, che rifiuta i casi senza senso (celle unite, didascalie…) */
    else if (k==='colmove'){ at(R(nr), R(nc)); op={op:'ui', a:R(2)?'colmove-left':'colmove-right'}; }
    else if (k==='sort'){ const r=R(nr); at(r, R(nc), R(2)?r:Math.min(nr-1, r+1+R(3))); op={op:'ui', a:'sort', arg:{dir:R(2)?'asc':'desc'}}; }
    else if (k==='cellalign'){ const r=R(nr), c=R(nc); at(r, c, r, Math.min(nc-1, c+R(2))); op={op:'ui', a:'cellalign', arg:'lcr'[R(3)]}; }
    else if (k==='color'){ at(R(nr), R(nc)); const tg=['cell','row','text','cell','row'][R(5)]; op={op:'ui', a:'color', arg:{tg, color:['gray!10','red!15','',  'blue'][R(4)]}}; }
    else if (k==='round'){ at(0, R(nc), nr-1); op={op:'ui', a:'round', arg:{n:R(4), mode:R(3)?'text':'si'}}; }
    else if (k==='max'){ at(R(nr), R(nc)); op={op:'ui', a:R(2)?'max':'min'}; }
    else if (k==='endhead' && /^longtable/.test(T.env)){ at(R(nr), 0); op={op:'ui', a:'endhead'}; }
    else if (k==='transpose' && R(3)===0) op={op:'ui', a:'transpose'};
    if (!op) continue;
    const before=St.src;
    let ok;
    if (op.op==='ui'){
      const s0=St.src; setStatus('pronto'); Ribbon.act(op.a, op.arg);
      ok = !/non applicata/.test($('st-msg').textContent);
      if (ok && St.src===s0) continue;
    }
    else ok = doOp(op);
    st.total++;
    if (!ok){ st.rifiutate++; log.push({op, before}); continue; }
    const after=St.src;
    const mode=Ops.stats; /* il modo è nel testo di stato */
    const m=$('st-msg').textContent;
    const minimal=/solo il tratto/.test(m);
    if (minimal) st.minima++; else if (/la riga/.test(m)) st.righe++; else if (/corpo/.test(m)){ st.corpo++; log.push({op, mode:'corpo', before, after}); }
    /* fuori dal tratto cambiato tutto identico */
    const [p,q]=Ops.diffRange(before, after);
    const tail=after.length-q;
    if (before.slice(0,p)!==after.slice(0,p) || before.slice(before.length-tail)!==after.slice(q)) st.outside++;
    st.chars += Math.max(q-p, before.length-tail-p); st.len += before.length;
    /* commenti fuori dal tratto cambiato */
    /* le operazioni che non tolgono righe, colonne o celle conservano tutti i commenti */
    if (minimal && !['rowdel','coldel','style'].includes(op.op) && op.a!=='transpose'){
      for (const c of comments(before)) if (!after.includes(c)){ st.comments++; log.push({op, lost:c, before, after}); break; }
    }
    if (errs(before)===0 && errs(after)>0){ st.broken++; log.push({op, broke:parseAll(after).flatMap(t=>t.issues).map(x=>x.msg), before, after}); }
  }
  return {st, log:log.slice(0,6), final:St.src};
}
"""
async def main():
    steps = int(sys.argv[1]) if len(sys.argv)>1 else 60
    seeds = int(sys.argv[2]) if len(sys.argv)>2 else 3
    async with async_playwright() as p:
        b, pg, errors = await open_app(p)
        tot = {}; finals = []; logs = []
        for t in TABLES:
            for seed in range(1, seeds+1):
                r = await pg.evaluate(JS, [t, seed*7919+len(t), steps])
                for k,v in r['st'].items(): tot[k]=tot.get(k,0)+v
                finals.append(r['final']); logs += r['log']
        await b.close()
    json.dump(finals, open(os.path.join(os.path.dirname(__file__), 'fuzz_out.json'),'w'), ensure_ascii=False, indent=0)
    n=tot['total']; applied=n-tot['rifiutate']
    print(f"operazioni: {n} · applicate: {applied} · rifiutate: {tot['rifiutate']}")
    print(f"riscrittura minima: {tot['minima']} ({100*tot['minima']/max(1,applied):.1f}%) · riga: {tot['righe']} · corpo: {tot['corpo']}")
    print(f"testo cambiato in media: {100*tot['chars']/max(1,tot['len']):.2f}% del sorgente")
    print(f"testo alterato fuori dal tratto: {tot['outside']} · commenti persi: {tot['comments']} · sorgenti resi non validi: {tot['broken']}")
    for l in logs[:8]: print('LOG', json.dumps(l, ensure_ascii=False)[:700])
    print('ERRORI JS', errors)
    bad = tot['rifiutate'] or tot['outside'] or tot['comments'] or tot['broken'] or errors
    sys.exit(1 if bad else 0)
asyncio.run(main())
