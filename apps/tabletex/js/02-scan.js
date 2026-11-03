/* ============ SCANSIONE: ambienti di tabella, specifica delle colonne, righe e celle ============
   Tre livelli distinti, come in Tavolo TikZ e Tavolo MathTeX:
   1. il SORGENTE (testo dell'utente, unica fonte di verità, mai riscritto per intero se non serve)
   2. il MODELLO (questa scansione: ogni riga, cella, regola e colonna con la sua posizione nel sorgente)
   3. la GRIGLIA (la vista modificabile tipo foglio di calcolo, ricavata dal modello)
   Il modello non si conserva: si ricava di nuovo dal sorgente dopo ogni modifica. */

/* argomenti dell'intestazione: w = {larghezza} obbligatoria, p = [posizione] facoltativa; poi sempre {specifica} */
const TABLE_ENVS = {'tabular':'p', 'tabular*':'wp', 'tabularx':'wp', 'tabulary':'wp', 'longtable':'p', 'longtable*':'p',
  'NiceTabular':'p', 'NiceTabular*':'wp', 'NiceTabularX':'wp', 'tblr':'p', 'longtblr':'p', 'talltblr':'p'};
/* tabularray: le celle unite si scrivono con \SetCell, non con \multicolumn e \multirow */
const TBLR_ENVS = new Set(['tblr','longtblr','talltblr']);
const NICE_ENVS = new Set(['NiceTabular','NiceTabular*','NiceTabularX']);
/* tabularray accetta anche {colspec={…}, altre chiavi}: la specifica delle colonne è il valore di colspec */
function tblrColspec(src, s, e){
  let d=0;
  for (let i=s;i<e;i++){
    const ch=src[i];
    if (ch==='\\'){ i++; continue; }
    if (ch==='{'){ d++; continue; } if (ch==='}'){ d--; continue; }
    if (d || !src.startsWith('colspec', i) || isLetter(src[i-1]) || isLetter(src[i+7])) continue;
    let j=skipWS(src, i+7, e); if (src[j]!=='=') continue;
    j=skipWS(src, j+1, e); if (src[j]!=='{') return null;
    const k=matchClose(src, j, e); return k<0 ? null : [j+1, k];
  }
  return null;
}

const isLetter = c => /[a-zA-Z@]/.test(c||'');
const isWS = c => c===' '||c==='\t'||c==='\n'||c==='\r';
function lineOf(src, pos){ let n=1; for (let k=0;k<pos&&k<src.length;k++) if (src.charCodeAt(k)===10) n++; return n; }

