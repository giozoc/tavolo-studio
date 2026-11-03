/* ============ GRIGLIA: forma astratta della tabella, operazioni attese, disposizione e generazione ============
   La griglia è ciò che l'utente vede e su cui agisce: righe, celle con contenuto ed estensione, colonne, regole.
   Ogni operazione della barra o del mouse ha qui la sua versione astratta (che cosa deve risultare), e in 04-ops.js
   la sua versione sul testo (quale tratto riscrivere). Dopo ogni riscrittura il sorgente viene riletto e la griglia
   che ne risulta deve coincidere con quella attesa: è la verifica che rende sicura la riscrittura minima. */

const FULL_RULES = new Set(['toprule','midrule','bottomrule','hline','specialrule','firsthline','lasthline','Xhline','hdashline']);
const ruleCmd = r => (/^\\([a-zA-Z]+)/.exec(r)||[])[1]||'';

const Grid = (()=>{
  const clone = g => JSON.parse(JSON.stringify(g));
  const rulesOf = pre => pre.filter(x=>x.k==='rule').map(x=>normSpec(x.raw));
  const empty = () => ({t:'', n:1, mc:null, mr:0, mrw:null});
  /* forma astratta di una tabella analizzata */
  function of(T, src){
    const parts=[];
    for (const x of T.specInfo.items){
      if (x.k==='>'||x.k==='<') continue;
      if (x.k===undefined) parts.push({col:normSpec(src.slice(x.fs, x.fe)), pre:x.pre?normSpec(src.slice(x.pre.s,x.pre.e)):'', core:normSpec(src.slice(x.cs,x.e)), post:x.post?normSpec(src.slice(x.post.s,x.post.e)):''});
      else parts.push({sep:normSpec(src.slice(x.s, x.e))});
    }
    return {
      env:T.env, parts, spec:parts.map(p=>p.col??p.sep).join(''),
      rows:T.rows.map(r=>({rules:rulesOf(r.pre), sp:r.special||'',
        cells:r.cells.map(c=>({t:c.t, n:c.mc?c.mc.n:1, mc:c.mc?c.mc.spec:null, mr:c.mr?c.mr.n:0, mrw:c.mr?c.mr.w:null}))})),
      fin:rulesOf(T.fin)
    };
  }
  const ncols = g => g.parts.filter(p=>p.col!==undefined).length;
  const width = row => row.cells.reduce((a,c)=>a+c.n,0);
  /* cella che copre la colonna gc: indice e colonna d'inizio; null se la riga è più corta */
  function find(row, gc){ let g=0; for (let k=0;k<row.cells.length;k++){ const n=row.cells[k].n; if (gc>=g && gc<g+n) return {k, g}; g+=n; } return null; }
  function pad(row, gc){ while (width(row)<=gc) row.cells.push(empty()); }
  const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
  const fullyRuled = g => g.rows.length>=2 && g.rows.slice(1).every(r=>r.rules.some(x=>ruleCmd(x)==='hline'));
  const bookish = g => [...g.rows.flatMap(r=>r.rules), ...g.fin].some(x=>/^(toprule|midrule|bottomrule|cmidrule)$/.test(ruleCmd(x)));
  const colPartIdx = (g, c) => { let n=-1; for (let i=0;i<g.parts.length;i++) if (g.parts[i].col!==undefined && ++n===c) return i; return -1; };
  const rulesAt = (g, b) => b<g.rows.length ? g.rows[b].rules : g.fin;
  function setRulesAt(g, b, L){ if (b<g.rows.length) g.rows[b].rules=L; else g.fin=L; }
  /* intervallo di una regola parziale: \cmidrule(lr){2-3} → [2,3] */
  const rangeOf = r => { const m=/\{(\d+)-(\d+)\}$/.exec(r); return m ? [+m[1], +m[2]] : null; };
  const withRange = (r, a, b) => r.replace(/\{(\d+)-(\d+)\}$/, `{${a}-${b}}`);

  /* ---------- operazioni attese ---------- */
  const OPS = {
    set(g, {r, c, t}){ const row=g.rows[r]; pad(row, c); row.cells[find(row,c).k].t=t; },
    raw(g, {r, c, v}){
      const row=g.rows[r]; pad(row, c); const k=find(row,c).k;
      const x=cellInner(v, 0, v.length);
      row.cells[k]={t:stripComments(v.slice(x.cs, x.ce)).trim(), n:x.mc?x.mc.n:1, mc:x.mc?x.mc.spec:null, mr:x.mr?x.mr.n:0, mrw:x.mr?x.mr.w:null};
    },
    rowins(g, {at, cells}){
      const n=ncols(g), fr=fullyRuled(g);
      const row={rules:[], sp:'', cells:Array.from({length:n}, (_,k)=>({...empty(), t:(cells&&cells[k])||''}))};
      if (!g.rows.length){ const k = g.fin.length>=2 ? 1 : 0; row.rules=g.fin.slice(0,k); g.fin=g.fin.slice(k); g.rows.push(row); return; }
      if (at<g.rows.length){ row.rules=g.rows[at].rules; g.rows[at].rules = fr ? ['\\hline'] : []; }
      else if (fr) row.rules=['\\hline'];
      g.rows.splice(at, 0, row);
    },
    rowdel(g, {r}){
      const row=g.rows[r];
      /* chi copriva questa riga con \multirow si accorcia */
      g.rows.forEach((x, a)=>{ if (a>=r) return; let gc=0; for (const c of x.cells){ if (c.mr>1 && a+c.mr-1>=r){ const f=find(row, gc); if (!f || !row.cells[f.k].t) c.mr--; } gc+=c.n; } });
      const next=rulesAt(g, r+1);
      const dup = row.rules.length && row.rules.every(x=>next.includes(x));
      if (!dup) setRulesAt(g, r+1, [...row.rules, ...next]);
      g.rows.splice(r,1);
    },
    colins(g, {at, type}){
      const n=ncols(g);
      const nc={col:type, pre:'', core:type, post:''};
      if (!n){ g.parts.push(nc); }
      else if (at>0){ const p=colPartIdx(g, at-1); if (g.parts[p+1]?.sep==='|') g.parts.splice(p+2,0,nc,{sep:'|'}); else g.parts.splice(p+1,0,nc); }
      else { const p=colPartIdx(g, 0); if (g.parts[p-1]?.sep==='|') g.parts.splice(p,0,nc,{sep:'|'}); else g.parts.splice(p,0,nc); }
      g.spec=g.parts.map(p=>p.col??p.sep).join('');
      for (const row of g.rows){
        if (row.sp) continue;
        if (at===0){ if (row.cells.length) row.cells.unshift(empty()); continue; }
        const f=find(row, at-1); if (!f) continue;
        const c=row.cells[f.k];
        if (f.g+c.n-1>=at) c.n++; else row.cells.splice(f.k+1, 0, empty());
      }
      for (const b of [...g.rows.map(r=>r.rules), g.fin]) b.forEach((x,i)=>{ const rg=rangeOf(x); if (!rg) return; let [a,z]=rg; if (at+1<=a){ a++; z++; } else if (at+1<=z) z++; b[i]=withRange(x,a,z); });
    },
    coldel(g, {c}){
      const p=colPartIdx(g, c);
      if (g.parts[p+1]?.sep==='|' && g.parts[p-1]?.sep==='|') g.parts.splice(p,2); else g.parts.splice(p,1);
      g.spec=g.parts.map(p=>p.col??p.sep).join('');
      for (const row of g.rows){
        if (row.sp) continue;
        const f=find(row, c); if (!f) continue;
        const x=row.cells[f.k];
        if (x.n>1) x.n--; else if (row.cells.length>1) row.cells.splice(f.k,1); else x.t='';
      }
      for (const b of [...g.rows.map(r=>r.rules), g.fin]){
        for (let i=b.length-1;i>=0;i--){ const rg=rangeOf(b[i]); if (!rg) continue; let [a,z]=rg;
          if (c+1<a){ a--; z--; } else if (c+1<=z) z--;
          if (z<a) b.splice(i,1); else b[i]=withRange(b[i],a,z); }
      }
    },
    align(g, {c, type}){ const p=colPartIdx(g, c); const x=g.parts[p]; x.core=normSpec(type); x.col=x.pre+x.core+x.post; g.spec=g.parts.map(p=>p.col??p.sep).join(''); },
    env(g, {env}){ g.env=env; },
    style(g, {to}){
      /* booktabs: niente | e regole toprule/midrule/bottomrule; griglia: | ovunque e \hline tra tutte le righe; nessuna: senza regole piene */
      const R=g.rows.length;
      const conv = L => L.map(x=>{ const m=/^\\(cline|cmidrule)(?:\[[^\]]*\])?(?:\([^)]*\))?\{(\d+)-(\d+)\}$/.exec(x); if (!m) return x; return to==='grid' ? `\\cline{${m[2]}-${m[3]}}` : to==='booktabs' ? (m[1]==='cmidrule'?x:`\\cmidrule(lr){${m[2]}-${m[3]}}`) : x; });
      if (to==='grid'){
        const cols=g.parts.filter(p=>p.col!==undefined);
        g.parts=[{sep:'|'}]; for (const c of cols){ g.parts.push(c, {sep:'|'}); }
      } else if (to==='booktabs') g.parts=g.parts.filter(p=>p.sep!=='|');
      g.spec=g.parts.map(p=>p.col??p.sep).join('');
      for (let b=0;b<=R;b++){
        const L=conv(b<R ? g.rows[b].rules : g.fin);
        const keep=L.filter(x=>!FULL_RULES.has(ruleCmd(x)));
        let kind=null;
        if (to==='grid') kind='hline';
        else if (to==='booktabs') kind = b===0 ? 'toprule' : b===R ? 'bottomrule' : (b===1 && R>1) ? 'midrule' : null;
        const out = kind ? ['\\'+kind, ...keep] : keep;
        if (b<R) g.rows[b].rules=out; else g.fin=out;
      }
    },
    rule(g, {b, kind}){
      const L=rulesAt(g, b).slice(); const i=L.findIndex(x=>FULL_RULES.has(ruleCmd(x)));
      const keep=L.filter(x=>!FULL_RULES.has(ruleCmd(x)));
      if (kind==='none'){ setRulesAt(g, b, keep); return; }
      if (i<0){ setRulesAt(g, b, ['\\'+kind, ...L]); return; }
      const out=[]; L.forEach((x,k)=>{ if (k===i) out.push('\\'+kind); else if (!FULL_RULES.has(ruleCmd(x))) out.push(x); });
      setRulesAt(g, b, out);
    },
    cmid(g, {b, a, z, text}){ setRulesAt(g, b, [...rulesAt(g,b), normSpec(text)]); },
    cmidx(g, {b}){ setRulesAt(g, b, rulesAt(g,b).filter(x=>!rangeOf(x))); },
    mergeh(g, {r, c1, c2, spec}){
      const row=g.rows[r]; pad(row, c2);
      const f1=find(row,c1), f2=find(row,c2); const last=row.cells[f2.k];
      const ts=row.cells.slice(f1.k, f2.k+1).map(x=>x.t).filter(Boolean);
      const cell={t:ts.join(' '), n:f2.g+last.n-f1.g, mc:spec, mr:row.cells[f1.k].mr, mrw:row.cells[f1.k].mrw};
      row.cells.splice(f1.k, f2.k-f1.k+1, cell);
    },
    mergev(g, {c, r1, r2, mc}){
      const a=g.rows[r1].cells[find(g.rows[r1], c).k]; const ts=[a.t];
      for (let r=r1+1;r<=r2;r++){ const row=g.rows[r]; const f=find(row,c); if (!f) continue; if (row.cells[f.k].t) ts.push(row.cells[f.k].t); row.cells[f.k].t=''; }
      a.t=ts.filter(Boolean).join(' '); a.mr=r2-r1+1; a.mrw=a.mrw||'*';
      if (mc && !a.mc) a.mc=mc;
    },
    split(g, {r, c, t}){
      const row=g.rows[r]; const f=find(row,c); if (!f) return; const x=row.cells[f.k];
      const n=x.n; const add=Array.from({length:n-1}, empty);
      row.cells.splice(f.k, 1, {t:t??x.t, n:1, mc:null, mr:0, mrw:null}, ...add);
    },
    rowmove(g, {r, d}){ const a=g.rows[r], b=g.rows[r+d]; [a.cells, b.cells]=[b.cells, a.cells]; [a.sp, b.sp]=[b.sp, a.sp]; },
    /* righe r1… prese nell'ordine dato (ordinamento): le regole restano ai loro confini */
    rowperm(g, {r1, order}){ const src=order.map(k=>({cells:g.rows[k].cells, sp:g.rows[k].sp})); src.forEach((x,i)=>{ g.rows[r1+i].cells=x.cells; g.rows[r1+i].sp=x.sp; }); },
    /* colonne a e a+1 scambiate (d è -1 o +1); i separatori restano dove sono, le regole di una colonna sola la seguono */
    colmove(g, {c, d}){
      const a=Math.min(c, c+d), b=a+1;
      const pa=colPartIdx(g, a), pb=colPartIdx(g, b); [g.parts[pa], g.parts[pb]]=[g.parts[pb], g.parts[pa]];
      g.spec=g.parts.map(p=>p.col??p.sep).join('');
      for (const row of g.rows){
        if (row.sp) continue; pad(row, b);
        const fa=find(row, a), fb=find(row, b); [row.cells[fa.k], row.cells[fb.k]]=[row.cells[fb.k], row.cells[fa.k]];
      }
      for (const L of [...g.rows.map(r=>r.rules), g.fin]) L.forEach((x,i)=>{ const rg=rangeOf(x); if (!rg || rg[0]!==rg[1]) return; const n = rg[0]===a+1 ? b+1 : rg[0]===b+1 ? a+1 : 0; if (n) L[i]=withRange(x, n, n); });
    },
    /* \rowcolor della riga r: cambia il primo, toglie gli altri; '' lo toglie */
    rowcolor(g, {r, color}){
      const L=g.rows[r].rules, i=L.findIndex(x=>ruleCmd(x)==='rowcolor');
      const keep=L.filter((x,k)=>ruleCmd(x)!=='rowcolor' || (color && k===i));
      if (!color){ g.rows[r].rules=keep; return; }
      const t=normSpec(`\\rowcolor{${color}}`);
      g.rows[r].rules = i<0 ? [...L, t] : keep.map(x=>ruleCmd(x)==='rowcolor' ? t : x);
    },
    addrule(g, {b, text}){ setRulesAt(g, b, [...rulesAt(g,b), normSpec(text)]); },
    rmrule(g, {b, cmd}){ setRulesAt(g, b, rulesAt(g,b).filter(x=>ruleCmd(x)!==cmd)); },
    /* righe e colonne scambiate; types sono le nuove colonne, bars se la tabella ha | tra tutte le colonne */
    transpose(g, {types, bars}){
      const R=g.rows.length, C=ncols(g);
      const cols=g.parts.map((p,i)=>p.col!==undefined ? i : -1).filter(i=>i>=0);
      const lead=g.parts.slice(0, cols[0]), tail=g.parts.slice(cols[cols.length-1]+1);
      const nc=types.map(t=>({col:normSpec(t), pre:'', core:normSpec(t), post:''}));
      g.parts=[...lead, ...nc.flatMap((p,i)=> bars && i<nc.length-1 ? [p, {sep:'|'}] : [p]), ...tail];
      g.spec=g.parts.map(p=>p.col??p.sep).join('');
      const B=[...g.rows.map(r=>r.rules), g.fin];
      const inner=B.slice(2, R); const mid = inner.length && inner.every(x=>same(x, inner[0])) ? inner[0] : fullyRuled(g) ? ['\\hline'] : [];
      const rulesFor = b => b===0 ? B[0] : b===C ? B[R] : b===1 ? (R>1 ? B[1] : []) : mid;
      const cellAt = (r, c) => { const f=find(g.rows[r], c); return f ? g.rows[r].cells[f.k] : empty(); };
      g.rows=Array.from({length:C}, (_,j)=>({rules:rulesFor(j).slice(), sp:'', cells:Array.from({length:R}, (_,i)=>clone(cellAt(i, j)))}));
      g.fin=rulesFor(C).slice();
    },
  };
  function expect(g, op){ const x=clone(g); OPS[op.op](x, op); return x; }
  return {of, clone, find, width, ncols, expect, same, fullyRuled, bookish, empty, rangeOf, colPartIdx};
})();

