/* ============ STRUMENTI, MANIGLIE, PROPRIETÀ ============ */
let tool='select', drag=null, linePts=null, ghost='', freeMove=false, selHandle=null, selBB=null;
const SVGNS='http://www.w3.org/2000/svg';
const curStmt = () => selStart!==null && lastR ? lastR.stmts.findIndex(s=>s.start===selStart) : -1;

/* ---------- overlay ---------- */
function drawOverlay(){
  if (!lastR) return;
  const r = 5.5/view.k; let out='';
  const si = curStmt();
  if (si>=0){
    const gs = drawG.querySelectorAll(`[data-s="${si}"]`);
    let bb=null;
    gs.forEach(g=>{ try{ const b=g.getBBox(); if(!b.width&&!b.height) return; bb = bb ? {x:Math.min(bb.x,b.x), y:Math.min(bb.y,b.y), x2:Math.max(bb.x2,b.x+b.width), y2:Math.max(bb.y2,b.y+b.height)} : {x:b.x,y:b.y,x2:b.x+b.width,y2:b.y+b.height}; }catch(e){} });
    selBB = bb;
    if (selNode!==null && selNode!==undefined && lastR.nodes[selNode] && lastR.nodes[selNode].stmt===si){
      const ne = drawG.querySelector(`[data-n="${selNode}"]`);
      if (ne) try{ const b=ne.getBBox(); const m=2/view.k; out+=`<rect class="selbox nodebox" x="${b.x-m}" y="${b.y-m}" width="${b.width+2*m}" height="${b.height+2*m}"/>`; }catch(e){}
    }
    if (bb){ const m=4/view.k; out+=`<rect class="selbox" x="${bb.x-m}" y="${bb.y-m}" width="${bb.x2-bb.x+2*m}" height="${bb.y2-bb.y+2*m}"/>`;
      if (canRotate(si)){ const cx=(bb.x+bb.x2)/2, ty=bb.y-m, hy=ty-26/view.k; out+=`<line class="ctlline" x1="${cx}" y1="${ty}" x2="${cx}" y2="${hy}"/><circle class="hd rot" data-rot="1" cx="${cx}" cy="${hy}" r="${r*1.1}"><title>Trascina per ruotare (Alt: senza scatti)</title></circle>`; } }
    const seen=new Set();
    lastR.handles.forEach((h,k)=>{
      if (h.stmt!==si) return;
      const key=handleKey(h); if (seen.has(key)) return; seen.add(key);
      if (h.link) out+=`<line class="ctlline" x1="${h.link[0]}" y1="${-h.link[1]}" x2="${h.p[0]}" y2="${-h.p[1]}"/>`;
    });
    seen.clear(); let ord=-1;
    lastR.handles.forEach((h,k)=>{
      if (h.stmt!==si) return;
      const key=handleKey(h); if (seen.has(key)) return; seen.add(key); ord++;
      const on = selHandle===ord ? ' on' : '';
      out += h.role==='ctl' ? `<rect class="hd ctl${on}" data-h="${k}" x="${h.p[0]-r*.8}" y="${-h.p[1]-r*.8}" width="${r*1.6}" height="${r*1.6}"/>` : `<circle class="hd${on}${h.h.proxy?' px':''}" data-h="${k}" cx="${h.p[0]}" cy="${-h.p[1]}" r="${r}"/>`;
    });
  }
  out += ghost;
  overG.innerHTML = out;
}
const handleKey = h => h.h.kind==='abs' ? 'a'+h.h.x.s+','+h.h.y.s : h.h.kind==='polar' ? 'p'+h.h.a.s : h.h.kind==='x' ? 'x'+h.h.x.s : 'r'+h.h.r.s;

