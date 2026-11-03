/* ============ TIKZ-CD: diagrammi commutativi (\begin{tikzcd}) ============ */
const CD_SEP = {row:{huge:3.6, large:2.7, normal:1.8, scriptsize:1.35, small:.9, tiny:.45},
  column:{huge:4.8, large:3.6, normal:2.4, scriptsize:1.8, small:1.2, tiny:.6}};   // in em
const CD_EM = 10*PT, CD_AXIS = 2.5*PT, CD_RULE = .4*PT, CD_DDIST = 1.6*PT;
const CD_SHORT = {rar:'r', lar:'l', dar:'d', uar:'u', urar:'ur', ular:'ul', drar:'dr', dlar:'dl'};
const CD_ARR_RE = /^(arrow|ar|rar|lar|dar|uar|urar|ular|drar|dlar)$/;
const CD_DIR_RE = /^[rlud]+$/;
/* stili delle frecce: [punta iniziale, punta finale, linea doppia]; null lascia la punta com'è */
const CD_HEAD = {
  rightarrow:['','to'], leftarrow:['to',''], leftrightarrow:['to','to'], dash:['',''], 'no head':[null,''], 'no tail':['',null],
  Rightarrow:['','imp',1], Leftarrow:['imp','',1], Leftrightarrow:['imp','imp',1], equal:['','',1], equals:['','',1],
  mapsto:['bar','to'], mapsfrom:['to','bar'], Mapsto:['bar','imp',1], Mapsfrom:['imp','bar',1],
  hookrightarrow:['hook','to'], hookleftarrow:['to',"hook'"], rightarrowtail:['tail','to'], leftarrowtail:['to','tail'],
  twoheadrightarrow:['','2to'], twoheadleftarrow:['2to',''],
  rightharpoonup:['','to'], rightharpoondown:['','to'], leftharpoonup:['to',''], leftharpoondown:['to',''],
  dashrightarrow:['','to'], dashleftarrow:['to',''], rightsquigarrow:['','to'], leftsquigarrow:['to',''], leftrightsquigarrow:['to','to'],
  'maps to':['bar',null], hook:['hook',null], "hook'":["hook'",null], tail:['tail',null],
  'two heads':[null,'2to'], 'to head':[null,'to'], harpoon:[null,'to'], "harpoon'":[null,'to']
};
const CD_TIP = {'':'', to:'to', imp:'to[scale=1.5]', bar:'|', hook:'Hooks', "hook'":'Hooks[swap]', tail:'to[reversed]'};
const cdTip = (t, isStart) => t==='2to' ? (isStart?'<<':'>>') : CD_TIP[t];

