/* ============ PALETTE CIRCUITI: componenti tra due punti e nodi (circuitikz) ============ */
let czPick = null;   // {it, first}: elemento della palette attivo e primo punto scelto
const CZI = {   // icone 24×16
  R:'<path d="M1 8h5l1-3 2 6 2-6 2 6 2-6 1 3h7"/>',
  C:'<path d="M1 8h9.5M13.5 8H23M10.5 3v10M13.5 3v10"/>',
  L:'<path d="M1 8h4c0-5 3.5-5 3.5 0 0-5 3.5-5 3.5 0 0-5 3.5-5 3.5 0 0-5 3.5-5 3.5 0h4"/>',
  V:'<path d="M1 8h6M17 8h6"/><circle cx="12" cy="8" r="5"/><path d="M7 8h10"/>',
  I:'<path d="M1 8h6M17 8h6"/><circle cx="12" cy="8" r="5"/><path d="M12 3v10"/>',
  sV:'<path d="M1 8h6M17 8h6"/><circle cx="12" cy="8" r="5"/><path d="M9 8c1-3 2-3 3 0s2 3 3 0"/>',
  bat:'<path d="M1 8h9.5M14 8h9M10.5 3v10"/><path d="M14 5.5v5" stroke-width="2.4"/>',
  D:'<path d="M1 8h7M16 8h7M8 4v8l8-4zM16 4v8"/>',
  led:'<path d="M1 8h7M16 8h7M8 4v8l8-4zM16 4v8M13 3.5l2.5-2.5M16 4l2.5-2.5"/>',
  lamp:'<path d="M1 8h6M17 8h6"/><circle cx="12" cy="8" r="5"/><path d="M8.5 4.5l7 7M15.5 4.5l-7 7"/>',
  sw:'<path d="M1 10h7l8-6M16 10h7"/>',
  A:'<path d="M1 8h6M17 8h6"/><circle cx="12" cy="8" r="5"/><path d="M10 10.5l2-5 2 5M10.8 8.8h2.4"/>',
  Vm:'<path d="M1 8h6M17 8h6"/><circle cx="12" cy="8" r="5"/><path d="M10 5.5l2 5 2-5"/>',
  wire:'<path d="M2 12L9 4h13"/><circle cx="2" cy="12" r="1.3" fill="currentColor"/><circle cx="22" cy="4" r="1.3" fill="currentColor"/>',
  wireL:'<path d="M2 13h10V3h10"/><circle cx="2" cy="13" r="1.3" fill="currentColor"/><circle cx="22" cy="3" r="1.3" fill="currentColor"/>',
  short:'<path d="M1 8h22"/><circle cx="3" cy="8" r="1.4" fill="currentColor"/><circle cx="21" cy="8" r="1.4" fill="currentColor"/>',
  ground:'<path d="M12 1v7M6 8h12M8 11h8M10 14h4"/>',
  vcc:'<path d="M12 15V3M8.5 6.5L12 3l3.5 3.5"/>',
  circ:'<path d="M3 8h18"/><circle cx="12" cy="8" r="2" fill="currentColor"/>',
  ocirc:'<path d="M3 8h7M14 8h7"/><circle cx="12" cy="8" r="2"/>',
  opamp:'<path d="M7 2v12l11-6zM3 5h4M3 11h4M18 8h4M8.5 5h2M8.5 11h2M9.5 10v2"/>',
  npn:'<path d="M3 8h6M9 4v8M9 6.5l6-4.5M9 9.5l6 4.5M12.5 12.6l2.5 1.4-.4-2.8"/>',
  nmos:'<path d="M3 8h5M8 4v8M10 3v10M10 4h5V1M10 12h5v3M12 10.6l3 1.4-3 1.4"/>'
};
const czTo2 = (key, lab) => (a,b) => `\\draw ${a} to[${key}${lab?'='+czNextLabel(lab):''}] ${b};`;
const czNode = (key, name) => p => name ? `\\node[${key}] (${czFresh(name)}) at ${p} {};` : `\\draw ${p} node[${key}]{};`;
const CZ_PAL = [
  {g:'Collegamenti', items:[
    {l:'Collegamento', i:'wire', m:'wire', op:' -- '},
    {l:'Collegamento ad angolo', i:'wireL', m:'wire', op:' -| '},
    {l:'Filo con poli', i:'short', m:'pick2', k:'short', c:(a,b)=>`\\draw ${a} to[short, *-*] ${b};`}
  ]},
  {g:'Componenti', items:[
    {l:'Resistore', i:'R', m:'pick2', k:'R', c:czTo2('R','R')},
    {l:'Condensatore', i:'C', m:'pick2', k:'C', c:czTo2('C','C')},
    {l:'Induttore', i:'L', m:'pick2', k:'L', c:czTo2('L','L')},
    {l:'Generatore di tensione', i:'V', m:'pick2', k:'V', c:czTo2('V','V')},
    {l:'Generatore di corrente', i:'I', m:'pick2', k:'I', c:czTo2('I','I')},
    {l:'Generatore sinusoidale', i:'sV', m:'pick2', k:'sV', c:czTo2('sV','v')},
    {l:'Batteria', i:'bat', m:'pick2', k:'battery1', c:czTo2('battery1','E')},
    {l:'Diodo', i:'D', m:'pick2', k:'D', c:czTo2('D','D')},
    {l:'LED', i:'led', m:'pick2', k:'leD', c:czTo2('leD')},
    {l:'Lampada', i:'lamp', m:'pick2', k:'lamp', c:czTo2('lamp')},
    {l:'Interruttore', i:'sw', m:'pick2', k:'switch', c:czTo2('switch')},
    {l:'Amperometro', i:'A', m:'pick2', k:'ammeter', c:czTo2('ammeter')},
    {l:'Voltmetro', i:'Vm', m:'pick2', k:'voltmeter', c:czTo2('voltmeter')}
  ]},
  {g:'Nodi', items:[
    {l:'Massa', i:'ground', m:'place', c:czNode('ground')},
    {l:'Alimentazione', i:'vcc', m:'place', c:czNode('vcc')},
    {l:'Giunzione', i:'circ', m:'place', c:czNode('circ')},
    {l:'Morsetto', i:'ocirc', m:'place', c:czNode('ocirc')},
    {l:'Amplificatore operazionale', i:'opamp', m:'place', c:czNode('op amp','A')},
    {l:'Transistor npn', i:'npn', m:'place', c:czNode('npn','Q')},
    {l:'MOSFET a canale n', i:'nmos', m:'place', c:czNode('nmos','M')}
  ]}
];
const czItems = CZ_PAL.flatMap(g=>g.items);
const CZ_TYPES = [['R','resistore'],['C','condensatore'],['L','induttore'],['V','gen. di tensione'],['I','gen. di corrente'],['sV','gen. sinusoidale'],['battery1','batteria'],['D','diodo'],['leD','LED'],['zD','diodo Zener'],['lamp','lampada'],['switch','interruttore'],['ammeter','amperometro'],['voltmeter','voltmetro'],['fuse','fusibile'],['short','filo'],['open','aperto']];

