/* ============ PALETTE TIKZ-CD: oggetti nelle celle, frecce tra le celle ============ */
let cdPick = null;   // {it, first}: elemento della palette attivo e cella di partenza
const CDI = {   // icone 24×16
  obj:'<path d="M8 13l3.5-10h1L16 13M9.5 9h5"/>',
  arrow:'<path d="M3 8h17M16.5 5l3.5 3-3.5 3"/>',
  Rightarrow:'<path d="M3 6.5h14M3 9.5h14M15 3.5l5 4.5-5 4.5"/>',
  hook:'<path d="M6 8h14M16.5 5l3.5 3-3.5 3M6 8a2 2 0 010-4"/>',
  twoheads:'<path d="M3 8h17M16.5 5l3.5 3-3.5 3M12.5 5l3.5 3-3.5 3"/>',
  mapsto:'<path d="M4 5v6M4 8h16M16.5 5l3.5 3-3.5 3"/>',
  dashed:'<path d="M3 8h3M8 8h3M13 8h4M16.5 5l3.5 3-3.5 3"/>',
  equal:'<path d="M3 6.5h18M3 9.5h18"/>',
  iso:'<path d="M3 11h17M16.5 8l3.5 3-3.5 3M8.5 6c1-1.6 2.2-1.6 3.2 0s2.2 1.6 3.2 0"/>',
  bend:'<path d="M3 12C8 2 16 2 21 12M17.4 11.2l3.6.8.2-3.6"/>',
  parallel:'<path d="M3 5.5h17M16.5 3l3.5 2.5-3.5 2.5M3 10.5h17M16.5 8l3.5 2.5-3.5 2.5"/>',
  cross:'<path d="M3 3l18 10M3 13l6.5-3.6M14.5 6.6L21 3"/>',
  pullback:'<path d="M7 4h9v8"/>',
  swap:'<path d="M3 8h18M9 3v3M15 10v3"/>'
};
const CD_PAL = [
  {g:'Oggetti', items:[{l:'Oggetto', i:'obj', m:'cell'}]},
  {g:'Frecce', items:[
    {l:'Freccia', i:'arrow', m:'pick2', o:''},
    {l:'Implicazione', i:'Rightarrow', m:'pick2', o:'Rightarrow'},
    {l:'Inclusione', i:'hook', m:'pick2', o:'hook'},
    {l:'Suriettiva', i:'twoheads', m:'pick2', o:'two heads'},
    {l:'Mapsto', i:'mapsto', m:'pick2', o:'mapsto'},
    {l:'Tratteggiata', i:'dashed', m:'pick2', o:'dashed'},
    {l:'Uguaglianza', i:'equal', m:'pick2', o:'equal', lab:null},
    {l:'Isomorfismo', i:'iso', m:'pick2', o:'', lab:'\\sim'},
    {l:'Curva', i:'bend', m:'pick2', o:'bend left'},
    {l:'Coppia parallela', i:'parallel', m:'pick2', pair:true},
    {l:'Che scavalca', i:'cross', m:'pick2', o:'crossing over'}
  ]},
  {g:'Speciali', items:[
    {l:'Angolo di pullback', i:'pullback', m:'pick2', pull:true},
    {l:'Inverti etichetta', i:'swap', m:'arrow'}
  ]}
];
const cdItemsAll = CD_PAL.flatMap(g=>g.items);
const CD_HEADS = [['','→ rightarrow'],['Rightarrow','⇒ Rightarrow'],['hook','↪ hook'],['two heads','↠ two heads'],['tail','↣ tail'],['mapsto','↦ mapsto'],['leftarrow','← leftarrow'],['leftrightarrow','↔ leftrightarrow'],['equal','= equal'],['dash','— dash'],['squiggly','⇝ squiggly']];
const CD_HEAD_KEYS = new Set([...Object.keys(CD_HEAD), 'squiggly', 'rightarrow']);

