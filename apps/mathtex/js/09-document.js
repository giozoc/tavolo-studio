/* ============ DOCUMENTO: macro personali e formule di un file .tex ============ */

/* ---------- macro personali ----------
   Le definizioni (\newcommand, \DeclareMathOperator, \def …) restano testo LaTeX dell'utente: si leggono dal
   preambolo del file aperto o si scrivono nella finestra «Macro». MathLive le riceve come macro (la formula le
   mostra disegnate e il sorgente le conserva come sono scritte), MathJax come \newcommand davanti al testo. */
const Macros = (()=>{
  let text = store.get('tl-macros') || '', list = parseMacros(text);
  function set(t){
    text = t.trim(); list = parseMacros(text); store.set('tl-macros', text);
    MF.setMacros(list); MF.fromSource(); scheduleCheck(); Formulas.refresh();
    $('b-mac').classList.toggle('on', list.length>0);
  }
  /* MathJax: le macro precedono il testo; \newcommand ridefinisce anche quelle già note */
  function mj(tex){
    if (!list.length) return tex;
    return list.map(m=>`\\newcommand{\\${m.name}}${m.args?`[${m.args}]`:''}${m.opt!==null?`[${m.opt}]`:''}{${m.def}}`).join('') + tex;
  }
  /* voci per l'autocompletamento del codice */
  const ac = () => list.map(m=>({c:m.name, d:'macro personale', ins:'\\'+m.name+(m.opt!==null?'[#?]':'')+'{#?}'.repeat(Math.max(0, m.args-(m.opt!==null?1:0)))}));
  function open(){
    const rows = list.map(m=>`<tr><td>\\${esc(m.name)}${m.args?` <small>[${m.args}]</small>`:''}</td><td><code>${esc(m.def)}</code>${m.opt!==null?' <small>— argomento facoltativo: solo anteprima, non modificabile nella formula</small>':''}</td></tr>`).join('');
    modal('Macro personali', `<p>Le definizioni del preambolo (<code>\\newcommand</code>, <code>\\renewcommand</code>, <code>\\DeclareMathOperator</code>, <code>\\def</code>) rendono modificabili nella formula i comandi personali. Si leggono da sole all'apertura di un file .tex; qui si possono scrivere o correggere.</p>
      <textarea id="mac-t" class="mac" spellcheck="false" placeholder="\\newcommand{\\R}{\\mathbb{R}}&#10;\\newcommand{\\norm}[1]{\\left\\lVert #1 \\right\\rVert}&#10;\\DeclareMathOperator{\\sen}{sen}">${esc(text)}</textarea>
      <div class="pbtns"><button class="btn pri" id="mac-ok">Applica</button><button class="btn" id="mac-clr">Svuota</button></div>
      ${list.length ? `<h3>Riconosciute (${list.length})</h3><table class="keys">${rows}</table>` : ''}`);
    $('mac-ok').onclick=()=>{ set($('mac-t').value); closeModal(); toast(list.length ? `${list.length} ${list.length===1?'macro attiva':'macro attive'}` : 'Nessuna macro'); };
    $('mac-clr').onclick=()=>{ $('mac-t').value=''; $('mac-t').focus(); };
  }
  $('b-mac').onclick=open;
  MF.setMacros(list); $('b-mac').classList.toggle('on', list.length>0);
  return {set, mj, ac, open, text:()=>text, count:()=>list.length};
})();

/* ---------- formule del file ----------
   Un file .tex si divide in testo e formule in display: F.gaps[k] è il testo prima della formula k, F.fs[k] la formula.
   La formula scelta va nell'editor; ogni modifica torna nel documento, che si scarica intero con le formule aggiornate.
   Ogni formula ha la sua cronologia di annulla e ripeti. */