/* ---------- pannello ---------- */
function czPalBuild(){
  $('czpal-b').innerHTML = CZ_PAL.map(g=>`<details open><summary>${esc(g.g)}</summary><div class="pal">`+
    g.items.map(it=>`<button data-z="${czItems.indexOf(it)}"><svg viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round">${CZI[it.i]||''}</svg><span>${esc(it.l)}</span></button>`).join('')+
    `</div></details>`).join('') + `<p class="palhint">I punti si agganciano ai capi dei fili, dei componenti e ai piedini (cerchio evidenziato), altrimenti alla griglia. Collegamenti: clic sui punti, si chiude su un capo, con doppio clic o <b>Invio</b>. Componenti: clic sui due capi. Nodi: clic sul disegno. <b>Esc</b> annulla.</p>`;
}
function czPalOpen(on){
  if (on) palExclusive('czpal');
  $('czpal').hidden=!on; $('b-cz').classList.toggle('on', on); store.set('tz-czp', on?'1':'');
  if (!on && tool==='circ') setTool('select');
  requestAnimationFrame(()=>applyView());
}
function czPalSync(){
  if (tool!=='circ') czPick=null;
  document.querySelectorAll('#czpal [data-z]').forEach(b=>b.classList.toggle('on', !!czPick && +b.dataset.z===czItems.indexOf(czPick.it)));
}
czPalBuild();
$('czpal-b').addEventListener('click', e=>{
  const b=e.target.closest('[data-z]'); if (!b) return;
  const it=czItems[+b.dataset.z];
  if (czPick && czPick.it===it){ setTool('select'); return; }
  setTool('circ'); czPick={it, first:null}; czPalSync();
  hint((it.m==='place' ? 'Clic sul disegno per inserire: ' : it.m==='wire' ? 'Clic sul punto di partenza: ' : 'Clic sul primo capo: ')+it.l.toLowerCase(), 4000);
});
$('b-cz').onclick=()=>czPalOpen($('czpal').hidden);
$('czpal-x').onclick=()=>czPalOpen(false);
PALS.push({id:'czpal', open:on=>czPalOpen(on)});
if (store.get('tz-czp') && palsClosed()) czPalOpen(true);

