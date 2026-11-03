/* ============ SINCRONIZZAZIONE: dalla formula modificata al sorgente, riscrivendo il minimo ============
   Idea (la stessa della «modifica inversa» di Tavolo TikZ, che riscrive solo i numeri toccati):
   1. MathLive serializza la formula prima (prev) e dopo (next) la modifica: il confronto tra le due
      serializzazioni isola la parte cambiata, in token.
   2. I token del sorgente vengono allineati a quelli di prev (LCS): così si sa a quale tratto del
      sorgente corrisponde la parte cambiata, anche se il sorgente ha spazi, a capo, commenti o una
      grafia diversa (\frac12 contro \frac{1}{2}, x^{2} contro x^2 …).
   3. Si sostituisce solo quel tratto e si VERIFICA il risultato: il nuovo sorgente, rianalizzato da
      MathLive, deve dare esattamente next. Se non è così si prova un tratto più ampio (il gruppo
      che contiene la modifica, poi quello esterno, …) e solo come ultima risorsa si riscrive il corpo.
   Il risultato è sempre corretto (verificato) e, nei casi normali, il resto del sorgente resta identico. */
const Sync = (()=>{
  /* correzioni alla serializzazione di MathLive, perché il codice resti LaTeX standard:
     \middle{|} → \middle|  (LaTeX vuole un delimitatore, non un gruppo); \placeholder{} residui → vuoto */
  function tidy(t){
    return t.replace(/\\middle\{(\\[a-zA-Z]+|\\.|[^{}\\])\}/g, (m,d)=> '\\middle'+d+(/^\\[a-zA-Z]/.test(d)?' ':''))
            .replace(/\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g, '$1')
            /* forme compatte di MathLive con cifre singole (\frac12, \sqrt2): più leggibili con le graffe */
            .replace(/\\([dtc]?frac|binom|[dt]binom)(\d)(\d)/g, '\\$1{$2}{$3}')
            .replace(/\\sqrt(\d)/g, '\\sqrt{$1}')
            /* apici come ^{\doubleprime} (comando solo di MathLive) → gli apostrofi di LaTeX */
            .replace(/\^\{?\\(prime|doubleprime|tripleprime)\s*\}?/g, (m,k)=> k==='prime' ? "'" : k==='doubleprime' ? "''" : "'''");
  }
  /* allineamento LCS: per ogni indice di B, l'indice corrispondente in A (o -1) */
  function align(A, B){
    const n=A.length, m=B.length, map=new Int32Array(m).fill(-1);
    let p=0; while (p<n && p<m && A[p]===B[p]){ map[p]=p; p++; }
    let sa=n, sb=m; while (sa>p && sb>p && A[sa-1]===B[sb-1]){ sa--; sb--; map[sb]=sa; }
    const N=sa-p, M=sb-p;
    if (N>0 && M>0 && N*M<=4e6){
      const W=M+1, dp=new Uint32Array((N+1)*W);
      for (let i=N-1;i>=0;i--) for (let j=M-1;j>=0;j--)
        dp[i*W+j] = A[p+i]===B[p+j] ? dp[(i+1)*W+j+1]+1 : Math.max(dp[(i+1)*W+j], dp[i*W+j+1]);
      let i=0, j=0;
      while (i<N && j<M){
        if (A[p+i]===B[p+j]){ map[p+j]=p+i; i++; j++; }
        else if (dp[(i+1)*W+j]>=dp[i*W+j+1]) i++; else j++;
      }
    }
    return map;
  }

  const OPEN = t => t==='{' || t==='\\begin' || t==='\\left';
  const CLOSE = t => t==='}' || t==='\\end' || t==='\\right';
  function matchFwd(T, q){ let d=0; for (let p=q;p<T.length;p++){ if (OPEN(T[p].t)) d++; else if (CLOSE(T[p].t) && --d===0) return p; } return -1; }
  function matchBack(T, q){ const o=T[q].t==='}'?'{':'['; let d=0; for (let p=q;p>=0;p--){ if (T[p].t===T[q].t) d++; else if (T[p].t===o && --d===0) return p; } return -1; }
  /* allarga [i,j) al gruppo che lo contiene, con il comando e gli argomenti fratelli (\frac{…}{…}, x^{…}) */
  function expand(T, i, j){
    let d=0, o=-1;
    for (let p=i-1;p>=0;p--){ const t=T[p].t; if (CLOSE(t)) d++; else if (OPEN(t)){ if (d===0){ o=p; break; } d--; } }
    if (o<0) return null;
    let c=matchFwd(T, o); if (c<0 || c<j-1) return null;
    let a=o;
    for (;;){
      let q=a-1; while (q>=0 && T[q].t===' ') q--; if (q<0) break;
      const t=T[q].t;
      if (t==='}' || t===']'){ const b=matchBack(T,q); if (b<0) break; a=b; continue; }
      if (/^\\[a-zA-Z@]+$/.test(t) || t==='^' || t==='_'){ a=q; }
      break;
    }
    const nx = q=>{ while (q<T.length && T[q].t===' ') q++; return q; };
    let b=c;
    /* \right va preso con il suo delimitatore, \end con il suo {nome} */
    if (T[c].t==='\\right'){ const q=nx(c+1); if (q<T.length) b=q; }
    else if (T[c].t==='\\end'){ const q=nx(c+1); if (q<T.length && T[q].t==='{'){ const mm=matchFwd(T,q); if (mm>=0) b=mm; } }
    for (;;){ const q=nx(b+1); if (q<T.length && T[q].t==='{'){ const mm=matchFwd(T,q); if (mm<0) break; b=mm; continue; } break; }
    return (a<i || b+1>j) ? [a, b+1] : null;
  }

  function apply(src, prev, next, normalize){
    if (prev===next) return {src, range:null, mode:'none'};
    const doc = parseDoc(src);
    /* verifica: MathLive deve rileggere esattamente la formula mostrata, e il nuovo sorgente non deve avere
       più errori di sintassi del vecchio (MathLive chiude da solo una graffa mancante: LaTeX no) */
    const errs0 = lint(src, doc).length;
    const verify = cand => { try { return normalize(feedOf(cand)) === next && lint(cand).length <= errs0; } catch(e){ return false; } };
    const Ts = solid(tokenize(src, doc.bs, doc.be));
    const Tp = tokenize(prev), Tn = tokenize(next);
    let i=0; while (i<Tp.length && i<Tn.length && Tp[i].t===Tn[i].t) i++;
    let s=0; while (s<Tp.length-i && s<Tn.length-i && Tp[Tp.length-1-s].t===Tn[Tn.length-1-s].t) s++;
    /* se la modifica tocca gli argomenti di \frac, \sqrt … si include il comando: così la forma compatta
       di MathLive (\frac12) può essere riscritta con le graffe */
    while (i>0 && /^\\(?:[dtc]?frac|[dt]?binom|sqrt|middle)$/.test(Tp[i-1].t)) i--;
    const j0=Tp.length-s, k0=Tn.length-s;
    /* allineamento sorgente ↔ prev, sui soli token non vuoti */
    /* i token dell'ambiente aggiunto per MathLive (aligned per align*) non esistono nel corpo del sorgente */
    let w0=0, w1=Tp.length;
    if (doc.inner){
      const o=tokenize(`\\begin{${doc.inner}}`).length, c=tokenize(`\\end{${doc.inner}}`).length;
      if (prev.startsWith(`\\begin{${doc.inner}}`)) w0=o;
      if (prev.endsWith(`\\end{${doc.inner}}`)) w1=Tp.length-c;
    }
    const qi=[]; Tp.forEach((t,q)=>{ if (t.t!==' ' && q>=w0 && q<w1) qi.push(q); });
    const map = align(Ts.map(t=>t.t), qi.map(q=>Tp[q].t));
    const m = new Int32Array(Tp.length).fill(-1); qi.forEach((q,r)=>{ m[q]=map[r]; });

    function glue(before, rep, after){
      if (rep){ if (isLetter(rep[0]) && endsWithCtrlWord(before)) rep=' '+rep; if (endsWithCtrlWord(rep) && isLetter(after[0])) rep+=' '; }
      else if (endsWithCtrlWord(before) && isLetter(after[0])) rep=' ';
      return rep;
    }
    function tryAt(S, E, rep){
      if (!rep && S<E && /[ \t]$/.test(src.slice(0,S))) while (src[E]===' '||src[E]==='\t') E++;
      const before=src.slice(0,S), after=src.slice(E);
      const r = glue(before, rep, after);
      const cand = before + r + after;
      return verify(cand) ? {src:cand, range:[S, S+r.length]} : null;
    }
    function attempt(i, j, k){
      let L=-1; for (let p=i-1;p>=0;p--) if (m[p]>=0){ L=p; break; }
      let R=-1; for (let p=j;p<Tp.length;p++) if (m[p]>=0){ R=p; break; }
      /* senza nulla a sinistra si parte dal primo token del corpo: a capo, rientro e commenti iniziali restano prima */
      const gs = L>=0 ? Ts[m[L]].e : Ts.length ? Math.min(Ts[0].s, R>=0 ? Ts[m[R]].s : doc.be) : doc.bs, ge = R>=0 ? Ts[m[R]].s : doc.be;
      if (ge<gs) return null;
      const inGap = Ts.filter(t=>t.s>=gs && t.e<=ge);
      let q0=i, q1=k; while (q0<q1 && Tn[q0].t===' ' && q1-q0>1) q0++; while (q1>q0 && Tn[q1-1].t===' ' && q1-q0>1) q1--;
      const rep = q1>q0 ? tidy(next.slice(Tn[q0].s, Tn[q1-1].e)) : '';
      let r;
      if (j===i){
        /* inserimento puro: si prova subito dopo l'elemento precedente, poi dopo ogni token del tratto */
        const pts=[gs, ...inGap.map(t=>t.e)];
        if (!pts.includes(ge)) pts.push(ge);
        for (const P of pts) if ((r=tryAt(P,P,rep))) return r;
        return null;
      }
      /* sostituzione o cancellazione */
      const mt=[]; for (let p=i;p<j;p++) if (m[p]>=0) mt.push(Ts[m[p]]);
      /* si sostituisce il contenuto di un gruppo {…} del sorgente: le graffe restano (x^{2} → x^{3}, non x^3) */
      if (mt.length && rep && src[mt[0].s]==='{' && src[mt[mt.length-1].e-1]==='}' && !(rep[0]==='{' && rep[rep.length-1]==='}') && (r=tryAt(mt[0].s, mt[mt.length-1].e, '{'+rep+'}'))) return r;
      if (mt.length && (r=tryAt(mt[0].s, mt[mt.length-1].e, rep))) return r;
      if (inGap.length && (r=tryAt(inGap[0].s, inGap[inGap.length-1].e, rep))) return r;
      const onlyWs = Tp.slice(i,j).every(t=>t.t===' ');
      const gapTxt = src.slice(gs,ge);
      if ((onlyWs || inGap.length) && !gapTxt.includes('%') && (r=tryAt(gs, ge, rep))) return r;
      return null;
    }

    let r = attempt(i, j0, k0);
    if (r) return {...r, mode:'min'};
    let I=i, J=j0;
    for (let lev=0; lev<10; lev++){
      const ex = expand(Tp, I, J); if (!ex) break;
      [I,J]=ex; const K = J + (Tn.length-Tp.length);
      if ((r=attempt(I, J, K))) return {...r, mode:'group'};
    }
    /* ultima risorsa: si riscrive il corpo, conservando delimitatori e spazi esterni */
    let body = tidy(next);
    if (doc.inner){ const mo=`\\begin{${doc.inner}}`, mc=`\\end{${doc.inner}}`; if (body.startsWith(mo) && body.endsWith(mc)) body=body.slice(mo.length, -mc.length); }
    const old = src.slice(doc.bs, doc.be);
    const lead = /^\s*/.exec(old)[0], trail = /\s*$/.exec(old.slice(lead.length))[0];
    const cand = src.slice(0,doc.bs) + lead + body + trail + src.slice(doc.be);
    return {src:cand, range:[doc.bs+lead.length, doc.bs+lead.length+body.length], mode:'full'};
  }
  return {apply, align, expand, tidy};
})();
