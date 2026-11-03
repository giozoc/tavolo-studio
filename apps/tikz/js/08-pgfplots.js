/* ============ PGFPLOTS: axis, \addplot, legenda ============ */
const CYCLE = [
  'blue, mark=*, mark options={fill=blue!80!black}',
  'red, mark=square*, mark options={fill=red!80!black}',
  'brown!60!black, mark=otimes*, mark options={fill=brown!80!black}',
  'black, mark=star',
  'blue, mark=diamond*, mark options={fill=blue!80!black}',
  'red, densely dashed, mark=*, mark options={solid,fill=red!80!black}',
  'brown!60!black, densely dashed, mark=square*, mark options={solid,fill=brown!80!black}',
  'black, densely dashed, mark=otimes*, mark options={solid,fill=gray}'];
const BAR_CYCLE = ['blue, fill=blue!30!white', 'red, fill=red!30!white', 'brown!60!black, fill=brown!30!white', 'black, fill=gray', 'teal, fill=teal!30', 'orange, fill=orange!30'];

function niceStep(range, target){
  const raw = range/Math.max(1,target); const p=Math.pow(10,Math.floor(Math.log10(raw)));
  let best=p, bd=Infinity;
  for (const m of [1,2,5,10]){ const st=m*p, n=range/st, d=Math.abs(n-target)+(n>target*1.6?5:0); if (d<bd){ bd=d; best=st; } }
  return best;
}
function tickNum(v){
  if (Math.abs(v)<1e-12) return '0';
  const a=Math.abs(v);
  if (a>=1e5 || a<1e-3){ const k=Math.floor(Math.log10(a)); const m=v/Math.pow(10,k); const ms=fmt(m,2); return (ms==='1'?'':ms==='-1'?'-':ms+'\\cdot ')+'10^{'+k+'}'; }
  return fmt(v, a<1?3:2);
}
function axisOptMap(text, ctx){
  const o={};
  for (const {k,v} of parseOptList(subVars(text, ctx.vars))) o[k]= v===null ? true : v;
  return o;
}
function runAxis(cmdStart, env, i, bs, be, ctx){
  const sIdx = stmtRec(cmdStart, be, 'axis', i);
  const rec = R.stmts[sIdx];
  const op = readOpt(i); let j=i;
  if (op){ rec.opts={s:op.s, e:op.e}; j=op.e+1; }
  const warn = ctx.warn;
  // opzioni: \pgfplotsset globali + locali
  const o = {};
  const styles = {...ctx.styles};
  const allText = [...ctx.axisDefaults, op?op.text:''];
  for (const t of allText){
    for (const {k,v} of parseOptList(subVars(t, ctx.vars))){
      let m;
      if ((m=/^(.+?)\/\.(style|append style)$/.exec(k))){ const nm=m[1].trim(); styles[nm] = (m[2]==='append style' && styles[nm] ? styles[nm]+',' : '') + (v||''); continue; }
      if (k==='compat') continue;
      o[k] = v===null ? true : v;
    }
  }
  const num = (k,d)=>{ if (o[k]===undefined||o[k]===true) return d; try{ return evalExpr(o[k], ctx.vars); }catch(e){ warn(k+': '+e.message); return d; } };
  const len = (k,d)=>{ if (o[k]===undefined) return d; try{ return evalLen(o[k], ctx.vars, PT); }catch(e){ return d; } };
  const ax = {o, styles, plots:[], legend:[], named:{}, sIdx, warn,
    logx: env==='semilogxaxis'||env==='loglogaxis'||o.xmode==='log', logy: env==='semilogyaxis'||env==='loglogaxis'||o.ymode==='log',
    domain:[-5,5], samples: num('samples',25), trig: o['trig format plots']==='rad'?'rad':'deg', nPlot:0, nBar:0, barIdx:0 };
  if (o.domain){ const p=String(o.domain).split(':'); ax.domain=[+evalExpr(p[0],ctx.vars), +evalExpr(p[1],ctx.vars)]; }
  if (o['symbolic x coords']) ax.symx = splitTop(String(o['symbolic x coords'])).map(s=>s.trim());
  if (o['symbolic y coords']) ax.symy = splitTop(String(o['symbolic y coords'])).map(s=>s.trim());
  const isBarAxis = /^(ybar|xbar)/.test(Object.keys(o).find(k=>/^(ybar|xbar)( stacked)?$/.test(k))||'') ? (o.ybar!==undefined||o['ybar stacked']!==undefined ? 'y':'x') : null;
  ax.bar = isBarAxis; ax.stacked = o['ybar stacked']!==undefined || o['xbar stacked']!==undefined;
  // passo 1: raccolta dati
  ax.collect = true;
  const c1 = {...ctx, axis:ax, collectOnly:true, warn:()=>{}};
  c1.scope = {clip:null};
  run(j, bs, c1);
  ax.nBar = ax.plots.filter(p=>p.bar).length;
  // limiti
  let xs=[], ys=[];
  for (const p of ax.plots) for (const q of p.pts) if (q){ if(isFinite(q[0]) && (!ax.logx||q[0]>0)) xs.push(q[0]); if(isFinite(q[1]) && (!ax.logy||q[1]>0)) ys.push(q[1]); }
  if (ax.bar==='y' && !ax.logy) ys.push(0);
  if (ax.bar==='x' && !ax.logx) xs.push(0);
  const T = (v,lg)=> lg ? Math.log10(v) : v;
  let xmin = o.xmin!==undefined ? T(num('xmin'),ax.logx) : (xs.length? Math.min(...xs.map(v=>T(v,ax.logx))) : (ax.logx?0:-5));
  let xmax = o.xmax!==undefined ? T(num('xmax'),ax.logx) : (xs.length? Math.max(...xs.map(v=>T(v,ax.logx))) : (ax.logx?1:5));
  let ymin = o.ymin!==undefined ? T(num('ymin'),ax.logy) : (ys.length? Math.min(...ys.map(v=>T(v,ax.logy))) : (ax.logy?0:-5));
  let ymax = o.ymax!==undefined ? T(num('ymax'),ax.logy) : (ys.length? Math.max(...ys.map(v=>T(v,ax.logy))) : (ax.logy?1:5));
  if (ax.symx){ if(o.xmin===undefined) xmin=Math.min(xmin,0); if(o.xmax===undefined) xmax=Math.max(xmax,ax.symx.length-1); }
  if (xmax-xmin<1e-12){ xmin-=1; xmax+=1; } if (ymax-ymin<1e-12){ ymin-=1; ymax+=1; }
  const enl = (k)=>{ const g=o['enlargelimits']??o['enlarge limits']; const s=o['enlarge '+k+' limits']; const v = s!==undefined ? s : g; if (v===undefined) return ax.bar ? (k===ax.bar? .1 : .15) : .1; if (v===true||v==='true') return .1; if (v==='false'||v===false) return 0; if (/upper|lower/.test(v)) return v; const n=parseFloat(v); return isNaN(n)?.1:n; };
  const ex = enl('x'), ey = enl('y');
  const applyEnl = (a,b,f,setMin,setMax)=>{ const r=b-a; let lo=a, hi=b; if (typeof f==='string'){ if(/upper/.test(f)) hi=b+.1*r; if(/lower/.test(f)) lo=a-.1*r; return [lo,hi]; } if(!setMin) lo=a-f*r; if(!setMax) hi=b+f*r; return [lo,hi]; };
  if (ax.bar==='y' && !ax.symx && o['enlarge x limits']===undefined && ex===.15){ /* barre: margine laterale */ }
  [xmin,xmax] = applyEnl(xmin,xmax,ex, o.xmin!==undefined, o.xmax!==undefined);
  [ymin,ymax] = applyEnl(ymin,ymax,ey, o.ymin!==undefined, o.ymax!==undefined);
  if (ax.bar==='y' && !ax.logy && o.ymin===undefined && ymin<0 && Math.min(...ys)>=0) ymin=0;
  // geometria
  const W = len('width', 240*PT), H = len('height', 207*PT);
  const only = o['scale only axis']!==undefined;
  let bw = only ? W : Math.max(1, W - 45*PT), bh = only ? H : Math.max(1, H - 45*PT);
  if (o.width!==undefined && o.height===undefined && !only){ /* altezza predefinita */ }
  if (o['axis equal']!==undefined || o['axis equal image']!==undefined){
    const sx=bw/(xmax-xmin), sy=bh/(ymax-ymin);
    if (o['axis equal image']!==undefined){ if (sx<sy) bh=(ymax-ymin)*sx; else bw=(xmax-xmin)*sy; }
    else { if (sx<sy){ const c=(ymin+ymax)/2, h=bh/sx/2; ymin=c-h; ymax=c+h; } else { const c=(xmin+xmax)/2, w=bw/sy/2; xmin=c-w; xmax=c+w; } }
  }
  // posizione
  let at=[0,0];
  if (o.at){ try{ const t=String(o.at).replace(/^\{|\}$/g,'').trim().replace(/^\(|\)$/g,''); const q=splitTop(t); at=[lenCm(unbrace(q[0]),ctx), lenCm(unbrace(q[1]),ctx)]; }catch(e){ warn('at: '+e.message); } }
  const ancMap = {'south west':[0,0],'south':[.5,0],'south east':[1,0],'west':[0,.5],'center':[.5,.5],'east':[1,.5],'north west':[0,1],'north':[.5,1],'north east':[1,1],'origin':null};
  const anc = ancMap[o.anchor||'south west'] || [0,0];
  const sw = [at[0]-anc[0]*bw, at[1]-anc[1]*bh];
  const F = ctx.frame;
  const Lmap = (x,y)=>{ const u=ax.logx?Math.log10(x):x, v=ax.logy?Math.log10(y):y; return [sw[0]+(u-xmin)/(xmax-xmin)*bw, sw[1]+(v-ymin)/(ymax-ymin)*bh]; };
  const Linv = (lx,ly)=>{ const u=xmin+(lx-sw[0])/bw*(xmax-xmin), v=ymin+(ly-sw[1])/bh*(ymax-ymin); return [ax.logx?Math.pow(10,u):u, ax.logy?Math.pow(10,v):v]; };
  const sxl=bw/(xmax-xmin), syl=bh/(ymax-ymin);
  ax.frame = { mat:null,
    map:(x,y)=>F.map(...Lmap(x,y)), inv:(px,py)=>Linv(...F.inv(px,py)),
    lin:(dx,dy)=>F.lin(dx*sxl, dy*syl), invLin:(px,py)=>{ const l=F.invLin(px,py); return [l[0]/sxl, l[1]/syl]; } };
  ax.rel = (a,b)=>F.map(sw[0]+a*bw, sw[1]+b*bh);
  ax.lim = {xmin,xmax,ymin,ymax}; ax.bw=bw; ax.bh=bh; ax.sw=sw;
  rec.axis = {at, frame:F, hasAt: o.at!==undefined};
  // nodo "current axis"
  const cn = {c:F.map(sw[0]+bw/2, sw[1]+bh/2), rot:F.mat?mAngle(F.mat):0, kind:'rect', hw:bw/2, hh:bh/2, poly:[[-bw/2,-bh/2],[bw/2,-bh/2],[bw/2,bh/2],[-bw/2,bh/2]], osep:0, st:newStyle(), tw:0, th:0, td:0, iw:bw/2, ih:bh/2};
  R.names['current axis'] = cn; if (o.name) R.names[o.name] = cn;
  // clip
  const corners = [[0,0],[1,0],[1,1],[0,1]].map(([a,b])=>ax.rel(a,b));
  const clipId = 'ax'+(R.clipN++);
  DEFS.push(`<clipPath id="${clipId}"><path d="${ptsPath(corners)}"/></clipPath>`);
  ax.clipId = o.clip==='false' ? null : clipId;
  R.axes.push({sIdx, frame:ax.frame, corners, insertAt:bs, lim:{xmin,xmax,ymin,ymax}, logx:ax.logx, logy:ax.logy});
  // decorazioni sotto
  const deco = axisDecorations(ax, ctx);
  emit(ctx, `<g data-s="${sIdx}"><path class="hitf" fill="transparent" d="${ptsPath(corners)}"/>${deco.under}</g>`);
  // passo 2: disegno
  ax.collect = false; ax.plots=[]; ax.legend=[]; ax.nPlot=0; ax.barIdx=0; ax.stackBase={};
  const c2 = {...ctx, axis:ax, frame:ax.frame, collectOnly:false};
  c2.scope = {clip: ax.clipId};
  c2.styles = styles;
  run(j, bs, c2);
  emit(ctx, `<g data-s="${sIdx}">${axisDecorations(ax, ctx, true).over}${legendSVG(ax, ctx)}</g>`);
}
function axisTicks(ax, which, ctx){
  const o=ax.o, L=ax.lim; const lg = which==='x'?ax.logx:ax.logy;
  const lo = which==='x'?L.xmin:L.ymin, hi = which==='x'?L.xmax:L.ymax;
  const len = which==='x'?ax.bw:ax.bh;
  const key = which+'tick';
  let ticks=[], labels=null, minor=[];
  const sym = which==='x'?ax.symx:ax.symy;
  if (o.ticks==='none' || o[key]==='\\empty' || o[key]==='{}' || o[key]==='') return {ticks:[],labels:[],minor:[]};
  if (o[key]==='data'){
    const p=ax.plots[0]; if (p) ticks=[...new Set(p.pts.filter(Boolean).map(q=>which==='x'?q[0]:q[1]))].map(v=>lg?Math.log10(v):v);
  } else if (o[key]!==undefined && o[key]!==true){
    const items = expandList(String(o[key]), ctx.vars);
    ticks = items.map(s=>{ if (sym){ const k=sym.indexOf(s.trim()); if(k>=0) return k; } try{ const v=evalExpr(s,ctx.vars); return lg?Math.log10(v):v; }catch(e){ return NaN; } }).filter(isFinite);
  } else if (sym){
    for (let k=0;k<sym.length;k++) if (k>=lo-1e-9 && k<=hi+1e-9) ticks.push(k);
  } else if (lg){
    const s = Math.max(1, Math.ceil((hi-lo)/7));
    for (let k=Math.ceil(lo-1e-9); k<=hi+1e-9; k+=s) ticks.push(k);
    for (let k=Math.floor(lo); k<=hi; k++) for (let m=2;m<10;m++){ const v=k+Math.log10(m); if (v>lo&&v<hi && s===1) minor.push(v); }
  } else {
    let step = o[key+' distance']!==undefined ? +evalExpr(o[key+' distance'],ctx.vars) : niceStep(hi-lo, Math.max(3, Math.min(9, len/1.1)));
    const k0 = Math.ceil(lo/step-1e-9);
    for (let k=k0; k*step<=hi+step*1e-9; k++) ticks.push(+(k*step).toPrecision(12));
    const mn = o['minor '+key+' num']!==undefined ? +o['minor '+key+' num'] : (o['minor tick num']!==undefined ? +o['minor tick num'] : 0);
    if (mn>0){ const ms=step/(mn+1); for (let v=Math.ceil(lo/ms-1e-9)*ms; v<=hi+1e-9; v+=ms){ if (Math.abs(v/step-Math.round(v/step))>1e-6) minor.push(v); } }
  }
  const lk = which+'ticklabels';
  if (o[lk]!==undefined && o[lk]!==true){ labels = o[lk]==='\\empty' || o[lk]==='{}' ? ticks.map(()=> '') : splitTop(String(o[lk])).map(s=>s.trim()); }
  else if (sym) labels = ticks.map(k=>sym[Math.round(k)]||'');
  else labels = ticks.map(v=> lg ? '$10^{'+fmt(v,2)+'}$' : '$'+tickNum(v)+'$');
  return {ticks, labels, minor};
}
function axisDecorations(ax, ctx, over){
  const o=ax.o, L=ax.lim, F=ax.frame; let under='', top='';
  const lineSt = cloneStyle(newStyle()); lineSt.draw=true; lineSt.lw=.4*PT;
  if (o['axis line style']) applyOpts(lineSt, String(o['axis line style']), ctx);
  const rel = ax.rel;
  const xt = axisTicks(ax,'x',ctx), yt = axisTicks(ax,'y',ctx);
  const ux = u => (u-L.xmin)/(L.xmax-L.xmin), uy = v => (v-L.ymin)/(L.ymax-L.ymin);
  // modalità assi
  let xl = 'box', yl = 'box';
  const al = o['axis lines'] || o['axis lines*'];
  if (al){ xl = yl = String(al); }
  if (o['axis x line']||o['axis x line*']) xl = String(o['axis x line']||o['axis x line*']);
  if (o['axis y line']||o['axis y line*']) yl = String(o['axis y line']||o['axis y line*']);
  const arrows = !!(o['axis lines']||o['axis x line']||o['axis y line']) && !o['axis lines*'];
  if (o['hide axis']!==undefined){ xl=yl='none'; xt.ticks=[]; yt.ticks=[]; }
  if (o['hide x axis']!==undefined){ xl='none'; xt.ticks=[]; }
  if (o['hide y axis']!==undefined){ yl='none'; yt.ticks=[]; }
  const norm = s => ({left:'bottom', right:'top', center:'middle', box:'box', none:'none', middle:'middle', bottom:'bottom', top:'top'})[s]||s;
  const xm = norm(xl), ym = ({left:'left',right:'right',center:'middle',middle:'middle',box:'box',none:'none',bottom:'left'})[yl]||'box';
  // posizione delle linee in coordinate relative
  const zx = L.ymin<=0 && L.ymax>=0 && !ax.logy ? uy(0) : 0;
  const zy = L.xmin<=0 && L.xmax>=0 && !ax.logx ? ux(0) : 0;
  const xLineY = xm==='middle' ? zx : xm==='top' ? 1 : 0;
  const yLineX = ym==='middle' ? zy : ym==='right' ? 1 : 0;
  const seg = (a,b,st)=>{ const pt=paint(st); return `<path d="M${P(a)}L${P(b)}" fill="none" stroke="${pt.stroke}"${pt.a}/>`; };
  if (!over){
    // sfondo e griglia
    if (o['axis background/.style'] || ax.styles['axis background']){ const bst=newStyle(); applyOpts(bst, ax.styles['axis background']||'', ctx); const pt=paint(bst); under+=`<path d="${ptsPath([[0,0],[1,0],[1,1],[0,1]].map(([a,b])=>rel(a,b)))}" fill="${pt.fill}" stroke="${pt.stroke}"${pt.a}/>`; }
    const g = o.grid ? String(o.grid) : (o.xmajorgrids||o.ymajorgrids ? 'custom' : 'none');
    const gst = newStyle(); gst.draw=true; gst.color=[.75,.75,.75]; gst.lw=.4*PT;
    if (o['grid style']) applyOpts(gst, String(o['grid style']), ctx);
    if (o['major grid style']) applyOpts(gst, String(o['major grid style']), ctx);
    const mgst = cloneStyle(gst); mgst.color=[.88,.88,.88]; if (o['minor grid style']) applyOpts(mgst, String(o['minor grid style']), ctx);
    const gx = g==='major'||g==='both'||o.xmajorgrids!==undefined, gy = g==='major'||g==='both'||o.ymajorgrids!==undefined;
    const mgx = g==='minor'||g==='both'||o.xminorgrids!==undefined, mgy = g==='minor'||g==='both'||o.yminorgrids!==undefined;
    if (mgx) for (const v of xt.minor) under+=seg(rel(ux(v),0),rel(ux(v),1),mgst);
    if (mgy) for (const v of yt.minor) under+=seg(rel(0,uy(v)),rel(1,uy(v)),mgst);
    if (gx) for (const v of xt.ticks) under+=seg(rel(ux(v),0),rel(ux(v),1),gst);
    if (gy) for (const v of yt.ticks) under+=seg(rel(0,uy(v)),rel(1,uy(v)),gst);
    return {under};
  }
  // linee degli assi
  const ast = cloneStyle(lineSt);
  if (xm==='box' && ym==='box'){ const pt=paint(ast); top+=`<path d="${ptsPath([[0,0],[1,0],[1,1],[0,1]].map(([a,b])=>rel(a,b)))}" fill="none" stroke="${pt.stroke}"${pt.a}/>`; }
  else {
    const arrSt = cloneStyle(ast); if (arrows) arrSt.arrows=['','stealth'];
    const draw1 = (a,b,st)=>{ const ps={st, subs:[{start:a, ops:[{t:'L',p:b}]}], extraSVG:[], edges:[], nodes:[]}; return pathSVG(ps, ctx, false).svg; };
    if (xm!=='none') top += xm==='box' ? draw1(rel(0,0),rel(1,0),ast)+draw1(rel(0,1),rel(1,1),ast) : draw1(rel(0,xLineY), rel(1,xLineY), arrSt);
    if (ym!=='none') top += ym==='box' ? draw1(rel(0,0),rel(0,1),ast)+draw1(rel(1,0),rel(1,1),ast) : draw1(rel(yLineX,0), rel(yLineX,1), arrSt);
  }
  // tacche ed etichette
  const tl = o['major tick length'] ? evalLen(o['major tick length'],ctx.vars,PT) : .15;
  const align = o['tick align'] || (xm==='box'?'inside':'center');
  const tst = cloneStyle(ast); if (o['tick style']) applyOpts(tst, String(o['tick style']), ctx);
  const lab = (txt, p, anchor, rot=0, extraOpts='')=>{
    const st = nodeBaseStyle(newStyle(), ctx, 'node'); st.anchor=anchor; st.isep=[2*PT,2*PT];
    if (o['tick label style']) applyOpts(st, String(o['tick label style']), ctx);
    if (extraOpts) applyOpts(st, extraOpts, ctx);
    if (o['ticklabel style']) applyOpts(st, String(o['ticklabel style']), ctx);
    st.nodeRot += rot;
    const n=buildNode(st, txt, p, ctx); return n;
  };
  const tickSeg = (p, dirAng, k=1)=>{ const d = V.pol(dirAng, tl*k); if (align==='inside') return seg(p, V.add(p,d), tst); if (align==='outside') return seg(p, V.sub(p,d), tst); return seg(V.sub(p,V.mul(d,.5)), V.add(p,V.mul(d,.5)), tst); };
  const xStyle = String(o['xticklabel style']||''), yStyle = String(o['yticklabel style']||'');
  const xpos = o['xtick pos'], ypos = o['ytick pos'];
  let xLabBottom = 0, yLabLeft = 0;
  const up = V.ang(F.lin(0,1)), rt = V.ang(F.lin(1,0));
  const showX = xm!=='none', showY = ym!=='none';
  if (showX){
    xt.ticks.forEach((v,k)=>{
      const t = ux(v); if (t<-1e-9||t>1+1e-9) return;
      if (xm==='box'){ if(xpos!=='top'&&xpos!=='right') top+=tickSeg(rel(t,0), up); if(xpos!=='bottom'&&xpos!=='left') top+=tickSeg(rel(t,1), up+180); }
      else top+=tickSeg(rel(t,xLineY), up);
      if (xm==='middle' && ym==='middle' && Math.abs(t-yLineX)<1e-6 && !ax.symx) return;
      const txt = xt.labels[k]; if (txt===undefined || txt==='') return;
      const base = xm==='box'||xm==='bottom' ? rel(t,0) : xm==='top' ? rel(t,1) : rel(t,xLineY);
      const off = align==='outside' && (xm==='box'||xm==='bottom') ? V.pol(up+180, tl) : xm==='middle'&&align!=='inside' ? V.pol(up+180, tl/2) : [0,0];
      const n = lab(txt, V.add(base,off), xm==='top'?'south':'north', 0, xStyle);
      top += nodeSVG(n); xLabBottom = Math.max(xLabBottom, 2*n.hh + V.len(off));
    });
    xt.minor.forEach(v=>{ const t=ux(v); if (xm==='box'){ top+=tickSeg(rel(t,0),up,.5)+tickSeg(rel(t,1),up+180,.5); } else top+=tickSeg(rel(t,xLineY),up,.5); });
  }
  if (showY){
    yt.ticks.forEach((v,k)=>{
      const t = uy(v); if (t<-1e-9||t>1+1e-9) return;
      if (ym==='box'){ if(ypos!=='right') top+=tickSeg(rel(0,t), rt); if(ypos!=='left') top+=tickSeg(rel(1,t), rt+180); }
      else top+=tickSeg(rel(yLineX,t), rt);
      if (xm==='middle' && ym==='middle' && Math.abs(t-xLineY)<1e-6) return;
      const txt = yt.labels[k]; if (txt===undefined || txt==='') return;
      const base = ym==='box'||ym==='left' ? rel(0,t) : ym==='right' ? rel(1,t) : rel(yLineX,t);
      const off = align==='outside' && (ym==='box'||ym==='left') ? V.pol(rt+180, tl) : ym==='middle'&&align!=='inside' ? V.pol(rt+180, tl/2) : [0,0];
      const n = lab(txt, V.add(base,off), ym==='right'?'west':'east', 0, yStyle);
      top += nodeSVG(n); yLabLeft = Math.max(yLabLeft, 2*n.hw + V.len(off));
    });
    yt.minor.forEach(v=>{ const t=uy(v); if (ym==='box'){ top+=tickSeg(rel(0,t),rt,.5)+tickSeg(rel(1,t),rt+180,.5); } else top+=tickSeg(rel(yLineX,t),rt,.5); });
  }
  // etichette degli assi e titolo
  const desc = (txt, p, anchor, rot, styleKey)=>{
    const st = nodeBaseStyle(newStyle(), ctx, 'node'); st.anchor=anchor; st.nodeRot=rot;
    if (o['label style']) applyOpts(st, String(o['label style']), ctx);
    if (o[styleKey]) applyOpts(st, String(o[styleKey]), ctx);
    return nodeSVG(buildNode(st, txt, p, ctx));
  };
  const midAxes = xm==='middle' || ym==='middle';
  if (o.xlabel && o.xlabel!==true){
    if (midAxes && xm==='middle') top += desc(String(o.xlabel), V.add(rel(1,xLineY), V.pol(rt, arrows?.15:.05)), 'west', 0, 'xlabel style');
    else top += desc(String(o.xlabel), V.add(rel(.5, xm==='top'?1:0), V.pol(up+(xm==='top'?0:180), xLabBottom+.05)), xm==='top'?'south':'north', 0, 'xlabel style');
  }
  if (o.ylabel && o.ylabel!==true){
    if (midAxes && ym==='middle') top += desc(String(o.ylabel), V.add(rel(yLineX,1), V.pol(up, arrows?.15:.05)), 'south', 0, 'ylabel style');
    else top += desc(String(o.ylabel), V.add(rel(ym==='right'?1:0, .5), V.pol(rt+(ym==='right'?0:180), yLabLeft+.08)), 'south', 90+(F.mat?mAngle(F.mat):0), 'ylabel style');
  }
  if (o.title && o.title!==true) top += desc(String(o.title), V.add(rel(.5,1), V.pol(up,.12)), 'south', 0, 'title style');
  return {over:top};
}
/* ---------- \addplot, \legend, \addlegendentry ---------- */
function axisCmd(cmdStart, name, i, b, ctx){
  const ax = ctx.axis;
  if (name==='legend'){ const g=readGroup(i); if(g){ ax.legendList = splitTop(g.text).map(s=>unbrace(s)); return g.e+1; } return i; }
  if (name==='addlegendentry'){ let j=i; const op=readOpt(j); if(op) j=op.e+1; const g=readGroup(j); if(g){ ax.legend.push({text:g.text, plot:ax.plots[ax.plots.length-1]}); return g.e+1; } return j; }
  if (name==='closedcycle'){ return i; }
  let e = stmtEnd(i, b); if (e<0){ mkWarn(cmdStart,'e')('manca «;» dopo \\addplot'); e=b; }
  if (/3/.test(name)){ ctx.warn('\\addplot3 (grafici 3D) non supportato'); return e+1; }
  if (ctx.collectOnly){ addplot(cmdStart, name, i, e, ctx, ax, true); return e+1; }
  try { addplot(cmdStart, name, i, e, ctx, ax, false); } catch(err){ mkWarn(cmdStart,'e')(err.message||String(err)); if(!(err instanceof MathErr)) console.error(err); }
  return e+1;
}
function addplot(cmdStart, name, i, e, ctx, ax, collect){
  const sIdx = collect ? -1 : stmtRec(cmdStart, e+1, 'addplot', i);
  let plus = name.endsWith('+');
  if (S[i]==='+'){ plus=true; i++; }
  let j = skipWS(i, e);
  const op = readOpt(j); let optText = '';
  if (op){ optText=op.text; j=op.e+1; if(!collect) R.stmts[sIdx].opts={s:op.s,e:op.e}; }
  const ao = optText ? axisOptMap(optText, ctx) : {};
  const forget = ao['forget plot']!==undefined;
  const st = newStyle(); st.draw=true; st.lw=.4*PT;
  st.domain = ax.domain.slice(); st.samples = ax.samples;
  const isBar = ao.ybar!==undefined || ao.xbar!==undefined || ao['ybar interval']!==undefined || (ax.bar && ao.ybar!=='false' && ao['sharp plot']===undefined && ao.smooth===undefined);
  const barDir = ao.xbar!==undefined ? 'x' : ao.ybar!==undefined ? 'y' : ax.bar;
  const sctx = {vars:ctx.vars, styles:ax.styles, warn:ctx.warn};
  if (ax.styles['every axis plot']) applyOpts(st, ax.styles['every axis plot'], sctx);
  if (plus || !op){
    const list = isBar ? BAR_CYCLE : CYCLE;
    const k = ax.nPlot % list.length;
    applyOpts(st, list[k], sctx);
    if (isBar){ delete st.kv.mark; st.kv.mark='none'; }
  }
  if (optText) applyOpts(st, optText, sctx);
  if (ax.styles['every axis plot post']) applyOpts(st, ax.styles['every axis plot post'], sctx);
  if (!forget) ax.nPlot++;
  // dati
  j = skipWS(j, e);
  let pts = [], handles=[];
  const vars = {...ctx.vars};
  const trigO = {trig: ax.trig};
  const restrictY = st.kv['restrict y to domain'] ? String(st.kv['restrict y to domain']).split(':').map(s=>+evalExpr(s,vars)) : null;
  const restrictX = st.kv['restrict x to domain'] ? String(st.kv['restrict x to domain']).split(':').map(s=>+evalExpr(s,vars)) : null;
  const sampleXs = ()=>{
    if (st.samplesAt) return expandList(st.samplesAt, vars).map(s=>+evalExpr(s,vars));
    const [d0,d1]=st.domain, n=st.samples; const out=[];
    for (let k=0;k<n;k++) out.push(ax.logx && d0>0 ? Math.pow(10, Math.log10(d0)+(Math.log10(d1)-Math.log10(d0))*k/(n-1)) : d0+(d1-d0)*k/(n-1));
    return out;
  };
  const symX = s => { if (ax.symx){ const k=ax.symx.indexOf(String(s).trim()); if (k>=0) return k; } return null; };
  const evalIn = (expr, x)=>{ const v=st.variable||'x'; const vv={...vars, [v]:x, x:x}; return evalExpr(expr, vv, trigO); };
  if (S[j]==='{' || S.startsWith('expression',j)){
    if (S.startsWith('expression',j)) j=skipWS(j+10,e);
    const g=readGroup(j); j=g.e+1;
    const ex=g.text; if (!collect) R.stmts[sIdx].expr={s:g.s+1,e:g.e};
    for (const x of sampleXs()){ let y; try{ y=evalIn(ex,x); }catch(err){ ctx.warn(err.message); break; } pts.push([x,y]); }
  } else if (S[j]==='('){
    const en=mcS(j); const q=splitTop(S.slice(j+1,en)); j=en+1;
    for (const t of sampleXs()){ try{ pts.push([evalIn(unbrace(q[0]),t), evalIn(unbrace(q[1]),t)]); }catch(err){ ctx.warn(err.message); break; } }
  } else if (S.startsWith('coordinates',j)){
    j=skipWS(j+11,e); const g=readGroup(j); if(!g) throw new MathErr('coordinates: manca {');
    let k=g.s+1;
    while (k<g.e){
      k=skipWS(k,g.e);
      if (S[k]==='('){
        const en=mcS(k); const txt=S.slice(k+1,en); const q=splitTop(txt);
        let x = symX(unbrace(q[0])), y;
        if (x===null) x=+evalExpr(unbrace(q[0]),vars,trigO);
        y = ax.symy && ax.symy.indexOf(unbrace(q[1]||''))>=0 ? ax.symy.indexOf(unbrace(q[1])) : +evalExpr(unbrace(q[1]||'0'),vars,trigO);
        pts.push([x,y]);
        const lx=litSpan(q[0],k+1), ly=litSpan(q[1]||'',k+2+q[0].length);
        if (!ax.symx || symX(unbrace(q[0]))===null) handles.push({lx, ly, x, y, sy:!lx&&ly});
        else handles.push({lx:null, ly, x, y});
        k=en+1;
        if (S[k]==='+'&&S[k+1]==='-'){ const en2=mcS(k+2); k=en2+1; } // barre d'errore
      } else k++;
    }
    j=g.e+1;
  } else if (S.startsWith('table',j) || S.startsWith('file',j)){
    // dati in linea, da \pgfplotstableread o da un file caricato accanto al .tex
    const isFile = S.startsWith('file',j);
    j=skipWS(j+(isFile?4:5),e); let toptText='';
    if (S[j]==='['){ const en=mcS(j); toptText=S.slice(j+1,en); j=skipWS(en+1,e); }
    let txt; const g=readGroup(j);
    if (g){ txt=g.text; j=g.e+1; }
    else { const m=/^\\[a-zA-Z@]+/.exec(S.slice(j,e)); if(!m){ ctx.warn('table: dati attesi tra { }'); return; } txt=m[0]; j+=m[0].length; }
    const tb=tableText(txt, ctx); if (!tb) return;
    const topt=axisOptMap((tb.opts?tb.opts+',':'')+toptText, ctx);
    let rows = tableRows(tb.text, topt, ctx, tb.file);
    let head=null; if (rows.length && topt.header!=='false' && rows[0].some(c=>isNaN(parseFloat(c)) && symX(c)===null)){ head=rows.shift(); }
    if (!rows.length) ctx.warn((tb.file?'«'+tb.file+'»':'la tabella')+' non contiene righe di dati');
    const ci = (k,d)=>{ if (topt[k]===undefined) return d; if (head){ const n=head.indexOf(String(topt[k]).trim()); if(n>=0) return n; } const n=parseInt(topt[k+' index']??topt[k]); return isNaN(n)?d:n; };
    const xi = topt['x index']!==undefined ? +topt['x index'] : ci('x',0), yi = topt['y index']!==undefined ? +topt['y index'] : ci('y',1);
    const yexpr = topt['y expr'], xexpr = topt['x expr'];
    for (const r of rows){
      let x = symX(r[xi]); if (x===null) x=parseFloat(r[xi]); let y=parseFloat(r[yi]);
      const rowVars = {...vars}; if (head) head.forEach((h,k)=>{ rowVars['thisrow_'+h]=r[k]; });
      try{
        if (xexpr) x=evalExpr(String(xexpr).replace(/\\thisrow\{([^}]*)\}/g,(m,h)=>'('+(r[head?head.indexOf(h):0])+')').replace(/\\coordindex/g,String(pts.length)),vars,trigO);
        if (yexpr) y=evalExpr(String(yexpr).replace(/\\thisrow\{([^}]*)\}/g,(m,h)=>'('+(r[head?head.indexOf(h):1])+')').replace(/\\coordindex/g,String(pts.length)),vars,trigO);
      }catch(err){ ctx.warn(err.message); }
      pts.push([x,y]);
    }
  } else if (S.startsWith('fill between',j)){
    j=skipWS(j+12,e); let fo={};
    if (S[j]==='['){ const en=mcS(j); fo=axisOptMap(S.slice(j+1,en),ctx); j=en+1; }
    if (collect) return;
    const m=/^\s*(\S+)\s+and\s+(\S+)\s*$/.exec(String(fo.of||''));
    if (!m){ ctx.warn('fill between: serve of=A and B'); return; }
    const A=ax.named[m[1]], B=ax.named[m[2]];
    if (!A||!B){ ctx.warn('fill between: percorsi «name path» non trovati'); return; }
    const fst = cloneStyle(st); fst.draw=undefined; if (!optText || fst.fill===undefined){ fst.fill = fst.fill||true; } if (!plus && !optText){ fst.color=[.5,.5,.5]; }
    let poly = A.concat(B.slice().reverse());
    if (fo['soft clip']){ const sc=/domain\s*=\s*([^:]+):(.+)/.exec(String(fo['soft clip'])); if (sc){ const a=+evalExpr(sc[1],vars), b2=+evalExpr(sc[2],vars); const pa=ax.frame.map(a,ax.lim.ymin)[0], pb=ax.frame.map(b2,ax.lim.ymin)[0]; poly=poly.filter(p=>p[0]>=Math.min(pa,pb)-1e-9 && p[0]<=Math.max(pa,pb)+1e-9); } }
    const ps = {st:fst, subs:[{start:poly[0], ops:poly.slice(1).map(p=>({t:'L',p})), closed:true}], extraSVG:[], edges:[], nodes:[], sIdx, noArrows:true};
    const clip = ax.clipId ? ` clip-path="url(#${ax.clipId})"` : '';
    emit(ctx, `<g data-s="${sIdx}"${clip}>${pathSVG(ps,ctx).svg}</g>`);
    if (!forget) ax.plots.push({pts:[], st:fst, legendOnly:true, area:true});
    return;
  } else if (S.startsWith('gnuplot',j) || S.startsWith('shell',j)){
    ctx.warn('\\addplot '+S.slice(j,j+7).trim()+' non supportato'); return;
  } else { ctx.warn('\\addplot: dati non riconosciuti'); return; }
  // filtri
  pts = pts.map(p=>{
    let [x,y]=p;
    if (!isFinite(x)||!isFinite(y)) return null;
    if (restrictY && (y<restrictY[0]||y>restrictY[1])) return null;
    if (restrictX && (x<restrictX[0]||x>restrictX[1])) return null;
    if ((ax.logx && x<=0) || (ax.logy && y<=0)) return null;
    return p;
  });
  const plot = {pts, st, bar:isBar, barDir};
  if (!forget) ax.plots.push(plot);
  if (collect) return;
  // geometria in pagina
  const F = ax.frame;
  const segs=[]; let cur=[];
  for (const p of pts){ if (!p){ if(cur.length) segs.push(cur); cur=[]; } else cur.push(p); }
  if (cur.length) segs.push(cur);
  const ps = {st, subs:[], extraSVG:[], edges:[], nodes:[], sIdx, noArrows:false};
  const onlyMarks = st.kv['only marks']!==undefined;
  const constPlot = st.kv['const plot']!==undefined || st.kv['const plot mark left']!==undefined || st.kv['jump mark left']!==undefined;
  const closed = /\\closedcycle/.test(S.slice(j,e)) || st.kv['area style']!==undefined;
  if (st.kv['area style']!==undefined && st.fill===undefined){ st.fill=true; st.fop=Math.min(st.fop,1); }
  if (isBar){
    const bwk = st.kv['bar width']||ax.o['bar width']; const bwid = bwk ? evalLen(String(bwk),ctx.vars,PT) : 10*PT;
    const nb = Math.max(1, ax.nBar); const k = ax.barIdx++;
    const shiftK = ax.stacked ? 0 : (k-(nb-1)/2)*(bwid+2*PT);
    const bsh = st.kv['bar shift']!==undefined ? evalLen(String(st.kv['bar shift']),ctx.vars,PT) : (ax.o['bar shift']!==undefined ? evalLen(String(ax.o['bar shift']),ctx.vars,PT) : shiftK);
    if (st.fill===undefined) st.fill = st.color.map(v=>v*.3+.7);
    const nnc = ax.o['nodes near coords']!==undefined || st.kv['nodes near coords']!==undefined;
    for (const p of pts){ if(!p) continue;
      const base = ax.stacked ? (ax.stackBase[p[0]]||0) : 0;
      const yv = p[1]+base;
      let a,b2,c,d;
      if (barDir==='x'){
        const yy=F.map(base>0||!ax.logx?Math.max(base,ax.logx?Math.pow(10,ax.lim.xmin):0):0, p[1]);
        const pb=F.map(ax.logx?Math.pow(10,ax.lim.xmin):base, p[1]), pt=F.map(p[0]+base, p[1]);
        const n=V.mul(F.lin(0,1), 1/V.len(F.lin(0,1)));
        const o2=V.add(V.mul(n,bsh), [0,0]);
        a=V.add(V.add(pb,o2),V.mul(n,-bwid/2)); b2=V.add(V.add(pt,o2),V.mul(n,-bwid/2)); c=V.add(V.add(pt,o2),V.mul(n,bwid/2)); d=V.add(V.add(pb,o2),V.mul(n,bwid/2));
      } else {
        const y0 = ax.logy ? Math.pow(10,ax.lim.ymin) : (ax.stacked?base:Math.max(Math.min(0,ax.lim.ymax),ax.lim.ymin));
        const pb=F.map(p[0], y0), pt=F.map(p[0], yv);
        const n=V.mul(F.lin(1,0), 1/V.len(F.lin(1,0)));
        a=V.add(pb,V.mul(n,bsh-bwid/2)); b2=V.add(pt,V.mul(n,bsh-bwid/2)); c=V.add(pt,V.mul(n,bsh+bwid/2)); d=V.add(pb,V.mul(n,bsh+bwid/2));
      }
      ps.subs.push({start:a, ops:[{t:'L',p:b2},{t:'L',p:c},{t:'L',p:d}], closed:true});
      if (nnc){ const nst=nodeBaseStyle(newStyle(),ctx,'node'); nst.anchor=barDir==='x'?'west':'south'; nst.isep=[2*PT,2*PT]; if (ax.o['every node near coord']) applyOpts(nst,String(ax.o['every node near coord']),ctx); const tp=V.lerp(b2,c,.5); ps.nodes.push(Object.assign(buildNode(nst,'$'+tickNum(p[1])+'$',tp,ctx),{idx:-1})); }
      if (ax.stacked) ax.stackBase[p[0]] = yv;
    }
    ps.noArrows=true;
  } else if (!onlyMarks){
    for (const sg of segs){
      let pp = sg.map(p=>F.map(p[0],p[1]));
      if (constPlot && pp.length>1){ const q=[pp[0]]; for (let k=1;k<pp.length;k++){ q.push([pp[k][0],pp[k-1][1]]); q.push(pp[k]); } pp=q; }
      if (ax.o['ycomb']!==undefined || st.kv.ycomb!==undefined){ for (const p of sg){ ps.subs.push({start:F.map(p[0],ax.logy?Math.pow(10,ax.lim.ymin):0), ops:[{t:'L',p:F.map(p[0],p[1])}]}); } continue; }
      const sub = {start:pp[0], ops:[], closed:false};
      if (st.smooth && pp.length>2) for (const [c1,c2,p] of smoothBez(pp, st.tension)) sub.ops.push({t:'C',c1,c2,p});
      else for (const p of pp.slice(1)) sub.ops.push({t:'L',p});
      if (closed){ const y0=ax.logy?Math.pow(10,ax.lim.ymin):clamp(0,ax.lim.ymin,ax.lim.ymax); const x1=sg[sg.length-1][0], x0=sg[0][0]; sub.ops.push({t:'L',p:F.map(x1,y0)},{t:'L',p:F.map(x0,y0)}); sub.closed=true; }
      ps.subs.push(sub);
    }
    if (st.kv['name path']) ax.named[String(st.kv['name path'])] = segs.flat().map(p=>F.map(p[0],p[1]));
  }
  const mark = st.kv.mark && st.kv.mark!==true ? String(st.kv.mark) : (onlyMarks ? '*' : null);
  if (mark && mark!=='none' && st.kv['no marks']===undefined && st.kv['no markers']===undefined && ax.o['no marks']===undefined)
    ps.extraSVG.push(marksSVG(pts.filter(Boolean).map(p=>F.map(p[0],p[1])), st, mark));
  if (st.kv['name path'] && onlyMarks) ax.named[String(st.kv['name path'])] = pts.filter(Boolean).map(p=>F.map(p[0],p[1]));
  // nodi dopo i dati: node[pos=..]{...}
  const rest = S.slice(j, e);
  const nm = /node\s*(\[[^\]]*\])?\s*\{/.exec(rest);
  if (nm && segs.length){
    const k0 = j + nm.index + nm[0].length - 1; const en = mcS(k0);
    const nst = nodeBaseStyle(newStyle(), ctx, 'node'); nst.color = st.color;
    if (nm[1]) applyOpts(nst, nm[1].slice(1,-1), sctx);
    const all = segs.flat().map(p=>F.map(p[0],p[1]));
    const t = nst.pos!==null ? nst.pos : 1; const idx=t*(all.length-1); const k=Math.floor(idx); const f=idx-k;
    const p = all[Math.min(all.length-1,k)], q=all[Math.min(all.length-1,k+1)];
    const n = buildNode(nst, S.slice(k0+1,en), V.lerp(p,q,f), ctx); n.idx=-1;
    ps.nodes.push(n);
  }
  plot.legendSt = st; plot.mark = mark; plot.onlyMarks = onlyMarks;
  // maniglie
  for (const h of handles){
    if (!h.lx || !h.ly) continue;
    R.handles.push({h:{kind:'abs', x:h.lx, y:h.ly, frame:F}, p:F.map(h.x,h.y), stmt:sIdx, role:'pt'});
  }
  ps.extraSVG = ps.extraSVG.concat(ps.nodes.map(n=>nodeSVG(n))); ps.nodes=[];
  const clip = ax.clipId ? ` clip-path="url(#${ax.clipId})"` : '';
  const main = pathSVG(ps, ctx);
  emit(ctx, `<g data-s="${sIdx}"${clip}>${main.svg}</g>`);
}
function legendSVG(ax, ctx){
  const o=ax.o;
  let entries = [];
  const plots = ax.plots.filter(p=>!p.forget);
  if (ax.legendList) entries = ax.legendList.map((t,k)=>({text:t, plot:plots[k]})).filter(x=>x.plot && x.text!=='');
  else if (o['legend entries']) entries = splitTop(String(o['legend entries'])).map((t,k)=>({text:unbrace(t), plot:plots[k]})).filter(x=>x.plot && x.text!=='');
  else entries = ax.legend.filter(x=>x.plot);
  if (!entries.length) return '';
  const lst = newStyle(); lst.draw=true; lst.fill=[1,1,1]; lst.lw=.4*PT;
  let atRel = [.97,.97], anchor='north east';
  const lp = o['legend pos'];
  const posMap = {'north east':[[.97,.97],'north east'],'north west':[[.03,.97],'north west'],'south east':[[.97,.03],'south east'],'south west':[[.03,.03],'south west'],'outer north east':[[1.03,1],'north west']};
  if (lp && posMap[lp]) [atRel,anchor]=posMap[lp];
  let cols = 1;
  if (o['legend style']){
    const ls = axisOptMap(String(o['legend style']), ctx);
    if (ls.at){ const t=String(ls.at).replace(/[{}()]/g,''); const q=t.split(','); atRel=[+q[0],+q[1]]; }
    if (ls.anchor) anchor = ls.anchor;
    if (ls['legend columns']) cols = +ls['legend columns'];
    const rest = String(o['legend style']).replace(/at\s*=\s*\{[^}]*\}/,'').replace(/anchor\s*=\s*[^,]*/,'');
    applyOpts(lst, rest, ctx);
  }
  if (o['legend columns']) cols = +o['legend columns'];
  if (cols<1) cols=entries.length;
  const tn = entries.map(en=>{ const s=nodeBaseStyle(newStyle(),ctx,'node'); s.anchor='west'; s.isep=[2*PT,1.5*PT]; if (o['legend cell align']) s.align=o['legend cell align']; return buildNode(s, en.text, [0,0], ctx); });
  const sampleW = .6, pad=3*PT, gap=4*PT;
  const rowH = Math.max(...tn.map(n=>2*n.hh), .35);
  const colW = Math.max(...tn.map(n=>2*n.hw)) + sampleW + gap;
  const nrow = Math.ceil(entries.length/cols);
  const W = cols*colW + pad*2 - gap + pad, H = nrow*rowH + pad*2;
  const ancF = {'north east':[1,1],'north west':[0,1],'south east':[1,0],'south west':[0,0],'north':[.5,1],'south':[.5,0],'east':[1,.5],'west':[0,.5],'center':[.5,.5]}[anchor]||[1,1];
  const apt = ax.rel(atRel[0], atRel[1]);
  const F = ctx.frame; const ex = V.mul(F.lin(1,0),1/V.len(F.lin(1,0))), ey = V.mul(F.lin(0,1),1/V.len(F.lin(0,1)));
  const org = V.sub(V.sub(apt, V.mul(ex, ancF[0]*W)), V.mul(ey, ancF[1]*H));
  const L = (x,y)=>V.add(org, V.add(V.mul(ex,x), V.mul(ey,y)));
  const pt = paint(lst);
  let out = `<path d="${ptsPath([L(0,0),L(W,0),L(W,H),L(0,H)])}" fill="${pt.fill}" stroke="${pt.stroke}"${pt.a}/>`;
  entries.forEach((en,k)=>{
    const r=Math.floor(k/cols), c=k%cols;
    const y = H - pad - rowH*(r+.5), x = pad + c*colW;
    const p = en.plot; const st = cloneStyle(p.legendSt||p.st);
    if (p.bar || p.area){
      const bst=cloneStyle(st); bst.arrows=['',''];
      const sq=[L(x+.15,y-.1),L(x+.45,y-.1),L(x+.45,y+.12),L(x+.15,y+.12)];
      const ps2={st:bst, subs:[{start:sq[0],ops:sq.slice(1).map(q=>({t:'L',p:q})),closed:true}], extraSVG:[], edges:[], nodes:[], noArrows:true};
      out += pathSVG(ps2, ctx, false).svg;
    } else {
      if (!p.onlyMarks){ const lst2=cloneStyle(st); lst2.arrows=['','']; lst2.fill=undefined; const ps2={st:lst2, subs:[{start:L(x,y),ops:[{t:'L',p:L(x+sampleW,y)}]}], extraSVG:[], edges:[], nodes:[], noArrows:true}; out += pathSVG(ps2,ctx,false).svg; }
      if (p.mark && p.mark!=='none') out += marksSVG([L(x+sampleW/2,y)], st, p.mark);
    }
    const n = tn[k]; const d = V.sub(L(x+sampleW+gap*.5, y), n.c); n.c = V.add(n.c, d); n.c = V.add(n.c, V.rot([n.hw,0], 0)); n.c=V.sub(n.c,[n.hw,0]);
    const al = anchorLocal(n,'west'); n.c = V.sub(L(x+sampleW+gap*.5,y), al);
    out += nodeSVG(n);
  });
  return out;
}
