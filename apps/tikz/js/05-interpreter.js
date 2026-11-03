/* ============ INTERPRETE ============ */
let S = '';           // sorgente intera
let R = null;         // stato del rendering corrente
let HITW = .25;       // larghezza area di click (cm), aggiornata dallo zoom
let DATA = {};        // file di dati caricati accanto al .tex: nome → testo
function newRender(){ return {out:[], bg:[], names:{}, handles:[], stmts:[], stmtByStart:new Map(), warns:[], nodes:[], axes:[], clipN:0, ops:0, tables:{}, dataUsed:new Set(), pins:[]}; }

/* ---------- dati da file esterni ---------- */
const DATA_EXT = /\.(csv|dat|txt|tsv|data|tab)$/i;
const baseName = f => String(f).trim().replace(/^.*[\\/]/,'');
function dataFile(name){
  const n=String(name).trim();
  if (DATA[n]!==undefined) return n;
  const b=baseName(n); if (DATA[b]!==undefined) return b;
  const lc=Object.keys(DATA).find(k=>k.toLowerCase()===b.toLowerCase());
  return lc || null;
}
/* testo della tabella: dati in linea, macro di \pgfplotstableread o nome di file; null se mancante */
function tableText(txt, ctx){
  const t=txt.trim();
  const mm=/^\\([a-zA-Z@]+)$/.exec(t);
  if (mm){ const tb=R.tables[mm[1]]; if (!tb){ ctx.warn('tabella \\'+mm[1]+' non definita: usa \\pgfplotstableread'); return null; } return tb; }
  if (/^[^\s{}\\%]+$/.test(t) && (DATA_EXT.test(t) || !/^[-+\d.eE]+$/.test(t))){
    const k=dataFile(t); R.dataUsed.add(baseName(t));
    if (k===null){ ctx.warn(`file «${baseName(t)}» non caricato: aprilo con «Dati» (o trascinalo) insieme al .tex`); return null; }
    return {text:DATA[k], opts:'', file:k};
  }
  return {text:txt, opts:''};
}
/* righe e colonne di una tabella pgfplots */
function tableRows(text, topt, ctx, file){
  const sk = parseInt(topt['skip first n'])||0;
  let lines = topt['row sep']==='\\\\' ? text.split('\\\\') : text.split(/\r?\n|\\\\/);
  lines = lines.map(r=>r.trim()).filter(r=>r && !/^[#%]/.test(r)).slice(sk);
  const cs = String(topt['col sep']||'space').trim();
  let sep = {comma:/\s*,\s*/, semicolon:/\s*;\s*/, tab:/\t/, colon:/\s*:\s*/, ampersand:/\s*&\s*/, braces:/\}\s*\{/}[cs] || /\s+/;
  if (cs==='space' && lines.length && lines.every(l=>/,/.test(l) && !/\s/.test(l.replace(/,\s+/g,',')))){
    ctx.warn((file?'«'+file+'»':'la tabella')+' è separata da virgole: aggiungi col sep=comma alle opzioni di table');
    sep = /\s*,\s*/;
  }
  return lines.map(l=>l.replace(/\s+%.*$/,'').replace(/^\{|\}$/g,'').split(sep).map(c=>c.trim().replace(/^"(.*)"$/,'$1')));
}

function skipWS(i, b=S.length){
  for(;;){
    while (i<b && /\s/.test(S[i])) i++;
    if (S[i]==='%'){ while(i<b && S[i]!=='\n') i++; continue; }
    return i;
  }
}
function readCmd(i){ const m=/^\\([a-zA-Z@]+\*?|.)/.exec(S.slice(i,i+60)); return m ? {name:m[1], end:i+m[0].length} : {name:'', end:i+1}; }
function mcS(i){
  // indice della parentesi di chiusura corrispondente in S (con commenti)
  const o=S[i], c={'{':'}','(':')','[':']'}[o]; let d=0;
  for (let j=i;j<S.length;j++){
    const ch=S[j];
    if (ch==='\\'){ j++; continue; }
    if (ch==='%'){ while(j<S.length && S[j]!=='\n') j++; continue; }
    if (o==='['){ if(ch==='{'){ const k=mcS(j); if(k<0) return -1; j=k; continue; } }
    if (o==='('){ if(ch==='{'){ const k=mcS(j); if(k<0) return -1; j=k; continue; } }
    if (ch===o) d++; else if (ch===c){ d--; if(!d) return j; }
  }
  return -1;
}
function stmtEnd(i, b){
  // fine istruzione: ';' a profondità 0
  let d=0;
  for (let j=i;j<b;j++){
    const ch=S[j];
    if (ch==='\\'){ j++; continue; }
    if (ch==='%'){ while(j<b && S[j]!=='\n') j++; continue; }
    if (ch==='{'||ch==='[') d++; else if (ch==='}'||ch===']') d--;
    else if (ch===';' && d<=0) return j;
    if (d<0) return -1;
  }
  return -1;
}
function findEnd(env, i, b){
  // indice di \end{env} corrispondente a partire da i (dopo \begin{env})
  const re=/\\(begin|end)\s*\{([^}]*)\}/g; re.lastIndex=i; let d=1, m;
  while ((m=re.exec(S)) && m.index<b){
    if (m[2]!==env) continue;
    if (m[1]==='begin') d++; else { d--; if(!d) return {s:m.index, e:m.index+m[0].length}; }
  }
  return null;
}
function lineOf(pos){ let n=1; for(let k=0;k<pos && k<S.length;k++) if(S[k]==='\n') n++; return n; }
function mkWarn(pos, kind='w'){ return msg => { if (R.warns.length<200 && !R.warns.some(w=>w.msg===msg && w.pos===pos)) R.warns.push({pos, msg, kind}); }; }
function readOpt(i){ i=skipWS(i); if (S[i]==='['){ const e=mcS(i); if(e<0) return null; return {s:i, e, text:S.slice(i+1,e)}; } return null; }
function readGroup(i){ i=skipWS(i); if (S[i]==='{'){ const e=mcS(i); if(e<0) return null; return {s:i, e, text:S.slice(i+1,e)}; } return null; }

function childCtx(ctx, optText, warnFn){
  const c = {...ctx, style:cloneStyle(ctx.style), styles:{...ctx.styles}, vars:ctx.vars, scope:{clip:ctx.scope?ctx.scope.clip:null}};
  if (optText){ const M = applyOpts(c.style, optText, {vars:c.vars, styles:c.styles, warn:warnFn||ctx.warn}); c.frame = composeFrame(ctx.frame, M); c.style.nodeRot = ctx.style.nodeRot + (mAngle(M)||0); }
  return c;
}
function composeFrame(f, M){
  if (M===M_ID || (M[0]===1&&M[1]===0&&M[2]===0&&M[3]===1&&M[4]===0&&M[5]===0)) return f;
  if (f.mat) return affineFrame(mMul(f.mat, M));
  const inv=mInv(M);
  return {...f, mat:null, map:(x,y)=>f.map(...mApp(M,x,y)), lin:(x,y)=>f.lin(...mLin(M,x,y)), inv:(x,y)=>mApp(inv,...f.inv(x,y)), invLin:(x,y)=>mLin(inv,...f.invLin(x,y))};
}
function stmtRec(start, end, cmd, cmdEnd){
  let k = R.stmtByStart.get(start);
  if (k===undefined){ k=R.stmts.length; R.stmts.push({start, end, cmd, cmdEnd, opts:null, nodes:[]}); R.stmtByStart.set(start,k); }
  return k;
}
function emit(ctx, svg){ (ctx.layer==='bg' ? R.bg : R.out).push(svg); }

/* esegue le istruzioni in S[a,b) */
function run(a, b, ctx){
  let i=a, guard=0;
  while (i<b && guard++<100000){
    if (++R.ops > 400000) { ctx.warn('figura troppo complessa: rendering interrotto'); return; }
    i = skipWS(i,b); if (i>=b) break;
    const ch=S[i];
    if (ch==='{'){ const e=mcS(i); if(e<0||e>b){ mkWarn(i,'e')('graffa { non chiusa'); return; } run(i+1,e,childCtx(ctx)); i=e+1; continue; }
    if (ch==='}'||ch===';'){ i++; continue; }
    if (ch!=='\\'){ const e=stmtEnd(i,b); mkWarn(i)('testo inatteso ignorato'); i = e<0 ? b : e+1; continue; }
    const cmd=readCmd(i); const name=cmd.name; const warn=mkWarn(i);
    const lctx = {...ctx, warn};
    switch(name){
      case 'draw': case 'fill': case 'filldraw': case 'path': case 'shade': case 'shadedraw': case 'clip': case 'pattern':
      case 'node': case 'coordinate': case 'matrix': case 'graph': case 'pic': case 'useasboundingbox': case 'datavisualization': {
        let e = stmtEnd(cmd.end, b);
        if (e<0){ mkWarn(i,'e')('manca il «;» alla fine di \\'+name); e=b; }
        if (ctx.collectOnly){ i=e+1; break; }
        try { pathStmt(i, name, cmd.end, e, lctx); } catch(err){ mkWarn(i,'e')(err.message||String(err)); if(!(err instanceof MathErr)) console.error(err); }
        i=e+1; break; }
      case 'foreach': { i = foreachStmt(i, cmd.end, b, lctx, (s,e,c)=>run(s,e,c)); break; }
      case 'begin': {
        const g=readGroup(cmd.end); if(!g){ i=cmd.end; break; }
        const env=g.text.trim(); const en=findEnd(env, g.e+1, b);
        if (!en){ mkWarn(i,'e')('\\begin{'+env+'} senza \\end'); return; }
        if (/^(scope|pgfonlayer|tikzpicture|tikzfadingfrompicture)$/.test(env)){
          let j=g.e+1; let op=null;
          if (env==='pgfonlayer'){ const g2=readGroup(j); if(g2) j=g2.e+1; }
          else { op=readOpt(j); if(op) j=op.e+1; }
          const c=childCtx(lctx, op&&op.text);
          if (env==='pgfonlayer') c.layer = (/background/.test(S.slice(g.e+1,j)) ? 'bg':ctx.layer);
          run(j, en.s, c);
        } else if (/^(axis|semilogxaxis|semilogyaxis|loglogaxis|polaraxis)$/.test(env)){
          try { runAxis(i, env, g.e+1, en.s, en.e, lctx); } catch(err){ mkWarn(i,'e')('axis: '+(err.message||err)); console.error(err); }
        } else if (/^(umlpackage|umlsystem|umlstate|umlcomponent|umlseqdiag|umlcall|umlcallself|umlfragment)$/.test(env)){
          const fn = env==='umlseqdiag' ? umlSeqEnv : /^umlcall/.test(env) ? umlSeqCall : env==='umlfragment' ? umlSeqFrag : umlEnv;
          if (!ctx.collectOnly) try { fn(i, env, g.e+1, en.s, en.e, lctx); } catch(err){ mkWarn(i,'e')(env+': '+(err.message||err)); console.error(err); }
        } else if (env==='groupplot'){ warn('groupplots non supportato'); }
        else warn('ambiente '+env+' ignorato');
        i=en.e; break; }
      case 'end': { const g=readGroup(cmd.end); i = g ? g.e+1 : cmd.end; break; }
      case 'tikzset': case 'pgfplotsset': case 'pgfkeys': {
        const g=readGroup(cmd.end); if(!g){ i=cmd.end; break; }
        if (name==='pgfplotsset') ctx.axisDefaults.push(g.text);
        else applyOpts(cloneStyle(ctx.style), g.text, {vars:ctx.vars, styles:ctx.styles, warn:()=>{}});
        i=g.e+1; break; }
      case 'tikzcdset': case 'ctikzset': {
        const g=readGroup(cmd.end); if(!g){ i=cmd.end; break; }
        if (name==='tikzcdset') (R.cdset=R.cdset||[]).push(subVars(g.text, ctx.vars)); else czSet(g.text, lctx);
        i=g.e+1; break; }
      case 'tikzstyle': {
        const g=readGroup(cmd.end); let j=g?g.e+1:cmd.end; j=skipWS(j,b); if(S[j]==='=') j++;
        const op=readOpt(j); if (g&&op){ ctx.styles[g.text.trim()]=op.text; j=op.e+1; }
        i=j; break; }
      case 'definecolor': {
        const a1=readGroup(cmd.end), a2=a1&&readGroup(a1.e+1), a3=a2&&readGroup(a2.e+1);
        if (a3){ defineColor(a1.text, a2.text, a3.text); i=a3.e+1; } else i=cmd.end; break; }
      case 'colorlet': {
        const a1=readGroup(cmd.end), a2=a1&&readGroup(a1.e+1);
        if (a2){ const c=parseColor(a2.text); if(c&&c!=='none') userColors[a1.text.trim()]=c; i=a2.e+1; } else i=cmd.end; break; }
      case 'def': case 'gdef': case 'edef': case 'xdef': {
        const m=/^\\([a-zA-Z@]+)/.exec(S.slice(cmd.end, cmd.end+40));
        if (!m){ i=cmd.end; break; }
        let j=cmd.end+m[0].length; while(j<b && S[j]!=='{') j++;
        const g=readGroup(j); if(g){ ctx.vars={...ctx.vars,[m[1]]:subVars(g.text.trim(),ctx.vars)}; i=g.e+1; } else i=j; break; }
      case 'newcommand': case 'renewcommand': case 'providecommand': {
        let j=skipWS(cmd.end,b); let nmv;
        if (S[j]==='{'){ const g=readGroup(j); nmv=g.text.trim(); j=g.e+1; } else { const m=/^\\[a-zA-Z@]+/.exec(S.slice(j)); nmv=m?m[0]:''; j+=nmv.length; }
        const op=readOpt(j); if(op){ j=op.e+1; warn('macro con argomenti non supportate'); }
        const g=readGroup(j); if(g){ ctx.vars={...ctx.vars,[nmv.replace(/^\\/,'')]:g.text.trim()}; i=g.e+1; } else i=j; break; }
      case 'pgfmathsetmacro': case 'pgfmathtruncatemacro': case 'pgfmathparse': case 'pgfmathsetlengthmacro': {
        let j=skipWS(cmd.end,b); let nmv='pgfmathresult';
        if (name!=='pgfmathparse'){ if(S[j]==='{'){ const g=readGroup(j); nmv=g.text.trim().replace(/^\\/,''); j=g.e+1; } else { const m=/^\\([a-zA-Z@]+)/.exec(S.slice(j)); nmv=m?m[1]:''; j+=m?m[0].length:0; } }
        const g=readGroup(j);
        if (g){
          try{ let v=evalExpr(g.text, ctx.vars); if(name==='pgfmathtruncatemacro') v=Math.trunc(v); if(name==='pgfmathsetlengthmacro') v=v/PT; ctx.vars={...ctx.vars,[nmv]:fmt(v,6)}; }
          catch(err){ warn(err.message); }
          i=g.e+1;
        } else i=j;
        break; }
      case 'usetikzlibrary': case 'usepgfplotslibrary': case 'pgfdeclarelayer': case 'pgfsetlayers': case 'usepackage': case 'centering': case 'small': case 'footnotesize': case 'scriptsize': case 'tiny': case 'large': case 'Large': case 'normalsize':
      case 'pgfplotstableread': {
        // \pgfplotstableread[opzioni]{dati o file}\macro  (anche {\macro})
        let j=cmd.end; const op=readOpt(j); if (op) j=op.e+1;
        const g=readGroup(j); if (!g){ i=cmd.end; break; } j=skipWS(g.e+1,b);
        let nm=null; const g2 = S[j]==='{' ? readGroup(j) : null;
        const m=/^\\([a-zA-Z@]+)/.exec(g2 ? g2.text.trim() : S.slice(j,j+60));
        if (m){ nm=m[1]; j = g2 ? g2.e+1 : j+m[0].length; }
        if (!nm){ warn('\\pgfplotstableread: manca il nome della macro'); i=j; break; }
        const tb=tableText(g.text, lctx);
        if (tb) R.tables[nm]={text:tb.text, opts:op?op.text:'', file:tb.file};
        i=j; break; }
      case 'label': case 'caption': case 'resizebox': case 'scalebox': case 'tikzexternalize': case 'makeatletter': case 'makeatother': case 'pgfdeclarepatternformonly': case 'tikzfading': case 'newlength': case 'setlength': case 'pgfmathdeclarefunction': {
        let j=cmd.end; for(let k=0;k<4;k++){ const jj=skipWS(j,b); if(S[jj]==='{'||S[jj]==='['){ const e=mcS(jj); if(e<0) break; j=e+1; } else break; }
        i=j; break; }
      case 'addplot': case 'addplot+': case 'addplot3': case 'addplot3+': case 'legend': case 'addlegendentry': case 'closedcycle':
        if (ctx.axis){ i = axisCmd(i, name, cmd.end, b, lctx); }
        else { mkWarn(i,'e')('\\'+name+' fuori da un ambiente axis'); const e=stmtEnd(cmd.end,b); i=e<0?b:e+1; }
        break;
      case 'pgfplotsinvokeforeach': {
        const g=readGroup(cmd.end), body=g&&readGroup(g.e+1);
        if (body){ for (const v of expandList(g.text, ctx.vars)){ const vv=v; const orig=S; /* #1 sostituito testualmente */
          warn('\\pgfplotsinvokeforeach: #1 non sostituito'); break; } i=body.e+1; } else i=cmd.end; break; }
      default: {
        if (/^(uml|tikzumlset$)/.test(name)){ i = umlCmd(i, name, cmd.end, b, lctx); break; }
        warn('comando \\'+name+' non supportato');
        const e=stmtEnd(cmd.end,b); const nl=S.indexOf('\n',cmd.end);
        i = (e>=0 && (nl<0 || e<nl+200)) ? e+1 : (nl<0?b:nl+1);
      }
    }
  }
}
/* ---------- \foreach ---------- */
function expandList(text, vars){
  text = text.trim();
  if (/^\\[a-zA-Z@]+$/.test(text) && vars[text.slice(1)]!==undefined) text=String(vars[text.slice(1)]);
  const items=splitTop(text).map(s=>s.trim()).filter(s=>s!=='');
  const out=[];
  const num = s => { try{ const v=evalExpr(s,vars); return isFinite(v)?v:null; }catch(e){ return null; } };
  for (let k=0;k<items.length;k++){
    const it=items[k];
    if (it==='...' || it==='…'){
      const prev=items[k-1], next=items[k+1]; if(prev===undefined||next===undefined) continue;
      if (/^[a-zA-Z]$/.test(prev) && /^[a-zA-Z]$/.test(next)){
        for (let c=prev.charCodeAt(0)+1; c<=next.charCodeAt(0); c++) out.push(String.fromCharCode(c));
        k++; continue;
      }
      const pv=num(prev), nv=num(next); if(pv===null||nv===null) continue;
      const pp = k>=2 ? num(items[k-2]) : null;
      let step = pp!==null && k>=2 && items[k-2]!=='...' ? pv-pp : (nv>=pv?1:-1);
      if (!step) step=1;
      const n=Math.floor((nv-pv)/step+1e-9);
      for (let j=1;j<=n && j<5000;j++) out.push(fmt(pv+step*j,6));
      if (Math.abs(pv+step*n-nv)>1e-9 && n>=0) {} // TikZ si ferma prima di superare
      k++; // salta next (già incluso se raggiunto)
      if (Math.abs(pv+step*n-nv)>1e-9) {}
      continue;
    }
    out.push(it);
  }
  return out;
}
function foreachStmt(cmdStart, i, b, ctx, body){
  // \foreach \x/\y [opzioni] in {lista} corpo
  i=skipWS(i,b);
  let vs=[];
  const vm=/^((?:\\[a-zA-Z@]+\s*\/?\s*)+)/.exec(S.slice(i,i+200));
  if (!vm){ ctx.warn('\\foreach: variabile mancante'); const e=stmtEnd(i,b); return e<0?b:e+1; }
  vs = vm[1].split('/').map(s=>s.trim().replace(/^\\/,''));
  i += vm[0].length; i=skipWS(i,b);
  let fopts=null; if (S[i]==='['){ const e=mcS(i); fopts=S.slice(i+1,e); i=e+1; i=skipWS(i,b); }
  if (S.slice(i,i+2)!=='in'){ ctx.warn('\\foreach: manca «in»'); const e=stmtEnd(i,b); return e<0?b:e+1; }
  i=skipWS(i+2,b);
  let listText;
  if (S[i]==='{'){ const e=mcS(i); listText=S.slice(i+1,e); i=e+1; }
  else { const m=/^\\[a-zA-Z@]+/.exec(S.slice(i)); listText=m?m[0]:''; i+=listText.length; }
  i=skipWS(i,b);
  let bs, be, next;
  if (S[i]==='{'){ const e=mcS(i); if(e<0){ ctx.warn('corpo del \\foreach non chiuso'); return b; } bs=i+1; be=e; next=e+1; }
  else if (S.slice(i,i+8)==='\\foreach'){ const sub=foreachExtent(i,b); bs=i; be=sub; next=sub; }
  else { const e=stmtEnd(i,b); bs=i; be= e<0?b:e+1; next=be; }
  const list = expandList(listText, ctx.vars);
  let count=0, evals=[], countVar=null, rem=null;
  if (fopts){
    for (const it of splitTop(fopts)){
      let m;
      if ((m=/count\s*=\s*\\([a-zA-Z@]+)(?:\s+from\s+(.+))?/.exec(it))){ countVar=m[1]; if(m[2]) count=+evalExpr(m[2],ctx.vars)-1; }
      else if ((m=/evaluate\s*=\s*\\([a-zA-Z@]+)(?:\s+as\s+\\([a-zA-Z@]+)\s+using\s+(.+))?/.exec(it))) evals.push([m[1],m[2]||m[1],m[3]||('\\'+m[1])]);
      else if ((m=/remember\s*=\s*\\([a-zA-Z@]+)\s+as\s+\\([a-zA-Z@]+)(?:\s*\(initially\s+([^)]*)\))?/.exec(it))) rem={v:m[1],as:m[2],init:m[3]||''};
    }
  }
  let remVal = rem ? rem.init : null;
  for (const item of list){
    const vals = vs.length>1 ? splitTop(item,'/') : [item];
    const vars={...ctx.vars};
    vs.forEach((v,k)=>{ let val=(vals[k]!==undefined?vals[k]:vals[vals.length-1]).trim(); if(val[0]==='{'&&val.endsWith('}')) val=val.slice(1,-1); vars[v]=val; });
    count++; if (countVar) vars[countVar]=String(count);
    if (rem) vars[rem.as]=remVal;
    for (const [src,as,ex] of evals){ try{ vars[as]=fmt(evalExpr(ex,vars),6); }catch(e){ ctx.warn(e.message); } }
    body(bs, be, {...ctx, vars});
    if (rem) remVal = vars[rem.v];
  }
  return next;
}
function foreachExtent(i,b){
  // estensione di un \foreach annidato come corpo di un altro
  const c=readCmd(i); let j=c.end;
  const m=/^\s*((?:\\[a-zA-Z@]+\s*\/?\s*)+)/.exec(S.slice(j,j+200)); if(m) j+=m[0].length;
  j=skipWS(j,b); if(S[j]==='['){ j=mcS(j)+1; j=skipWS(j,b); }
  j=skipWS(j+2,b);
  if (S[j]==='{') j=mcS(j)+1; else { const mm=/^\\[a-zA-Z@]+/.exec(S.slice(j)); j+=mm?mm[0].length:0; }
  j=skipWS(j,b);
  if (S[j]==='{') return mcS(j)+1;
  if (S.slice(j,j+8)==='\\foreach') return foreachExtent(j,b);
  const e=stmtEnd(j,b); return e<0?b:e+1;
}
