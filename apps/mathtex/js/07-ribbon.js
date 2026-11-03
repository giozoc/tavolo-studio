/* ============ BARRA MULTIFUNZIONE: strutture, gallerie, simboli ============
   Organizzazione ispirata all'editor di equazioni di Word (Strumenti · Simboli · Strutture), aspetto di Tavolo TikZ.
   Ogni pulsante inserisce un modello nel punto del cursore della formula o del sorgente (l'ultimo pannello usato). */
const Ribbon = (()=>{
  const pop=$('pop');
  let popFor=null;

  /* i pulsanti non rubano il fuoco: il cursore resta nella formula o nel codice */
  const keepFocus = el => el.addEventListener('pointerdown', e=>{ if (e.target.closest('button')) e.preventDefault(); });
  keepFocus($('ribbon')); keepFocus(pop);

  /* ---------- strutture ---------- */
  const sb=$('structs');
  sb.innerHTML = Catalog.STRUCTS.map(s=>`<button class="big" data-st="${s.id}" title="${esc(s.l)} — ${esc(s.d)} (Alt+${s.key})" aria-haspopup="dialog"><span class="bi" data-tex="${esc(s.icon)}"><span class="mjx-pending">${esc(s.l[0])}</span></span><span class="bl">${esc(s.l)}&nbsp;<i class="dd"></i></span></button>`).join('');
  sb.addEventListener('click', e=>{ const b=e.target.closest('[data-st]'); if (b) toggle(b.dataset.st, b); });

  function itemHTML(it, k){
    const tex = it.v || previewTex(it.t);
    return `<button class="gi" data-tpl="${esc(it.t)}"${it.s?` data-font="${k}"`:''} title="${esc(it.l)} — ${esc(it.t.replace(/#[0?]/g,'□'))}"><span class="gv" data-tex="${esc(tex)}"><span class="mjx-pending">…</span></span><span class="gl">${esc(it.l)}</span></button>`;
  }
  function structHTML(st){
    let h='';
    for (const sec of st.secs){
      h+=`<div class="gh"><span>${esc(sec.title)}</span></div><div class="gg">${sec.items.map(it=>itemHTML(it)).join('')}</div>`;
      if (sec.note) h+=`<div class="gnote">${esc(sec.note)}</div>`;
    }
    if (st.custom) h+=`<div class="gh"><span>Matrice personalizzata</span></div>
      <div class="gform">
        <label for="mx-r">Righe</label><input id="mx-r" type="number" min="1" max="20" value="3">
        <label for="mx-c">Colonne</label><input id="mx-c" type="number" min="1" max="20" value="3">
        <label for="mx-t">Tipo</label><select id="mx-t"><option value="pmatrix">( ) tonde — pmatrix</option><option value="bmatrix">[ ] quadre — bmatrix</option><option value="Bmatrix">{ } graffe — Bmatrix</option><option value="vmatrix">| | determinante — vmatrix</option><option value="Vmatrix">‖ ‖ norma — Vmatrix</option><option value="matrix">senza parentesi — matrix</option><option value="cases">sistema — cases</option></select>
        <button class="btn pri" id="mx-go">Inserisci matrice</button>
      </div>`;
    return h;
  }
  function symsHTML(){
    return Catalog.SYMS.map(g=>`<div class="gh"><span>${esc(g.l)}</span></div><div class="gg syms">${g.s.map(([c,n])=>`<button class="gi" data-tpl="${esc(c)}" title="${esc(n)} — ${esc(c)}"><span class="gv" data-tex="${esc(c)}"><span class="mjx-pending">${esc(c.replace(/^\\/,''))}</span></span><span class="gl">${esc(n)}</span></button>`).join('')}</div>`).join('');
  }
  function listHTML(items, title, note){
    return `<div class="gh"><span>${esc(title)}</span></div><div class="gg">${items.map((it,k)=>itemHTML(it,k)).join('')}</div>`+(note?`<div class="gnote">${note}</div>`:'');
  }
  function open(id, anchor, viaKeyboard){
    let h='';
    if (id==='syms') h=symsHTML();
    else if (id==='spaces') h=listHTML(Catalog.SPACES, 'Spazi', 'In modalità matematica gli spazi digitati vengono ignorati: si usano questi comandi. Nella formula si possono anche digitare: premi <code>\\</code>, scrivi <code>quad</code> e poi Invio.');
    else if (id==='fonts') h=listHTML(Catalog.FONTS, 'Stili di carattere', 'Si applicano alla selezione o a ciò che scrivi dopo. <code>\\mathbb</code> e <code>\\mathfrak</code> richiedono <code>amssymb</code>.');
    else { const st=Catalog.STRUCTS.find(s=>s.id===id); if (!st) return; h=structHTML(st); }
    pop.innerHTML=h; pop.hidden=false; popFor=id;
    document.querySelectorAll('#ribbon .on').forEach(b=>b.classList.remove('on'));
    if (anchor) anchor.classList.add('on');
    place(anchor);
    MJ.fill(pop);
    if (id==='mat'){ const go=$('mx-go'); go.onclick=()=>{ insertMatrix(+$('mx-r').value, +$('mx-c').value, $('mx-t').value); }; }
    if (viaKeyboard){ const f=pop.querySelector('.gi'); f&&f.focus(); }
  }
  function place(anchor){
    const r = anchor ? anchor.getBoundingClientRect() : $('ribbon').getBoundingClientRect();
    const w = pop.offsetWidth;
    pop.style.left = clamp(r.left, 8, window.innerWidth-w-8)+'px';
    pop.style.top = (r.bottom+4)+'px';
    pop.style.maxHeight = Math.max(200, window.innerHeight-r.bottom-16)+'px';
  }
  function close(refocus=true){
    if (pop.hidden) return;
    pop.hidden=true; popFor=null; pop.innerHTML='';
    document.querySelectorAll('#ribbon .on').forEach(b=>b.classList.remove('on'));
    if (refocus) MF.focus();
  }
  function toggle(id, anchor, kb){ if (popFor===id) close(); else open(id, anchor, kb); }
  pop.addEventListener('click', e=>{ const b=e.target.closest('.gi'); if (!b) return; close(false); if (b.dataset.font) MF.applyFont(Catalog.FONTS[+b.dataset.font]); else MF.insert(b.dataset.tpl); });
  pop.addEventListener('keydown', e=>{
    if (e.key==='Escape'){ e.preventDefault(); close(); return; }
    if (e.target.closest('.gform')) return;
    const items=[...pop.querySelectorAll('.gi')]; const k=items.indexOf(document.activeElement); if (k<0) return;
    const cols = Math.max(1, Math.round(pop.querySelector('.gg').clientWidth / (items[0].offsetWidth+4)));
    const mv = {ArrowRight:1, ArrowLeft:-1, ArrowDown:cols, ArrowUp:-cols}[e.key];
    if (mv){ e.preventDefault(); items[clamp(k+mv,0,items.length-1)].focus(); }
  });
  document.addEventListener('pointerdown', e=>{ if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('#ribbon [data-st],#ribbon [data-pop],#b-symmore')) close(false); });
  window.addEventListener('resize', ()=>close(false));
  $('ribbon').addEventListener('scroll', ()=>close(false));

  function insertMatrix(r, c, type){
    r=clamp(r|0,1,20); c=clamp(c|0,1,20);
    let first=true; const cell=()=>{ const t=first?'#0':'#?'; first=false; return t; };
    const rows=[];
    for (let i=0;i<r;i++){ const cells=[]; for (let j=0;j<(type==='cases'?Math.min(c,2):c);j++) cells.push(cell()); rows.push(cells.join(' & ')); }
    close(false);
    MF.insert(`\\begin{${type}}${rows.join('\\\\ ')}\\end{${type}}`);
  }

  /* ---------- strumenti ---------- */
  $('ribbon').addEventListener('click', e=>{ const b=e.target.closest('[data-pop]'); if (b) toggle(b.dataset.pop, b); });
  const TEXT = Catalog.FONTS.find(f=>f.s.text);
  $('b-text').onclick=()=>MF.applyFont(TEXT);
  $('envsel').addEventListener('change', e=>{
    const v=e.target.value; setSource(rewrap(St.src, v)); toast(v ? 'Delimitatori: '+e.target.selectedOptions[0].textContent : 'Delimitatori rimossi'); MF.focus();
  });
  $('stylesel').addEventListener('change', e=>{ MF.setDisplay(e.target.value==='display'); store.set('tl-style', e.target.value); MF.focus(); });
  { const s=store.get('tl-style'); if (s==='inline'){ $('stylesel').value='inline'; } }

  /* ---------- simboli ---------- */
  const cat=$('symcat'), grid=$('symgrid');
  cat.innerHTML = Catalog.SYMS.map(g=>`<option value="${g.id}">${esc(g.l)}</option>`).join('');
  function showCat(id){
    const g=Catalog.SYMS.find(x=>x.id===id)||Catalog.SYMS[0];
    grid.innerHTML = g.s.map(([c,n])=>`<button class="sym" role="option" data-tpl="${esc(c)}" title="${esc(n)} — ${esc(c)}"><span data-tex="${esc(c)}"><span class="mjx-pending">${esc(c.replace(/^\\/,'').slice(0,3))}</span></span></button>`).join('');
    grid.scrollTop=0; MJ.fill(grid); store.set('tl-symcat', g.id);
  }
  cat.addEventListener('change', ()=>{ showCat(cat.value); MF.focus(); });
  grid.addEventListener('click', e=>{ const b=e.target.closest('[data-tpl]'); if (b) MF.insert(b.dataset.tpl); });
  $('b-symmore').onclick=e=>toggle('syms', $('b-symmore'));
  { const s=store.get('tl-symcat'); if (s && Catalog.SYMS.some(g=>g.id===s)) cat.value=s; showCat(cat.value); }

  MJ.fill($('structs'));
  return {open, close, toggle, insertMatrix, isOpen:()=>!pop.hidden};
})();
