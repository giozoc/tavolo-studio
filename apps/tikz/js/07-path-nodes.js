/* ============ NODI NEI PERCORSI, ALBERI, MATRICI, OUTPUT ============ */
function nodeBaseStyle(pst, ctx, kw){
  const n = cloneStyle(pst);
  n.draw=undefined; n.fill=undefined; n.shade=null; n.pattern=null; n.arrows=['','']; n.dash=pst.dash; n.rounded=0;
  n.nodeRot=0; n.labels=[]; n.name=null; n.anchor=null; n.place=null; n.pos=null; n.shape = kw==='coordinate'?'coordinate':'rectangle';
  n.sloped=false; n.auto=pst.auto; n.swap=pst.swap; n.matrix=false; n.mon=false; n.textWidth=0; n.minW=n.minH=0; n.isep=[3.333*PT,3.333*PT]; n.osep=null; n._rot=0;
  if (ctx.styles['every node']) applyOpts(n, ctx.styles['every node'], ctx);
  if (kw==='coordinate' && ctx.styles['every coordinate']) applyOpts(n, ctx.styles['every coordinate'], ctx);
  if (kw==='matrix'){ n.matrix=true; if (ctx.styles['every matrix']) applyOpts(n, ctx.styles['every matrix'], ctx); }
  return n;
}
function nodeOp(j, e, ps, ctx, kw, isHead, onEdge){
  const kwEnd = j;
  const nst = nodeBaseStyle(isHead ? ctx.style : ps.st, ctx, kw);
  if (isHead && ps.st){ /* comando \node: lo stile base è quello dello scope */ }
  let optSpan=null, nameSpan=null, atR=null, textG=null, M=M_ID, optTexts=[];
  let guard=0;
  for(;guard++<12;){
    j=skipWS(j,e);
    if (S[j]==='['){ const en=mcS(j); if(!optSpan) optSpan={s:j,e:en}; optTexts.push(S.slice(j+1,en)); j=en+1; continue; }
    if (S[j]==='(' && !nameSpan && !atR){ const en=mcS(j); nameSpan={s:j+1,e:en}; j=en+1; continue; }
    if (S.startsWith('at',j) && /[\s(]/.test(S[j+2]||'')){ j=skipWS(j+2,e); if(S[j]==='('){ atR=readCoord(j,ctx,ps.frame,ps); j=atR.end; } continue; }
    if (S.startsWith('foreach',j)){ ctx.warn('node foreach non supportato'); }
    break;
  }
  for (const t of optTexts){ const m=applyOpts(nst, t, ctx); M=mMul(M,m); }
  if (kw!=='coordinate'){
    if (S[j]==='{'){ const en=mcS(j); textG={s:j+1,e:en}; j=en+1; }
    else if (kw==='node'){ ctx.warn('node senza testo { }: aggiungi {}'); }
  }
  if (isHead){ ps.rec.opts = optSpan; ps.rec.text = textG; ps.rec.atSpan = atR?{s:atR.s,e:atR.e}:null; }
  if (nameSpan) nst.name = subVars(S.slice(nameSpan.s,nameSpan.e).trim(), ctx.vars);
  const text = textG ? subVars(S.slice(textG.s,textG.e), ctx.vars) : '';
  const shiftV = ps.frame.mat ? ps.frame.lin(M[4], M[5]) : (ctx.frame && ctx.frame.mat ? mLin(ctx.frame.mat, M[4], M[5]) : [M[4], M[5]]);
  const frameRot = ps.frame.mat ? mAngle(ps.frame.mat) : 0;
  const nIdx = R.nodes.length;
  R.nodes.push({stmt:ps.sIdx, text:textG, opts:optSpan, at:atR?{s:atR.s,e:atR.e}:null, kw, name:nst.name, kwEnd, head:!!isHead, atLit:!!(atR&&atR.h), cz:!!CZ_NODES[nst.shape]});
  const make = (p) => {
    p = V.add(p, shiftV);
    let n;
    if (nst.matrix) n = buildMatrix(nst, text, textG, p, ctx, ps);
    else n = buildNode(nst, text, p, ctx, frameRot);
    n.idx = nIdx; n.stmt = ps.sIdx;
    if (nst.name) R.names[nst.name] = n;
    ps.nodes.push(n);
    ps.treeParent = n;
    for (const lb of nst.labels) labelNode(n, lb, ctx, ps);
    if (atR && atR.h){ R.handles.push({h:atR.h, p:atR.p, stmt:ps.sIdx, role:'pt', node:nIdx}); if (n.kind==='pt' && V.len(shiftV)<1e-12) n.atH = atR.h; }
    return n;
  };
  if (atR){ make(atR.p); }
  else if (ps.forceAt){ const fa=ps.forceAt; ps.forceAt=null; make(fa); }
  else if (isHead){ make(ps.frame.map(0,0)); ps.cur = ps.nodes[ps.nodes.length-1].c; ps.curNode = kw==='coordinate'?null:ps.nodes[ps.nodes.length-1]; ps.relBase=ps.cur; }
  else if (ps.pend){ ps.waiting=(ps.waiting||[]); ps.waiting.push({st:nst, make}); }
  else if (onEdge){ ps.waiting=(ps.waiting||[]); ps.waiting.push({st:nst, make}); }
  else if (nst.pos!==null && ps.lastSeg){ placeNodeOnPath({st:nst, make}, segAt(ps.lastSeg, nst.pos), ps); }
  else {
    const q = ps.lastSeg ? segAt(ps.lastSeg,1) : {p:ps.cur||ps.frame.map(0,0), ang:0};
    if (!nst.sloped && !nst.auto) make(q.p); else placeNodeOnPath({st:nst, make}, q, ps);
    if (kw==='coordinate' && nst.name){ /* coordinate inline */ }
  }
  return j;
}
function labelNode(n, lb, ctx, ps){
  let txt=lb.txt||''; let opts='';
  if (txt[0]==='['){ const en=matchClose(txt,0); opts=txt.slice(1,en); txt=txt.slice(en+1); }
  let ang='above', t=txt;
  const m=/^([^:{}$\\]*):(.*)$/s.exec(txt);
  if (m){ ang=m[1].trim(); t=m[2]; }
  const amap={above:90,below:270,left:180,right:0,'above left':135,'above right':45,'below left':225,'below right':315,north:90,south:270,east:0,west:180,'north east':45,'north west':135,'south east':315,'south west':225,center:null};
  let a = amap[ang]!==undefined ? amap[ang] : parseFloat(ang); if (isNaN(a)) a=90;
  const lst = nodeBaseStyle(ctx.style, ctx, 'node'); applyOpts(lst, opts, ctx);
  const dist = lb.pin ? 3*EX : 0;
  const bp = a===null ? n.c : V.add(toPage(n, borderLocal(n, a-n.rot)), V.pol(a, dist));
  const names=['west','south west','south','south east','east','north east','north','north west'];
  if (a!==null){ const k=Math.round((((a%360)+360)%360)/45)%8; lst.anchor=names[k]; }
  const ln = buildNode(lst, t.trim().replace(/^\{|\}$/g,''), bp, ctx);
  ln.idx=n.idx; ln.stmt=n.stmt;
  ps.nodes.push(ln);
  if (lb.pin){ const pst=cloneStyle(ctx.style); pst.draw=true; pst.color=[.5,.5,.5]; pst.lw=.4*PT; ps.edges.push({st:pst, subs:[{start:toPage(n,borderLocal(n,a-n.rot)), ops:[{t:'L',p:nodeBorderToward(ln,n.c)}]}], nodes:[], edges:[], extraSVG:[]}); }
}
/* ---------- matrici ---------- */
function buildMatrix(mst, text, textG, p, ctx, ps){
  const rows = [];
  // divide per \\ e & a livello zero
  let cur='', row=[], d=0;
  for (let k=0;k<text.length;k++){
    const c=text[k];
    if (c==='\\' && text[k+1]==='\\' && d===0){ row.push(cur); rows.push(row); row=[]; cur=''; k++; if(text[k+1]==='['){ const en=text.indexOf(']',k); if(en>0) k=en; } continue; }
    if (c==='\\'){ cur+=c+(text[k+1]||''); k++; continue; }
    if (c==='{') d++; else if (c==='}') d--;
    if (c==='&' && d===0){ row.push(cur); cur=''; continue; }
    cur+=c;
  }
  if (cur.trim()) { row.push(cur); }
  if (row.length) rows.push(row);
  const name = mst.name||'matrix';
  const cells = rows.map((r,ri)=>r.map((c,ci)=>{
    let t=c.trim(), o='';
    const m=/^\|\[(.*?)\]\|/s.exec(t); if (m){ o=m[1]; t=t.slice(m[0].length).trim(); }
    let nm = null;
    const nm2=/^\\node\s*(\[[^\]]*\])?\s*(\(([^)]*)\))?\s*(?:at\s*\([^)]*\))?\s*\{([\s\S]*)\}\s*;?\s*$/.exec(t);
    if (nm2){ o=(o?o+',':'')+(nm2[1]?nm2[1].slice(1,-1):''); nm=nm2[3]||null; t=nm2[4]; }
    else if (!mst.mon){ if (t) ctx.warn('cella di matrice non interpretata: usa matrix of nodes'); }
    if (!t && !nm2 && !mst.mon) return null;
    const cst = nodeBaseStyle(ctx.style, ctx, 'node');
    if (ctx.styles['every cell']) applyOpts(cst, ctx.styles['every cell'], ctx);
    if (mst.mon && ctx.styles['nodes']) applyOpts(cst, ctx.styles['nodes'], ctx);
    if (mst.kv.nodes) applyOpts(cst, mst.kv.nodes, ctx);
    if (o) applyOpts(cst, o, ctx);
    if (mst.mon==='matrix of math nodes' && t) t='$'+t+'$';
    cst.name = nm || (name+'-'+(ri+1)+'-'+(ci+1));
    if (!t && !nm2 && mst.mon) { cst.name = name+'-'+(ri+1)+'-'+(ci+1); }
    const n = buildNode(cst, t, [0,0], ctx);
    return n;
  }));
  const nc = Math.max(...rows.map(r=>r.length));
  const cw = Array(nc).fill(0), rh = rows.map(()=>[0,0]);
  cells.forEach((r,ri)=>r.forEach((n,ci)=>{ if(!n) return; cw[ci]=Math.max(cw[ci],2*n.hw); rh[ri][0]=Math.max(rh[ri][0], n.hh); rh[ri][1]=Math.max(rh[ri][1], n.hh); }));
  const W = cw.reduce((a,b)=>a+b,0) + mst.colSep*(nc-1);
  const H = rh.reduce((a,b)=>a+b[0]+b[1],0) + mst.rowSep*(rows.length-1);
  // nodo-contenitore
  const box = buildNode({...mst, minW:0, minH:0, shape:'rectangle'}, '', p, ctx);
  box.iw = W/2 + mst.isep[0]; box.ih = H/2 + mst.isep[1]; box.tw=W; box.th=H; box.td=0; box.r={w:0,h:0,d:0};
  nodeGeom(box);
  const al = anchorLocal(box, mst.anchor||'center')||[0,0];
  box.c = V.sub(p, al);
  let y = box.c[1] + H/2;
  cells.forEach((r,ri)=>{
    let x = box.c[0] - W/2; y -= rh[ri][0];
    r.forEach((n,ci)=>{
      if (n){ const d=V.sub([x+cw[ci]/2, y], n.c); n.c=V.add(n.c,d); n.idx=R.nodes.length-1; n.stmt=ps.sIdx; R.names[n.st.name]=n; ps.nodes.push(n); }
      x += cw[ci] + mst.colSep;
    });
    y -= rh[ri][1] + mst.rowSep;
  });
  return box;
}
/* ---------- alberi ---------- */
function childOps(j, e, ps, ctx){
  const parent = ps.treeParent; const L = (ps.treeLevel||0)+1;
  const kids=[];
  for(;;){
    j=skipWS(j,e);
    if (!S.startsWith('child',j)) break;
    j=skipWS(j+5,e); let op='';
    if (S[j]==='['){ const en=mcS(j); op=S.slice(j+1,en); j=skipWS(en+1,e); }
    if (S.startsWith('foreach',j)){ ctx.warn('child foreach non supportato'); }
    if (S[j]!=='{'){ ctx.warn('child: manca { }'); break; }
    const en=mcS(j); kids.push({op, s:j+1, e:en}); j=en+1;
  }
  if (!parent){ ctx.warn('child senza nodo genitore'); return j; }
  const tst = cloneStyle(ps.st);
  if (ctx.styles['level '+L]) applyOpts(tst, ctx.styles['level '+L], ctx);
  if (ctx.styles['level']) applyOpts(tst, ctx.styles['level'].replace(/#1/g,L), ctx);
  const get = (st,k,d)=>{ try{ return st.kv[k]!==undefined && st.kv[k]!==true ? lenCm(String(st.kv[k]),ctx) : d; }catch(err){ return d; } };
  const n = kids.length;
  kids.forEach((kd,k)=>{
    const cst = cloneStyle(tst); if (kd.op) applyOpts(cst, kd.op, ctx);
    if (/missing/.test(kd.op)) return;
    const ld = get(cst,'level distance',1.5), sd = get(cst,'sibling distance',1.5);
    let g = cst.kv.grow; let gd = -90;
    if (g) gd = {down:-90,up:90,left:180,right:0,south:-90,north:90,east:0,west:180}[g] ?? +g;
    const gv = V.pol(gd, ld);
    const horiz = Math.abs(Math.cos(gd*D2R)) > Math.abs(Math.sin(gd*D2R));
    const off = horiz ? [0, ((n-1)/2-k)*sd] : [(k-(n-1)/2)*sd, 0];
    const pos = V.add(V.add(parent.c, gv), off);
    const sub = {...ps, st:cst, subs:[], waiting:[], nodes:ps.nodes, edges:ps.edges, forceAt:pos, treeLevel:L, treeParent:null, cur:pos, curNode:null, pend:null, lastSeg:null};
    // il corpo può iniziare con node/coordinate e contenere altri child
    const before = ps.nodes.length;
    pathOps(kd.s, kd.e, sub, ctx);
    const child = sub.nodes[before] || null;
    const efp = cst.kv['edge from parent'];
    if (efp!=='none' && !(typeof efp==='string' && /draw\s*=\s*none/.test(efp))){
      const est = cloneStyle(cst); est.draw = est.draw||true; est.arrows=['','']; est.fill=undefined; est.shade=null;
      if (typeof cst.kv['edge from parent'] === 'string') applyOpts(est, cst.kv['edge from parent'], ctx);
      if (ctx.styles['edge from parent']) applyOpts(est, ctx.styles['edge from parent'], ctx);
      const tgt = child ? child.c : pos;
      const a = nodeBorderToward(parent, tgt), b = child ? nodeBorderToward(child, parent.c) : pos;
      ps.edges.push({st:est, subs:[{start:a, ops:[{t:'L',p:b}]}], nodes:[], edges:[], extraSVG:[]});
    }
  });
  ps.treeParent = parent;
  return j;
}
/* ---------- marker pgfplots ---------- */
function marksSVG(pts, st, mark){
  const ms = st.kv['mark size'] ? evalLen(st.kv['mark size'],{},PT) : 2*PT;
  const mst = cloneStyle(st); mst.dash=null; mst.lw=Math.min(st.lw,.4*PT); mst.opacity=st.opacity;
  if (st.kv['mark options']) applyOpts(mst, st.kv['mark options'], {vars:{},styles:{},warn:()=>{}});
  const dc = css(mst.draw && mst.draw!==true ? mst.draw : mst.color);
  const fcRaw = mst.fill && mst.fill!==true ? mst.fill : mst.color; const fc=css(fcRaw);
  const lw = fmt(mst.lw,5); const r=ms;
  let rep = 1; if (st.kv['mark repeat']) rep = Math.max(1, +st.kv['mark repeat']||1);
  const filled = /\*$/.test(mark);
  const base = mark.replace(/\*$/,'');
  let out = `<g stroke="${dc}" stroke-width="${lw}" fill="${filled||base===''?fc:'#fff'}"${mst.opacity<1?` opacity="${mst.opacity}"`:''}>`;
  pts.forEach((p,k)=>{
    if (k%rep) return;
    const x=fmt(p[0],4), y=fmt(-p[1],4), X=+x, Y=+y;
    switch(base){
      case '': out+=`<circle cx="${x}" cy="${y}" r="${fmt(r,4)}" stroke="none"/>`; break;
      case 'o': case 'ball': out+=`<circle cx="${x}" cy="${y}" r="${fmt(r,4)}" fill="${base==='ball'?fc:'#fff'}"/>`; break;
      case 'x': out+=`<path d="M${X-r} ${Y-r}L${X+r} ${Y+r}M${X-r} ${Y+r}L${X+r} ${Y-r}" fill="none"/>`; break;
      case '+': out+=`<path d="M${X-r} ${Y}H${X+r}M${X} ${Y-r}V${Y+r}" fill="none"/>`; break;
      case '-': out+=`<path d="M${X-r} ${Y}H${X+r}" fill="none"/>`; break;
      case '|': out+=`<path d="M${X} ${Y-r}V${Y+r}" fill="none"/>`; break;
      case 'square': out+=`<rect x="${X-r}" y="${Y-r}" width="${2*r}" height="${2*r}"/>`; break;
      case 'triangle': out+=`<path d="M${X} ${Y-r}L${X+r*.87} ${Y+r/2}L${X-r*.87} ${Y+r/2}Z"/>`; break;
      case 'diamond': out+=`<path d="M${X} ${Y-r}L${X+r*.75} ${Y}L${X} ${Y+r}L${X-r*.75} ${Y}Z"/>`; break;
      case 'pentagon': { const q=[]; for(let i=0;i<5;i++){ const a=(-90+i*72)*D2R; q.push((X+r*Math.cos(a))+' '+(Y+r*Math.sin(a))); } out+=`<path d="M${q.join('L')}Z"/>`; break; }
      case 'otimes': case 'oplus': { out+=`<circle cx="${x}" cy="${y}" r="${fmt(r,4)}"/>`; const k2=base==='otimes'?r*.707:r; out+= base==='otimes'?`<path d="M${X-k2} ${Y-k2}L${X+k2} ${Y+k2}M${X-k2} ${Y+k2}L${X+k2} ${Y-k2}" fill="none"/>`:`<path d="M${X-r} ${Y}H${X+r}M${X} ${Y-r}V${Y+r}" fill="none"/>`; break; }
      case 'star': case 'asterisk': { let d=''; for(let i=0;i<(base==='star'?5:6);i++){ const a=(-90+i*(base==='star'?72:60))*D2R; d+=`M${X} ${Y}L${X+r*Math.cos(a)} ${Y+r*Math.sin(a)}`; } out+=`<path d="${d}" fill="none"/>`; break; }
      default: out+=`<circle cx="${x}" cy="${y}" r="${fmt(r,4)}"/>`;
    }
  });
  return out+'</g>';
}
/* ---------- output del percorso ---------- */
function subD(sub, rounded){
  if (!sub || !sub.ops.length) return sub && sub.closed===false ? '' : '';
  if (rounded>0 && sub.ops.every(o=>o.t==='L') && sub.ops.length>=1){
    const pts=[sub.start, ...sub.ops.map(o=>o.p)];
    const closed=sub.closed; if (closed && V.len(V.sub(pts[0],pts[pts.length-1]))>1e-9) pts.push(pts[0]);
    const n=pts.length; let d='';
    const corner = (prev,c,next)=>{ const a=V.sub(prev,c), b=V.sub(next,c); const la=V.len(a), lb=V.len(b); const r=Math.min(rounded, la/2, lb/2); return [V.add(c,V.mul(a,r/(la||1))), V.add(c,V.mul(b,r/(lb||1)))]; };
    if (closed){
      const [s0,e0]=corner(pts[n-2],pts[0],pts[1]);
      d='M'+P(e0);
      for (let k=1;k<n-1;k++){ const [a,b]=corner(pts[k-1],pts[k],pts[k+1]); d+='L'+P(a)+'Q'+P(pts[k])+' '+P(b); }
      d+='L'+P(s0)+'Q'+P(pts[0])+' '+P(e0)+'Z';
    } else {
      d='M'+P(pts[0]);
      for (let k=1;k<n-1;k++){ const [a,b]=corner(pts[k-1],pts[k],pts[k+1]); d+='L'+P(a)+'Q'+P(pts[k])+' '+P(b); }
      d+='L'+P(pts[n-1]);
    }
    return d;
  }
  let d='M'+P(sub.start);
  for (const o of sub.ops) d += o.t==='L' ? 'L'+P(o.p) : 'C'+P(o.c1)+' '+P(o.c2)+' '+P(o.p);
  if (sub.closed) d+='Z';
  return d;
}
function applyTips(ps){
  const st=ps.st; let out='';
  if (ps.noArrows || (!st.arrows[0] && !st.arrows[1] && !st.shorten[0] && !st.shorten[1])) return out;
  const subs=ps.subs.filter(s=>s&&s.ops.length&&!s.hidden);
  const sub=subs[subs.length-1]; if(!sub || sub.closed) return out;
  const ts = tipInfo(st.arrows[0], st, true), te = tipInfo(st.arrows[1], st, false);
  // fine
  const last=sub.ops[sub.ops.length-1];
  const prevP = sub.ops.length>1 ? sub.ops[sub.ops.length-2].p : sub.start;
  {
    const from = last.t==='C' ? (V.len(V.sub(last.p,last.c2))>1e-6 ? last.c2 : last.c1) : prevP;
    const ang = V.ang(V.sub(last.p, from));
    const tipP = V.sub(last.p, V.pol(ang, st.shorten[1]));
    if (te) out += tipSVG(te, tipP, ang, st);
    const back = (te?te.back:0) + st.shorten[1];
    if (back){ const dv=V.pol(ang,-back); last.p=V.add(last.p,dv); if(last.t==='C'){ last.c2=V.add(last.c2,dv); } }
  }
  {
    const f=sub.ops[0]; const to = f.t==='C' ? (V.len(V.sub(f.c1,sub.start))>1e-6?f.c1:f.c2) : f.p;
    const ang = V.ang(V.sub(sub.start, to));
    const tipP = V.sub(sub.start, V.pol(ang, st.shorten[0]));
    if (ts) out += tipSVG(ts, tipP, ang, st);
    const back = (ts?ts.back:0) + st.shorten[0];
    if (back){ const dv=V.pol(ang,-back); sub.start=V.add(sub.start,dv); if(f.t==='C') f.c1=V.add(f.c1,dv); }
  }
  return out;
}
function pathSVG(ps, ctx, hit=true){
  const st=ps.st;
  const tips = applyTips(ps);
  const ds = ps.subs.filter(s=>s && !s.hidden).map(s=>subD(s, st.rounded)).filter(Boolean);
  const d = ds.join('');
  let out='';
  if (d){
    const pt = paint(st);
    if (st.double && pt.stroke!=='none'){
      const dd = st.ddist||.6*PT;
      out += `<path d="${d}" fill="${pt.fill}" stroke="${pt.stroke}"${pt.a.replace(/stroke-width="[^"]*"/,`stroke-width="${fmt(2*st.lw+dd,5)}"`)}/>`;
      out += `<path d="${d}" fill="none" stroke="${css(st.double)}" stroke-width="${fmt(dd,5)}"/>`;
    } else if (pt.fill!=='none' || pt.stroke!=='none') out += `<path d="${d}" fill="${pt.fill}" stroke="${pt.stroke}"${pt.a}/>`;
    if (hit) out += `<path class="hit" fill="none" d="${d}" stroke-width="${fmt(HITW,4)}"/>` + (pt.fill!=='none' ? `<path class="hitf" fill="transparent" d="${d}"/>` : '');
    if (pt.fill==='none' && pt.stroke==='none' && hit && !ps.clip) out += '';
  }
  out += tips + (ps.extraSVG||[]).join('');
  return {svg:out, d};
}
function finishPath(ps, ctx){
  let body='';
  // capi a cui agganciare i collegamenti (palette dei circuiti)
  if (!ps.clip) for (const sb of ps.subs) if (sb && !sb.hidden){ R.pins.push({p:sb.start, s:ps.sIdx}); for (const o of sb.ops) R.pins.push({p:o.p, s:ps.sIdx}); }
  for (const n of ps.nodes) if (n.kind==='cz'){
    const an = n.cz.anchors ? n.cz.anchors(n.czL) : {};
    const ks = Object.keys(an).filter(k=>!/^(base|collector|emitter|gate|drain|source|up|down)$/.test(k));
    if (n.name && ks.length) for (const k of ks) R.pins.push({p:toPage(n, an[k]), t:`(${n.name}.${k})`, s:ps.sIdx});
    else R.pins.push({p:n.c, t:n.name?`(${n.name})`:null, s:ps.sIdx});
  }
  const main = pathSVG(ps, ctx);
  if (ps.clip){
    const id='clip'+(R.clipN++);
    DEFS.push(`<clipPath id="${id}"><path d="${main.d}"/></clipPath>`);
    if (ps.st.draw || ps.st.fill) body += main.svg;
    ctx.scope.clip = id;
  } else body += main.svg;
  for (const ed of ps.edges){ body += pathSVG(ed, ctx).svg; }
  for (const n of ps.nodes){
    let hb='';
    if (n.kind==='pt' && n.stmt>=0 && n.idx>=0){ const c=n.c, a=.09; hb=`<path class="cmark" d="M${fmt(c[0]-a,4)} ${fmt(-c[1],4)}H${fmt(c[0]+a,4)}M${fmt(c[0],4)} ${fmt(-c[1]-a,4)}V${fmt(-c[1]+a,4)}"/><circle class="hitf" fill="transparent" cx="${fmt(c[0],4)}" cy="${fmt(-c[1],4)}" r="${fmt(a*1.6,4)}"/>`; }
    if (n.kind!=='pt'){ const hw=Math.max(n.hw,.08), hh=Math.max(n.hh,.08); hb=`<rect class="hitf" fill="transparent" x="${fmt(n.c[0]-hw,4)}" y="${fmt(-n.c[1]-hh,4)}" width="${fmt(2*hw,4)}" height="${fmt(2*hh,4)}"${n.rot?` transform="rotate(${fmt(-n.rot)} ${fmt(n.c[0],4)} ${fmt(-n.c[1],4)})"`:''}/>`; }
    body += `<g data-n="${n.idx}">${nodeSVG(n)}${autSVG(n, ctx)}${hb}</g>`;
  }
  const clip = ctx.scope.clip && !ps.clip ? ` clip-path="url(#${ctx.scope.clip})"` : '';
  emit(ctx, `<g data-s="${ps.sIdx}"${clip}>${body}</g>`);
}
