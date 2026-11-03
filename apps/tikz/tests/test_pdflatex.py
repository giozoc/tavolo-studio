"""Confronto automatico tra l'anteprima e il PDF compilato con pdflatex.

Per ogni esempio in esempi/*.tex:
  1. lo compila con pdflatex (in una cartella temporanea, insieme ai file di dati);
  2. rasterizza la pagina del PDF con PyMuPDF e l'SVG esportato dall'editor nel browser, alla stessa scala;
  3. ritaglia entrambe le immagini sull'inchiostro e confronta dimensioni e forma:
     - scarto delle dimensioni del disegno (in pt);
     - F-score dell'inchiostro: quanto dei tratti di uno cade entro RAGGIO pixel dei tratti dell'altro.
I valori di riferimento stanno in tests/baseline.json: la prova fallisce se un esempio peggiora
di oltre TOLL rispetto al riferimento o se le dimensioni si scostano di oltre il 12%.

  python tests/test_pdflatex.py              confronta con il riferimento
  python tests/test_pdflatex.py --update     riscrive il riferimento con i valori attuali
  python tests/test_pdflatex.py automa       solo gli esempi il cui nome contiene «automa»

Le immagini affiancate (PDF in blu, anteprima in rosso) finiscono in tests/out/.
Richiede pdflatex nel PATH, playwright e pymupdf (pip install -r tests/requirements.txt)."""
import asyncio, base64, json, os, pathlib, re, shutil, subprocess, sys, tempfile
from playwright.async_api import async_playwright
from harness import open_app, load, warnings, ROOT

PX_PER_PT = 2          # risoluzione del confronto
RAGGIO = 3             # tolleranza in pixel (1,5 pt)
TOLL = 0.04            # peggioramento ammesso rispetto al riferimento
MAX_SIZE = 0.12        # scarto massimo delle dimensioni
BASE = ROOT / 'tests' / 'baseline.json'
OUT = ROOT / 'tests' / 'out'

COMPARE = r"""
async ([pdfPng, svg, scale, radius]) => {
  const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const a = await img('data:image/png;base64,' + pdfPng);
  const b = await img('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))));
  const vb = /viewBox="([^"]+)"/.exec(svg)[1].split(' ').map(Number);
  const bw = Math.round(vb[2] / PT * scale), bh = Math.round(vb[3] / PT * scale);
  const raster = (im, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h); return g.getImageData(0, 0, w, h); };
  const ink = d => { const m = new Uint8Array(d.width * d.height); for (let k = 0; k < m.length; k++) { const r = d.data[4*k], g = d.data[4*k+1], bb = d.data[4*k+2]; m[k] = (0.3*r + 0.59*g + 0.11*bb) < 215 ? 1 : 0; } return {m, w: d.width, h: d.height}; };
  const bbox = ({m, w, h}) => { let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y*w+x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : {x0, y0, x1, y1, w: x1-x0+1, h: y1-y0+1}; };
  const A = ink(raster(a, a.width, a.height)), B = ink(raster(b, bw, bh));
  const ba = bbox(A), bb = bbox(B);
  if (!ba || !bb) return {error: 'disegno vuoto'};
  // l'anteprima si porta sul riquadro del PDF
  const W = ba.w, H = ba.h;
  const crop = (S, box, w, h) => { const out = new Uint8Array(w*h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = box.x0 + Math.min(box.w-1, Math.floor(x*box.w/w)), sy = box.y0 + Math.min(box.h-1, Math.floor(y*box.h/h)); out[y*w+x] = S.m[sy*S.w+sx]; } return out; };
  const ma = crop(A, ba, W, H), mb = crop(B, bb, W, H);
  const dil = (m) => { const t = new Uint8Array(W*H), o = new Uint8Array(W*H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -radius; d <= radius && !v; d++) { const xx = x+d; if (xx >= 0 && xx < W && m[y*W+xx]) v = 1; } t[y*W+x] = v; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -radius; d <= radius && !v; d++) { const yy = y+d; if (yy >= 0 && yy < H && t[yy*W+x]) v = 1; } o[y*W+x] = v; }
    return o; };
  const da = dil(ma), db = dil(mb);
  let na = 0, nb = 0, hitA = 0, hitB = 0;
  for (let k = 0; k < W*H; k++) { if (ma[k]) { na++; if (db[k]) hitA++; } if (mb[k]) { nb++; if (da[k]) hitB++; } }
  const recall = hitA / Math.max(1, na), precision = hitB / Math.max(1, nb);
  const f = 2*precision*recall / Math.max(1e-9, precision + recall);
  // immagine di confronto: PDF in blu, anteprima in rosso, coincidenze in nero
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const im = g.createImageData(W, H);
  for (let k = 0; k < W*H; k++) { const p = ma[k], q = mb[k]; const col = p && q ? [0,0,0] : p ? [40,90,230] : q ? [230,50,40] : [255,255,255]; im.data.set([...col, 255], 4*k); }
  g.putImageData(im, 0, 0);
  return {f, precision, recall, wPdf: ba.w/scale, hPdf: ba.h/scale, wApp: bb.w/scale, hApp: bb.h/scale, png: c.toDataURL('image/png').split(',')[1]};
}
"""