/* ---------- disposizione per la vista: celle unite in orizzontale (\multicolumn) e in verticale (\multirow) ----------
   L[r][c] = {r, k} per la cella che si disegna lì (ancora), {cov:[r,c]} se coperta da un'altra, null se manca */
function layoutOf(T){
  const R=T.rows.length, C=T.ncols;
  const L=Array.from({length:R}, ()=>Array(C).fill(null));
  T.rows.forEach((row, r)=>{
    if (row.special){ L[r][0]={r, k:0, cs:C, rs:1, special:true}; for (let c=1;c<C;c++) L[r][c]={cov:[r,0]}; return; }
    let g=0;
    row.cells.forEach((cell, k)=>{
      const n=cell.mc?cell.mc.n:1;
      for (let j=0;j<n && g+j<C;j++) L[r][g+j] = j ? {cov:[r,g]} : {r, k, cs:Math.min(n, C-g), rs:1};
      g+=n;
    });
  });
  /* \multirow: si estende sulle righe sotto (o sopra, se n è negativo) finché le celle coperte sono vuote */
  T.rows.forEach((row, r)=>{
    if (row.special) return;
    let g=0;
    row.cells.forEach((cell, k)=>{
      const n=cell.mc?cell.mc.n:1;
      if (cell.mr && Math.abs(cell.mr.n)>1 && g<C){
        const up = cell.mr.n<0; const m=Math.abs(cell.mr.n); let rs=1;
        for (let i=1;i<m;i++){
          const rr = up ? r-i : r+i; if (rr<0||rr>=R) break;
          const q=L[rr][g]; if (!q || q.cov || q.special) break;
          const qc=T.rows[rr].cells[q.k]; if (qc.t!=='' || (qc.mc?qc.mc.n:1)!==n && qc.mc) break;
          rs++;
        }
        if (rs>1){
          const top = up ? r-rs+1 : r;
          const anchor = {r, k, cs:L[r][g].cs, rs};
          for (let i=0;i<rs;i++) for (let j=0;j<anchor.cs;j++) L[top+i][g+j] = (i||j) ? {cov:[top,g]} : anchor;
        }
      }
      g+=n;
    });
  });
  return L;
}