/* ---------- modifica del codice dalle maniglie ---------- */
function precFor(h){
  const f=h.h.frame;
  if (f && !f.mat && lastR.axes.length){
    const ax = lastR.axes.find(a=>a.frame===f);
    if (ax){ const rx=ax.lim.xmax-ax.lim.xmin, ry=ax.lim.ymax-ax.lim.ymin; return [Math.max(0,Math.ceil(-Math.log10(rx/200))), Math.max(0,Math.ceil(-Math.log10(ry/200)))]; }
  }
  return null;
}
function roundLocal(v, unit, prec, snap){
  if (prec!==null && prec!==undefined) return fmt(v, prec);
  const u = UNIT[unit||'cm']||1;
  let x = v/u;
  if (snap && snapOn && !freeMove){ const s=snapStep/u; x=Math.round(x/s)*s; }
  return fmt(x, unit==='pt'||unit==='bp'||unit==='mm'?1:(freeMove||!snapOn)?2:3);
}
function handleEdits(h, page){
  const hh=h.h; const ed=[];
  const pr = precFor(h);
  if (hh.kind==='abs'){
    const loc = h.base ? hh.frame.inv(...V.sub(page, h.base)) : hh.frame.inv(...page);
    ed.push({s:hh.x.s, e:hh.x.e, t:roundLocal(loc[0], hh.x.unit, pr&&pr[0], true)+hh.x.unit});
    ed.push({s:hh.y.s, e:hh.y.e, t:roundLocal(loc[1], hh.y.unit, pr&&pr[1], true)+hh.y.unit});
  } else if (hh.kind==='polar'){
    const loc = h.base ? hh.frame.inv(...V.sub(page, h.base)) : hh.frame.inv(...page);
    let a = Math.atan2(loc[1],loc[0])/D2R; if (snapOn) a=Math.round(a/5)*5; else a=Math.round(a);
    if (a<0 && hh.a.val>=0) a+=360;
    ed.push({s:hh.a.s, e:hh.a.e, t:fmt(a,1)});
    ed.push({s:hh.r.s, e:hh.r.e, t:roundLocal(Math.hypot(loc[0],loc[1]), hh.r.unit, null, true)+hh.r.unit});
  } else if (hh.kind==='x'){
    const loc = hh.frame.inv(...page);
    ed.push({s:hh.x.s, e:hh.x.e, t:roundLocal(loc[0], hh.x.unit, null, true)+hh.x.unit});
  } else if (hh.kind==='radius'){
    const loc = hh.frame.inv(...page); const r = Math.hypot(loc[0]-hh.center[0], loc[1]-hh.center[1]);
    ed.push({s:hh.r.s, e:hh.r.e, t:roundLocal(Math.max(r,.05*(UNIT[hh.r.unit||'cm']||1)), hh.r.unit, null, true)+hh.r.unit});
  }
  return ed;
}
function applyEdits(text, edits){
  const seen=new Set(); const es=edits.filter(e=>{ const k=e.s+':'+e.e; if(seen.has(k)) return false; seen.add(k); return true; }).sort((a,b)=>b.s-a.s);
  for (const e of es) text = text.slice(0,e.s)+e.t+text.slice(e.e);
  return text;
}
function moveStmtEdits(si, delta){
  // sposta tutte le coordinate assolute dell'istruzione
  const st = lastR.stmts[si];
  if (st && st.cmd==='axis' && st.axis){
    const loc = st.axis.frame.invLin(...delta); const at=V.add(st.axis.at, loc);
    const v = `{(${roundLocal(at[0],'',null,true)},${roundLocal(at[1],'',null,true)})}`;
    return {opt:['at', v]};
  }
  const seen=new Set(); const out=[];
  for (const h of lastR.handles){
    if (h.stmt!==si || h.base || h.h.kind==='radius' || h.h.proxy) continue;
    const k=handleKey(h); if (seen.has(k)) continue; seen.add(k);
    out.push(...handleEdits(h, V.add(h.p, delta)));
  }
  return {edits:out};
}

/* nei circuiti gli estremi degli altri elementi che toccano i capi spostati li seguono, così restano collegati */
function moveConnectedEdits(si, delta){
  const r = moveStmtEdits(si, delta);
  const f = figs[Math.min(figIdx, figs.length-1)];
  if (r.opt || !(f && f.env==='circuitikz') && !lastR.stmts.some(s=>s.cz)) return r;
  const own = lastR.pins.filter(q=>q.s===si).map(q=>q.p).concat(lastR.handles.filter(h=>h.stmt===si && !h.base && h.role!=='ctl').map(h=>h.p));
  const touches = p => own.some(q=>Math.abs(q[0]-p[0])<1e-4 && Math.abs(q[1]-p[1])<1e-4);
  const seen = new Set();
  for (const h of lastR.handles){
    if (h.stmt===si || h.base || h.role==='ctl' || h.h.kind!=='abs' || h.h.proxy || !touches(h.p)) continue;
    const k=handleKey(h); if (seen.has(k)) continue; seen.add(k);
    r.edits.push(...handleEdits(h, V.add(h.p, delta)));
  }
  return r;
}

