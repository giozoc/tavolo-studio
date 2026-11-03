/* ============ PALETTE AUTOMI: inserimento di stati e transizioni (libreria automata) ============ */
let autPick = null;   // {it, first}: elemento della palette attivo e primo stato scelto
const AI = {   // icone 24×16
  state:'<circle cx="12" cy="8" r="6"/>',
  init:'<path d="M1 8h6M5 6l2 2-2 2"/><circle cx="14" cy="8" r="6"/>',
  acc:'<circle cx="12" cy="8" r="6.5"/><circle cx="12" cy="8" r="4.5"/>',
  initacc:'<path d="M1 8h5M4 6l2 2-2 2"/><circle cx="14" cy="8" r="6.5"/><circle cx="14" cy="8" r="4.5"/>',
  trans:'<circle cx="4" cy="8" r="3"/><circle cx="20" cy="8" r="3"/><path d="M7 8h9M14 6l2 2-2 2"/>',
  bend:'<circle cx="4" cy="11" r="3"/><circle cx="20" cy="11" r="3"/><path d="M6 8.5C9 3 15 3 18 8.5M15.5 7.5l2.5 1 .3-2.7"/>',
  loop:'<circle cx="12" cy="11" r="4"/><path d="M10 7.5C7 1 17 1 14 7.5M12.5 6l1.5 1.5 1-2"/>',
  mkinit:'<path d="M1 8h6M5 6l2 2-2 2"/><circle cx="14" cy="8" r="6" stroke-dasharray="2 1.5"/>',
  mkacc:'<circle cx="12" cy="8" r="6.5" stroke-dasharray="2 1.5"/><circle cx="12" cy="8" r="4.5"/>'
};
const ap = p => `(${fmt(p[0],2)},${fmt(p[1],2)})`;
const autState = opts => (p,n) => { const q=n(); return `\\node[${opts}] (${q}) at ${ap(p)} {$q_${q.length>2 ? `{${q.slice(1)}}` : q.slice(1)}$};`; };
const AUT_PAL = [
  {g:'Stati', items:[
    {l:'Stato', i:'state', m:'place', c:autState('state')},
    {l:'Stato iniziale', i:'init', m:'place', c:autState('state, initial')},
    {l:'Stato accettante', i:'acc', m:'place', c:autState('state, accepting')},
    {l:'Iniziale e accettante', i:'initacc', m:'place', c:autState('state, initial, accepting')}
  ]},
  {g:'Transizioni', items:[
    {l:'Transizione', i:'trans', m:'pick2', c:(a,b)=>`\\path[->] (${a}) edge node[auto] {$a$} (${b});`},
    {l:'Transizione curva', i:'bend', m:'pick2', c:(a,b)=>`\\path[->] (${a}) edge[bend left] node[auto] {$a$} (${b});`},
    {l:'Cappio', i:'loop', m:'pick1', c:a=>`\\path[->] (${a}) edge[loop above] node[auto] {$a$} ();`}
  ]},
  {g:'Modifica', items:[
    {l:'Iniziale sì/no', i:'mkinit', m:'toggle', k:'initial'},
    {l:'Accettante sì/no', i:'mkacc', m:'toggle', k:'accepting'}
  ]}
];
const autItems = AUT_PAL.flatMap(g=>g.items);

/* ---------- pannello ---------- */
function autPalBuild(){
  $('autpal-b').innerHTML = AUT_PAL.map(g=>`<details open><summary>${esc(g.g)}</summary><div class="pal">`+
    g.items.map(it=>`<button data-a="${autItems.indexOf(it)}"><svg viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">${AI[it.i]||''}</svg><span>${esc(it.l)}</span></button>`).join('')+
    `</div></details>`).join('') + `<p class="palhint">Stati: clic sul disegno. Transizioni: clic sui due stati da collegare. Cappi e modifiche: clic sullo stato. <b>Esc</b> annulla.</p>`;
}
function autPalOpen(on){
  if (on) palExclusive('autpal');
  $('autpal').hidden=!on; $('b-aut').classList.toggle('on', on); store.set('tz-aut', on?'1':'');
  if (!on && tool==='automa') setTool('select');
  requestAnimationFrame(()=>applyView());
}
function autPalSync(){
  if (tool!=='automa') autPick=null;
  document.querySelectorAll('#autpal [data-a]').forEach(b=>b.classList.toggle('on', !!autPick && +b.dataset.a===autItems.indexOf(autPick.it)));
}
const autHint = {place:'Clic sul disegno per inserire', pick1:'Clic sullo stato', pick2:'Clic sullo stato di partenza', toggle:'Clic sullo stato da modificare'};
autPalBuild();
$('autpal-b').addEventListener('click', e=>{
  const b=e.target.closest('[data-a]'); if (!b) return;
  const it=autItems[+b.dataset.a];
  if (autPick && autPick.it===it){ setTool('select'); return; }
  setTool('automa'); autPick={it, first:null}; autPalSync();
  hint(autHint[it.m]+': '+it.l.toLowerCase(), 4000);
});
$('b-aut').onclick=()=>autPalOpen($('autpal').hidden);
$('autpal-x').onclick=()=>autPalOpen(false);
PALS.push({id:'autpal', open:on=>autPalOpen(on)});
if (store.get('tz-aut') && palsClosed()) autPalOpen(true);

/* ---------- inserimento ---------- */
function autFresh(){
  const used=new Set(Object.keys(lastR ? lastR.names : {}));
  let k=0; while (used.has('q'+k) || src.includes('(q'+k+')')) k++;
  return 'q'+k;
}
/* stato colpito dal clic: nome del nodo (lo aggiunge al sorgente se manca) */
function autHitState(hi){
  if (hi.node===null || hi.node===undefined) return null;
  const r=nodeNameFor(hi.node); if (!r) return null;
  if (r.edit) setSource(applyEdits(src, [r.edit]));
  const idx=lastR.nodes.findIndex(n=>n.name===r.name);
  return idx<0 ? null : {name:r.name, idx, nd:lastR.nodes[idx]};
}
function autCanvasClick(page, hi){
  const it=autPick && autPick.it; if (!it){ setTool('select'); return; }
  const m=it.m;
  if (m==='place'){ insertStmt(it.c(snapPage(page), autFresh)); setTool('select'); return; }
  const hit=autHitState(hi);
  if (!hit){ hint('Clic su uno stato', 2500); return; }
  if (m==='toggle'){
    const re = it.k==='initial' ? AUT_INIT_RE : AUT_ACC_RE;
    const had=nodeItems(hit.idx).some(x=>re.test(x));
    setSource(setNodeOpts(hit.idx, {remove:(x,k)=>re.test(k), add: had ? [] : [it.k]}));
    toast(`«${hit.name}» ${had?'non è più':'ora è'} ${it.k==='initial'?'iniziale':'accettante'}`);
    setTool('select'); return;
  }
  if (m==='pick1'){ insertStmt(it.c(hit.name)); setTool('select'); return; }
  if (!autPick.first){
    autPick.first=hit.name; selStart=lastR.stmts[hit.nd.stmt].start; selNode=null; updateHL(); drawOverlay();
    hint(`Da «${hit.name}»: ora clic sullo stato di arrivo`, 4000); return;
  }
  insertStmt(it.c(autPick.first, hit.name));
  setTool('select');
}