/* un commento va dal % alla fine della riga, a capo compreso */
function commentEnd(s, i, to=s.length){ const j=s.indexOf('\n', i); return (j<0||j>=to) ? to : j+1; }
/* sequenza di controllo in i (s[i]==='\\'): nome (lettere, oppure un solo carattere) e fine */
function readCs(s, i){
  if (isLetter(s[i+1])){ let j=i+2; while (isLetter(s[j])) j++; return {name:s.slice(i+1,j), e:j}; }
  const cc=s.charCodeAt(i+1); const j = (cc>=0xD800 && cc<=0xDBFF) ? i+3 : i+2;
  return {name:s.slice(i+1, Math.min(j, s.length)), e:Math.min(j, s.length)};
}
/* salta spazi, a capo e (se com) commenti */
function skipWS(s, i, to=s.length, com=true){
  for(;;){
    while (i<to && isWS(s[i])) i++;
    if (com && i<to && s[i]==='%'){ i=commentEnd(s,i,to); continue; }
    return i;
  }
}
/* chiusura corrispondente: s[i] è { [ oppure (. Le graffe interne contano sempre; commenti e caratteri protetti si saltano */
function matchClose(s, i, to=s.length){
  const o=s[i], c={'{':'}','[':']','(':')'}[o]; if (!c) return -1;
  let d=0;
  for (let j=i;j<to;j++){
    const ch=s[j];
    if (ch==='\\'){ j++; continue; }
    if (ch==='%'){ j=commentEnd(s,j,to)-1; continue; }
    if (o!=='{' && ch==='{'){ const k=matchClose(s,j,to); if (k<0) return -1; j=k; continue; }
    if (ch===o) d++;
    else if (ch===c){ d--; if (!d) return j; }
  }
  return -1;
}
/* nome di un ambiente dopo \begin o \end (posizione subito dopo il comando) */
function envName(s, i){
  const j=skipWS(s, i, s.length, false);
  if (s[j]!=='{') return null;
  const k=s.indexOf('}', j); if (k<0) return null;
  const name=s.slice(j+1,k).trim();
  return /^[a-zA-Z]+\*?$/.test(name) ? {name, e:k+1} : null;
}
/* tratto con contenuto vero (senza spazi e commenti ai bordi) dentro [s,e) */
function contentBounds(src, s, e){
  let first=-1, last=-1;
  for (let i=s;i<e;i++){
    const ch=src[i];
    if (ch==='\\'){ if (first<0) first=i; last=Math.min(e, readCs(src,i).e); i=last-1; continue; }
    if (ch==='%'){ i=commentEnd(src,i,e)-1; continue; }
    if (isWS(ch)) continue;
    if (first<0) first=i;
    last=i+1;
  }
  return first<0 ? null : [first, last];
}
/* toglie i commenti da un testo (per i confronti e l'anteprima) */
function stripComments(t){
  let out='';
  for (let i=0;i<t.length;i++){
    const ch=t[i];
    if (ch==='\\'){ const e=readCs(t,i).e; out+=t.slice(i,e); i=e-1; continue; }
    if (ch==='%'){ const e=commentEnd(t,i); i=e-1; while (i+1<t.length && (t[i+1]===' '||t[i+1]==='\t')) i++; continue; }
    out+=ch;
  }
  return out;
}

/* ---------- ambienti di tabella nel testo ---------- */
function findTables(src, from=0, to=src.length){
  const out=[]; let i=from;
  while (i<to){
    const c=src[i];
    if (c==='%'){ i=commentEnd(src,i,to); continue; }
    if (c==='\\'){
      const cs=readCs(src,i);
      if (cs.name==='begin'){
        const m=envName(src, cs.e);
        if (m && m.name in TABLE_ENVS){ const t=locateTable(src, i, m, to); if (t){ out.push(t); i=t.e; continue; } }
      }
      i=cs.e; continue;
    }
    i++;
  }
  return out;
}
/* intestazione e fine di un ambiente; null se l'intestazione è incompleta */
function locateTable(src, s, m, to=src.length){
  const pat=TABLE_ENVS[m.name]; let i=m.e; const t={env:m.name, s, w:null, pos:null};
  if (pat.includes('w')){ i=skipWS(src,i,to); if (src[i]!=='{') return null; const k=matchClose(src,i,to); if (k<0) return null; t.w=[i+1,k]; i=k+1; }
  { const j=skipWS(src,i,to); if (src[j]==='['){ const k=matchClose(src,j,to); if (k<0) return null; t.pos=[j+1,k]; i=k+1; } }
  i=skipWS(src,i,to); if (src[i]!=='{') return null;
  const k=matchClose(src,i,to); if (k<0) return null;
  t.spec=[i+1,k]; t.bs=k+1;
  if (TBLR_ENVS.has(m.name) && /=/.test(src.slice(i+1,k))){ const cs=tblrColspec(src, i+1, k); if (!cs) return null; t.spec=cs; t.kv=true; }
  /* NiceTabular: opzioni facoltative dopo la specifica */
  if (NICE_ENVS.has(m.name)){ const j=skipWS(src,t.bs,to); if (src[j]==='['){ const q=matchClose(src,j,to); if (q>0){ t.post=[j+1,q]; t.bs=q+1; } } }
  /* fine: \end dello stesso ambiente, contando quelli annidati */
  let d=1, j=t.bs;
  while (j<to){
    const ch=src[j];
    if (ch==='%'){ j=commentEnd(src,j,to); continue; }
    if (ch==='\\'){
      const cs=readCs(src,j);
      if (cs.name==='begin'||cs.name==='end'){
        const n=envName(src, cs.e);
        if (n && n.name===m.name){ if (cs.name==='begin') d++; else if (--d===0){ t.be=j; t.e=n.e; return t; } }
        if (n){ j=n.e; continue; }
      }
      j=cs.e; continue;
    }
    j++;
  }
  t.be=to; t.e=to; t.open=true;   /* manca \end: si mostra comunque, con un errore */
  return t;
}