/* ---------- opzioni ---------- */
function optItems(st){ return st.opts ? splitTop(src.slice(st.opts.s+1, st.opts.e)).map(s=>s.trim()).filter(Boolean) : []; }
const itemKey = it => { const k=it.indexOf('='); return (k<0?it:it.slice(0,k)).trim(); };
function optSpans(text, s0, e0){
  // elementi di primo livello con le loro posizioni (estremi esclusi i delimitatori)
  const out=[]; let d=0, st=s0;
  const push=(x,y)=>{ const raw=text.slice(x,y); const lead=raw.length-raw.trimStart().length; const t=raw.trim(); if(t) out.push({s:x+lead, e:x+lead+t.length, t, cs:x, ce:y}); };
  for (let k=s0;k<e0;k++){ const c=text[k]; if(c==='\\'){k++;continue;} if('{(['.includes(c))d++; else if('})]'.includes(c))d--; else if(c===','&&d===0){ push(st,k); st=k+1; } }
  push(st,e0); return out;
}
function setOptions(si, how, text0){
  const st = lastR.stmts[si]; if (!st) return text0===undefined ? src : text0;
  return setOptsAt(st.opts, st.cmdEnd, how, text0);
}
function setNodeOpts(nIdx, how, text0){
  const nd = lastR.nodes[nIdx]; if (!nd) return text0===undefined ? src : text0;
  const st = lastR.stmts[nd.stmt];
  const opts = nd.head ? st.opts : nd.opts, at = nd.head ? st.cmdEnd : nd.kwEnd;
  return setOptsAt(opts, at, how, text0);
}
function nodeItems(nIdx){ const nd=lastR.nodes[nIdx]; if(!nd) return []; const sp = nd.head ? lastR.stmts[nd.stmt].opts : nd.opts; return sp ? splitTop(src.slice(sp.s+1, sp.e)).map(s=>s.trim()).filter(Boolean) : []; }
function setOptsAt(spanOpts, insertAt, {remove=()=>false, add=[]}, text0){
  let text = text0===undefined ? src : text0;
  const st = {opts:spanOpts, cmdEnd:insertAt};
  if (!st.opts){ return add.length ? text.slice(0,st.cmdEnd)+'['+add.join(', ')+']'+text.slice(st.cmdEnd) : text; }
  const os=st.opts.s+1, oe=st.opts.e;
  const items = optSpans(text, os, oe);
  const kill = items.filter(it=>remove(it.t, itemKey(it.t)));
  const keep = items.filter(it=>!kill.includes(it));
  if (!keep.length && !add.length) return text.slice(0,st.opts.s)+text.slice(st.opts.e+1);
  // sostituzione sul posto del primo elemento rimosso, se c'è
  let edits=[]; let addRest = add.slice();
  kill.forEach((it,k)=>{
    if (k===0 && addRest.length){ edits.push({s:it.s, e:it.e, t:addRest.shift()}); return; }
    // rimuovi elemento con la virgola adiacente
    const idx = items.indexOf(it);
    const laterKept = items.slice(idx+1).some(x=>!kill.includes(x));
    const prevKept = items.slice(0,idx).reverse().find(x=>!kill.includes(x) || (x===kill[0] && add.length));
    if (laterKept){ edits.push({s:it.s, e:items[idx+1].s, t:''}); }
    else if (prevKept){ edits.push({s:prevKept.e, e:it.e, t:''}); }
    else edits.push({s:it.s, e:it.e, t:''});
  });
  if (addRest.length){
    const last = items.length ? items[items.length-1] : null;
    if (last && !kill.includes(last)) edits.push({s:last.e, e:last.e, t:', '+addRest.join(', ')});
    else if (keep.length){ const lk=keep[keep.length-1]; edits.push({s:lk.e, e:lk.e, t:', '+addRest.join(', ')}); }
    else edits.push({s:os, e:os, t:addRest.join(', ')});
  }
  // gli intervalli non devono sovrapporsi: applica dal fondo
  const dels = edits.filter(x=>x.t==='').sort((x,y)=>x.s-y.s), keepE = edits.filter(x=>x.t!=='');
  const merged=[]; for (const d of dels){ const l=merged[merged.length-1]; if (l && d.s<=l.e) l.e=Math.max(l.e,d.e); else merged.push({...d}); }
  edits = keepE.concat(merged).sort((x,y)=>y.s-x.s);
  for (const ed2 of edits) text = text.slice(0,ed2.s)+ed2.t+text.slice(ed2.e);
  return text;
}
function setOpt(si, key, val){
  return setOptions(si, {remove:(it,k)=>k===key, add: val===null||val===undefined ? [] : [val===true?key:key+'='+val]});
}
const isBareColor = it => !it.includes('=') && isColorWord(it.trim());
const isArrowItem = it => { const b=it.replace(/\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g,'{}'); return !b.includes('=') && b.includes('-') && !!parseArrowSpec(it.trim()); };
const isLW = (it,k) => LW[k]!==undefined || k==='line width';
const isDash = (it,k) => /^(solid|dashed|densely dashed|loosely dashed|dotted|densely dotted|loosely dotted|dash dot|densely dash dot|dash dot dot|dash pattern)$/.test(k);

