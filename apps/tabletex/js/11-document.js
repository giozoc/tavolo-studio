/* ============ DOCUMENTI: le tabelle di un file .tex ============
   Come le formule in Tavolo MathTeX: il file si divide in testo e tabelle. D.gaps[k] è il testo prima della
   voce k, D.items[k] la voce (l'ambiente table che contiene la tabella, con didascalia ed etichetta, oppure la
   tabella da sola). La voce scelta va nell'editor; ogni modifica torna nel documento, il resto del file non
   passa mai dall'editor. Ogni voce ha la sua cronologia di annulla e ripeti. */
function findTableItems(text){
  const tabs=findTables(text); if (!tabs.length) return [];
  /* ambienti mobili che contengono tabelle (i commenti non contano, le posizioni restano) */
  const clean=text.replace(/(^|[^\\])%[^\n]*/g, (x,a)=>a+' '.repeat(x.length-a.length));
  const floats=[]; const re=/\\begin\s*\{(table\*?|sidewaystable\*?|wraptable)\}[\s\S]*?\\end\s*\{\1\}/g; let m;
  while ((m=re.exec(clean))) floats.push([m.index, m.index+m[0].length]);
  const out=[];
  for (const t of tabs){
    const f=floats.find(([a,b])=>a<=t.s && t.e<=b);
    const r = f ? f : [t.s, t.e];
    if (!out.some(([a,b])=>a===r[0])) out.push(r);
  }
  return out.sort((a,b)=>a[0]-b[0]);
}
const Docs = (()=>{
  let D=null, thumbT=null, saveT=null;
  const docText = () => D.gaps.map((g,k)=> g + (k<D.items.length ? D.items[k] : '')).join('');
  function persist(){ clearTimeout(saveT); saveT=setTimeout(()=>{ try { localStorage.setItem('tt-doc', D ? JSON.stringify({name:D.name, gaps:D.gaps, items:D.items, orig:D.orig, cur:D.cur}) : ''); } catch(e){} }, 300); }
  function cut(text, ranges){
    const gaps=[], items=[]; let p=0;
    for (const [s,e] of ranges){ gaps.push(text.slice(p,s)); items.push(text.slice(s,e)); p=e; }
    gaps.push(text.slice(p));
    return {gaps, items};
  }
  /* apre un file: con più tabelle, o con testo intorno, diventa un documento con la lista */
  function open(name, text){
    const rs=findTableItems(text);
    const outside = rs.length ? text.slice(0, rs[0][0]).trim() + text.slice(rs[rs.length-1][1]).trim() : '';
    if (!rs.length || (rs.length===1 && !outside)){ close(false); St.ti=0; St.sel={r:0,c:0,r2:0,c2:0}; setSource(text.replace(/\s+$/,'')+'\n'); return rs.length; }
    const {gaps, items}=cut(text, rs);
    start({name, gaps, items, orig:items.slice(), cur:0});
    return rs.length;
  }
  function start(d){
    D={...d, h:d.items.map(()=>({hist:[], fut:[]}))};
    D.cur=clamp(D.cur|0, 0, D.items.length-1);
    hist=[]; fut=[]; St.ti=0; St.sel={r:0,c:0,r2:0,c2:0};
    render(); setSource(D.items[D.cur], {record:false}); updateUndoBtns(); persist();
  }
  function select(k){
    if (!D || k===D.cur || k<0 || k>=D.items.length) return;
    clearTimeout(histTimer); histTimer=null;
    D.h[D.cur]={hist, fut};
    D.cur=k; ({hist, fut}=D.h[k]);
    St.ti=0; St.sel={r:0,c:0,r2:0,c2:0};
    setSource(D.items[k], {record:false}); updateUndoBtns();
    mark(); persist();
    $('tlist').querySelector('.ti.on')?.scrollIntoView({block:'nearest'});
  }
  function update(){
    if (!D || D.items[D.cur]===St.src) return;
    D.items[D.cur]=St.src; persist();
    clearTimeout(thumbT); thumbT=setTimeout(()=>{ if (D){ thumb(D.cur); mark(); } }, 300);
  }
  function render(){
    const box=$('tlist'); box.hidden=!D; document.body.classList.toggle('hasdoc', !!D);
    if (!D) return;
    $('tl-name').textContent=D.name; $('tl-name').title=D.name; $('tl-n').textContent=D.items.length;
    let ln=1;
    $('tl-items').innerHTML=D.items.map((s,k)=>{
      ln += D.gaps[k].split('\n').length-1;
      const b=`<button class="ti" data-k="${k}" title="Tabella ${k+1} · riga ${ln} del file"><span class="fn">${k+1}</span><span class="tv"></span></button>`;
      ln += s.split('\n').length-1;
      return b;
    }).join('');
    D.items.forEach((_,k)=>thumb(k)); mark();
  }
  /* anteprima: didascalia e prime righe */
  function thumb(k){
    const el=$('tl-items').querySelector(`[data-k="${k}"] .tv`); if (!el) return;
    el.innerHTML=miniTable(D.items[k]);
  }
  function mark(){
    if (!D) return;
    const n=D.items.filter((s,k)=>s!==D.orig[k]).length;
    $('tl-mod').textContent = n ? `${n} ${n===1?'modificata':'modificate'}` : '';
    $('tl-items').querySelectorAll('.ti').forEach(b=>{ const k=+b.dataset.k; b.classList.toggle('on', k===D.cur); b.classList.toggle('mod', D.items[k]!==D.orig[k]); });
  }
  function save(){ if (!D) return; download(D.name, docText(), 'application/x-tex'); D.orig=D.items.slice(); mark(); persist(); toast('Scaricato '+D.name); }
  function close(ask=true){
    if (!D) return;
    if (ask && D.items.some((s,k)=>s!==D.orig[k])){
      modal('Chiudi il documento', `<p>Alcune tabelle di ${esc(D.name)} sono state modificate e non ancora scaricate.</p><div class="pbtns"><button class="btn pri" id="dc-save">Scarica e chiudi</button><button class="btn dng" id="dc-drop">Chiudi senza scaricare</button></div>`);
      $('dc-save').onclick=()=>{ save(); closeModal(); close(false); };
      $('dc-drop').onclick=()=>{ closeModal(); close(false); };
      return;
    }
    D=null; render(); persist(); if (ask) toast('Documento chiuso: la tabella resta nell\'editor');
  }
  function restore(){
    let d=null; try { d=JSON.parse(localStorage.getItem('tt-doc')||'null'); } catch(e){}
    if (!d || !Array.isArray(d.items) || !d.items.length || d.gaps.length!==d.items.length+1) return false;
    start({...d, orig: Array.isArray(d.orig) && d.orig.length===d.items.length ? d.orig : d.items.slice()}); return true;
  }
  $('tl-items').addEventListener('click', e=>{ const b=e.target.closest('.ti'); if (b) select(+b.dataset.k); });
  $('tl-save').onclick=save; $('tl-close').onclick=()=>close(true);
  return {open, select, update, save, close, restore, split:()=>false, active:()=>!!D, name:()=>D&&D.name, text:()=>D?docText():'', step:d=>D&&select(D.cur+d), count:()=>D?D.items.length:0};
})();
/* piccola resa di una tabella per le anteprime (lista ed esempi) */
function miniTable(text, maxR=5, maxC=5){
  const T=parseAll(text)[0]; if (!T) return '<i style="color:#7b8499;font-size:11px">nessuna tabella</i>';
  const cap=/\\caption\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/.exec(text);
  const strip = t => Render.html(t).replace(/<span class="m" data-tex="([^"]*)">[^<]*<\/span>/g, '<i>$1</i>').replace(/<span class="lbl">[^<]*<\/span>/g,'');
  let h = cap ? `<b>${Render.html(cap[1])}</b>` : `<b>${esc(T.env)} · ${T.rows.length}×${T.ncols}</b>`;
  h+='<table>'+T.rows.slice(0,maxR).map(r=>`<tr class="${r.pre.some(x=>x.k==='rule' && FULL_RULES.has(x.cmd))?'r':''}">`+r.cells.slice(0,maxC).map(c=>`<td${c.mc?` colspan="${Math.min(c.mc.n, maxC)}"`:''}>${strip(c.t)}</td>`).join('')+'</tr>').join('')+'</table>';
  return h;
}
