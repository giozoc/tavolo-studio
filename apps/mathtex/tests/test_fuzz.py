"""Prova a caso della sincronizzazione formula → sorgente.
Per molte formule (semplici, complesse, annidate, con commenti e delimitatori) esegue modifiche casuali
sulla formula con le API di MathLive e controlla, dopo ogni modifica, che:
  1. il sorgente riletto da MathLive dia esattamente la formula mostrata (correttezza);
  2. con la riscrittura minima, tutto il sorgente fuori dal tratto cambiato resti identico, carattere per carattere;
  3. i commenti sopravvivano finché la modifica non costringe a riscrivere il corpo."""
import asyncio, json, sys, os
from playwright.async_api import async_playwright
from harness import open_app

FORMULAS = [
  "x^2 + y^2 = r^2",
  "% formula risolutiva\nx_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
  "\\frac12 + \\frac{a}{b}",
  "\\int_0^\\infty e^{-x^2}\\,\\mathrm{d}x = \\frac{\\sqrt{\\pi}}{2}",
  "\\sum_{k=1}^{n} k^2 = \\frac{n(n+1)(2n+1)}{6}",
  "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1",
  "\\begin{pmatrix}\n  a & b \\\\\n  c & d\n\\end{pmatrix}",
  "f(x) =\n\\begin{cases}\n  x^2 & x \\geq 0 \\\\ % ramo positivo\n  -x  & x < 0\n\\end{cases}",
  "\\begin{align*}\n  a &= b + c \\\\ % prima\n  d &= e - f\n\\end{align*}",
  "$\\alpha + \\beta = \\gamma$",
  "\\[\n  \\left( \\frac{a}{b} \\right)^{2} \\leq \\sqrt[3]{\\frac{1}{1+\\frac{1}{x}}}\n\\]",
  "\\vec{F} = m\\vec{a} \\quad \\text{(seconda legge)}",
  "\\overbrace{1+2+\\cdots+n}^{n \\text{ termini}} = \\binom{n+1}{2}",
  "e^{i\\pi}+1=0",
]
JS = r"""
async ([src, seed, steps]) => {
  let rnd = seed; const R = n => { rnd = (rnd*1103515245 + 12345) % 2147483648; return rnd % n; };
  const ops = ['y','2','+','\\alpha','del','del','fwd','frac','sqrt','sup','sub','paren'];
  setSource(src); const mf = MF.el;
  const log = []; let minimal=0, group=0, full=0, norm=0, bad=0, preserved=0, notPreserved=0, changed=0, total=0, broken=0;
  for (let s=0; s<steps; s++){
    const before = St.src;
    const last = mf.lastOffset; const a = R(last+1);
    const op = ops[R(ops.length)];
    mf.position = a;
    if (op==='del') mf.executeCommand('deleteBackward');
    else if (op==='fwd') mf.executeCommand('deleteForward');
    else if (op==='frac'){ const b=Math.min(last, a+R(3)); mf.selection={ranges:[[a,b]]}; mf.insert('\\frac{#0}{#?}',{format:'latex',mode:'math',selectionMode:'placeholder'}); }
    else if (op==='sqrt'){ const b=Math.min(last, a+R(3)); mf.selection={ranges:[[a,b]]}; mf.insert('\\sqrt{#0}',{format:'latex',mode:'math',selectionMode:'placeholder'}); }
    else if (op==='sup') mf.insert('^{3}',{format:'latex',mode:'math'});
    else if (op==='sub') mf.insert('_{i}',{format:'latex',mode:'math'});
    else if (op==='paren') mf.insert('\\left(#0\\right)',{format:'latex',mode:'math',selectionMode:'placeholder'});
    else mf.insert(op,{format:'latex',mode:'math'});
    const prevMF = St.prevMF;
    MF.onInput();
    const shown = MF.value();
    const mode = $('st-sync').textContent;
    const reparsed = MF.normalize(feedOf(St.src));
    const ok = reparsed === shown;
    if (!ok){ bad++; log.push({step:s, op, mode, before, after:St.src, shown, reparsed}); }
    if (St.src===before) continue;
    if (lint(before).length===0 && lint(St.src).length>0){ broken++; log.push({step:s, op, mode, broke:lint(St.src).map(x=>x.msg), prevMF, next:MF.value(), before, after:St.src}); }
    if (/corpo/.test(mode)){ full++; log.push({step:s, op, mode, prevMF, shownNow:MF.value(), before, after:St.src}); } else if (/normalizzata/.test(mode)) norm++; else if (/gruppo/.test(mode)) group++; else minimal++;
    /* conservazione: fuori dal tratto cambiato il testo deve coincidere */
    let p=0; while (p<before.length && before[p]===St.src[p]) p++;
    let q=0; while (q<before.length-p && q<St.src.length-p && before[before.length-1-q]===St.src[St.src.length-1-q]) q++;
    /* i commenti che stanno fuori dal tratto modificato devono restare */
    if (!/corpo|normalizzata/.test(mode)){
      const outside = [...before.matchAll(/%[^\n]*/g)].filter(m=>m.index+m[0].length<=p+0 || m.index>=before.length-q);
      const kept = outside.every(m=>St.src.includes(m[0]));
      if (kept) preserved++; else { notPreserved++; log.push({step:s, op, lost:'comment', before, after:St.src}); }
      changed += (St.src.length-p-q) + (before.length-p-q); total += before.length+St.src.length;
    }
  }
  return {broken, minimal, group, full, norm, bad, preserved, notPreserved, changed, total, final:St.src, log:log.slice(0,8)};
}
"""
async def main():
    steps = int(sys.argv[1]) if len(sys.argv)>1 else 40
    seeds = int(sys.argv[2]) if len(sys.argv)>2 else 3
    async with async_playwright() as p:
        b, pg, errors = await open_app(p)
        tot = dict(broken=0, minimal=0, group=0, full=0, norm=0, bad=0, preserved=0, notPreserved=0, changed=0, total=0)
        failures = []
        for f in FORMULAS:
            for seed in range(1, seeds+1):
                r = await pg.evaluate(JS, [f, seed*7919, steps])
                for k in tot: tot[k]+=r[k]
                if r['bad'] or r['notPreserved'] or r['broken']: failures.append((f, seed, r['log']))
                if os.environ.get('FULLLOG'): [print('FULL', json.dumps(l, ensure_ascii=False)[:600]) for l in r['log'] if l.get('mode')=='corpo riscritto']
        edits = tot['minimal']+tot['group']+tot['full']+tot['norm']
        print(f"modifiche: {edits} · minime {tot['minimal']} · per gruppo {tot['group']} · corpo riscritto {tot['full']} · stati MathLive non riproducibili (riallineati) {tot['norm']}")
        print(f"testo toccato nelle modifiche minime: {100*tot['changed']/max(1,tot['total']):.1f}% dei caratteri")
        print(f"incoerenze sorgente/formula: {tot['bad']} · sorgenti resi non validi: {tot['broken']} · commenti persi senza riscrittura: {tot['notPreserved']}")
        for f, seed, log in failures[:6]:
            print('---', json.dumps(f), 'seme', seed)
            for l in log[:2]: print(json.dumps(l, ensure_ascii=False)[:700])
        print('ERRORI JS', errors)
        await b.close()
        sys.exit(1 if tot['bad'] or errors else 0)
asyncio.run(main())
