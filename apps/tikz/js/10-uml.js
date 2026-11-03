/* ============ TIKZ-UML: classi, note, pacchetti, casi d'uso, stati, relazioni ============ */
const UML_DEF = {text:'black', draw:'black', font:'\\small', 'fill class':'yellow!20', 'fill template':'yellow!2', 'fill package':'blue!20',
  'fill note':'green!10', 'fill usecase':'blue!20', 'fill system':'white', 'fill state':'yellow!20', 'fill object':'yellow!20',
  'fill call':'white', 'fill fragment':'none', 'fill component':'yellow!20'};
function umlState(){ return R.uml || (R.uml = {cfg:{...UML_DEF}, stack:[], num:{}}); }

/* punte: [inizio, fine, tratteggio, stereotipo] */
const UML_ARR = 'to[scale=1.3]', UML_OTRI = 'Triangle[open, length=8pt, width=8pt]';
const UML_ODIA = 'Diamond[open, length=10pt, width=6pt]', UML_FDIA = 'Diamond[length=10pt, width=6pt]';
const UML_REL = {assoc:['',''], uniassoc:['',UML_ARR], aggreg:[UML_ODIA,''], uniaggreg:[UML_ODIA,UML_ARR], compo:[UML_FDIA,''], unicompo:[UML_FDIA,UML_ARR],
  inherit:['',UML_OTRI], impl:['',UML_OTRI,1], real:['',UML_OTRI,1], dep:['',UML_ARR,1], import:['',UML_ARR,1,'import'],
  include:['',UML_ARR,1,'include'], extend:['',UML_ARR,1,'extend'], nest:['','Circle[open, length=7pt]'], relation:['',''], trans:['',UML_ARR],
  assemblyconnector:['',''], delegateconnector:['',UML_ARR,0,'delegate']};
const UML_SYNC = 'Triangle[length=6pt, width=5pt]';
const UML_GEOM = {HV:'-|', VH:'|-', HVH:'-|-', VHV:'|-|'};
const UML_REL_RE = /^uml(HVH|VHV|HV|VH)?(assoc|uniassoc|aggreg|uniaggreg|compo|unicompo|inherit|impl|real|dep|import|include|extend|nest|relation|trans|assemblyconnector|delegateconnector)$/;
const UML_CLASS_RE = /^uml(class|abstract|interface|typedef|enum|simpleclass|emptyclass)$/;
const UML_GLYPHS = ['object','actor','database','multi','entity','boundary','control'];
const UML_ARGS = {note:2, actor:1, usecase:1, basicstate:1, stateinitial:0, statefinal:0, statedecision:0, statejoin:0,
  object:1, database:1, multi:1, entity:1, boundary:1, control:1, createcall:2, fpart:0,
  basiccomponent:1, providedinterface:1, requiredinterface:1, port:2};
const UML_LABELS = {class:['nome','attributi','operazioni'], note:['nodo collegato','testo'], actor:['nome'], usecase:['testo'], basicstate:['testo'], rel:['da','a'],
  seqobj:['nome'], createcall:['da','nuovo oggetto'], basiccomponent:['nome'], providedinterface:['componente'], requiredinterface:['componente'], port:['componente','ancora']};
const UML_KEYS = new Set(['x','y','name','alias','anchor','width','type','template','scale','tags','geometry','style',
  'arg1','arg2','arg','mult1','mult2','mult','pos1','pos2','pos','attr1','attr2','attr','align1','align2','align','anchor1','anchor2',
  'angle1','angle2','loopsize','arm1','arm2','weight','stereo','pos stereo','recursive','recursive direction','recursive mode',
  'class','glyph','op','return','dt','padding','label','inner xsep','interface','distance','with port','removeComponent']);
const UML_AW = .25;   // larghezza delle barre di attivazione

/* opzioni con la posizione dei valori nel sorgente */
function umlOptItems(op){
  const out=[]; if (!op) return out;
  let d=0, st=op.s+1;
  const push=(x,y)=>{
    const t=S.slice(x,y).trim(); if (!t) return;
    let eq=-1, dd=0;
    for (let k=x;k<y;k++){ const c=S[k]; if('{(['.includes(c)) dd++; else if('})]'.includes(c)) dd--; else if(c==='='&&dd===0){ eq=k; break; } }
    if (eq<0) out.push({k:t.replace(/\s+/g,' '), v:null});
    else out.push({k:S.slice(x,eq).trim().replace(/\s+/g,' '), v:unbrace(S.slice(eq+1,y)), vs:eq+1, ve:y});
  };
  for (let k=op.s+1;k<op.e;k++){ const c=S[k]; if(c==='\\'){ k++; continue; } if('{(['.includes(c)) d++; else if('})]'.includes(c)) d--; else if(c===','&&d===0){ push(st,k); st=k+1; } }
  push(st, op.e);
  return out;
}

/* ---------- comando tikz-uml ---------- */
function umlCmd(i, name, j, b, ctx){
  if (name==='tikzumlset'){
    const g=readGroup(j); if (!g) return j;
    const cfg=umlState().cfg; for (const {k,v} of parseOptList(subVars(g.text, ctx.vars))) if (v!==null) cfg[k]=v;
    return g.e+1;
  }
  let kind, sub, nargs;
  const mr=UML_REL_RE.exec(name), mc=UML_CLASS_RE.exec(name), base=name.slice(3);
  if (mr){ kind='rel'; nargs=2; }
  else if (mc){ kind='class'; sub=mc[1]; nargs = /simple|empty/.test(sub) ? 1 : 3; }
  else if (UML_ARGS[base]!==undefined){ kind=base; nargs=UML_ARGS[base]; if (UML_GLYPHS.includes(base) && (base!=='actor' || umlState().seq)){ kind='seqobj'; sub=base; } }
  else {
    ctx.warn('comando tikz-uml \\'+name+' non supportato');
    let k=j; for (let n=0;n<4;n++){ const jj=skipWS(k,b); if(S[jj]==='{'||S[jj]==='['){ const e=mcS(jj); if(e<0) break; k=e+1; } else break; }
    return k;
  }
  const op=readOpt(j); let k = op ? op.e+1 : j;
  const groups=[];
  for (let n=0;n<nargs;n++){ const g=readGroup(k); if (!g){ mkWarn(i,'e')(`\\${name}: ${nargs===1?'atteso 1 argomento':'attesi '+nargs+' argomenti'} tra graffe`); return k; } groups.push(g); k=g.e+1; }
  if (ctx.collectOnly) return k;
  if (kind==='fpart'){
    // separatore di un frammento combinato
    const seq=umlState().seq, f=seq && seq.frags[seq.frags.length-1];
    if (!f) ctx.warn('\\umlfpart fuori da un umlfragment');
    else { seq.t-=.2; f.parts.push({t:seq.t, text:op ? subVars(op.text, ctx.vars).trim() : ''}); seq.t-=.4; }
    return k;
  }
  if ((kind==='seqobj' || kind==='createcall') && !umlState().seq){ ctx.warn('\\'+name+' va usato dentro \\begin{umlseqdiag}'); return k; }
  const sIdx = stmtRec(i, k, name, j); const rec=R.stmts[sIdx];
  rec.opts = op ? {s:op.s, e:op.e} : null; rec.frame=ctx.frame;
  rec.uml = kind==='rel' ? 'rel' : 'el';
  const labels = UML_LABELS[kind] || [];
  rec.groups = groups.map((g,n)=>({s:g.s+1, e:g.e, label:labels[n]||''}));
  const items = umlOptItems(op), o={}; for (const it of items) o[it.k]=it;
  const txt = groups.map(g=>subVars(g.text, ctx.vars));
  try {
    if (kind==='rel') umlRelation(mr[2], UML_GEOM[mr[1]]||null, o, items, txt, ctx, sIdx);
    else if (kind==='class') umlClass(sub, o, items, txt, ctx, sIdx);
    else if (kind==='seqobj') umlSeqObject(o.glyph&&o.glyph.v ? o.glyph.v.trim() : sub, o, items, txt, ctx, sIdx, null);
    else if (kind==='createcall') umlSeqCreate(o, items, txt, ctx, sIdx);
    else if (/interface$|^port$/.test(kind)) umlIface(kind, o, items, txt, ctx, sIdx);
    else umlElement(kind, o, items, txt, ctx, sIdx);
  } catch(err){ mkWarn(i,'e')(err.message||String(err)); if(!(err instanceof MathErr)) console.error(err); }
  return k;
}

