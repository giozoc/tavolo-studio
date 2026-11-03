/* ============ PALETTE UML: inserimento degli elementi tikz-uml ============ */
let umlPick = null;   // {it, first}: elemento della palette attivo e primo elemento scelto
const UML_BOXES = /^(umlpackage|umlsystem|umlstate|umlcomponent)$/;
const UI = {   // icone 24×16
  class:'<rect x="5" y="1.5" width="14" height="13"/><path d="M5 6h14M5 10h14"/>',
  abstract:'<rect x="5" y="1.5" width="14" height="13" stroke-dasharray="2 1.5"/><path d="M5 6h14M5 10h14"/>',
  interface:'<rect x="5" y="3.5" width="14" height="11"/><path d="M5 8h14"/><circle cx="12" cy="2" r="1.2"/>',
  enum:'<rect x="5" y="1.5" width="14" height="13"/><path d="M5 6h14M8 9h8M8 12h8"/>',
  simple:'<rect x="5" y="4" width="14" height="8"/>',
  note:'<path d="M5 2h10l4 4v8H5zM15 2v4h4"/>',
  package:'<path d="M3 5h18v10H3zM3 5V2h8v3"/>',
  line:'<path d="M2 8h20"/>',
  arrow:'<path d="M2 8h19M16 4.5l5 3.5-5 3.5"/>',
  odia:'<path d="M2 8l4-3 4 3-4 3zM10 8h12"/>',
  fdia:'<path d="M2 8l4-3 4 3-4 3z" fill="currentColor"/><path d="M10 8h12"/>',
  tri:'<path d="M2 8h14M16 4v8l6-4z"/>',
  dtri:'<path d="M2 8h14" stroke-dasharray="2.5 2"/><path d="M16 4v8l6-4z"/>',
  darrow:'<path d="M2 8h19" stroke-dasharray="2.5 2"/><path d="M16 4.5l5 3.5-5 3.5"/>',
  nest:'<path d="M2 8h14"/><circle cx="19" cy="8" r="3"/><path d="M16 8h6M19 5v6"/>',
  actor:'<circle cx="12" cy="3" r="1.8"/><path d="M12 5v5M8 7h8M9 15l3-5 3 5"/>',
  usecase:'<ellipse cx="12" cy="8" rx="9" ry="5"/>',
  system:'<rect x="3" y="2" width="18" height="12"/><path d="M9 4.5h6"/>',
  sinit:'<circle cx="12" cy="8" r="4" fill="currentColor"/>',
  state:'<rect x="4" y="3" width="16" height="10" rx="3.5"/>',
  sfinal:'<circle cx="12" cy="8" r="5"/><circle cx="12" cy="8" r="2.8" fill="currentColor"/>',
  decision:'<path d="M12 2l6 6-6 6-6-6z"/>',
  cstate:'<rect x="2" y="1.5" width="20" height="13" rx="3"/><path d="M2 5.5h20"/>',
  seq:'<rect x="2" y="1.5" width="8" height="4"/><rect x="14" y="1.5" width="8" height="4"/><path d="M6 6v9M18 6v9" stroke-dasharray="1.5 1.5"/><path d="M6 10h11M15 8.5l2 1.5-2 1.5"/>',
  object:'<rect x="5" y="1.5" width="14" height="5"/><path d="M12 7v8" stroke-dasharray="1.5 1.5"/>',
  database:'<ellipse cx="12" cy="3.5" rx="6" ry="2"/><path d="M6 3.5v9a6 2 0 0012 0v-9"/>',
  entity:'<circle cx="12" cy="7" r="5"/><path d="M6 14h12"/>',
  boundary:'<circle cx="14" cy="8" r="5"/><path d="M3 3v10M3 8h6"/>',
  control:'<circle cx="12" cy="9" r="5"/><path d="M12 4l-2.5-2M12 4l-2.5 2"/>',
  call:'<path d="M5 2v12M19 2v12" stroke-dasharray="1.5 1.5"/><path d="M5 6h12"/><path d="M16 4v4l3-2z" fill="currentColor"/><path d="M19 11H7M9 9l-2 2 2 2" stroke-dasharray="2 1.5"/>',
  callself:'<path d="M7 2v12" stroke-dasharray="1.5 1.5"/><path d="M8 4h9v6H10M12 8l-2 2 2 2"/>',
  create:'<path d="M2 8h9" stroke-dasharray="2.5 2"/><path d="M8 5.5l3 2.5-3 2.5"/><rect x="13" y="4" width="9" height="8"/>',
  fragment:'<rect x="2" y="2" width="20" height="12"/><path d="M2 6h6l1.5-1.5V2"/>',
  component:'<rect x="3" y="3" width="18" height="11"/><rect x="15" y="4.5" width="4" height="5"/><path d="M14 5.5h2M14 8h2"/>',
  ccomp:'<rect x="2" y="1.5" width="20" height="13"/><rect x="5" y="6" width="9" height="6"/><rect x="17" y="3" width="3" height="4"/>',
  provided:'<path d="M2 8h14"/><circle cx="19" cy="8" r="3"/>',
  required:'<path d="M2 8h14M21 4.5a3.5 3.5 0 000 7"/>',
  port:'<rect x="3" y="3" width="12" height="10"/><rect x="13" y="6" width="4" height="4" fill="currentColor"/>',
  assembly:'<path d="M2 8h8M16 8h6"/><circle cx="12" cy="8" r="2"/><path d="M14.5 4.5a3.5 3.5 0 010 7"/>'
};
const pp = p => `x=${fmt(p[0],2)}, y=${fmt(p[1],2)}`;
const UML_PAL = [
  {g:'Classi', items:[
    {l:'Classe', i:'class', m:'place', c:(p,n)=>`\\umlclass[${pp(p)}]{${n('Classe')}}{+ attributo : int}{+ metodo() : void}`},
    {l:'Classe astratta', i:'abstract', m:'place', c:(p,n)=>`\\umlabstract[${pp(p)}]{${n('Astratta')}}{}{+ metodo() : void}`},
    {l:'Interfaccia', i:'interface', m:'place', c:(p,n)=>`\\umlinterface[${pp(p)}]{${n('Interfaccia')}}{}{+ metodo() : void}`},
    {l:'Enumerazione', i:'enum', m:'place', c:(p,n)=>`\\umlenum[${pp(p)}]{${n('Enum')}}{ROSSO \\\\ VERDE}{}`},
    {l:'Classe semplice', i:'simple', m:'place', c:(p,n)=>`\\umlsimpleclass[${pp(p)}]{${n('Classe')}}`},
    {l:'Pacchetto', i:'package', m:'place', c:(p,n)=>`\\begin{umlpackage}[${pp(p)}]{${n('pacchetto')}}\n\\end{umlpackage}`, h:'Clic dentro il pacchetto per inserirvi altri elementi'},
    {l:'Nota', i:'note', m:'note', c:(p,n,t)=>`\\umlnote[${pp(p)}, width=3cm]{${t||''}}{Nota}`}
  ]},
  {g:'Relazioni', items:[
    {l:'Associazione', i:'line', m:'pick2', c:(a,b)=>`\\umlassoc{${a}}{${b}}`},
    {l:'Associazione orientata', i:'arrow', m:'pick2', c:(a,b)=>`\\umluniassoc{${a}}{${b}}`},
    {l:'Aggregazione', i:'odia', m:'pick2', c:(a,b)=>`\\umlaggreg{${a}}{${b}}`},
    {l:'Composizione', i:'fdia', m:'pick2', c:(a,b)=>`\\umlcompo{${a}}{${b}}`},
    {l:'Ereditarietà', i:'tri', m:'pick2', c:(a,b)=>`\\umlinherit{${a}}{${b}}`},
    {l:'Implementazione', i:'dtri', m:'pick2', c:(a,b)=>`\\umlimpl{${a}}{${b}}`},
    {l:'Dipendenza', i:'darrow', m:'pick2', c:(a,b)=>`\\umldep{${a}}{${b}}`},
    {l:'Import', i:'darrow', m:'pick2', c:(a,b)=>`\\umlimport{${a}}{${b}}`},
    {l:'Annidamento', i:'nest', m:'pick2', c:(a,b)=>`\\umlnest{${a}}{${b}}`}
  ]},
  {g:'Casi d\'uso', items:[
    {l:'Attore', i:'actor', m:'place', c:(p,n)=>`\\umlactor[${pp(p)}]{${n('Attore')}}`},
    {l:'Caso d\'uso', i:'usecase', m:'place', c:(p,n)=>`\\umlusecase[${pp(p)}, name=${n('uc')}]{Caso d'uso}`},
    {l:'Sistema', i:'system', m:'place', c:(p,n)=>`\\begin{umlsystem}[${pp(p)}]{${n('Sistema')}}\n\\end{umlsystem}`, h:'Clic dentro il sistema per inserirvi i casi d\'uso'},
    {l:'Include', i:'darrow', m:'pick2', c:(a,b)=>`\\umlinclude{${a}}{${b}}`},
    {l:'Extend', i:'darrow', m:'pick2', c:(a,b)=>`\\umlextend{${a}}{${b}}`}
  ]},
  {g:'Stati', items:[
    {l:'Stato iniziale', i:'sinit', m:'place', c:(p,n)=>`\\umlstateinitial[${pp(p)}, name=${n('iniziale')}]`},
    {l:'Stato', i:'state', m:'place', c:(p,n)=>`\\umlbasicstate[${pp(p)}, name=${n('stato')}]{Stato}`},
    {l:'Stato finale', i:'sfinal', m:'place', c:(p,n)=>`\\umlstatefinal[${pp(p)}, name=${n('finale')}]`},
    {l:'Decisione', i:'decision', m:'place', c:(p,n)=>`\\umlstatedecision[${pp(p)}, name=${n('decisione')}]`},
    {l:'Stato composto', i:'cstate', m:'place', c:(p,n)=>`\\begin{umlstate}[${pp(p)}, name=${n('composto')}]{Stato composto}\n\\end{umlstate}`, h:'Clic dentro lo stato composto per inserirvi altri stati'},
    {l:'Transizione', i:'arrow', m:'pick2', c:(a,b)=>`\\umltrans[arg=evento]{${a}}{${b}}`}
  ]},
  {g:'Sequenza', items:[
    {l:'Diagramma', i:'seq', m:'place', c:(p,n)=>{ const a=n('a'), b=n('b'); return `\\begin{umlseqdiag}\n  \\umlobject[x=${fmt(p[0],2)}, class=A]{${a}}\n  \\umlobject[x=${fmt(p[0]+3.5,2)}, class=B]{${b}}\n  \\begin{umlcall}[op=metodo(), return=risultato]{${a}}{${b}}\n  \\end{umlcall}\n\\end{umlseqdiag}`; }, h:'Il diagramma di sequenza parte sempre da y = 0'},
    {l:'Oggetto', i:'object', m:'seqplace', c:(p,n)=>`\\umlobject[x=${fmt(p[0],2)}, class=Classe]{${n('ogg')}}`},
    {l:'Attore', i:'actor', m:'seqplace', c:(p,n)=>`\\umlactor[x=${fmt(p[0],2)}]{${n('utente')}}`},
    {l:'Database', i:'database', m:'seqplace', c:(p,n)=>`\\umldatabase[x=${fmt(p[0],2)}, class=DB]{${n('db')}}`},
    {l:'Entità', i:'entity', m:'seqplace', c:(p,n)=>`\\umlentity[x=${fmt(p[0],2)}]{${n('entita')}}`},
    {l:'Boundary', i:'boundary', m:'seqplace', c:(p,n)=>`\\umlboundary[x=${fmt(p[0],2)}]{${n('confine')}}`},
    {l:'Control', i:'control', m:'seqplace', c:(p,n)=>`\\umlcontrol[x=${fmt(p[0],2)}]{${n('controllo')}}`},
    {l:'Chiamata', i:'call', m:'seqpick2', c:(a,b)=>`\\begin{umlcall}[op=metodo(), return=risultato]{${a}}{${b}}\n\\end{umlcall}`},
    {l:'Chiamata a sé', i:'callself', m:'seqpick1', c:a=>`\\begin{umlcallself}[op=metodo()]{${a}}\n\\end{umlcallself}`},
    {l:'Creazione', i:'create', m:'seqpick1', c:(a,b,n)=>`\\umlcreatecall[class=Classe]{${a}}{${n('nuovo')}}`},
    {l:'Frammento', i:'fragment', m:'seqpick2', c:(a,b)=>`\\begin{umlfragment}[type=opt, label=condizione]\n  \\begin{umlcall}[op=metodo()]{${a}}{${b}}\n  \\end{umlcall}\n\\end{umlfragment}`}
  ]},
  {g:'Componenti', items:[
    {l:'Componente', i:'component', m:'place', c:(p,n)=>`\\umlbasiccomponent[${pp(p)}]{${n('Componente')}}`},
    {l:'Componente composto', i:'ccomp', m:'place', c:(p,n)=>`\\begin{umlcomponent}[${pp(p)}]{${n('Sistema')}}\n\\end{umlcomponent}`, h:'Clic dentro il componente per inserirvi altri componenti'},
    {l:'Interfaccia fornita', i:'provided', m:'pick1', c:a=>`\\umlprovidedinterface[interface=I, distance=1.5cm]{${a}}`},
    {l:'Interfaccia richiesta', i:'required', m:'pick1', c:a=>`\\umlrequiredinterface[interface=I, distance=1.5cm]{${a}}`},
    {l:'Porta', i:'port', m:'pick1', c:a=>`\\umlport{${a}}{east}`},
    {l:'Connettore di assemblaggio', i:'assembly', m:'pick2', c:(a,b)=>`\\umlassemblyconnector[interface=I]{${a}}{${b}}`},
    {l:'Connettore di delega', i:'arrow', m:'pick2', c:(a,b)=>`\\umldelegateconnector{${a}}{${b}}`}
  ]}
];
const umlItems = UML_PAL.flatMap(g=>g.items);

