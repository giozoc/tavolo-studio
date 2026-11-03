"""Il codice prodotto deve compilare con un vero LaTeX, non solo con MathJax.
Raccoglie: il documento .tex esportato per ogni voce dei menu inserita in una formula vuota, gli esempi,
e le formule ottenute da modifiche casuali sulla formula; le compila con pdflatex e indica quelle che
falliscono. Richiede pdflatex nel PATH (TeX Live o MiKTeX)."""
import asyncio, json, sys, os, re, shutil, subprocess, tempfile
from playwright.async_api import async_playwright
from harness import open_app

COLLECT = r"""
async () => {
  const out = [];
  St.lastPane = 'mf';
  const add = (name) => { const d=texDocument(); const m=/\\begin\{document\}\n([\s\S]*)\n\\end\{document\}/.exec(d); out.push({name, math:m[1], pk:packagesFor(St.src)}); };
  for (const st of Catalog.STRUCTS) for (const sec of st.secs) for (const it of sec.items){ setSource('',{record:false}); MF.insert(it.t); add(st.l+' › '+it.l); }
  for (const g of Catalog.SYMS) for (const [c,n] of g.s){ setSource('',{record:false}); MF.insert(c); add(g.l+' › '+n); }
  for (const it of Catalog.SPACES){ setSource('',{record:false}); MF.insert(it.t); add('Spazi › '+it.l); }
  for (const [t,s] of EXAMPLES){ setSource(s,{record:false}); add('Esempio › '+t); }
  /* modifiche casuali su alcuni esempi: si tengono i risultati che il programma considera validi */
  let rnd=12345; const R=n=>{ rnd=(rnd*1103515245+12345)%2147483648; return rnd%n; };
  const ops=['y','2','+','del','frac','sqrt','sup','sub','paren','alpha'];
  for (const [t,s] of EXAMPLES){
    setSource(s,{record:false}); const mf=MF.el;
    for (let k=0;k<25;k++){
      const a=R(mf.lastOffset+1), op=ops[R(ops.length)]; mf.position=a;
      if (op==='del') mf.executeCommand('deleteBackward');
      else if (op==='frac') mf.insert('\\frac{#0}{#?}',{format:'latex',mode:'math',selectionMode:'placeholder'});
      else if (op==='sqrt') mf.insert('\\sqrt{#0}',{format:'latex',mode:'math',selectionMode:'placeholder'});
      else if (op==='sup') mf.insert('^{3}',{format:'latex',mode:'math'});
      else if (op==='sub') mf.insert('_{i}',{format:'latex',mode:'math'});
      else if (op==='paren') mf.insert('\\left(#0\\right)',{format:'latex',mode:'math',selectionMode:'placeholder'});
      else if (op==='alpha') mf.insert('\\alpha',{format:'latex',mode:'math'});
      else mf.insert(op,{format:'latex',mode:'math'});
      MF.onInput();
    }
    await Preview.check();
    if (!St.issues.some(x=>x.kind==='e')) add('Modificato › '+t);
  }
  return out;
}
"""
PRE = r"""\documentclass{article}
\usepackage{amsmath,amssymb,mathtools,cancel,bm}
\pagestyle{empty}
\begin{document}
"""
def compile_doc(body, d):
    with open(os.path.join(d,'t.tex'),'w') as f: f.write(PRE + body + '\n\\end{document}\n')
    r = subprocess.run(['pdflatex','-interaction=nonstopmode','-halt-on-error','t.tex'], cwd=d, capture_output=True, text=True, timeout=120)
    return r.returncode==0, r.stdout

async def main():
    if not shutil.which('pdflatex'): print('pdflatex non trovato: prova saltata'); return
    async with async_playwright() as p:
        b, pg, errors = await open_app(p)
        items = await pg.evaluate(COLLECT)
        await b.close()
    d = tempfile.mkdtemp()
    body = '\n\\clearpage\n'.join(f'% {i}\n{x["math"]}' for i,x in enumerate(items))
    ok, log = compile_doc(body, d)
    bad = []
    if not ok:
        for x in items:
            ok1, log1 = compile_doc(x['math'], d)
            if not ok1:
                m = re.search(r'^! (.*)$', log1, re.M); bad.append((x['name'], x['math'], m.group(1) if m else '?'))
    print(f"formule compilate con pdflatex: {len(items)} · fallite: {len(bad)}")
    for n, m, e in bad[:20]: print('FAIL', n, '|', e, '|', json.dumps(m)[:200])
    print('ERRORI JS', errors)
    sys.exit(1 if bad or errors else 0)
asyncio.run(main())
