/* ============ INTERFACCIA: editor, vista, cronologia ============ */
const $ = id => document.getElementById(id);
const ed=$('ed'), hl=$('hl'), gut=$('gut'), cv=$('cv'), drawG=$('draw'), overG=$('over');
let src='', figs=[], figIdx=0, lastR=null, selStart=null, selNode=null;
let view={x:-2, y:-6, k:56};
let hist=[], fut=[], histTimer=null, renderTimer=null;
let snapOn=true, snapStep=.25;
const store = { get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };

/* ---------- evidenziazione ---------- */
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function hlText(t){
  return t.replace(/(%[^\n]*)|(\\(?:begin|end)\s*\{[^}\n]*\})|(\\[a-zA-Z@]+|\\.)|(-?\b\d*\.?\d+(?:cm|mm|pt|em|ex|in)?\b)|([\[\]])|([{}()])|([&<>])/g,
    (m,com,env,cmd,num,br,par,ent)=> com?`<span class="t-com">${esc(com)}</span>` : env?`<span class="t-env">${esc(env)}</span>` : cmd?`<span class="t-cmd">${esc(cmd)}</span>` : num?`<span class="t-num">${num}</span>` : br?`<span class="t-opt">${br}</span>` : par?`<span class="t-br">${par}</span>` : esc(ent));
}
function updateHL(){
  const st = selStart!==null && lastR ? lastR.stmts.find(s=>s.start===selStart) : null;
  let html;
  if (st && st.end<=src.length) html = hlText(src.slice(0,st.start))+'<span class="t-mark">'+hlText(src.slice(st.start,st.end))+'</span>'+hlText(src.slice(st.end));
  else html = hlText(src);
  hl.innerHTML = html+'\n\n';
  const n = src.split('\n').length;
  const errLines = new Set((lastR?lastR.warns:[]).filter(w=>w.kind==='e').map(w=>lineOfSrc(w.pos)));
  let g=''; for (let k=1;k<=n;k++) g+=`<div${errLines.has(k)?' class="e"':''}>${k}</div>`;
  gut.innerHTML=g; syncScroll();
}
function lineOfSrc(pos){ let n=1; for(let k=0;k<pos&&k<src.length;k++) if(src.charCodeAt(k)===10) n++; return n; }
function syncScroll(){ hl.scrollTop=ed.scrollTop; hl.scrollLeft=ed.scrollLeft; gut.scrollTop=ed.scrollTop; }
ed.addEventListener('scroll', syncScroll);

/* ---------- sorgente e cronologia ---------- */
function setSource(t, {record=true, render:doRender=true, caret=null}={}){
  if (record && t!==src){ hist.push(src); if (hist.length>300) hist.shift(); fut=[]; }
  src = t;
  if (ed.value!==t){ const a=ed.selectionStart, b=ed.selectionEnd, sc=ed.scrollTop; ed.value=t; if(caret!==null){ ed.setSelectionRange(caret,caret); } else { ed.setSelectionRange(Math.min(a,t.length),Math.min(b,t.length)); } ed.scrollTop=sc; }
  store.set('tz-src', t);
  if (doRender) renderNow();
}
function undo(){ if(!hist.length) return; fut.push(src); const t=hist.pop(); src=t; ed.value=t; store.set('tz-src',t); renderNow(); toast('Annullato'); }
function redo(){ if(!fut.length) return; hist.push(src); const t=fut.pop(); src=t; ed.value=t; store.set('tz-src',t); renderNow(); }
ed.addEventListener('input', ()=>{
  if (!histTimer) hist.push(src), fut=[];
  clearTimeout(histTimer); histTimer=setTimeout(()=>histTimer=null, 700);
  src = ed.value; store.set('tz-src', src);
  updateHL();
  clearTimeout(renderTimer); renderTimer=setTimeout(renderNow, 140);
  acUpdate();
});
ed.addEventListener('keyup', updatePos); ed.addEventListener('click', updatePos);
function updatePos(){ const t=src.slice(0,ed.selectionStart); const l=t.split('\n'); $('pos').textContent=`r ${l.length}, c ${l[l.length-1].length+1}`; }