/* ---------- specifica delle colonne ----------
   Le colonne vere (l c r p{} m{} b{} X S[] …) e i separatori (| @{} !{}); >{…} e <{…} si attaccano alla colonna.
   *{n}{…} si espande: le colonne ripetute ricordano il gruppo (star), che va scritto per esteso prima di modificarle. */
const COL_ARGS = {p:'{', m:'{', b:'{', w:'{{', W:'{{', D:'{{{', S:'[', s:'[', Q:'[', X:'['};
function parseSpec(src, s, e, star=null, out={cols:[], seps:[[]], items:[]}){
  let i=s, pre=null;
  const sepNow = () => out.seps[out.seps.length-1];
  while (i<e){
    i=skipWS(src,i,e); if (i>=e) break;
    const ch=src[i];
    if (ch==='|'){
      /* |[…] di tabularray: le opzioni restano attaccate al separatore */
      const j=skipWS(src,i+1,e); const k = src[j]==='[' ? matchClose(src,j,e) : -1;
      const it={k:'|', s:i, e:k<0 ? i+1 : k+1, star}; sepNow().push(it); out.items.push(it); i=it.e; continue;
    }
    if (ch==='@'||ch==='!'||ch==='>'||ch==='<'){
      const j=skipWS(src,i+1,e); const k = src[j]==='{' ? matchClose(src,j,e) : -1;
      const end = k<0 ? i+1 : k+1;
      const it={k:ch, s:i, e:end, arg: k<0 ? '' : src.slice(j+1,k), star};
      if (ch==='>') pre=it;
      else if (ch==='<'){ const c=out.cols[out.cols.length-1]; if (c){ c.post=it; c.fe=end; } }
      else sepNow().push(it);
      out.items.push(it); i=end; continue;
    }
    if (ch==='*'){
      let j=skipWS(src,i+1,e); const k1 = src[j]==='{' ? matchClose(src,j,e) : -1;
      if (k1<0){ i++; continue; }
      const n=parseInt(src.slice(j+1,k1).trim())||0;
      j=skipWS(src,k1+1,e); const k2 = src[j]==='{' ? matchClose(src,j,e) : -1;
      if (k2<0){ i=k1+1; continue; }
      const g={s:i, e:k2+1, n, inner:[j+1,k2], outer:star};
      for (let r=0;r<n;r++) parseSpec(src, j+1, k2, star||g, out);
      i=k2+1; continue;
    }
    /* colonna */
    const cs=i; let j=i+1; const pat=COL_ARGS[ch] || (src[skipWS(src,j,e)]==='{' && /[A-Z]/.test(ch) && ch!=='X' && ch!=='S' ? '{' : '');
    for (const a of pat){
      const q=skipWS(src,j,e);
      if (a==='['){ if (src[q]==='['){ const k=matchClose(src,q,e); if (k>0) j=k+1; } continue; }
      if (src[q]==='{'){ const k=matchClose(src,q,e); if (k>0) j=k+1; }
    }
    const col={type:ch, arg:src.slice(cs+1,j), cs, e:j, fs: pre? pre.s : cs, fe:j, pre, post:null, star};
    out.cols.push(col); out.seps.push([]); out.items.push(col);
    pre=null; i=j;
  }
  return out;
}
/* tipo di allineamento di una colonna per la griglia */
function colAlign(col){
  const t=col?.type||'l';
  /* Q[c] e X[2,r] di tabularray: l'allineamento è tra le opzioni */
  if ((t==='Q'||t==='X') && col.arg){ const o=/^\s*\[([^\]]*)\]/.exec(col.arg); const a=o && o[1].split(',').map(x=>x.trim()).find(x=>/^[lcrj]$/.test(x)); if (a) return a==='j' ? 'l' : a; }
  if (t==='c'||t==='C'||t==='m') return t==='m' ? 'l' : 'c';
  if (t==='r'||t==='R') return 'r';
  if (t==='S'||t==='s'||t==='D') return 'num';
  if (t==='X'||t==='p'||t==='b'||t==='J'||t==='L') return 'l';
  if (col?.pre && /\\(centering|raggedleft)/.test(col.pre.arg)) return /centering/.test(col.pre.arg)?'c':'r';
  return 'l';
}
/* forma normalizzata di un tratto di specifica (per i confronti) */
const normSpec = t => stripComments(t).replace(/\s+/g,'');

