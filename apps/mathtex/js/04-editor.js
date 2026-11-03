/* ============ EDITOR DEL SORGENTE: testo, evidenziazione, cronologia ============ */
const ed=$('ed'), hl=$('hl'), gut=$('gut');
/* stato condiviso: il sorgente è l'unica fonte di verità; prevMF è la serializzazione MathLive corrispondente */
const St = { src:'', prevMF:'', issues:[], flash:null, lastPane:'mf', cleared:null };
let hist=[], fut=[], histTimer=null, checkTimer=null, flashTimer=null;

function updateHL(){
  const ranges = St.issues.filter(x=>x.e>x.s).map(x=>({s:x.s, e:x.e, cls: x.kind==='e'?'t-err':'t-wrn'}));
  if (St.flash) ranges.push({s:St.flash[0], e:Math.max(St.flash[1], St.flash[0]+1), cls:'t-flash'});
  hl.innerHTML = hlRanges(St.src, ranges) + '\n\n';
  const n = St.src.split('\n').length;
  const eL = new Set(St.issues.filter(w=>w.kind==='e').map(w=>lineOf(St.src,w.s)));
  const wL = new Set(St.issues.filter(w=>w.kind==='w').map(w=>lineOf(St.src,w.s)));
  let g=''; for (let k=1;k<=n;k++) g+=`<div${eL.has(k)?' class="e"':wL.has(k)?' class="w"':''}>${k}</div>`;
  gut.innerHTML=g; syncScroll();
}
function syncScroll(){ hl.scrollTop=ed.scrollTop; hl.scrollLeft=ed.scrollLeft; gut.scrollTop=ed.scrollTop; }
ed.addEventListener('scroll', syncScroll);

/* ---------- sorgente e cronologia ----------
   from: 'code' (digitazione a sinistra), 'mf' (modifica sulla formula), 'tool' (menu, esempi, file) */
function pushHist(){
  let sel=null; try { sel = MF.getSelection(); } catch(e){}
  hist.push({src:St.src, sel}); if (hist.length>400) hist.shift(); fut=[];
  updateUndoBtns();
}
function setSource(t, {record=true, from='tool', caret=null, toMF=true, flash=null, coalesce=false}={}){
  if (record && t!==St.src){
    if (!coalesce || !histTimer) pushHist();
    clearTimeout(histTimer); histTimer = coalesce ? setTimeout(()=>histTimer=null, 700) : null;
  }
  St.src = t;
  if (ed.value!==t){
    const a=ed.selectionStart, b=ed.selectionEnd, sc=ed.scrollTop; ed.value=t;
    if (caret!==null) ed.setSelectionRange(caret,caret); else ed.setSelectionRange(Math.min(a,t.length),Math.min(b,t.length));
    ed.scrollTop=sc;
  }
  store.set('tl-src', t); Formulas.update();
  setFlash(flash);
  if (toMF) MF.fromSource();
  updateHL(); updatePos(); syncEnvSel();
  scheduleCheck();
}
function setFlash(range){
  clearTimeout(flashTimer); St.flash = range;
  if (range){ scrollEdTo(range[0], true); flashTimer=setTimeout(()=>{ St.flash=null; updateHL(); }, 1400); }
}
function restore(entry){
  St.src = entry.src; ed.value = entry.src; store.set('tl-src', entry.src); Formulas.update();
  St.flash=null; MF.fromSource(); if (entry.sel) MF.setSelection(entry.sel);
  updateHL(); updatePos(); syncEnvSel(); scheduleCheck(); updateUndoBtns();
}
function undo(){ if(!hist.length){ toast('Niente da annullare'); return; } clearTimeout(histTimer); histTimer=null; let sel=null; try{ sel=MF.getSelection(); }catch(e){} fut.push({src:St.src, sel}); restore(hist.pop()); }
function redo(){ if(!fut.length){ toast('Niente da ripetere'); return; } let sel=null; try{ sel=MF.getSelection(); }catch(e){} hist.push({src:St.src, sel}); restore(fut.pop()); }
function updateUndoBtns(){ $('b-undo').disabled=!hist.length; $('b-redo').disabled=!fut.length; }
$('b-undo').onclick=undo; $('b-redo').onclick=redo;

let pasted=false;
ed.addEventListener('paste', ()=>{ pasted=true; });
ed.addEventListener('input', ()=>{
  setSource(ed.value, {from:'code', coalesce:true});
  /* più formule incollate insieme: si aprono come elenco */
  if (pasted){ pasted=false; if (Formulas.split()){ toast('Formule incollate: una per voce dell\'elenco'); return; } }
  acUpdate();
});
ed.addEventListener('focus', ()=>{ St.lastPane='src'; });
ed.addEventListener('keyup', updatePos); ed.addEventListener('click', updatePos);
function updatePos(){ const t=St.src.slice(0,ed.selectionStart); const l=t.split('\n'); $('pos').textContent=`r ${l.length}, c ${l[l.length-1].length+1}`; }
function scrollEdTo(p, onlyIfHidden=false){
  const ln=lineOf(St.src,p); const lh=13*1.55; const y=(ln-1)*lh;
  if (onlyIfHidden && y>=ed.scrollTop && y<=ed.scrollTop+ed.clientHeight-2*lh) return;
  ed.scrollTop=Math.max(0,y-3*lh); syncScroll();
}
function syncEnvSel(){
  const d=parseDoc(St.src); const v = d.env==='$$' ? '\\[' : d.env==='\\(' ? '$' : d.env;
  const sel=$('envsel'); if ([...sel.options].some(o=>o.value===v)) sel.value=v; else sel.value='';
}

