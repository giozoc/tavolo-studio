/* ============ STRUMENTI: ordinamento, numeri, colori, cerca e sostituisci, immagine della tabella ============
   Ogni strumento si traduce nelle operazioni della griglia (03-model.js e 04-ops.js), con la stessa verifica:
   ordinare è una permutazione delle righe, arrotondare è un gruppo di celle riscritte, e così via.
   Fa eccezione \rowcolors, che sta prima della tabella e si scrive direttamente nel sorgente. */
const Tools = (()=>{
  const T = () => curT();
  const sel = () => View.range();
  const lineStart = (src, p) => src.lastIndexOf('\n', p-1)+1;

  /* ---------- numeri nelle celle ---------- */
  /* valore di una cella: anche con la virgola, tra graffe, dentro \textbf, \num o $…$; null se non è un numero */
  function numOf(t){
    let x=(t||'').trim();
    for(;;){
      if (x.startsWith('{') && matchClose(x,0)===x.length-1){ x=x.slice(1,-1).trim(); continue; }
      const w=/^\\(textbf|emph|textit|num|mathbf|ensuremath)\s*\{/.exec(x);
      if (w && matchClose(x, w[0].length-1)===x.length-1){ x=x.slice(w[0].length, -1).trim(); continue; }
      if (/^\$[^$]*\$$/.test(x)){ x=x.slice(1,-1).trim(); continue; }
      break;
    }
    x=x.replace(/\\,|\s+/g,'').replace(/^−/,'-');
    if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(x)) return null;
    return parseFloat(x.replace(',','.'));
  }
  /* numero dentro un involucro LaTeX (\textbf{…}, \SI{…}{\metre}, $…$, …): prefisso, numero, suffisso */
  function numCore(t){
    const m=/^([\s\S]*?)([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+))([\s\S]*)$/.exec(t||''); if (!m) return null;
    if (!/^(?:\s|\{|\$|\\[a-zA-Z]+\s*\{|\\[a-zA-Z]+\s)*$/.test(m[1])) return null;
    if (!/^(?:\s|\}|\$|\\%|\{[^{}0-9]*\})*$/.test(m[3])) return null;
    return {pre:m[1], num:m[2], post:m[3]};
  }
  /* arrotondamento sulle cifre (niente errori di virgola mobile): metà verso l'alto, segno a parte */
  function roundStr(s, n, sep='.'){
    const m=/^([+-]?)(\d*)(?:([.,])(\d*))?$/.exec(s); if (!m) return s;
    let [, sg, ip, sp, fp]=m; ip=ip||'0'; fp=fp||'';
    let digits=ip+fp.padEnd(n,'0').slice(0,n);
    if (fp.length>n && fp[n]>='5'){
      const a=digits.split(''); let k=a.length-1;
      while (k>=0){ if (a[k]==='9'){ a[k]='0'; k--; } else { a[k]=String(+a[k]+1); break; } }
      if (k<0) a.unshift('1'); digits=a.join('');
    }
    let I=digits.slice(0, digits.length-n).replace(/^0+(?=\d)/,'') || '0'; const F=digits.slice(digits.length-n);
    if (/^0*$/.test(I+F) && sg==='-') sg='';
    return sg+I+(n>0 ? (sp||sep)+F : '');
  }
  /* opzioni di una colonna S: si cambiano solo le chiavi indicate (null la toglie) */
  function splitTop(s){ const out=[]; let d=0, cur=''; for (const ch of s){ if (ch==='{') d++; if (ch==='}') d--; if (ch===',' && !d){ out.push(cur); cur=''; } else cur+=ch; } out.push(cur); return out.map(x=>x.trim()).filter(Boolean); }
  function withOpts(core, set){
    const m=/^S\s*(?:\[([\s\S]*)\])?$/.exec(core.trim()); if (!m) return null;
    const items=splitTop(m[1]||'');
    for (const [k,v] of Object.entries(set)){
      const i=items.findIndex(x=>x.split('=')[0].trim()===k); const kv = v===null ? null : `${k}=${v}`;
      if (i>=0){ if (kv) items[i]=kv; else items.splice(i,1); } else if (kv) items.push(kv);
    }
    return items.length ? `S[${items.join(', ')}]` : 'S';
  }
  const coreOf = c => { const col=T().cols[c]; return col ? St.src.slice(col.cs, col.e).trim() : ''; };
  /* celle della colonna c nelle righe date (ancore, non coperte), con la riga del sorgente */
  function colCells(c, rows){
    const L=View.layout(), Tn=T(), out=[];
    for (const r of rows){ const q=L[r]?.[c]; if (!q || q.cov || q.special) continue; out.push({r:q.r, vr:r, c, cell:Tn.rows[q.r].cells[q.k]}); }
    return out;
  }
  /* righe interessate: la selezione se ne comprende più d'una, altrimenti tutta la tabella */
  const selRows = () => { const sr=sel(), R=T().rows.length; return sr.r2>sr.r1 ? range(sr.r1, sr.r2) : range(0, R-1); };
  const range = (a, b) => Array.from({length:Math.max(0,b-a+1)}, (_,i)=>a+i);

  function round({n, mode}){
    const Tn=T(), sr=sel(), rows=selRows(), ops=[];
    let cells=0, skipped=0;
    for (let c=sr.c1;c<=sr.c2;c++){
      const col=Tn.cols[c]; if (!col) continue;
      const xs=colCells(c, rows);
      if (mode==='si'){
        if (col.type!=='S') continue;
        const f=/table-format=(-?)(\d+)/.exec(Ribbon.fmtOf(xs.map(x=>x.cell.t)));
        const core=withOpts(coreOf(c), {'table-format': `${f?f[1]:''}${f?f[2]:1}.${n}`, 'round-mode':'places', 'round-precision':n});
        if (core && normSpec(core)!==normSpec(coreOf(c))) ops.push({op:'align', c, type:core});
        cells++; continue;
      }
      const sep = xs.some(x=>/\d,\d/.test(x.cell.t)) ? ',' : '.';
      const vals=[];
      for (const x of xs){
        const k=numCore(x.cell.t); if (!k){ if (x.cell.t && numOf(x.cell.t)===null && /\d/.test(x.cell.t)) skipped++; vals.push(x.cell.t); continue; }
        const t=k.pre+roundStr(k.num, n, sep)+k.post; vals.push(t); cells++;
        if (t!==x.cell.t) ops.push({op:'set', r:x.r, c, t});
      }
      /* colonna S: table-format segue i decimali nuovi */
      if (col.type==='S'){ const f=/table-format=(-?)(\d+)/.exec(Ribbon.fmtOf(vals)); const core=f && withOpts(coreOf(c), {'table-format':`${f[1]}${f[2]}.${n}`}); if (core && normSpec(core)!==normSpec(coreOf(c))) ops.push({op:'align', c, type:core}); }
    }
    if (mode==='si' && !cells){ toast('L\'arrotondamento di siunitx vale per le colonne S: rendi prima la colonna numerica (S)'); return; }
    if (!cells){ toast('Nessun numero nelle colonne selezionate'); return; }
    if (!ops.length){ toast(`I numeri hanno già ${n} ${n===1?'decimale':'decimali'}`); return; }
    doOp({op:'batch', ops}, {msg: mode==='si' ? `siunitx arrotonda a ${n} ${n===1?'decimale':'decimali'}: i valori nel codice restano quelli` : `${cells} ${cells===1?'numero':'numeri'} con ${n} ${n===1?'decimale':'decimali'}`+(skipped?` · ${skipped} ${skipped===1?'cella lasciata':'celle lasciate'} com'erano`:'')});
  }
  /* massimo o minimo di ogni colonna selezionata in grassetto */
  function extreme(kind){
    const sr=sel(), rows=selRows(), ops=[]; let any=false;
    for (let c=sr.c1;c<=sr.c2;c++){
      const xs=colCells(c, rows).map(x=>({...x, v:numOf(x.cell.t)})).filter(x=>x.v!==null);
      if (!xs.length) continue; any=true;
      const best = kind==='max' ? Math.max(...xs.map(x=>x.v)) : Math.min(...xs.map(x=>x.v));
      ops.push(...Ribbon.wrapOps(xs.filter(x=>x.v===best), 'textbf', 'on'));
    }
    if (!any){ toast('Nessun numero nelle colonne selezionate'); return; }
    if (!ops.length){ toast(`Il ${kind==='max'?'massimo':'minimo'} è già in grassetto`); return; }
    doOp({op:'batch', ops}, {msg:`${kind==='max'?'Massimo':'Minimo'} in grassetto`});
  }

  /* ---------- ordinamento delle righe ---------- */
  /* righe da ordinare: la selezione, oppure il corpo (dopo l'intestazione: la prima regola piena o \endhead) */
  function sortRange(){
    const Tn=T(), sr=sel(), R=Tn.rows.length;
    if (sr.r2>sr.r1) return [sr.r1, sr.r2];
    const marks=Tn.rows.map((r,b)=>r.pre.some(x=>/^end(first)?(head|foot)$|^endlastfoot$/.test(x.cmd||'')) ? b : -1).filter(b=>b>=0);
    let a = marks.length ? Math.max(...marks) : Math.max(0, Tn.rows.findIndex((r,k)=>k>0 && r.pre.some(x=>x.k==='rule' && FULL_RULES.has(x.cmd))));
    while (a<R && Tn.rows[a].special) a++;
    return [a, R-1];
  }
  function sort({dir='asc'}={}){
    const Tn=T(), c=St.sel.c, [a,z]=sortRange(), L=View.layout();
    if (z-a<1){ toast('Niente da ordinare: servono almeno due righe'); return; }
    for (let r=a;r<=z;r++){
      if (Tn.rows[r].special){ toast('Tra le righe c\'è una didascalia: seleziona solo quelle da ordinare'); return; }
      for (let k=0;k<Tn.ncols;k++){ const q=L[r][k]; if (q && (q.cov ? q.cov[0]!==r : q.rs>1)){ toast('Una cella unita in verticale (\\multirow) lega queste righe: dividila prima'); return; } }
    }
    const keyOf = r => { const row=Tn.rows[r]; const f=row.cells.find(x=>{ const g=cellCol(row,x); return c>=g && c<g+(x.mc?x.mc.n:1); }); return f ? f.t : ''; };
    const items=range(a, z).map(r=>({r, t:keyOf(r)}));
    const full=items.filter(x=>x.t);
    const nums = full.length>0 && full.every(x=>numOf(x.t)!==null);
    const coll=new Intl.Collator('it', {numeric:true, sensitivity:'base'});
    const txt=new Map(items.map(x=>[x.r, plainOf(x.t)]));
    items.sort((x,y)=>{
      if (!x.t !== !y.t) return x.t ? -1 : 1;          /* celle vuote in fondo */
      const d = nums ? numOf(x.t)-numOf(y.t) : coll.compare(txt.get(x.r), txt.get(y.r));
      return dir==='desc' ? -d : d;
    });
    const order=items.map(x=>x.r);
    if (order.every((k,i)=>k===a+i)){ toast('Le righe sono già in quest\'ordine'); return; }
    doOp({op:'rowperm', r1:a, order}, {msg:`Righe ${a+1}–${z+1} ordinate per la colonna ${View.colName(c)} (${nums?'numeri':'testo'}, ${dir==='desc'?'decrescente':'crescente'})`});
  }

  /* ---------- colori ---------- */
  const BG = [['gray!10','grigio chiaro'],['gray!25','grigio'],['red!15','rosso'],['orange!20','arancio'],['yellow!30','giallo'],['green!15','verde'],['cyan!15','azzurro'],['blue!15','blu'],['violet!15','viola']];
  const FG = [['red','rosso'],['orange','arancio'],['green!50!black','verde'],['blue','blu'],['violet','viola'],['gray','grigio']];
  const sCol = x => T().cols[x.c]?.type==='S' && !x.cell.mc;
  const braced = t => t.startsWith('{') && matchClose(t,0)===t.length-1;
  function color({tg, color}){
    const Tn=T();
    if (tg==='alt') return altRows(color);
    if (tg==='row'){
      const sr=sel();
      const ops=range(sr.r1, sr.r2).filter(r=>!Tn.rows[r].special && (color || Tn.rows[r].pre.some(x=>x.cmd==='rowcolor'))).map(r=>({op:'rowcolor', r, color}));
      if (!ops.length){ toast('Le righe non hanno un colore da togliere'); return; }
      doOp({op:'batch', ops}, {msg: color ? `\\rowcolor{${color}} (xcolor con l'opzione table)` : 'Colore delle righe tolto'});
      return;
    }
    const xs=Ribbon.anchors().filter(x=>!x.special);
    const ops=[];
    for (const x of xs){
      let t=x.cell.t;
      if (tg==='cell'){
        const rest=t.replace(/^\\cellcolor\s*(?:\[[^\]]*\])?\s*\{[^{}]*\}\s*/, '');
        t = color ? `\\cellcolor{${color}}`+(rest?' '+rest:'') : rest;
      } else {
        let v = sCol(x) && braced(t) ? t.slice(1,-1) : t;
        const m=/^\\textcolor\s*\{[^{}]*\}\s*\{/.exec(v);
        if (m && matchClose(v, m[0].length-1)===v.length-1) v=v.slice(m[0].length, -1);
        if (!v) continue;
        t = color ? `\\textcolor{${color}}{${v}}` : v;
        if (sCol(x) && !isSiNumber(t)) t='{'+t+'}';
      }
      if (t!==x.cell.t) ops.push({op:'set', r:x.r, c:x.c, t});
    }
    if (!ops.length){ toast(color ? 'Le celle hanno già questo colore' : 'Nessun colore da togliere'); return; }
    doOp({op:'batch', ops}, {msg: !color ? 'Colore tolto' : tg==='cell' ? `\\cellcolor{${color}} (xcolor con l'opzione table)` : `\\textcolor{${color}}{…}`});
  }
  /* righe alterne: \rowcolors{2}{colore}{} subito prima della tabella */
  function altRows(color){
    const Tn=T(), src=St.src, rc=View.rowColors(Tn);
    const cmd = color ? `\\rowcolors{2}{${color}}{}` : '';
    let out, at;
    if (rc){
      const ls=lineStart(src, rc.s); const le=src.indexOf('\n', rc.e);
      const alone = /^[ \t]*$/.test(src.slice(ls, rc.s)) && /^[ \t]*$/.test(src.slice(rc.e, le<0?src.length:le));
      if (!cmd && alone){ out=src.slice(0, ls)+src.slice(le<0 ? src.length : le+1); at=ls; }
      else { out=src.slice(0, rc.s)+cmd+src.slice(rc.e); at=rc.s; }
    } else {
      if (!cmd){ toast('La tabella non ha righe alterne'); return; }
      const ls=lineStart(src, Tn.s);
      if (/^[ \t]*$/.test(src.slice(ls, Tn.s))){ const ind=src.slice(ls, Tn.s); out=src.slice(0, ls)+ind+cmd+'\n'+src.slice(ls); at=ls+ind.length; }
      else { out=src.slice(0, Tn.s)+cmd+' '+src.slice(Tn.s); at=Tn.s; }
    }
    setSource(out, {flash:[at, at+Math.max(1, cmd.length)]});
    const inFloat=/\\begin\s*\{table\*?\}/.test(src.slice(0, Tn.s)) && /\\end\s*\{table\*?\}/.test(src.slice(Tn.e));
    hint(color ? `\\rowcolors prima della tabella${inFloat?'':': vale fino alla fine del gruppo, anche per le tabelle che seguono'}` : 'Righe alterne tolte', 3200);
  }

  /* ---------- cerca e sostituisci (sul codice LaTeX delle celle) ---------- */
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function hits(){
    const Tn=T(), L=View.layout(), out=[]; if (!Tn || !L) return out;
    for (let r=0;r<L.length;r++) for (let c=0;c<Tn.ncols;c++){ const q=L[r][c]; if (!q || q.cov || q.special) continue; const cell=Tn.rows[q.r].cells[q.k]; if (View.found(cell.t)) out.push({vr:r, r:q.r, c, cell}); }
    return out;
  }
  function count(){ const n=hits().length; const el=$('fd-n'); if (el) el.textContent = St.find?.q ? `${n} ${n===1?'cella':'celle'}` : ''; return n; }
  function next(){
    const hs=hits(); if (!hs.length){ toast('Nessuna cella contiene il testo cercato'); return null; }
    const cur=St.sel; const h=hs.find(x=>x.vr>cur.r || x.vr===cur.r && x.c>cur.c) || hs[0];
    View.select(h.vr, h.c); count(); return h;
  }
  function replaced(x, rep){
    const f=St.find; let t;
    if (f.cs) t=x.cell.t.split(f.q).join(rep);
    else t=x.cell.t.replace(new RegExp(reEsc(f.q), 'gi'), ()=>rep);
    if (T().cols[x.c]?.type==='S' && !x.cell.mc && t && !isSiNumber(t) && !braced(t)) t='{'+t+'}';
    let d=0; for (let i=0;i<t.length;i++){ if (t[i]==='\\'){ i++; continue; } if (t[i]==='{') d++; else if (t[i]==='}' && --d<0) return null; }
    return d ? null : t;
  }
  function replace(all){
    if (!St.find?.q) return;
    const rep=View.protect($('fd-r').value);
    const cur=St.sel, hs=hits();
    const xs = all ? hs : hs.filter(x=>x.vr===cur.r && x.c===cur.c);
    if (!all && !xs.length){ next(); return; }
    const ops=[]; let bad=0;
    for (const x of xs){ const t=replaced(x, rep); if (t===null){ bad++; continue; } if (t!==x.cell.t) ops.push({op:'set', r:x.r, c:x.c, t}); }
    if (!ops.length){ toast(bad ? 'La sostituzione lascerebbe graffe non bilanciate' : 'Niente da sostituire'); return; }
    if (doOp({op:'batch', ops}, {msg: all ? `${ops.length} ${ops.length===1?'cella cambiata':'celle cambiate'}`+(bad?` · ${bad} lasciate (graffe)`:'') : ''})){ if (!all && hits().length) next(); count(); }
  }
  function openFind(){
    if (!T()){ toast('Nessuna tabella in cui cercare'); return; }
    if (View.isEditing()) View.closeEditor(true);
    if (Ribbon.isOpen('find')){ $('fd-q').focus(); $('fd-q').select(); return; }
    Ribbon.openPop('find', $('b-find'));
  }

  /* ---------- immagine della tabella (SVG e PNG), senza intestazioni, selezione e segni dell'editor ---------- */
  const EXPORT_CSS = `table.ttx{border-collapse:separate;border-spacing:0;font-family:"Latin Modern Roman","CMU Serif","Computer Modern Serif",Georgia,"Times New Roman",serif;color:#1a2130;font-size:15px}
table.ttx td{padding:4px 10px;white-space:nowrap;vertical-align:middle;line-height:1.3;border-top:var(--bt,0) solid #1a2130;border-bottom:var(--bb,0) solid #1a2130;border-left:var(--bl,0) solid #1a2130;border-right:var(--br,0) solid #1a2130;background-clip:padding-box}
table.ttx td.para{white-space:normal;max-width:260px}table.ttx td.x{white-space:normal;min-width:160px}
table.ttx .m{display:inline-block;vertical-align:middle}table.ttx .m svg{vertical-align:middle;max-width:none}
table.ttx .num{display:inline-flex;font-variant-numeric:tabular-nums}table.ttx .num .i{display:inline-block;text-align:right}table.ttx .num .f{display:inline-block;text-align:left}
table.ttx .raw{font:12px ui-monospace,Menlo,monospace;color:#7a3fb0}`;
  function imageSVG(){
    const tb=$('grid').querySelector('table.tt'); if (!tb) return null;
    if (!$('ttx-css')){ const s=document.createElement('style'); s.id='ttx-css'; s.textContent=EXPORT_CSS; document.head.appendChild(s); }
    const cl=tb.cloneNode(true);
    cl.querySelector('thead')?.remove(); cl.querySelectorAll('th').forEach(x=>x.remove());
    cl.querySelectorAll('tr').forEach(tr=>{ if (tr.querySelector('td.spc')) tr.remove(); tr.removeAttribute('class'); });
    cl.querySelectorAll('td').forEach(td=>{ td.classList.remove('sel','cur','warn','found','miss','c','mr','spc'); for (const a of ['title','data-r','data-c']) td.removeAttribute(a); if (!td.className) td.removeAttribute('class'); });
    cl.querySelectorAll('.lbl').forEach(x=>x.remove());
    cl.className='ttx';
    const box=document.createElement('div'); box.style.cssText='position:fixed;left:-10000px;top:0'; box.appendChild(cl); document.body.appendChild(box);
    const r=cl.getBoundingClientRect(), pad=8, W=Math.ceil(r.width)+2*pad, H=Math.ceil(r.height)+2*pad;
    const xml=new XMLSerializer().serializeToString(cl); box.remove();
    return {W, H, svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><foreignObject x="0" y="0" width="${W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml" style="padding:${pad}px"><style>${EXPORT_CSS}</style>${xml}</div></foreignObject></svg>`};
  }
  async function exportImage(kind){
    const x=imageSVG(); if (!x){ toast('Nessuna tabella da esportare'); return; }
    if (kind==='svg'){ download('tabella.svg', x.svg, 'image/svg+xml'); toast('Scaricato tabella.svg'); return; }
    try {
      const img=new Image(); img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(x.svg); await img.decode();
      const k=3, cv=document.createElement('canvas'); cv.width=x.W*k; cv.height=x.H*k;
      const g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,cv.width,cv.height); g.scale(k,k); g.drawImage(img,0,0);
      const blob=await new Promise((res,rej)=>{ try { cv.toBlob(b=>b?res(b):rej(new Error('vuoto')), 'image/png'); } catch(e){ rej(e); } });
      download('tabella.png', blob); toast('Scaricato tabella.png');
    } catch(e){ toast('PNG non disponibile in questo browser: scarica l\'SVG'); }
  }

  /* ---------- finestre a comparsa (le apre Ribbon.openPop) ---------- */
  const swatch = (tg, [c, name]) => `<button class="swb" data-tg="${tg}" data-color="${esc(c)}" title="${esc(name)}: ${esc(c)}" style="background:${Render.color('', c)}"></button>`;
  const none = tg => `<button class="swb none" data-tg="${tg}" data-color="" title="Nessun colore">×</button>`;
  const pops = {
    sort: {
      html(){ const [a,z]=sortRange(); return `<div class="gh">Ordina le righe<small>colonna ${View.colName(St.sel.c)} · righe ${a+1}–${z+1}</small></div><div class="ropt">
        <button data-sort="asc"><span class="ric">↧</span>Crescente<code>A → Z · 1 → 9</code></button>
        <button data-sort="desc"><span class="ric">↥</span>Decrescente<code>Z → A · 9 → 1</code></button></div>
        <div class="gnote">Senza una selezione di più righe, l'intestazione (fino alla prima regola, o a <code>\\endhead</code>) resta ferma. Le regole restano dove sono; il commento a fine riga segue la sua riga.</div>`; },
      bind(p){ p.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{ Ribbon.closePop(); Ribbon.act('sort', {dir:b.dataset.sort}); $('gridbox').focus({preventScroll:true}); }); },
    },
    round: {
      html(){ const s=T().cols.slice(sel().c1, sel().c2+1).some(c=>c.type==='S');
        return `<div class="gh">Decimali<small>colonne ${View.colName(sel().c1)}${sel().c2>sel().c1?'–'+View.colName(sel().c2):''}</small></div>
        <div class="decs">${[0,1,2,3,4].map(n=>`<button class="btn" data-dec="${n}">${n}</button>`).join('')}</div>
        <div class="gform"><label><input type="radio" name="rmode" value="text" checked style="width:auto"> Riscrivi i numeri</label><span class="gnote" style="padding:0">arrotondati, con gli zeri che mancano</span>
        <label><input type="radio" name="rmode" value="si" ${s?'':'disabled'} style="width:auto"> Lascia fare a siunitx</label><span class="gnote" style="padding:0"><code>round-mode=places</code> nella colonna S${s?'':' (nessuna colonna S)'}</span></div>`; },
      bind(p){ p.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{ const mode=p.querySelector('input[name=rmode]:checked').value; Ribbon.closePop(); Ribbon.act('round', {n:+b.dataset.dec, mode}); $('gridbox').focus({preventScroll:true}); }); },
    },
    color: {
      html(){ return `<div class="gh">Sfondo delle celle<small><code>\\cellcolor</code></small></div><div class="sws">${BG.map(c=>swatch('cell',c)).join('')}${none('cell')}</div>
        <div class="gh">Sfondo delle righe<small><code>\\rowcolor</code></small></div><div class="sws">${BG.map(c=>swatch('row',c)).join('')}${none('row')}</div>
        <div class="gh">Righe alterne<small><code>\\rowcolors</code> prima della tabella</small></div><div class="sws">${BG.slice(0,4).map(c=>swatch('alt',c)).join('')}${none('alt')}</div>
        <div class="gh">Testo<small><code>\\textcolor</code></small></div><div class="sws">${FG.map(c=>swatch('text',c)).join('')}${none('text')}</div>
        <div class="gnote">I colori delle tabelle vogliono <code>xcolor</code> con l'opzione <code>table</code>: il documento esportato la dichiara da solo.</div>`; },
      bind(p){ p.querySelectorAll('.swb').forEach(b=>b.onclick=()=>{ Ribbon.closePop(); Ribbon.act('color', {tg:b.dataset.tg, color:b.dataset.color}); $('gridbox').focus({preventScroll:true}); }); },
    },
    find: {
      html(){ return `<div class="gh">Cerca e sostituisci<small id="fd-n"></small></div>
        <div class="gform"><label for="fd-q">Cerca</label><input type="text" id="fd-q" spellcheck="false" value="${esc(St.find?.q||'')}">
        <label for="fd-r">Sostituisci con</label><input type="text" id="fd-r" spellcheck="false">
        <label for="fd-cs">Maiuscole</label><input type="checkbox" id="fd-cs" style="width:auto" ${St.find?.cs?'checked':''}></div>
        <div class="pbtns"><button class="btn" id="fd-next">Trova</button><button class="btn" id="fd-one">Sostituisci</button><button class="btn pri" id="fd-all">Sostituisci tutto</button></div>
        <div class="gnote">Si cerca nel codice LaTeX delle celle della tabella. Il testo nuovo si protegge come quando si scrive in una cella (<code>&amp; % #</code> diventano <code>\\&amp; \\% \\#</code>).</div>`; },
      bind(p){
        const upd = () => { St.find={q:$('fd-q').value, cs:$('fd-cs').checked}; View.render(); count(); };
        $('fd-q').addEventListener('input', upd); $('fd-cs').addEventListener('change', upd);
        $('fd-q').addEventListener('keydown', e=>{ if (e.key==='Enter'){ e.preventDefault(); next(); } });
        $('fd-r').addEventListener('keydown', e=>{ if (e.key==='Enter'){ e.preventDefault(); replace(e.ctrlKey||e.metaKey); } });
        $('fd-next').onclick=next; $('fd-one').onclick=()=>replace(false); $('fd-all').onclick=()=>replace(true);
        upd(); $('fd-q').focus(); $('fd-q').select();
      },
      close(){ St.find=null; View.render(); },
    },
  };
  $('b-find').onclick=openFind;
  return {pops, sort, round, extreme, color, openFind, exportImage, imageSVG, numOf, numCore, roundStr, withOpts};
})();