/* ---------- interazione col canvas ---------- */
function hitInfo(e){
  const t = e.target;
  if (t.closest && t.closest('[data-rot]')) return {rot:true};
  const h = t.closest && t.closest('[data-h]'); if (h && overG.contains(h)) return {handle:+h.dataset.h};
  const g = t.closest && t.closest('[data-s]'); if (!g || !drawG.contains(g)) return {};
  const n = t.closest('[data-n]');
  return {stmt:+g.dataset.s, node: n ? +n.dataset.n : null};
}
function axisAt(page){
  if (!lastR) return null;
  for (let k=lastR.axes.length-1;k>=0;k--){ const a=lastR.axes[k]; if (pointInPoly(page, a.corners)) return a; }
  return null;
}
function pointInPoly(p, poly){ let c=false; for (let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i], b=poly[j]; if (((a[1]>p[1])!==(b[1]>p[1])) && (p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])) c=!c; } return c; }
function fmtPt(page, region){
  // coordinata testuale per un punto in pagina (eventualmente in axis cs)
  if (region){
    const d = region.frame.inv(...page);
    const rx=region.lim.xmax-region.lim.xmin, ry=region.lim.ymax-region.lim.ymin;
    const px=Math.max(0,Math.ceil(-Math.log10(rx/100))), py=Math.max(0,Math.ceil(-Math.log10(ry/100)));
    return `(axis cs:${fmt(d[0],px)},${fmt(d[1],py)})`;
  }
  const s = snapPage(page); return `(${fmt(s[0],3)},${fmt(s[1],3)})`;
}
function ensurePicture(){
  // un tikzcd non accetta istruzioni TikZ: in quel caso si apre una nuova figura
  const f = figs[Math.min(figIdx, figs.length-1)];
  if (f && f.env!=='tikzcd') return;
  addFigure('\\begin{tikzpicture}\n\\end{tikzpicture}\n');
}
/* aggiunge una figura vuota (prima di \end{document}, se c'è) e la rende corrente */
function addFigure(code){
  const m = /\\end\s*\{document\}/.exec(src);
  let t, at;
  if (m){ at = m.index; t = src.slice(0,at).replace(/\s*$/,'\n\n') + code + '\n' + src.slice(at); at = src.slice(0,m.index).replace(/\s*$/,'\n\n').length; }
  else { t = (src.trim()? src.replace(/\s*$/,'\n\n') : ''); at = t.length; t += code; }
  figIdx = findFigures(t).findIndex(f=>f.s>=at);
  setSource(t);
}
function insertStmt(code, region, opt={}){
  ensurePicture();
  const pos = region ? region.insertAt : lastR.insertAt;
  const ind = region ? '    ' : '  ';
  let pre = src[pos-1]==='\n' || pos===0 ? '' : '\n';
  // allinea all'indentazione della riga di \end
  const ls = src.lastIndexOf('\n', pos-1)+1; const lineBefore = src.slice(ls,pos);
  let t, at;
  if (/^\s*$/.test(lineBefore)){ t = src.slice(0,ls) + ind + code + '\n' + src.slice(ls); at = ls+ind.length; }
  else { t = src.slice(0,pos) + '\n' + ind + code + '\n' + src.slice(pos); at = pos+1+ind.length; }
  selStart = at;
  setSource(t);
  return at;
}
function nodeNameFor(nIdx){
  // nome del nodo (lo aggiunge se manca)
  const nd = lastR.nodes[nIdx]; if (!nd) return null;
  if (nd.name) return {name:nd.name};
  const st = lastR.stmts[nd.stmt]; if (!st || st.cmd!=='node') return null;
  const used = new Set(Object.keys(lastR.names)); let k=1; while (used.has('n'+k)) k++;
  const nm='n'+k;
  const at = nd.opts ? nd.opts.e+1 : st.cmdEnd;
  return {name:nm, edit:{s:at, e:at, t:` (${nm})`}};
}
cv.addEventListener('pointerdown', e=>{
  if (e.button===1 || (e.button===0 && spaceDown)){ startPan(e); return; }
  if (e.button!==0) return;
  cv.setPointerCapture(e.pointerId);
  const w = toWorld(e), page = toPagePt(w);
  const hi = hitInfo(e);
  if (pinch.add(e)) return;
  if (tool==='select'){
    if (hi.rot && selBB){
      const si=curStmt(); const c=[(selBB.x+selBB.x2)/2, -(selBB.y+selBB.y2)/2];
      const info = rotInfo(si, c);
      drag = {kind:'rot', si, c:info.c, cl:info.cl, a0:V.ang(V.sub(page,info.c)), base:info.angle, src0:src, R0:lastR};
      return;
    }
    if (hi.handle!==undefined){
      const h = lastR.handles[hi.handle];
      selHandle = stmtHandles(h.stmt).findIndex(x=>handleKey(x)===handleKey(h));
      drag = {kind:'handle', h, start:page, src0:src, moved:false};
      drawOverlay(); updateProps();
      if (h.h.proxy) hint('Sposti la coordinata «'+h.h.pname+'»: si aggiorna la sua definizione');
      return;
    }
    if (hi.stmt!==undefined){
      if (selStart!==lastR.stmts[hi.stmt].start) selHandle=null;
      selStart = lastR.stmts[hi.stmt].start; selNode = hi.node;
      const nd = hi.node!==null && hi.node!==undefined ? lastR.nodes[hi.node] : null;
      if (nd && !nd.head && !nd.atLit && nd.text && !nd.cz){   // i simboli dei circuiti si spostano con l'istruzione
        const it = nodeItems(hi.node); const g = k => { const v=optVal(it,k); try{ return v&&v!==true ? evalLen(String(v),{},PT)/PT : 0; }catch(_){ return 0; } };
        drag = {kind:'label', n:hi.node, start:page, src0:src, R0:lastR, moved:false, x0:g('xshift'), y0:g('yshift')};
      } else
      drag = {kind:'move', si:hi.stmt, start:page, src0:src, R0:lastR, moved:false};
      updateHL(); drawOverlay(); updateProps(); revealStmt();
      return;
    }
    selStart=null; selNode=null; selHandle=null; updateHL(); drawOverlay(); updateProps();
    startPan(e); return;
  }
  if (tool==='uml'){ umlCanvasClick(page, hi); return; }
  if (tool==='automa'){ autCanvasClick(page, hi); return; }
  if (tool==='cd'){ cdCanvasClick(page, hi); return; }
  if (tool==='circ'){ czCanvasClick(page, hi); return; }
  const region = axisAt(page);
  const sp = region ? page : snapPage(page);
  if (tool==='node'){
    const at = insertStmt(`\\node at ${fmtPt(page,region)} {testo};`, region);
    setTool('select');
    requestAnimationFrame(()=>{ const si=curStmt(); const nd=lastR.nodes.findIndex(n=>n.stmt===si); if (nd>=0) inlineEdit(nd); });
    return;
  }
  if (tool==='line'){
    if (!linePts){ linePts={pts:[sp], region}; }
    else {
      const first=linePts.pts[0];
      if (linePts.pts.length>2 && V.len(V.sub(sp,first))*view.k<8){ finishLine(true); return; }
      linePts.pts.push(sp);
    }
    updateGhost(sp); return;
  }
  let startNode = null;
  if (tool==='arrow' && hi.node!==null && hi.node!==undefined) startNode = hi.node;
  drag = {kind:'tool', start:sp, raw:page, region, pts:[sp], startNode};
});
let lastMove=null;
cv.addEventListener('pointermove', e=>{
  if (pinch.move(e)) return;
  const w=toWorld(e), page=toPagePt(w);
  const region = axisAt(page);
  if (region){ const d=region.frame.inv(...page); $('st-xy').textContent=`axis ${fmt(d[0],2)}, ${fmt(d[1],2)}`; }
  else { const s=snapPage(page); $('st-xy').textContent=`x ${fmt(s[0],2)}, y ${fmt(s[1],2)}`; }
  if (pan){ view.x = pan.vx - (e.clientX-pan.x)/view.k; view.y = pan.vy - (e.clientY-pan.y)/view.k; applyView(); return; }
  if (tool==='line' && linePts){ updateGhost(linePts.region?page:snapPage(page)); return; }
  if (tool==='circ' && !drag && !pan){ czHover(page); return; }
  if (!drag) return;
  freeMove = e.altKey;
  if (lastMove) { lastMove.page=page; return; }
  lastMove={page};
  requestAnimationFrame(()=>{ if (!lastMove) return; const p=lastMove.page; lastMove=null; dragMove(p, e); });
});
function dragMove(page, e){
  if (!drag) return;
  if (drag.kind==='handle'){
    drag.moved=true;
    const ed = handleEdits(drag.h, page);
    src = drag.src0; setSource(applyEdits(drag.src0, ed), {record:false});
  } else if (drag.kind==='label'){
    const d = V.sub(page, drag.start);
    if (!drag.moved && V.len(d)*view.k<3) return;
    drag.moved=true;
    const q = freeMove ? 10 : 2;  // passo 0,1pt con Alt, altrimenti 0,5pt
    const xs = Math.round((drag.x0 + d[0]/PT)*q)/q, ys = Math.round((drag.y0 + d[1]/PT)*q)/q;
    const add=[]; if (xs) add.push('xshift='+fmt(xs,1)+'pt'); if (ys) add.push('yshift='+fmt(ys,1)+'pt');
    const saveR=lastR; lastR=drag.R0;
    const t = setNodeOpts(drag.n, {remove:(it,k)=>k==='xshift'||k==='yshift', add}, drag.src0);
    lastR=saveR; src=drag.src0; setSource(t,{record:false});
    hint(`testo spostato di ${fmt(xs,1)}pt, ${fmt(ys,1)}pt`, 900);
  } else if (drag.kind==='rot'){
    let a = drag.base + V.ang(V.sub(page,drag.c)) - drag.a0;
    a = freeMove ? Math.round(a) : Math.round(a/15)*15;
    a = ((a+180)%360+360)%360-180;
    const saveR=lastR; lastR=drag.R0;
    const t = setRotation(drag.si, a, drag.cl, drag.src0);
    lastR=saveR; src=drag.src0; setSource(t,{record:false});
    hint('Rotazione '+a+'°', 900);
  } else if (drag.kind==='move'){
    let d = V.sub(page, drag.start);
    if (!drag.moved && V.len(d)*view.k<3) return;
    drag.moved=true;
    if (snapOn && !freeMove){ d = [Math.round(d[0]/snapStep)*snapStep, Math.round(d[1]/snapStep)*snapStep]; }
    const saveR = lastR; lastR = drag.R0;
    const r = moveConnectedEdits(drag.si, d);
    let t = null;
    if (r.opt) t = setOptions(drag.si, {remove:(it,k)=>k===r.opt[0], add:[r.opt[0]+'='+r.opt[1]]}, drag.src0);
    else if (r.edits.length) t = applyEdits(drag.src0, r.edits);
    lastR = saveR;
    if (t!==null){ src = drag.src0; setSource(t, {record:false}); }
    else if (!drag.warned){ drag.warned=true; hint('Questo elemento usa coordinate calcolate: modifica il codice per spostarlo'); }
  } else if (drag.kind==='tool'){
    const sp = drag.region ? page : snapPage(page);
    drag.cur = sp; if (tool==='free') drag.pts.push(page);
    updateGhost(sp);
  }
}
cv.addEventListener('pointerup', e=>{
  pinch.up(e);
  if (pan){ pan=null; cv.classList.remove('panning'); return; }
  if (!drag) return;
  if (lastMove){ const p=lastMove.page; lastMove=null; dragMove(p, e); }
  else if (drag.kind!=='tool') dragMove(toPagePt(toWorld(e)), e);
  const d=drag; drag=null;
  freeMove=false;
  if (d.kind==='handle' || d.kind==='move' || d.kind==='rot' || d.kind==='label'){
    if (d.kind==='rot' && src!==d.src0){ hist.push(d.src0); fut=[]; return; }
    if (d.moved && src!==d.src0){ hist.push(d.src0); fut=[]; }
    return;
  }
  if (d.kind==='tool'){ finishTool(d, e); ghost=''; drawOverlay(); }
});
cv.addEventListener('dblclick', e=>{
  if (Date.now()-czWireDone<500) return;
  if (tool==='line' && linePts){ linePts.pts.pop(); finishLine(false); return; }
  const hi=hitInfo(e);
  if (hi.node!==null && hi.node!==undefined) inlineEdit(hi.node);
});
let pan=null, spaceDown=false;
function startPan(e){ pan={x:e.clientX, y:e.clientY, vx:view.x, vy:view.y}; cv.classList.add('panning'); try{cv.setPointerCapture(e.pointerId);}catch(_){} }
const pinch = { pts:new Map(), d0:0, k0:0,
  add(e){ if (e.pointerType!=='touch') return false; this.pts.set(e.pointerId,[e.clientX,e.clientY]); if (this.pts.size===2){ drag=null; pan=null; const [a,b]=[...this.pts.values()]; this.d0=Math.hypot(a[0]-b[0],a[1]-b[1]); this.k0=view.k; return true; } return false; },
  move(e){ if (!this.pts.has(e.pointerId)) return false; this.pts.set(e.pointerId,[e.clientX,e.clientY]); if (this.pts.size!==2) return false; const [a,b]=[...this.pts.values()]; const d=Math.hypot(a[0]-b[0],a[1]-b[1]); const r=cv.getBoundingClientRect(); zoomAt(this.k0*d/this.d0/view.k, (a[0]+b[0])/2-r.left, (a[1]+b[1])/2-r.top); return true; },
  up(e){ this.pts.delete(e.pointerId); } };

