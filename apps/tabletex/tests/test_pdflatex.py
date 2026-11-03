"""Il codice prodotto deve compilare con un vero LaTeX.
Raccoglie: gli esempi; ogni comando della barra applicato a ogni esempio (con selezioni di una cella, di un blocco,
di righe e colonne intere); nuove tabelle in tutti gli stili e ambienti; importazioni CSV e incolla da Excel con
celle unite; le tabelle ottenute dalla prova a caso (fuzz_out.json, se c'è). Compila tutto con pdflatex e indica
quelle che falliscono. Richiede pdflatex nel PATH (TeX Live o MiKTeX)."""
import asyncio, json, sys, os, re, shutil, subprocess, tempfile
from playwright.async_api import async_playwright
from harness import open_app

COLLECT = r"""
async () => {
  const out=[]; const add=(name)=>out.push({name, src:St.src});
  const acts=['rowins-above','rowins-below','rowdel','rowmove-up','rowmove-down','colins-left','colins-right','coldel','mergeh','mergev','split','bold','italic','cmid','cmidx',
    'colmove-left','colmove-right','transpose','max','min','endhead'];
  /* strumenti con un argomento: [azione, argomento, nome] */
  const tools=[...'lcr'].map(a=>['cellalign', a, 'cella '+a])
    .concat(['cell','row','text','alt'].map(tg=>['color', {tg, color:'gray!15'}, 'colore '+tg]))
    .concat([[0,'text'],[2,'text'],[1,'si']].map(([n,mode])=>['round', {n, mode}, `decimali ${n} ${mode}`]))
    .concat(['asc','desc'].map(dir=>['sort', {dir}, 'ordina '+dir]));
  const sels=[[1,1,1,1],[1,0,2,1],[0,0,0,2],[2,1,3,1]];
  for (const [t,s] of EXAMPLES){
    Docs.close(false); St.ti=0; setSource(s,{record:false}); add('Esempio › '+t);
    for (const a of acts) for (const [r,c,r2,c2] of sels){
      setSource(s,{record:false}); const T=curT(); if (r2>=T.rows.length || c2>=T.ncols) continue;
      St.sel={r,c,r2,c2}; View.render(); Ribbon.act(a); if (St.src!==s) add(`${t} › ${a} ${r},${c}-${r2},${c2}`);
    }
    for (const [a, arg, name] of tools) for (const [r,c,r2,c2] of sels){
      setSource(s,{record:false}); const T=curT(); if (r2>=T.rows.length || c2>=T.ncols) continue;
      St.sel={r,c,r2,c2}; View.render(); Ribbon.act(a, arg); if (St.src!==s) add(`${t} › ${name} ${r},${c}-${r2},${c2}`);
    }
    for (const al of ['l','c','r','S','p','X']) for (const c of [0,1]){ setSource(s,{record:false}); St.sel={r:1,c,r2:1,c2:c}; View.render(); Ribbon.act('align', al); add(`${t} › allinea ${al} col ${c}`); }
    for (const w of ['above','below']) for (const k of ['toprule','midrule','bottomrule','hline','none']){ setSource(s,{record:false}); St.sel={r:1,c:0,r2:1,c2:0}; View.render(); Ribbon.act('rule', {kind:k, where:w}); add(`${t} › regola ${k} ${w}`); }
    for (const st of ['booktabs','grid','plain']){ setSource(s,{record:false}); Ribbon.act('style', st); add(`${t} › stile ${st}`); }
    for (const env of ['tabular','tabular*','tabularx','longtable','NiceTabular','tblr']){
      setSource(s,{record:false}); Ribbon.act('env', env);
      /* longtable non sta dentro table: come suggerisce l'editor, si porta fuori */
      if (env==='longtable') setSource(St.src.replace(/\\begin\{table\}(\[[^\]]*\])?|\\end\{table\}|\\centering|\\caption\{[^}]*\}|\\label\{[^}]*\}/g,''), {record:false});
      add(`${t} › ambiente ${env}`);
    }
  }
  for (const style of ['booktabs','grid','plain']) for (const env of ['tabular','tabularx','longtable']) for (const float of [true,false]){
    const data=[['Nome','Valore','Note'],['a','1.5','x'],['b','22.25','y \\& z']];
    setSource(genTable(data,{style, env, float: float && env!=='longtable', caption:'Prova'}),{record:false}); add(`nuova ${style} ${env} ${float}`);
  }
  for (const [csv,o] of [['Nome;Altezza;Peso\nAnna;1,68;57\nLuca;1,82;79',{}],['a,b,c\n"x, y",2,-3.5\n10%,_,$5',{}],['x\ty\n1\t2',{si:false, style:'grid'}],['Voce,N\nuno,1\ndue,2',{env:'longtable', float:false}],['a;b\n1;2',{env:'tabularx'}]]){
    const x={data:Paste.parseDelimited(csv, Paste.sniff(csv))};
    setSource(Paste.build(x, {header:true, style:'booktabs', env:'tabular', float:true, caption:'', si:true, ...o}),{record:false}); add('CSV › '+csv.slice(0,20));
  }
  const h=Paste.fromHTML('<table><tr><td colspan="2">Gruppo</td><td>c</td></tr><tr><td rowspan="2">a</td><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></table>');
  setSource(Paste.build(h, {header:true, style:'booktabs', env:'tabular', float:false, caption:'', si:true}),{record:false}); add('Excel › celle unite');
  return out;
}
"""
def compile_doc(doc, d):
    with open(os.path.join(d,'t.tex'),'w') as f: f.write(doc)
    r = subprocess.run(['pdflatex','-interaction=nonstopmode','-halt-on-error','t.tex'], cwd=d, capture_output=True, text=True, errors='replace', timeout=300)
    return r.returncode==0, r.stdout

