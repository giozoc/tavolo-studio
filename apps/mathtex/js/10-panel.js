/* ============ PANNELLI: esportazione, esempi, file, scorciatoie, avvio ============ */
const body = () => { const d=parseDoc(St.src); return St.src.slice(d.bs, d.be).trim(); };
function wrapAs(kind){
  const b=body(); const d=parseDoc(St.src);
  const inner = d.inner ? `\\begin{${d.inner}}\n${b}\n\\end{${d.inner}}` : b;
  if (kind==='$') return `$${inner}$`;
  if (kind==='\\[') return `\\[\n${inner}\n\\]`;
  if (kind==='equation') return `\\begin{equation}\n${inner}\n\\end{equation}`;
  return d.inner ? inner : b;
}
function packagesFor(t){
  const p=['amsmath','amssymb'];
  if (/\\(coloneqq|eqqcolon|Coloneqq|mathclap|prescript|xRightarrow|xmapsto)/.test(t)) p.push('mathtools');
  if (/\\(cancel|bcancel|xcancel|cancelto)\b/.test(t)) p.push('cancel');
  if (/\\(color|textcolor|colorbox)\b/.test(t)) p.push('xcolor');
  if (/\\(bm)\b/.test(t)) p.push('bm');
  return p;
}
function texDocument(){
  const d=parseDoc(St.src);
  const math = d.env && d.env!=='$' && d.env!=='\\(' ? St.src.slice(d.os, d.ce) : `\\[\n${wrapAs('')}\n\\]`;
  const mac = Macros.text() ? Macros.text()+'\n' : '';
  return `\\documentclass{article}\n\\usepackage{${packagesFor(St.src+mac).join(',')}}\n${mac}\\pagestyle{empty}\n\\begin{document}\n${math.trim()}\n\\end{document}\n`;
}
async function mjNode(){
  await MJ.whenReady();
  const d=parseDoc(St.src);
  const tex = d.inner ? St.src.slice(d.os, d.ce) : (body()||'\\phantom{x}');
  return MathJax.tex2svgPromise(Macros.mj(tex), {display:true});
}
async function svgString(){
  const node=await mjNode(); const s=node.querySelector('svg').cloneNode(true);
  s.setAttribute('xmlns','http://www.w3.org/2000/svg'); s.style.color='#000';
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+s.outerHTML;
}
async function pngBlob(scale=4){
  const node=await mjNode(); const s=node.querySelector('svg');
  const ex = 8; /* 1ex ≈ 8px a 16px */
  const w = parseFloat(s.getAttribute('width'))*ex, h = parseFloat(s.getAttribute('height'))*ex;
  const c=s.cloneNode(true); c.setAttribute('xmlns','http://www.w3.org/2000/svg'); c.setAttribute('width', w); c.setAttribute('height', h); c.style.color='#000';
  const url = URL.createObjectURL(new Blob([c.outerHTML],{type:'image/svg+xml'}));
  const img = new Image(); await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; img.src=url; });
  const pad=12, cv=document.createElement('canvas'); cv.width=Math.ceil((w+2*pad)*scale); cv.height=Math.ceil((h+2*pad)*scale);
  const g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,cv.width,cv.height); g.drawImage(img, pad*scale, pad*scale, w*scale, h*scale);
  URL.revokeObjectURL(url);
  return new Promise(res=>cv.toBlob(res,'image/png'));
}