/* ---------- generazione ---------- */
function cellRaw(c){
  let t=c.t;
  if (c.mr) t=`\\multirow{${c.mr}}{${c.mrw||'*'}}{${t}}`;
  if (c.mc) t=`\\multicolumn{${c.n}}{${c.mc}}{${t}}`;
  return t;
}
const rowText = cells => cells.map(cellRaw).join(' & ').replace(/^ +| +$/g,'').replace(/  +/g,' ');
/* nuova tabella da una matrice di testi già pronti per LaTeX */
function genTable(data, {style='booktabs', env='tabular', header=true, align=null, indent='  ', width='\\textwidth', float=false, caption=''}={}){
  const n=Math.max(1, ...data.map(r=>r.length));
  const rows=data.map(r=>{ const x=r.slice(); while (x.length<n) x.push(''); return x; });
  const al = align || Array.from({length:n}, (_,c)=> rows.slice(header?1:0).every(r=>!r[c] || isSiNumber(r[c])) && rows.slice(header?1:0).some(r=>r[c]) ? 'r' : 'l');
  let spec = style==='grid' ? '|'+al.join('|')+'|' : al.join('');
  if (env==='tabularx'){ const k=al.indexOf('l'); const a=al.slice(); a[k<0?0:k]='X'; spec = style==='grid' ? '|'+a.join('|')+'|' : a.join(''); }
  const head = env==='tabularx' ? `\\begin{tabularx}{${width}}{${spec}}` : env==='tabular*' ? `\\begin{tabular*}{${width}}{@{\\extracolsep{\\fill}}${spec}}` : `\\begin{${env}}{${spec}}`;
  const L=[head];
  const top = style==='booktabs' ? '\\toprule' : style==='grid' ? '\\hline' : '';
  const mid = style==='booktabs' ? '\\midrule' : style==='grid' ? '\\hline' : '';
  const bot = style==='booktabs' ? '\\bottomrule' : style==='grid' ? '\\hline' : '';
  if (env==='longtable' && caption) L.push(indent+`\\caption{${caption}}\\\\`);
  if (top) L.push(indent+top);
  rows.forEach((r,k)=>{
    L.push(indent+r.join(' & ').replace(/  +/g,' ').trim()+' \\\\');
    if (k===0 && header && rows.length>1 && mid){ L.push(indent+mid); if (env==='longtable') L.push(indent+'\\endhead'); }
    else if (style==='grid' && k<rows.length-1) L.push(indent+'\\hline');
  });
  if (bot) L.push(indent+bot);
  L.push(`\\end{${env}}`);
  let out=L.join('\n');
  if (float && env!=='longtable') out=`\\begin{table}[htbp]\n  \\centering\n${caption?`  \\caption{${caption}}\n`:''}${out.replace(/^/gm,'  ')}\n\\end{table}`;
  return out;
}