/* ---------- comandi tra una riga e l'altra: regole, longtable, colori ----------
   lettere degli argomenti: [ facoltativo, ( facoltativo tra tonde, { obbligatorio */
const RULES = {toprule:'[', midrule:'[', bottomrule:'[', cmidrule:'[({', morecmidrules:'', specialrule:'{{{', addlinespace:'[',
  hline:'', cline:'{', hhline:'{', firsthline:'', lasthline:'', Xhline:'{', Xcline:'{{', hdashline:'[', cdashline:'{',
  endhead:'', endfirsthead:'', endfoot:'', endlastfoot:'', noalign:'{', rowcolor:'[{', arrayrulecolor:'[{',
  pagebreak:'[', nopagebreak:'[', newpage:'', rowstyle:'{'};
const RANGE_RULES = new Set(['cmidrule','cline','cdashline','Xcline']);
/* legge le regole e i commenti prima delle celle di una riga; restituisce la posizione dopo */
function readPre(src, i, be, pre){
  for(;;){
    i=skipWS(src,i,be,false);
    if (i>=be) return i;
    if (src[i]==='%'){ const e=commentEnd(src,i,be); pre.push({k:'com', s:i, e, raw:src.slice(i,e)}); i=e; continue; }
    if (src[i]!=='\\') return i;
    const cs=readCs(src,i);
    if (!(cs.name in RULES)) return i;
    let j=cs.e; const it={k:'rule', cmd:cs.name, s:i};
    for (const a of RULES[cs.name]){
      const q=skipWS(src,j,be,false);
      const open = a==='[' ? '[' : a==='(' ? '(' : '{';
      if (src[q]!==open){ if (a==='{') break; continue; }
      const k=matchClose(src,q,be); if (k<0) break;
      if (a==='{' && RANGE_RULES.has(cs.name) && !it.range){
        const m=/^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(src.slice(q+1,k)); if (m) it.range={a:+m[1], b:+m[2], s:q+1, e:k};
      }
      j=k+1;
    }
    it.e=j; it.raw=src.slice(i,j); pre.push(it); i=j;
  }
}