/* elementi di una lista di opzioni con la loro posizione in S */
function cdItems(s, e){
  const out=[]; let d=0, st=s;
  const push=(x,y)=>{ let a=x, b=y; while(a<b && /\s/.test(S[a])) a++; while(b>a && /\s/.test(S[b-1])) b--; if (a<b) out.push({t:S.slice(a,b), s:a, e:b}); };
  for (let k=s;k<e;k++){ const c=S[k]; if (c==='\\'){ k++; continue; } if ('{(['.includes(c)) d++; else if ('})]'.includes(c)) d--; else if (c===','&&d===0){ push(st,k); st=k+1; } }
  push(st, e);
  return out;
}
/* "testo"' opzioni → etichetta */
function cdQuote(it){
  if (it.t[0]!=='"') return null;
  let d=0, k=1;
  for (;k<it.t.length;k++){ const c=it.t[k]; if (c==='\\'){ k++; continue; } if (c==='{') d++; else if (c==='}') d--; else if (c==='"'&&d===0) break; }
  if (k>=it.t.length) return null;
  let rest=it.t.slice(k+1).trim(), swap=false;
  if (rest[0]==="'"){ swap=true; rest=rest.slice(1).trim(); }
  rest=rest.replace(/^\{([\s\S]*)\}$/,'$1');
  let ts=it.s+1, te=it.s+k;
  if (S[ts]==='{' && mcS(ts)===te-1){ ts++; te--; }
  return {text:S.slice(ts,te), s:ts, e:te, opts:rest, swap};
}
/* \arrow[...], \ar, \rar{f}, \arrow{r}{f} (sintassi vecchia) */
function cdParseArrow(i, b){
  const cmd=readCmd(i); let j=cmd.end;
  const a={s:i, cmdEnd:cmd.end, opt:null, dir:CD_SHORT[cmd.name]||null, labels:[]};
  const op=readOpt(j); if (op && op.e<b){ a.opt={s:op.s, e:op.e}; j=op.e+1; }
  let old = !!a.dir;
  if (!old){ const g=readGroup(j); if (g && g.e<b){ a.dir=g.text.trim(); j=g.e+1; old=true; } }
  if (old){
    for (let guard=0; guard<6; guard++){
      const lo=readOpt(j), k=lo ? lo.e+1 : j; const g=readGroup(k);
      if (!g || g.e>=b) break;
      a.labels.push({text:g.text, s:g.s+1, e:g.e, opts:lo?lo.text:'', swap:false});
      j=g.e+1;
    }
  }
  a.e=j;
  return a;
}
/* divide il corpo in righe e celle, con le frecce di ogni cella */
function cdScan(bs, be, amp){
  const rows=[]; let cells=[], cs=bs, d=0, env=0;
  const endCell = k => cells.push({s:cs, e:k});
  for (let k=bs;k<be;k++){
    const c=S[k];
    if (c==='%'){ while(k<be && S[k]!=='\n') k++; continue; }
    if (c==='\\'){
      if (S[k+1]==='\\' && d===0 && env===0){
        endCell(k); rows.push({cells}); cells=[]; k+=2;
        const j=skipWS(k,be); if (S[j]==='['){ const en=mcS(j); if (en>0) k=en+1; }
        cs=k; k--; continue;
      }
      if (amp && S[k+1]==='&' && d===0 && env===0){ endCell(k); cs=k+2; k++; continue; }
      const m=/^\\(begin|end)\s*\{/.exec(S.slice(k,k+12)); if (m) env += m[1]==='begin' ? 1 : -1;
      k++; continue;
    }
    if (c==='{') d++; else if (c==='}') d--;
    else if (c==='&' && !amp && d===0 && env===0){ endCell(k); cs=k+1; }
  }
  endCell(be); rows.push({cells});
  // l'ultima riga vuota (dopo \\ finale) non conta
  const last=rows[rows.length-1];
  if (rows.length>1 && last.cells.length===1 && !S.slice(last.cells[0].s,last.cells[0].e).trim()) rows.pop();
  if (rows.length===1 && rows[0].cells.length===1 && !S.slice(rows[0].cells[0].s,rows[0].cells[0].e).trim()) rows.pop();
  for (const r of rows) for (const cl of r.cells){
    cl.arrows=[]; const pieces=[]; let p=cl.s, dd=0;
    for (let k=cl.s;k<cl.e;k++){
      const ch=S[k];
      if (ch==='%'){ while(k<cl.e && S[k]!=='\n') k++; continue; }
      if (ch==='{') dd++; else if (ch==='}') dd--;
      if (ch!=='\\' || dd) { if (ch==='\\') k++; continue; }
      const cmd=readCmd(k);
      if (!CD_ARR_RE.test(cmd.name)){ k=cmd.end-1; continue; }
      const a=cdParseArrow(k, cl.e); cl.arrows.push(a);
      pieces.push([p,k]); p=a.e; k=a.e-1;
    }
    pieces.push([p, cl.e]);
    const nonEmpty = pieces.map(([x,y])=>{ while(x<y && /\s/.test(S[x])) x++; while(y>x && /\s/.test(S[y-1])) y--; return [x,y]; }).filter(([x,y])=>y>x);
    cl.text = nonEmpty.map(([x,y])=>S.slice(x,y)).join(' ');
    cl.tspan = nonEmpty.length ? {s:nonEmpty[0][0], e:nonEmpty[nonEmpty.length-1][1]} : null;
    // fine del contenuto (per inserire nuove frecce)
    let y=cl.e; while (y>cl.s && /\s/.test(S[y-1])) y--; cl.end=y;
    let x=cl.s; while (x<cl.e && /\s/.test(S[x])) x++; cl.start=x;
  }
  return rows;
}

/* bordo della cella (asymmetrical rectangle: il centro è sull'asse matematico) */
function cdCenter(n){ return [n.c[0], n.c[1]-n.th/2+n.td+CD_AXIS]; }
function cdBorder(n, toward){
  const c=cdCenter(n), d=V.sub(toward, c);
  if (V.len(d)<1e-9) return c;
  const hh = d[1]>0 ? n.c[1]+n.hh-c[1] : c[1]-(n.c[1]-n.hh);
  const tx = Math.abs(d[0])>1e-12 ? n.hw/Math.abs(d[0]) : Infinity, ty = Math.abs(d[1])>1e-12 ? Math.max(hh,0)/Math.abs(d[1]) : Infinity;
  return V.add(c, V.mul(d, Math.min(tx,ty)));
}
function cdAnchor(n, name){
  name=name.trim();
  if (!name || name==='center') return cdCenter(n);
  if (name==='east'||name==='west'){ const c=cdCenter(n); return [n.c[0]+(name==='east'?n.hw:-n.hw), c[1]]; }
  const m=/^real (center|east|west)$/.exec(name); if (m) return nodeAnchor(n, m[1]);
  const a=parseFloat(name); if (!isNaN(a) && /^-?[\d.]+$/.test(name)) return cdBorder(n, V.add(cdCenter(n), V.pol(a,1)));
  return nodeAnchor(n, name) || cdCenter(n);
}

/* opzioni del diagramma: \tikzcdset, [opzioni] dell'ambiente */
function cdConfig(texts, base, ctx){
  const cfg = {rowSep:CD_SEP.row.normal*CD_EM, colSep:CD_SEP.column.normal*CD_EM, arrows:[], labels:[], cells:[], math:true, amp:false, cramped:false};
  const sep = (kind, v) => { const w=String(v).trim(); return CD_SEP[kind][w]!==undefined ? CD_SEP[kind][w]*CD_EM : lenCm(w.replace(/^\s*=/,''), ctx); };
  for (const t of texts) for (const {k,v} of parseOptList(subVars(t, ctx.vars))){
    try {
      if (k==='row sep') cfg.rowSep=sep('row', v);
      else if (k==='column sep') cfg.colSep=sep('column', v);
      else if (k==='sep'){ cfg.rowSep=sep('row', v); cfg.colSep=sep('column', v); }
      else if (k==='arrows' || k==='every arrow/.append style' || k==='every arrow') cfg.arrows.push(v||'');
      else if (k==='labels' || k==='every label/.append style' || k==='every label') cfg.labels.push(v||'');
      else if (k==='cells' || k==='every cell/.append style' || k==='every cell') cfg.cells.push(unbrace(String(v||'').replace(/^\s*nodes\s*=\s*/,'')));
      else if (k==='math mode') cfg.math = v!=='false';
      else if (k==='ampersand replacement') cfg.amp=true;
      else if (k==='cramped') cfg.cramped=true;
      else if (k==='nodes') cfg.cells.push(v||'');
      else if (/^(baseline|execute at|background color|arrow style|diagrams|every diagram|1-row diagram|center yshift|crossing over clearance|shift left|shift right)/.test(k)) {}
      else if (v===null && /^(row|column) sep\b/.test(k)) {}
      else applyKey(base.style, k, v, ctx, 0);
    } catch(err){ ctx.warn(err.message); }
  }
  return cfg;
}

function cdFigure(fig, base){
  const ctx = {...base, warn:mkWarn(fig.s)};
  let bs=fig.bodyS;
  const op=readOpt(bs);
  const texts=[...(R.cdset||[])];
  if (op){ texts.push(op.text); bs=op.e+1; R.picOpts={s:op.s, e:op.e}; }
  const cfg = cdConfig(texts, base, ctx);
  const rows = cdScan(bs, fig.bodyE, cfg.amp);
  const cd = {fig, bodyS:bs, bodyE:fig.bodyE, rows:[], cells:{}, xs:[], ys:[], cw:[], rowSep:cfg.rowSep, colSep:cfg.colSep};
  R.cd = cd;
  // celle
  const nodes = rows.map((r,ri)=>r.cells.map((cl,ci)=>{
    let t=cl.text, o='';
    const m=/^\|\[([\s\S]*?)\]\|/.exec(t); if (m){ o=m[1]; t=t.slice(m[0].length).trim(); }
    if (!t) return null;
    const cst=nodeBaseStyle(base.style, ctx, 'node');
    cst.isep=[EX, .85*EX];
    if (cfg.cramped) cst.isep=[.3*CD_EM, .3*CD_EM];
    for (const c of cfg.cells) applyOpts(cst, c, ctx);
    if (o) applyOpts(cst, o, ctx);
    const n=buildNode(cst, cfg.math ? '$'+t+'$' : t, [0,0], ctx);
    n.alias = cst.kv.alias ? String(cst.kv.alias).trim() : null;
    return n;
  }));
  // impaginazione: righe allineate sulla linea di base, colonne centrate
  const nc=Math.max(0, ...rows.map(r=>r.cells.length));
  const cw=Array(nc).fill(0), up=rows.map(()=>0), dn=rows.map(()=>0);
  nodes.forEach((r,ri)=>r.forEach((n,ci)=>{ if (!n) return; const bl=-n.th/2+n.td; cw[ci]=Math.max(cw[ci], 2*n.hw); up[ri]=Math.max(up[ri], n.hh-bl); dn[ri]=Math.max(dn[ri], n.hh+bl); }));
  const W=cw.reduce((a,b)=>a+b,0)+cfg.colSep*Math.max(0,nc-1), H=up.reduce((a,b,k)=>a+b+dn[k],0)+cfg.rowSep*Math.max(0,rows.length-1);
  let x=-W/2; for (let c=0;c<nc;c++){ cd.xs.push(x+cw[c]/2); x+=cw[c]+cfg.colSep; }
  let y=H/2; for (let r=0;r<rows.length;r++){ y-=up[r]; cd.ys.push(y); y-=dn[r]+cfg.rowSep; }
  cd.cw=cw;
  rows.forEach((row,ri)=>{
    const rr={cells:[]}; cd.rows.push(rr);
    row.cells.forEach((cl,ci)=>{
      const n=nodes[ri][ci];
      const cell={r:ri+1, c:ci+1, s:cl.s, e:cl.e, start:cl.start, end:cl.end, tspan:cl.tspan, arrows:cl.arrows, node:n};
      rr.cells.push(cell);
      if (!n) return;
      n.c=[cd.xs[ci], cd.ys[ri]+n.th/2-n.td];
      cd.cells[(ri+1)+'-'+(ci+1)]=cell; if (n.alias) cd.cells[n.alias]=cell;
      const sIdx=stmtRec(cl.tspan.s, cl.tspan.e, 'cdcell', cl.tspan.s);
      const rec=R.stmts[sIdx]; rec.text=cl.tspan; rec.cd={cell:true, r:ri+1, c:ci+1, s:cl.start, e:cl.end};
      n.idx=R.nodes.length; n.stmt=sIdx;
      R.nodes.push({stmt:sIdx, text:cl.tspan, opts:null, at:null, kw:'node', name:null, kwEnd:cl.tspan.s, head:true});
      const hw=Math.max(n.hw,.12), hh=Math.max(n.hh,.12);
      emit(ctx, `<g data-s="${sIdx}"><g data-n="${n.idx}">${nodeSVG(n)}<rect class="hitf" fill="transparent" x="${fmt(n.c[0]-hw,4)}" y="${fmt(-n.c[1]-hh,4)}" width="${fmt(2*hw,4)}" height="${fmt(2*hh,4)}"/></g></g>`);
    });
  });
  // frecce, nell'ordine del sorgente (crossing over copre quelle già disegnate)
  for (const rr of cd.rows) for (const cell of rr.cells) for (const a of cell.arrows){
    const w=mkWarn(a.s);
    try { cdArrow(a, cell, cfg, {...ctx, warn:w}); } catch(err){ w(err.message||String(err)); if(!(err instanceof MathErr)) console.error(err); }
  }
}

function cdTarget(spec, cell){
  spec=String(spec).trim();
  if (CD_DIR_RE.test(spec) || spec===''){
    let r=cell.r, c=cell.c;
    for (const ch of spec){ if (ch==='r') c++; else if (ch==='l') c--; else if (ch==='d') r++; else r--; }
    return {key:r+'-'+c, r, c};
  }
  return {key:spec};
}
function cdArrow(a, cell, cfg, ctx){
  const cd=R.cd;
  const sIdx=stmtRec(a.s, a.e, 'arrow', a.cmdEnd);
  const rec=R.stmts[sIdx]; rec.opts=a.opt; rec.cd={arrow:true, home:cell};
  const items = a.opt ? cdItems(a.opt.s+1, a.opt.e) : [];
  const labels = a.labels.slice();
  const pst = cloneStyle(ctx.style); pst.draw=true; pst.fill=undefined; pst.lw=CD_RULE; pst.arrowDef='to'; pst.double=null; pst.labels=[]; pst.name=null; pst.pos=null; pst.rounded=0;
  pst.arrows=['','to']; pst.color = ctx.style.color;
  const x={from:null, to:a.dir!==null ? a.dir : null, shift:0, shiftV:[0,0], sa:'', ea:'', squig:false, cross:false, phantom:false, desc:false, swap:false};
  const head = (k) => { const h=CD_HEAD[k]; if (h[0]!==null) pst.arrows[0]=cdTip(h[0],true); if (h[1]!==null) pst.arrows[1]=cdTip(h[1],false); if (h[2]) { pst.double=[1,1,1]; pst.ddist=CD_DDIST; } else if (h[0]!==null && h[1]!==null) pst.double=null; };
  const key = (k, v) => {
    if (v===null && CD_DIR_RE.test(k)){ x.to=k; return; }
    if (CD_HEAD[k] && v===null){ head(k); if (/^dash(right|left)arrow$/.test(k)) pst.dash=[7*CD_RULE/PT, 4*CD_RULE/PT]; if (/squigarrow$/.test(k)) x.squig=true; return; }
    switch(k){
      case 'to': x.to=v; return;
      case 'from': x.from=v; return;
      case 'dashed': pst.dash=[7*pst.lw/PT, 4*pst.lw/PT]; return;
      case 'squiggly': x.squig=true; return;
      case 'crossing over': x.cross=true; return;
      case 'phantom': x.phantom=true; pst.draw='none'; pst.arrows=['','']; return;
      case 'description': x.desc=true; return;
      case 'swap': case "'": x.swap=!x.swap; return;
      case 'shift left': case 'shift right': {
        let amt = 1; if (v!==null){ const o={}; const n=evalExpr(v, ctx.vars, o); amt = o.hadUnit ? n/(.56*EX) : n; }
        x.shift += (k==='shift left'?1:-1)*amt; return; }
      case 'start anchor': x.sa=v||''; return;
      case 'end anchor': x.ea=v||''; return;
      case 'shorten': { const l=lenPt(v,ctx); pst.shorten=[l,l]; return; }
      case 'shift': { const q=splitTop(unbrace(v).replace(/^\(|\)$/g,'')); if (q.length===2) x.shiftV=V.add(x.shiftV,[lenCm(unbrace(q[0]),ctx), lenCm(unbrace(q[1]),ctx)]); return; }
      case 'xshift': x.shiftV=V.add(x.shiftV,[lenPt(v,ctx),0]); return;
      case 'yshift': x.shiftV=V.add(x.shiftV,[0,lenPt(v,ctx)]); return;
      case 'marking': case 'execute at begin to': return;
    }
    applyKey(pst, k, v, ctx, 0);
  };
  for (const t of cfg.arrows) for (const {k,v} of parseOptList(subVars(t, ctx.vars))) key(k, v);
  for (const it of items){
    const q=cdQuote(it); if (q){ labels.push(q); continue; }
    const kv=parseOptList(subVars(it.t, ctx.vars))[0]; if (kv) key(kv.k, kv.v);
  }
  if (labels[0]) rec.label={s:labels[0].s, e:labels[0].e};
  // estremi
  const from = x.from!==null ? cdTarget(x.from, cell) : {key:cell.r+'-'+cell.c};
  const to = cdTarget(x.to!==null ? x.to : '', cell);
  const A=cd.cells[from.key], B=cd.cells[to.key];
  if (!A){ ctx.warn(`freccia: la cella ${from.key} è vuota o non esiste`); return; }
  if (!B){ ctx.warn(`freccia: la cella ${to.key} è vuota o non esiste`); return; }
  rec.cd.from=A; rec.cd.to=B;
  const na=A.node, nb=B.node;
  const ca=x.sa ? cdAnchor(na, x.sa) : cdCenter(na), cb=x.ea ? cdAnchor(nb, x.ea) : cdCenter(nb);
  let seg;
  const loop = pst.loop || A===B;
  if (!loop && pst.bend===null && pst.out===null && pst.in===null){
    seg={k:'L', a:x.sa ? ca : cdBorder(na, cb), b:x.ea ? cb : cdBorder(nb, ca)};
  } else {
    const th=V.ang(V.sub(cb, ca)); let out, inn;
    if (loop){ const L={above:[105,75],below:[285,255],left:[195,165],right:[15,345]}[pst.loop||'above']; out=pst.out!==null?pst.out:L[0]; inn=pst.in!==null?pst.in:L[1]; }
    else if (pst.bend!==null){ out=th+pst.bend; inn=th+180-pst.bend; }
    else { out=pst.out!==null?(pst.rel?th+pst.out:pst.out):th; inn=pst.in!==null?(pst.rel?th+180+pst.in:pst.in):th+180; }
    const p0 = x.sa ? ca : cdBorder(na, V.add(cdCenter(na), V.pol(out,1))), p1 = x.ea ? cb : cdBorder(nb, V.add(cdCenter(nb), V.pol(inn,1)));
    let dd=V.len(V.sub(p1,p0)), c1d=.3915*dd*(pst.looseOut||pst.loose), c2d=.3915*dd*(pst.looseIn||pst.loose);
    if (loop){ c1d=c2d=Math.max(pst.minDist||.5, .3915*Math.max(dd,.3)*(pst.loose===1?8:pst.loose)*.4); }
    seg={k:'C', a:p0, c1:V.add(p0,V.pol(out,c1d)), c2:V.add(p1,V.pol(inn,c2d)), b:p1};
  }
  // shift left/right e shift: traslano gli estremi
  const off = V.add(x.shiftV, (()=>{ if (!x.shift) return [0,0]; const d=V.sub(seg.b,seg.a), L=V.len(d)||1; return V.mul([-d[1]/L, d[0]/L], x.shift*.56*EX); })());
  if (V.len(off)>0) for (const k of ['a','b','c1','c2']) if (seg[k]) seg[k]=V.add(seg[k], off);
  const sub={start:seg.a, ops:[], closed:false};
  if (x.squig && seg.k==='L'){
    const d=V.sub(seg.b,seg.a), L=V.len(d), u=V.mul(d,1/(L||1)), nrm=[-u[1],u[0]], pre=Math.min(EX, L/4), n=Math.max(2, Math.round((L-2*pre)/(6*PT)))*2;
    const amp=1.1*PT, step=(L-2*pre)/n;
    sub.ops.push({t:'L', p:V.add(seg.a, V.mul(u,pre))});
    for (let k=1;k<=n;k++){ const t=pre+k*step; sub.ops.push({t:'L', p:V.add(V.add(seg.a, V.mul(u,t-step/2)), V.mul(nrm, (k%2?amp:-amp)))}); sub.ops.push({t:'L', p:V.add(seg.a, V.mul(u,t))}); }
    sub.ops.push({t:'L', p:seg.b});
  } else sub.ops.push(seg.k==='L' ? {t:'L', p:seg.b} : {t:'C', c1:seg.c1, c2:seg.c2, p:seg.b});
  let body='';
  if (x.cross){
    const cst=cloneStyle(pst); cst.draw=[1,1,1]; cst.lw=1.5*EX; cst.arrows=['','']; cst.double=null; cst.dash=null; cst.shorten=[0,0];
    body += pathSVG({st:cst, subs:[{...sub, ops:sub.ops.map(o=>({...o}))}], extraSVG:[], edges:[], nodes:[], noArrows:true}, ctx, false).svg;
  }
  body += pathSVG({st:pst, subs:[sub], extraSVG:[], edges:[], nodes:[]}, ctx).svg;
  // etichette
  for (const lb of labels){
    const lst=nodeBaseStyle(pst, ctx, 'node');
    lst.draw=undefined; lst.fill=undefined; lst.dash=null; lst.auto='left'; lst.swap=x.swap; lst.isep=[.5*EX,.5*EX];
    if (!x.phantom) lst.font = (pst.font||1)*.7;
    for (const t of cfg.labels) applyOpts(lst, t, ctx);
    if (x.desc){ lst.anchor='center'; lst.fill=[1,1,1]; }
    if (x.phantom){ lst.anchor='center'; lst.auto=null; }
    for (const {k,v} of parseOptList(subVars(lb.opts||'', ctx.vars))){
      if (k==='description'){ lst.anchor='center'; lst.fill=[1,1,1]; }
      else if (k==='marking'){ lst.anchor='center'; lst.sloped=true; lst.fill=[1,1,1]; lst.font=pst.font||1; }
      else if (k==='swap' || k==="'") lst.swap=!lst.swap;
      else applyKey(lst, k, v, ctx, 0);
    }
    if (lb.swap) lst.swap=!lst.swap;
    if (lst.pos===null) lst.pos = pst.pos!==null ? pst.pos : .5;
    const t=lb.text.trim(); const txt = cfg.math && t ? '$'+t+'$' : t;
    placeNodeOnPath({st:lst, make:p=>{ body += nodeSVG(buildNode(lst, txt, p, ctx)); }}, segAt(seg, lst.pos), {});
  }
  const clip = ctx.scope.clip ? ` clip-path="url(#${ctx.scope.clip})"` : '';
  emit(ctx, `<g data-s="${sIdx}"${clip}>${body}</g>`);
}