function updateGhost(cur){
  const g = (d)=>`<path class="ghost" d="${d}"/>`;
  const Q = p=>`${p[0]} ${-p[1]}`;
  if (tool==='line' && linePts){ ghost = g('M'+linePts.pts.map(Q).join('L')+'L'+Q(cur)); drawOverlay(); return; }
  if (!drag || drag.kind!=='tool' || !drag.cur){ ghost=''; drawOverlay(); return; }
  const a=drag.start, b=drag.cur;
  switch(tool){
    case 'arrow': ghost=g(`M${Q(a)}L${Q(b)}`); break;
    case 'rect': case 'axis': ghost=g(`M${Q(a)}H${b[0]}V${-b[1]}H${a[0]}Z`); break;
    case 'circle': { const r=V.len(V.sub(b,a)); ghost=`<circle class="ghost" cx="${a[0]}" cy="${-a[1]}" r="${r}"/>`; break; }
    case 'ellipse': { const c=V.lerp(a,b,.5); ghost=`<ellipse class="ghost" cx="${c[0]}" cy="${-c[1]}" rx="${Math.abs(b[0]-a[0])/2}" ry="${Math.abs(b[1]-a[1])/2}"/>`; break; }
    case 'bezier': { const [c1,c2]=bezCtl(a,b); ghost=g(`M${Q(a)}C${Q(c1)} ${Q(c2)} ${Q(b)}`); break; }
    case 'free': ghost=g('M'+drag.pts.map(Q).join('L')); break;
  }
  drawOverlay();
}
function bezCtl(a,b){ const d=V.sub(b,a); const n=[-d[1]*.35,d[0]*.35]; return [V.add(V.add(a,V.mul(d,1/3)),n), V.add(V.add(a,V.mul(d,2/3)),V.mul(n,-1))]; }
function rdp(pts, eps){
  if (pts.length<3) return pts;
  const a=pts[0], b=pts[pts.length-1]; let dm=0, k=0;
  for (let i=1;i<pts.length-1;i++){ const d=distSeg(pts[i],a,b); if(d>dm){dm=d;k=i;} }
  if (dm>eps){ const l=rdp(pts.slice(0,k+1),eps), r=rdp(pts.slice(k),eps); return l.slice(0,-1).concat(r); }
  return [a,b];
}
function distSeg(p,a,b){ const d=V.sub(b,a), L=d[0]*d[0]+d[1]*d[1]; if(!L) return V.len(V.sub(p,a)); const t=clamp(((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/L,0,1); return V.len(V.sub(p,V.add(a,V.mul(d,t)))); }
function finishTool(d, e){
  const a=d.start, b=d.cur||d.start, R0=d.region;
  const small = V.len(V.sub(b,a))*view.k < 6;
  const F = p => fmtPt(p, R0);
  const nr = p => R0 ? p : p;
  switch(tool){
    case 'arrow': {
      if (small) return;
      let A=F(a), B=F(b); const edits=[];
      const hiEnd = hitInfo(e);
      if (d.startNode!==null){ const r=nodeNameFor(d.startNode); if(r){ A='('+r.name+')'; if(r.edit) edits.push(r.edit); } }
      if (hiEnd.node!==null && hiEnd.node!==undefined && hiEnd.node!==d.startNode){ const r=nodeNameFor(hiEnd.node); if(r){ B='('+r.name+')'; if(r.edit && !edits.some(x=>x.s===r.edit.s)) edits.push(r.edit); } }
      if (edits.length){ setSource(applyEdits(src, edits)); }
      insertStmt(`\\draw[->] ${A} -- ${B};`, R0); break; }
    case 'rect': if (!small) insertStmt(`\\draw ${F(a)} rectangle ${F(b)};`, R0); break;
    case 'circle': if (!small){ const r=V.len(V.sub(b,a)); insertStmt(`\\draw ${F(a)} circle (${fmt(snapOn&&!R0?Math.max(snapStep,Math.round(r/snapStep)*snapStep):r,2)});`, R0); } break;
    case 'ellipse': if (!small){ const c=V.lerp(a,b,.5); insertStmt(`\\draw ${F(c)} ellipse (${fmt(Math.abs(b[0]-a[0])/2,2)} and ${fmt(Math.abs(b[1]-a[1])/2,2)});`, R0); } break;
    case 'bezier': if (!small){ const [c1,c2]=bezCtl(a,b); insertStmt(`\\draw ${F(a)} .. controls ${F(c1)} and ${F(c2)} .. ${F(b)};`, R0); } break;
    case 'free': {
      const pts = rdp(d.pts, 4/view.k); if (pts.length<2) return;
      const cs = pts.map(p=> R0 ? fmtPt(p,R0) : `(${fmt(p[0],2)},${fmt(p[1],2)})`).join(' ');
      insertStmt(`\\draw plot[smooth, tension=.7] coordinates {${cs}};`, R0); break; }
    case 'axis': {
      let w=7, h=5, at=a;
      if (!small){ w=Math.abs(b[0]-a[0]); h=Math.abs(b[1]-a[1]); at=[Math.min(a[0],b[0]), Math.min(a[1],b[1])]; }
      const code = `\\begin{axis}[at={(${fmt(at[0],2)},${fmt(at[1],2)})}, width=${fmt(w,1)}cm, height=${fmt(h,1)}cm, scale only axis,\n      xlabel=$x$, ylabel=$y$, grid=major, axis lines=middle]\n    \\addplot[blue, thick, domain=-3:3, samples=80] {x^2/2};\n  \\end{axis}`;
      insertStmt(code, null); break; }
  }
  setTool('select');
}
function finishLine(cycle){
  const lp=linePts; linePts=null; ghost='';
  if (!lp || lp.pts.length<2){ drawOverlay(); return; }
  const cs = lp.pts.map(p=>fmtPt(p, lp.region)).join(' -- ') + (cycle?' -- cycle':'');
  insertStmt(`\\draw ${cs};`, lp.region);
  setTool('select');
}
function setTool(t){
  if (linePts && t!=='line') finishLine(false);
  tool=t; ghost=''; drawOverlay();
  if (typeof umlPalSync==='function') umlPalSync();
  if (typeof autPalSync==='function') autPalSync();
  if (typeof cdPalSync==='function') cdPalSync();
  if (typeof czPalSync==='function') czPalSync();
  document.querySelectorAll('#tools [data-tool]').forEach(b=>b.classList.toggle('on', b.dataset.tool===t));
  cv.setAttribute('class', t==='select' ? 't-sel' : 't-draw');
  const tips = {node:'Clic per inserire un nodo', line:'Clic per aggiungere punti · doppio clic o Invio per finire · clic sul primo punto per chiudere', arrow:'Trascina tra due punti o due nodi', rect:'Trascina per disegnare un rettangolo', circle:'Trascina dal centro', ellipse:'Trascina il riquadro dell\'ellisse', bezier:'Trascina, poi regola i punti di controllo', free:'Disegna a mano libera', axis:'Trascina il riquadro del grafico'};
  if (tips[t]) hint(tips[t], 3000);
}
document.querySelectorAll('#tools [data-tool]').forEach(b=>b.addEventListener('click', ()=>setTool(b.dataset.tool)));
function revealStmt(){
  const st=lastR.stmts[curStmt()]; if(!st) return;
  const ln=lineOfSrc(st.start); const lh=13*1.55; const top=(ln-1)*lh;
  if (top<ed.scrollTop || top>ed.scrollTop+ed.clientHeight-40){ ed.scrollTop=Math.max(0,top-ed.clientHeight/3); syncScroll(); }
}
function deleteSel(){
  const si=curStmt(); if (si<0) return;
  const st=lastR.stmts[si];
  let s=st.start, e=st.end;
  if (st.cd && st.cd.cell){ s=st.cd.s; e=st.cd.e; selStart=null; setSource(src.slice(0,s)+src.slice(e)); toast('Cella svuotata'); return; }
  const ls=src.lastIndexOf('\n',s-1)+1; if (/^\s*$/.test(src.slice(ls,s))) s=ls;
  if (src[e]==='\n') e++;
  selStart=null; setSource(src.slice(0,s)+src.slice(e)); toast('Eliminato');
}
function duplicateSel(){
  const si=curStmt(); if (si<0) return;
  const st=lastR.stmts[si];
  if (st.cd){ toast('Nei diagrammi tikz-cd si aggiunge dal pannello tikz-cd'); return; } const ls=src.lastIndexOf('\n',st.start-1)+1; const ind=/^\s*/.exec(src.slice(ls,st.start))[0];
  let code=src.slice(st.start, st.end);
  // sposta di un passo le coordinate letterali
  const off = snapStep*2;
  const r = moveStmtEdits(si, [off,-off]);
  if (r.edits && r.edits.length){ const sh=r.edits.map(x=>({s:x.s-st.start, e:x.e-st.start, t:x.t})).filter(x=>x.s>=0 && x.e<=code.length); code=applyEdits(code, sh); }
  code = code.replace(/\\node(\s*\[[^\]]*\])?\s*\(([^)]*)\)/, (m,o,n)=>`\\node${o||''} (${n}b)`);
  const at = st.end; const t = src.slice(0,at)+'\n'+ind+code+src.slice(at);
  selStart = at+1+ind.length; setSource(t); toast('Duplicato');
}
document.addEventListener('keydown', e=>{
  const inField = /^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement.tagName);
  if (e.key===' ' && !inField){ spaceDown=true; }
  if (inField) return;
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='d'){ e.preventDefault(); duplicateSel(); return; }
  if (e.key.startsWith('Arrow') && curStmt()>=0){
    e.preventDefault();
    const fine = e.altKey || e.ctrlKey || e.metaKey;
    const s = fine ? .01 : e.shiftKey ? snapStep*4 : snapStep;
    const d={ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,s],ArrowDown:[0,-s]}[e.key];
    freeMove = fine || !snapOn;
    const h = selHandle!==null ? stmtHandles(curStmt())[selHandle] : null;
    if (h){ setSource(applyEdits(src, handleEdits(h, V.add(h.p, d)))); }
    else { const r=moveConnectedEdits(curStmt(), d); if (r.opt) setSource(setOpt(curStmt(), r.opt[0], r.opt[1])); else if (r.edits.length) setSource(applyEdits(src, r.edits)); }
    freeMove=false; return;
  }
  if (e.ctrlKey||e.metaKey||e.altKey) return;
  if (e.key==='Escape' && selHandle!==null){ selHandle=null; drawOverlay(); updateProps(); return; }
  if (e.key==='Escape'){ if (linePts){ finishLine(false); } else if (tool!=='select') setTool('select'); else { selStart=null; updateHL(); drawOverlay(); updateProps(); } return; }
  if (e.key==='Enter' && linePts){ finishLine(false); return; }
  if (e.key==='Enter' && tool==='circ' && czFinishWire()) return;
  if ((e.key==='Delete'||e.key==='Backspace') && curStmt()>=0){ e.preventDefault(); deleteSel(); return; }
  if (e.key.startsWith('Arrow') && curStmt()>=0){
    e.preventDefault(); const s=e.shiftKey?snapStep*4:snapStep;
    const d={ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,s],ArrowDown:[0,-s]}[e.key];
    const r=moveConnectedEdits(curStmt(), d);
    if (r.opt) setSource(setOpt(curStmt(), r.opt[0], r.opt[1])); else if (r.edits.length) setSource(applyEdits(src, r.edits));
    return;
  }
  if (e.key.toLowerCase()==='u'){ umlPalOpen($('umlpal').hidden); return; }
  if (e.key.toLowerCase()==='m'){ autPalOpen($('autpal').hidden); return; }
  if (e.key.toLowerCase()==='d'){ cdPalOpen($('cdpal').hidden); return; }
  if (e.key.toLowerCase()==='k'){ czPalOpen($('czpal').hidden); return; }
  const map={v:'select',n:'node',l:'line',a:'arrow',r:'rect',c:'circle',e:'ellipse',b:'bezier',f:'free',g:'axis'};
  if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
  if (e.key==='0') fitView();
  if (e.key==='+'||e.key==='=') zoomAt(1.25); if (e.key==='-') zoomAt(.8);
});
document.addEventListener('keyup', e=>{ if (e.key===' ') spaceDown=false; });