/* ---------- corpo: righe e celle con la loro posizione ---------- */
function scanBody(src, bs, be){
  const rows=[]; let i=bs, fin=[];
  for(;;){
    const pre=[];
    i=readPre(src, i, be, pre);
    if (i>=be){ fin=pre; break; }
    const row={pre, s:i, cells:[], end:null};
    let cs=i, d=0, env=0, j=i;
    for(;;){
      if (j>=be){ row.cells.push(mkCell(src, cs, be)); i=be; break; }
      const ch=src[j];
      if (ch==='%'){ j=commentEnd(src,j,be); continue; }
      if (ch==='{'){ d++; j++; continue; }
      if (ch==='}'){ d--; j++; continue; }
      if (ch==='&' && d<=0 && env<=0){ row.cells.push(mkCell(src, cs, j)); cs=j+1; j++; continue; }
      if (ch==='\\'){
        const c=readCs(src,j);
        if ((c.name==='\\' || c.name==='tabularnewline' || c.name==='kill') && d<=0 && env<=0){
          row.cells.push(mkCell(src, cs, j));
          let k=c.e;
          if (c.name!=='kill'){
            if (c.name==='\\' && src[k]==='*') k++;
            const q=skipWS(src,k,be,false);
            if (src[q]==='['){ const z=matchClose(src,q,be); if (z>0) k=z+1; }
          }
          row.end={s:j, e:k, raw:src.slice(j,k), kill:c.name==='kill'}; i=k; break;
        }
        if (c.name==='begin'){ env++; } else if (c.name==='end'){ env--; }
        j=c.e; continue;
      }
      j++;
    }
    if (row.cells.length===1 && /^\\caption(of)?\b/.test(row.cells[0].v) ) row.special='caption';
    rows.push(row);
    if (i>=be){ break; }
  }
  return {rows, fin};
}
function mkCell(src, s, e){
  const b=contentBounds(src, s, e);
  const c={s, e, vs: b? b[0] : s, ve: b? b[1] : s};
  c.v=stripComments(src.slice(c.vs, c.ve));
  Object.assign(c, cellInner(src, c.vs, c.ve));
  c.t=stripComments(src.slice(c.cs, c.ce)).trim();
  return c;
}
/* \multicolumn{n}{spec}{…} e \multirow[pos]{n}[strut]{larghezza}[corr]{…}: argomenti e contenuto interno */
function readArgs(src, i, e, pat){
  const args=[];
  for (const a of pat){
    const q=skipWS(src,i,e);
    if (a==='['){ if (src[q]==='['){ const k=matchClose(src,q,e); if (k<0) return null; args.push([q+1,k]); i=k+1; } else args.push(null); continue; }
    if (src[q]!=='{') return null;
    const k=matchClose(src,q,e); if (k<0) return null;
    args.push([q+1,k]); i=k+1;
  }
  return {args, e:i};
}
function cellInner(src, s, e){
  const out={mc:null, mr:null, cs:s, ce:e};
  const at = (p, name) => src.startsWith('\\'+name, p) && !isLetter(src[p+name.length+1]);
  let p=s, q=e;
  if (at(p,'multicolumn')){
    const r=readArgs(src, p+12, q, '{{{');
    if (r && skipWS(src, r.e, q)===q){
      const [n, sp, ct]=r.args;
      out.mc={n:parseInt(src.slice(n[0],n[1]))||1, nS:n, spec:normSpec(src.slice(sp[0],sp[1])), specS:sp, s:p};
      const b=contentBounds(src, ct[0], ct[1]); p = b? b[0] : ct[0]; q = b? b[1] : ct[0];
    }
  }
  if (at(p,'multirow')){
    const r=readArgs(src, p+9, q, '[{[{[{');
    if (r && skipWS(src, r.e, q)===q){
      const [vp, n, , w, , ct]=r.args;
      out.mr={n:parseInt(src.slice(n[0],n[1]))||1, nS:n, w:normSpec(src.slice(w[0],w[1])), vpos: vp? src.slice(vp[0],vp[1]) : null, s:p};
      const b=contentBounds(src, ct[0], ct[1]); p = b? b[0] : ct[0]; q = b? b[1] : ct[0];
    }
  }
  out.cs=p; out.ce=q;
  return out;
}

/* ---------- la tabella completa ---------- */
function parseTable(src, loc){
  const T={...loc};
  T.specInfo=parseSpec(src, loc.spec[0], loc.spec[1]);
  T.cols=T.specInfo.cols; T.ncols=Math.max(1, T.cols.length);
  T.specNorm=T.specInfo.items.filter(x=>x.k!=='>'&&x.k!=='<').map(x=>normSpec(src.slice(x.k===undefined ? x.fs : x.s, x.k===undefined ? x.fe : x.e))).join('');
  const b=scanBody(src, loc.bs, loc.be);
  T.rows=b.rows; T.fin=b.fin;
  T.issues=lintTable(src, T);
  return T;
}
/* tutte le tabelle di un sorgente, già analizzate */
function parseAll(src){ return findTables(src).map(l=>parseTable(src, l)); }