def compile_pdf(tex, work):
    for f in (ROOT/'esempi').iterdir():
        if f.is_file(): shutil.copy(f, work)
    r = subprocess.run(['pdflatex', '-interaction=nonstopmode', '-halt-on-error', tex.name], cwd=work, capture_output=True, text=True, timeout=300)
    pdf = pathlib.Path(work) / (tex.stem + '.pdf')
    if r.returncode != 0 or not pdf.exists():
        m = re.search(r"^! (.*)$", r.stdout, re.M)
        return None, (m.group(1) if m else 'errore di compilazione')
    return pdf, None

def raster_pdf(pdf):
    import fitz
    doc = fitz.open(str(pdf))
    pix = doc[0].get_pixmap(matrix=fitz.Matrix(PX_PER_PT, PX_PER_PT), alpha=False)
    return base64.b64encode(pix.tobytes('png')).decode()

async def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    update = '--update' in sys.argv
    if not shutil.which('pdflatex'): print('pdflatex non trovato: prova saltata'); return
    try: import fitz  # noqa: F401
    except ImportError: print('manca pymupdf: pip install -r tests/requirements.txt'); sys.exit(1)
    base = json.loads(BASE.read_text()) if BASE.exists() else {}
    OUT.mkdir(exist_ok=True)
    data = {f.name: f.read_text() for f in (ROOT/'esempi').iterdir() if re.search(r'\.(csv|dat|tsv)$', f.name)}
    texs = sorted(p for p in (ROOT/'esempi').glob('*.tex') if not args or any(a in p.stem for a in args))
    results, fails, skipped = {}, [], []
    async with async_playwright() as p:
        b, pg, errors = await open_app(p)
        for tex in texs:
            work = tempfile.mkdtemp()
            pdf, err = compile_pdf(tex, work)
            if not pdf:
                skipped.append((tex.stem, err)); print(f'SALTATO {tex.stem}: {err}'); continue
            await load(pg, tex.read_text(), data)
            ws = [w for w in await warnings(pg) if w['kind'] == 'e']
            svg = await pg.evaluate('exportSVG()')
            r = await pg.evaluate(COMPARE, [raster_pdf(pdf), svg, PX_PER_PT, RAGGIO])
            if 'error' in r:
                fails.append(tex.stem); print(f'FAIL {tex.stem}: {r["error"]}'); continue
            (OUT / f'{tex.stem}.png').write_bytes(base64.b64decode(r.pop('png')))
            dw, dh = r['wApp']/r['wPdf']-1, r['hApp']/r['hPdf']-1
            ref = base.get(tex.stem)
            ok = abs(dw) <= MAX_SIZE and abs(dh) <= MAX_SIZE and not ws and (update or ref is None or r['f'] >= ref - TOLL)
            results[tex.stem] = round(r['f'], 3)
            print(f"{'OK  ' if ok else 'FAIL'} {tex.stem:24s} F={r['f']:.3f}" + (f" (rif. {ref:.3f})" if ref is not None else '') +
                  f"  P={r['precision']:.2f} R={r['recall']:.2f}  {r['wPdf']:.0f}×{r['hPdf']:.0f}pt vs {r['wApp']:.0f}×{r['hApp']:.0f}pt ({dw:+.0%}, {dh:+.0%})" +
                  (f"  errori: {[w['msg'] for w in ws]}" if ws else ''))
            if not ok: fails.append(tex.stem)
            shutil.rmtree(work, ignore_errors=True)
        await b.close()
    if update:
        base.update(results); BASE.write_text(json.dumps(dict(sorted(base.items())), indent=2) + '\n')
        print(f'riferimento aggiornato: {BASE.relative_to(ROOT)}')
    print(f'esempi: {len(texs)} · confrontati: {len(results)} · saltati: {len(skipped)} · falliti: {len(fails)}')
    if errors: print('ERRORI JS', errors)
    sys.exit(1 if (fails or errors) and not update else 0)

asyncio.run(main())
