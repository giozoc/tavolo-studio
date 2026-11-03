/* ============ OPERAZIONI: riscrittura minima del sorgente, con verifica ============
   Ogni operazione produce poche sostituzioni sul testo (il contenuto di una cella, una lettera della specifica,
   una riga intera, una regola). Poi il sorgente viene riletto: la griglia che ne risulta deve essere esattamente
   quella attesa (03-model.js). Se non lo è si riscrivono, in ordine, solo le righe diverse e poi l'intero corpo;
   se nemmeno così torna, la modifica non si applica. Così commenti, a capo, spazi e grafia restano dove sono. */
const Ops = (()=>{
  const apply = (src, ps) => { ps=ps.filter(Boolean).sort((a,b)=>b.s-a.s || b.e-a.e); for (const p of ps) src=src.slice(0,p.s)+p.t+src.slice(p.e); return src; };
  const P = (s, e, t) => ({s, e, t});
  const lineStart = (src, p) => src.lastIndexOf('\n', p-1)+1;
  const indentAt = (src, p) => /^[ \t]*/.exec(src.slice(lineStart(src,p)))[0];
  const onlyWSBefore = (src, p) => /^[ \t]*$/.test(src.slice(lineStart(src,p), p));
  /* fine della riga dopo p se il resto è vuoto o un commento (a capo compreso), altrimenti p */
  function restOfLine(src, p){
    let j=p; while (src[j]===' '||src[j]==='\t') j++;
    if (src[j]==='%'){ const k=src.indexOf('\n', j); return k<0 ? src.length : k; }
    if (src[j]==='\n' || j>=src.length) return j;
    return p;
  }
  /* toglie un elemento (regola, comando): la riga intera se è da solo, altrimenti il tratto e uno spazio */
  function removeItem(src, s, e){
    if (onlyWSBefore(src, s)){
      let j=e; while (src[j]===' '||src[j]==='\t') j++;
      if (src[j]==='\n') return P(lineStart(src,s), j+1, '');
      if (j>=src.length) return P(lineStart(src,s), j, '');
      return P(s, j, '');
    }
    if (src[e]===' ') return P(s, e+1, '');
    if (src[s-1]===' ') return P(s-1, e, '');
    return P(s, e, '');
  }
  const width = row => row.cells.reduce((a,c)=>a+(c.mc?c.mc.n:1),0);
  function find(row, gc){ let g=0; for (let k=0;k<row.cells.length;k++){ const n=row.cells[k].mc?row.cells[k].mc.n:1; if (gc>=g && gc<g+n) return {k, g, c:row.cells[k]}; g+=n; } return null; }
  /* testo di una cella (contenuto interno) */
  function setContent(src, row, cell, t){
    if (cell.cs<cell.ce){
      if (t==='' && src[cell.cs-1]===' ' && src[cell.ce]===' ' && !cell.mc && !cell.mr) return P(cell.cs, cell.ce+1, '');
      return P(cell.cs, cell.ce, t);
    }
    if (t==='') return null;
    if (cell.mc || cell.mr) return P(cell.cs, cell.ce, t);           /* graffe vuote di \multicolumn o \multirow */
    const raw=src.slice(cell.s, cell.e), first = cell.s===row.s;
    if (/^[ \t]*$/.test(raw)) return P(cell.s, cell.e, (first?'':' ')+t+' ');
    const after = src[cell.s];
    return P(cell.s, cell.s, (first?'':' ')+t+(after && !isWS(after) ? ' ' : ''));
  }
  const nNum = (cell, n) => cell.mc ? P(cell.mc.nS[0], cell.mc.nS[1], String(n)) : null;
  /* contenuto di una cella così com'è nel sorgente (commenti interni compresi) */
  const inner = (src, x) => x.cs<x.ce ? src.slice(x.cs, x.ce) : '';
  const rawOf = (src, x) => x.vs<x.ve ? src.slice(x.vs, x.ve) : '';
  /* commenti in [s,e) fuori dai tratti da saltare (il contenuto delle celle) */
  function commentsIn(src, s, e, skip=[]){
    const out=[];
    for (let i=s;i<e;i++){
      const z=skip.find(([a,b])=>i>=a && i<b); if (z){ i=z[1]-1; continue; }
      if (src[i]==='\\'){ i++; continue; }
      if (src[i]==='%'){ const k=commentEnd(src,i,e); out.push(src.slice(i,k).replace(/\n?$/,'\n')); i=k-1; }
    }
    return out;
  }
  /* cella riscritta per intero (struttura compresa), con gli spazi giusti se era vuota o lo diventa */
  function putRaw(src, row, x, v){
    if (x.vs===x.ve) return v ? setContent(src, row, {...x, cs:x.s, ce:x.s, mc:null, mr:null}, v) : null;
    if (!v) return src[x.vs-1]===' ' && src[x.ve]===' ' ? P(x.vs, x.ve+1, '') : P(x.vs, x.ve, '');
    return P(x.vs, x.ve, v);
  }
  const joinCells = ts => ts.join(' & ').replace(/  +/g,' ').trim();
  /* le operazioni sulle colonne scrivono per esteso i gruppi *{n}{…} che toccano */
  function expandStar(src, T, cols){
    for (const c of cols){
      const col=T.cols[c]; if (!col || !col.star) continue;
      let g=col.star; while (g.outer) g=g.outer;
      const inner=src.slice(g.inner[0], g.inner[1]);
      const spaced=/\s/.test(src.slice(T.spec[0], T.spec[1]).trim());
      return {redo: apply(src, [P(g.s, g.e, Array(g.n).fill(inner).join(spaced?' ':''))])};
    }
    return null;
  }
  const specSpaced = (src, T) => /[^\s|]\s+[^\s|]/.test(src.slice(T.spec[0], T.spec[1]));
  /* posizione dove aggiungere qualcosa dopo l'ultima riga (le regole finali restano dopo) */
  function afterLastRow(src, T, ps){
    const last=T.rows[T.rows.length-1];
    if (!last) return {p:T.bs, ind:'  ', pre:'\n'};
    const ind=indentAt(src, last.s);
    if (!last.end){ const c=last.cells[last.cells.length-1]; const p=Math.max(c.ve, c.s); return {p, ind, pre:(src[p-1]===' '?'':' ')+'\\\\\n'}; }
    return {p:restOfLine(src, last.end.e), ind, pre:'\n'};
  }
  /* inserisce un comando di regola al confine b (prima delle celle della riga b, o in fondo) */
  function insertRule(src, T, b, text, where='first'){
    const ps=[]; const items = b<T.rows.length ? T.rows[b].pre : T.fin;
    const rules=items.filter(x=>x.k==='rule');
    if (rules.length){
      if (where==='first'){ const x=rules[0]; return [P(x.s, x.s, text+(onlyWSBefore(src,x.s) ? '\n'+indentAt(src,x.s) : ' '))]; }
      const x=rules[rules.length-1];
      const inline = RANGE_RULES.has(x.cmd) && RANGE_RULES.has(ruleCmd(text));
      return [P(x.e, x.e, inline ? ' '+text : '\n'+indentAt(src,x.s)+text)];
    }
    if (b<T.rows.length){
      const row=T.rows[b];
      if (onlyWSBefore(src, row.s)) return [P(row.s, row.s, text+'\n'+indentAt(src,row.s))];
      return [P(row.s, row.s, text+' ')];
    }
    const a=afterLastRow(src, T, ps);
    ps.push(P(a.p, a.p, a.pre+a.ind+text));
    return ps;
  }

  const IMPL = {
    set(src, T, {r, c, t}){
      const row=T.rows[r]; const f=find(row, c);
      if (f) return [setContent(src, row, f.c, t)];
      const last=row.cells[row.cells.length-1]; const miss=c-width(row);
      return [P(last.ve, last.ve, ' &'.repeat(miss)+' &'+(t?' '+t:'')+(src[last.ve]===' '||!t ? '' : ' '))];
    },
    /* cella riscritta per intero (struttura compresa): serve quando cambia l'involucro, non solo il contenuto */
    raw(src, T, {r, c, v}){
      const row=T.rows[r]; const f=find(row, c); if (!f) return IMPL.set(src, T, {r, c, t:v});
      const x=f.c;
      if (x.vs===x.ve) return [setContent(src, row, {...x, cs:x.s, ce:x.s, mc:null, mr:null}, v)];
      return [P(x.vs, x.ve, v)];
    },
    rowins(src, T, {at, cells}){
      const g=Grid.of(T, src); const n=T.ncols, fr=Grid.fullyRuled(g);
      const txt = joinCells(Array.from({length:n}, (_,k)=>(cells&&cells[k])||''));
      const line = (txt ? txt+' ' : '')+'\\\\';
      if (!T.rows.length){
        const rules=T.fin.filter(x=>x.k==='rule');
        if (rules.length>=2) return [P(rules[0].e, rules[0].e, '\n'+indentAt(src,rules[0].s)+line)];
        const first=T.fin[0]; const ind=first ? indentAt(src, first.s) : '  ';
        return [P(T.bs, T.bs, '\n'+ind+line)];
      }
      if (at<T.rows.length){
        const row=T.rows[at]; const ind=indentAt(src,row.s);
        const sep = onlyWSBefore(src,row.s) ? '\n'+ind : ' ';
        return [P(row.s, row.s, line+sep+(fr ? '\\hline'+sep : ''))];
      }
      const ps=[]; const a=afterLastRow(src, T, ps);
      ps.push(P(a.p, a.p, a.pre+a.ind+(fr ? '\\hline'+a.pre+a.ind : '')+line));
      return ps;
    },
    rowdel(src, T, {r}){
      const row=T.rows[r], ps=[];
      const last=row.cells[row.cells.length-1];
      let s=row.s, e=row.end ? row.end.e : last.e;
      if (onlyWSBefore(src, s)){
        const k=restOfLine(src, e);
        if (k!==e || src[e]==='\n' || e>=src.length){ s=lineStart(src, s); e = src[k]==='\n' ? k+1 : k; }
      }
      ps.push(P(s, e, ''));
      /* regole doppie: se la riga dopo ha già le stesse, quelle di questa riga se ne vanno con lei */
      const next = r+1<T.rows.length ? T.rows[r+1].pre : T.fin;
      const mine=row.pre.filter(x=>x.k==='rule'), theirs=next.filter(x=>x.k==='rule').map(x=>normSpec(x.raw));
      if (mine.length && mine.every(x=>theirs.includes(normSpec(x.raw)))) for (const x of mine) ps.push(removeItem(src, x.s, x.e));
      /* \multirow che copriva questa riga: uno in meno */
      T.rows.forEach((x, a)=>{ if (a>=r) return; let gc=0; for (const c of x.cells){ if (c.mr && c.mr.n>1 && a+c.mr.n-1>=r){ const f=find(row, gc); if (!f || !f.c.t) ps.push(P(c.mr.nS[0], c.mr.nS[1], String(c.mr.n-1))); } gc+=c.mc?c.mc.n:1; } });
      return ps;
    },
    colins(src, T, {at, type}){
      const st=expandStar(src, T, [at-1, at]); if (st) return st;
      const ps=[], sp=specSpaced(src, T), its=T.specInfo.items.filter(x=>x.k!=='>'&&x.k!=='<');
      if (!T.cols.length) ps.push(P(T.spec[0], T.spec[1], type));
      else if (at>0){
        const col=T.cols[at-1]; const i=its.indexOf(col); const nx=its[i+1];
        if (nx && nx.k==='|') ps.push(P(nx.e, nx.e, (sp?' ':'')+type+(sp?' |':'|')));
        else ps.push(P(col.fe, col.fe, (sp?' ':'')+type));
      } else {
        const col=T.cols[0]; const i=its.indexOf(col); const pv=its[i-1];
        if (pv && pv.k==='|') ps.push(P(col.fs, col.fs, type+(sp?' | ':'|')));
        else ps.push(P(col.fs, col.fs, type+(sp?' ':'')));
      }
      for (const row of T.rows){
        if (row.special) continue;
        if (at===0){ if (row.cells.length) ps.push(P(row.s, row.s, '& ')); continue; }
        const f=find(row, at-1); if (!f) continue;
        const n=f.c.mc?f.c.mc.n:1;
        if (f.g+n-1>=at) ps.push(nNum(f.c, n+1));
        else if (f.c.cs===f.c.ce && !f.c.mc && !f.c.mr && f.c.s===row.s) ps.push(P(row.s, row.s, '& '));
        else ps.push(P(f.c.ve, f.c.ve, ' &'));
      }
      for (const it of [...T.rows.flatMap(r=>r.pre), ...T.fin]){
        if (!it.range) continue; let {a, b:z}=it.range;
        if (at+1<=a){ a++; z++; } else if (at+1<=z) z++; else continue;
        ps.push(P(it.range.s, it.range.e, `${a}-${z}`));
      }
      return ps;
    },
    coldel(src, T, {c}){
      const st=expandStar(src, T, [c]); if (st) return st;
      const ps=[], its=T.specInfo.items.filter(x=>x.k!=='>'&&x.k!=='<');
      const col=T.cols[c]; const i=its.indexOf(col); const nx=its[i+1], pv=its[i-1];
      let a=col.fs, b=col.fe;
      if (nx && nx.k==='|' && pv && pv.k==='|') b=nx.e;
      if (src[a-1]===' ' && (src[b]===' ' || b>=T.spec[1])) a--; else if (src[b]===' ' && a===T.spec[0]) b++;
      ps.push(P(a, b, ''));
      for (const row of T.rows){
        if (row.special) continue;
        const f=find(row, c); if (!f) continue;
        const x=f.c, n=x.mc?x.mc.n:1;
        if (n>1){ ps.push(nNum(x, n-1)); continue; }
        if (row.cells.length===1){ ps.push(setContent(src, row, x, '')); continue; }
        if (f.k>0){
          let s=x.s-1, e=x.ve;
          if (src[s-1]===' ' && src[e]===' ') s--;
          ps.push(P(s, e, ''));
        } else {
          let e=row.cells[1].s; while (src[e]===' '||src[e]==='\t') e++;
          ps.push(P(x.s, e, ''));
        }
      }
      for (const it of [...T.rows.flatMap(r=>r.pre), ...T.fin]){
        if (!it.range) continue; let {a:ra, b:z}=it.range;
        if (c+1<ra){ ra--; z--; } else if (c+1<=z) z--; else continue;
        ps.push(z<ra ? removeItem(src, it.s, it.e) : P(it.range.s, it.range.e, `${ra}-${z}`));
      }
      return ps;
    },
    align(src, T, {c, type}){
      const st=expandStar(src, T, [c]); if (st) return st;
      const col=T.cols[c]; return [P(col.cs, col.e, type)];
    },
    rule(src, T, {b, kind}){
      const items = b<T.rows.length ? T.rows[b].pre : T.fin;
      const full=items.filter(x=>x.k==='rule' && FULL_RULES.has(x.cmd));
      if (kind==='none') return full.map(x=>removeItem(src, x.s, x.e));
      if (!full.length) return insertRule(src, T, b, '\\'+kind, 'first');
      return [P(full[0].s, full[0].e, '\\'+kind), ...full.slice(1).map(x=>removeItem(src, x.s, x.e))];
    },
    cmid(src, T, {b, text}){ return insertRule(src, T, b, text, 'last'); },
    cmidx(src, T, {b}){
      const items = b<T.rows.length ? T.rows[b].pre : T.fin;
      return items.filter(x=>x.range).map(x=>removeItem(src, x.s, x.e));
    },
    mergeh(src, T, {r, c1, c2, spec}){
      const row=T.rows[r];
      if (width(row)<=c2){ const last=row.cells[row.cells.length-1]; return {redo: apply(src, [P(last.ve, last.ve, ' &'.repeat(c2+1-width(row)))])}; }
      const f1=find(row,c1), f2=find(row,c2);
      const cells=row.cells.slice(f1.k, f2.k+1);
      const ts=cells.filter(x=>x.t).map(x=>inner(src, x));
      const n=f2.g+(f2.c.mc?f2.c.mc.n:1)-f1.g;
      const mr=f1.c.mr;
      const s=f1.c.cs===f1.c.ce && !f1.c.mc && !f1.c.mr ? f1.c.s : f1.c.vs;
      const e=f2.c.cs===f2.c.ce && !f2.c.mc && !f2.c.mr ? f2.c.s : f2.c.ve;
      /* i commenti tra le celle unite finiscono dentro la cella nuova, ciascuno sulla sua riga */
      const ind=indentAt(src, row.s);
      const cm=commentsIn(src, s, e, cells.map(x=>[x.cs, x.ce]));
      const t=ts.join(' ')+(cm.length ? ' '+cm.map(x=>x+ind).join('') : '');
      const raw=cellRaw({t, n, mc:spec, mr:mr?mr.n:0, mrw:mr?mr.w:null});
      const pre = s>row.s && src[s-1]==='&' ? ' ' : '';
      const post = /[&\\]/.test(src[e]||'') ? ' ' : '';
      return [P(s, e, pre+raw+post)];
    },
    mergev(src, T, {c, r1, r2, mc}){
      const ps=[]; const a=find(T.rows[r1], c).c; const ts=[inner(src, a)];
      for (let r=r1+1;r<=r2;r++){ const row=T.rows[r]; const f=find(row,c); if (!f) continue; if (f.c.t){ ts.push(inner(src, f.c)); ps.push(setContent(src, row, f.c, '')); } }
      const t=ts.filter(x=>stripComments(x).trim()).join(' '), n=r2-r1+1;
      if (a.mr){ ps.push(P(a.mr.nS[0], a.mr.nS[1], String(n))); if (t!==inner(src, a)) ps.push(P(a.cs, a.ce, t)); }
      else {
        let raw=`\\multirow{${n}}{*}{${t}}`;
        /* in una colonna S il \multirow va dentro un \multicolumn{1}{c}{…}, altrimenti siunitx lo legge come numero */
        if (mc && !a.mc){ raw=`\\multicolumn{1}{${mc}}{${raw}}`; ps.push(P(a.vs, a.ve, raw)); }
        else if (a.cs===a.ce && !a.mc) ps.push(setContent(src, T.rows[r1], a, raw)); else ps.push(P(a.cs, a.ce, raw));
      }
      return ps;
    },
    split(src, T, {r, c, t:nt}){
      const row=T.rows[r]; const f=find(row,c); const x=f.c; const n=x.mc?x.mc.n:1;
      /* il testo resta quello del sorgente, commenti compresi, se l'operazione non lo cambia */
      const rc=inner(src, x);
      const ct = nt===undefined || nt===x.t ? rc : nt==='{'+x.t+'}' ? '{'+rc+'}' : nt;
      /* commenti dentro \multicolumn ma fuori dal contenuto: restano dopo il testo */
      const ind=indentAt(src, row.s), cm=commentsIn(src, x.vs, x.ve, [[x.cs, x.ce]]);
      let t=ct+(cm.length ? ' '+cm.map(z=>z+ind).join('') : '')+' &'.repeat(n-1);
      if (!ct) t=t.replace(/^ /, '');
      return [P(x.vs, x.ve, t)];
    },
    rowmove(src, T, {r, d}){
      const A=T.rows[Math.min(r,r+d)], B=T.rows[Math.max(r,r+d)];
      const end = row => { const c=row.cells[row.cells.length-1]; return Math.max(c.ve, c.s); };
      const ta=src.slice(A.s, end(A)), tb=src.slice(B.s, end(B));
      return [P(A.s, end(A), tb), P(B.s, end(B), ta)];
    },
    /* ordinamento: ogni riga prende il testo di un'altra; se tutte finiscono con \\, il commento a fine riga la segue */
    rowperm(src, T, {r1, order}){
      const rows=order.map((_,i)=>T.rows[r1+i]);
      const carry=rows.every(r=>r.end && !r.end.kill);
      const seg = row => {
        if (!carry){ const c=row.cells[row.cells.length-1]; return [row.s, Math.max(c.ve, c.s)]; }
        let j=row.end.e; while (src[j]===' '||src[j]==='\t') j++;
        if (src[j]==='%'){ const k=src.indexOf('\n', j); return [row.s, k<0 ? src.length : k]; }
        return [row.s, row.end.e];
      };
      const ps=[];
      order.forEach((k,i)=>{ if (k===r1+i) return; const [s,e]=seg(rows[i]), [a,b]=seg(T.rows[k]); ps.push(P(s, e, src.slice(a,b))); });
      return ps;
    },
    colmove(src, T, {c, d}){
      const a=Math.min(c, c+d), b=a+1;
      const st=expandStar(src, T, [a, b]); if (st) return st;
      const A=T.cols[a], B=T.cols[b];
      const ps=[P(A.fs, A.fe, src.slice(B.fs, B.fe)), P(B.fs, B.fe, src.slice(A.fs, A.fe))];
      for (const row of T.rows){
        if (row.special) continue;
        const fa=find(row, a), fb=find(row, b); if (!fa || !fb) continue;
        const ra=rawOf(src, fa.c), rb=rawOf(src, fb.c); if (ra===rb) continue;
        ps.push(putRaw(src, row, fa.c, rb), putRaw(src, row, fb.c, ra));
      }
      for (const it of [...T.rows.flatMap(r=>r.pre), ...T.fin]){
        if (!it.range || it.range.a!==it.range.b) continue;
        const n = it.range.a===a+1 ? b+1 : it.range.a===b+1 ? a+1 : 0;
        if (n) ps.push(P(it.range.s, it.range.e, `${n}-${n}`));
      }
      return ps;
    },
    rowcolor(src, T, {r, color}){
      const xs=T.rows[r].pre.filter(x=>x.k==='rule' && x.cmd==='rowcolor');
      if (!color) return xs.map(x=>removeItem(src, x.s, x.e));
      const text=`\\rowcolor{${color}}`;
      if (xs.length) return [P(xs[0].s, xs[0].e, text), ...xs.slice(1).map(x=>removeItem(src, x.s, x.e))];
      return insertRule(src, T, r, text, 'last');
    },
    addrule(src, T, {b, text}){ return insertRule(src, T, b, text, 'last'); },
    rmrule(src, T, {b, cmd}){
      const items = b<T.rows.length ? T.rows[b].pre : T.fin;
      return items.filter(x=>x.k==='rule' && x.cmd===cmd).map(x=>removeItem(src, x.s, x.e));
    },
    /* trasposizione: specifica e corpo si riscrivono, ma ogni cella porta con sé il suo testo del sorgente */
    transpose(src, T, op){
      const exp=Grid.expect(Grid.of(T, src), op);
      const ind = T.rows.length ? indentAt(src, T.rows[0].s) || '  ' : '  ';
      const at = (r, c) => { const f=find(T.rows[r], c); return f ? rawOf(src, f.c) : ''; };
      const L=[];
      exp.rows.forEach((row, j)=>{ for (const x of row.rules) L.push(ind+x); L.push(ind+(joinCells(T.rows.map((_,i)=>at(i, j)))+' \\\\').trim()); });
      for (const x of exp.fin) L.push(ind+x);
      const tail = onlyWSBefore(src, T.be) ? src.slice(lineStart(src, T.be), T.be) : '';
      return [P(T.spec[0], T.spec[1], exp.spec), P(T.bs, T.be, '\n'+L.join('\n')+'\n'+tail)];
    },
    env(src, T, {env, width}){
      const ps=[];
      const pat=TABLE_ENVS[env], old=TABLE_ENVS[T.env];
      const head = src.slice(T.s, T.spec[0]-1);
      /* \begin{nome}{larghezza}[pos]: si riscrive solo l'intestazione prima della specifica */
      let h=`\\begin{${env}}`;
      if (pat.includes('w')) h+=`{${T.w ? src.slice(T.w[0],T.w[1]) : (width||'\\textwidth')}}`;
      /* le opzioni esterne di tabularray (caption=…, …) non sono una posizione per gli altri ambienti */
      if (T.pos && !(TBLR_ENVS.has(T.env) && !TBLR_ENVS.has(env) && /=/.test(src.slice(T.pos[0],T.pos[1])))) h+=`[${src.slice(T.pos[0],T.pos[1])}]`;
      if (h!==head.replace(/\s+(?=[{[])/g,'')) ps.push(P(T.s, T.spec[0]-1, h));
      if (!T.open){ const m=/\\end\s*\{[^}]*\}/.exec(src.slice(T.be, T.e)); ps.push(P(T.be, T.be+m[0].length, `\\end{${env}}`)); }
      return ps;
    },
    style(src, T, {to}){
      const ps=[]; const R=T.rows.length;
      if (to==='grid'){
        const sp=specSpaced(src, T);
        const cols=T.cols.map(c=>src.slice(c.fs, c.fe));
        const text='|'+cols.join(sp?' | ':'|')+'|';
        if (normSpec(src.slice(T.spec[0],T.spec[1]))!==normSpec(text) || T.cols.some(c=>c.star)) ps.push(P(T.spec[0], T.spec[1], text));
      } else if (to==='booktabs'){
        const st=expandStar(src, T, T.cols.map((_,k)=>k).filter(k=>T.cols[k].star && T.specInfo.items.some(x=>x.k==='|' && x.star)));
        if (st) return st;
        const bars=T.specInfo.items.filter(x=>x.k==='|');
        const seen=new Set();
        for (const x of bars){ if (seen.has(x.s)) continue; seen.add(x.s); let s=x.s, e=x.e; if (src[e]===' ' && (src[s-1]===' '||s===T.spec[0])) e++; ps.push(P(s, e, '')); }
      }
      for (let b=0;b<=R;b++){
        const items = b<R ? T.rows[b].pre : T.fin;
        for (const x of items){
          if (!x.range) continue;
          if (to==='grid' && x.cmd==='cmidrule') ps.push(P(x.s, x.e, `\\cline{${x.range.a}-${x.range.b}}`));
          if (to==='booktabs' && x.cmd==='cline') ps.push(P(x.s, x.e, `\\cmidrule(lr){${x.range.a}-${x.range.b}}`));
        }
        let kind=null;
        if (to==='grid') kind='hline';
        else if (to==='booktabs') kind = b===0 ? 'toprule' : b===R ? 'bottomrule' : (b===1 && R>1) ? 'midrule' : null;
        const full=items.filter(x=>x.k==='rule' && FULL_RULES.has(x.cmd));
        if (!kind){ for (const x of full) ps.push(removeItem(src, x.s, x.e)); continue; }
        if (full.length){
          if (full[0].raw!=='\\'+kind) ps.push(P(full[0].s, full[0].e, '\\'+kind));
          for (const x of full.slice(1)) ps.push(removeItem(src, x.s, x.e));
        } else {
          const first=items.find(x=>x.k==='rule');
          if (first) ps.push(P(first.s, first.s, '\\'+kind+(onlyWSBefore(src,first.s) ? '\n'+indentAt(src,first.s) : ' ')));
          else ps.push(...insertRule(src, T, b, '\\'+kind, 'first'));
        }
      }
      return ps;
    },
  };

  /* ---------- ripieghi: le righe diverse, poi il corpo intero ---------- */
  function fixRows(src, T, g, exp){
    if (g.rows.length!==exp.rows.length || g.spec!==exp.spec || g.env!==exp.env) return null;
    const ps=[];
    for (let r=0;r<exp.rows.length;r++){
      const a=g.rows[r], b=exp.rows[r];
      if (!Grid.same(a.rules, b.rules)) return null;
      if (Grid.same(a.cells, b.cells) && a.sp===b.sp) continue;
      const row=T.rows[r]; const last=row.cells[row.cells.length-1];
      const e=Math.max(last.ve, last.s);
      const t=rowText(b.cells);
      ps.push(P(row.s, e, t+(row.end && src[e]!==' ' && t ? ' ' : '')));
    }
    if (!Grid.same(g.fin, exp.fin)) return null;
    return ps.length ? apply(src, ps) : null;
  }
  function regen(src, T, exp){
    const ind = T.rows.length ? indentAt(src, T.rows[0].s) || '  ' : '  ';
    const L=[];
    exp.rows.forEach(r=>{ for (const x of r.rules) L.push(ind+x); L.push(ind+(rowText(r.cells)+' \\\\').trim()); });
    for (const x of exp.fin) L.push(ind+x);
    const body='\n'+L.join('\n')+'\n';
    let head = src.slice(T.s, T.spec[0]) + exp.parts.map(p=>p.col??p.sep).join('') + src.slice(T.spec[1], T.bs);
    if (exp.env!==T.env){ head=head.replace(/^\\begin\s*\{[^}]*\}/, `\\begin{${exp.env}}`); }
    const end = T.open ? '' : `\\end{${exp.env}}`;
    return src.slice(0, T.s) + head + body + end + src.slice(T.e);
  }
  /* ---------- esecuzione con verifica ----------
     ti: indice della tabella nel sorgente. Restituisce {src, mode, flash} oppure {error} */
  const stats = {minima:0, righe:0, corpo:0, errore:0};
  function run(src, ti, op){
    if (op.op==='batch'){
      let s=src, worst='minima'; const order=['minima','righe','corpo'];
      for (const o of op.ops){ const r=run(s, ti, o); if (r.error) return r; if (order.indexOf(r.mode)>order.indexOf(worst)) worst=r.mode; s=r.src; }
      return {src:s, mode:worst, flash:diffRange(src, s)};
    }
    let T=parseAll(src)[ti]; if (!T) return {error:'tabella non trovata'};
    const exp=Grid.expect(Grid.of(T, src), op);
    let cur=src;
    for (let k=0;k<3;k++){
      const out=IMPL[op.op](cur, T, op);
      if (out && out.redo!==undefined){ cur=out.redo; T=parseAll(cur)[ti]; continue; }
      cur=apply(cur, out); break;
    }
    const check = s => { const t=parseAll(s)[ti]; return t ? {t, g:Grid.of(t, s)} : null; };
    let c=check(cur);
    if (c && Grid.same(c.g, exp)){ stats.minima++; return {src:cur, mode:'minima', flash:diffRange(src, cur)}; }
    if (c){
      const f=fixRows(cur, c.t, c.g, exp);
      if (f!==null){ const c2=check(f); if (c2 && Grid.same(c2.g, exp)){ stats.righe++; return {src:f, mode:'righe', flash:diffRange(src, f)}; } }
    }
    const T0=parseAll(src)[ti];
    const full=regen(src, T0, exp); const c3=check(full);
    if (c3 && Grid.same(c3.g, exp)){ stats.corpo++; return {src:full, mode:'corpo', flash:diffRange(src, full)}; }
    stats.errore++;
    return {error:'la modifica non dà la tabella attesa', got:c?.g, exp};
  }
  /* tratto cambiato: prefisso e suffisso comuni */
  function diffRange(a, b){
    let p=0; while (p<a.length && p<b.length && a[p]===b[p]) p++;
    let q=0; while (q<a.length-p && q<b.length-p && a[a.length-1-q]===b[b.length-1-q]) q++;
    return [p, Math.max(p, b.length-q)];
  }
  return {run, stats, diffRange, apply};
})();
