/* ============ PERCORSI ============ */
const NUM_RE = /^(-?(?:\d+\.?\d*|\.\d+))\s*(cm|mm|pt|in|bp)?$/;
function litSpan(txt, abs){
  // se txt è un numero letterale ritorna {s,e,val,unit}
  const lead = txt.length - txt.trimStart().length;
  const t = txt.trim(); const m = NUM_RE.exec(t);
  if (!m) return null;
  return {s:abs+lead, e:abs+lead+t.length, val:+m[1], unit:m[2]||''};
}
/* analizza il testo di una coordinata (senza parentesi). abs = offset in S del testo */
function coordText(txt, abs, ctx, frame, ps){
  const t = txt.trim();
  const vars = ctx.vars;
  // () vuota: il nodo corrente (edge [loop] ())
  if (!t && ps) return ps.curNode ? {p:ps.curNode.c, node:ps.curNode} : {p:ps.cur||frame.map(0,0)};
  // calc
  if (t[0]==='$') return {p: calcExpr(t.replace(/^\$|\$$/g,''), ctx, frame, ps)};
  // sistemi di coordinate
  let m = /^([a-z ]+?)\s+cs\s*:(.*)$/s.exec(t);
  if (m){
    const cs=m[1].trim(), rest=m[2];
    if (cs==='axis' && ctx.axis){
      const q=splitTop(rest); const off=abs+txt.indexOf(':')+1;
      const x=+evalExpr(unbrace(q[0]),vars), y=+evalExpr(unbrace(q[1]),vars);
      const res={p:ctx.axis.frame.map(x,y)};
      const lx=litSpan(q[0], off), ly=litSpan(q[1], off+q[0].length+1);
      if (lx&&ly) res.h={kind:'abs', x:lx, y:ly, frame:ctx.axis.frame};
      return res;
    }
    if ((cs==='rel axis' || cs==='axis description') && ctx.axis){ const q=splitTop(rest); return {p:ctx.axis.rel(+evalExpr(unbrace(q[0]),vars), +evalExpr(unbrace(q[1]),vars))}; }
    const kv = {}; for (const {k,v} of parseOptList(rest)) kv[k]=v;
    if (cs==='canvas') return {p:[kv.x?lenCm(kv.x,ctx):0, kv.y?lenCm(kv.y,ctx):0]};
    if (cs==='canvas polar') return {p:V.pol(+evalExpr(kv.angle||'0',vars), lenCm(kv.radius||'0',ctx))};
    if (cs==='polar'){ const r=lenCm(kv.radius||'0',ctx); return {p:frame.map(...V.pol(+evalExpr(kv.angle||'0',vars), r))}; }
    if (cs==='xy') return {p:frame.map(+evalExpr(kv.x||'0',vars), +evalExpr(kv.y||'0',vars))};
    if (cs==='node'){ const n=R.names[kv.name]; if(n) return {p: kv.anchor? nodeAnchor(n,kv.anchor):n.c}; }
    ctx.warn('sistema di coordinate «'+cs+'» non supportato'); return {p:frame.map(0,0)};
  }
  // intersezione perpendicolare (a |- b)
  m = /^(.+?)\s*(\|-|-\|)\s*(.+)$/.exec(t);
  if (m && !/^[-\d.]/.test(t) && !t.includes(',')){
    const a=coordText(m[1].replace(/^\(|\)$/g,''),0,ctx,frame,ps).p, c=coordText(m[3].replace(/^\(|\)$/g,''),0,ctx,frame,ps).p;
    return {p: m[2]==='|-' ? [a[0],c[1]] : [c[0],a[1]]};
  }
  const parts = splitTop(t);
  if (parts.length===1){
    // polare a:r oppure nome
    const pc = splitTop(t, ':');
    if (pc.length===2){
      const ang = +evalExpr(unbrace(pc[0]), vars);
      const rr = pc[1].split(/\s+and\s+/);
      const rx = lenCm(unbrace(rr[0]),ctx), ry = rr[1]!==undefined ? lenCm(unbrace(rr[1]),ctx) : rx;
      const res = {p: frame.map(Math.cos(ang*D2R)*rx, Math.sin(ang*D2R)*ry)};
      const off=abs+txt.indexOf(':');
      const la=litSpan(pc[0], abs), lr=rr.length===1 ? litSpan(pc[1], off+1) : null;
      if (la&&lr) res.h={kind:'polar', a:la, r:lr, frame};
      return res;
    }
    // nome di nodo o coordinata, con eventuale ancora
    let nm = subVars(t, vars), anc=null;
    let n = R.names[nm];
    if (!n){ const dot=nm.lastIndexOf('.'); if(dot>0){ n=R.names[nm.slice(0,dot)]; anc=nm.slice(dot+1); } }
    if (!n){ ctx.warn('nodo o coordinata «'+nm+'» non definito'); return {p:frame.map(0,0), missing:true}; }
    if (anc){ const p=nodeAnchor(n, anc); if(!p){ ctx.warn('ancora «'+anc+'» sconosciuta'); return {p:n.c}; } return {p}; }
    if (n.kind==='pt' && n.atH) return {p:n.c, node:null, h:{...n.atH, proxy:true, pname:nm}};
    return {p:n.c, node: n.kind==='pt' ? null : n};
  }
  if (parts.length>=2){
    const x = lenCm(unbrace(parts[0]),ctx), y = lenCm(unbrace(parts[1]),ctx);
    let z = parts[2]!==undefined ? lenCm(unbrace(parts[2]),ctx) : 0;
    const res = {p: frame.map(x - z*.385, y - z*.385)};
    if (parts.length===2){
      const lx = litSpan(parts[0], abs), ly = litSpan(parts[1], abs+parts[0].length+1);
      if (lx&&ly) res.h={kind:'abs', x:lx, y:ly, frame};
    }
    return res;
  }
  return {p:frame.map(0,0)};
}
function calcExpr(t, ctx, frame, ps){
  // ($ 2*(a) + (b)!.5!(c) - (1,0) $)
  let i=0; let acc=[0,0]; let sign=1; let first=true;
  const ws=()=>{ while(i<t.length && /\s/.test(t[i])) i++; };
  const coord = () => { ws(); if (t[i]!=='('){ throw new MathErr('calc: attesa una coordinata'); } const e=matchClose(t,i); const r=coordText(t.slice(i+1,e),0,ctx,frame,ps).p; i=e+1; return r; };
  while (i<t.length){
    ws(); if (i>=t.length) break;
    if (t[i]==='+'){ sign=1; i++; continue; } if (t[i]==='-'){ sign=-1; i++; continue; }
    let factor=1;
    if (t[i]!=='('){
      // fattore numerico seguito da *
      let d=0, j=i; for(;j<t.length;j++){ const c=t[j]; if(c==='{'||c==='(')d++; else if(c==='}'||c===')')d--; if(c==='*'&&d===0) break; }
      if (t[j]!=='*') throw new MathErr('calc non valido');
      factor=+evalExpr(unbrace(t.slice(i,j)), ctx.vars); i=j+1;
    }
    let p = coord(); ws();
    while (t[i]==='!'){
      // modificatori
      const e = t.indexOf('!', i+1); const mod=t.slice(i+1,e).trim(); i=e+1; ws();
      let rot=0; const rm=/^(.*?)\s*$/.exec(t.slice(i));
      let am=/^([^:()]*):/.exec(t.slice(i));
      if (am && t[i]!=='('){ rot=+evalExpr(am[1],ctx.vars); i+=am[0].length; }
      const q = coord(); ws();
      let dir=V.sub(q,p); if (rot) dir=V.rot(dir,rot);
      if (/(cm|mm|pt|in)\s*$/.test(mod)){ const L=lenCm(mod,ctx); const l=V.len(dir)||1; p=V.add(p,V.mul(dir,L/l)); }
      else { const f=+evalExpr(unbrace(mod),ctx.vars); p=V.add(p,V.mul(dir,f)); }
    }
    acc = V.add(acc, V.mul(p, sign*factor)); sign=1; first=false;
  }
  return acc;
}
/* lettura di una coordinata in S a partire da '(' */
function readCoord(i, ctx, frame, ps){
  const e=mcS(i); if(e<0) throw new MathErr('parentesi ( non chiusa');
  const r=coordText(S.slice(i+1,e), i+1, ctx, frame, ps);
  return {...r, end:e+1, s:i, e};
}
function addHandle(h, p, stmt, role='pt', base=null, extra={}){
  if (!h) return;
  R.handles.push({h, p, stmt, role, base, ...extra});
}
/* ---------- istruzione di percorso ---------- */
function pathStmt(cmdStart, name, i, e, ctx){
  const sIdx = stmtRec(cmdStart, e+1, name, i);
  const rec = R.stmts[sIdx];
  rec.frame = ctx.frame;
  const st = cloneStyle(ctx.style); st.nodeRot=0; st.labels=[]; st.name=null; st.anchor=null; st.place=null; st.pos=null;
  let frame = ctx.frame;
  if (name==='draw'){ if(st.draw===undefined) st.draw=true; }
  else if (name==='fill'){ if(st.fill===undefined) st.fill=true; }
  else if (name==='filldraw'){ if(st.draw===undefined) st.draw=true; if(st.fill===undefined) st.fill=true; }
  else if (name==='shade'){ st.shade=st.shade||{type:'v'}; if(st.fill===undefined) st.fill=true; }
  else if (name==='shadedraw'){ st.shade=st.shade||{type:'v'}; if(st.fill===undefined) st.fill=true; if(st.draw===undefined) st.draw=true; }
  else if (name==='pattern'){ st.pattern=st.pattern||'north east lines'; if(st.fill===undefined) st.fill=true; }
  else if (name==='graph'||name==='pic'||name==='datavisualization'){ ctx.warn('\\'+name+' non supportato'); return; }
  const isNodeCmd = name==='node'||name==='coordinate'||name==='matrix';
  const ps = {st, frame, subs:[], cur:null, relBase:null, curNode:null, pend:null, nodes:[], sIdx, rec, lastSeg:null, edges:[], clip:name==='clip', extraSVG:[]};
  let j = skipWS(i,e);
  if (!isNodeCmd){
    const op = readOpt(j);
    if (op && op.e<e){ rec.opts={s:op.s, e:op.e}; const M=applyOpts(st, op.text, ctx); ps.frame=frame=composeFrame(frame, M); j=op.e+1; }
    if (st.kv.clip) ps.clip=true;
    if (/every path/.test(Object.keys(ctx.styles).join('|')) && ctx.styles['every path']) applyOpts(st, ctx.styles['every path'], ctx);
  } else {
    const kw = name==='matrix' ? 'matrix' : name;
    j = nodeOp(j, e, ps, ctx, kw, true);
  }
  pathOps(j, e, ps, ctx);
  finishPath(ps, ctx);
}
function pathOps(j, e, ps, ctx){
  const st=ps.st;
  let guard=0;
  while (j<e && guard++<20000){
    j = skipWS(j,e); if (j>=e) break;
    const c=S[j];
    if (c==='('){ const r=readCoord(j, ctx, ps.frame, ps); j=r.end; coordOp(r, ps, ctx, 'abs'); continue; }
    if (c==='+' ){
      const pp = S[j+1]==='+'; const k=skipWS(j+(pp?2:1),e);
      if (S[k]!=='('){ ctx.warn('attesa coordinata dopo +'); j=k; continue; }
      const raw = readCoordRel(k, ctx, ps); j=raw.end; coordOp(raw, ps, ctx, pp?'++':'+'); continue;
    }
    if (c==='['){ const en=mcS(j); const M=applyOpts(st, S.slice(j+1,en), ctx); ps.frame=composeFrame(ps.frame,M); j=en+1; continue; }
    if (c==='{'||c==='}'){ j++; continue; }
    if (c==='-' && S[j+1]==='-'){ ps.pend={t:'L'}; j+=2; continue; }
    if (c==='-' && S[j+1]==='|'){ ps.pend={t:'HV', hv:false}; j+=2; continue; }
    if (c==='|' && S[j+1]==='-'){ ps.pend={t:'HV', hv:true}; j+=2; continue; }
    if (c==='.' && S[j+1]==='.'){
      j=skipWS(j+2,e);
      if (S.startsWith('controls',j)){
        j=skipWS(j+8,e); let c1, c2;
        const r1 = S.slice(j,j+2)==='++'||S[j]==='+' ? readCoordRel(skipWS(j+(S[j+1]==='+'?2:1),e), ctx, ps, true) : readCoord(j, ctx, ps.frame, ps);
        const base = ps.cur;
        c1 = r1.rel ? V.add(base, r1.p) : r1.p; addHandle(r1.h, c1, ps.sIdx, 'ctl', r1.rel?base:null, {link:base});
        j=skipWS(r1.end,e);
        let r2=null;
        if (S.startsWith('and',j)){ j=skipWS(j+3,e); r2 = S[j]==='+' ? readCoordRel(skipWS(j+(S[j+1]==='+'?2:1),e), ctx, ps, true) : readCoord(j, ctx, ps.frame, ps); j=skipWS(r2.end,e); }
        if (S.slice(j,j+2)==='..') j+=2;
        ps.pend={t:'C', c1, r2};
        continue;
      }
      continue;
    }
    const w = /^[a-zA-Z]+/.exec(S.slice(j,j+20)); const word = w?w[0]:'';
    if (c==='\\'){
      const cmd=readCmd(j);
      if (cmd.name==='foreach'){ j = foreachStmt(j, cmd.end, e, ctx, (s,en,c2)=>{ const sv=ctx.vars; ctx.vars=c2.vars; pathOps(s,en,ps,{...ctx,vars:c2.vars}); ctx.vars=sv; }); continue; }
      ctx.warn('comando \\'+cmd.name+' non valido in un percorso'); j=cmd.end; continue;
    }
    switch(word){
      case 'cycle': { closeSub(ps); j+=5; continue; }
      case 'to': { j = toOp(j+2, e, ps, ctx, false); continue; }
      case 'edge': { j = toOp(j+4, e, ps, ctx, true); continue; }
      case 'node': { j = nodeOp(j+4, e, ps, ctx, 'node', false); continue; }
      case 'coordinate': { j = nodeOp(j+10, e, ps, ctx, 'coordinate', false); continue; }
      case 'pic': { ctx.warn('pic non supportato'); const k=mcS(skipWS(j+3,e)); j = k>0?k+1:e; continue; }
      case 'rectangle': {
        j=skipWS(j+9,e); const r = S[j]==='+' ? readCoordRel(skipWS(j+(S[j+1]==='+'?2:1),e), ctx, ps) : readCoord(j, ctx, ps.frame, ps);
        j=r.end; const a=ps.cur||ps.frame.map(0,0); const b=r.rel?V.add(ps.relBase||a,r.p):r.p;
        if (r.h) addHandle(r.h, b, ps.sIdx, 'pt', r.rel?(ps.relBase||a):null);
        // rettangolo nel sistema locale: usa frame per gli spigoli
        const la=ps.frame.inv(...a), lb=ps.frame.inv(...b);
        const pts=[a, ps.frame.map(lb[0],la[1]), b, ps.frame.map(la[0],lb[1])];
        startSub(ps, a); pushOp(ps,{t:'L',p:pts[1]}); pushOp(ps,{t:'L',p:pts[2]}); pushOp(ps,{t:'L',p:pts[3]}); closeSub(ps);
        ps.cur=b; ps.relBase=b; ps.curNode=null; ps.lastSeg={k:'L',a:pts[0],b:pts[2]};
        continue; }
      case 'circle': case 'ellipse': {
        j=skipWS(j+word.length,e);
        const lst=cloneStyle(st);
        if (S[j]==='['){ const en=mcS(j); applyOpts(lst,S.slice(j+1,en),ctx); j=skipWS(en+1,e); }
        let rx, ry, rspan=null;
        if (S[j]==='('){ const en=mcS(j); const txt=S.slice(j+1,en); const pr=txt.split(/\s+and\s+/); rx=lenCm(unbrace(pr[0]),ctx); ry=pr[1]?lenCm(unbrace(pr[1]),ctx):rx; if(!pr[1]) rspan=litSpan(txt,j+1); j=en+1; }
        else { rx=lst.xr?lenCm(lst.xr,ctx):lst.radius?lenCm(lst.radius,ctx):.5; ry=lst.yr?lenCm(lst.yr,ctx):lst.radius?lenCm(lst.radius,ctx):rx; if(lst.radius && rec(ps).opts){} }
        const c0 = ps.cur||ps.frame.map(0,0); const lc=ps.frame.inv(...c0);
        const bz = arcBez(lc[0],lc[1],rx,ry,0,360).map(s=>s.map(q=>ps.frame.map(...q)));
        const st0 = ps.frame.map(lc[0]+rx, lc[1]);
        startSub(ps, st0); for (const [c1,c2,p] of bz) pushOp(ps,{t:'C',c1,c2,p}); closeSub(ps);
        if (rspan){ const fr=ps.frame; R.handles.push({h:{kind:'radius', r:rspan, frame:fr, center:lc}, p:st0, stmt:ps.sIdx, role:'ctl', link:c0}); }
        ps.cur=c0; ps.curNode=null;
        continue; }
      case 'arc': {
        j=skipWS(j+3,e);
        const lst=cloneStyle(st); let sa=null,ea=null,rx=null,ry=null,da=null;
        if (S[j]==='['){ const en=mcS(j); applyOpts(lst,S.slice(j+1,en),ctx); j=skipWS(en+1,e); sa=lst.sa; ea=lst.ea; da=lst.da; }
        if (S[j]==='('){ const en=mcS(j); const q=splitTop(S.slice(j+1,en),':'); sa=+evalExpr(unbrace(q[0]),ctx.vars); ea=+evalExpr(unbrace(q[1]),ctx.vars); const pr=(q[2]||'1').split(/\s+and\s+/); rx=lenCm(unbrace(pr[0]),ctx); ry=pr[1]?lenCm(unbrace(pr[1]),ctx):rx; j=en+1; }
        if (rx===null){ rx=lst.xr?lenCm(lst.xr,ctx):lst.radius?lenCm(lst.radius,ctx):1; ry=lst.yr?lenCm(lst.yr,ctx):lst.radius?lenCm(lst.radius,ctx):rx; }
        if (ea===null && da!==null) ea=sa+da; if (sa===null && da!==null) sa=ea-da;
        if (sa===null||ea===null){ ctx.warn('arc: angoli mancanti'); continue; }
        const p0 = ps.cur||ps.frame.map(0,0); const l0=ps.frame.inv(...p0);
        const cx=l0[0]-rx*Math.cos(sa*D2R), cy=l0[1]-ry*Math.sin(sa*D2R);
        if (!ps.subs.length || !curSub(ps)) startSub(ps,p0);
        for (const [c1,c2,p] of arcBez(cx,cy,rx,ry,sa,ea)) pushOp(ps,{t:'C',c1:ps.frame.map(...c1),c2:ps.frame.map(...c2),p:ps.frame.map(...p)});
        ps.cur = ps.frame.map(cx+rx*Math.cos(ea*D2R), cy+ry*Math.sin(ea*D2R)); ps.relBase=ps.cur; ps.curNode=null;
        continue; }
      case 'grid': {
        j=skipWS(j+4,e); const lst=cloneStyle(st);
        if (S[j]==='['){ const en=mcS(j); applyOpts(lst,S.slice(j+1,en),ctx); j=skipWS(en+1,e); }
        const r = S[j]==='+' ? readCoordRel(skipWS(j+(S[j+1]==='+'?2:1),e), ctx, ps) : readCoord(j, ctx, ps.frame, ps); j=r.end;
        const a=ps.cur||ps.frame.map(0,0), b=r.rel?V.add(a,r.p):r.p;
        if (r.h) addHandle(r.h, b, ps.sIdx, 'pt', r.rel?a:null);
        const la=ps.frame.inv(...a), lb=ps.frame.inv(...b);
        const x0=Math.min(la[0],lb[0]), x1=Math.max(la[0],lb[0]), y0=Math.min(la[1],lb[1]), y1=Math.max(la[1],lb[1]);
        const [sx,sy]=lst.step; const eps=1e-9;
        for (let x=Math.ceil(x0/sx-eps)*sx; x<=x1+eps && sx>0; x+=sx){ startSub(ps, ps.frame.map(x,y0)); pushOp(ps,{t:'L',p:ps.frame.map(x,y1)}); }
        for (let y=Math.ceil(y0/sy-eps)*sy; y<=y1+eps && sy>0; y+=sy){ startSub(ps, ps.frame.map(x0,y)); pushOp(ps,{t:'L',p:ps.frame.map(x1,y)}); }
        ps.noArrows=true; ps.cur=b; ps.relBase=b; ps.subs.push(null);
        continue; }
      case 'plot': { j = plotOp(j+4, e, ps, ctx); continue; }
      case 'sin': case 'cos': {
        j=skipWS(j+3,e); const r=readCoord(j,ctx,ps.frame,ps); j=r.end; const a=ps.cur, b=r.p;
        const d=V.sub(b,a);
        const k = word==='sin' ? [[.3183,.5],[.6366,1]] : [[.3634,0],[.6817,.5]];
        const c1=V.add(a,[d[0]*k[0][0],d[1]*k[0][1]]), c2=V.add(a,[d[0]*k[1][0],d[1]*k[1][1]]);
        if (r.h) addHandle(r.h,b,ps.sIdx);
        if (!curSub(ps)) startSub(ps,a); pushOp(ps,{t:'C',c1,c2,p:b}); ps.cur=b; ps.relBase=b;
        continue; }
      case 'parabola': {
        j=skipWS(j+8,e); let bendEnd=false;
        if (S[j]==='['){ const en=mcS(j); bendEnd=/bend at end/.test(S.slice(j,en)); j=skipWS(en+1,e); }
        let bend=null;
        if (S.startsWith('bend',j)){ j=skipWS(j+4,e); const rb=readCoord(j,ctx,ps.frame,ps); bend=rb.p; j=skipWS(rb.end,e); }
        const r=readCoord(j,ctx,ps.frame,ps); j=r.end; const a=ps.cur, b=r.p; if(r.h) addHandle(r.h,b,ps.sIdx);
        if (!curSub(ps)) startSub(ps,a);
        const vtx = bend || (bendEnd ? b : a);
        const pts=[]; for(let k=0;k<=24;k++){ const t=k/24; const x=a[0]+(b[0]-a[0])*t; const y = vtx===a ? a[1]+(b[1]-a[1])*t*t : vtx===b ? b[1]+(a[1]-b[1])*(1-t)*(1-t) : null; pts.push([x,y===null? a[1]+(b[1]-a[1])*t : y]); }
        for (const p of pts.slice(1)) pushOp(ps,{t:'L',p}); ps.cur=b; ps.relBase=b;
        continue; }
      case 'child': { j = childOps(j, e, ps, ctx); continue; }
      case 'let': { ctx.warn('l\'operazione «let» non è supportata'); return; }
      case 'decorate': { const k=skipWS(j+8,e); if(S[k]==='['){ j=mcS(k)+1; } else j=k; ctx.warn('decorate ignorato'); continue; }
      case 'svg': case 'graph': case 'foreach': { ctx.warn(word+' non supportato nel percorso'); return; }
      case 'and': { j+=3; continue; }
      case 'at': { j+=2; continue; }
    }
    ctx.warn('elemento di percorso non riconosciuto «'+S.slice(j,j+12).split('\n')[0]+'»');
    j++;
  }
}
const rec = ps => ps.rec;
function readCoordRel(k, ctx, ps, noUpdate){
  // coordinata relativa: ritorna vettore in pagina
  const e=mcS(k); const txt=S.slice(k+1,e);
  const linF = {map:(x,y)=>ps.frame.lin(x,y), lin:ps.frame.lin, inv:(x,y)=>ps.frame.invLin(x,y), invLin:ps.frame.invLin, mat:null};
  const r = coordText(txt, k+1, ctx, linF, ps);
  if (r.h) r.h.frame = linF;
  return {...r, rel:true, end:e+1, s:k, e};
}
function curSub(ps){ const s=ps.subs[ps.subs.length-1]; return s||null; }
function startSub(ps, p, node=null){ ps.subs.push({start:p, startNode:node, ops:[], closed:false}); }
function pushOp(ps, op){ const s=curSub(ps); if(!s){ startSub(ps, ps.cur||[0,0]); } curSub(ps).ops.push(op); }
function closeSub(ps){ const s=curSub(ps); if(s){ s.closed=true; ps.cur=s.start; ps.relBase=s.start; } ps.pend=null; ps.lastSeg=null; }