/* ---------- inserimento ---------- */
function czNextLabel(base){
  const f=figs[Math.min(figIdx,figs.length-1)], body=f?src.slice(f.s,f.e):src;
  let k=1; while (body.includes(`$${base}_${k}$`) || body.includes(`$${base}_{${k}}$`)) k++;
  return `$${base}_${k>9?'{'+k+'}':k}$`;
}
function czFresh(base){
  const used=new Set(Object.keys(lastR ? lastR.names : {}));
  let k=1; while (used.has(base+k) || src.includes('('+base+k+')')) k++;
  return base+k;
}
/* i circuiti non vanno dentro un tikzcd: se serve si apre una figura circuitikz */
function czEnsure(){
  const f=figs[Math.min(figIdx,figs.length-1)];
  if (f && f.env!=='tikzcd') return;
  addFigure('\\begin{circuitikz}\n\\end{circuitikz}\n');
}
/* punto agganciato: capo esistente entro 10 px (con il nome dell'ancora, se c'è), altrimenti griglia */
function czSnap(page){
  let best=null, bd=10/view.k;
  const f=figs[Math.min(figIdx,figs.length-1)];
  if (lastR && (!f || f.env!=='tikzcd')) for (const q of lastR.pins){ const d=V.len(V.sub(q.p,page)); if (d<bd || (best && Math.abs(d-bd)<1e-9 && q.t && !best.t)){ bd=d; best=q; } }
  if (best) return {p:best.p, pt:best.t || `(${fmt(best.p[0],2)},${fmt(best.p[1],2)})`, pin:true};
  const p=snapPage(page); return {p, pt:`(${fmt(p[0],2)},${fmt(p[1],2)})`, pin:false};
}
/* anteprima: capi disponibili, punto agganciato e tratto in corso */
function czHover(page){
  if (!czPick) return;
  const s=czSnap(page), c=(p,r,cl)=>`<circle class="${cl}" cx="${fmt(p[0],4)}" cy="${fmt(-p[1],4)}" r="${fmt(r/view.k,4)}"/>`;
  let g='';
  const f=figs[Math.min(figIdx,figs.length-1)];
  if (lastR && (!f || f.env!=='tikzcd')){ const seen=new Set(); for (const q of lastR.pins){ const k=fmt(q.p[0],2)+','+fmt(q.p[1],2); if (seen.has(k)) continue; seen.add(k); g+=c(q.p, 2.5, 'pin'); } }
  const pts = czPick.pts ? czPick.pts.map(x=>x.p) : czPick.first ? [czPick.first.p] : [];
  if (pts.length){
    const all=pts.concat([s.p]); let d='M'+P(all[0]);
    for (let k=1;k<all.length;k++) d += czPick.it.op===' -| ' ? 'L'+P([all[k][0], all[k-1][1]])+'L'+P(all[k]) : 'L'+P(all[k]);
    g+=`<path class="ghost" d="${d}"/>`;
  }
  g += c(s.p, s.pin ? 6 : 3.5, s.pin ? 'pin on' : 'pin cur');
  ghost=g; drawOverlay();
}
let czWireDone = 0;
function czFinishWire(){
  const pts=czPick && czPick.pts;
  if (!pts || pts.length<2) return false;
  insertStmt(`\\draw ${pts.map(x=>x.pt).join(czPick.it.op)};`);
  czWireDone=Date.now(); setTool('select'); return true;
}
function czCanvasClick(page, hi){
  const it=czPick && czPick.it; if (!it){ setTool('select'); return; }
  czEnsure();
  const s=czSnap(page), p=s.p, pt=s.pt;
  if (it.m==='place'){ insertStmt(it.c(pt)); setTool('select'); return; }
  if (it.m==='wire'){
    const pts = czPick.pts || (czPick.pts=[]), last=pts[pts.length-1];
    if (last && V.len(V.sub(p, last.p))<1e-6){ if (!czFinishWire()) hint('Scegli un punto diverso', 2000); return; }   // doppio clic
    pts.push(s);
    if (pts.length>=2 && s.pin){ czFinishWire(); return; }
    hint(pts.length===1 ? 'Clic sui punti successivi: si chiude su un capo, con doppio clic o Invio' : 'Continua, o doppio clic / Invio per finire', 4000);
    czHover(page); return;
  }
  if (!czPick.first){ czPick.first=s; czHover(page); hint('Ora clic sul secondo capo', 4000); return; }
  if (V.len(V.sub(p, czPick.first.p))<1e-6){ hint('Scegli un punto diverso dal primo', 2500); return; }
  insertStmt(it.c(czPick.first.pt, pt));
  setTool('select');
}

