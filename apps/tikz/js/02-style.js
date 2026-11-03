/* ============ STILI: interpretazione delle opzioni TikZ/pgfplots ============ */
const LW = {'ultra thin':.1,'very thin':.2,'thin':.4,'semithick':.6,'thick':.8,'very thick':1.2,'ultra thick':1.6};
const FONTSZ = {tiny:.5,scriptsize:.7,footnotesize:.8,small:.9,normalsize:1,large:1.2,Large:1.44,LARGE:1.728,huge:2.074,Huge:2.488};
const PLACE = {'above':[0,1,'south'],'below':[0,-1,'north'],'left':[-1,0,'east'],'right':[1,0,'west'],
  'above left':[-1,1,'south east'],'above right':[1,1,'south west'],'below left':[-1,-1,'north east'],'below right':[1,-1,'north west']};
const SHAPES = ['circle','rectangle','ellipse','diamond','regular polygon','star','trapezium','semicircle','rounded rectangle','cylinder','isosceles triangle','kite','cloud','circle split','cross out','strike out','forbidden sign','single arrow','double arrow','rectangle callout','ellipse callout','dart','signal','tape','coordinate','circle cross','chamfered rectangle'];
const TIP_RE = /^(?:|[<>]+|[|]|o|\*|latex'?|Latex|stealth'?|Stealth|to|To|Triangle|triangle 45|triangle 60|triangle 90|Bar|Circle|Square|Diamond|Kite|Rays|Hooks|hooks|Arc Barb|Straight Barb|Classical TikZ Rightarrow|Implies|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\[[^\]]*\])+$/;
function parseArrowSpec(k){
  // ritorna [start,end] o null
  let depth=0;
  for (let j=0;j<k.length;j++){
    const c=k[j]; if(c==='{'||c==='[')depth++; else if(c==='}'||c===']')depth--;
    else if (c==='-' && depth===0){
      const a=k.slice(0,j).trim(), b=k.slice(j+1).trim();
      if (TIP_RE.test(a) && TIP_RE.test(b)) return [a,b];
    }
  }
  return null;
}
function newStyle(){
  return {color:[0,0,0], draw:undefined, fill:undefined, text:undefined, lw:.4*PT, dash:null, arrows:['',''], arrowDef:'to',
    opacity:1, fop:1, dop:1, top:1, rounded:0, shade:null, pattern:null, double:null, cap:'butt', join:'miter', evenodd:false,
    shape:'rectangle', isep:[3.333*PT,3.333*PT], osep:null, minW:0, minH:0, anchor:null, place:null, textWidth:0, align:'center',
    font:1, bold:false, ital:false, sf:false, tt:false, nodeRot:0, pos:null, sloped:false, xform:false, sides:5, starPts:5, starRatio:1.5,
    labels:[], name:null, smooth:false, tension:.55, bend:null, out:null, in:null, loose:1, loop:null, domain:[-5,5], samples:25,
    variable:'x', radius:null, xr:null, yr:null, sa:null, ea:null, da:null, step:[1,1], kv:{}, nodeDist:1, auto:null, swap:false,
    trapL:60, trapR:60, aspect:1, matrix:false, rowSep:0, colSep:0, mon:false, shorten:[0,0], innerLines:null, decor:null };
}
const cloneStyle = s => ({...s, labels:s.labels.slice(), kv:{...s.kv}, arrows:s.arrows.slice(), step:s.step.slice(), isep:s.isep.slice(), shorten:s.shorten.slice()});