/* ---------- rendering ---------- */
function renderNow(){
  clearTimeout(renderTimer);
  figs = findFigures(src);
  updateFigSel();
  const fig = figs.length ? figs[Math.min(figIdx, figs.length-1)] : null;
  let out='';
  const prevIdx = (lastR && selStart!==null) ? lastR.stmts.findIndex(s=>s.start===selStart) : -1, prevN = lastR ? lastR.stmts.length : 0;
  const t0=performance.now();
  try { out = renderFigure(src, fig); } catch(e){ console.error(e); R.warns.push({pos:0,msg:'errore: '+e.message,kind:'e'}); }
  lastR = R;
  drawG.innerHTML = out;
  const ms = performance.now()-t0;
  if (selStart!==null && !lastR.stmts.some(s=>s.start===selStart)) { selStart = prevIdx>=0 && lastR.stmts.length===prevN ? lastR.stmts[prevIdx].start : null; }
  updateHL(); drawOverlay(); updateMsgs(ms); updateProps();
}
/* ---------- figure del file ----------
   Con più figure nel sorgente l'elenco a sinistra le mostra in miniatura: un clic sceglie quella da disegnare
   e porta il codice al suo inizio, Alt+PagSu e Alt+PagGiù passano alla precedente e alla successiva. */
let thumbT=null;
const thumbCache=new Map();
function updateFigSel(){
  const box=$('flist'), many=figs.length>1;
  box.hidden=!many;
  if (!many) return;
  const want = figs.map(f=>lineOfSrc(f.s)).join('|');
  if (box.dataset.k!==want){
    $('fl-n').textContent=figs.length;
    $('fl-items').innerHTML = figs.map((f,k)=>`<button class="fi" data-k="${k}" title="Figura ${k+1} · riga ${lineOfSrc(f.s)}"><span class="fn">${k+1}</span><span class="fv"></span></button>`).join('');
    box.dataset.k=want;
  }
  const cur=Math.min(figIdx,figs.length-1);
  $('fl-items').querySelectorAll('.fi').forEach(b=>b.classList.toggle('on', +b.dataset.k===cur));
  clearTimeout(thumbT); thumbT=setTimeout(thumbs, 350);
}
/* il rendering usa lo stato globale: per le miniature lo si salva e poi si rimette quello della figura corrente.
   Gli id delle definizioni prendono un prefisso, perché nella pagina non si scontrino con quelli del disegno */