async def main():
    if not shutil.which('pdflatex'): print('pdflatex non trovato: prova saltata'); return
    async with async_playwright() as p:
        b, pg, errors = await open_app(p)
        items = await pg.evaluate(COLLECT)
        fz = os.path.join(os.path.dirname(__file__), 'fuzz_out.json')
        if os.path.exists(fz):
            for k, s in enumerate(json.load(open(fz))): items.append({'name':f'fuzz {k}', 'src':s})
        # ogni sorgente diventa un documento con i pacchetti che l'editor stesso dichiara
        docs = await pg.evaluate('items => items.map(x=>({name:x.name, doc:texDocument(x.src)}))', items)
        await b.close()
    d = tempfile.mkdtemp()
    # un solo documento: preambolo con tutti i pacchetti, poi i corpi uno dopo l'altro
    pre=set(); libs=set(); bodies=[]
    for x in docs:
        head, body = x['doc'].split('\\begin{document}')
        pre.update(l for l in head.splitlines() if l.startswith('\\usepackage'))
        for l in head.splitlines():
            m = re.match(r'\\UseTblrLibrary\{(.*)\}', l)
            if m: libs.update(m.group(1).split(','))
        bodies.append(f"% {x['name']}\n" + body.replace('\\end{document}','').strip())
    order = sorted(pre, key=lambda l: (0 if 'xcolor' in l else 1, l))
    if libs: order.append('\\UseTblrLibrary{' + ','.join(sorted(libs)) + '}')
    big = '\\documentclass{article}\n\\usepackage[T1]{fontenc}\n' + '\n'.join(order) + '\n\\begin{document}\n' + '\n\\clearpage\n'.join(bodies) + '\n\\end{document}\n'
    ok, log = compile_doc(big, d)
    bad=[]
    if not ok:
        for x in docs:
            ok1, log1 = compile_doc(x['doc'], d)
            if not ok1:
                m = re.search(r'^! (.*)$', log1, re.M); bad.append((x['name'], m.group(1) if m else '?'))
    print(f"tabelle compilate con pdflatex: {len(docs)} · fallite: {len(bad)}")
    for n, e in bad[:30]: print('FAIL', n, '|', e)
    print('ERRORI JS', errors)
    sys.exit(1 if bad or errors else 0)
asyncio.run(main())