/* applica opzioni; ctx: {vars, styles, warn}; ritorna matrice locale da comporre */
function applyOpts(st, text, ctx, depth=0){
  let M = M_ID;
  if (!text || depth>20) return M;
  text = subVars(text, ctx.vars);
  for (const {k,v} of parseOptList(text)){
    const m = applyKey(st, k, v, ctx, depth);
    if (m) M = mMul(M, m);
  }
  return M;
}
function lenPt(v, ctx){ return evalLen(v, ctx.vars, PT); }
function lenCm(v, ctx){ return evalLen(v, ctx.vars, 1); }
function applyKey(st, k, v, ctx, depth){
  const vars = ctx.vars;
  // definizioni di stile
  let m;
  if ((m = /^(.+?)\/\.(style|append style|prefix style|code|default|initial)$/.exec(k))){
    const nm=m[1].trim().replace(/^\//,'').replace(/^tikz\//,'');
    if (m[2]==='style') ctx.styles[nm]=v||'';
    else if (m[2]==='append style') ctx.styles[nm]=(ctx.styles[nm]?ctx.styles[nm]+',':'')+(v||'');
    else if (m[2]==='prefix style') ctx.styles[nm]=(v||'')+(ctx.styles[nm]?','+ctx.styles[nm]:'');
    return null;
  }
  if (/^every /.test(k) && v!==null){ ctx.styles[k]=(ctx.styles[k]?ctx.styles[k]+',':'')+v; return null; }
  if (ctx.styles[k]!==undefined && v===null){ return applyOpts(st, ctx.styles[k], ctx, depth+1); }
  if (ctx.styles[k]!==undefined && v!==null){ return applyOpts(st, ctx.styles[k].replace(/#1/g,v), ctx, depth+1); }
  if (v===null){
    if (LW[k]!==undefined){ st.lw=LW[k]*PT; return null; }
    const ar = parseArrowSpec(k); if (ar && k.includes('-')){ st.arrows=ar; return null; }
    if (SHAPES.includes(k)){ st.shape=k; return null; }
    if (CZ_NODES[k]){ st.shape=k; st.isep=[0,0]; return null; }
    if (PLACE[k]){ st.place={dir:k, dist:null, of:null}; return null; }
    if (isColorWord(k)){ st.color=parseColor(k); return null; }
  }
  if (autKey(st, k, v, ctx, depth)) return null;
  const col = () => { const c=parseColor(v); if(c===null) ctx.warn('colore sconosciuto «'+v+'»'); return c; };
  switch(k){
    case 'draw': st.draw = v===null ? true : (col()||true); return null;
    case 'fill': st.fill = v===null ? true : (col()||true); return null;
    case 'color': st.color = col()||st.color; return null;
    case 'text': st.text = col(); return null;
    case 'filldraw': st.draw=st.draw||true; st.fill=st.fill||true; return null;
    case 'line width': st.lw = lenPt(v,ctx); return null;
    case 'solid': st.dash=null; return null;
    case 'dashed': st.dash=[3,3]; return null;
    case 'densely dashed': st.dash=[3,2]; return null;
    case 'loosely dashed': st.dash=[3,6]; return null;
    case 'dotted': st.dash=['lw',2]; return null;
    case 'densely dotted': st.dash=['lw',1]; return null;
    case 'loosely dotted': st.dash=['lw',4]; return null;
    case 'dash dot': st.dash=[3,2,'lw',2]; return null;
    case 'densely dash dot': st.dash=[3,1,'lw',1]; return null;
    case 'dash dot dot': st.dash=[3,2,'lw',2,'lw',2]; return null;
    case 'dash pattern': { const a=[]; v.replace(/(on|off)\s+([^\s]+(?:\s*\\pgflinewidth)?)/g,(_,o,l)=>{ a.push(/pgflinewidth/.test(l)?'lw':lenPt(l,ctx)/PT); }); st.dash=a.length?a:null; return null; }
    case 'arrows': { const ar=parseArrowSpec(v||''); if(ar) st.arrows=ar; return null; }
    case '>': st.arrowDef=v; return null;
    case 'opacity': st.opacity=+evalExpr(v,vars); return null;
    case 'fill opacity': st.fop=+evalExpr(v,vars); return null;
    case 'draw opacity': st.dop=+evalExpr(v,vars); return null;
    case 'text opacity': st.top=+evalExpr(v,vars); return null;
    case 'transparent': st.opacity=0; return null;
    case 'semitransparent': st.opacity=.5; return null;
    case 'rounded corners': st.rounded = v===null ? 4*PT : lenPt(v,ctx); return null;
    case 'sharp corners': st.rounded=0; return null;
    case 'line cap': st.cap = v==='rect'?'square':v; return null;
    case 'line join': st.join=v; return null;
    case 'double': st.double = v===null ? [1,1,1] : col(); return null;
    case 'double distance': st.ddist=lenPt(v,ctx); return null;
    case 'even odd rule': st.evenodd=true; return null;
    case 'help lines': st.color=[.5,.5,.5]; st.lw=.2*PT; return null;
    case 'left color': case 'right color': case 'top color': case 'bottom color': case 'middle color':
    case 'inner color': case 'outer color': case 'ball color': {
      const c=col(); st.shade=st.shade||{}; st.shade[k.split(' ')[0]]=c;
      if (k==='left color'||k==='right color') st.shade.type='h';
      else if (k==='top color'||k==='bottom color') st.shade.type='v';
      else if (k==='inner color'||k==='outer color') st.shade.type='r';
      else if (k==='ball color') st.shade.type='ball';
      if (st.fill===undefined) st.fill=true; return null; }
    case 'shading': st.shade=st.shade||{}; st.shade.type = v==='radial'?'r':v==='ball'?'ball':'v'; return null;
    case 'shading angle': st.shade=st.shade||{}; st.shade.angle=+evalExpr(v,vars); return null;
    case 'pattern': st.pattern=v; if(st.fill===undefined) st.fill=true; return null;
    case 'pattern color': st.patColor=col(); return null;
    case 'shape': st.shape=v; return null;
    case 'regular polygon sides': st.sides=Math.max(3,Math.round(evalExpr(v,vars))); return null;
    case 'star points': st.starPts=Math.max(3,Math.round(evalExpr(v,vars))); return null;
    case 'star point ratio': st.starRatio=+evalExpr(v,vars); return null;
    case 'star point height': st.starH=lenPt(v,ctx); return null;
    case 'trapezium left angle': st.trapL=+evalExpr(v,vars); return null;
    case 'trapezium right angle': st.trapR=+evalExpr(v,vars); return null;
    case 'trapezium angle': st.trapL=st.trapR=+evalExpr(v,vars); return null;
    case 'aspect': st.aspect=+evalExpr(v,vars); return null;
    case 'inner sep': { const l=lenPt(v,ctx); st.isep=[l,l]; return null; }
    case 'inner xsep': st.isep[0]=lenPt(v,ctx); return null;
    case 'inner ysep': st.isep[1]=lenPt(v,ctx); return null;
    case 'outer sep': st.osep=lenPt(v,ctx); return null;
    case 'minimum size': st.minW=st.minH=lenCm(v,ctx); return null;
    case 'minimum width': st.minW=lenCm(v,ctx); return null;
    case 'minimum height': st.minH=lenCm(v,ctx); return null;
    case 'text width': st.textWidth=lenCm(v,ctx); return null;
    case 'align': st.align = v==='flush left'?'left':v==='flush right'?'right':v==='flush center'?'center':v; return null;
    case 'anchor': st.anchor=v; st.place=null; return null;
    case 'name': st.name=v; return null;
    case 'node distance': { const p=v.split(/\s+and\s+/); st.nodeDist=lenCm(p[0],ctx); st.nodeDistY=p[1]?lenCm(p[1],ctx):null; return null; }
    case 'font': {
      st.bold=/\\bfseries|\\bf\b/.test(v)||st.bold; st.ital=/\\itshape|\\it\b/.test(v)||st.ital;
      st.sf=/\\sffamily/.test(v)||st.sf; st.tt=/\\ttfamily/.test(v)||st.tt;
      const f=/\\(tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/.exec(v); if(f) st.font=FONTSZ[f[1]];
      const fs=/\\fontsize\{([^}]*)\}/.exec(v); if(fs) st.font=lenPt(fs[1],ctx)/(10*PT);
      return null; }
    case 'pos': st.pos=+evalExpr(v,vars); return null;
    case 'midway': st.pos=.5; return null;
    case 'near start': st.pos=.25; return null;
    case 'near end': st.pos=.75; return null;
    case 'very near start': st.pos=.125; return null;
    case 'very near end': st.pos=.875; return null;
    case 'at start': st.pos=0; return null;
    case 'at end': st.pos=1; return null;
    case 'sloped': st.sloped=true; return null;
    case 'auto': st.auto = v===null||v==='left' ? 'left' : v==='right'?'right':null; return null;
    case 'swap': case "'": st.swap=!st.swap; return null;
    case 'transform shape': st.xform=true; return null;
    case 'label': case 'pin': st.labels.push({txt:v, pin:k==='pin'}); return null;
    case 'smooth': st.smooth=true; return null;
    case 'smooth cycle': st.smooth=true; st.smoothCycle=true; return null;
    case 'tension': st.tension=+evalExpr(v,vars); return null;
    case 'bend left': st.bend = v===null?30:+evalExpr(v,vars); return null;
    case 'bend right': st.bend = -(v===null?30:+evalExpr(v,vars)); return null;
    case 'out': st.out=+evalExpr(v,vars); return null;
    case 'in': st.in=+evalExpr(v,vars); return null;
    case 'looseness': st.loose=+evalExpr(v,vars); return null;
    case 'out looseness': st.looseOut=+evalExpr(v,vars); return null;
    case 'in looseness': st.looseIn=+evalExpr(v,vars); return null;
    case 'relative': st.rel=v===null||v==='true'; return null;
    case 'loop': st.loop='above'; return null;
    case 'loop above': case 'loop below': case 'loop left': case 'loop right': st.loop=k.slice(5); return null;
    case 'min distance': st.minDist=lenCm(v,ctx); return null;
    case 'domain': { const p=v.split(':'); st.domain=[+evalExpr(p[0],vars), +evalExpr(p[1],vars)]; return null; }
    case 'samples': st.samples=Math.max(2,Math.round(evalExpr(v,vars))); return null;
    case 'samples at': st.samplesAt=v; return null;
    case 'variable': st.variable=v.replace(/^\\/,''); return null;
    case 'radius': st.radius=v; return null;
    case 'x radius': st.xr=v; return null;
    case 'y radius': st.yr=v; return null;
    case 'start angle': st.sa=+evalExpr(v,vars); return null;
    case 'end angle': st.ea=+evalExpr(v,vars); return null;
    case 'delta angle': st.da=+evalExpr(v,vars); return null;
    case 'step': { if(/^\(/.test(v)){ const p=splitTop(v.slice(1,-1)); st.step=[lenCm(p[0],ctx),lenCm(p[1],ctx)]; } else { const s=lenCm(v,ctx); st.step=[s,s]; } return null; }
    case 'xstep': st.step[0]=lenCm(v,ctx); return null;
    case 'ystep': st.step[1]=lenCm(v,ctx); return null;
    case 'shorten >': st.shorten[1]=lenPt(v,ctx); return null;
    case 'shorten <': st.shorten[0]=lenPt(v,ctx); return null;
    case 'matrix': st.matrix=true; return null;
    case 'matrix of nodes': case 'matrix of math nodes': st.matrix=true; st.mon=k; return null;
    case 'row sep': st.rowSep=lenCm(v.replace(/^\s*=/,''),ctx); return null;
    case 'column sep': st.colSep=lenCm(v.replace(/^\s*=/,''),ctx); return null;
    case 'decorate': st.decorOn=true; return null;
    case 'decoration': st.decor=v; return null;
    // trasformazioni
    case 'shift': { const p=unbrace(v).replace(/^\(|\)$/g,''); const q=splitTop(p); if(q.length===2) return mTr(lenCm(unbrace(q[0]),ctx), lenCm(unbrace(q[1]),ctx)); return null; }
    case 'xshift': return mTr(lenPt(v,ctx),0);
    case 'yshift': return mTr(0,lenPt(v,ctx));
    case 'rotate': { const a=+evalExpr(v,vars); st.nodeRot+=a; return mRot(a); }
    case 'scale': { const s=+evalExpr(v,vars); return mSc(s,s); }
    case 'xscale': return mSc(+evalExpr(v,vars),1);
    case 'yscale': return mSc(1,+evalExpr(v,vars));
    case 'xslant': return [1,0,+evalExpr(v,vars),1,0,0];
    case 'yslant': return [1,+evalExpr(v,vars),0,1,0,0];
    case 'x': { if(/^\(/.test(v)){ const q=splitTop(v.slice(1,-1)); return [lenCm(q[0],ctx),lenCm(q[1],ctx),0,1,0,0]; } return mSc(lenCm(v,ctx),1); }
    case 'y': { if(/^\(/.test(v)){ const q=splitTop(v.slice(1,-1)); return [1,0,lenCm(q[0],ctx),lenCm(q[1],ctx),0,0]; } return mSc(1,lenCm(v,ctx)); }
    case 'rotate around': { const [a,c]=v.split(/:(.*)/s); const q=splitTop(c.trim().replace(/^\(|\)$/g,'')); const cx=lenCm(q[0],ctx), cy=lenCm(q[1],ctx);
      return mMul(mTr(cx,cy), mMul(mRot(+evalExpr(a,vars)), mTr(-cx,-cy))); }
    case 'cm': { const q=splitTop(v); const t=splitTop(q[4].trim().replace(/^\(|\)$/g,'')); return [+evalExpr(q[0],vars),+evalExpr(q[1],vars),+evalExpr(q[2],vars),+evalExpr(q[3],vars),lenCm(t[0],ctx),lenCm(t[1],ctx)]; }
  }
  // posizionamento: above=1cm, right=of a, above left=2mm and 1mm of b
  if (PLACE[k]){
    let dist=null, of=null;
    const mo=/^(.*?)\s*\bof\s+(.+)$/.exec(v);
    if (mo){ of=mo[2].trim(); if(mo[1].trim()) dist=mo[1].trim(); } else dist=v;
    let d=null; if (dist){ const pp=dist.split(/\s+and\s+/); d=[lenCm(pp[0],ctx), pp[1]?lenCm(pp[1],ctx):null]; }
    st.place={dir:k, dist:d, of}; return null;
  }
  const old=/^(above|below|left|right)( left| right)? of$/.exec(k);
  if (old){ st.place={dir:(old[1]+(old[2]||'')), dist:null, of:v, old:true}; return null; }
  if (/^mark|^only marks$|^no marks$|^no markers$|^sharp plot$|^const plot|^ybar|^xbar|^ycomb|^xcomb|^area style|^legend|^forget plot|^every|^samples y|^unbounded coords|^mesh|^scatter|^error bars|^nodes near coords|^bar|^thin$/.test(k) || ctx.axisKey){
    st.kv[k]=v===null?true:v; return null;
  }
  st.kv[k] = v===null ? true : v;
  if (!/^(baseline|remember picture|overlay|execute at|>=|level|sibling|grow|edge from parent|child anchor|parent anchor|inner frame|framed|background|on background layer|every|font|trim|use as bounding box|line|draw=|text depth|text height|label distance|pin distance|postaction|preaction|show background|decoration|segment|amplitude|tips|tight background|scope|xscale|yscale|join|nodes|cells|ampersand replacement|minimum|text centered|text badly|anchor|outer|inner|path picture|local bounding box|declare function|name path|name intersections|\/pgf|\/tikz|>)/.test(k))
    ctx.warn('opzione ignorata: '+k);
  return null;
}