/* ---------- utilità ---------- */
function umlStyle(ctx, fillKey, items){
  const cfg=umlState().cfg;
  const st=nodeBaseStyle(ctx.style, ctx, 'node');
  st.draw=parseColor(cfg.draw)||[0,0,0]; st.color=parseColor(cfg.text)||[0,0,0];
  st.fill = fillKey ? (parseColor(cfg[fillKey])||[1,1,1]) : undefined;
  applyKey(st, 'font', cfg.font, ctx, 0);
  for (const it of items) if (!UML_KEYS.has(it.k)) applyKey(st, it.k, it.v, ctx, 0);
  st.osep = st.draw && st.draw!=='none' ? st.lw/2 : 0;
  return st;
}
function umlMacros(t){ return t.replace(/\\umlstatic\s*\{/g,'\\underline{').replace(/\\umlvirt\s*\{/g,'\\textit{').replace(/\s+/g,' ').trim(); }
function umlText(text, st, align, ctx){
  const t=umlMacros(text); if (!t) return null;
  const r=renderTeX(t, {...st, align, mathNode:false}, st.text||st.color);
  if (r.err && !r.wait) ctx.warn('testo UML: '+r.err);
  return r;
}
function umlWrap(text, maxW, st){
  // a capo automatico (come text width) se il testo non ha già \\
  text=umlMacros(text);
  if (!maxW || /\\\\/.test(text) || renderTeX(text, st, st.color).w<=maxW) return text;
  const lines=[]; let cur='';
  for (const w of splitTop(text,' ').filter(Boolean)){
    const t = cur ? cur+' '+w : w;
    if (cur && renderTeX(t, st, st.color).w>maxW){ lines.push(cur); cur=w; } else cur=t;
  }
  if (cur) lines.push(cur);
  return lines.join(' \\\\ ');
}
function umlDrawText(r, x, yTop, st){ return r ? texSVG(r, fmt(x,4), fmt(-yTop,4), st.text||st.color, st.opacity*st.top) : ''; }
function umlNode(st, hw, hh, kind='rect'){
  return {st, rot:0, kind, hw, hh, rx:hw, ry:hh, osep:st.osep||0, tw:0, th:0, td:0, c:[0,0], poly: kind==='poly' ? [[hw,0],[0,hh],[-hw,0],[0,-hh]] : [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]]};
}
function umlPlace(n, at, anc){ const al=anchorLocal(n, anc||'center')||[0,0]; n.c=V.sub(at, al); n.at=at; return n; }
function umlAt(o, ctx, sIdx){
  const num = it => it ? lenCm(it.v, ctx) : 0;
  const p = ctx.frame.map(num(o.x), num(o.y));
  const lx = o.x && litSpan(S.slice(o.x.vs, o.x.ve), o.x.vs), ly = o.y && litSpan(S.slice(o.y.vs, o.y.ve), o.y.vs);
  if (lx && ly) addHandle({kind:'abs', x:lx, y:ly, frame:ctx.frame}, p, sIdx);
  return p;
}
function umlRegister(n, names, box){
  for (const nm of names) if (nm) R.names[nm]=n;
  n.name = names.find(Boolean) || null;
  const st=umlState().stack; if (st.length) st[st.length-1].push(box || [n.c[0]-n.hw, n.c[1]-n.hh, n.c[0]+n.hw, n.c[1]+n.hh]);
}
function umlAutoName(kind){ const num=umlState().num; num[kind]=(num[kind]||0)+1; return kind+'-'+num[kind]; }
const umlPlain = t => t.replace(/\$|\\[a-zA-Z]+\s?|[{}]/g,'').trim();
const umlRect = (x0,y0,x1,y1) => `M${fmt(x0,4)} ${fmt(-y1,4)}H${fmt(x1,4)}V${fmt(-y0,4)}H${fmt(x0,4)}Z`;
function umlPathSVG(d, st, extra=''){ const pt=paint(st); return `<path d="${d}" fill="${pt.fill}" stroke="${pt.stroke}"${pt.a}${extra}/>`; }
function umlEmit(ctx, sIdx, body, n){
  const hb = n ? `<rect class="hitf" fill="transparent" x="${fmt(n.c[0]-n.hw,4)}" y="${fmt(-n.c[1]-n.hh,4)}" width="${fmt(2*n.hw,4)}" height="${fmt(2*n.hh,4)}"/>` : '';
  const clip = ctx.scope.clip ? ` clip-path="url(#${ctx.scope.clip})"` : '';
  if (n && n.name) R.stmts[sIdx].umlName = n.name;
  emit(ctx, `<g data-s="${sIdx}"${clip}>${body}${hb}</g>`);
}
function umlArrow(pts, tip, dashed, ctx){
  const st=cloneStyle(ctx.style); st.draw=parseColor(umlState().cfg.draw)||[0,0,0]; st.fill=undefined; st.arrows=['', tip]; st.dash = dashed ? [3,3] : null;
  return pathSVG({st, subs:[{start:pts[0], ops:pts.slice(1).map(p=>({t:'L', p})), closed:false}], extraSVG:[], edges:[], nodes:[]}, ctx).svg;
}
function umlLabel(text, p, anchor, ctx){
  if (!text) return '';
  const cfg=umlState().cfg, lst=nodeBaseStyle(ctx.style, ctx, 'node');
  applyKey(lst, 'font', cfg.font, ctx, 0); lst.color=parseColor(cfg.text)||[0,0,0]; lst.isep=[2*PT, 2*PT]; lst.anchor=anchor;
  return nodeSVG(buildNode(lst, text, p, ctx));
}
/* icona del componente (rettangolo con due linguette), angolo in alto a sinistra in (x,y) */
function umlCompIcon(x, y, st){
  const r = (x0,y0,w,h) => umlPathSVG(umlRect(x0, y0-h, x0+w, y0), st);
  return r(x+.07, y, .28, .38) + r(x, y-.07, .14, .08) + r(x, y-.23, .14, .08);
}

/* ---------- classi ---------- */
function umlClass(sub, o, items, txt, ctx, sIdx){
  const type = sub==='class' ? (o.type&&o.type.v ? o.type.v.trim() : 'class') : /simple|empty/.test(sub) ? 'class' : sub;
  const st=umlStyle(ctx, 'fill class', items);
  const [ix, iy] = st.isep;
  const title = txt[0].trim();
  const stereo = {interface:'interface', typedef:'typedef', enum:'enumeration'}[type];
  const nm = title.includes('$') ? title : (type==='abstract' ? '\\textit{'+title+'}' : '\\textbf{'+title+'}');
  const parts = [{t:(stereo?'«'+stereo+'» \\\\ ':'')+nm, al:'center'}];
  if (sub!=='simpleclass' && sub!=='emptyclass'){ parts.push({t:txt[1], al:'left'}, {t:txt[2], al:'left'}); }
  const rs = parts.map(p=>umlText(p.t, st, p.al, ctx));
  const minW = o.width ? lenCm(o.width.v, ctx) : 10*EX;
  const W = Math.max(minW, ...rs.map(r=>r ? r.w+2*ix : 0));
  const hs = rs.map(r=>r ? r.h+r.d+2*iy : .6*EX*st.font+2*iy);
  const H = hs.reduce((a,b)=>a+b, 0);
  const n = umlPlace(umlNode(st, W/2, H/2), umlAt(o, ctx, sIdx), o.anchor ? o.anchor.v : 'north');
  const x0=n.c[0]-W/2, x1=n.c[0]+W/2, top=n.c[1]+H/2;
  let svg = umlPathSVG(umlRect(x0, top-H, x1, top), st), y=top;
  const pt=paint(st);
  rs.forEach((r,k)=>{
    if (k) svg += `<path d="M${fmt(x0,4)} ${fmt(-y,4)}H${fmt(x1,4)}" fill="none" stroke="${pt.stroke}"${pt.a}/>`;
    if (r) svg += umlDrawText(r, parts[k].al==='center' ? n.c[0]-r.w/2 : x0+ix, y-iy, st);
    y -= hs[k];
  });
  if (o.template && o.template.v){
    const tst=cloneStyle(st); tst.fill=parseColor(umlState().cfg['fill template'])||[1,1,1]; tst.dash=[3,3];
    const r=umlText(o.template.v, tst, 'center', ctx);
    if (r){ const tw=r.w+2*ix, th=r.h+r.d+2*iy, tx=x1-tw*.6, ty=top+th/2;
      svg += umlPathSVG(umlRect(tx, ty-th, tx+tw, ty), tst) + umlDrawText(r, tx+ix, ty-iy, tst); }
  }
  umlRegister(n, [o.name&&o.name.v, o.alias&&o.alias.v, title.includes('$')?null:title]);
  umlEmit(ctx, sIdx, svg, n);
}

/* ---------- note, attori, casi d'uso, stati ---------- */
function umlElement(kind, o, items, txt, ctx, sIdx){
  const cfg=umlState().cfg;
  const at=umlAt(o, ctx, sIdx);
  const anc=o.anchor ? o.anchor.v : 'center';
  const nm = o.name&&o.name.v;
  let svg='', n, names=[nm], box=null;
  if (kind==='note'){
    const st=umlStyle(ctx, 'fill note', items); const [ix,iy]=st.isep;
    const tw = o.width ? lenCm(o.width.v, ctx) : 3;
    const f=.25;  // piega dell'angolo
    const r=umlText(umlWrap(txt[1], tw-f, {...st, align:'left'}), st, 'left', ctx);
    const W=Math.max(tw+2*ix, r?r.w+2*ix+f:0), H=Math.max((r?r.h+r.d:EX)+2*iy, 2*f);
    n=umlPlace(umlNode(st, W/2, H/2), at, anc);
    const [cx,cy]=n.c, x0=cx-W/2, x1=cx+W/2, y0=cy-H/2, y1=cy+H/2;
    const tgt=R.names[txt[0].trim()];
    if (txt[0].trim() && !tgt) ctx.warn('nodo «'+txt[0].trim()+'» non definito');
    if (tgt){ const lst=cloneStyle(st); lst.dash=[3,3]; const a=nodeBorderToward(n, tgt.c), b=nodeBorderToward(tgt, n.c);
      svg += `<path d="M${P(a)}L${P(b)}" fill="none" stroke="${css(lst.draw)}"${paint(lst).a}/>`; }
    svg += umlPathSVG(`M${fmt(x0,4)} ${fmt(-y0,4)}H${fmt(x1,4)}V${fmt(-(y1-f),4)}L${fmt(x1-f,4)} ${fmt(-y1,4)}H${fmt(x0,4)}Z`, st);
    svg += umlPathSVG(`M${fmt(x1-f,4)} ${fmt(-y1,4)}V${fmt(-(y1-f),4)}H${fmt(x1,4)}`, {...st, fill:'none'});
    svg += umlDrawText(r, x0+ix, y1-iy, st);
  } else if (kind==='actor'){
    const st=umlStyle(ctx, null, items); st.fill='none';
    const s = o.scale ? +evalExpr(o.scale.v, ctx.vars) : 1;
    n=umlPlace(umlNode(st, .3*s, .55*s), at, anc);
    const [cx,cy]=n.c, Q=(x,y)=>P([cx+x*s, cy+y*s]), hr=.13;
    svg += `<circle cx="${fmt(cx,4)}" cy="${fmt(-(cy+.42*s),4)}" r="${fmt(hr*s,4)}" fill="none" stroke="${css(st.draw)}"${paint(st).a}/>`;
    svg += umlPathSVG(`M${Q(0,.29)}L${Q(0,-.12)}M${Q(-.3,.15)}L${Q(.3,.15)}M${Q(-.25,-.55)}L${Q(0,-.12)}L${Q(.25,-.55)}`, st);
    const r=umlText(txt[0], st, 'center', ctx);
    if (r){ const ty=cy-.55*s-st.isep[1]; svg += umlDrawText(r, cx-r.w/2, ty, st); box=[Math.min(cx-.3*s, cx-r.w/2), ty-r.h-r.d, Math.max(cx+.3*s, cx+r.w/2), cy+.55*s]; }
    names=[nm, umlPlain(txt[0])];
  } else if (kind==='usecase'){
    const st=umlStyle(ctx, 'fill usecase', items); const [ix,iy]=st.isep;
    const tw = o.width ? lenCm(o.width.v, ctx) : 0;
    const r=umlText(umlWrap(txt[0], tw, {...st, align:'center'}), st, 'center', ctx);
    const rx=Math.max(((r?r.w:0)/2+ix)*Math.SQRT2, tw/2), ry=((r?r.h+r.d:EX)/2+iy)*Math.SQRT2;
    n=umlPlace(umlNode(st, rx, ry, 'ell'), at, anc);
    svg += `<ellipse cx="${fmt(n.c[0],4)}" cy="${fmt(-n.c[1],4)}" rx="${fmt(rx,4)}" ry="${fmt(ry,4)}" fill="${paint(st).fill}" stroke="${paint(st).stroke}"${paint(st).a}/>`;
    if (r) svg += umlDrawText(r, n.c[0]-r.w/2, n.c[1]+(r.h+r.d)/2, st);
    names=[nm || umlAutoName('usecase')];
  } else if (kind==='basicstate'){
    const st=umlStyle(ctx, 'fill state', items); const [ix,iy]=st.isep;
    const r=umlText(txt[0], st, 'center', ctx);
    const W=Math.max(o.width ? lenCm(o.width.v, ctx) : 0, (r?r.w:0)+4*ix), H=Math.max((r?r.h+r.d:EX)+2*iy, .6);
    n=umlPlace(umlNode(st, W/2, H/2), at, anc);
    const rr=Math.min(.2, H/2);
    svg += `<rect x="${fmt(n.c[0]-W/2,4)}" y="${fmt(-n.c[1]-H/2,4)}" width="${fmt(W,4)}" height="${fmt(H,4)}" rx="${rr}" fill="${paint(st).fill}" stroke="${paint(st).stroke}"${paint(st).a}/>`;
    if (r) svg += umlDrawText(r, n.c[0]-r.w/2, n.c[1]+(r.h+r.d)/2, st);
    names=[nm || umlAutoName('state')];
  } else if (kind==='basiccomponent'){
    const st=umlStyle(ctx, 'fill component', items); const [ix,iy]=st.isep;
    const t=txt[0].trim(), r=umlText(t.includes('$')?t:'\\textbf{'+t+'}', st, 'center', ctx);
    const W=Math.max(o.width ? lenCm(o.width.v, ctx) : 0, (r?r.w:0)+2*ix+.9, 2.2), H=Math.max((r?r.h+r.d:EX)+2*iy, 1.1);
    n=umlPlace(umlNode(st, W/2, H/2), at, anc);
    svg += umlPathSVG(umlRect(n.c[0]-W/2, n.c[1]-H/2, n.c[0]+W/2, n.c[1]+H/2), st);
    if (r) svg += umlDrawText(r, n.c[0]-r.w/2, n.c[1]+(r.h+r.d)/2, st);
    svg += umlCompIcon(n.c[0]+W/2-.5, n.c[1]+H/2-.12, st);
    names=[nm, umlPlain(t)];
  } else {
    // stati speciali
    const st=umlStyle(ctx, kind==='statedecision' ? 'fill state' : null, items);
    const black=parseColor(cfg.draw)||[0,0,0];
    const s = o.width ? lenCm(o.width.v, ctx)/2 : {stateinitial:.15, statefinal:.2, statedecision:.3, statejoin:.1}[kind];
    n=umlPlace(umlNode(st, s, s, kind==='statedecision' ? 'poly' : 'ell'), at, anc);
    const [cx,cy]=n.c, C=(r,f,strk)=>`<circle cx="${fmt(cx,4)}" cy="${fmt(-cy,4)}" r="${fmt(r,4)}" fill="${f}" stroke="${strk?css(black):'none'}"${strk?paint(st).a:''}/>`;
    if (kind==='stateinitial' || kind==='statejoin') svg += C(s, css(black), false);
    else if (kind==='statefinal') svg += C(s, '#fff', true) + C(s*.6, css(black), false);
    else svg += umlPathSVG(ptsPath(n.poly.map(p=>V.add(n.c,p))), st);
    names=[nm || umlAutoName(kind==='statedecision' ? 'decision' : kind==='statejoin' ? 'join' : kind==='statefinal' ? 'final' : 'initial')];
  }
  umlRegister(n, names, box);
  umlEmit(ctx, sIdx, svg, n);
}

/* ---------- ambienti: umlpackage, umlsystem, umlstate ---------- */
function umlEnv(i, env, j, endS, endE, ctx){
  const op=readOpt(j); let k = op ? op.e+1 : j;
  const g=readGroup(k); if (g) k=g.e+1;
  const sIdx=stmtRec(i, endE, env, j); const rec=R.stmts[sIdx];
  rec.opts = op ? {s:op.s, e:op.e} : null; rec.frame=ctx.frame; rec.uml='box';
  rec.groups = g ? [{s:g.s+1, e:g.e, label:'nome'}] : [];
  const items=umlOptItems(op), o={}; for (const it of items) o[it.k]=it;
  const U=umlState(), boxes=[]; U.stack.push(boxes);
  const out = ctx.layer==='bg' ? R.bg : R.out, at=out.length, h0=R.handles.length;
  run(k, endS, childCtx(ctx));
  U.stack.pop();
  // spostando il contenitore si sposta tutto il contenuto
  for (const h of R.handles.slice(h0)) if (!h.base) R.handles.push({...h, stmt:sIdx});
  const st=umlStyle(ctx, {umlpackage:'fill package', umlsystem:'fill system', umlstate:'fill state', umlcomponent:'fill component'}[env], items);
  const [ix,iy]=st.isep, pad=.3;
  const title = g ? subVars(g.text, ctx.vars).trim() : '';
  const bold = env==='umlpackage' || env==='umlcomponent';
  const r = umlText(bold ? (title.includes('$')?title:'\\textbf{'+title+'}') : title, st, 'center', ctx);
  const rw=r?r.w:0, rh=r?r.h+r.d:0;
  let x0, y0, x1, y1;
  if (boxes.length){ x0=Math.min(...boxes.map(q=>q[0]))-pad; y0=Math.min(...boxes.map(q=>q[1]))-pad; x1=Math.max(...boxes.map(q=>q[2]))+pad; y1=Math.max(...boxes.map(q=>q[3]))+pad; }
  else { const p=ctx.frame.map(o.x?lenCm(o.x.v,ctx):0, o.y?lenCm(o.y.v,ctx):0); x0=p[0]-1; x1=p[0]+1; y0=p[1]-.6; y1=p[1]+.6; }
  let svg='', outer;
  if (env==='umlpackage'){
    const tw=Math.max(rw+2*ix, 1), th=rh+2*iy;
    x1=Math.max(x1, x0+tw+.3);
    svg += umlPathSVG(umlRect(x0, y1, x0+tw, y1+th), st) + umlPathSVG(umlRect(x0, y0, x1, y1), st);
    if (r) svg += umlDrawText(r, x0+ix, y1+th-iy, st);
    outer=[x0, y0, x1, y1+th];
  } else if (env==='umlcomponent'){
    const th = Math.max(rh+2*iy, .6);
    y1 += th; x1=Math.max(x1, x0+rw+2*ix+.8);
    svg += umlPathSVG(umlRect(x0, y0, x1, y1), st) + umlCompIcon(x1-.5, y1-.12, st);
    if (r) svg += umlDrawText(r, x0+ix, y1-iy, st);
    outer=[x0, y0, x1, y1];
  } else {
    const th = r ? rh+2*iy : 0;
    y1 += th; x1=Math.max(x1, x0+rw+2*ix); const W=x1-x0;
    const pt=paint(st);
    svg += `<rect x="${fmt(x0,4)}" y="${fmt(-y1,4)}" width="${fmt(W,4)}" height="${fmt(y1-y0,4)}"${env==='umlstate'?' rx=".2"':''} fill="${pt.fill}" stroke="${pt.stroke}"${pt.a}/>`;
    if (r) svg += umlDrawText(r, (x0+x1)/2-rw/2, y1-iy, st);
    if (r && env==='umlstate') svg += `<path d="M${fmt(x0,4)} ${fmt(-(y1-th),4)}H${fmt(x1,4)}" fill="none" stroke="${pt.stroke}"${pt.a}/>`;
    outer=[x0, y0, x1, y1];
  }
  const n=umlNode(st, (x1-x0)/2, (y1-y0)/2); n.c=[(x0+x1)/2, (y0+y1)/2];
  umlRegister(n, [o.name&&o.name.v, umlPlain(title)], outer);
  rec.umlName = n.name;
  const clip = ctx.scope.clip ? ` clip-path="url(#${ctx.scope.clip})"` : '';
  out.splice(at, 0, `<g data-s="${sIdx}"${clip}>${svg}</g>`);
}

/* ---------- relazioni ---------- */
function umlAnchorPt(n, v){ v=String(v).trim(); const a=parseFloat(v); return !isNaN(a) && /^-?[\d.]+$/.test(v) ? toPage(n, borderLocal(n, a)) : nodeAnchor(n, v); }
function umlRelation(kind, geomFixed, o, items, txt, ctx, sIdx){
  const cfg=umlState().cfg, def=UML_REL[kind];
  const st=cloneStyle(ctx.style); st.draw=parseColor(cfg.draw)||[0,0,0]; st.color=parseColor(cfg.text)||[0,0,0]; st.fill=undefined;
  st.arrows=[def[0], def[1]]; if (def[2]) st.dash=[3,3];
  for (const it of items) if (!UML_KEYS.has(it.k)) applyKey(st, it.k, it.v, ctx, 0);
  if (o.style && o.style.v) applyOpts(st, o.style.v, ctx);
  const ref = t => { const nm=t.trim(); const n=R.names[nm]; if (!n) ctx.warn('nodo «'+nm+'» non definito'); return n; };
  const A=ref(txt[0]), B=ref(txt[1]); if (!A || !B) return;
  const num = (k, d) => o[k] && o[k].v!==null ? +evalExpr(o[k].v, ctx.vars) : d;
  const pA = o.anchor1 ? umlAnchorPt(A, o.anchor1.v) : null, pB = o.anchor2 ? umlAnchorPt(B, o.anchor2.v) : null;
  const cA = pA||A.c, cB = pB||B.c;
  const from = q => pA || nodeBorderToward(A, q), to = q => pB || nodeBorderToward(B, q);
  let segs; const loop = A===B || !!o.recursive;
  if (loop){
    // ricorsiva: recursive=a1|a2|dimensione oppure angle1, angle2, loopsize
    const rv = o.recursive && o.recursive.v ? o.recursive.v.split('|') : [];
    const a1 = rv[0]!==undefined ? +evalExpr(rv[0],ctx.vars) : num('angle1', -30), a2 = rv[1]!==undefined ? +evalExpr(rv[1],ctx.vars) : num('angle2', 30);
    const L = rv[2]!==undefined ? lenCm(rv[2],ctx) : o.loopsize ? lenCm(o.loopsize.v,ctx) : 3*UNIT.em;
    const a=pA||toPage(A, borderLocal(A, a1)), b=pB||toPage(B, borderLocal(B, a2));
    segs=[{k:'C', a, c1:V.add(a, V.pol(a1, L)), c2:V.add(b, V.pol(a2, L)), b}];
  } else {
    const geom = geomFixed || (o.geometry && o.geometry.v ? o.geometry.v.trim() : '--');
    let pts;
    if (geom==='-|'){ const c=[cB[0], cA[1]]; pts=[from(c), c, to(c)]; }
    else if (geom==='|-'){ const c=[cA[0], cB[1]]; pts=[from(c), c, to(c)]; }
    else if (geom==='-|-'){
      const m = o.arm1 ? cA[0]+lenCm(o.arm1.v,ctx) : o.arm2 ? cB[0]+lenCm(o.arm2.v,ctx) : cA[0]+num('weight',.5)*(cB[0]-cA[0]);
      const c1=[m, cA[1]], c2=[m, cB[1]]; pts=[from(c1), c1, c2, to(c2)];
    } else if (geom==='|-|'){
      const m = o.arm1 ? cA[1]+lenCm(o.arm1.v,ctx) : o.arm2 ? cB[1]+lenCm(o.arm2.v,ctx) : cA[1]+num('weight',.5)*(cB[1]-cA[1]);
      const c1=[cA[0], m], c2=[cB[0], m]; pts=[from(c1), c1, c2, to(c2)];
    } else {
      if (geom!=='--') ctx.warn('geometry «'+geom+'» non supportata: uso --');
      const a=from(cB); pts=[a, to(pA||cA)];
    }
    segs=pts.slice(1).map((p,k)=>({k:'L', a:pts[k], b:p}));
  }
  // etichette: arg a sinistra del verso di percorrenza, mult a destra
  const ns=segs.length; let labels='';
  const lab = (text, pos, left) => {
    if (!text) return;
    const t=clamp(pos, 0, ns), k=Math.min(ns-1, Math.floor(t)), q=segAt(segs[k], t-k);
    if (loop){ const nl=V.pol(q.ang+90, 1), d=V.sub(q.p, A.c); left = left === (nl[0]*d[0]+nl[1]*d[1] > 0); }  // arg all'esterno dell'anello
    const lst=nodeBaseStyle(ctx.style, ctx, 'node'); applyKey(lst, 'font', cfg.font, ctx, 0); lst.color=st.color; lst.isep=[2*PT, 2*PT];
    const a=q.ang+(left ? -90 : 90);
    lst.anchor=['east','north east','north','north west','west','south west','south','south east'][Math.round((((a%360)+360)%360)/45)%8];
    labels += nodeSVG(buildNode(lst, text, q.p, ctx));
  };
  const val = k => o[k] && o[k].v!==null ? o[k].v : '';
  const attr = k => val(k) ? val(k).split('|') : [];
  const side = (n, d) => {
    const at=attr('attr'+n), at2 = n===2 ? attr('attr') : [];
    const arg = val('arg'+n) || at[0] || (n===2 ? val('arg') || at2[0] : '') || '';
    const mult = val('mult'+n) || at[1] || (n===2 ? val('mult') || at2[1] : '') || '';
    const pos = num('pos'+n, n===2 ? num('pos', d) : d);
    lab(arg, pos, true); lab(mult, pos, false);
  };
  if (kind==='assemblyconnector'){
    // pallino (interfaccia fornita) e semicerchio (richiesta) a metà
    const t=ns/2, k=Math.min(ns-1, Math.floor(t)), q=segAt(segs[k], t-k), c=q.p, a=q.ang;
    const arc = V.add(c, V.pol(a-90, .22)), arc2 = V.add(c, V.pol(a+90, .22));
    labels += `<circle cx="${fmt(c[0],4)}" cy="${fmt(-c[1],4)}" r=".24" fill="#fff" stroke="none"/>`;
    labels += `<path d="M${P(arc)}A.22 .22 0 0 1 ${P(arc2)}" fill="none" stroke="${css(st.draw)}" stroke-width="${fmt(st.lw,5)}"/>`;
    labels += `<circle cx="${fmt(c[0],4)}" cy="${fmt(-c[1],4)}" r=".13" fill="#fff" stroke="${css(st.draw)}" stroke-width="${fmt(st.lw,5)}"/>`;
    if (val('interface')) labels += umlLabel(val('interface'), V.add(c, V.pol(a+90, .25)), ['east','north east','north','north west','west','south west','south','south east'][Math.round((((a-90)%360+360)%360)/45)%8], ctx);
    if (o['with port']) for (const p of [segs[0].a, segs[ns-1].b]) labels += umlPathSVG(umlRect(p[0]-.1, p[1]-.1, p[0]+.1, p[1]+.1), {...st, fill:[1,1,1]});
  }
  if (kind==='trans'){ lab(val('arg'), num('pos', ns/2), true); }
  else { side(1, .2); side(2, ns-.2); }
  const stereo = val('stereo') || def[3];
  if (stereo) lab('«'+stereo+'»', num('pos stereo', ns/2), true);
  const ps = {st, subs:[{start:segs[0].a, ops:segs.map(s=>s.k==='L' ? {t:'L', p:s.b} : {t:'C', c1:s.c1, c2:s.c2, p:s.b}), closed:false}], extraSVG:[], edges:[], nodes:[]};
  umlEmit(ctx, sIdx, pathSVG(ps, ctx).svg + labels, null);
}

/* ---------- componenti: interfacce e porte ---------- */
function umlIface(kind, o, items, txt, ctx, sIdx){
  const cn=txt[0].trim(), C=R.names[cn];
  if (!C){ ctx.warn('componente «'+cn+'» non definito'); return; }
  const st=umlStyle(ctx, null, items); st.fill=[1,1,1];
  const pt=paint(st);
  let svg='', n;
  if (kind==='port'){
    const an=txt[1].trim(), a=nodeAnchor(C, an);
    if (!a){ ctx.warn('ancora «'+an+'» sconosciuta'); return; }
    n=umlPlace(umlNode(st, .1, .1), a, 'center');
    svg += umlPathSVG(umlRect(a[0]-.1, a[1]-.1, a[0]+.1, a[1]+.1), st);
    umlRegister(n, [o.name&&o.name.v, cn+'-'+an+'-port']);
  } else {
    // fornita: pallino a destra; richiesta: semicerchio a sinistra
    const dir = kind==='providedinterface' ? 1 : -1, side = dir>0 ? 'east' : 'west';
    const d = o.distance ? lenCm(o.distance.v, ctx) : 1.5;
    const a = nodeAnchor(C, side), e = [a[0]+dir*d, a[1]];
    svg += `<path d="M${P(a)}L${P(e)}" fill="none" stroke="${pt.stroke}"${pt.a}/>`;
    if (o['with port']) svg += umlPathSVG(umlRect(a[0]-.1, a[1]-.1, a[0]+.1, a[1]+.1), st);
    let c;
    if (dir>0){ c=[e[0]+.15, e[1]]; svg += `<circle cx="${fmt(c[0],4)}" cy="${fmt(-c[1],4)}" r=".15" fill="${pt.fill}" stroke="${pt.stroke}"${pt.a}/>`; }
    else { c=[e[0]-.22, e[1]]; svg += `<path d="M${P([c[0],c[1]+.22])}A.22 .22 0 0 1 ${P([c[0],c[1]-.22])}" fill="none" stroke="${pt.stroke}"${pt.a}/>`; }
    if (o.interface && o.interface.v) svg += umlLabel(o.interface.v, [c[0], c[1]+.25], 'south', ctx);
    n=umlPlace(umlNode(st, .2, .2, 'ell'), c, 'center');
    umlRegister(n, [o.name&&o.name.v, cn+'-'+side+'-interface']);
  }
  umlEmit(ctx, sIdx, svg, n);
}

/* ---------- diagrammi di sequenza ---------- */
function umlSeqObject(glyph, o, items, txt, ctx, sIdx, yc){
  const seq=umlState().seq;
  if (!UML_GLYPHS.includes(glyph)){ ctx.warn('stereotipo «'+glyph+'» sconosciuto'); glyph='object'; }
  const st=umlStyle(ctx, 'fill object', items); const [ix,iy]=st.isep;
  const name=txt[0].trim(), cls=o.class&&o.class.v ? o.class.v.trim() : '';
  const boxed = glyph==='object' || glyph==='multi';
  const lt = name+(cls ? ' : '+cls : '');
  const r = umlText(boxed ? '\\underline{'+lt+'}' : lt, st, 'center', ctx);
  const prev = seq.objs[seq.order[seq.order.length-1]];
  const lx = o.x ? lenCm(o.x.v, ctx) : prev ? prev.lx+3.5 : 0;
  const p = [ctx.frame.map(lx, 0)[0], yc===null ? 0 : yc];
  const sx = o.x && litSpan(S.slice(o.x.vs, o.x.ve), o.x.vs);
  if (sx) addHandle({kind:'x', x:sx, frame:ctx.frame}, p, sIdx);
  const [cx,cy]=p, pt=paint(st);
  let svg='', n, bottom;
  if (boxed){
    const W=Math.max(1.4, (r?r.w:0)+2*ix+.2), H=(r?r.h+r.d:EX)+2*iy+.15;
    n=umlPlace(umlNode(st, W/2, H/2), p, 'center');
    if (glyph==='multi') svg += umlPathSVG(umlRect(cx-W/2+.12, cy-H/2+.12, cx+W/2+.12, cy+H/2+.12), st);
    svg += umlPathSVG(umlRect(cx-W/2, cy-H/2, cx+W/2, cy+H/2), st);
    if (r) svg += umlDrawText(r, cx-r.w/2, cy+(r.h+r.d)/2, st);
    bottom = cy-H/2;
  } else {
    // glifo sopra, nome sotto
    const g=[cx, cy+.15], C=(x,y,rr)=>`<circle cx="${fmt(x,4)}" cy="${fmt(-y,4)}" r="${rr}" fill="${pt.fill}" stroke="${pt.stroke}"${pt.a}/>`;
    const L=d=>`<path d="${d}" fill="none" stroke="${pt.stroke}"${pt.a}/>`, Q=(x,y)=>P([g[0]+x, g[1]+y]);
    if (glyph==='actor'){
      svg += `<circle cx="${fmt(g[0],4)}" cy="${fmt(-(g[1]+.28),4)}" r=".12" fill="none" stroke="${pt.stroke}"${pt.a}/>`;
      svg += L(`M${Q(0,.16)}L${Q(0,-.12)}M${Q(-.25,.06)}L${Q(.25,.06)}M${Q(-.2,-.4)}L${Q(0,-.12)}L${Q(.2,-.4)}`);
    } else if (glyph==='database'){
      const w=.3, h=.3, e=.08;
      svg += umlPathSVG(`M${Q(-w,h)}V${fmt(-(g[1]-h),4)}A${w} ${e} 0 0 0 ${Q(w,-h)}V${fmt(-(g[1]+h),4)}A${w} ${e} 0 0 0 ${Q(-w,h)}Z`, st);
      svg += `<ellipse cx="${fmt(g[0],4)}" cy="${fmt(-(g[1]+h),4)}" rx="${w}" ry="${e}" fill="${pt.fill}" stroke="${pt.stroke}"${pt.a}/>`;
    } else if (glyph==='entity'){ svg += C(g[0], g[1], .3) + L(`M${Q(-.3,-.32)}L${Q(.3,-.32)}`); }
    else if (glyph==='boundary'){ svg += L(`M${Q(-.55,.3)}V${fmt(-(g[1]-.3),4)}M${Q(-.55,0)}H${fmt(g[0]-.25,4)}`) + C(g[0]+.05, g[1], .3); }
    else if (glyph==='control'){ svg += C(g[0], g[1], .3) + L(`M${Q(.02,.3)}L${Q(-.1,.4)}M${Q(.02,.3)}L${Q(-.1,.2)}`); }
    const top=g[1]-.45;
    if (r) svg += umlDrawText(r, cx-r.w/2, top, st);
    bottom = top-(r?r.h+r.d:0);
    const hw=Math.max(.35, (r?r.w:0)/2);
    n=umlNode(st, hw, (g[1]+.42-bottom)/2); n.c=[cx, (g[1]+.42+bottom)/2];
  }
  seq.objs[name] = {x:cx, lx, bottom, sIdx};
  R.stmts[sIdx].seq = true;
  seq.order.push(name);
  if (!seq.started) seq.t=Math.min(seq.t, bottom-.3);
  umlRegister(n, [o.name&&o.name.v, umlPlain(name)]);
  umlEmit(ctx, sIdx, svg, n);
  return n;
}
function umlSeqCreate(o, items, txt, ctx, sIdx){
  const seq=umlState().seq, a=txt[0].trim(), A=seq.objs[a];
  if (!A){ ctx.warn('oggetto «'+a+'» non definito'); return; }
  seq.started=true; seq.t-=.7;
  const n=umlSeqObject(o.stereo&&o.stereo.v ? o.stereo.v.trim() : 'object', o, items, [txt[1]], ctx, sIdx, seq.t);
  const dir=Math.sign(n.c[0]-A.x)||1, dA=Math.max(0, (seq.act[a]||0)-1);
  const xa=A.x+dA*UML_AW/2+(seq.act[a] ? dir*UML_AW/2 : 0), xb=n.c[0]-dir*n.hw;
  let svg = umlArrow([[xa, seq.t], [xb, seq.t]], UML_ARR, true, ctx);
  svg += umlLabel(o.op&&o.op.v ? o.op.v : '«create»', [(xa+xb)/2, seq.t], 'south', ctx);
  for (const f of seq.frags){ f.x0=Math.min(f.x0, A.x, n.c[0]); f.x1=Math.max(f.x1, A.x, n.c[0]); }
  seq.t = seq.objs[txt[1].trim()].bottom-.2;
  umlEmit(ctx, sIdx, svg, null);
}
function umlSeqEnv(i, env, j, endS, endE, ctx){
  const U=umlState();
  if (U.seq){ ctx.warn('umlseqdiag annidati non supportati'); return; }
  const op=readOpt(j), k = op ? op.e+1 : j;
  const sIdx=stmtRec(i, endE, env, j); const rec=R.stmts[sIdx];
  rec.opts = op ? {s:op.s, e:op.e} : null; rec.frame=ctx.frame; rec.uml='box'; rec.groups=[];
  const out = ctx.layer==='bg' ? R.bg : R.out, at=out.length, h0=R.handles.length;
  const seq = U.seq = {objs:{}, order:[], t:-.8, started:false, act:{}, frags:[], out};
  try { run(k, endS, childCtx(ctx)); } finally { U.seq=null; }
  for (const h of R.handles.slice(h0)) if (!h.base) R.handles.push({...h, stmt:sIdx});
  // linee di vita: dietro a tutto, selezionano il proprio oggetto
  const tEnd=seq.t-.5, st=umlStyle(ctx, null, []); st.dash=[3,3];
  const pt=paint(st);
  let svg='';
  for (const nm of seq.order){
    const ob=seq.objs[nm], d=`M${fmt(ob.x,4)} ${fmt(-ob.bottom,4)}V${fmt(-tEnd,4)}`;
    svg += `<g data-s="${ob.sIdx}"><path d="${d}" fill="none" stroke="${pt.stroke}"${pt.a}/><path class="hit" fill="none" d="${d}" stroke-width="${fmt(HITW,4)}"/></g>`;
  }
  out.splice(at, 0, svg);
}
function umlSeqCall(i, env, j, endS, endE, ctx){
  const seq=umlState().seq, self = env==='umlcallself';
  const op=readOpt(j); let k = op ? op.e+1 : j;
  const groups=[];
  for (let n=0;n<(self?1:2);n++){ const g=readGroup(k); if (!g){ mkWarn(i,'e')(`\\begin{${env}}: ${self?'manca l\'oggetto':'mancano i due oggetti'} tra graffe`); return; } groups.push(g); k=g.e+1; }
  if (!seq){ ctx.warn('\\begin{'+env+'} va usato dentro \\begin{umlseqdiag}'); return; }
  const sIdx=stmtRec(i, endE, env, j); const rec=R.stmts[sIdx];
  rec.opts = op ? {s:op.s, e:op.e} : null; rec.frame=ctx.frame; rec.uml='call';
  rec.groups = groups.map((g,n)=>({s:g.s+1, e:g.e, label:self ? 'oggetto' : ['da','a'][n]}));
  const items=umlOptItems(op), o={}; for (const it of items) o[it.k]=it;
  const a=subVars(groups[0].text, ctx.vars).trim(), b = self ? a : subVars(groups[1].text, ctx.vars).trim();
  const A=seq.objs[a], B=seq.objs[b];
  if (!A || !B){ ctx.warn('oggetto «'+(A?b:a)+'» non definito'); run(k, endS, childCtx(ctx)); return; }
  const step = .6 + (o.dt && o.dt.v ? +evalExpr(o.dt.v, ctx.vars)*EX : 0);
  const out=seq.out, at=out.length;
  seq.started=true; seq.t-=step; const t1=seq.t;
  for (const f of seq.frags){ f.x0=Math.min(f.x0, A.x, B.x); f.x1=Math.max(f.x1, A.x, B.x); }
  const own=!seq.act[a]; if (own) seq.act[a]=1;
  const dA=seq.act[a]-1, dB = self ? dA+1 : (seq.act[b]||0);
  seq.act[b]=dB+1;
  if (self) seq.t-=.3;
  const tb=seq.t;
  run(k, endS, childCtx(ctx));
  seq.t-=.45; const t2=seq.t;
  if (self) seq.t-=.3;
  seq.act[b]=dB; if (own) seq.act[a]=0;
  const bx=(O,d)=>O.x+d*UML_AW/2, fst=umlStyle(ctx, 'fill call', items);
  const box=(cx,y0,y1)=>umlPathSVG(umlRect(cx-UML_AW/2, y1, cx+UML_AW/2, y0), fst);
  const sync = !(o.type && /asynchron/.test(o.type.v)), opL=o.op&&o.op.v||'', retL=o.return&&o.return.v||'';
  let svg='';
  if (own) svg += box(bx(A,0), t1+.15, seq.t-.15);
  svg += box(bx(B,dB), tb, t2);
  if (!self){
    const dir=Math.sign(B.x-A.x)||1, xa=bx(A,dA)+dir*UML_AW/2, xb=bx(B,dB)-dir*UML_AW/2;
    svg += umlArrow([[xa,t1],[xb,t1]], sync ? UML_SYNC : UML_ARR, false, ctx) + umlLabel(opL, [(xa+xb)/2, t1], 'south', ctx);
    if (sync || retL) svg += umlArrow([[xb,t2],[xa,t2]], UML_ARR, true, ctx) + umlLabel(retL, [(xa+xb)/2, t2], 'south', ctx);
  } else {
    const xr=bx(A,dA)+UML_AW/2, xo=xr+.5, xn=bx(A,dB)+UML_AW/2;
    svg += umlArrow([[xr,t1],[xo,t1],[xo,tb],[xn,tb]], sync ? UML_SYNC : UML_ARR, false, ctx) + umlLabel(opL, [xo+.05, (t1+tb)/2], 'west', ctx);
    if (sync || retL) svg += umlArrow([[xn,t2],[xo,t2],[xo,seq.t],[xr,seq.t]], UML_ARR, true, ctx) + umlLabel(retL, [xo+.05, (t2+seq.t)/2], 'west', ctx);
  }
  const clip = ctx.scope.clip ? ` clip-path="url(#${ctx.scope.clip})"` : '';
  out.splice(at, 0, `<g data-s="${sIdx}"${clip}>${svg}</g>`);
}
function umlSeqFrag(i, env, j, endS, endE, ctx){
  const seq=umlState().seq;
  const op=readOpt(j), k = op ? op.e+1 : j;
  if (!seq){ ctx.warn('\\begin{umlfragment} va usato dentro \\begin{umlseqdiag}'); return; }
  const sIdx=stmtRec(i, endE, env, j); const rec=R.stmts[sIdx];
  rec.opts = op ? {s:op.s, e:op.e} : null; rec.frame=ctx.frame; rec.uml='box'; rec.groups=[];
  const items=umlOptItems(op), o={}; for (const it of items) o[it.k]=it;
  const out=seq.out, at=out.length;
  seq.t-=.25; const t0=seq.t;
  const f={x0:Infinity, x1:-Infinity, parts:[]}; seq.frags.push(f);
  seq.t-=.5;
  run(k, endS, childCtx(ctx));
  seq.frags.pop(); seq.t-=.35; const t1=seq.t;
  if (!isFinite(f.x0)){ const xs=seq.order.map(nm=>seq.objs[nm].x); f.x0=Math.min(0, ...xs); f.x1=Math.max(0, ...xs); }
  const pad = o['inner xsep'] && o['inner xsep'].v ? +evalExpr(o['inner xsep'].v, ctx.vars)*EX : .8;  // in ex, come tikz-uml
  const x0=f.x0-pad, x1=f.x1+pad;
  for (const pf of seq.frags){ pf.x0=Math.min(pf.x0, x0+.4); pf.x1=Math.max(pf.x1, x1-.4); }
  const st=umlStyle(ctx, 'fill fragment', items), pt=paint(st), [ix,iy]=st.isep;
  let svg = umlPathSVG(umlRect(x0, t1, x1, t0), st);
  const type=o.type&&o.type.v ? o.type.v.trim() : 'opt';
  const r=umlText('\\textbf{'+type+'}', st, 'center', ctx);
  if (r){
    const w=r.w+2*ix, h=r.h+r.d+2*iy;
    svg += `<path d="M${fmt(x0,4)} ${fmt(-(t0-h),4)}H${fmt(x0+w,4)}L${fmt(x0+w+.12,4)} ${fmt(-(t0-h+.12),4)}V${fmt(-t0,4)}" fill="none" stroke="${pt.stroke}"${pt.a}/>`;
    svg += umlDrawText(r, x0+ix, t0-iy, st);
    if (o.label && o.label.v) svg += umlLabel('['+o.label.v+']', [x0+w+.25, t0-h/2], 'west', ctx);
  }
  for (const pa of f.parts){
    svg += `<path d="M${fmt(x0,4)} ${fmt(-pa.t,4)}H${fmt(x1,4)}" fill="none" stroke="${pt.stroke}"${pt.a} stroke-dasharray="${fmt(3*PT,4)} ${fmt(3*PT,4)}"/>`;
    if (pa.text) svg += umlLabel('['+pa.text+']', [x0+.15, pa.t], 'north west', ctx);
  }
  svg += `<path class="hit" fill="none" d="${umlRect(x0, t1, x1, t0)}" stroke-width="${fmt(HITW,4)}"/>`;
  const clip = ctx.scope.clip ? ` clip-path="url(#${ctx.scope.clip})"` : '';
  out.splice(at, 0, `<g data-s="${sIdx}"${clip}>${svg}</g>`);
}