/* ---------- pannello ---------- */
function cdPalBuild(){
  $('cdpal-b').innerHTML = CD_PAL.map(g=>`<details open><summary>${esc(g.g)}</summary><div class="pal">`+
    g.items.map(it=>`<button data-c="${cdItemsAll.indexOf(it)}"><svg viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round">${CDI[it.i]||''}</svg><span>${esc(it.l)}</span></button>`).join('')+
    `</div></details>`).join('') + `<p class="palhint">Oggetti: clic su una cella del diagramma (anche fuori dalla griglia: righe e colonne si aggiungono da sole). Frecce: clic sui due oggetti. <b>Esc</b> annulla.</p>`;
}
function cdPalOpen(on){
  if (on) palExclusive('cdpal');
  $('cdpal').hidden=!on; $('b-cd').classList.toggle('on', on); store.set('tz-cdp', on?'1':'');
  if (!on && tool==='cd') setTool('select');
  requestAnimationFrame(()=>applyView());
}
function cdPalSync(){
  if (tool!=='cd') cdPick=null;
  document.querySelectorAll('#cdpal [data-c]').forEach(b=>b.classList.toggle('on', !!cdPick && +b.dataset.c===cdItemsAll.indexOf(cdPick.it)));
}
const cdHint = {cell:'Clic sulla cella dove mettere l\'oggetto', pick2:'Clic sull\'oggetto di partenza', arrow:'Clic sulla freccia'};
cdPalBuild();
$('cdpal-b').addEventListener('click', e=>{
  const b=e.target.closest('[data-c]'); if (!b) return;
  const it=cdItemsAll[+b.dataset.c];
  if (cdPick && cdPick.it===it){ setTool('select'); return; }
  setTool('cd'); cdPick={it, first:null}; cdPalSync();
  hint(cdHint[it.m]+': '+it.l.toLowerCase(), 4000);
});
$('b-cd').onclick=()=>cdPalOpen($('cdpal').hidden);
$('cdpal-x').onclick=()=>cdPalOpen(false);
PALS.push({id:'cdpal', open:on=>cdPalOpen(on)});
if (store.get('tz-cdp') && palsClosed()) cdPalOpen(true);

/* ---------- griglia e sorgente ---------- */
const cdActive = () => !!(lastR && lastR.cd && figs[Math.min(figIdx,figs.length-1)] && figs[Math.min(figIdx,figs.length-1)].env==='tikzcd');
/* crea un diagramma vuoto se la figura corrente non è un tikzcd */
function cdEnsure(){
  if (cdActive()) return;
  addFigure('\\begin{tikzcd}\n\\end{tikzcd}\n');
  toast('Nuovo diagramma tikz-cd'+(figs.length>1?` (figura ${figs.length})`:''));
}
/* riga e colonna (da 1) sotto il punto; fuori dalla griglia valori < 1 o oltre l'ultima */
function cdSlot(page){
  const g=lastR.cd;
  const pick = (vals, v, step, sign) => {
    if (!vals.length) return 1;
    const p = vals.length>1 ? (vals[vals.length-1]-vals[0])/(vals.length-1) : step*sign;
    const k = Math.round((v-vals[0])/p);
    if (k>=0 && k<vals.length){ let best=0; vals.forEach((x,j)=>{ if (Math.abs(x-v)<Math.abs(vals[best]-v)) best=j; }); return best+1; }
    return k+1;
  };
  return {c:pick(g.xs, page[0], 1.6, 1), r:pick(g.ys, page[1], 1.2, -1)};
}
function cdCellAt(page, hi){
  const g=lastR.cd;
  if (hi && hi.stmt!==undefined){ const st=lastR.stmts[hi.stmt]; if (st && st.cd && st.cd.cell) return g.cells[st.cd.r+'-'+st.cd.c]; }
  const s=cdSlot(page); return g.cells[s.r+'-'+s.c] || null;
}
function cdIndent(){
  const g=lastR.cd; const c0=g.rows.length && g.rows[0].cells[0];
  if (c0){ const ls=src.lastIndexOf('\n', c0.start-1)+1; const ind=/^[ \t]*/.exec(src.slice(ls))[0]; if (ls>=g.bodyS) return ind; }
  return '  ';
}
/* testo della cella (r,c) da 1: aggiunge righe e colonne se servono; null se la cella è occupata */
function cdPutCell(r, c, text){
  const g=lastR.cd, rows=g.rows, ind=cdIndent();
  if (!rows.length){
    const body = '\n'+ind+Array(Math.max(1,r)-1).fill('\\\\').map(x=>x+'\n'+ind).join('')+'& '.repeat(Math.max(1,c)-1)+text+'\n';
    return src.slice(0,g.bodyS)+body+src.slice(g.bodyE).replace(/^[ \t]*\n?/,'');
  }
  const ins = {};   // posizione → testo (gli inserimenti nello stesso punto si concatenano)
  const add = (p, t) => { ins[p]=(ins[p]||'')+t; };
  const colShift=Math.max(0,1-c), rowShift=Math.max(0,1-r); c+=colShift; r+=rowShift;
  const first=rows[0].cells[0].start;
  if (rowShift){
    const lines=[]; for (let k=1;k<=rowShift;k++) lines.push(k===r ? '& '.repeat(c-1)+text : '');
    add(first, lines.join(' \\\\\n'+ind)+' \\\\\n'+ind);
  }
  rows.forEach((row,ri)=>{
    const target = r-rowShift-1===ri;
    if (colShift) add(row.cells[0].start, target ? text+' '+'& '.repeat(colShift) : '& '.repeat(colShift));
  });
  const ri=r-rowShift-1;
  if (ri>=0 && !colShift){
    if (ri<rows.length){
      const row=rows[ri], n=row.cells.length;
      if (c<=n){
        const cl=row.cells[c-1];
        if (cl.node) return null;
        const p=cl.start, before=src[p-1]||' ', after=src[p]||' ';
        add(p, (/\s/.test(before)?'':' ')+text+(/\s/.test(after)?'':' '));
      } else add(row.cells[n-1].end, ' &'.repeat(c-n)+' '+text);
    } else {
      const last=rows[rows.length-1]; const end=last.cells[last.cells.length-1].end;
      add(end, ' \\\\'+('\n'+ind+'\\\\').repeat(ri-rows.length)+'\n'+ind+'& '.repeat(c-1)+text);
    }
  }
  let t=src; for (const p of Object.keys(ins).map(Number).sort((a,b)=>b-a)) t=t.slice(0,p)+ins[p]+t.slice(p);
  return t;
}
function cdNextObj(){
  const used=new Set(Object.values(lastR.cd.cells).map(c=>src.slice(c.tspan?c.tspan.s:0, c.tspan?c.tspan.e:0).trim()));
  for (const l of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(l)) return l;
  return 'X';
}
function cdNextLabel(skip=''){
  const f=figs[Math.min(figIdx,figs.length-1)], body=f?src.slice(f.s,f.e):src;
  for (const l of ['f','g','h','k','p','q','u','v','\\alpha','\\beta']) if (l!==skip && !body.includes(`"${l}"`)) return l;
  return 'f';
}
function cdDir(a, b){
  const dr=b.r-a.r, dc=b.c-a.c;
  return (dr>0?'d'.repeat(dr):'u'.repeat(-dr))+(dc>0?'r'.repeat(dc):'l'.repeat(-dc));
}
function cdArrowCode(it, a, b){
  const dir=cdDir(a,b), lab=it.lab===undefined ? cdNextLabel() : it.lab;
  const q = s => /[,=\]]/.test(s) ? `"{${s}}"` : `"${s}"`;
  if (!dir) return `\\arrow[loop right${lab?', '+q(lab):''}]`;
  if (it.pull) return `\\arrow[${dir}, phantom, "\\lrcorner", very near start]`;
  if (it.pair) return `\\arrow[${dir}, shift left, ${q(lab)}] \\arrow[${dir}, shift right, ${q(cdNextLabel(lab))}']`;
  return `\\arrow[${[dir, it.o, lab ? q(lab) : ''].filter(Boolean).join(', ')}]`;
}

