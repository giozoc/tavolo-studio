/* ============ LATEX: scansione, delimitatori, evidenziazione, controlli ============ */
/* Tre livelli distinti, come in Tavolo TikZ:
   1. il SORGENTE (testo dell'utente, mai riscritto per intero se non serve)
   2. il MODELLO modificabile (MathLive, a cui si passa il "corpo" della formula)
   3. il RISULTATO renderizzato (MathLive a schermo, MathJax per la verifica LaTeX) */

const isLetter = c => /[a-zA-Z@]/.test(c||'');

/* Scansione in token con posizione: comandi, simboli, spazi (run unico ' '); i commenti vengono saltati */
function tokenize(s, from=0, to=s.length){
  const out=[]; let i=from;
  while (i<to){
    const c=s[i];
    if (c==='%'){ let j=s.indexOf('\n',i); j = (j<0||j>=to) ? to : j+1; while (j<to && (s[j]===' '||s[j]==='\t')) j++; i=j; continue; }
    if (c===' '||c==='\t'||c==='\n'||c==='\r'){ let j=i+1; while (j<to && /[ \t\n\r]/.test(s[j])) j++; out.push({t:' ',s:i,e:j}); i=j; continue; }
    if (c==='\\'){
      if (i+1<to && isLetter(s[i+1])){ let j=i+2; while (j<to && isLetter(s[j])) j++; out.push({t:s.slice(i,j),s:i,e:j}); i=j; continue; }
      let j=Math.min(to,i+2); const cc=s.charCodeAt(i+1); if (cc>=0xD800 && cc<=0xDBFF) j=Math.min(to,i+3);
      out.push({t:s.slice(i,j),s:i,e:j}); i=j; continue;
    }
    let j=i+1; const cc=s.charCodeAt(i); if (cc>=0xD800 && cc<=0xDBFF) j=i+2;
    out.push({t:s.slice(i,j),s:i,e:j}); i=j;
  }
  return out;
}
const solid = toks => toks.filter(t=>t.t!==' ');

/* ---------- delimitatori esterni: $…$, \[…\], equation, align* … ----------
   Il corpo va a MathLive; i delimitatori restano nel sorgente e non vengono mai toccati dalle modifiche visuali. */
const WRAP_ENVS = {'equation':'', 'equation*':'', 'displaymath':'', 'math':'',
  'align':'aligned', 'align*':'aligned', 'flalign':'aligned', 'flalign*':'aligned',
  'gather':'gathered', 'gather*':'gathered', 'multline':'gathered', 'multline*':'gathered'};
function parseDoc(src){
  const toks = solid(tokenize(src));
  const doc = {env:'', bs:0, be:src.length, os:0, ce:src.length, inner:''};
  if (!toks.length) return doc;
  const f=toks[0], l=toks[toks.length-1];
  const set=(env, bs, be)=>{ doc.env=env; doc.bs=bs; doc.be=be; doc.os=f.s; doc.ce=l.e; };
  if (toks.length>=4 && f.t==='$' && toks[1].t==='$' && toks[1].s===f.e && l.t==='$' && toks[toks.length-2].t==='$' && toks[toks.length-2].e===l.s && toks[1].e<=toks[toks.length-2].s) set('$$', toks[1].e, toks[toks.length-2].s);
  else if (toks.length>=2 && f.t==='$' && l.t==='$') set('$', f.e, l.s);
  else if (toks.length>=2 && f.t==='\\[' && l.t==='\\]') set('\\[', f.e, l.s);
  else if (toks.length>=2 && f.t==='\\(' && l.t==='\\)') set('\\(', f.e, l.s);
  else if (f.t==='\\begin'){
    const mo = /^\\begin\s*\{([a-zA-Z]+\*?)\}/.exec(src.slice(f.s));
    const mc = /\\end\s*\{([a-zA-Z]+\*?)\}$/.exec(src.slice(0,l.e));
    if (mo && mc && mo[1]===mc[1] && mo[1] in WRAP_ENVS && f.s+mo[0].length <= l.e-mc[0].length){
      set(mo[1], f.s+mo[0].length, l.e-mc[0].length); doc.inner = WRAP_ENVS[mo[1]];
    }
  }
  return doc;
}
/* testo da passare a MathLive (e a MathJax) per un sorgente */
function feedOf(src, doc=parseDoc(src)){
  const body = src.slice(doc.bs, doc.be);
  return doc.inner ? `\\begin{${doc.inner}}${body}\\end{${doc.inner}}` : body;
}
/* cambia i delimitatori esterni lasciando intatto il corpo */
function rewrap(src, env){
  const d=parseDoc(src); let body=src.slice(d.bs,d.be);
  const block = !!d.env && !['$','\\(','$$'].includes(d.env) && d.env!=='\\[';
  if (block){ body=body.replace(/^[ \t]*\n/,'').replace(/\n[ \t]*$/,''); }
  const pre=src.slice(0,d.os), post=src.slice(d.ce);
  let open='', close='';
  if (env==='$'){ open='$'; close='$'; body=body.trim(); }
  else if (env==='\\['){ open='\\['; close='\\]'; }
  else if (env){ open=`\\begin{${env}}\n`; close=`\n\\end{${env}}`; }
  if (!d.env) return pre + open + src.slice(d.os, d.ce) + close + post;
  return pre + open + body + close + post;
}

