/* ============ EDITOR DEL SORGENTE: testo, evidenziazione, cronologia ============ */
const ed=$('ed'), hl=$('hl'), gut=$('gut');
/* stato condiviso: il sorgente è l'unica fonte di verità; tabelle e griglia si ricavano da lì a ogni cambio.
   ti è la tabella mostrata (se il sorgente ne ha più d'una); sel la selezione della griglia (ancora r,c e fine r2,c2) */
const St = { src:'', tables:[], ti:0, sel:{r:0,c:0,r2:0,c2:0}, issues:[], flash:null, mark:null, lastPane:'grid', find:null };
let hist=[], fut=[], histTimer=null, flashTimer=null, msgTimer=null;
const curT = () => St.tables[St.ti] || null;

/* ---------- evidenziazione (come Tavolo MathTeX, con i comandi delle tabelle) ---------- */
const RULE_RE = /^\\(toprule|midrule|bottomrule|cmidrule|hline|cline|addlinespace|morecmidrules|specialrule|endhead|endfirsthead|endfoot|endlastfoot|multicolumn|multirow)$/;
function hlText(t){
  return t.replace(/(%[^\n]*)|(\\(?:begin|end)\s*\{[^}\n]*\})|(\\\\)|(\\[a-zA-Z@]+|\\.)|(\d+(?:[.,]\d+)?)|(\$)|(&)|([\[\]])|([{}])|([<>"])/g,
    (m,com,env,nl,cmd,num,dol,amp,sq,br,ent)=> com?`<span class="t-com">${esc(com)}</span>` : env?`<span class="t-env">${esc(env)}</span>` : nl?`<span class="t-al">\\\\</span>` : cmd?`<span class="${RULE_RE.test(cmd)?'t-rule':'t-cmd'}">${esc(cmd)}</span>` : num?`<span class="t-num">${num}</span>` : dol?`<span class="t-scr">$</span>` : amp?`<span class="t-al">&amp;</span>` : sq?`<span class="t-opt">${sq}</span>` : br?`<span class="t-br">${br}</span>` : esc(ent));
}
function hlRanges(src, ranges){
  const rs = ranges.filter(r=>r.e>r.s && r.s<src.length).map(r=>({...r, e:Math.min(r.e,src.length)})).sort((a,b)=>a.s-b.s);
  let out='', p=0;
  for (const r of rs){
    const s=Math.max(r.s,p); if (s>=r.e) continue;
    out += hlText(src.slice(p,s)) + `<span class="${r.cls}">` + hlText(src.slice(s,r.e)) + '</span>';
    p = r.e;
  }
  return out + hlText(src.slice(p));
}
function updateHL(){
  const ranges = St.issues.filter(x=>x.e>x.s).map(x=>({s:x.s, e:x.e, cls: x.kind==='e'?'t-err':'t-wrn'}));
  if (St.mark && St.mark[1]>St.mark[0]) ranges.push({s:St.mark[0], e:St.mark[1], cls:'t-mark'});
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

/* ---------- sorgente e cronologia ---------- */
function pushHist(){ hist.push({src:St.src, sel:{...St.sel}, ti:St.ti}); if (hist.length>400) hist.shift(); fut=[]; updateUndoBtns(); }
function setSource(t, {record=true, caret=null, flash=null, coalesce=false, from='tool'}={}){
  if (record && t!==St.src){
    if (!coalesce || !histTimer) pushHist();
    clearTimeout(histTimer); histTimer = coalesce ? setTimeout(()=>histTimer=null, 700) : null;
  }
  St.src = t;
  if (from!=='op') setStatus('pronto', 'ok');
  if (ed.value!==t){
    const a=ed.selectionStart, b=ed.selectionEnd, sc=ed.scrollTop; ed.value=t;
    if (caret!==null) ed.setSelectionRange(caret,caret); else ed.setSelectionRange(Math.min(a,t.length),Math.min(b,t.length));
    ed.scrollTop=sc;
  }
  store.set('tt-src', t); Docs.update();
  reparse();
  setFlash(flash);
  View.render();
  if (from==='code') followCaret();
  updateHL(); updatePos(); syncRibbon();
  clearTimeout(msgTimer); msgTimer=setTimeout(showMsgs, from==='code' ? 350 : 0);
}
function reparse(){
  St.tables = parseAll(St.src);
  St.ti = clamp(St.ti, 0, Math.max(0, St.tables.length-1));
  St.issues = St.tables.flatMap(t=>t.issues);
}
function setFlash(range){
  clearTimeout(flashTimer); St.flash = range;
  if (range){ scrollEdTo(range[0], true); flashTimer=setTimeout(()=>{ St.flash=null; updateHL(); }, 1400); }
}
function restore(entry){
  St.src = entry.src; ed.value = entry.src; store.set('tt-src', entry.src); Docs.update();
  St.ti = entry.ti||0; St.sel = {...entry.sel}; St.flash=null;
  reparse(); View.render(); updateHL(); updatePos(); syncRibbon(); showMsgs(); updateUndoBtns();
}
function undo(){ if(!hist.length){ toast('Niente da annullare'); return; } clearTimeout(histTimer); histTimer=null; fut.push({src:St.src, sel:{...St.sel}, ti:St.ti}); restore(hist.pop()); }
function redo(){ if(!fut.length){ toast('Niente da ripetere'); return; } hist.push({src:St.src, sel:{...St.sel}, ti:St.ti}); restore(fut.pop()); }
function updateUndoBtns(){ $('b-undo').disabled=!hist.length; $('b-redo').disabled=!fut.length; }
$('b-undo').onclick=undo; $('b-redo').onclick=redo;

/* ---------- operazione sulla griglia: riscrittura minima con verifica (04-ops.js) ---------- */
const MODE_TXT = {minima:'riscritto solo il tratto cambiato', righe:'riscritta la riga', corpo:'riscritto il corpo della tabella'};
function doOp(op, {sel=null, msg=''}={}){
  const T=curT(); if (!T){ toast('Nessuna tabella nel sorgente'); return false; }
  const t0=performance.now();
  const res=Ops.run(St.src, St.ti, op);
  if (res.error){ console.warn('operazione non applicata', op, res); toast('Modifica non applicata: il risultato non sarebbe la tabella attesa'); setStatus('modifica non applicata', 'err'); return false; }
  if (sel) St.sel=sel;
  setSource(res.src, {flash:res.flash, from:'op'});
  const n=res.flash[1]-res.flash[0];
  setStatus(MODE_TXT[res.mode]+(res.mode==='minima'?` (${n} car.)`:''), res.mode==='minima'?'ok':'wrn');
  $('st-sync').textContent='sincronizzato · '+Math.round(performance.now()-t0)+' ms';
  if (msg) hint(msg);
  return true;
}
function setStatus(t, cls='ok'){ const s=$('st-msg'); s.textContent=t; s.className=cls; }

/* ---------- messaggi sotto il codice ---------- */
function showMsgs(){
  const box=$('msgs'); const T=curT();
  const list=[...St.issues];
  if (!St.tables.length && St.src.trim()) list.push({s:0,e:0,kind:'i',msg:'nessuna tabella: serve \\begin{tabular}, tabularx, tabular* o longtable'});
  box.innerHTML = list.slice(0,30).map((x,k)=>`<div class="${x.kind}" data-k="${k}">r ${lineOf(St.src,x.s)} · ${esc(x.msg)}</div>`).join('');
  box.onclick = e=>{ const d=e.target.closest('[data-k]'); if (!d) return; const x=list[+d.dataset.k]; ed.focus(); ed.setSelectionRange(x.s, x.e); scrollEdTo(x.s); };
  const ne=St.issues.filter(x=>x.kind==='e').length;
  if (ne) setStatus(`${ne} ${ne===1?'errore':'errori'} nel sorgente`, 'err');
  else if (St.issues.length) setStatus(`${St.issues.length} ${St.issues.length===1?'avviso':'avvisi'}`, 'wrn');
  else if (T && !/riscritt/.test($('st-msg').textContent)) setStatus('pronto', 'ok');
}

/* ---------- il cursore nel codice seleziona la cella corrispondente ---------- */
function cellAtPos(p){
  for (let ti=0; ti<St.tables.length; ti++){
    const T=St.tables[ti]; if (p<T.bs || p>T.be) continue;
    for (let r=0;r<T.rows.length;r++){
      const row=T.rows[r];
      for (let k=0;k<row.cells.length;k++){ const c=row.cells[k]; if (p>=c.s && p<=c.e) return {ti, r, c:cellCol(row,c)}; }
    }
  }
  return null;
}
function followCaret(){
  const x=cellAtPos(ed.selectionStart); if (!x) return;
  if (x.ti!==St.ti){ St.ti=x.ti; }
  St.sel={r:x.r, c:x.c, r2:x.r, c2:x.c}; View.render(); syncRibbon();
}

let pasted=false;
ed.addEventListener('paste', ()=>{ pasted=true; });
ed.addEventListener('input', ()=>{
  setSource(ed.value, {from:'code', coalesce:true});
  if (pasted){ pasted=false; if (Docs.split()) toast('Più tabelle incollate: una per voce dell\'elenco'); }
  acUpdate();
});
ed.addEventListener('focus', ()=>{ St.lastPane='src'; });
ed.addEventListener('keyup', e=>{ updatePos(); if (/^(Arrow|Home|End|Page)/.test(e.key)){ followCaret(); St.mark=null; updateHL(); } });
ed.addEventListener('click', ()=>{ updatePos(); followCaret(); St.mark=null; updateHL(); });
function updatePos(){ const t=St.src.slice(0,ed.selectionStart); const l=t.split('\n'); $('pos').textContent=`r ${l.length}, c ${l[l.length-1].length+1}`; }
function scrollEdTo(p, onlyIfHidden=false){
  const ln=lineOf(St.src,p); const lh=13*1.55; const y=(ln-1)*lh;
  if (onlyIfHidden && y>=ed.scrollTop && y<=ed.scrollTop+ed.clientHeight-2*lh) return;
  ed.scrollTop=Math.max(0,y-3*lh); syncScroll();
}

/* ---------- autocompletamento dei comandi delle tabelle (| indica dove resta il cursore) ---------- */
const AC_LIST = [
  ['toprule','regola superiore (booktabs)','\\toprule'], ['midrule','regola intermedia (booktabs)','\\midrule'], ['bottomrule','regola inferiore (booktabs)','\\bottomrule'],
  ['cmidrule','regola parziale (booktabs)','\\cmidrule(lr){|}'], ['addlinespace','spazio tra le righe (booktabs)','\\addlinespace'],
  ['hline','linea orizzontale','\\hline'], ['cline','linea parziale','\\cline{|}'],
  ['multicolumn','celle unite in orizzontale','\\multicolumn{2}{c}{|}'], ['multirow','celle unite in verticale','\\multirow{2}{*}{|}'],
  ['textbf','grassetto','\\textbf{|}'], ['emph','enfasi','\\emph{|}'], ['textit','corsivo','\\textit{|}'], ['texttt','spaziatura fissa','\\texttt{|}'],
  ['num','numero (siunitx)','\\num{|}'], ['SI','misura (siunitx)','\\SI{|}{}'], ['si','unità (siunitx)','\\si{|}'], ['qty','misura (siunitx 3)','\\qty{|}{}'], ['unit','unità (siunitx 3)','\\unit{|}'],
  ['makecell','cella su più righe (makecell)','\\makecell{|}'], ['rowcolor','colore della riga (colortbl)','\\rowcolor{|}'], ['cellcolor','colore della cella (colortbl)','\\cellcolor{|}'],
  ['rowcolors','righe alterne, prima della tabella (xcolor)','\\rowcolors{2}{|}{}'], ['textcolor','colore del testo (xcolor)','\\textcolor{|}{}'], ['SetCell','cella di tabularray: [c=2,r=1] per unire','\\SetCell[c=|]{c}'],
  ['caption','didascalia','\\caption{|}'], ['label','etichetta','\\label{tab:|}'], ['centering','centra la tabella','\\centering'],
  ['endhead','fine dell\'intestazione ripetuta (longtable)','\\endhead'], ['endfirsthead','fine della prima intestazione (longtable)','\\endfirsthead'],
  ['endfoot','fine del piede (longtable)','\\endfoot'], ['endlastfoot','fine dell\'ultimo piede (longtable)','\\endlastfoot'], ['tabularnewline','fine riga','\\tabularnewline'],
  ['begin','ambiente','\\begin{|}'], ['end','fine ambiente','\\end{|}'],
].map(([c,d,ins])=>({c,d,ins}));
let acItems=[], acSel=0, acRange=null, _mctx=null;
function acUpdate(){
  const p=ed.selectionStart; const before=St.src.slice(Math.max(0,p-40),p);
  const m = /\\([a-zA-Z]*)$/.exec(before);
  const box=$('ac');
  if (!m || m[1].length<1){ box.hidden=true; acItems=[]; return; }
  const w=m[1];
  acItems = AC_LIST.filter(x=>x.c.startsWith(w) && x.c!==w).sort((x,y)=>x.c.length-y.c.length).slice(0,12);
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
  const i=x.ins.indexOf('|'); const text=x.ins.replace('|','');
  const after=St.src.slice(acRange[1]);
  const plain = i<0 && after!=='' && isLetter(after[0]);
  const t = text + (plain?' ':'');
  setSource(St.src.slice(0,acRange[0])+t+after, {caret: acRange[0]+(i<0?t.length:i), from:'code'});
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
  if (e.key==='Tab' && !e.ctrlKey && !e.altKey){ e.preventDefault(); const a=ed.selectionStart; setSource(St.src.slice(0,a)+'  '+St.src.slice(ed.selectionEnd),{caret:a+2, coalesce:true, from:'code'}); return; }
  if (e.key==='Enter' && !e.ctrlKey && !e.altKey && !e.metaKey){ e.preventDefault(); const a=ed.selectionStart; const ls=St.src.lastIndexOf('\n',a-1)+1; const ind=/^[ \t]*/.exec(St.src.slice(ls,a))[0]; setSource(St.src.slice(0,a)+'\n'+ind+St.src.slice(ed.selectionEnd),{caret:a+1+ind.length, coalesce:true, from:'code'}); return; }
});