/* ---------- clic sul disegno ---------- */
function cdCanvasClick(page, hi){
  const it=cdPick && cdPick.it; if (!it){ setTool('select'); return; }
  if (it.m==='cell'){
    cdEnsure();
    const s=cdSlot(page), text=cdNextObj();
    const t=cdPutCell(s.r, s.c, text);
    if (t===null){ hint('La cella è già occupata: scegline una vuota', 2500); return; }
    setSource(t); setTool('select');
    requestAnimationFrame(()=>{ const n=lastR.nodes.findIndex(nd=>nd.text && src.slice(nd.text.s,nd.text.e)===text && lastR.stmts[nd.stmt].cd); if (n>=0){ selStart=lastR.stmts[lastR.nodes[n].stmt].start; updateHL(); drawOverlay(); updateProps(); inlineEdit(n); } });
    return;
  }
  if (!cdActive()){ hint('Prima inserisci gli oggetti del diagramma', 2500); return; }
  if (it.m==='arrow'){
    const st = hi.stmt!==undefined ? lastR.stmts[hi.stmt] : null;
    if (!st || st.cmd!=='arrow'){ hint('Clic su una freccia', 2500); return; }
    const has = optItems(st).includes('swap');
    setSource(setOptions(hi.stmt, {remove:(x,k)=>k==='swap', add: has?[]:['swap']}));
    toast('Etichetta spostata dall\'altro lato'); setTool('select'); return;
  }
  const cell=cdCellAt(page, hi);
  if (!cell){ hint('Clic su un oggetto del diagramma', 2500); return; }
  if (!cdPick.first){
    cdPick.first=cell; const k=lastR.stmts.findIndex(x=>x.cd && x.cd.cell && x.cd.r===cell.r && x.cd.c===cell.c);
    if (k>=0){ selStart=lastR.stmts[k].start; selNode=null; updateHL(); drawOverlay(); }
    hint('Ora clic sull\'oggetto di arrivo', 4000); return;
  }
  const a=cdPick.first, code=cdArrowCode(it, a, cell);
  const g=lastR.cd, from=g.rows[a.r-1].cells[a.c-1];
  setSource(src.slice(0,from.end)+' '+code+src.slice(from.end));
  setTool('select');
}