/* ---------- pannello proprietà: tipo ed etichetta dei componenti del percorso ---------- */
function czCompItems(c){ return optSpans(src, c.opts.s+1, c.opts.e); }
function czLabelOf(c){
  const its=czCompItems(c);
  const main=its.find(x=>CZ_BIP[itemKey(x.t)]); if (main && main.t.includes('=')) return unbrace(main.t.slice(main.t.indexOf('=')+1));
  const l=its.find(x=>/^l[\^_]?$/.test(itemKey(x.t))); return l ? unbrace(l.t.slice(l.t.indexOf('=')+1)) : '';
}
function czPropsHTML(si, st, sel){
  return st.cz.slice(0,8).map((c,k)=>`<label for="cz-t${k}">${st.cz.length>1?'componente '+(k+1):'componente'}</label>`+sel('cz-t'+k, CZ_TYPES, c.comp)+
    `<label for="cz-l${k}">etichetta</label><input type="text" id="cz-l${k}" value="${esc(czLabelOf(c))}" placeholder="es. $R_1$">`).join('');
}
function czWireProps(si, st){
  const apply = t => { if (t!==src) setSource(t); };
  st.cz.slice(0,8).forEach((c,k)=>{
    const ti=$('cz-t'+k), li=$('cz-l'+k);
    if (ti) ti.addEventListener('change', ()=>{
      const its=czCompItems(c), main=its.find(x=>CZ_BIP[itemKey(x.t)]);
      const v = main && main.t.includes('=') ? ti.value+main.t.slice(main.t.indexOf('=')) : ti.value;
      apply(main ? src.slice(0,main.s)+v+src.slice(main.e) : setOptsAt(c.opts, c.opts.s, {add:[v]}));
    });
    if (li) li.addEventListener('change', ()=>{
      let v=li.value.trim(); if (v && /[,=\]]/.test(v) && !/^\{.*\}$/.test(v)) v='{'+v+'}';
      const its=czCompItems(c), main=its.find(x=>CZ_BIP[itemKey(x.t)]);
      if (main && (main.t.includes('=') || !its.some(x=>/^l[\^_]?$/.test(itemKey(x.t))))){ const key=itemKey(main.t); apply(src.slice(0,main.s)+(v?key+'='+v:key)+src.slice(main.e)); return; }
      apply(setOptsAt(c.opts, c.opts.s, {remove:(x,kk)=>/^l[\^_]?$/.test(kk), add:v?['l='+v]:[]}));
    });
  });
}