/* ---------- modifica in linea del testo dei nodi ---------- */
function inlineEdit(nIdx){
  const nd=lastR.nodes[nIdx]; if (!nd || !nd.text) return;
  const el = drawG.querySelector(`[data-n="${nIdx}"]`); if (!el) return;
  const bb = el.getBoundingClientRect(), pr=$('right').getBoundingClientRect();
  document.getElementById('inl')?.remove();
  const inp = document.createElement('input'); inp.id='inl'; inp.type='text';
  inp.value = src.slice(nd.text.s, nd.text.e);
  inp.style.left = Math.max(8, bb.left-pr.left + bb.width/2 - 90)+'px'; inp.style.top = (bb.top-pr.top + bb.height/2 - 16)+'px'; inp.style.width='180px';
  $('right').appendChild(inp); inp.focus(); inp.select();
  const span = {...nd.text}; const src0=src;
  let done=false;
  const commit = ok => { if (done) return; done=true; inp.remove(); if (ok && inp.value!==src0.slice(span.s,span.e)){ src=src0; setSource(src0.slice(0,span.s)+inp.value+src0.slice(span.e)); } else { src=src0; ed.value=src0; renderNow(); } };
  inp.addEventListener('input', ()=>{ const t=src0.slice(0,span.s)+inp.value+src0.slice(span.e); src=t; ed.value=t; renderNow(); });
  inp.addEventListener('keydown', ev=>{ ev.stopPropagation(); if (ev.key==='Enter') commit(true); if (ev.key==='Escape') commit(false); });
  inp.addEventListener('blur', ()=>commit(true));
}