/* inserimento di un modello direttamente nel sorgente (quando l'ultimo pannello attivo è il codice) */
function insertInSource(tpl){
  const a=ed.selectionStart, b=ed.selectionEnd;
  const {text, caret} = expandForSource(tpl, St.src.slice(a,b));
  const before=St.src.slice(0,a), after=St.src.slice(b);
  const pre = (isLetter(text[0]) && endsWithCtrlWord(before)) ? ' ' : '';
  const post = (caret===text.length && endsWithCtrlWord(text) && (after==='' || isLetter(after[0]))) ? ' ' : '';
  const t = pre+text+post;
  const c = a + pre.length + caret + (caret===text.length ? post.length : 0);
  setSource(before+t+after, {caret:c, flash:[a, a+t.length]});
  ed.focus();
}

/* ---------- autocompletamento dei comandi ---------- */
let acItems=[], acSel=0, acRange=null, _mctx=null;
function acUpdate(){
  const p=ed.selectionStart; const before=St.src.slice(Math.max(0,p-40),p);
  const m = /\\([a-zA-Z]*)$/.exec(before);
  const box=$('ac');
  if (!m || m[1].length<1){ box.hidden=true; acItems=[]; return; }
  const w=m[1];
  const all = [...Macros.ac(), ...Catalog.acList()];
  acItems = all.filter(x=>x.c.startsWith(w) && x.c!==w).sort((x,y)=>x.c.length-y.c.length).slice(0,12);
  acRange=[p-w.length-1,p]; acSel=0;
  if (!acItems.length){ box.hidden=true; return; }
  box.innerHTML = acItems.map((x,k)=>`<div class="${k===0?'on':''}" data-k="${k}">\\${esc(x.c)}<small>${esc(x.d)}</small></div>`).join('');
  const xy = caretXY(p);
  box.style.left = Math.max(4,Math.min(xy[0], ed.clientWidth-230))+'px'; box.style.top = (xy[1]+21)+'px'; box.hidden=false;
}
function caretXY(p){
  const pre=St.src.slice(0,p); const lines=pre.split('\n'); const ln=lines.length-1, col=lines[ln].length;
  _mctx = _mctx || document.createElement('canvas').getContext('2d'); _mctx.font='13px "JetBrains Mono", monospace';
  const cw=_mctx.measureText('M').width;
  return [52+col*cw-ed.scrollLeft, 12+ln*13*1.55-ed.scrollTop];
}
function acAccept(k){
  const x=acItems[k]; if(!x||!acRange) return;
  const {text, caret} = expandForSource(x.ins, '');
  let t=text; const after=St.src.slice(acRange[1]);
  const plain = caret===text.length && endsWithCtrlWord(t) && (after==='' || isLetter(after[0]));
  if (plain) t+=' ';
  setSource(St.src.slice(0,acRange[0])+t+after, {caret: acRange[0]+(plain?t.length:caret)});
  $('ac').hidden=true; ed.focus();
}
$('ac').addEventListener('pointerdown', e=>{ const d=e.target.closest('[data-k]'); if(d){ e.preventDefault(); acAccept(+d.dataset.k); } });
ed.addEventListener('blur', ()=>setTimeout(()=>$('ac').hidden=true,150));
ed.addEventListener('keydown', e=>{
  const box=$('ac');
  if (!box.hidden && acItems.length){
    if (e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); acSel=(acSel+(e.key==='ArrowDown'?1:-1)+acItems.length)%acItems.length; [...box.children].forEach((c,k)=>c.classList.toggle('on',k===acSel)); return; }
    if (e.key==='Tab'||e.key==='Enter'){ e.preventDefault(); acAccept(acSel); return; }
    if (e.key==='Escape'){ box.hidden=true; e.stopPropagation(); return; }
  }
  if ((e.ctrlKey||e.metaKey) && !e.altKey && e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if ((e.ctrlKey||e.metaKey) && !e.altKey && e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
  if (e.key==='Tab' && !e.ctrlKey && !e.altKey){ e.preventDefault(); const a=ed.selectionStart; setSource(St.src.slice(0,a)+'  '+St.src.slice(ed.selectionEnd),{caret:a+2, coalesce:true}); return; }
  if (e.key==='Enter' && !e.ctrlKey && !e.altKey && !e.metaKey){ e.preventDefault(); const a=ed.selectionStart; const ls=St.src.lastIndexOf('\n',a-1)+1; const ind=/^[ \t]*/.exec(St.src.slice(ls,a))[0]; setSource(St.src.slice(0,a)+'\n'+ind+St.src.slice(ed.selectionEnd),{caret:a+1+ind.length, coalesce:true}); return; }
});