function thumbs(){
  if (figs.length<2) return;
  const pre = figs.reduceRight((t,f)=>t.slice(0,f.s)+t.slice(f.e), src)+'\u0001'+(window.__mjReady?1:0)+'\u0001'+Object.keys(DATA).join(',');
  const saved={S, R, DEFS, DEFN, userColors, CZ}, used=new Set();
  try {
    figs.forEach((f,k)=>{
      const el=$('fl-items').querySelector(`[data-k="${k}"] .fv`); if (!el) return;
      const key=src.slice(f.s,f.e)+'\u0001'+pre; used.add(key);
      let svg=thumbCache.get(key);
      if (!svg){
        let out=''; try { out=renderFigure(src, f); } catch(e){}
        out = out.replace(/\bid="([^"]+)"/g, `id="fl${k}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#fl${k}-$1)`).replace(/href="#([^"]+)"/g, `href="#fl${k}-$1"`);
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><g>${out}</g></svg>`;
        let bb=null; try { bb=el.querySelector('g').getBBox(); } catch(e){}
        if (bb && (bb.width||bb.height)){ const m=Math.max(bb.width,bb.height)*.04+.05; el.firstChild.setAttribute('viewBox', `${bb.x-m} ${bb.y-m} ${bb.width+2*m} ${bb.height+2*m}`); }
        svg=el.innerHTML; thumbCache.set(key, svg);
      } else if (el.innerHTML!==svg) el.innerHTML=svg;
    });
  } finally { ({S, R, DEFS, DEFN, userColors, CZ} = saved); }
  for (const k of thumbCache.keys()) if (!used.has(k)) thumbCache.delete(k);
}
function selectFig(k){
  if (figs.length<2) return;
  k=clamp(k, 0, figs.length-1); if (k===Math.min(figIdx,figs.length-1)) return;
  figIdx=k; selStart=null; renderNow(); fitView();
  const p=figs[k].s; ed.setSelectionRange(p,p); scrollEdTo(p); updatePos();
  $('fl-items').querySelector('.fi.on')?.scrollIntoView({block:'nearest'});
}
$('fl-items').addEventListener('click', e=>{ const b=e.target.closest('.fi'); if (b) selectFig(+b.dataset.k); });
document.addEventListener('keydown', e=>{
  if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key==='PageUp'||e.key==='PageDown') && figs.length>1){ e.preventDefault(); e.stopPropagation(); selectFig(Math.min(figIdx,figs.length-1)+(e.key==='PageUp'?-1:1)); }
}, true);
function updateMsgs(ms){
  const w = lastR.warns;
  const box=$('msgs');
  box.innerHTML = w.slice(0,60).map((x,k)=>`<div class="${x.kind}" data-p="${x.pos}">riga ${lineOfSrc(x.pos)} · ${esc(x.msg)}</div>`).join('');
  const nerr = w.filter(x=>x.kind==='e').length;
  const m=$('st-msg');
  m.className = nerr ? 'err' : 'ok';
  m.textContent = nerr ? `${nerr} errori` : w.length ? `${w.length} avvisi · ${ms|0} ms` : `ok · ${ms|0} ms`;
}
$('msgs').addEventListener('click', e=>{ const d=e.target.closest('[data-p]'); if(!d) return; const p=+d.dataset.p; ed.focus(); ed.setSelectionRange(p,p); scrollEdTo(p); });
function scrollEdTo(p){ const ln=lineOfSrc(p); const lh=13*1.55; ed.scrollTop=Math.max(0,(ln-4)*lh); syncScroll(); }

/* ---------- vista ---------- */
function applyView(){
  const r=cv.getBoundingClientRect(); const W=r.width/view.k, H=r.height/view.k;
  cv.setAttribute('viewBox', `${view.x} ${view.y} ${W} ${H}`);
  for (const id of ['paper','gridr']){ const el=$(id); el.setAttribute('x',view.x); el.setAttribute('y',view.y); el.setAttribute('width',W); el.setAttribute('height',H); }
  $('ax0').setAttribute('d', `M${view.x} 0H${view.x+W}M0 ${view.y}V${view.y+H}`);
  $('ax0').setAttribute('stroke-width', 1/view.k);
  const gp=$('gridp').children; gp[0].setAttribute('stroke-width', 1/view.k); gp[1].setAttribute('stroke-width', .7/view.k);
  $('gridr').style.display = view.k<14 ? 'none' : '';
  $('zlab').textContent = Math.round(view.k/37.8*100)+'%';
  if (typeof drawOverlay==='function') drawOverlay();
}
function fitView(){
  const r=cv.getBoundingClientRect(); if (!r.width) return;
  let bb; try { bb = drawG.getBBox(); } catch(e){ bb=null; }
  if (!bb || (!bb.width && !bb.height)) bb={x:-1,y:-4,width:6,height:5};
  const m=.6; const W=bb.width+2*m, H=bb.height+2*m;
  view.k = clamp(Math.min(r.width/W, r.height/H), 8, 400);
  view.x = bb.x - (r.width/view.k - bb.width)/2; view.y = bb.y - (r.height/view.k - bb.height)/2;
  applyView();
}
function zoomAt(f, sx, sy){
  const r=cv.getBoundingClientRect(); sx = sx===undefined ? r.width/2 : sx; sy = sy===undefined ? r.height/2 : sy;
  const wx=view.x+sx/view.k, wy=view.y+sy/view.k;
  view.k = clamp(view.k*f, 6, 1200); view.x = wx - sx/view.k; view.y = wy - sy/view.k; applyView();
}
cv.addEventListener('wheel', e=>{ e.preventDefault(); const r=cv.getBoundingClientRect();
  if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY)>40 && !e.shiftKey && e.deltaMode===0 && Math.abs(e.deltaX)<1) zoomAt(Math.exp(-e.deltaY*(e.ctrlKey?.01:.0018)), e.clientX-r.left, e.clientY-r.top);
  else { view.x += (e.shiftKey?e.deltaY:e.deltaX)/view.k; view.y += (e.shiftKey?0:e.deltaY)/view.k; applyView(); }
}, {passive:false});
$('b-zin').onclick=()=>zoomAt(1.25); $('b-zout').onclick=()=>zoomAt(.8); $('b-fit').onclick=fitView;
new ResizeObserver(()=>applyView()).observe(cv);
function toWorld(e){ const r=cv.getBoundingClientRect(); return [view.x+(e.clientX-r.left)/view.k, view.y+(e.clientY-r.top)/view.k]; }
const toPagePt = w => [w[0], -w[1]];
function snapPage(p, force){ if (!(snapOn||force)) return p; const s=snapStep; return [Math.round(p[0]/s)*s, Math.round(p[1]/s)*s]; }

/* ---------- messaggi brevi ---------- */
let toastT=null;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),1600); }
let hintT=null;
function hint(msg, ms=2200){ const h=$('hint'); h.textContent=msg; h.classList.add('on'); clearTimeout(hintT); if(ms) hintT=setTimeout(()=>h.classList.remove('on'),ms); }
async function copyText(t, okMsg='Copiato negli appunti'){
  try { await navigator.clipboard.writeText(t); toast(okMsg); return true; }
  catch(e){ toast('Copia non disponibile: seleziona il testo e usa Ctrl+C'); return false; }
}

/* ---------- divisore ---------- */
(()=>{ const sp=$('split'); let on=false;
  sp.addEventListener('pointerdown', e=>{ on=true; sp.setPointerCapture(e.pointerId); });
  sp.addEventListener('pointermove', e=>{ if(!on) return; const w=clamp(e.clientX,240,window.innerWidth-300); $('left').style.width=w+'px'; applyView(); });
  sp.addEventListener('pointerup', ()=>{ on=false; store.set('tz-split',$('left').style.width); });
  const w=store.get('tz-split'); if (w) $('left').style.width=w;
})();

/* ---------- tema ---------- */
$('b-theme').onclick=()=>{
  const r=document.documentElement; const cur=r.getAttribute('data-theme');
  const dark = cur ? cur==='dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.setAttribute('data-theme', dark?'light':'dark'); store.set('tz-theme', dark?'light':'dark');
};
{ const t=store.get('tz-theme'); if (t) document.documentElement.setAttribute('data-theme', t); }

/* ---------- autocompletamento ---------- */
const AC_WORDS = ['draw','fill','filldraw','path','node','coordinate','foreach','begin{tikzpicture}','end{tikzpicture}','begin{scope}','end{scope}','begin{axis}','end{axis}','addplot','addplot+','addlegendentry','legend','shade','shadedraw','clip','matrix','definecolor','colorlet','tikzset','pgfplotsset','pgfmathsetmacro','usetikzlibrary','tikzstyle','closedcycle','small','footnotesize','textbf','frac','sqrt','alpha','beta','gamma','delta','theta','lambda','pi','sigma','omega','infty','cdot','times','int','sum','begin{semilogyaxis}','begin{loglogaxis}',
  'umlclass','umlsimpleclass','umlabstract','umlinterface','umlenum','umlnote','umlassoc','umluniassoc','umlaggreg','umluniaggreg','umlcompo','umlunicompo','umlinherit','umlimpl','umlreal','umldep','umlimport','umlnest','umlHVinherit','umlVHinherit','umlHVHinherit','umlVHVinherit','umlHVassoc','umlVHassoc','umlstatic','umlvirt','begin{umlpackage}','umlactor','umlusecase','umlinclude','umlextend','begin{umlsystem}','umlstateinitial','umlstatefinal','umlbasicstate','umlstatedecision','umltrans','begin{umlstate}','tikzumlset',
  'begin{tikzcd}','end{tikzcd}','arrow','tikzcdset','begin{circuitikz}','end{circuitikz}','ctikzset','pgfplotstableread','lrcorner'];
const AC_OPTS = ['draw','fill','thick','very thick','thin','ultra thick','dashed','dotted','->','<->','-latex','-stealth','rounded corners','circle','rectangle','ellipse','diamond','minimum size=','inner sep=','above','below','left','right','midway','sloped','bend left','bend right','line width=','opacity=','fill opacity=','scale=','rotate=','xshift=','yshift=','shift={(1,0)}','color=','text=','font=\\small','align=center','text width=','anchor=','name=','pos=','domain=','samples=','smooth','mark=*','only marks','no marks','xlabel=','ylabel=','title=','xmin=','xmax=','ymin=','ymax=','grid=major','axis lines=middle','axis lines=left','legend pos=north west','width=','height=','xtick=','ytick=','ybar','bar width=','nodes near coords','symbolic x coords=','enlargelimits=false','axis equal','help lines','step=','pattern=north east lines','left color=','right color=','ball color=','shading=radial','every node/.style={}','node distance=','below=of','right=of','label=','pin=','double','loop above','loop below','loop left','loop right','out=','in=','looseness=','state','initial','accepting','initial text=','initial where=','accepting by arrow','on grid','swap','auto','shorten >=1pt',
  'Rightarrow','hook','two heads','mapsto','equal','description','phantom','crossing over','shift left','shift right','column sep=','row sep=',
  'R=','C=','L=','V=','I=','l=','l_=','v=','i=','*-*','o-o','short','ground','circ','op amp','npn','nmos','col sep=comma','table'];
let acItems=[], acSel=0, acRange=null;
function acUpdate(){
  const p=ed.selectionStart; const before=src.slice(Math.max(0,p-40),p);
  let m = /\\([a-zA-Z@{]*)$/.exec(before);
  let list=[], kind='cmd';
  if (m && m[1].length>=1){ list = AC_WORDS.filter(w=>w.startsWith(m[1]) && w!==m[1]); acRange=[p-m[1].length,p]; }
  else {
    m = /\[([^\]\n]*)$/.exec(src.slice(Math.max(0,p-200),p));
    if (m){ const last=/(?:^|,)\s*([a-z<>|\- ]*)$/.exec(m[1]); if (last && last[1].length>=2){ list=AC_OPTS.filter(w=>w.startsWith(last[1]) && w!==last[1]); acRange=[p-last[1].length,p]; kind='opt'; } }
  }
  acItems=list.slice(0,10); acSel=0;
  const box=$('ac');
  if (!acItems.length){ box.hidden=true; return; }
  box.innerHTML = acItems.map((w,k)=>`<div class="${k===0?'on':''}" data-k="${k}">${esc(kind==='cmd'?'\\'+w:w)}<small>${kind==='cmd'?'comando':'opzione'}</small></div>`).join('');
  const xy = caretXY(p);
  box.style.left = Math.min(xy[0], ed.clientWidth-200)+'px'; box.style.top = (xy[1]+20)+'px'; box.hidden=false;
}
function caretXY(p){
  const pre=src.slice(0,p); const lines=pre.split('\n'); const ln=lines.length-1, col=lines[ln].length;
  _mctx = _mctx || document.createElement('canvas').getContext('2d'); _mctx.font='13px "JetBrains Mono", monospace';
  const cw=_mctx.measureText('M').width;
  return [52+col*cw-ed.scrollLeft, 12+ln*13*1.55-ed.scrollTop];
}
function acAccept(k){
  const w=acItems[k]; if(w===undefined||!acRange) return;
  let ins=w; let caret=acRange[0]+ins.length;
  if (/^begin\{(.+)\}$/.test(w)){ const env=w.slice(6,-1); ins=`begin{${env}}\n  \n\\end{${env}}`; caret=acRange[0]+env.length+10; }
  const t=src.slice(0,acRange[0])+ins+src.slice(acRange[1]);
  setSource(t,{caret}); $('ac').hidden=true; ed.focus();
}
$('ac').addEventListener('pointerdown', e=>{ const d=e.target.closest('[data-k]'); if(d){ e.preventDefault(); acAccept(+d.dataset.k); } });
ed.addEventListener('blur', ()=>setTimeout(()=>$('ac').hidden=true,150));
ed.addEventListener('keydown', e=>{
  const box=$('ac');
  if (!box.hidden){
    if (e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); acSel=(acSel+(e.key==='ArrowDown'?1:-1)+acItems.length)%acItems.length; [...box.children].forEach((c,k)=>c.classList.toggle('on',k===acSel)); return; }
    if (e.key==='Tab'||e.key==='Enter'){ e.preventDefault(); acAccept(acSel); return; }
    if (e.key==='Escape'){ box.hidden=true; return; }
  }
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
  if (e.key==='Tab'){ e.preventDefault(); const a=ed.selectionStart; setSource(src.slice(0,a)+'  '+src.slice(ed.selectionEnd),{caret:a+2}); return; }
  if (e.altKey && (e.key==='ArrowUp'||e.key==='ArrowDown')){ e.preventDefault(); scrubAt(ed.selectionStart, (e.key==='ArrowUp'?1:-1)*(e.shiftKey?1:.1)); return; }
  if (e.key==='Enter'){ e.preventDefault(); const a=ed.selectionStart; const ls=src.lastIndexOf('\n',a-1)+1; const ind=/^\s*/.exec(src.slice(ls,a))[0]; setSource(src.slice(0,a)+'\n'+ind+src.slice(ed.selectionEnd),{caret:a+1+ind.length}); updateHL(); return; }
});
/* scrubbing numerico: Alt+trascina su un numero, oppure Alt+↑/↓ */
function numAt(p){
  const re=/-?\d*\.?\d+/g; const ls=src.lastIndexOf('\n',p-1)+1; const le=src.indexOf('\n',p); const line=src.slice(ls, le<0?src.length:le); let m;
  while ((m=re.exec(line))){ const s=ls+m.index, e=s+m[0].length; if (p>=s && p<=e) return {s,e,v:parseFloat(m[0]),dec:(m[0].split('.')[1]||'').length}; }
  return null;
}
function scrubAt(p, delta, base){
  const n = base || numAt(p); if(!n) return null;
  const dec = Math.max(n.dec, Math.abs(delta)<1 ? (Math.abs(delta)<.1?2:1) : 0);
  const v = (n.v+delta).toFixed(dec).replace(/^-0(\.0+)?$/,'0');
  setSource(src.slice(0,n.s)+v+src.slice(n.e), {record:!base, caret:n.s});
  ed.setSelectionRange(n.s, n.s+v.length);
  return {s:n.s, e:n.s+v.length};
}
(()=>{ let sc=null;
  ed.addEventListener('pointerdown', e=>{ if(!e.altKey) return; setTimeout(()=>{ const n=numAt(ed.selectionStart); if(!n) return; hist.push(src); fut=[]; sc={x:e.clientX, n, src0:src}; ed.setPointerCapture(e.pointerId); },0); });
  ed.addEventListener('pointermove', e=>{ if(!sc) return; const dx=e.clientX-sc.x; const step = sc.n.dec===0 && !e.shiftKey ? 1 : (e.shiftKey?.01:.1); const d=Math.round(dx/6)*step;
    src=sc.src0; scrubAt(null, d, sc.n); });
  ed.addEventListener('pointerup', ()=>{ sc=null; });
})();