/* ---------- rotazione ---------- */
const ROT_CMDS = /^(draw|fill|filldraw|path|shade|shadedraw|pattern|node|coordinate|matrix)$/;
function canRotate(si){ const st=lastR.stmts[si]; return !!st && ROT_CMDS.test(st.cmd) && st.cmd!=='coordinate'; }
function isNodeStmt(st){ return st.cmd==='node' || st.cmd==='matrix'; }
function rotInfo(si, pageC){
  // angolo attuale e centro (in pagina e nel sistema locale della scope)
  const st=lastR.stmts[si]; const items=optItems(st);
  if (isNodeStmt(st)){
    const v=optVal(items,'rotate'); const n=lastR.nodes.find(x=>x.stmt===si);
    return {angle: v!==null&&v!==true ? +v||0 : 0, c: pageC, cl:null};
  }
  const v=optVal(items,'rotate around');
  const fr = st.frame || affineFrame(M_ID);
  if (v && v!==true){
    const m=/^\s*([^:]+):\s*\(([^)]*)\)/.exec(v);
    if (m){ const q=splitTop(m[2]); const cl=[+q[0]||0, +q[1]||0]; return {angle:+m[1]||0, cl, c:fr.map(...cl)}; }
  }
  const cl = fr.inv(...pageC); const r = x=>Math.round(x*100)/100;
  return {angle:0, cl:[r(cl[0]),r(cl[1])], c:pageC};
}
function setRotation(si, a, cl, text){
  const st=lastR.stmts[si];
  if (isNodeStmt(st)) return setOptions(si, {remove:(it,k)=>k==='rotate', add: a ? ['rotate='+a] : []}, text);
  return setOptions(si, {remove:(it,k)=>k==='rotate around', add: a ? [`rotate around={${a}:(${fmt(cl[0],2)},${fmt(cl[1],2)})}`] : []}, text);
}

function stmtHandles(si){ const seen=new Set(), out=[]; for (const h of lastR.handles){ if (h.stmt!==si) continue; const k=handleKey(h); if (seen.has(k)) continue; seen.add(k); out.push(h); } return out; }
