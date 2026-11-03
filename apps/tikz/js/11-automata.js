/* ============ LIBRERIA AUTOMATA: stati, stati iniziali e accettanti ============ */
const AUT_DEF = {init:false, initWhere:'left', initAngle:null, initText:'start', initDist:3*UNIT.ex,
  acc:null, accWhere:'right', accAngle:null, accText:'', accDist:3*UNIT.ex};
const AUT_INIT_RE = /^initial( (above|below|left|right)| by (arrow|diamond))?$/, AUT_ACC_RE = /^accepting( (above|below|left|right)| by (arrow|double))?$/;
const AUT_DIR = {above:90, below:270, left:180, right:0, 'above left':135, 'above right':45, 'below left':225, 'below right':315};

/* opzioni della libreria; ritorna true se la chiave è stata riconosciuta */
function autKey(st, k, v, ctx, depth){
  const set = o => { st.aut = {...(st.aut||AUT_DEF), ...o}; return true; };
  let m;
  switch(k){
    case 'state': case 'state without output': case 'state with output':
      st.shape = k==='state with output' ? 'circle split' : 'circle';
      st.draw = st.draw||true; st.minW = st.minH = 2.5*UNIT.em;
      if (ctx.styles['every state']) applyOpts(st, ctx.styles['every state'], ctx, depth+1);
      return true;
    case 'initial': case 'initial by arrow': return set({init:true});
    case 'initial by diamond': ctx.warn('initial by diamond non supportato: uso initial by arrow'); return set({init:true});
    case 'initial where': return set({initWhere:(v||'left').trim(), initAngle:null});
    case 'initial angle': return set({initAngle:+evalExpr(v, ctx.vars)});
    case 'initial text': return set({initText:v||''});
    case 'initial distance': return set({initDist:lenCm(v, ctx)});
    case 'accepting': case 'accepting by double':
      st.double = st.double||[1,1,1];
      return set({acc:'double'});
    case 'accepting by arrow': return set({acc:'arrow'});
    case 'accepting where': return set({accWhere:(v||'right').trim(), accAngle:null});
    case 'accepting angle': return set({accAngle:+evalExpr(v, ctx.vars)});
    case 'accepting text': return set({accText:v||''});
    case 'accepting distance': return set({accDist:lenCm(v, ctx)});
    case 'on grid': st.onGrid = v===null || v==='true'; return true;
  }
  // initial above = initial, initial where=above (lo stile initial può essere ridefinito)
  if (v===null && (m=/^(initial|accepting) (above|below|left|right)$/.exec(k))){
    applyKey(st, m[1], null, ctx, depth+1);
    return set(m[1]==='initial' ? {initWhere:m[2], initAngle:null} : {accWhere:m[2], accAngle:null});
  }
  return false;
}

/* frecce di ingresso (initial) e di uscita (accepting by arrow) di uno stato */
function autSVG(n, ctx){
  const a=n.st.aut; if (!a || n.kind==='pt' || (!a.init && a.acc!=='arrow')) return '';
  const names=['east','north east','north','north west','west','south west','south','south east'];
  const one = (ang, dist, text, incoming, styleKey) => {
    const b=toPage(n, borderLocal(n, ang-n.rot)), far=V.add(b, V.pol(ang, dist));
    const st=cloneStyle(ctx.style); st.draw=true; st.fill=undefined; st.shade=null; st.pattern=null; st.dash=null; st.double=null;
    st.color = n.st.draw && n.st.draw!==true ? n.st.draw : n.st.color; st.arrows=['','>']; st.shorten=[0,0]; st.rounded=0;
    if (ctx.styles[styleKey]) applyOpts(st, ctx.styles[styleKey], ctx);
    const [p0, p1] = incoming ? [far, b] : [b, far];
    let out = pathSVG({st, subs:[{start:p0, ops:[{t:'L', p:p1}], closed:false}], extraSVG:[], edges:[], nodes:[]}, ctx, false).svg;
    if (text.trim()){
      const lst=nodeBaseStyle(ctx.style, ctx, 'node');
      lst.anchor = names[Math.round((((ang+180)%360+360)%360)/45)%8];
      out += nodeSVG(buildNode(lst, text, far, ctx));
    }
    return out;
  };
  const dir = (w, ang) => ang!==null ? ang : AUT_DIR[w]!==undefined ? AUT_DIR[w] : (ctx.warn('posizione «'+w+'» sconosciuta'), 180);
  let out='';
  if (a.init) out += one(dir(a.initWhere, a.initAngle), a.initDist, a.initText, true, 'every initial by arrow');
  if (a.acc==='arrow') out += one(dir(a.accWhere, a.accAngle), a.accDist, a.accText, false, 'every accepting by arrow');
  return out;
}
