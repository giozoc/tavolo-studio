/* ============ BARRA MULTIFUNZIONE: righe, colonne, celle, regole, ambiente e stile ============ */
const Ribbon = (()=>{
  const pop=$('pop'); let popFor=null;
  const sel = () => View.range();
  const T = () => curT();
  const colCore = c => { const col=T()?.cols[c]; return col ? St.src.slice(col.cs, col.e).replace(/\s+/g,'') : 'c'; };
  const bars = k => (T().specInfo.seps[k]||[]).filter(x=>x.k==='|').length;
  const isBook = () => Grid.bookish(Grid.of(T(), St.src)) || !Grid.of(T(), St.src).rows.some(r=>r.rules.length) && !T().specInfo.items.some(x=>x.k==='|');
  /* celle ancora (non coperte) della selezione: [{r (riga del sorgente), c, cell}] */
  function anchors(){
    const L=View.layout(); const sr=sel(); const out=[];
    for (let r=sr.r1;r<=sr.r2;r++) for (let c=sr.c1;c<=sr.c2;c++){ const q=L[r]?.[c]; if (!q || q.cov) continue; out.push({r:q.r, vr:r, c, cell:T().rows[q.r].cells[q.k], special:!!q.special}); }
    return out;
  }
  /* table-format di siunitx calcolato sui numeri della colonna (o su un elenco di valori) */
  function siFormat(c){
    const vals=[]; for (const row of T().rows){ if (row.special) continue; const f=row.cells.find(x=>cellCol(row,x)===c && !x.mc); if (f) vals.push(f.t); }
    return fmtOf(vals);
  }
  function fmtOf(vals){
    let wi=0, wf=0, neg=false, any=false;
    for (const t of vals){ if (!t || !isSiNumber(t)) continue;
      any=true; const m=/^\s*([+-]?)(\d*)(?:[.,](\d*))?/.exec(t.replace(/\s+/g,'')); if (!m) continue; if (m[1]==='-') neg=true; wi=Math.max(wi,m[2].length); wf=Math.max(wf,(m[3]||'').length); }
    return any ? `S[table-format=${neg?'-':''}${wi||1}.${wf}]` : 'S';
  }
  /* \cmd{…} intorno a tutta la cella (anche dentro le graffe di una colonna S): mode 'toggle' o 'on' */
  function wrapOps(xs, cmd, mode='toggle'){
    const Tn=T();
    const inner = t => { let x=t; if (x.startsWith('{') && matchClose(x,0)===x.length-1) x=x.slice(1,-1); const h='\\'+cmd+'{'; return x.startsWith(h) && matchClose(x, h.length-1)===x.length-1 ? x.slice(h.length, -1) : null; };
    const on = mode==='toggle' && xs.every(x=>inner(x.cell.t)!==null);
    return xs.filter(x=>on || inner(x.cell.t)===null).map(x=>{
      let t=x.cell.t; const braced=t.startsWith('{') && matchClose(t,0)===t.length-1;
      const sCol = Tn.cols[x.c]?.type==='S' && !x.cell.mc;
      if (on){ const m=inner(t); t = sCol && !isSiNumber(m) ? '{'+m+'}' : m; }
      else t = sCol ? `{\\${cmd}{${braced?t.slice(1,-1):t}}}` : `\\${cmd}{${t}}`;
      return {op:'set', r:x.r, c:x.c, t};
    });
  }
  const isTblr = () => TBLR_ENVS.has(T().env);
  function act(a, arg){
    if (!T()){ toast('Nessuna tabella: creane una con «Nuova» o «Importa»'); return; }
    if (View.isEditing()) View.closeEditor(true);
    const sr=sel(), Tn=T(), R=Tn.rows.length, C=Tn.ncols;
    const S=(r,c)=>({r,c,r2:r,c2:c});
    switch(a){
      case 'rowins-above': doOp({op:'rowins', at:sr.r1}, {sel:S(sr.r1, St.sel.c)}); break;
      case 'rowins-below': doOp({op:'rowins', at:sr.r2+1}, {sel:S(sr.r2+1, St.sel.c)}); break;
      case 'rowdel': {
        if (sr.r2-sr.r1+1>=R){ toast('La tabella deve avere almeno una riga'); return; }
        const ops=[]; for (let r=sr.r2;r>=sr.r1;r--) ops.push({op:'rowdel', r});
        doOp({op:'batch', ops}, {sel:S(Math.min(sr.r1, R-1-(sr.r2-sr.r1+1)), St.sel.c)}); break;
      }
      case 'rowmove-up': case 'rowmove-down': {
        const up = a==='rowmove-up';
        if (up ? sr.r1===0 : sr.r2>=R-1) return;
        const ops=[]; if (up) for (let r=sr.r1;r<=sr.r2;r++) ops.push({op:'rowmove', r, d:-1}); else for (let r=sr.r2;r>=sr.r1;r--) ops.push({op:'rowmove', r, d:1});
        const d=up?-1:1; doOp({op:'batch', ops}, {sel:{r:St.sel.r+d, c:St.sel.c, r2:St.sel.r2+d, c2:St.sel.c2}}); break;
      }
      case 'colins-left': doOp({op:'colins', at:sr.c1, type:newColType(sr.c1)}, {sel:S(St.sel.r, sr.c1)}); break;
      case 'colins-right': doOp({op:'colins', at:sr.c2+1, type:newColType(sr.c2)}, {sel:S(St.sel.r, sr.c2+1)}); break;
      case 'coldel': {
        if (sr.c2-sr.c1+1>=C){ toast('La tabella deve avere almeno una colonna'); return; }
        const ops=[]; for (let c=sr.c2;c>=sr.c1;c--) ops.push({op:'coldel', c});
        doOp({op:'batch', ops}, {sel:S(St.sel.r, Math.max(0, Math.min(sr.c1, C-1-(sr.c2-sr.c1+1))))}); break;
      }
      case 'align': align(arg, sr); break;
      case 'mergeh': case 'mergev': merge(a, sr); break;
      case 'split': {
        /* il testo che finisce in una colonna S va tra graffe se non è un numero */
        const sText = x => { const t=x.cell.t; return Tn.cols[x.c]?.type==='S' && t && !isSiNumber(t) && !(t.startsWith('{') && matchClose(t,0)===t.length-1) ? '{'+t+'}' : t; };
        const ops=anchors().filter(x=>x.cell.mc||x.cell.mr).sort((x,y)=>y.r-x.r||y.c-x.c).map(x=>({op:'split', r:x.r, c:x.c, t:sText(x)}));
        if (!ops.length){ toast('Nessuna cella unita nella selezione'); return; }
        doOp({op:'batch', ops}, {msg:'Celle divise'}); break;
      }
      case 'bold': case 'italic': {
        const xs=anchors().filter(x=>x.cell.t && !x.special);
        if (!xs.length) return;
        doOp({op:'batch', ops:wrapOps(xs, a==='bold' ? 'textbf' : 'emph')}); break;
      }
      case 'colmove-left': case 'colmove-right': {
        const left = a==='colmove-left';
        if (left ? sr.c1===0 : sr.c2>=C-1) return;
        const lo = left ? sr.c1-1 : sr.c1, hi = left ? sr.c2 : sr.c2+1;
        const span = Tn.rows.some(row=>!row.special && row.cells.some(x=>{ const g=cellCol(row,x), n=x.mc?x.mc.n:1; return n>1 && g<=hi && g+n-1>=lo; }));
        if (span){ toast('Una cella unita (\\multicolumn) attraversa queste colonne: dividila prima'); return; }
        const ops=[]; if (left) for (let c=sr.c1;c<=sr.c2;c++) ops.push({op:'colmove', c, d:-1}); else for (let c=sr.c2;c>=sr.c1;c--) ops.push({op:'colmove', c, d:1});
        const d=left?-1:1; doOp({op:'batch', ops}, {sel:{r:St.sel.r, c:St.sel.c+d, r2:St.sel.r2, c2:St.sel.c2+d}}); break;
      }
      case 'transpose': transpose(); break;
      case 'endhead': {
        if (!/^longtable/.test(Tn.env)){ toast('L\'intestazione ripetuta è di longtable: cambia prima l\'ambiente'); return; }
        const at=[...Tn.rows.map((r,b)=>[b, r.pre]), [R, Tn.fin]].find(([,L])=>L.some(x=>x.cmd==='endhead'));
        if (at){ doOp({op:'rmrule', b:at[0], cmd:'endhead'}, {msg:'\\endhead tolto: l\'intestazione non si ripete più'}); break; }
        if (sr.r2+1>=R || Tn.rows.slice(0, sr.r2+1).some(r=>r.special && sr.r2===0)){ toast('Seleziona le righe dell\'intestazione (non l\'ultima riga)'); return; }
        doOp({op:'addrule', b:sr.r2+1, text:'\\endhead'}, {msg:`Le righe 1–${sr.r2+1} si ripetono in cima a ogni pagina (\\endhead)`}); break;
      }
      case 'cellalign': cellAlign(arg); break;
      case 'max': case 'min': Tools.extreme(a); break;
      case 'sort': Tools.sort(arg); break;
      case 'round': Tools.round(arg); break;
      case 'color': Tools.color(arg); break;
      case 'formula': Formula.openFor(St.sel.r, St.sel.c); break;
      case 'cmid': {
        if (sr.r2+1>R){ return; }
        const text = isBook() || !Grid.of(Tn, St.src).rows.some(r=>r.rules.some(x=>/^\\hline/.test(x))) ? `\\cmidrule(lr){${sr.c1+1}-${sr.c2+1}}` : `\\cline{${sr.c1+1}-${sr.c2+1}}`;
        doOp({op:'cmid', b:sr.r2+1, a:sr.c1+1, z:sr.c2+1, text}, {msg:text}); break;
      }
      case 'cmidx': doOp({op:'cmidx', b:sr.r2+1}); break;
      case 'rule': doOp({op:'rule', b: arg.where==='above' ? sr.r1 : sr.r2+1, kind:arg.kind}); break;
      case 'style': doOp({op:'style', to:arg}, {msg: arg==='booktabs' ? 'Regole booktabs (pacchetto booktabs)' : arg==='grid' ? 'Griglia con \\hline e |' : 'Regole tolte'}); break;
      case 'env': setEnv(arg); break;
    }
  }
  /* righe ↔ colonne: solo tabelle senza celle unite, didascalie e regole parziali o colori di riga */
  function transpose(){
    const Tn=T(), src=St.src;
    if (Tn.rows.some(r=>r.special)){ toast('Togli prima la didascalia della longtable'); return; }
    if (Tn.rows.some(r=>r.cells.some(x=>x.mc||x.mr))){ toast('Dividi prima le celle unite: nella tabella trasposta non avrebbero posto'); return; }
    const other=[...Tn.rows.flatMap(r=>r.pre), ...Tn.fin].find(x=>x.k==='rule' && !FULL_RULES.has(x.cmd));
    if (other){ toast(`Togli prima \\${other.cmd}: nella tabella trasposta non saprebbe dove andare`); return; }
    const g=Grid.of(Tn, src), R=g.rows.length, C=Tn.ncols;
    const cellT = (r, c) => { const f=Grid.find(g.rows[r], c); return f ? g.rows[r].cells[f.k].t : ''; };
    const bars = C>1 && Tn.specInfo.seps.slice(1, C).every(s=>s.length===1 && s[0].k==='|' && s[0].e-s[0].s===1);
    const hasS = Tn.cols.some(c=>c.type==='S');
    const first = (Tn.cols[0] && /^[lcr]$/.test(src.slice(Tn.cols[0].cs, Tn.cols[0].e).trim())) ? src.slice(Tn.cols[0].cs, Tn.cols[0].e).trim() : 'l';
    const types=[first];
    for (let j=1;j<R;j++){
      const vals=Array.from({length:C-1}, (_,c)=>cellT(j, c+1)).filter(Boolean);
      const num = vals.length && vals.every(isSiNumber);
      types.push(num ? (hasS ? fmtOf(vals) : 'r') : 'c');
    }
    if (/^(tabularx|tabulary|NiceTabularX)$/.test(Tn.env) && !types.includes('X')) types[0]='X';
    const ops=[{op:'transpose', types, bars}];
    /* nelle nuove colonne S il testo va tra graffe */
    types.forEach((t,j)=>{ if (!/^S/.test(t)) return; for (let i=0;i<C;i++){ const v=cellT(j, i); if (v && !isSiNumber(v) && !/^\{[\s\S]*\}$/.test(v)) ops.push({op:'set', r:i, c:j, t:'{'+v+'}'}); } });
    /* commenti fuori dalle celle: non hanno un posto nella tabella nuova */
    const keep=Tn.rows.flatMap(r=>r.cells.map(x=>[x.vs, x.ve]));
    let lost=0; for (let i=Tn.bs;i<Tn.be;i++){ const z=keep.find(([a,b])=>i>=a&&i<b); if (z){ i=z[1]-1; continue; } if (src[i]==='\\'){ i++; continue; } if (src[i]==='%'){ lost++; i=commentEnd(src,i,Tn.be)-1; } }
    doOp({op:'batch', ops}, {sel:{r:0,c:0,r2:0,c2:0}, msg:`Righe e colonne scambiate: ${C} righe × ${R} colonne`+(lost?` · ${lost} ${lost===1?'commento fuori dalle celle tolto':'commenti fuori dalle celle tolti'}`:'')});
  }
  /* allineamento di una cella sola: \multicolumn{1}{c}{…}; se torna quello della colonna, il \multicolumn se ne va */
  function cellAlign(al){
    const Tn=T(), src=St.src;
    if (isTblr()){ toast('In tabularray l\'allineamento di una cella si scrive con \\SetCell{c}'); return; }
    const barsAt = k => '|'.repeat(bars(k));
    const ops=[];
    for (const x of anchors()){
      if (x.special) continue;
      const c=x.cell; let content, n=1;
      if (c.mc){ const r=readArgs(src, c.mc.s+12, c.ve, '{{{'); if (!r) continue; content=src.slice(r.args[2][0], r.args[2][1]); n=c.mc.n; }
      else content = c.vs<c.ve ? src.slice(c.vs, c.ve) : '';
      const lead = x.c===0 ? barsAt(0) : '', tail = barsAt(x.c+n);
      const colA = colAlign(Tn.cols[x.c]);
      /* torna come la colonna: senza \multicolumn, se quello che c'era non aggiungeva altro che l'allineamento */
      const plain = c.mc && /^\|*[lcr]\|*$/.test(c.mc.spec) && c.mc.spec.replace(/[lcr]/,'')===lead+tail;
      if (n===1 && al===colA && (!c.mc || plain)){ if (c.mc) ops.push({op:'raw', r:x.r, c:x.c, v:content}); continue; }
      ops.push({op:'raw', r:x.r, c:x.c, v:`\\multicolumn{${n}}{${lead+al+tail}}{${content}}`});
    }
    if (!ops.length){ toast('Le celle hanno già questo allineamento'); return; }
    doOp({op:'batch', ops}, {msg:`Allineamento della cella: ${al} (\\multicolumn{1}{${al}}{…})`});
  }
  function newColType(c){ const t=colCore(c); return /^S/.test(t) ? t : /^[lcrXpmb]/.test(t) ? t : 'c'; }
  function align(type, sr){
    const Tn=T(); const ops=[]; const toX=type==='X';
    if (toX && /^longtable/.test(Tn.env)){ toast('Le colonne X servono a tabularx: in una longtable usa p (larghezza fissa)'); return; }
    for (let c=sr.c1;c<=sr.c2;c++){
      const old=Tn.cols[c]; if (!old) continue;
      let t = type==='S' ? siFormat(c) : type==='p' ? 'p{4cm}' : type;
      ops.push({op:'align', c, type:t});
      /* in una colonna S il testo va tra graffe; uscendo da S le graffe aggiunte si tolgono */
      for (let r=0;r<Tn.rows.length;r++){
        const row=Tn.rows[r]; if (row.special) continue; const f=row.cells.find(x=>cellCol(row,x)===c && !x.mc); if (!f || !f.t) continue;
        const braced=/^\{[\s\S]*\}$/.test(f.t) && matchClose(f.t,0)===f.t.length-1;
        if (type==='S' && f.mr && !f.mc) ops.push({op:'raw', r, c, v:`\\multicolumn{1}{c}{${stripComments(St.src.slice(f.vs, f.ve))}}`});
        else if (type==='S' && !isSiNumber(f.t) && !braced && !f.mr) ops.push({op:'set', r, c, t:'{'+f.t+'}'});
        if (type!=='S' && old.type==='S' && braced) ops.push({op:'set', r, c, t:f.t.slice(1,-1)});
      }
    }
    if (toX && !/^(tabularx|tabulary)$/.test(Tn.env)) ops.unshift({op:'env', env:'tabularx', width:'\\textwidth'});
    doOp({op:'batch', ops}, {msg: type==='S' ? 'Colonna numerica S (pacchetto siunitx)' : type==='X' ? 'Colonna X (pacchetto tabularx)' : type==='p' ? 'Larghezza modificabile nel codice: p{4cm}' : ''});
  }
  function merge(kind, sr){
    const Tn=T(); const ops=[];
    const rowsSpecial = r => Tn.rows[r]?.special;
    if (isTblr()){ toast('In tabularray le celle si uniscono con \\SetCell[c=2,r=1]{c}, da scrivere nel codice'); return; }
    if (kind==='mergeh' && sr.c1===sr.c2 && sr.r1===sr.r2){ toast('Seleziona almeno due celle (Maiusc+frecce o trascinando)'); return; }
    if (kind==='mergev' && sr.r1===sr.r2){ toast('Seleziona celle su almeno due righe'); return; }
    if ([...Array(sr.r2-sr.r1+1)].some((_,i)=>rowsSpecial(sr.r1+i))){ toast('La selezione comprende una riga di didascalia'); return; }
    if (sr.c1<sr.c2){
      const lead = sr.c1===0 ? '|'.repeat(bars(0)) : '', tail='|'.repeat(bars(sr.c2+1));
      /* ogni riga del blocco: anche quelle coperte da \multirow ricevono un \multicolumn vuoto, come vuole LaTeX */
      for (let r=sr.r1;r<=sr.r2;r++) ops.push({op:'mergeh', r, c1:sr.c1, c2:sr.c2, spec:lead+'c'+tail});
    }
    if (sr.r1<sr.r2 && (kind==='mergev' || sr.c1<sr.c2)) ops.push({op:'mergev', c:sr.c1, r1:sr.r1, r2:sr.r2, ...(Tn.cols[sr.c1]?.type==='S' && sr.c1===sr.c2 ? {mc:'c'} : {})});
    if (!ops.length) return;
    St.sel={r:sr.r1, c:sr.c1, r2:sr.r1, c2:sr.c1};
    doOp({op:'batch', ops}, {msg: ops.some(o=>o.op==='mergev') ? '\\multirow (pacchetto multirow)' : '\\multicolumn'});
  }
  function setEnv(env){
    const Tn=T(); if (Tn.env===env) return;
    /* una longtable con didascalia o intestazioni ripetute non ha un equivalente diretto in tabular */
    if (/^longtable/.test(Tn.env) && (Tn.rows.some(r=>r.special) || [...Tn.rows.flatMap(r=>r.pre), ...Tn.fin].some(x=>/^end(first)?(head|foot)$|^endlastfoot$/.test(x.cmd||'')))){
      toast('Togli prima la didascalia e \\endhead/\\endfoot: in tabular non esistono'); syncRibbon(); return false;
    }
    if (Tn.kv){ toast('La specifica è dentro colspec={…}: l\'ambiente si cambia nel codice'); syncRibbon(); return false; }
    if (Tn.post && !NICE_ENVS.has(env)){ toast('Togli prima le opzioni […] dopo la specifica: sono di NiceTabular'); syncRibbon(); return false; }
    if (TBLR_ENVS.has(env) && Tn.rows.some(r=>r.cells.some(x=>x.mc||x.mr))){ toast('tabularray non usa \\multicolumn e \\multirow: dividi prima le celle unite'); syncRibbon(); return false; }
    const ops=[{op:'env', env, width:'\\textwidth'}];
    if (env==='tabularx' && !Tn.cols.some(c=>c.type==='X')){
      /* la colonna di testo più lunga diventa X */
      let best=-1, len=-1;
      Tn.cols.forEach((col,c)=>{ if (!/[lp]/.test(col.type)) return; const n=Tn.rows.reduce((a,row)=>{ const f=row.cells.find(x=>cellCol(row,x)===c); return a+(f?f.t.length:0); },0); if (n>len){ len=n; best=c; } });
      if (best<0) best=0;
      ops.push({op:'align', c:best, type:'X'});
    }
    if (env!=='tabularx' && Tn.env==='tabularx') Tn.cols.forEach((col,c)=>{ if (col.type==='X') ops.push({op:'align', c, type:'l'}); });
    const ok=doOp({op:'batch', ops}, {msg: env==='longtable' ? 'longtable (pacchetto longtable): va fuori da table' : env==='tabularx' ? 'tabularx (pacchetto tabularx)' : TBLR_ENVS.has(env) ? 'tblr (pacchetto tabularray): celle unite con \\SetCell' : NICE_ENVS.has(env) ? 'NiceTabular (pacchetto nicematrix)' : ''});
    if (ok && TBLR_ENVS.has(Tn.env) && !TBLR_ENVS.has(env) && /\\Set(Cell|Row)/.test(St.src.slice(curT().bs, curT().be))) toast('\\SetCell e \\SetRow esistono solo in tabularray: riscrivili nel codice');
    if (ok && env==='longtable' && /\\begin\s*\{table\*?\}/.test(St.src.slice(0, curT().s))) toast('longtable non va dentro un ambiente table: spostala fuori');
  }

  /* ---------- finestre a comparsa ---------- */
  const RULES_MENU = [['toprule','Regola superiore','booktabs',2],['midrule','Regola intermedia','booktabs',1],['bottomrule','Regola inferiore','booktabs',2],['hline','Linea orizzontale','\\hline',1],['none','Nessuna regola','',0]];
  const ruleSvg = w => `<svg viewBox="0 0 46 14"><path d="M2 3h42M2 11h42" stroke="currentColor" stroke-width=".6" opacity=".35"/>${w?`<path d="M2 7h42" stroke="currentColor" stroke-width="${w}"/>`:''}</svg>`;
  function openPop(kind, anchor){
    if (popFor===kind && !pop.hidden){ closePop(); return; }
    popFor=kind; let h='';
    if (kind==='ruleabove'||kind==='rulebelow'){
      const where = kind==='ruleabove'?'above':'below';
      h=`<div class="gh">Regola ${where==='above'?'sopra':'sotto'} la selezione</div><div class="ropt">`+RULES_MENU.map(([k,l,p,w])=>`<button data-rule="${k}" data-where="${where}">${ruleSvg(w)}${l}<code>${k==='none'?'':'\\'+k}</code></button>`).join('')+'</div>'+
        `<div class="gnote">Con booktabs: <code>\\toprule</code> in cima, <code>\\midrule</code> sotto l'intestazione, <code>\\bottomrule</code> in fondo. Le regole parziali (<code>\\cmidrule</code>) si mettono con «Parziale».</div>`;
    } else if (kind==='style'){
      h=`<div class="gh">Stile delle regole</div><div class="ropt">
        <button data-style="booktabs">${ruleSvg(2)}Booktabs<code>\\toprule \\midrule \\bottomrule</code></button>
        <button data-style="grid">${ruleSvg(1)}Griglia<code>| e \\hline ovunque</code></button>
        <button data-style="plain">${ruleSvg(0)}Senza regole<code></code></button></div>
        <div class="gnote">Si riscrivono solo le regole e i separatori <code>|</code> della specifica: celle, commenti e a capo restano.</div>`;
    } else if (kind==='new'){
      h=`<div class="gh">Nuova tabella<small id="pk-l">3 × 3</small></div><div class="pick" id="pk">${Array.from({length:80},(_,k)=>`<i data-r="${Math.floor(k/10)+1}" data-c="${k%10+1}"></i>`).join('')}</div>
        <div class="gform"><label for="pk-st">Stile</label><select id="pk-st"><option value="booktabs">booktabs</option><option value="grid">griglia</option><option value="plain">senza regole</option></select>
        <label for="pk-env">Ambiente</label><select id="pk-env"><option>tabular</option><option>tabularx</option><option>longtable</option></select>
        <label for="pk-fl">Dentro table</label><input type="checkbox" id="pk-fl" checked style="width:auto"></div>
        <div class="gnote">Clic sulla dimensione per creare la tabella. Se il sorgente ha già una tabella, la nuova si aggiunge in fondo.</div>`;
    } else if (Tools.pops[kind]){
      if (!T()){ toast('Nessuna tabella: creane una con «Nuova» o «Importa»'); popFor=null; return; }
      h=Tools.pops[kind].html();
    }
    pop.innerHTML=h; pop.hidden=false;
    Tools.pops[kind]?.bind?.(pop);
    const b=anchor.getBoundingClientRect(); pop.style.left=Math.max(8, Math.min(b.left, innerWidth-pop.offsetWidth-8))+'px'; pop.style.top=(b.bottom+4)+'px';
    if (kind==='new'){
      const pk=$('pk');
      pk.addEventListener('pointerover', e=>{ const i=e.target.closest('i'); if (!i) return; const r=+i.dataset.r, c=+i.dataset.c; pk.querySelectorAll('i').forEach(x=>x.classList.toggle('on', +x.dataset.r<=r && +x.dataset.c<=c)); $('pk-l').textContent=`${r} × ${c}`; });
      pk.addEventListener('click', e=>{ const i=e.target.closest('i'); if (!i) return; newTable(+i.dataset.r, +i.dataset.c, {style:$('pk-st').value, env:$('pk-env').value, float:$('pk-fl').checked}); closePop(); });
    }
  }
  function closePop(){ const k=popFor; pop.hidden=true; popFor=null; Tools.pops[k]?.close?.(); }
  pop.addEventListener('click', e=>{
    const b=e.target.closest('button'); if (!b) return;
    if (b.dataset.rule){ closePop(); act('rule', {kind:b.dataset.rule, where:b.dataset.where}); }
    if (b.dataset.style){ closePop(); act('style', b.dataset.style); }
  });
  /* la ricerca resta aperta mentre si scelgono le celle */
  document.addEventListener('pointerdown', e=>{ if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('[data-pop],#b-new,#b-find') && !(popFor==='find' && e.target.closest('#gridbox'))) closePop(); });
  document.addEventListener('keydown', e=>{ if (e.key==='Escape' && !pop.hidden){ closePop(); e.stopPropagation(); } }, true);
  document.querySelectorAll('[data-pop]').forEach(b=>b.addEventListener('click', ()=>openPop(b.dataset.pop, b)));
  $('b-new').onclick=()=>openPop('new', $('b-new'));
  document.querySelectorAll('#ribbon [data-act]').forEach(b=>b.addEventListener('click', ()=>{ act(b.dataset.act); if (St.lastPane==='grid') $('gridbox').focus({preventScroll:true}); }));
  document.querySelectorAll('#ribbon [data-al]').forEach(b=>b.addEventListener('click', ()=>{ act('align', b.dataset.al); $('gridbox').focus({preventScroll:true}); }));
  document.querySelectorAll('#ribbon [data-cal]').forEach(b=>b.addEventListener('click', ()=>{ act('cellalign', b.dataset.cal); $('gridbox').focus({preventScroll:true}); }));
  /* il pulsante non ruba la selezione alla griglia */
  $('ribbon').addEventListener('pointerdown', e=>{ if (e.target.closest('button')) e.preventDefault(); });
  $('envsel').addEventListener('change', ()=>{ act('env', $('envsel').value); });

  /* nuova tabella: si aggiunge al sorgente (o lo sostituisce, se non c'è altro) */
  function newTable(r, c, opts){
    const data=Array.from({length:r}, ()=>Array(c).fill(''));
    insertTable(genTable(data, {...opts, align:Array(c).fill('l'), header:r>1}));
  }
  function insertTable(text){
    const src=St.src.replace(/\s+$/,'');
    const keep = St.tables.length || src.trim();
    St.sel={r:0,c:0,r2:0,c2:0};
    setSource(keep ? src+'\n\n'+text+'\n' : text+'\n');
    St.ti=St.tables.length-1; View.render(); syncRibbon();
    $('gridbox').focus({preventScroll:true});
  }
  return {act, openPop, closePop, insertTable, siFormat, fmtOf, wrapOps, anchors, isOpen:k=>popFor===k && !pop.hidden};
})();

/* stato della barra: ambiente, allineamento della colonna corrente */
function syncRibbon(){
  const T=curT();
  $('envsel').value = T && [...$('envsel').options].some(o=>o.value===T.env) ? T.env : 'tabular';
  $('envsel').disabled=!T;
  const c=St.sel.c, col=T?.cols[c];
  const core = col ? St.src.slice(col.cs, col.e).replace(/\s+/g,'') : '';
  document.querySelectorAll('#ribbon [data-al]').forEach(b=>b.classList.toggle('on', !!col && core[0]===b.dataset.al));
  document.querySelector('#ribbon .algrp:not(.cal)').title = col ? `Colonna ${View.colName(c)}: ${St.src.slice(col.fs, col.fe)}` : '';
}
