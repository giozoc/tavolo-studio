"""Ogni voce dei menu deve funzionare davvero: per ciascun modello del catalogo (strutture, simboli,
spazi, stili di carattere) lo si inserisce in una formula vuota e si controlla che
  - il sorgente risultante sia LaTeX che MathJax compila senza errori;
  - MathLive lo rilegga senza errori;
  - l'anteprima della galleria venga disegnata."""
import asyncio, json, sys
from playwright.async_api import async_playwright
from harness import open_app

JS = r"""
async () => {
  const items = [];
  for (const st of Catalog.STRUCTS) for (const sec of st.secs) for (const it of sec.items) items.push({g:st.l+' › '+sec.title, l:it.l, t:it.t, v:it.v});
  for (const g of Catalog.SYMS) for (const [c,n] of g.s) items.push({g:g.l, l:n, t:c});
  for (const it of Catalog.SPACES) items.push({g:'Spazi', l:it.l, t:it.t, v:it.v});
  const bad = [];
  St.lastPane = 'mf';
  for (const it of items){
    setSource('', {record:false});
    MF.insert(it.t);
    const src = St.src;
    const {errors} = MF.analyze(feedOf(src));
    let mj = null;
    try { const n = await MathJax.tex2svgPromise(src || '\\phantom{x}', {display:true}); const e=n.querySelector('[data-mjx-error]'); if (e) mj=e.getAttribute('data-mjx-error'); } catch(e){ mj=String(e); }
    let pv = null;
    try { const n = await MathJax.tex2svgPromise(it.v || previewTex(it.t), {display:false}); const e=n.querySelector('[data-mjx-error]'); if (e) pv=e.getAttribute('data-mjx-error'); } catch(e){ pv=String(e); }
    if (!src.trim() || errors.length || mj || pv || /placeholder/.test(src)) bad.push({g:it.g, l:it.l, tpl:it.t, src, ml:errors.map(e=>e.code+' '+(e.arg||'')), mj, pv});
  }
  /* stili di carattere: sulla selezione e su ciò che si scrive dopo */
  for (const it of Catalog.FONTS){
    setSource('x', {record:false}); St.lastPane='mf';
    if (it.s.text){ MF.el.position=1; MF.applyFont(it); MF.el.executeCommand(['typedText','se']); MF.onInput(); }
    else { MF.el.selection={ranges:[[0,1]]}; MF.applyFont(it); }
    const src=St.src; const want = it.t.replace('#0', it.s.text?'se':'x');
    const ok = it.s.text ? src==='x'+want : src===want;
    if (!ok) bad.push({g:'Caratteri', l:it.l, src, want});
  }
  return {n: items.length+Catalog.FONTS.length, bad};
}
"""
async def main():
    async with async_playwright() as p:
        b, pg, errors = await open_app(p)
        r = await pg.evaluate(JS)
        print(f"voci provate: {r['n']} · con problemi: {len(r['bad'])}")
        for x in r['bad']: print(json.dumps(x, ensure_ascii=False))
        print('ERRORI JS', errors)
        await b.close()
        sys.exit(1 if r['bad'] or errors else 0)
asyncio.run(main())