/* ---------- pannello ---------- */
function umlCmdOf(it){
  const code = /place|note/.test(it.m) ? it.c([0,0], b=>b, '') : it.c('A', 'B', b=>b);
  return (code.match(/\\(?:begin\{)?(uml[a-zA-Z]+)/)||[])[1]||'';
}
function umlPalBuild(){
  $('umlpal-b').innerHTML = UML_PAL.map(g=>`<details open><summary>${esc(g.g)}</summary><div class="pal">`+
    g.items.map(it=>`<button data-u="${umlItems.indexOf(it)}" title="\\${esc(umlCmdOf(it))}"><svg viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">${UI[it.i]||''}</svg><span>${esc(it.l)}</span></button>`).join('')+
    `</div></details>`).join('') + `<p class="palhint">Elementi: clic sul disegno. Relazioni e chiamate: clic sui due elementi da collegare. <b>Esc</b> annulla.</p>`;
}
/* i pannelli degli elementi (UML, automi, tikz-cd, circuiti) si escludono a vicenda */
const PALS = [];
function palExclusive(id){ for (const p of PALS) if (p.id!==id && !$(p.id).hidden) p.open(false); }
const palsClosed = () => PALS.every(p=>$(p.id).hidden);
PALS.push({id:'umlpal', open:on=>umlPalOpen(on)});
function umlPalOpen(on){
  if (on) palExclusive('umlpal');
  $('umlpal').hidden=!on; $('b-uml').classList.toggle('on', on); store.set('tz-uml', on?'1':'');
  if (!on && tool==='uml') setTool('select');
  requestAnimationFrame(()=>applyView());
}
function umlPalSync(){
  if (tool!=='uml') umlPick=null;
  document.querySelectorAll('#umlpal [data-u]').forEach(b=>b.classList.toggle('on', !!umlPick && +b.dataset.u===umlItems.indexOf(umlPick.it)));
}
const umlHint = {place:'Clic sul disegno per inserire', note:'Clic su un elemento per collegarvi la nota, o su un punto vuoto', seqplace:'Clic sul disegno per scegliere la posizione orizzontale',
  pick1:'Clic sull\'elemento', seqpick1:'Clic sull\'oggetto', pick2:'Clic sull\'elemento di partenza', seqpick2:'Clic sull\'oggetto che chiama'};
$('umlpal-b') && umlPalBuild();
$('umlpal-b').addEventListener('click', e=>{
  const b=e.target.closest('[data-u]'); if (!b) return;
  const it=umlItems[+b.dataset.u];
  if (umlPick && umlPick.it===it){ setTool('select'); return; }
  setTool('uml'); umlPick={it, first:null}; umlPalSync();
  hint(umlHint[it.m]+': '+it.l.toLowerCase(), 4000);
});
$('b-uml').onclick=()=>umlPalOpen($('umlpal').hidden);
$('umlpal-x').onclick=()=>umlPalOpen(false);
if (store.get('tz-uml')) umlPalOpen(true);

/* ---------- inserimento ---------- */
function umlFresh(base){
  const used=new Set(Object.keys(lastR ? lastR.names : {}));
  let k=1; while (used.has(base+k) || src.includes('{'+base+k+'}') || src.includes('='+base+k)) k++;
  used.add(base+k); return base+k;
}
function umlInsert(code, box){
  // box: istruzione dell'ambiente in cui inserire (prima del suo \end)
  const pos = box ? src.lastIndexOf('\\end', box.end) : null;
  const ind = box ? '    ' : '  ';
  insertStmt(code.replace(/\n/g, '\n'+ind), box ? {insertAt:pos} : null);
}
function umlSeqInsert(code){
  const sd = lastR.stmts.find(s=>s.cmd==='umlseqdiag' && s.start>=(lastR.picStart||0) && s.end<=lastR.insertAt);
  if (sd) umlInsert(code, sd);
  else umlInsert(`\\begin{umlseqdiag}\n  ${code.replace(/\n/g,'\n  ')}\n\\end{umlseqdiag}`, null);
}
function umlHitName(hi){
  if (hi.stmt===undefined) return null;
  const st=lastR.stmts[hi.stmt];
  return st && st.umlName ? {name:st.umlName, st} : null;
}
function umlCanvasClick(page, hi){
  const it=umlPick && umlPick.it; if (!it) { setTool('select'); return; }
  const p=snapPage(page), hit=umlHitName(hi), m=it.m;
  const done = () => { setTool('select'); if (it.h) hint(it.h, 3500); };
  if (m==='place'){
    const box = hi.stmt!==undefined && UML_BOXES.test(lastR.stmts[hi.stmt].cmd) ? lastR.stmts[hi.stmt] : null;
    umlInsert(it.c(p, umlFresh), box); done(); return;
  }
  if (m==='note'){ umlInsert(it.c(hit ? [p[0]+2, p[1]+1] : p, umlFresh, hit && hit.name), null); done(); return; }
  if (m==='seqplace'){ umlSeqInsert(it.c(p, umlFresh)); done(); return; }
  if (!hit){ hint('Clic su un elemento UML'+(/^seq/.test(m)?' (oggetto del diagramma di sequenza)':''), 2500); return; }
  if (/^seq/.test(m) && !hit.st.seq){ hint('Scegli un oggetto del diagramma di sequenza', 2500); return; }
  if (/pick1$/.test(m)){
    const code = it.c(hit.name, null, umlFresh);
    if (/^seq/.test(m)) umlSeqInsert(code); else umlInsert(code, null);
    done(); return;
  }
  if (!umlPick.first){
    umlPick.first=hit.name; selStart=hit.st.start; selNode=null; updateHL(); drawOverlay();
    hint(`Da «${hit.name}»: ora clic sull'elemento di arrivo`, 4000); return;
  }
  const code = it.c(umlPick.first, hit.name);
  if (/^seq/.test(m)) umlSeqInsert(code); else umlInsert(code, null);
  done();
}