/* ---------- pannello proprietà ---------- */
function cdPropsHTML(si, st, items, sel){
  if (st.cd.cell) return `<label class="full" for="cd-text">oggetto (modo matematico)</label><textarea id="cd-text">${esc(src.slice(st.text.s, st.text.e))}</textarea>`;
  const head = items.find(i=>CD_HEAD_KEYS.has(itemKey(i)) && !i.includes('=')) || '';
  const bend = items.find(i=>/^bend (left|right)/.test(i)) || '';
  const shift = items.find(i=>/^shift (left|right)$/.test(i)) || '';
  const dash = items.find(i=>/^(dashed|dotted)$/.test(i)) || '';
  const dir = items.find(i=>CD_DIR_RE.test(i)) || '';
  let h = `<label for="cd-lab">etichetta</label><input type="text" id="cd-lab" value="${esc(st.label ? src.slice(st.label.s, st.label.e) : '')}" placeholder="es. f">`;
  h += `<label for="cd-swap">dall'altro lato</label><input type="checkbox" id="cd-swap"${cdSwapped(st, items)?' checked':''}>`;
  h += `<label for="cd-head">tipo</label>`+sel('cd-head', CD_HEADS, head);
  h += `<label for="cd-dash">tratto</label>`+sel('cd-dash', [['','continuo'],['dashed','tratteggiato'],['dotted','punteggiato']], dash);
  h += `<label for="cd-bend">percorso</label>`+sel('cd-bend', [['','dritto'],['bend left','curvo a sinistra'],['bend right','curvo a destra']], bend);
  h += `<label for="cd-shift">spostamento</label>`+sel('cd-shift', [['','nessuno'],['shift left','a sinistra'],['shift right','a destra']], shift);
  if (dir) h += `<label for="cd-dir">direzione</label><input type="text" id="cd-dir" value="${esc(dir)}" placeholder="r, d, dr…">`;
  h += `<label>colore</label>`+swatches('acol', (items.find(isBareColor)||'').trim(), false);
  return h;
}
/* posizione dell'apice ' dopo la prima etichetta "…" */
function cdQuoteEnd(st){
  if (!st.label) return -1;
  let q=st.label.e; if (src[q]==='}') q++;
  return src[q]==='"' ? q+1 : -1;
}
function cdSwapped(st, items){ const q=cdQuoteEnd(st); return items.includes('swap') !== (q>=0 && src[q]==="'"); }
function cdWireProps(si, st, items){
  const apply = t => { if (t!==src) setSource(t); };
  const on = (id, fn, ev='change') => { const el=$(id); if (el) el.addEventListener(ev, ()=>fn(el.value, el)); };
  on('cd-text', v=>{ const s=st.text; src=src.slice(0,s.s)+v+src.slice(s.e); ed.value=src; store.set('tz-src',src); renderNow(); }, 'input');
  on('cd-lab', v=>{
    v=v.trim();
    if (st.label){ const br = src[st.label.s-1]==='{'; const t = !br && /[,=\]]/.test(v) ? '{'+v+'}' : v; apply(src.slice(0,st.label.s)+t+src.slice(st.label.e)); }
    else if (v) apply(setOptions(si, {add:[/[,=\]]/.test(v) ? `"{${v}}"` : `"${v}"`]}));
  });
  on('cd-swap', ()=>{
    if (items.includes('swap')){ apply(setOptions(si, {remove:(x,k)=>k==='swap'})); return; }
    const q=cdQuoteEnd(st);
    if (q>=0 && src[q]==="'") apply(src.slice(0,q)+src.slice(q+1));
    else if (q>=0) apply(src.slice(0,q)+"'"+src.slice(q));
    else apply(setOptions(si, {add:['swap']}));
  });
  on('cd-head', v=>apply(setOptions(si, {remove:(x,k)=>CD_HEAD_KEYS.has(k) && !x.includes('='), add:v?[v]:[]})));
  on('cd-dash', v=>apply(setOptions(si, {remove:(x,k)=>/^(dashed|dotted)$/.test(k), add:v?[v]:[]})));
  on('cd-bend', v=>apply(setOptions(si, {remove:(x,k)=>/^bend (left|right)$/.test(k), add:v?[v]:[]})));
  on('cd-shift', v=>apply(setOptions(si, {remove:(x,k)=>/^shift (left|right)$/.test(k), add:v?[v]:[]})));
  on('cd-dir', v=>{ v=v.trim(); if (!CD_DIR_RE.test(v)){ toast('Direzione: lettere r, l, u, d (es. dr)'); return; } apply(setOptions(si, {remove:(x,k)=>CD_DIR_RE.test(k) && !x.includes('='), add:[v]})); });
}