/* ---------- esportazione ---------- */
$('b-export').onclick=openExport;
async function openExport(){
  const b=body();
  modal('Esporta', `<p>Il codice usa solo comandi LaTeX standard (amsmath, amssymb${packagesFor(St.src).length>2?', '+packagesFor(St.src).slice(2).join(', '):''}): si incolla in qualsiasi documento.</p>
    <div class="prv" id="ex-prv">…</div>
    <h3>Codice della formula</h3><pre id="ex-code">${esc(b)}</pre>
    <div class="pbtns">
      <button class="btn pri" data-cp="">Copia la formula</button>
      <button class="btn" data-cp="$">Copia come $…$</button>
      <button class="btn" data-cp="\\[">Copia come \\[…\\]</button>
      <button class="btn" data-cp="equation">Copia come equation</button>
      <button class="btn" data-cp="src">Copia il sorgente com'è</button>
    </div>
    <h3>File</h3>
    <div class="pbtns">
      <button class="btn" id="ex-tex">Documento .tex</button>
      <button class="btn" id="ex-svg">Immagine SVG</button>
      <button class="btn" id="ex-png">Immagine PNG</button>
      <button class="btn" id="ex-mml">Copia MathML</button>
      ${Formulas.active() ? `<button class="btn" id="ex-doc">Documento completo (${esc(Formulas.name())})</button>` : ''}
    </div>`);
  if ($('ex-doc')) $('ex-doc').onclick=Formulas.save;
  $('m-b').querySelectorAll('[data-cp]').forEach(x=>x.onclick=()=>copyText(x.dataset.cp==='src'?St.src:wrapAs(x.dataset.cp), 'LaTeX copiato'));
  $('ex-tex').onclick=()=>{ download('formula.tex', texDocument(), 'application/x-tex'); toast('Documento formula.tex scaricato'); };
  $('ex-svg').onclick=async()=>{ download('formula.svg', await svgString(), 'image/svg+xml'); toast('formula.svg scaricato'); };
  $('ex-png').onclick=async()=>{ try { download('formula.png', await pngBlob()); toast('formula.png scaricato'); } catch(e){ toast('PNG non disponibile in questo browser'); } };
  $('ex-mml').onclick=async()=>{ await MJ.whenReady(); const d=parseDoc(St.src); copyText(MathJax.tex2mml(Macros.mj(d.inner?St.src.slice(d.os,d.ce):b), {display:true}), 'MathML copiato'); };
  try { const n=await mjNode(); const p=$('ex-prv'); if (p){ p.innerHTML=''; p.appendChild(n.querySelector('svg')); } } catch(e){}
}
function copyFormula(){ if (!body()){ toast('La formula è vuota'); return; } copyText(wrapAs(''), 'LaTeX copiato negli appunti'); }
$('b-copy').onclick=copyFormula;
$('b-copy2').onclick=()=>copyText(St.src, 'Sorgente copiato');

/* ---------- cancella e ripristina ---------- */
$('b-clear').onclick=()=>{
  if (!St.src.trim()){ toast('La formula è già vuota'); return; }
  St.cleared = St.src; setSource(''); $('b-restore').disabled=false; toast('Formula cancellata · Ripristina per riaverla'); MF.focus();
};
$('b-restore').onclick=()=>{ if (St.cleared===null) return; setSource(St.cleared); St.cleared=null; $('b-restore').disabled=true; toast('Contenuto ripristinato'); };

