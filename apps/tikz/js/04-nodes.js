/* ============ NODI, FORME, PITTURA, FRECCE ============ */
let DEFS = [], DEFN = 0;
const P = p => fmt(p[0],4)+' '+fmt(-p[1],4);
const ptsPath = (pts, close=true) => 'M'+pts.map(P).join('L')+(close?'Z':'');

function nodeGeom(n){
  // calcola forma locale (centrata, non ruotata)
  const st=n.st, iw=n.iw, ih=n.ih;
  const sh = st.shape;
  n.poly=null; n.rx=n.ry=0; n.kind='poly';
  if (sh==='coordinate'){ n.kind='pt'; n.hw=n.hh=0; return; }
  if (CZ_NODES[sh]){ czGeom(n); return; }
  if (sh==='circle' || sh==='circle split' || sh==='forbidden sign' || sh==='circle cross'){
    const R=Math.max(Math.hypot(iw,ih), st.minW/2, st.minH/2); n.kind='ell'; n.rx=n.ry=R; n.hw=n.hh=R; return; }
  if (sh==='ellipse' || sh==='cloud' || sh==='ellipse callout'){
    const rx=Math.max(iw*Math.SQRT2, st.minW/2), ry=Math.max(ih*Math.SQRT2, st.minH/2); n.kind='ell'; n.rx=rx; n.ry=ry; n.hw=rx; n.hh=ry; return; }
  let pts;
  if (sh==='diamond'){
    const a=st.aspect||1; let rx=iw+ih*a, ry=ih+iw/a; rx=Math.max(rx,st.minW/2); ry=Math.max(ry,st.minH/2);
    pts=[[rx,0],[0,ry],[-rx,0],[0,-ry]];
  } else if (sh==='regular polygon'){
    const N=st.sides; let R=Math.hypot(iw,ih)/Math.cos(Math.PI/N); R=Math.max(R,st.minW/2,st.minH/2);
    const a0=90+(N%2===0?180/N:0); pts=[]; for(let k=0;k<N;k++) pts.push(V.pol(a0+k*360/N,R));
  } else if (sh==='star'){
    const N=st.starPts; let ri=Math.hypot(iw,ih); let ro=ri*st.starRatio; const mx=Math.max(st.minW,st.minH)/2; if(ro<mx){ const f=mx/ro; ro*=f; ri*=f; }
    pts=[]; for(let k=0;k<2*N;k++) pts.push(V.pol(90+k*180/N, k%2?ri:ro));
  } else if (sh==='trapezium'){
    const hh=Math.max(ih,st.minH/2), hw=Math.max(iw,st.minW/2);
    const dl=2*hh/Math.tan(st.trapL*D2R), dr=2*hh/Math.tan(st.trapR*D2R);
    pts=[[-hw-dl/2,-hh],[hw+dr/2,-hh],[hw-dr/2,hh],[-hw+dl/2,hh]];
  } else if (sh==='isosceles triangle'){
    const hh=Math.max(ih*2,st.minH/2), hw=Math.max(iw*1.6,st.minW/2); pts=[[hw,0],[-hw,hh],[-hw,-hh]];
  } else if (sh==='semicircle'){
    const R=Math.max(Math.hypot(iw,ih*2), st.minW/2); pts=[]; for(let k=0;k<=24;k++) pts.push(V.pol(k*7.5,R)); pts=pts.map(p=>[p[0],p[1]-R/2]);
  } else if (sh==='kite' || sh==='dart'){
    const rx=iw*1.4, ry=ih*1.8; pts=[[0,ry],[rx,ry*.3],[0,-ry],[-rx,ry*.3]];
  } else if (sh==='single arrow'){
    const hw=Math.max(iw,st.minW/2), hh=Math.max(ih,st.minH/2); pts=[[-hw,-hh],[hw,-hh],[hw,-hh*1.8],[hw+hh*1.8,0],[hw,hh*1.8],[hw,hh],[-hw,hh]];
  } else if (sh==='double arrow'){
    const hw=Math.max(iw,st.minW/2), hh=Math.max(ih,st.minH/2), t=hh*1.8; pts=[[-hw,-hh],[hw,-hh],[hw,-t],[hw+t,0],[hw,t],[hw,hh],[-hw,hh],[-hw,t],[-hw-t,0],[-hw,-t]];
  } else if (sh==='signal'){
    const hw=Math.max(iw,st.minW/2), hh=Math.max(ih,st.minH/2); pts=[[-hw,-hh],[hw,-hh],[hw+hh,0],[hw,hh],[-hw,hh]];
  } else if (sh==='chamfered rectangle'){
    const hw=Math.max(iw,st.minW/2), hh=Math.max(ih,st.minH/2), c=Math.min(hw,hh)*.4; pts=[[-hw+c,-hh],[hw-c,-hh],[hw,-hh+c],[hw,hh-c],[hw-c,hh],[-hw+c,hh],[-hw,hh-c],[-hw,-hh+c]];
  } else {
    // rectangle e default
    const hw=Math.max(iw,st.minW/2), hh=Math.max(ih,st.minH/2);
    pts=[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]]; n.kind='rect';
    if (sh==='rounded rectangle') n.kind='rrect';
    if (sh==='rectangle callout'){ pts=[[-hw,-hh],[-hw*.3,-hh],[-hw*.6,-hh*2.2],[0,-hh],[hw,-hh],[hw,hh],[-hw,hh]]; n.kind='poly'; }
  }
  n.poly=pts;
  n.hw=Math.max(...pts.map(p=>Math.abs(p[0]))); n.hh=Math.max(...pts.map(p=>Math.abs(p[1])));
}
function borderLocal(n, deg){
  const d=[Math.cos(deg*D2R), Math.sin(deg*D2R)];
  const os=n.osep;
  if (n.kind==='pt') return [0,0];
  if (n.kind==='ell'){ const t=1/Math.hypot(d[0]/n.rx, d[1]/n.ry); return [d[0]*(t+os), d[1]*(t+os)]; }
  // ray-poligono
  const pts=n.poly; let best=Infinity;
  for (let k=0;k<pts.length;k++){
    const a=pts[k], b=pts[(k+1)%pts.length];
    const e=[b[0]-a[0],b[1]-a[1]]; const den=d[0]*e[1]-d[1]*e[0]; if(Math.abs(den)<1e-12) continue;
    const t=(a[0]*e[1]-a[1]*e[0])/den, u=(a[0]*d[1]-a[1]*d[0])/den;
    if (t>=0 && u>=-1e-9 && u<=1+1e-9) best=Math.min(best,t);
  }
  if (!isFinite(best)) best=0;
  return [d[0]*(best+os), d[1]*(best+os)];
}
const COMPASS = {east:0,'north east':45,north:90,'north west':135,west:180,'south west':225,south:270,'south east':315};
function anchorLocal(n, name){
  name = (name||'center').trim();
  if (name==='center' || n.kind==='pt') return [0,0];
  if (n.kind==='cz'){ const a=czAnchor(n, name); if (a) return a; }
  const base = -n.th/2 + n.td;
  if (name==='base') return [0, base];
  if (name==='mid') return [0, base+.5*EX*(n.st.font||1)];
  if (name==='text') return [-n.tw/2, base];
  const m=/^(base|mid) (east|west)$/.exec(name);
  if (m){ const y=m[1]==='base'?base:base+.5*EX; const b=borderLocal(n, m[2]==='east'?0:180); return [b[0], y]; }
  if (COMPASS[name]!==undefined){
    const a=COMPASS[name];
    if ((n.kind==='rect'||n.kind==='rrect') && a%90){ const sx=Math.sign(Math.cos(a*D2R)), sy=Math.sign(Math.sin(a*D2R)); return [sx*(n.hw+n.osep), sy*(n.hh+n.osep)]; }
    if (n.kind==='ell' && a%90){ return borderLocal(n, Math.atan2(Math.sin(a*D2R)*n.ry, Math.cos(a*D2R)*n.rx)/D2R); }
    return borderLocal(n, a);
  }
  const num = parseFloat(name);
  if (!isNaN(num)) return borderLocal(n, num);
  if (/^corner (\d+)$/.test(name) && n.poly){ const k=+name.split(' ')[1]-1; return n.poly[k%n.poly.length]||[0,0]; }
  if (/^side (\d+)$/.test(name) && n.poly){ const k=+name.split(' ')[1]-1; const a=n.poly[k%n.poly.length], b=n.poly[(k+1)%n.poly.length]; return V.lerp(a,b,.5); }
  return null;
}
const toPage = (n, loc) => V.add(n.c, V.rot(loc, n.rot));
function nodeAnchor(n, name){ const l=anchorLocal(n,name); return l ? toPage(n,l) : null; }
function nodeBorderToward(n, p){
  if (n.kind==='pt') return n.c;
  const d=V.sub(p,n.c); if (V.len(d)<1e-9) return n.c;
  return toPage(n, borderLocal(n, V.ang(d)-n.rot));
}
/* costruzione del nodo: at = punto di ancoraggio in pagina */
function buildNode(st, text, at, ctx, frameRot=0){
  const n = {st, name:st.name, rot:st.nodeRot + (st.xform?frameRot:0) + (st._rot||0), text};
  const color = st.text || st.color;
  const t = text.trim();
  let r = t && st.shape!=='coordinate' ? renderTeX(t, st, color) : {w:0,h:0,d:0};
  if (r.err && !r.wait) ctx.warn('testo del nodo: '+r.err);
  n.r=r; n.tw=Math.max(r.w, st.textWidth); n.th=r.h+r.d; n.td=r.d;
  n.iw=n.tw/2+st.isep[0]; n.ih=n.th/2+st.isep[1];
  if (!t){ n.iw=st.isep[0]; n.ih=st.isep[1]; n.tw=n.th=n.td=0; }
  n.osep = st.osep!==null ? st.osep : !st.draw ? 0 : st.double ? st.lw+(st.ddist||.6*PT)/2 : st.lw/2;
  nodeGeom(n);
  // ancoraggio
  let anc = st.anchor || 'center';
  let p = at;
  if (st.place){
    const pl=PLACE[st.place.dir];
    if (st.place.of){
      const ref = R.names[st.place.of.trim()];
      if (!ref) ctx.warn('nodo «'+st.place.of+'» non trovato');
      else if (st.place.old){
        const d=st.nodeDist; p=V.add(ref.c||ref.p, [pl[0]*d, pl[1]*d]); anc='center';
      } else {
        const dist = st.place.dist || [st.nodeDist, st.nodeDistY];
        const dx = dist[0], dy = dist[1]===null||dist[1]===undefined ? dist[0] : dist[1];
        const diag = pl[0]&&pl[1];
        const refAnchor = {'above':'north','below':'south','left':'west','right':'east','above left':'north west','above right':'north east','below left':'south west','below right':'south east'}[st.place.dir];
        // on grid: le distanze si misurano tra i centri
        const rp = !ref.c ? ref.p : st.onGrid ? ref.c : nodeAnchor(ref, refAnchor);
        p = V.add(rp, diag ? [pl[0]*dx/Math.SQRT2*(st.place.dist&&st.place.dist[1]!=null?Math.SQRT2:1), pl[1]*dy/Math.SQRT2*(st.place.dist&&st.place.dist[1]!=null?Math.SQRT2:1)] : [pl[0]*dx, pl[1]*dy]);
        anc = st.onGrid ? 'center' : pl[2];
      }
    } else {
      anc = pl[2];
      if (st.place.dist){ const dx=st.place.dist[0], dy=st.place.dist[1]==null?dx:st.place.dist[1];
        const diag=pl[0]&&pl[1]; p = V.add(at, [pl[0]*dx, pl[1]*dy]); }
    }
  }
  n.c = [0,0];
  const al = anchorLocal(n, anc) || [0,0];
  n.c = V.sub(p, V.rot(al, n.rot));
  n.at = at;
  return n;
}
/* ---------- pittura ---------- */
function gradDef(st, fillc){
  const s=st.shade; const id='g'+(DEFN++);
  const c = k => css(s[k]||(k==='middle'?null:fillc)) ;
  if (s.type==='r'){
    DEFS.push(`<radialGradient id="${id}"><stop offset="0" stop-color="${css(s.inner||[1,1,1])}"/><stop offset="1" stop-color="${css(s.outer||[.5,.5,.5])}"/></radialGradient>`);
  } else if (s.type==='ball'){
    const b=s.ball||[0,0,1];
    DEFS.push(`<radialGradient id="${id}" cx=".4" cy=".35" r=".75" fx=".35" fy=".3"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${css(b)}"/><stop offset="1" stop-color="${css(b.map(v=>v*.25))}"/></radialGradient>`);
  } else {
    const h = s.type==='h';
    let a = s.angle!==undefined ? s.angle : 0;
    const c1 = h ? (s.left||[1,1,1]) : (s.bottom||[1,1,1]), c2 = h ? (s.right||[.5,.5,.5]) : (s.top||[.5,.5,.5]);
    let x1=0,y1=1,x2=0,y2=0; if (h){x1=0;y1=0;x2=1;y2=0;}
    if (s.angle){ const r=V.rot([0,1],s.angle); x1=.5-r[0]/2; y1=.5+r[1]/2; x2=.5+r[0]/2; y2=.5-r[1]/2; }
    const mid = s.middle ? `<stop offset=".5" stop-color="${css(s.middle)}"/>` : '';
    DEFS.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${css(c1)}"/>${mid}<stop offset="1" stop-color="${css(c2)}"/></linearGradient>`);
  }
  return `url(#${id})`;
}
function patDef(st){
  const id='p'+(DEFN++); const col=css(st.patColor||[0,0,0]); const w=.012, s=.1;
  const pt = st.pattern.replace(/[{}]/g,'').trim();
  let inner;
  switch(pt){
    case 'horizontal lines': inner=`<path d="M0 ${s/2}H${s}" stroke="${col}" stroke-width="${w}"/>`; break;
    case 'vertical lines': inner=`<path d="M${s/2} 0V${s}" stroke="${col}" stroke-width="${w}"/>`; break;
    case 'north west lines': inner=`<path d="M0 0L${s} ${s}M${-s/2} ${s/2}L${s/2} ${s*1.5}M${s/2} ${-s/2}L${s*1.5} ${s/2}" stroke="${col}" stroke-width="${w}"/>`; break;
    case 'grid': inner=`<path d="M0 ${s/2}H${s}M${s/2} 0V${s}" stroke="${col}" stroke-width="${w}"/>`; break;
    case 'crosshatch': inner=`<path d="M0 0L${s} ${s}M0 ${s}L${s} 0" stroke="${col}" stroke-width="${w}"/>`; break;
    case 'dots': case 'crosshatch dots': inner=`<circle cx="${s/2}" cy="${s/2}" r="${w*1.5}" fill="${col}"/>`; break;
    case 'fivepointed stars': case 'sixpointed stars': inner=`<circle cx="${s/2}" cy="${s/2}" r="${w*2.5}" fill="${col}"/>`; break;
    default: inner=`<path d="M0 ${s}L${s} 0M${-s/2} ${s/2}L${s/2} ${-s/2}M${s/2} ${s*1.5}L${s*1.5} ${s/2}" stroke="${col}" stroke-width="${w}"/>`;
  }
  DEFS.push(`<pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse">${inner}</pattern>`);
  return `url(#${id})`;
}
function paint(st, {forceFill=false, noDraw=false}={}){
  // ritorna {fill, stroke, attrs}
  const op = st.opacity;
  const dc = st.draw===true ? st.color : st.draw;
  let fc = st.fill===true ? st.color : st.fill;
  let fill='none', stroke='none', a='';
  if (fc && fc!=='none'){
    fill = st.shade ? gradDef(st, fc) : st.pattern ? patDef(st) : css(fc);
    const fo = op*st.fop; if (fo<1) a+=` fill-opacity="${fmt(fo)}"`;
    if (st.evenodd) a+=' fill-rule="evenodd"';
  } else if (st.shade && st.fill!=='none'){ fill = gradDef(st, st.color); }
  if (dc && dc!=='none' && !noDraw){
    stroke = css(dc);
    a += ` stroke-width="${fmt(st.lw,5)}"`;
    if (st.dash) a += ` stroke-dasharray="${st.dash.map(v=>v==='lw'?fmt(st.lw,5):fmt(v*PT,5)).join(' ')}"`;
    if (st.dash && st.dash[0]==='lw') a += ' stroke-linecap="round"';
    else if (st.cap!=='butt') a += ` stroke-linecap="${st.cap}"`;
    if (st.join!=='miter') a += ` stroke-linejoin="${st.join}"`;
    const so = op*st.dop; if (so<1) a+=` stroke-opacity="${fmt(so)}"`;
  }
  return {fill, stroke, a};
}
function nodeSVG(n, extra=''){
  const st=n.st; let out='';
  const pt = paint(st);
  const rot = n.rot ? ` transform="rotate(${fmt(-n.rot)} ${P(n.c).replace(' ',' ')})"` : '';
  const loc = p => V.add(n.c, p);
  if (n.kind==='cz') out += czNodeSVG(n);
  else if (n.kind!=='pt' && (pt.fill!=='none' || pt.stroke!=='none')){
    let d, el;
    if (n.kind==='ell'){ const c=n.c; d=`M${fmt(c[0]+n.rx,4)} ${fmt(-c[1],4)}A${fmt(n.rx,4)} ${fmt(n.ry,4)} 0 1 0 ${fmt(c[0]-n.rx,4)} ${fmt(-c[1],4)}A${fmt(n.rx,4)} ${fmt(n.ry,4)} 0 1 0 ${fmt(c[0]+n.rx,4)} ${fmt(-c[1],4)}Z`; }
    else if (n.kind==='rrect'){ const r=n.hh; d=`M${P(loc([-n.hw+r,-n.hh]))}H${fmt(n.c[0]+n.hw-r,4)}A${r} ${r} 0 0 0 ${P(loc([n.hw-r,n.hh]))}H${fmt(n.c[0]-n.hw+r,4)}A${r} ${r} 0 0 0 ${P(loc([-n.hw+r,-n.hh]))}Z`; }
    else if (st.rounded>0 && n.kind==='rect'){ const r=Math.min(st.rounded,n.hw,n.hh); el=(f,s,a)=>`<rect x="${fmt(n.c[0]-n.hw,4)}" y="${fmt(-n.c[1]-n.hh,4)}" width="${fmt(2*n.hw,4)}" height="${fmt(2*n.hh,4)}" rx="${fmt(r,4)}" fill="${f}" stroke="${s}"${a}${rot}/>`; }
    else d = ptsPath(n.poly.map(loc));
    if (!el) el=(f,s,a)=>`<path d="${d}" fill="${f}" stroke="${s}"${a}${rot}/>`;
    if (st.double && pt.stroke!=='none'){
      // bordo doppio (accepting): tratto largo e anima del colore di double
      const dd=st.ddist||.6*PT;
      out += el(pt.fill, pt.stroke, pt.a.replace(/stroke-width="[^"]*"/, `stroke-width="${fmt(2*st.lw+dd,5)}"`)) + el('none', css(st.double), ` stroke-width="${fmt(dd,5)}"`);
    } else out += el(pt.fill, pt.stroke, pt.a);
    if (st.shape==='circle cross' || st.shape==='cross out'){ const a=n.kind==='ell'?n.rx*.707:n.hw, b=n.kind==='ell'?n.ry*.707:n.hh; out+=`<path d="M${P(loc([-a,-b]))}L${P(loc([a,b]))}M${P(loc([-a,b]))}L${P(loc([a,-b]))}" stroke="${pt.stroke==='none'?css(st.color):pt.stroke}" stroke-width="${fmt(st.lw,5)}"${rot}/>`; }
    if (st.shape==='circle split'){ out+=`<path d="M${P(loc([-n.rx,0]))}L${P(loc([n.rx,0]))}" stroke="${pt.stroke}" stroke-width="${fmt(st.lw,5)}"${rot}/>`; }
  }
  if (n.r && (n.r.inner || n.r.plain) && n.tw+n.th>0){
    const tc = st.text || st.color;
    let x = n.c[0]-n.r.w/2;
    if (st.textWidth && st.align==='left') x = n.c[0]-n.tw/2;
    if (st.textWidth && st.align==='right') x = n.c[0]+n.tw/2-n.r.w;
    const y = -n.c[1]-n.th/2;
    out += `<g${rot}>`+texSVG(n.r, fmt(x,4), fmt(y,4), tc, st.opacity*st.top)+'</g>';
  }
  return out;
}
/* ---------- frecce ---------- */
function tipInfo(spec, st, isStart){
  // spec testuale → {kind, L, W, rev, n}
  let s = spec.trim(); if (!s) return null;
  let opts = ''; let m;
  s = s.replace(/^\{|\}$/g,'');
  if ((m=/\[(.*)\]$/.exec(s))){ opts=m[1]; s=s.slice(0,m.index).trim(); }
  let rev=false, n=1, sw=false;
  if (/^[<>]+$/.test(s)){ const want=isStart?'<':'>'; rev = s[0]!==want; n=s.length; s=st.arrowDef.replace(/[{}]/g,'').replace(/\[.*\]$/,'').trim()||'to'; }
  const lwp = st.lw/PT;
  let L = (3.2 + 2.2*lwp)*PT, W = L*.8;
  const k = s.replace(/'/,'');
  let kind = {latex:'latex',Latex:'latex',stealth:'stealth',Stealth:'stealth',to:'to',To:'to',Triangle:'tri','triangle 45':'tri','triangle 60':'tri','triangle 90':'tri','|':'bar',Bar:'bar',o:'circ',Circle:'dot','*':'dot',Square:'sq',Diamond:'dia',Kite:'dia','Straight Barb':'to','Arc Barb':'to',Hooks:'hook',hooks:'hook',Rays:'bar',Implies:'to','Classical TikZ Rightarrow':'to'}[k] || 'to';
  if (kind==='stealth'){ L*=1.1; W=L*.85; }
  if (kind==='to'){ L=(1.6+1.6*lwp)*PT; W=L*2.4; }
  if (kind==='circ'||kind==='dot'){ L=W=(2.4+1.5*lwp)*PT; }
  if (kind==='bar'){ L=st.lw; W=(4+2*lwp)*PT; }
  if (opts){
    for (const {k:ok,v} of parseOptList(opts)){
      try{
        if (ok==='length') L=evalLen(v.split(/\s/)[0],{},PT);
        else if (ok==='width') W=evalLen(v.split(/\s/)[0],{},PT);
        else if (ok==='scale'){ L*=+v; W*=+v; }
        else if (ok==='scale length') L*=+v; else if (ok==='scale width') W*=+v;
        else if (ok==='open') kind = kind==='dot'?'circ':kind+'-open';
        else if (ok==='reversed') rev=!rev;
        else if (ok==='swap') sw=!sw;
        else if (ok==='sep') {}
      }catch(e){}
    }
  }
  const back = (kind==='to'||kind==='bar') ? st.lw*.5 : (kind==='circ'||kind==='dot') ? L : L*.85;
  return {kind, L, W, rev, n, sw, back: back*n};
}
function tipSVG(t, p, ang, st){
  // p = punta (pagina), ang = direzione uscente (gradi)
  const col = css(st.draw===true?st.color:(st.draw||st.color));
  const op = st.opacity*st.dop<1 ? ` opacity="${fmt(st.opacity*st.dop)}"` : '';
  let out='';
  for (let j=0;j<t.n;j++){
    let tip = V.sub(p, V.pol(ang, j*t.L*.75));
    let a = ang;
    if (t.rev){ tip = V.sub(tip, V.pol(ang, t.L)); a = ang+180; }
    const T = (x,y)=> V.add(tip, V.rot([x,y], a));
    const L=t.L, W=t.W, lw=fmt(st.lw,5);
    const kind = t.kind.replace('-open','');
    const open = t.kind.endsWith('-open');
    const fillA = open ? `fill="#fff" stroke="${col}" stroke-width="${lw}"` : `fill="${col}"`;
    switch(kind){
      case 'latex': out+=`<path d="M${P(T(0,0))}C${P(T(-L*.35,W*.12))} ${P(T(-L*.8,W*.35))} ${P(T(-L,W/2))}L${P(T(-L,-W/2))}C${P(T(-L*.8,-W*.35))} ${P(T(-L*.35,-W*.12))} ${P(T(0,0))}Z" ${fillA}${op}/>`; break;
      case 'stealth': out+=`<path d="M${P(T(0,0))}L${P(T(-L,W/2))}L${P(T(-L*.72,0))}L${P(T(-L,-W/2))}Z" ${fillA} stroke-linejoin="miter"${op}/>`; break;
      case 'tri': out+=`<path d="M${P(T(0,0))}L${P(T(-L,W/2))}L${P(T(-L,-W/2))}Z" ${fillA}${op}/>`; break;
      case 'to': out+=`<path d="M${P(T(-L,W/2))}C${P(T(-L*.5,W*.15))} ${P(T(-L*.05,W*.03))} ${P(T(st.lw*.3,0))}C${P(T(-L*.05,-W*.03))} ${P(T(-L*.5,-W*.15))} ${P(T(-L,-W/2))}" fill="none" stroke="${col}" stroke-width="${fmt(st.lw*.9,5)}" stroke-linecap="round" stroke-linejoin="round"${op}/>`; break;
      case 'bar': out+=`<path d="M${P(T(0,W/2))}L${P(T(0,-W/2))}" stroke="${col}" stroke-width="${lw}"${op}/>`; break;
      case 'circ': { const c=T(-L/2,0); out+=`<circle cx="${fmt(c[0],4)}" cy="${fmt(-c[1],4)}" r="${fmt(L/2-st.lw/2,4)}" fill="#fff" stroke="${col}" stroke-width="${lw}"${op}/>`; break; }
      case 'dot': { const c=T(-L/2,0); out+=`<circle cx="${fmt(c[0],4)}" cy="${fmt(-c[1],4)}" r="${fmt(L/2,4)}" fill="${col}"${op}/>`; break; }
      case 'sq': out+=`<path d="M${P(T(0,L/2))}L${P(T(0,-L/2))}L${P(T(-L,-L/2))}L${P(T(-L,L/2))}Z" ${fillA}${op}/>`; break;
      case 'dia': out+=`<path d="M${P(T(0,0))}L${P(T(-L/2,W/2))}L${P(T(-L,0))}L${P(T(-L/2,-W/2))}Z" ${fillA}${op}/>`; break;
      case 'hook': out+=`<path d="M${P(T(0,0))}A${fmt(W/3,4)} ${fmt(W/3,4)} 0 0 ${t.sw?0:1} ${P(T(0,t.sw?-W*.66:W*.66))}" fill="none" stroke="${col}" stroke-width="${lw}"${op}/>`; break;
    }
  }
  return out;
}