/* ---------- controlli: errori con posizione (per segnare le righe e sottolineare) ---------- */
function lintTable(src, T){
  const out=[];
  if (T.open) out.push({s:T.s, e:T.bs, kind:'e', msg:`manca \\end{${T.env}}`});
  if (!T.cols.length) out.push({s:T.spec[0]-1, e:T.spec[1]+1, kind:'e', msg:'la specifica delle colonne è vuota'});
  T.rows.forEach((r,k)=>{
    if (r.special) return;
    const n=r.cells.reduce((a,c)=>a+(c.mc?c.mc.n:1),0);
    if (n>T.ncols){ const c=r.cells[r.cells.length-1]; out.push({s:r.s, e:(r.end?r.end.e:c.e), kind:'e', msg:`riga ${k+1}: ${n} celle ma ${T.ncols} colonne (troppe «&»)`}); }
    for (const c of r.cells){
      const col=T.cols[cellCol(r,c)];
      if (col && (col.type==='S') && !c.mc && c.t && !isSiNumber(c.t) && !/^\{[\s\S]*\}$/.test(c.t) && !/^\\multirow/.test(c.v))
        out.push({s:c.vs, e:c.ve, kind:'w', msg:`riga ${k+1}: «${c.t.slice(0,30)}» in una colonna S non è un numero: va tra graffe {…}`});
    }
  });
  for (const r of [...T.rows.flatMap(r=>r.pre), ...T.fin]){
    if (r.range && (r.range.b<r.range.a || r.range.b>T.ncols || r.range.a<1)) out.push({s:r.s, e:r.e, kind:'e', msg:`\\${r.cmd}{${r.range.a}-${r.range.b}}: colonne fuori dalla tabella (sono ${T.ncols})`});
  }
  /* graffe e ambienti nel corpo */
  let d=[], env=[];
  for (let i=T.bs;i<T.be;i++){
    const ch=src[i];
    if (ch==='%'){ i=commentEnd(src,i,T.be)-1; continue; }
    if (ch==='\\'){ const c=readCs(src,i);
      if (c.name==='begin'||c.name==='end'){ const n=envName(src,c.e); if (n){ if (c.name==='begin') env.push({name:n.name,s:i,e:n.e}); else { const o=env.pop(); if (!o||o.name!==n.name) out.push({s:i,e:n.e,kind:'e',msg:`\\end{${n.name}} senza il \\begin corrispondente`}); } i=n.e-1; continue; } }
      i=c.e-1; continue; }
    if (ch==='{') d.push(i); else if (ch==='}'){ if (!d.length) out.push({s:i,e:i+1,kind:'e',msg:'graffa chiusa «}» senza la corrispondente «{»'}); else d.pop(); }
  }
  for (const p of d) out.push({s:p,e:p+1,kind:'e',msg:'graffa «{» non chiusa'});
  for (const o of env) out.push({s:o.s,e:o.e,kind:'e',msg:`\\begin{${o.name}} senza \\end`});
  return out;
}
/* indice della colonna di griglia in cui comincia una cella */
function cellCol(row, cell){ let g=0; for (const c of row.cells){ if (c===cell) return g; g+=c.mc?c.mc.n:1; } return -1; }
/* numero per siunitx: 1.5, -3, 2,5e3, 1.2(3), 4.5 \pm 0.1, +-; vuoto escluso */
function isSiNumber(t){
  const x=t.trim().replace(/\\pm|\+-/g,'±').replace(/\s+/g,'');
  return /^[<>~≈]?[+-]?(\d+([.,]\d*)?|[.,]\d+)(\(\d+\))?(±(\d+([.,]\d*)?|[.,]\d+))?([eEdD][+-]?\d+)?$/.test(x);
}