/* ---------- esempi ---------- */
const EXAMPLES = [
  ['Formula risolutiva', '% Soluzioni dell\'equazione di secondo grado\nx_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'],
  ['Integrale di Gauss', '\\int_{-\\infty}^{+\\infty} e^{-x^2}\\,\\mathrm{d}x = \\sqrt{\\pi}'],
  ['Identità di Eulero', 'e^{i\\pi} + 1 = 0'],
  ['Serie di Taylor', 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(x_0)}{n!}\\,(x - x_0)^n'],
  ['Binomio di Newton', '(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^{k}'],
  ['Sistema lineare', '\\begin{cases}\n  2x + 3y = 7 \\\\\n  x - y = 1\n\\end{cases}'],
  ['Determinante 3×3', '\\det A =\n\\begin{vmatrix}\n  a_{11} & a_{12} & a_{13} \\\\\n  a_{21} & a_{22} & a_{23} \\\\\n  a_{31} & a_{32} & a_{33}\n\\end{vmatrix}'],
  ['Trasformata di Fourier', '\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\, e^{-2\\pi i x \\xi}\\,\\mathrm{d}x'],
  ['Equazioni di Maxwell', '\\begin{align*}\n  \\nabla \\cdot \\vec{E} &= \\frac{\\rho}{\\varepsilon_0} % Gauss\n  \\\\\n  \\nabla \\cdot \\vec{B} &= 0 \\\\\n  \\nabla \\times \\vec{E} &= -\\frac{\\partial \\vec{B}}{\\partial t} % Faraday\n  \\\\\n  \\nabla \\times \\vec{B} &= \\mu_0 \\vec{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\vec{E}}{\\partial t}\n\\end{align*}'],
  ['Teorema di Bayes', 'P(A \\mid B) = \\frac{P(B \\mid A)\\, P(A)}{P(B)}'],
  ['Definizione di limite', '\\lim_{x \\to x_0} f(x) = \\ell \\iff \\forall \\varepsilon > 0\\; \\exists \\delta > 0 : 0 < |x - x_0| < \\delta \\implies |f(x) - \\ell| < \\varepsilon'],
  ['Frazione continua', '\\sqrt{2} = 1 + \\cfrac{1}{2 + \\cfrac{1}{2 + \\cfrac{1}{2 + \\cdots}}}'],
  ['Formula di Stirling', 'n! \\sim \\sqrt{2\\pi n}\\left(\\frac{n}{e}\\right)^{n}'],
  ['Equazione di Schrödinger', '\\begin{equation}\n  i\\hbar \\frac{\\partial}{\\partial t} \\Psi(\\mathbf{r},t) = \\left[ -\\frac{\\hbar^2}{2m}\\nabla^2 + V(\\mathbf{r},t) \\right] \\Psi(\\mathbf{r},t)\n\\end{equation}'],
  ['Funzione a tratti', '|x| =\n\\begin{cases}\n  x  & \\text{se } x \\geq 0 \\\\\n  -x & \\text{se } x < 0\n\\end{cases}'],
  ['Disuguaglianza di Cauchy–Schwarz', '\\left( \\sum_{k=1}^{n} a_k b_k \\right)^{2} \\leq \\left( \\sum_{k=1}^{n} a_k^2 \\right) \\left( \\sum_{k=1}^{n} b_k^2 \\right)'],
  ['Prodotto di matrici', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\n\\begin{pmatrix} x \\\\ y \\end{pmatrix}\n=\n\\begin{pmatrix} ax + by \\\\ cx + dy \\end{pmatrix}'],
  ['Teorema fondamentale', '\\int_{a}^{b} f\'(x)\\,\\mathrm{d}x = f(b) - f(a)'],
];
$('b-ex').onclick=()=>{
  modal('Esempi', `<p>Carica un esempio: sostituisce la formula attuale (puoi annullare con Ctrl+Z). Alcuni contengono commenti e a capo: modificando la formula a destra restano al loro posto.</p><div class="exgrid">`+
    EXAMPLES.map(([t,s],k)=>{ const d=parseDoc(s); const tex = d.inner ? s.slice(d.os,d.ce) : s.slice(d.bs,d.be); return `<button class="exb" data-ex="${k}"><span class="exv" data-tex="${esc(tex.replace(/%[^\n]*/g,''))}" data-disp="1">…</span><b>${esc(t)}</b></button>`; }).join('')+'</div>');
  MJ.fill($('m-b'));
  $('m-b').querySelectorAll('[data-ex]').forEach(b=>b.onclick=()=>{ closeModal(); setSource(EXAMPLES[+b.dataset.ex][1]); MF.focus(); toast(EXAMPLES[+b.dataset.ex][0]); });
};

/* ---------- apertura di file .tex: le macro del preambolo e le formule del documento ---------- */
function loadText(text, name){
  const full = /\\begin\{document\}|\\documentclass/.test(text);
  const defs = parseMacros(text);
  if (defs.length || full) Macros.set(defs.map(m=>m.text).join('\n'));
  const mac = defs.length ? ` · ${defs.length} macro dal preambolo` : '';
  const all = findFormulas(text), rs = full || all.length>1 ? all : [];
  if (!rs.length){ Formulas.close(false); setSource(text.replace(/\s+$/,'')); toast('Aperto '+name+mac); return; }
  Formulas.open(name, text, rs);
  toast(`${name}: ${rs.length} ${rs.length===1?'formula':'formule'}${mac}`);
}
function loadFile(f){ const r=new FileReader(); r.onload=()=>loadText(String(r.result), f.name); r.readAsText(f); }
$('b-open').onclick=()=>$('file').click();
$('file').addEventListener('change', e=>{ const f=e.target.files[0]; if (f) loadFile(f); e.target.value=''; });
{ let dc=0;
  window.addEventListener('dragenter', e=>{ if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')){ dc++; $('drop').hidden=false; } });
  window.addEventListener('dragleave', ()=>{ if (--dc<=0){ dc=0; $('drop').hidden=true; } });
  window.addEventListener('dragover', e=>e.preventDefault());
  window.addEventListener('drop', e=>{ e.preventDefault(); dc=0; $('drop').hidden=true; const f=e.dataTransfer.files[0]; if (f) loadFile(f); });
}

/* ---------- scorciatoie ---------- */
function openHelp(){
  const st = Catalog.STRUCTS.map(s=>`<tr><td>Alt+${s.key}</td><td>${esc(s.l)} — ${esc(s.d)}</td></tr>`).join('');
  modal('Scorciatoie da tastiera', `<table class="keys">
    <tr><td>Ctrl+Z · Ctrl+Y</td><td>Annulla · Ripeti (una sola cronologia per codice e formula)</td></tr>
    <tr><td>Ctrl+Maiusc+C</td><td>Copia il codice LaTeX della formula</td></tr>
    <tr><td>Ctrl+S</td><td>Scarica la formula come documento .tex (con un file aperto: il file intero, con le formule aggiornate)</td></tr>
    <tr><td>Alt+PagSu · Alt+PagGiù</td><td>Formula precedente · successiva del file aperto</td></tr>
    <tr><td>Alt+T · Alt+G</td><td>Testo normale · Tutti i simboli</td></tr>
    ${st}
    <tr><td>Esc</td><td>Chiude la galleria aperta</td></tr>
    <tr><td>F1</td><td>Questa finestra</td></tr></table>
    <h3>Nella formula</h3><table class="keys">
    <tr><td>Tab · Maiusc+Tab</td><td>Casella successiva · precedente (numeratore → denominatore, limiti di un integrale …)</td></tr>
    <tr><td>← → ↑ ↓</td><td>Muove il cursore nella struttura (su e giù tra numeratore e denominatore, indici …)</td></tr>
    <tr><td>Maiusc+frecce</td><td>Seleziona; poi una struttura dalla barra avvolge la selezione</td></tr>
    <tr><td>/ · ^ · _</td><td>Frazione · Apice · Pedice</td></tr>
    <tr><td>\\ comando Invio</td><td>Scrive un comando LaTeX direttamente (es. <code>\\alpha</code>)</td></tr>
    <tr><td>sqrt · int · sum · pi · infty</td><td>Scorciatoie testuali: diventano √, ∫, Σ, π, ∞</td></tr></table>
    <h3>Nel codice</h3><table class="keys">
    <tr><td>\\ + lettere</td><td>Suggerimenti dei comandi (Tab o Invio per completare)</td></tr>
    <tr><td>Clic su un messaggio</td><td>Porta all'errore nel sorgente</td></tr></table>`);
}
$('b-help').onclick=openHelp;
document.addEventListener('keydown', e=>{
  const k=e.key.toLowerCase(), ctrl=e.ctrlKey||e.metaKey;
  if (e.key==='F1'){ e.preventDefault(); openHelp(); return; }
  if (e.key==='Escape' && Ribbon.isOpen()){ e.preventDefault(); Ribbon.close(); return; }
  if (ctrl && e.shiftKey && k==='c'){ e.preventDefault(); copyFormula(); return; }
  if (ctrl && !e.shiftKey && k==='s'){ e.preventDefault(); if (Formulas.active()) Formulas.save(); else { download('formula.tex', texDocument(), 'application/x-tex'); toast('Documento formula.tex scaricato'); } return; }
  if (e.altKey && !ctrl && (e.key==='PageUp'||e.key==='PageDown') && Formulas.active()){ e.preventDefault(); e.stopPropagation(); Formulas.step(e.key==='PageUp'?-1:1); return; }
  if (ctrl && !e.altKey && (k==='z'||k==='y') && !e.target.closest('#ed,#mf,input,textarea')){ e.preventDefault(); (k==='y'||e.shiftKey)?redo():undo(); return; }
  if (e.altKey && !ctrl && /^Key[A-Z]$/.test(e.code)){
    const L=e.code.slice(3);
    if (L==='T'){ e.preventDefault(); MF.applyFont(Catalog.FONTS.find(f=>f.s.text)); return; }
    if (L==='G'){ e.preventDefault(); Ribbon.toggle('syms', $('b-symmore'), true); return; }
    const st=Catalog.STRUCTS.find(s=>s.key===L);
    if (st){ e.preventDefault(); e.stopPropagation(); Ribbon.toggle(st.id, document.querySelector(`[data-st="${st.id}"]`), true); }
  }
}, true);

/* ---------- avvio ---------- */
(()=>{
  const DEF = EXAMPLES[0][1];
  const saved = store.get('tl-src');
  St.lastPane='mf';
  if (!Formulas.restore()){ setSource(saved!==null ? saved : DEF, {record:false}); Formulas.split(); }
  if ($('stylesel').value==='inline') MF.setDisplay(false);
  updateUndoBtns();
})();