/* ---------- macro personali: \newcommand, \renewcommand, \providecommand, \DeclareMathOperator, \def ----------
   Si leggono da un testo qualsiasi (di solito il preambolo). def è il corpo con #1…#n; opt è il valore predefinito
   del primo argomento facoltativo (\newcommand{\x}[2][0]{…}), che MathLive non sa gestire: lo capisce solo MathJax. */
function readGroup(t, i){
  if (t[i]!=='{') return -1;
  let d=0;
  for (let k=i;k<t.length;k++){
    const c=t[k];
    if (c==='\\'){ k++; continue; }
    if (c==='{') d++; else if (c==='}' && --d===0) return k;
  }
  return -1;
}
function parseMacros(text){
  const t = text.replace(/(^|[^\\])%[^\n]*/g, '$1');
  const out=[], re=/\\(newcommand|renewcommand|providecommand|DeclareMathOperator|def)(?![a-zA-Z@])(\*?)\s*/g;
  let m;
  while ((m=re.exec(t))){
    let i=re.lastIndex;
    const nm = /^\{\s*\\([a-zA-Z@]+)\s*\}|^\\([a-zA-Z@]+)/.exec(t.slice(i)); if (!nm) continue;
    const name=nm[1]||nm[2]; i+=nm[0].length;
    let args=0, opt=null;
    if (m[1]==='def'){ const pm=/^(?:#[1-9])*/.exec(t.slice(i)); args=pm[0].length/2; i+=pm[0].length; }
    else if (m[1]!=='DeclareMathOperator'){
      const am=/^\s*\[\s*(\d)\s*\]/.exec(t.slice(i)); if (am){ args=+am[1]; i+=am[0].length; }
      const om=/^\s*\[([^\]]*)\]/.exec(t.slice(i)); if (am && om){ opt=om[1]; i+=om[0].length; }
    }
    while (/\s/.test(t[i]||'')) i++;
    const e = readGroup(t, i); if (e<0) continue;
    let def = t.slice(i+1, e);
    if (m[1]==='DeclareMathOperator') def = `\\operatorname${m[2]}{${def}}`;
    out.push({name, args, opt, def, text:t.slice(m.index, e+1)});
    re.lastIndex = e+1;
  }
  return out;
}

/* ---------- evidenziazione ---------- */
function hlText(t){
  return t.replace(/(%[^\n]*)|(\\(?:begin|end)\s*\{[^}\n]*\})|(\\\\)|(\\[a-zA-Z@]+|\\.)|(\d+(?:[.,]\d+)?)|([\^_])|(&)|([\[\]])|([{}])|([<>"])/g,
    (m,com,env,nl,cmd,num,scr,amp,sq,br,ent)=> com?`<span class="t-com">${esc(com)}</span>` : env?`<span class="t-env">${esc(env)}</span>` : nl?`<span class="t-al">\\\\</span>` : cmd?`<span class="t-cmd">${esc(cmd)}</span>` : num?`<span class="t-num">${num}</span>` : scr?`<span class="t-scr">${scr}</span>` : amp?`<span class="t-al">&amp;</span>` : sq?`<span class="t-opt">${sq}</span>` : br?`<span class="t-br">${br}</span>` : esc(ent));
}
/* evidenziazione con intervalli marcati (errori, ultima modifica, selezione) */
function hlRanges(src, ranges){
  const rs = ranges.filter(r=>r.e>r.s && r.s<src.length).map(r=>({...r, e:Math.min(r.e,src.length)})).sort((a,b)=>a.s-b.s);
  let out='', p=0;
  for (const r of rs){
    const s=Math.max(r.s,p); if (s>=r.e) continue;
    out += hlText(src.slice(p,s)) + `<span class="${r.cls}">` + hlText(src.slice(s,r.e)) + '</span>';
    p = r.e;
  }
  return out + hlText(src.slice(p));
}
function lineOf(src, pos){ let n=1; for (let k=0;k<pos&&k<src.length;k++) if (src.charCodeAt(k)===10) n++; return n; }

/* ---------- controlli sintattici con posizione (per segnare le righe e sottolineare) ---------- */
function lint(src, doc=parseDoc(src)){
  const out=[];
  const toks = solid(tokenize(src, doc.bs, doc.be));
  const br=[], env=[], lr=[];
  for (let k=0;k<toks.length;k++){
    const t=toks[k];
    if (t.t==='{') br.push(t);
    else if (t.t==='}'){ if (!br.length) out.push({s:t.s,e:t.e,kind:'e',msg:'graffa chiusa «}» senza la corrispondente «{»'}); else br.pop(); }
    else if (t.t==='\\begin' || t.t==='\\end'){
      const m=/^\\(?:begin|end)\s*\{([^}\n]*)\}/.exec(src.slice(t.s, doc.be));
      if (!m){ out.push({s:t.s,e:t.e,kind:'e',msg:`${t.t} senza il nome dell'ambiente`}); continue; }
      const e={name:m[1], s:t.s, e:t.s+m[0].length};
      while (k+1<toks.length && toks[k+1].e<=e.e) k++;
      if (t.t==='\\begin') env.push(e);
      else { const o=env.pop(); if (!o) out.push({...e,kind:'e',msg:`\\end{${e.name}} senza \\begin{${e.name}}`}); else if (o.name!==e.name){ out.push({...e,kind:'e',msg:`\\end{${e.name}} chiude \\begin{${o.name}} (riga ${lineOf(src,o.s)})`}); } }
    }
    else if (t.t==='\\left') lr.push(t);
    else if (t.t==='\\right'){ if (!lr.length) out.push({s:t.s,e:t.e,kind:'e',msg:'\\right senza il corrispondente \\left'}); else lr.pop(); }
    else if (t.t==='\\middle' && !lr.length) out.push({s:t.s,e:t.e,kind:'e',msg:'\\middle fuori da una coppia \\left … \\right'});
    else if ((t.t==='^'||t.t==='_')){
      /* doppio esponente o doppio pedice: x^2^3 */
      let j=k+1; if (j>=toks.length){ out.push({s:t.s,e:t.e,kind:'e',msg:`«${t.t}» senza argomento`}); continue; }
      if (toks[j].t==='{'){ let d=0; for (;j<toks.length;j++){ if (toks[j].t==='{') d++; else if (toks[j].t==='}' && --d===0) break; } }
      const n=toks[j+1], n2=toks[j+2];
      if (n && n.t===t.t) out.push({s:n.s,e:n.e,kind:'e',msg: t.t==='^'?'doppio esponente: usa le graffe, es. {x^2}^3':'doppio pedice: usa le graffe, es. {x_1}_2'});
      else if (n && (n.t==='^'||n.t==='_') && n2){ /* x_1^2^3 */
        let jj=j+2; if (toks[jj].t==='{'){ let d=0; for (;jj<toks.length;jj++){ if (toks[jj].t==='{') d++; else if (toks[jj].t==='}' && --d===0) break; } }
        const n3=toks[jj+1]; if (n3 && (n3.t===t.t||n3.t===n.t)) out.push({s:n3.s,e:n3.e,kind:'e',msg:'troppi indici sullo stesso simbolo: usa le graffe'});
      }
    }
  }
  for (const t of br) out.push({s:t.s,e:t.e,kind:'e',msg:'graffa «{» non chiusa'});
  for (const e of env) out.push({...e,kind:'e',msg:`\\begin{${e.name}} non chiuso`});
  for (const t of lr) out.push({s:t.s,e:t.e,kind:'e',msg:'\\left senza il corrispondente \\right'});
  return out;
}

/* ---------- modelli di inserimento ----------
   #0 = selezione corrente (o casella vuota), #? = casella da riempire. Gli stessi modelli valgono
   per MathLive (che li capisce nativamente) e per l'inserimento diretto nel sorgente. */
function expandForSource(tpl, sel){
  let caret=-1, t='', i=0, usedSel=false;
  while (i<tpl.length){
    if (tpl[i]==='#' && (tpl[i+1]==='0' || tpl[i+1]==='?')){
      if (tpl[i+1]==='0' && !usedSel && sel){ t+=sel; usedSel=true; }
      else {
        /* una cella vuota di matrice o sistema si scrive {}: senza, le righe vuote finali sparirebbero */
        const cell = CELL_BEFORE.test(t) && CELL_AFTER.test(tpl.slice(i+2));
        if (caret<0) caret=t.length+(cell?1:0);
        if (cell) t+='{}';
      }
      i+=2; continue;
    }
    t+=tpl[i++];
  }
  /* senza #0 (es. un simbolo) la selezione viene sostituita, come in MathLive */
  return {text:t, caret: caret<0 ? t.length : caret};
}
const endsWithCtrlWord = s => /\\[a-zA-Z@]+$/.test(s);

/* ---------- caselle vuote tra sorgente e formula ----------
   Nella formula una casella vuota è \placeholder{}; nel sorgente un argomento vuoto è {} (\frac{}{}, x^{}), ma MathLive
   rilegge {} come gruppo vuoto e non mostra la casella: per questo il testo passato alla formula la rimette.
   In due casi il vuoto cambierebbe anche la struttura: una cella vuota di matrice o sistema (\begin{cases}x\\ \end{cases}
   ha una riga sola, in LaTeX come in MathLive) e l'indice vuoto di \sqrt[]{} o delle frecce \xrightarrow[]{}.
   Lì il sorgente tiene {} (cella) e [] (indice), entrambi LaTeX valido, e la formula li mostra come caselle. */
const CELL_BEFORE = /(?:&|\\\\|\\begin\s*\{[a-zA-Z]+\*?\}(?:\{[^{}]*\})?)\s*$/;
const CELL_AFTER = /^\s*(?:&|\\\\|\\end\b)/;
const PH = String.raw`\\placeholder(?:\[[^\]]*\])?\{\}`;
const OPT_CMD = String.raw`\\(?:sqrt|x[a-zA-Z]*arrow)`;
/* comandi il cui argomento non è una formula: un {} vuoto resta com'è */
const NO_SLOT = /^\\(?:begin|end|text[a-z]*|mbox|hbox|operatorname|label|tag|ref|eqref|color|textcolor|colorbox|hspace|vspace|kern|mspace)$/;
/* align, align*, displaymath ed eqnarray dentro il corpo (per esempio due formule di seguito nel sorgente) fanno della
   radice di MathLive un ambiente, che resta tale anche per tutti i valori successivi: alla formula arriva l'equivalente annidabile */
const ROOT_ENVS = {'align':'aligned', 'align*':'aligned', 'displaymath':'gathered', 'eqnarray':'array}{rcl'};
const nestEnvs = feed => feed.replace(/\\(begin|end)\s*\{(align\*?|displaymath|eqnarray)\}/g, (m, be, env)=> be==='end' ? `\\end{${ROOT_ENVS[env].split('}')[0]}}` : `\\begin{${ROOT_ENVS[env]}}`);
/* sorgente → testo per MathLive */
function slotsToMF(feed){
  return nestEnvs(feed).replace(new RegExp(String.raw`(?<=(?:&|\\\\|\\begin\s*\{[a-zA-Z]+\*?\}(?:\{[^{}]*\})?)\s*)\{\s*\}(?=\s*(?:&|\\\\|\\end\b))`, 'g'), '\\placeholder{}')
             .replace(new RegExp(String.raw`(${OPT_CMD})\s*\[\s*\]`, 'g'), '$1[\\placeholder{}]')
             /* argomenti vuoti: dopo un comando, ^ o _, o dopo un altro argomento (\frac{a}{}, \sqrt[n]{}) */
             .replace(/(?<=(\\[a-zA-Z]+|[\^_\]}])\s*)\{\s*\}/g, (m, pre, at, s)=>{
               if (NO_SLOT.test(pre) || (pre==='}' && /\\(?:begin|end)\s*\{[^{}]*\}\s*$/.test(s.slice(0, at)))) return m;
               /* {}_{a}^{b}{}_{c}: base vuota tra due gruppi di indici, resta un gruppo */
               if (pre==='}' && /^\s*[_^]/.test(s.slice(at+m.length))) return m;
               return '{\\placeholder{}}';
             });
}
/* serializzazione di MathLive (formato 'latex', con le caselle) → LaTeX standard */
function slotsToSource(v){
  return v.replace(new RegExp(String.raw`(?<=(?:&|\\\\|\\begin\{[a-zA-Z]+\*?\}(?:\{[^{}]*\})?)\s*)${PH}(?=\s*(?:&|\\\\|\\end\{))`, 'g'), '{}')
          .replace(new RegExp(String.raw`(${OPT_CMD})\[${PH}\]`, 'g'), '$1[]')
          /* indici sui quattro lati: {}_{a}^{b}\placeholder{}_{c} → la base vuota resta un gruppo, non un doppio pedice */
          .replace(new RegExp(String.raw`(?<=\})${PH}(?=[_^])`, 'g'), '{}')
          .replace(/\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g, '$1');
}
const previewTex = tpl => tpl.replace(/#[0?]/g, '\\square');