function findFormulas(text){
  const out=[]; const re=/(?<!\\)\\\[[\s\S]*?\\\]|\$\$[\s\S]+?\$\$|\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|flalign\*?|displaymath)\}[\s\S]*?\\end\{\1\}/g; let m;
  const clean = text.replace(/(^|[^\\])%[^\n]*/g, (x,a)=>a+' '.repeat(x.length-a.length)); /* i commenti non contano, le posizioni restano */
  while ((m=re.exec(clean))) out.push([m.index, m.index+m[0].length]);
  return out;
}
const Formulas = (()=>{
  let F = null, thumbT = null, saveT = null;
  const texOf = s => { const d=parseDoc(s); return (d.inner?s.slice(d.os,d.ce):s.slice(d.bs,d.be)).replace(/(^|[^\\])%[^\n]*/g,'$1').trim(); };
  const docText = () => F.gaps.map((g,k)=> g + (k<F.fs.length ? F.fs[k] : '')).join('');
  function persist(){ clearTimeout(saveT); saveT=setTimeout(()=>{ try { localStorage.setItem('tl-doc', F ? JSON.stringify({name:F.name, gaps:F.gaps, fs:F.fs, orig:F.orig, cur:F.cur}) : ''); } catch(e){} }, 300); }

  function cut(text, ranges){
    const gaps=[], fs=[]; let p=0;
    for (const [s,e] of ranges){ gaps.push(text.slice(p,s)); fs.push(text.slice(s,e)); p=e; }
    gaps.push(text.slice(p));
    return {gaps, fs};
  }
  function open(name, text, ranges){
    const {gaps, fs} = cut(text, ranges);
    start({name, gaps, fs, orig:fs.slice(), cur:0});
  }
  /* un sorgente con più formule (incollate, o scritte una dopo l'altra) non è una formula sola: diventa l'elenco.
     Con un documento aperto le nuove formule prendono il posto di quella corrente, con il testo tra l'una e l'altra */
  function split(){
    const rs = findFormulas(St.src); if (rs.length<2) return false;
    const {gaps, fs} = cut(St.src, rs);
    if (!F){ open('formule.tex', St.src, rs); return true; }
    const k=F.cur, n=fs.length;
    clearTimeout(histTimer); histTimer=null;
    F.h[k] = {hist, fut};
    F.gaps.splice(k, 2, F.gaps[k]+gaps[0], ...gaps.slice(1, n), gaps[n]+F.gaps[k+1]);
    F.fs.splice(k, 1, ...fs);
    F.orig.splice(k, 1, F.orig[k], ...fs.slice(1).map(()=>null));
    F.h.splice(k, 1, F.h[k], ...fs.slice(1).map(()=>({hist:[], fut:[]})));
    render(); setSource(F.fs[k], {record:false}); updateUndoBtns(); persist();
    return true;
  }
  function start(d){
    F = {...d, h: d.fs.map(()=>({hist:[], fut:[]}))};
    F.cur = clamp(F.cur|0, 0, F.fs.length-1);
    hist=[]; fut=[];
    render(); setSource(F.fs[F.cur], {record:false}); updateUndoBtns(); persist();
  }
  /* passa a un'altra formula, portando con sé la sua cronologia */
  function select(k){
    if (!F || k===F.cur || k<0 || k>=F.fs.length) return;
    clearTimeout(histTimer); histTimer=null;
    F.h[F.cur] = {hist, fut};
    F.cur = k; ({hist, fut} = F.h[k]);
    St.cleared=null; $('b-restore').disabled=true;
    setSource(F.fs[k], {record:false}); updateUndoBtns();
    mark(); persist();
    $('flist').querySelector('.fi.on')?.scrollIntoView({block:'nearest'});
  }
  /* chiamata a ogni cambio del sorgente: la formula corrente torna nel documento */
  function update(){
    if (!F || F.fs[F.cur]===St.src) return;
    F.fs[F.cur] = St.src; persist();
    clearTimeout(thumbT); thumbT=setTimeout(()=>{ thumb(F.cur); mark(); }, 350);
  }
  function render(){
    const box=$('flist'); box.hidden=!F; document.body.classList.toggle('hasdoc', !!F);
    if (!F) return;
    $('fl-name').textContent=F.name; $('fl-name').title=F.name;
    $('fl-n').textContent=F.fs.length;
    let ln=1;
    $('fl-items').innerHTML = F.fs.map((s,k)=>{
      ln += F.gaps[k].split('\n').length-1;
      const b = `<button class="fi" data-k="${k}" title="Formula ${k+1} · riga ${ln} del file"><span class="fn">${k+1}</span><span class="fv">…</span></button>`;
      ln += s.split('\n').length-1;
      return b;
    }).join('');
    F.fs.forEach((_,k)=>thumb(k)); mark();
  }
  async function thumb(k){
    const el=$('fl-items').querySelector(`[data-k="${k}"] .fv`); if (!el) return;
    const tex=texOf(F.fs[k]);
    el.innerHTML = tex ? await MJ.svg(Macros.mj(tex), true) : '<span class="tx">vuota</span>';
  }
  function mark(){
    if (!F) return;
    $('fl-items').querySelectorAll('.fi').forEach(b=>{ const k=+b.dataset.k; b.classList.toggle('on', k===F.cur); b.classList.toggle('mod', F.fs[k]!==F.orig[k]); });
    const n=F.fs.filter((s,k)=>s!==F.orig[k]).length;
    $('fl-mod').textContent = n ? `${n} ${n===1?'modificata':'modificate'}` : '';
  }
  function save(){ download(F.name, docText(), 'application/x-tex'); F.orig=F.fs.slice(); mark(); persist(); toast(`${F.name} scaricato`); }
  function close(ask=true){
    if (!F) return;
    if (ask && F.fs.some((s,k)=>s!==F.orig[k])){
      modal('Chiudi il documento', `<p>Alcune formule di ${esc(F.name)} sono state modificate e non ancora scaricate.</p><div class="pbtns"><button class="btn pri" id="fc-save">Scarica e chiudi</button><button class="btn dng" id="fc-drop">Chiudi senza scaricare</button></div>`);
      $('fc-save').onclick=()=>{ save(); closeModal(); close(false); };
      $('fc-drop').onclick=()=>{ closeModal(); close(false); };
      return;
    }
    F=null; render(); persist(); toast('Documento chiuso: la formula resta nell\'editor');
  }
  function restore(){
    let d=null; try { d=JSON.parse(localStorage.getItem('tl-doc')||'null'); } catch(e){}
    if (!d || !Array.isArray(d.fs) || !d.fs.length || d.gaps.length!==d.fs.length+1) return false;
    start({...d, orig: Array.isArray(d.orig) && d.orig.length===d.fs.length ? d.orig : d.fs.slice()}); return true;
  }
  /* le anteprime dipendono dalle macro */
  function refresh(){ if (F) F.fs.forEach((_,k)=>thumb(k)); }
  $('fl-items').addEventListener('click', e=>{ const b=e.target.closest('.fi'); if (b) select(+b.dataset.k); });
  $('fl-save').onclick=save; $('fl-close').onclick=()=>close();
  return {open, split, select, update, save, close, restore, refresh, active:()=>!!F, name:()=>F&&F.name, text:()=>F?docText():'', step:d=>F&&select(F.cur+d)};
})();
