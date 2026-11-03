/* ============ TESTO: LaTeX → SVG con MathJax (fallback testo semplice) ============ */
const EX = 4.31*PT;                 // 1ex di Computer Modern 10pt, in cm
const textCache = new Map();
let mjPending = new Set();
function textPart(s){
  // testo in modo testo → sorgente MathJax
  s = s.replace(/---/g,'—').replace(/--/g,'–').replace(/``/g,'“').replace(/''/g,'”').replace(/~/g,' ');
  let out='', buf='';
  const flush=()=>{ if(buf){ out+='\\text{'+buf+'}'; buf=''; } };
  for (let k=0;k<s.length;k++){
    const c=s[k];
    if (c==='\\'){
      const m=/^\\([a-zA-Z]+|.)\s?/.exec(s.slice(k)); const nm=m[1];
      if ('&%#_${}'.includes(nm)){ flush(); out+= nm==='{'||nm==='}' ? '\\'+nm : nm==='$'?'\\$':'\\'+nm; k+=m[0].length-1; continue; }
      const argCmd={textbf:'\\textbf',textit:'\\textit',emph:'\\textit',texttt:'\\texttt',textsf:'\\textsf',textrm:'\\textrm',textup:'\\textrm',textsc:'\\textrm',mbox:'\\text',text:'\\text'};
      if (argCmd[nm] && s[k+m[0].length]==='{'){
        const st=k+m[0].length, en=matchClose(s,st); const inner=s.slice(st+1,en);
        flush(); out += argCmd[nm]+'{'+inner.replace(/[{}\\]/g,'')+'}'; k=en; continue;
      }
      if (nm==='underline' && s[k+m[0].length]==='{'){ const st=k+m[0].length, en=matchClose(s,st); flush(); out+='\\underline{'+textPart(s.slice(st+1,en))+'}'; k=en; continue; }
      if (nm==='textcolor' && s[k+m[0].length]==='{'){
        const st=k+m[0].length, en=matchClose(s,st); const st2=en+1; const en2=matchClose(s,st2);
        if (en2>0){ const c=parseColor(s.slice(st+1,en)); flush(); out+='{\\color{'+(c&&c!=='none'?css(c):'black')+'}'+textPart(s.slice(st2+1,en2))+'}'; k=en2; continue; }
      }
      if (/^(small|large|Large|LARGE|huge|Huge|tiny|scriptsize|footnotesize|normalsize|bfseries|itshape|sffamily|ttfamily|rmfamily|centering|raggedright|raggedleft|noindent|strut|par|quad|qquad|hfill|vfill|ldots|dots|LaTeX|TeX|today)$/.test(nm)){
        k+=m[0].length-1;
        if (nm==='quad'){ buf+=' '; } else if(nm==='qquad'){ buf+='  '; }
        else if (nm==='ldots'||nm==='dots'){ buf+='…'; } else if(nm==='LaTeX'){ buf+='LaTeX'; } else if(nm==='TeX'){ buf+='TeX'; }
        continue;
      }
      if (nm===' '||nm===','){ buf+=' '; k+=m[0].length-1; continue; }
      // comando sconosciuto: passa in modo matematico
      flush(); out+='\\'+nm+' '; k+=m[0].length-1; continue;
    }
    if (c==='{'||c==='}') continue;
    if (c==='&'){ flush(); out+='\\&'; continue; }
    buf+=c;
  }
  flush();
  return out;
}
function texify(text, st){
  let t = text.trim();
  const lines = splitLines(t);
  const conv = l => {
    // alterna testo / $matematica$
    let out='', k=0, inM=false, seg='';
    while (k<l.length){
      const c=l[k];
      if (c==='\\' && l[k+1]==='$'){ seg+='\\$'; k+=2; continue; }
      if (c==='\\' && (l[k+1]==='(' || l[k+1]===')')){ out+= inM ? seg : textPart(seg); seg=''; inM=!inM; k+=2; continue; }
      if (c==='$'){ out += inM ? '{'+seg+'}' : textPart(seg); seg=''; inM=!inM; k++; if(l[k]==='$')k++; continue; }
      seg+=c; k++;
    }
    out += inM ? seg : textPart(seg);
    return out;
  };
  let tex;
  if (lines.length>1){
    const a = st.align==='left'?'l':st.align==='right'?'r':'c';
    tex = '\\begin{array}{'+a+'}'+lines.map(conv).join('\\\\')+'\\end{array}';
  } else tex = conv(lines[0]);
  if (st.bold) tex='\\boldsymbol{'+tex+'}';
  return tex;
}
function splitLines(t){
  const out=[]; let cur='', d=0, m=false;
  for (let k=0;k<t.length;k++){
    const c=t[k];
    if (c==='$') m=!m;
    if (c==='{') d++; else if (c==='}') d--;
    if (c==='\\' && t[k+1]==='\\' && d===0 && !m){ out.push(cur); cur=''; k++; if(t[k+1]==='['){ const e=t.indexOf(']',k); if(e>0)k=e; } continue; }
    if (c==='\\'){ cur+=c+(t[k+1]||''); k++; continue; }
    cur+=c;
  }
  out.push(cur);
  return out.map(s=>s.trim());
}
let _mctx=null;
function measurePlain(s, size){
  _mctx = _mctx || document.createElement('canvas').getContext('2d');
  _mctx.font = `${size}px "Latin Modern Roman","Computer Modern",Georgia,serif`;
  return _mctx.measureText(s).width;
}
/* ritorna {svg: stringa, w, h, d} in cm; svg posizionata con angolo in alto a sinistra in (0,0) */
function renderTeX(text, st, color){
  const scale = st.font||1;
  const key = text+'\u0001'+scale+'\u0001'+st.align+'\u0001'+st.bold+'\u0001'+st.mathNode;
  let r = textCache.get(key);
  if (!r){
    r = null;
    if (window.__mjReady){
      let tex = st.mathNode ? text : texify(text, st);
      try {
        const node = MathJax.tex2svg(tex, {display:false});
        const svg = node.querySelector('svg');
        if (svg && !svg.querySelector('[data-mjx-error]') && !node.querySelector('merror')){
          const w = parseFloat(svg.getAttribute('width'))*EX*scale;
          const h = parseFloat(svg.getAttribute('height'))*EX*scale;
          const va = /vertical-align:\s*(-?[\d.]+)ex/.exec(svg.getAttribute('style')||'');
          const d = va ? -parseFloat(va[1])*EX*scale : 0;
          svg.removeAttribute('style'); svg.removeAttribute('width'); svg.removeAttribute('height');
          svg.setAttribute('overflow','visible');
          r = {inner: svg.outerHTML, w, h:h-d, d};
        } else {
          const err = node.querySelector('[data-mjx-error]');
          r = null; if (err) r = {err: err.getAttribute('data-mjx-error')};
        }
      } catch(e){
        if (e && e.retry && !mjPending.has(tex)){ mjPending.add(tex); e.retry.then(()=>{ mjPending.delete(tex); textCache.clear(); window.__onMJ&&window.__onMJ(); }).catch(()=>{}); }
        r = {err: 'MathJax: '+(e.message||'attesa')};
        if (e && e.retry) r.wait=true;
      }
    }
    if (!r || r.err){
      // fallback: testo semplice
      const lines = splitLines(text).map(l=>l.replace(/\$/g,'').replace(/\\[a-zA-Z]+\s?/g,'').replace(/[{}]/g,''));
      const fs = 10*PT*scale;
      const w = Math.max(0,...lines.map(l=>measurePlain(l,100)/100*fs));
      const lh = fs*1.2, h = lh*lines.length;
      const anc = st.align==='left'?'start':st.align==='right'?'end':'middle';
      const ax = st.align==='left'?0:st.align==='right'?w:w/2;
      const inner = `<g font-family="'Latin Modern Roman',Georgia,serif" font-size="${fs}" text-anchor="${anc}" fill="currentColor"${st.bold?' font-weight="bold"':''}>`+
        lines.map((l,k)=>`<text x="${ax}" y="${lh*(k+.8)}">${l.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`).join('')+'</g>';
      const err = r && r.err; const wait = r && r.wait;
      r = {plain:inner, w, h:h-lh*.2, d:lh*.2, err, wait};
    }
    if (!r.wait) textCache.set(key, r);
  }
  return r;
}
function texSVG(r, x, y, color, op){
  // (x,y) = angolo in alto a sinistra in coordinate SVG (cm, y verso il basso)
  const c = css(color);
  const o = op<1 ? ` opacity="${op}"` : '';
  if (r.inner){
    const vb = /viewBox="([^"]+)"/.exec(r.inner);
    return r.inner.replace('<svg', `<svg x="${x}" y="${y}" width="${r.w}" height="${r.h+r.d}" style="color:${c}"${o}`);
  }
  return `<g transform="translate(${x} ${y})" style="color:${c}"${o}>${r.plain}</g>`;
}