function coordOp(r, ps, ctx, mode){
  // risolve la coordinata e applica l'operazione in sospeso
  let p = r.p;
  if (mode!=='abs'){ const base = ps.relBase || ps.cur || ps.frame.map(0,0); p = V.add(base, r.p); if (mode==='++') ps.relBase = p; if (r.h) addHandle(r.h, p, ps.sIdx, 'pt', base); }
  else { ps.relBase = p; if (r.h) addHandle(r.h, p, ps.sIdx, 'pt'); }
  const node = r.node || null;
  const pend = ps.pend; ps.pend = null;
  if (!pend){
    // move-to
    startSub(ps, p, node); ps.cur=p; ps.curNode=node; ps.lastSeg=null;
    flushPending(ps, null);
    return;
  }
  let a = ps.cur || ps.frame.map(0,0);
  let fromNode = ps.curNode;
  let seg;
  if (pend.t==='L'){
    let a2 = fromNode ? nodeBorderToward(fromNode, p) : a;
    let b2 = node ? nodeBorderToward(node, a) : p;
    if (fromNode) startSub(ps, a2);
    else if (!curSub(ps)) startSub(ps, a2);
    pushOp(ps,{t:'L',p:b2}); seg={k:'L',a:a2,b:b2};
  } else if (pend.t==='HV'){
    const corner = pend.hv ? [a[0],p[1]] : [p[0],a[1]];
    const a2 = fromNode ? nodeBorderToward(fromNode, corner) : a;
    const b2 = node ? nodeBorderToward(node, corner) : p;
    if (fromNode || !curSub(ps)) startSub(ps, a2);
    pushOp(ps,{t:'L',p:corner}); pushOp(ps,{t:'L',p:b2}); seg={k:'HV',a:a2,c:corner,b:b2};
  } else if (pend.t==='C'){
    let c1 = pend.c1, c2;
    if (pend.r2){ c2 = pend.r2.rel ? V.add(p, pend.r2.p) : pend.r2.p; addHandle(pend.r2.h, c2, ps.sIdx, 'ctl', pend.r2.rel?p:null, {link:p}); }
    else c2 = c1;
    const a2 = fromNode ? nodeBorderToward(fromNode, c1) : a;
    const b2 = node ? nodeBorderToward(node, c2) : p;
    if (fromNode || !curSub(ps)) startSub(ps, a2);
    pushOp(ps,{t:'C',c1,c2,p:b2}); seg={k:'C',a:a2,c1,c2,b:b2};
    // collega la prima maniglia di controllo al punto di partenza
    for (const h of R.handles) if (h.p===c1) h.link=a2;
  }
  ps.cur=p; ps.curNode=node; ps.lastSeg=seg;
  flushPending(ps, seg);
}
function segAt(seg, t){
  if (!seg) return null;
  if (seg.k==='L') return {p:V.lerp(seg.a,seg.b,t), ang:V.ang(V.sub(seg.b,seg.a))};
  if (seg.k==='C') return {p:bez(seg.a,seg.c1,seg.c2,seg.b,t), ang:V.ang(bezD(seg.a,seg.c1,seg.c2,seg.b,Math.min(.999,Math.max(.001,t))))};
  if (seg.k==='HV'){ if (t<=.5) return {p:V.lerp(seg.a,seg.c,t*2), ang:V.ang(V.sub(seg.c,seg.a))}; return {p:V.lerp(seg.c,seg.b,(t-.5)*2), ang:V.ang(V.sub(seg.b,seg.c))}; }
  return null;
}
function flushPending(ps, seg){
  // posiziona i nodi in attesa (dichiarati tra operatore e destinazione)
  const pend = ps.waiting || []; ps.waiting=[];
  for (const w of pend){
    const t = w.st.pos!==null ? w.st.pos : .5;
    const q = seg ? segAt(seg,t) : {p:ps.cur, ang:0};
    placeNodeOnPath(w, q, ps);
  }
}
function placeNodeOnPath(w, q, ps){
  const st=w.st;
  if (st.sloped){ let a=q.ang; if (a>90) a-=180; if (a<-90) a+=180; st._rot=a; }
  if (st.auto && !st.anchor && !st.place){
    let a = q.ang + ((st.auto==='left') !== st.swap ? -90 : 90);
    if (st.sloped) a -= st._rot||0;
    const names=['east','north east','north','north west','west','south west','south','south east'];
    st.anchor = names[((Math.round(((a%360)+360)%360/45))%8)];
  }
  w.make(q.p);
}
/* ---------- to / edge ---------- */
function toOp(j, e, ps, ctx, isEdge){
  j=skipWS(j,e);
  const lst = cloneStyle(ps.st);
  let opText='', opSpan=null;
  if (S[j]==='['){ const en=mcS(j); opText=S.slice(j+1,en); opSpan={s:j, e:en}; j=skipWS(en+1,e); }
  if (isEdge){ lst.draw = lst.draw||true; lst.labels=[]; lst.name=null; }
  const cz = isEdge ? null : czParse(opText, ctx);
  applyOpts(lst, cz ? cz.rest : opText, ctx);
  // nodi sull'edge
  const sub = {...ps, st:lst, subs:[], waiting:[], nodes:ps.nodes};
  const saveWait = ps.waiting; ps.waiting=[];
  while (S.startsWith('node',j)){ j = nodeOp(j+4, e, isEdge?sub:ps, ctx, 'node', false, true); j=skipWS(j,e); }
  let r; const pp = S[j]==='+';
  if (pp){ const k=skipWS(j+(S[j+1]==='+'?2:1),e); r=readCoordRel(k,ctx,ps); r.p=V.add(ps.relBase||ps.cur,r.p); if (r.h) addHandle(r.h, r.p, ps.sIdx, 'pt', ps.relBase||ps.cur); r.h=null; }
  else if (S[j]==='('){ r=readCoord(j,ctx,ps.frame,ps); }
  else if (S.startsWith('cycle',j)){ r={p:curSub(ps)?curSub(ps).start:ps.cur, end:j+5}; }
  else { ctx.warn('attesa coordinata dopo to/edge'); return j+1; }
  j=r.end;
  if (r.h) addHandle(r.h, r.p, ps.sIdx);
  const a=ps.cur||ps.frame.map(0,0), an=ps.curNode, b=r.p, bn=r.node;
  // componente circuitikz: fili, simbolo ed etichette
  if (cz){
    const a2 = an?nodeBorderToward(an,b):a, b2 = bn?nodeBorderToward(bn,a):b;
    czTo(ps, a2, b2, lst, cz, ctx);
    if (ps.rec && !(ps.rec.cz||[]).some(x=>x.opts.s===opSpan.s)) (ps.rec.cz=ps.rec.cz||[]).push({opts:opSpan, comp:cz.comp});
    ps.cur=b; ps.curNode=bn; ps.relBase=b; ps.lastSeg={k:'L', a:a2, b:b2};
    flushPending(ps, ps.lastSeg);
    ps.waiting = saveWait.concat(ps.waiting||[]);
    return j;
  }
  // curva
  let seg;
  const straight = lst.bend===null && lst.out===null && lst.in===null && !lst.loop && !(an && an===bn);
  if (straight){
    const a2 = an?nodeBorderToward(an,b):a, b2 = bn?nodeBorderToward(bn,a):b;
    seg={k:'L',a:a2,b:b2};
  } else {
    let out, inn; const th=V.ang(V.sub(b,a));
    if (lst.loop || (an && an===bn)){ const L={above:[105,75],below:[285,255],left:[195,165],right:[15,345]}[lst.loop||'above']; out=lst.out!==null?lst.out:L[0]; inn=lst.in!==null?lst.in:L[1]; }
    else if (lst.bend!==null){ out=th+lst.bend; inn=th+180-lst.bend; }
    else { out=lst.out!==null?(lst.rel?th+lst.out:lst.out):th; inn=lst.in!==null?(lst.rel?th+180+lst.in:lst.in):th+180; }
    const a2 = an ? toPage(an, borderLocal(an, out-an.rot)) : a;
    const b2 = bn ? toPage(bn, borderLocal(bn, inn-bn.rot)) : b;
    let d = V.len(V.sub(b2,a2));
    let lo = lst.looseOut||lst.loose, li = lst.looseIn||lst.loose;
    if (lst.loop || (an&&an===bn)){ d = Math.max(lst.minDist||.5, d); lo = li = lst.loose===1?1.6:lst.loose; d=Math.max(d, 1.2*Math.max(an?an.hw:0, an?an.hh:0, .3)); }
    let cd1=.3915*d*lo, cd2=.3915*d*li;
    if (lst.loop || (an&&an===bn)){ const L=Math.max(lst.minDist||.5, (lst.loose===1?8:lst.loose)*.3915*V.len(V.sub(b2,a2))); cd1=cd2=L; }
    const c1 = V.add(a2, V.pol(out, cd1)), c2 = V.add(b2, V.pol(inn, cd2));
    seg={k:'C',a:a2,c1,c2,b:b2};
  }
  const tgt = isEdge ? sub : ps;
  if (isEdge){
    startSub(sub, seg.a); pushOp(sub, seg.k==='L'?{t:'L',p:seg.b}:{t:'C',c1:seg.c1,c2:seg.c2,p:seg.b});
    sub.waiting = sub.waiting||[]; flushPending(sub, seg);
    ps.edges.push(sub);
    ps.relBase = ps.relBase; // edge non cambia il punto corrente
  } else {
    if (an || !curSub(ps)) startSub(ps, seg.a);
    pushOp(ps, seg.k==='L'?{t:'L',p:seg.b}:{t:'C',c1:seg.c1,c2:seg.c2,p:seg.b});
    ps.cur=b; ps.curNode=bn; ps.relBase=b; ps.lastSeg=seg;
    flushPending(ps, seg);
  }
  ps.waiting = saveWait.concat(ps.waiting||[]);
  return j;
}
/* ---------- plot ---------- */
function plotOp(j, e, ps, ctx){
  j=skipWS(j,e);
  const lst=cloneStyle(ps.st);
  if (S[j]==='['){ const en=mcS(j); applyOpts(lst,S.slice(j+1,en),ctx); j=skipWS(en+1,e); }
  let pts=[];
  if (S.startsWith('coordinates',j)){
    j=skipWS(j+11,e); const g=readGroup(j); if(!g){ ctx.warn('plot coordinates: manca {'); return e; }
    let k=g.s+1;
    while (k<g.e){ k=skipWS(k,g.e); if(S[k]==='('){ const r=readCoord(k,ctx,ps.frame,ps); pts.push(r.p); if(r.h) addHandle(r.h,r.p,ps.sIdx); k=r.end; } else k++; }
    j=g.e+1;
  } else if (S[j]==='('){
    const en=mcS(j); const txt=S.slice(j+1,en); j=en+1;
    const q=splitTop(txt); const [d0,d1]=lst.domain; const n=lst.samples; const v=lst.variable;
    const xs=[]; if (lst.samplesAt) xs.push(...expandList(lst.samplesAt,ctx.vars).map(Number)); else for(let k=0;k<n;k++) xs.push(d0+(d1-d0)*k/(n-1));
    for (const x of xs){ const vars={...ctx.vars,[v]:x}; try{ const X=lenCm(unbrace(q[0]),{vars}), Y=lenCm(unbrace(q[1]),{vars}); if(isFinite(X)&&isFinite(Y)) pts.push(ps.frame.map(X,Y)); }catch(err){ ctx.warn(err.message); break; } }
  } else if (S.startsWith('function',j)){ ctx.warn('plot function (gnuplot) non supportato'); const g=readGroup(skipWS(j+8,e)); return g?g.e+1:e; }
  else if (S.startsWith('file',j)){
    const g=readGroup(skipWS(j+4,e)); if (!g){ ctx.warn('plot file: manca {nome del file}'); return e; }
    j=g.e+1; const tb=tableText(g.text, ctx); if (!tb) return j;
    for (const r of tableRows(tb.text, {}, ctx, tb.file)){ const x=parseFloat(r[0]), y=parseFloat(r[1]); if (isFinite(x)&&isFinite(y)) pts.push(ps.frame.map(x,y)); }
  }
  if (!pts.length) return j;
  const cont = ps.pend && ps.pend.t==='L'; ps.pend=null;
  if (!cont || !curSub(ps)) startSub(ps, pts[0]); else pushOp(ps,{t:'L',p:pts[0]});
  if (lst.smooth && pts.length>2){ for (const [c1,c2,p] of smoothBez(pts, lst.tension, lst.smoothCycle)) pushOp(ps,{t:'C',c1,c2,p}); if(lst.smoothCycle) curSub(ps).closed=true; }
  else for (const p of pts.slice(1)) pushOp(ps,{t:'L',p});
  if (lst.kv['only marks']) curSub(ps).hidden=true;
  if (lst.kv.mark && lst.kv.mark!=='none') ps.extraSVG.push(marksSVG(pts, lst, lst.kv.mark));
  ps.cur=pts[pts.length-1]; ps.relBase=ps.cur; ps.curNode=null;
  return j;
}
