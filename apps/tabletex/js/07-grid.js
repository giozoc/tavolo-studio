/* ============ GRIGLIA: vista tipo foglio di calcolo, selezione, modifica delle celle ============
   La griglia si ridisegna da capo dal modello a ogni cambio del sorgente: non ha uno stato suo, a parte la selezione.
   Coordinate: (r, c) sono riga e colonna della griglia visibile; una cella unita si indica con il suo angolo in alto a sinistra. */
const View = (()=>{
  const box=$('gridbox'), grid=$('grid'), ced=$('celled');
  let L=null, editing=null, dragging=false, zoom=+(store.get('tt-zoom')||100);
  const colName = c => { let s=''; c++; while (c>0){ const m=(c-1)%26; s=String.fromCharCode(65+m)+s; c=(c-m-1)/26; } return s; };
  const bars = seps => (seps||[]).filter(x=>x.k==='|').length;
  const RULE_W = {toprule:2, bottomrule:2, midrule:1, hline:1, specialrule:2, firsthline:1, lasthline:1, Xhline:2, hdashline:1};

  /* spessore delle regole a ogni confine tra righe, colonna per colonna */
  function boundary(items, C){
    const w=Array(C).fill(0), st=Array(C).fill('solid'), tl=Array(C).fill(false), tr=Array(C).fill(false);
    let fulls=0;
    for (const x of items){
      if (x.k!=='rule') continue;
      if (x.cmd in RULE_W){ fulls++; for (let c=0;c<C;c++){ w[c] = fulls>1 ? 3 : Math.max(w[c], RULE_W[x.cmd]); if (fulls>1) st[c]='double'; if (x.cmd==='hdashline') st[c]='dashed'; } }
      else if (x.range){
        for (let c=x.range.a-1;c<Math.min(C,x.range.b);c++){ w[c]=Math.max(w[c],1); if (x.cmd==='cdashline') st[c]='dashed'; }
        /* \cmidrule(lr): la regola si accorcia ai bordi indicati */
        const m=/^\\cmidrule\s*(?:\[[^\]]*\])?\s*\(([^)]*)\)/.exec(x.raw);
        if (m){ if (/l/.test(m[1]) && x.range.a-1<C) tl[x.range.a-1]=true; if (/r/.test(m[1]) && x.range.b-1<C) tr[x.range.b-1]=true; }
      }
    }
    if (fulls){ tl.fill(false); tr.fill(false); }
    return {w, st, tl, tr, space: items.some(x=>x.cmd==='addlinespace'), lt: items.filter(x=>/^end(first)?(head|foot)|^endlastfoot/.test(x.cmd||'')).map(x=>x.cmd), color: items.find(x=>x.cmd==='rowcolor')};
  }
  /* \rowcolors{n}{dispari}{pari} scritto prima della tabella (tra la tabella precedente e questa) */
  function rowColors(T){
    const prev=St.tables.filter(t=>t.e<=T.s).pop();
    const from=prev ? prev.e : 0, txt=St.src.slice(from, T.s);
    let last=null;
    for (const m of txt.matchAll(/\\rowcolors\s*(?:\[[^\]]*\])?\s*\{\s*(\d+)\s*\}\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g)){
      const ls=txt.lastIndexOf('\n', m.index)+1; if (/(^|[^\\])%/.test(txt.slice(ls, m.index))) continue;
      last={n:+m[1], odd:m[2].trim(), even:m[3].trim(), s:from+m.index, e:from+m.index+m[0].length};
    }
    return last;
  }
  /* rettangolo di selezione allargato fino a contenere per intero le celle unite */
  function range(sel=St.sel){
    let r1=Math.min(sel.r,sel.r2), r2=Math.max(sel.r,sel.r2), c1=Math.min(sel.c,sel.c2), c2=Math.max(sel.c,sel.c2);
    if (!L) return {r1,r2,c1,c2};
    for (let it=0; it<6; it++){
      let ch=false;
      for (let r=r1;r<=r2;r++) for (let c=c1;c<=c2;c++){
        const q=L[r]?.[c]; if (!q) continue;
        const [ar,ac] = q.cov ? q.cov : [r,c]; const a=L[ar]?.[ac]; if (!a || a.cov) continue;
        const nr1=Math.min(r1,ar), nc1=Math.min(c1,ac), nr2=Math.max(r2,ar+a.rs-1), nc2=Math.max(c2,ac+a.cs-1);
        if (nr1!==r1||nc1!==c1||nr2!==r2||nc2!==c2){ r1=nr1; c1=nc1; r2=nr2; c2=nc2; ch=true; }
      }
      if (!ch) break;
    }
    return {r1,r2,c1,c2};
  }
  /* cella del sorgente sotto la posizione (r,c) della griglia: riga del sorgente, cella e colonna d'inizio */
  function srcCell(r, c){
    const T=curT(); if (!T || !L) return null;
    let q=L[r]?.[c]; if (!q) return {sr:r, c, cell:null, T};
    let vr=r, vc=c;
    if (q.cov){ [vr,vc]=q.cov; q=L[vr][vc]; }
    const row=T.rows[q.r]; const cell=row.cells[q.k];
    return {sr:q.r, c:vc, vr, cell, row, T, anchor:q};
  }

  function render(){
    const T=curT();
    $('empty').hidden=!!T; box.hidden=!T;
    $('envtag').textContent = T ? T.env : '';
    $('tswitch').hidden = St.tables.length<2;
    if (St.tables.length>1) $('t-of').textContent = `${St.ti+1} di ${St.tables.length}`;
    if (!T){ L=null; grid.innerHTML=''; St.mark=null; return; }
    if (editing) closeEditor(false);
    L=layoutOf(T);
    const R=T.rows.length, C=T.ncols;
    St.sel.r=clamp(St.sel.r,0,Math.max(0,R-1)); St.sel.r2=clamp(St.sel.r2,0,Math.max(0,R-1));
    St.sel.c=clamp(St.sel.c,0,C-1); St.sel.c2=clamp(St.sel.c2,0,C-1);
    const B=[...T.rows.map(r=>boundary(r.pre, C)), boundary(T.fin, C)];
    const vb=Array.from({length:C+1}, (_,k)=>bars(T.specInfo.seps[k]));
    const al=T.cols.map(colAlign);
    /* colonne S: larghezza della parte intera e decimale, per l'allineamento sulla virgola */
    const siw=T.cols.map((col,c)=>{
      if (al[c]!=='num') return null; let wi=0, wf=0;
      for (const row of T.rows){ const f=row.special?null:row.cells.find(x=>cellCol(row,x)===c && !x.mc); if (!f || !f.t || !isSiNumber(f.t)) continue; const p=Render.siParts(f.t); if (p){ wi=Math.max(wi,p.i.length); wf=Math.max(wf,p.f.length); } }
      return {wi, wf};
    });
    const sr=range();
    const rc=rowColors(T);
    let h='<table class="tt"><thead><tr><th class="corner" data-all="1" title="Seleziona tutto"></th>';
    for (let c=0;c<C;c++){
      const col=T.cols[c]; const core=col ? St.src.slice(col.cs, col.e).replace(/\s+/g,'') : '?';
      h+=`<th data-col="${c}" class="${c>=sr.c1&&c<=sr.c2?'on':''}" title="Colonna ${colName(c)}: ${esc(col?St.src.slice(col.fs,col.fe):'')}">${colName(c)}<span class="ca">${esc(core.length>8?core.slice(0,7)+'…':core)}</span></th>`;
    }
    h+='</tr></thead><tbody>';
    for (let r=0;r<R;r++){
      const row=T.rows[r], b=B[r];
      const alt = rc && r+1>=rc.n ? ((r+1)%2 ? rc.odd : rc.even) : '';
      const rowBg = b.color ? Render.color(...(()=>{ const m=/\\rowcolor\s*(?:\[([^\]]*)\])?\s*\{([^}]*)\}/.exec(b.color.raw)||[]; return [m[1], m[2]]; })()) : alt ? Render.color('', alt) : null;
      h+=`<tr class="${b.lt.length?'lt':''}"><th class="rh${r>=sr.r1&&r<=sr.r2?' on':''}" data-row="${r}" title="Riga ${r+1}${b.lt.length?' · dopo '+b.lt.map(x=>'\\'+x).join(' '):''}">${r+1}</th>`;
      for (let c=0;c<C;c++){
        const q=L[r][c];
        if (q && q.cov) continue;
        if (!q){ h+=`<td class="miss${inSel(r,c,sr)?' sel':''}${isCur(r,c)?' cur':''}" data-r="${r}" data-c="${c}" title="Cella mancante: la riga ha meno celle delle colonne"></td>`; continue; }
        const cell=T.rows[q.r].cells[q.k];
        const info={};
        const top=B[r], bot=B[r+q.rs];
        const bt=Math.max(...top.w.slice(c,c+q.cs)), bb = r+q.rs===R ? Math.max(...bot.w.slice(c,c+q.cs)) : 0;
        let bl=vb[c], br = c+q.cs===C ? vb[C] : 0;
        if (cell.mc){ const lead=/^\|*/.exec(cell.mc.spec)[0].length, tail=/\|*$/.exec(cell.mc.spec)[0].length; if (c===0) bl=lead; br=tail; }
        const bw = n => n>1 ? '3px' : n ? '1px' : '0';
        /* regola parziale accorciata: si disegna come sfondo, rientrata ai lati */
        const trim = q.cs===1 && bt && (top.tl[c] || top.tr[c]);
        const tlw = top.tl[c] ? 4 : 0, trw = top.tr[c] ? 4 : 0;
        const style=[trim ? `--bt:0px;background-image:linear-gradient(#1a2130,#1a2130);background-repeat:no-repeat;background-size:calc(100% - ${tlw+trw}px) ${bt}px;background-position:${tlw}px 0` : `--bt:${bt}px`, bb?`--bb:${bb}px`:'', bl?`--bl:${bw(bl)}`:'', br?`--br:${bw(br)}`:'', top.st[c]!=='solid'&&bt?`border-top-style:${top.st[c]}`:'', bl>1?'border-left-style:double':'', br>1?'border-right-style:double':'', top.space?'padding-top:9px':''].filter(Boolean);
        let cls=['c'], content;
        if (q.special){ cls.push('spc'); content=Render.html(cell.t, info)||'<span class="ph">…</span>'; }
        else {
          const a = cell.mc ? (/[lcr]/.exec(cell.mc.spec.replace(/\{[^}]*\}|\[[^\]]*\]/g,''))||['c'])[0] : al[c];
          const colT = T.cols[c]?.type;
          if (/[pmb]/.test(colT||'') && !cell.mc) cls.push('para'); if (colT==='X' && !cell.mc) cls.push('x');
          if (a==='num' && cell.t && !cell.mc){
            if (isSiNumber(cell.t)){ const p=Render.siParts(cell.t), w=siw[c]; content=`<span class="num"><span class="i" style="min-width:${w.wi}ch">${esc(p.i)}</span><span class="f" style="min-width:${w.wf}ch">${esc(p.f)}</span></span>`; style.push('text-align:right'); }
            else { const braced=/^\{[\s\S]*\}$/.test(cell.t); content=Render.html(braced?cell.t.slice(1,-1):cell.t, info); style.push('text-align:center'); if (!braced && !/^\\multirow/.test(cell.v)) cls.push('warn'); }
          } else {
            content=Render.html(cell.t, info);
            style.push(`text-align:${a==='num'?'right':a==='r'?'right':a==='c'?'center':'left'}`);
          }
          if (cell.mr) cls.push('mr');
        }
        const bg = info.bg || rowBg; if (bg) style.push(`background-color:${bg}`);
        if (inSel(r,c,sr)) cls.push('sel'); if (isCur(r,c)) cls.push('cur');
        if (!q.special && found(cell.t)) cls.push('found');
        h+=`<td class="${cls.join(' ')}" data-r="${r}" data-c="${c}"${q.cs>1?` colspan="${q.cs}"`:''}${q.rs>1?` rowspan="${q.rs}"`:''} style="${style.join(';')}">${content||''}</td>`;
      }
      h+='</tr>';
    }
    h+='</tbody></table>';
    const notes=[];
    if (T.fin.some(x=>/^end/.test(x.cmd||''))) notes.push('longtable: '+T.fin.filter(x=>/^end/.test(x.cmd||'')).map(x=>'\\'+x.cmd).join(' '));
    if (T.w) notes.push('larghezza '+St.src.slice(T.w[0],T.w[1]));
    if (notes.length) h+=`<div class="ttnote">${notes.map(n=>`<span>${esc(n)}</span>`).join('')}</div>`;
    grid.innerHTML=h;
    MJ.fill(grid);
    markSource();
    $('gridinfo').textContent = `${R} ${R===1?'riga':'righe'} × ${C} ${C===1?'colonna':'colonne'}`;
  }
  /* celle che contengono il testo cercato (Cerca e sostituisci) */
  const found = t => { const f=St.find; if (!f || !f.q || !t) return false; return f.cs ? t.includes(f.q) : t.toLowerCase().includes(f.q.toLowerCase()); };
  const inSel = (r,c,sr) => r>=sr.r1 && r<=sr.r2 && c>=sr.c1 && c<=sr.c2 && !(sr.r1===sr.r2 && sr.c1===sr.c2);
  const isCur = (r,c) => { const q=L?.[St.sel.r]?.[St.sel.c]; const [ar,ac] = q?.cov ? q.cov : [St.sel.r, St.sel.c]; return r===ar && c===ac; };

  /* la cella corrente si segna nel sorgente */
  function markSource(){
    const x=srcCell(St.sel.r, St.sel.c);
    St.mark = x && x.cell ? [x.cell.vs, Math.max(x.cell.ve, x.cell.vs)] : null;
    if (St.mark && document.activeElement!==ed) scrollEdTo(St.mark[0], true);
    updateHL();
  }
  function select(r, c, extend=false){
    const T=curT(); if (!T) return;
    r=clamp(r,0,T.rows.length-1); c=clamp(c,0,T.ncols-1);
    if (extend){ St.sel.r2=r; St.sel.c2=c; } else St.sel={r, c, r2:r, c2:c};
    render(); syncRibbon();
    grid.querySelector('td.cur')?.scrollIntoView({block:'nearest', inline:'nearest'});
  }
  /* spostamento con le frecce, saltando le celle coperte da una cella unita */
  function move(dr, dc, extend=false){
    const T=curT(); if (!T) return;
    let r = extend ? St.sel.r2 : St.sel.r, c = extend ? St.sel.c2 : St.sel.c;
    const q=L[r]?.[c]; const a = q?.cov ? L[q.cov[0]][q.cov[1]] : q;
    const [ar,ac] = q?.cov ? q.cov : [r,c];
    if (!extend && a){ if (dr>0) r=ar+a.rs-1; if (dc>0) c=ac+a.cs-1; if (dr<0) r=ar; if (dc<0) c=ac; }
    select(r+dr, c+dc, extend);
  }

  /* ---------- modifica di una cella ---------- */
  function openEditor(r, c, initial=null){
    const x=srcCell(r, c); if (!x) return;
    const td=grid.querySelector(`td[data-r="${x.vr??r}"][data-c="${x.c}"]`) || grid.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
    if (!td) return;
    const raw = x.cell ? St.src.slice(x.cell.cs, x.cell.ce) : '';
    editing={r:x.vr??r, c:x.c, sr:x.sr, raw};
    const bx=box.getBoundingClientRect(), tr=td.getBoundingClientRect();
    ced.style.left=(tr.left-bx.left+box.scrollLeft-1)+'px'; ced.style.top=(tr.top-bx.top+box.scrollTop-1)+'px';
    ced.style.minWidth=(tr.width+2)+'px'; ced.style.width=Math.max(tr.width+2, 180)+'px'; ced.style.minHeight=(tr.height+2)+'px';
    ced.value = initial!==null ? initial : raw; ced.hidden=false; autosize();
    ced.focus(); ced.setSelectionRange(ced.value.length, ced.value.length);
    St.lastPane='grid';
  }
  function autosize(){ ced.style.height='auto'; ced.style.height=Math.max(ced.scrollHeight, parseFloat(ced.style.minHeight)||0)+'px'; }
  ced.addEventListener('input', autosize);
  function closeEditor(commit=true){
    if (!editing) return true;
    const e=editing; const v=ced.value;
    if (commit && v!==e.raw){
      const t=prepCell(v, e.c, e.raw);
      if (t===null) return false;
      editing=null; ced.hidden=true;
      doOp({op:'set', r:e.sr, c:e.c, t});
    } else { editing=null; ced.hidden=true; }
    box.focus({preventScroll:true});
    return true;
  }
  /* testo scritto nella cella → LaTeX valido per una cella: & % # protetti, a capo risolti, graffe controllate */
  function prepCell(v, c, old=''){
    const T=curT(); const col=T.cols[c]; let t=v.replace(/\r/g,'').replace(/\s*\n\s*/g,' ').trim();
    if (t===old.trim()) return old;
    t=protect(t);
    let d=0; for (let i=0;i<t.length;i++){ if (t[i]==='\\'){ i++; continue; } if (t[i]==='{') d++; else if (t[i]==='}' && --d<0) break; }
    if (d!==0){ toast('Graffe non bilanciate: controlla { e }'); return null; }
    if (hasTopNewline(t)){
      if (/[pmbX]/.test(col?.type||'')) t=t.replace(/\\\\(\[[^\]]*\])?/g, (m, i) => '\\newline ').replace(/\s+$/,'');
      else { t='\\makecell{'+t+'}'; hint('A capo nella cella: \\makecell (pacchetto makecell)'); }
    }
    if (col?.type==='S' && t && !isSiNumber(t) && !/^\{[\s\S]*\}$/.test(t) && !/^\\multi(column|row)/.test(t)) t='{'+t+'}';
    return t;
  }
  function hasTopNewline(t){ let d=0; for (let i=0;i<t.length;i++){ const ch=t[i]; if (ch==='\\'){ if (t[i+1]==='\\' && d===0) return true; i++; continue; } if (ch==='{') d++; else if (ch==='}') d--; } return false; }
  /* & % # non protetti diventano \& \% \#; _ e ^ fuori dalle formule diventano testo */
  function protect(t){
    let out='', math=false;
    for (let i=0;i<t.length;i++){
      const ch=t[i];
      if (ch==='\\'){ const c=readCs(t,i); if (c.name==='('||c.name==='[') math=true; if (c.name===')'||c.name===']') math=false; out+=t.slice(i,c.e); i=c.e-1; continue; }
      if (ch==='$'){ math=!math; out+=ch; continue; }
      if (ch==='&'||ch==='%'||ch==='#'){ out+='\\'+ch; continue; }
      if (!math && ch==='_'){ out+='\\_'; continue; }
      if (!math && ch==='^'){ out+='\\textasciicircum{}'; continue; }
      out+=ch;
    }
    return out;
  }
  ced.addEventListener('keydown', e=>{
    if (e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeEditor(false); return; }
    if (e.key==='Enter' && !e.shiftKey && !e.altKey){ e.preventDefault(); const r=editing.r, c=editing.c; if (closeEditor(true)) select(r+1>=curT().rows.length?r:r+1, c); return; }
    if (e.key==='Tab'){ e.preventDefault(); const r=editing.r, c=editing.c; if (closeEditor(true)) tabMove(r, c, e.shiftKey); return; }
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='e'){ e.preventDefault(); const r=editing.r, c=editing.c, v=ced.value; closeEditor(false); Formula.openFor(r, c, v); }
  });
  ced.addEventListener('blur', ()=>{ if (editing) setTimeout(()=>{ if (editing && document.activeElement!==ced) closeEditor(true); }, 0); });
  /* Tab: cella successiva; nell'ultima cella aggiunge una riga, come in un elaboratore di testi */
  function tabMove(r, c, back){
    const T=curT(); const C=T.ncols;
    const q=L[r]?.[c]; const cs = q && !q.cov ? q.cs : 1;
    if (back){ if (c>0) select(r, c-1); else if (r>0) select(r-1, C-1); return; }
    if (c+cs<C) select(r, c+cs);
    else if (r+1<T.rows.length) select(r+1, 0);
    else { St.sel={r:r+1,c:0,r2:r+1,c2:0}; doOp({op:'rowins', at:T.rows.length}); }
  }

  /* ---------- mouse ---------- */
  box.addEventListener('pointerdown', e=>{
    if (e.target===ced) return;
    const td=e.target.closest('td[data-r]'), th=e.target.closest('th');
    if (editing && !e.target.closest('#celled')) closeEditor(true);
    St.lastPane='grid';
    if (td){ e.preventDefault(); box.focus({preventScroll:true}); select(+td.dataset.r, +td.dataset.c, e.shiftKey); dragging=true; box.setPointerCapture?.(e.pointerId); return; }
    if (th){
      e.preventDefault(); box.focus({preventScroll:true}); const T=curT(); if (!T) return;
      if (th.dataset.all){ St.sel={r:0,c:0,r2:T.rows.length-1,c2:T.ncols-1}; }
      else if (th.dataset.col!==undefined){ const c=+th.dataset.col; if (e.shiftKey){ St.sel.c2=c; St.sel.r=0; St.sel.r2=T.rows.length-1; } else St.sel={r:0,c,r2:T.rows.length-1,c2:c}; }
      else if (th.dataset.row!==undefined){ const r=+th.dataset.row; if (e.shiftKey){ St.sel.r2=r; St.sel.c=0; St.sel.c2=T.ncols-1; } else St.sel={r,c:0,r2:r,c2:T.ncols-1}; }
      render(); syncRibbon();
    }
  });
  box.addEventListener('pointermove', e=>{
    if (!dragging) return;
    const el=document.elementFromPoint(e.clientX, e.clientY)?.closest?.('td[data-r]');
    if (el && (+el.dataset.r!==St.sel.r2 || +el.dataset.c!==St.sel.c2)){ St.sel.r2=+el.dataset.r; St.sel.c2=+el.dataset.c; render(); syncRibbon(); }
  });
  box.addEventListener('pointerup', ()=>{ dragging=false; });
  box.addEventListener('dblclick', e=>{
    const td=e.target.closest('td[data-r]'); if (!td) return;
    if (e.target.closest('.m')){ Formula.openFor(+td.dataset.r, +td.dataset.c, null, [...td.querySelectorAll('.m')].indexOf(e.target.closest('.m'))); return; }
    openEditor(+td.dataset.r, +td.dataset.c);
  });
  box.addEventListener('focus', ()=>{ St.lastPane='grid'; });

  /* ---------- tastiera ---------- */
  box.addEventListener('keydown', e=>{
    if (e.target===ced || !curT()) return;
    const k=e.key, mod=e.ctrlKey||e.metaKey;
    const sh=e.shiftKey;
    if (mod && !e.altKey && k.toLowerCase()==='z'){ e.preventDefault(); sh?redo():undo(); return; }
    if (mod && !e.altKey && k.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
    if (mod && k.toLowerCase()==='b'){ e.preventDefault(); Ribbon.act('bold'); return; }
    if (mod && k.toLowerCase()==='i'){ e.preventDefault(); Ribbon.act('italic'); return; }
    if (mod && k.toLowerCase()==='m'){ e.preventDefault(); Ribbon.act('mergeh'); return; }
    if (mod && k.toLowerCase()==='e'){ e.preventDefault(); Ribbon.act('formula'); return; }
    if (mod && k==='Enter'){ e.preventDefault(); Ribbon.act('rowins-below'); return; }
    if (mod && sh && k==='ArrowUp'){ e.preventDefault(); Ribbon.act('rowins-above'); return; }
    if (mod && (k==='-'||k==='_')){ e.preventDefault(); Ribbon.act('rowdel'); return; }
    if (e.altKey && (k==='ArrowUp'||k==='ArrowDown')){ e.preventDefault(); Ribbon.act(k==='ArrowUp'?'rowmove-up':'rowmove-down'); return; }
    if (e.altKey && (k==='ArrowLeft'||k==='ArrowRight')){ e.preventDefault(); Ribbon.act(k==='ArrowLeft'?'colmove-left':'colmove-right'); return; }    if (mod && k==='Home'){ e.preventDefault(); select(0,0,sh); return; }
    if (mod && k==='End'){ e.preventDefault(); const T=curT(); select(T.rows.length-1, T.ncols-1, sh); return; }
    if (mod && k.toLowerCase()==='a'){ e.preventDefault(); const T=curT(); St.sel={r:0,c:0,r2:T.rows.length-1,c2:T.ncols-1}; render(); syncRibbon(); return; }
    if (mod) return;
    if (k==='ArrowUp'){ e.preventDefault(); move(-1,0,sh); return; }
    if (k==='ArrowDown'){ e.preventDefault(); move(1,0,sh); return; }
    if (k==='ArrowLeft'){ e.preventDefault(); move(0,-1,sh); return; }
    if (k==='ArrowRight'){ e.preventDefault(); move(0,1,sh); return; }
    if (k==='Home'){ e.preventDefault(); select(St.sel.r, 0, sh); return; }
    if (k==='End'){ e.preventDefault(); select(St.sel.r, curT().ncols-1, sh); return; }
    if (k==='Tab'){ e.preventDefault(); tabMove(St.sel.r, St.sel.c, sh); return; }
    if (k==='Enter'||k==='F2'){ e.preventDefault(); openEditor(St.sel.r, St.sel.c); return; }
    if (k==='Escape'){ St.sel={r:St.sel.r, c:St.sel.c, r2:St.sel.r, c2:St.sel.c}; render(); return; }
    if (k==='Delete'||k==='Backspace'){ e.preventDefault(); clearSel(); return; }
    if (k.length===1 && !e.altKey){ e.preventDefault(); openEditor(St.sel.r, St.sel.c, k); return; }
  });
  /* svuota le celle selezionate (in un passo solo della cronologia) */
  function clearSel(){
    const sr=range(); const ops=[];
    for (let r=sr.r1;r<=sr.r2;r++) for (let c=sr.c1;c<=sr.c2;c++){
      const q=L[r]?.[c]; if (!q || q.cov) continue; const cell=curT().rows[q.r].cells[q.k];
      if (cell.t) ops.push({op:'set', r:q.r, c, t:''});
    }
    if (ops.length) doOp({op:'batch', ops});
  }
  /* testo delle celle selezionate, come righe separate da tabulazioni (per gli appunti) */
  function selText(){
    const T=curT(); const sr=range(); const out=[];
    for (let r=sr.r1;r<=sr.r2;r++){
      const line=[];
      for (let c=sr.c1;c<=sr.c2;c++){ const q=L[r]?.[c]; if (!q || q.cov){ line.push(''); continue; } line.push(T.rows[q.r].cells[q.k].t); }
      out.push(line.join('\t'));
    }
    return out.join('\n');
  }
  function selLatex(){
    const T=curT(); const sr=range(); const out=[];
    for (let r=sr.r1;r<=sr.r2;r++){
      const line=[];
      for (let c=sr.c1;c<=sr.c2;c++){ const q=L[r]?.[c]; if (!q){ line.push(''); continue; } if (q.cov) continue; const cell=T.rows[q.r].cells[q.k]; line.push(stripComments(St.src.slice(cell.vs, cell.ve))); }
      out.push(line.join(' & ')+' \\\\');
    }
    return out.join('\n');
  }
  document.addEventListener('copy', e=>{ if (document.activeElement!==box || !curT()) return; e.preventDefault(); e.clipboardData.setData('text/plain', selText()); e.clipboardData.setData('text/x-latex', selLatex()); toast('Celle copiate'); });
  document.addEventListener('cut', e=>{ if (document.activeElement!==box || !curT()) return; e.preventDefault(); e.clipboardData.setData('text/plain', selText()); clearSel(); });
  document.addEventListener('paste', e=>{ if (document.activeElement!==box) return; e.preventDefault(); Paste.fromClipboard(e.clipboardData); });

  /* ---------- zoom e cambio di tabella ---------- */
  function setZoom(z){ zoom=clamp(z,50,250); grid.style.setProperty('--gz', (15*zoom/100)+'px'); $('zlab').textContent=zoom+'%'; store.set('tt-zoom', zoom); }
  $('b-zin').onclick=()=>setZoom(zoom+10); $('b-zout').onclick=()=>setZoom(zoom-10); $('b-zfit').onclick=()=>setZoom(100);
  setZoom(zoom);
  $('t-prev').onclick=()=>{ if (St.ti>0){ St.ti--; St.sel={r:0,c:0,r2:0,c2:0}; render(); syncRibbon(); } };
  $('t-next').onclick=()=>{ if (St.ti<St.tables.length-1){ St.ti++; St.sel={r:0,c:0,r2:0,c2:0}; render(); syncRibbon(); } };

  return {render, range, srcCell, select, openEditor, closeEditor, prepCell, protect, layout:()=>L, colName, isEditing:()=>!!editing, selText, found, rowColors};
})();
