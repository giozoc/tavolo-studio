/* ============ INCOLLA E IMPORTA: Excel, LibreOffice, Google Fogli, CSV, righe LaTeX ============
   Dagli appunti di un foglio di calcolo arrivano due versioni: testo separato da tabulazioni e una tabella HTML.
   Si preferisce l'HTML, che porta anche le celle unite (diventano \multicolumn e \multirow); il testo è il ripiego.
   I file CSV si leggono come in Tavolo TikZ: separatore riconosciuto da solo, virgolette, righe vuote ignorate. */
const Paste = (()=>{
  const ESC = {'\\':'\\textbackslash{}', '~':'\\textasciitilde{}', '^':'\\textasciicircum{}'};
  /* testo semplice → LaTeX: i numeri restano come sono, i caratteri speciali si proteggono */
  const texEscape = s => String(s).replace(/\s*\n\s*/g,' ').replace(/[ \t]+/g,' ').trim().replace(/[\\&%$#_{}~^]/g, ch => ESC[ch] || '\\'+ch);

  /* ---------- CSV e testo separato ---------- */
  function sniff(text){
    const lines=text.split(/\r?\n/).filter(l=>l.trim()).slice(0,20);
    let best=',', score=-1;
    for (const d of ['\t',';',',','|']){
      const counts=lines.map(l=>splitLine(l,d).length);
      if (!counts.length || counts[0]<2) continue;
      const same=counts.filter(n=>n===counts[0]).length;
      const s=same*10+counts[0];
      if (s>score){ score=s; best=d; }
    }
    return best;
  }
  function splitLine(l, d){ return parseDelimited(l, d)[0]||[]; }
  function parseDelimited(text, d){
    const rows=[]; let row=[], cell='', q=false, i=0;
    text=text.replace(/^﻿/,'');
    while (i<text.length){
      const ch=text[i];
      if (q){
        if (ch==='"'){ if (text[i+1]==='"'){ cell+='"'; i+=2; continue; } q=false; i++; continue; }
        cell+=ch; i++; continue;
      }
      if (ch==='"' && cell.trim()===''){ q=true; cell=''; i++; continue; }
      if (ch===d){ row.push(cell); cell=''; i++; continue; }
      if (ch==='\r'){ i++; continue; }
      if (ch==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; i++; continue; }
      cell+=ch; i++;
    }
    if (cell!=='' || row.length){ row.push(cell); rows.push(row); }
    return rows.filter(r=>r.some(c=>c.trim()!=='')).map(r=>r.map(c=>c.trim()));
  }
  /* ---------- tabella HTML degli appunti (Excel, LibreOffice, Google Fogli, pagine web) ---------- */
  function fromHTML(html){
    const doc=new DOMParser().parseFromString(html, 'text/html');
    const tb=doc.querySelector('table'); if (!tb) return null;
    const data=[], merges=[], bold=[];
    const taken=new Set();
    [...tb.rows].forEach((tr, r)=>{
      data[r]=data[r]||[]; let c=0;
      for (const td of tr.cells){
        while (taken.has(r+','+c)) c++;
        const cs=Math.max(1, +td.colSpan||1), rs=Math.max(1, +td.rowSpan||1);
        td.querySelectorAll('br').forEach(b=>b.replaceWith('\n'));
        const t=(td.textContent||'').replace(/ /g,' ');
        data[r][c]=t.trim();
        const st=(td.getAttribute('style')||'')+(td.querySelector('b,strong')?';font-weight:bold':'');
        if (/font-weight:\s*(bold|[6-9]00)/.test(st) || td.tagName==='TH') bold.push([r,c]);
        for (let i=0;i<rs;i++) for (let j=0;j<cs;j++){ if (i||j){ taken.add((r+i)+','+(c+j)); data[r+i]=data[r+i]||[]; data[r+i][c+j]=''; } }
        if (cs>1||rs>1) merges.push({r, c, rs, cs});
        c+=cs;
      }
    });
    const n=Math.max(...data.map(r=>r.length));
    for (const r of data) for (let c=0;c<n;c++) if (r[c]===undefined) r[c]='';
    return {data, merges, bold};
  }
  /* righe LaTeX copiate da un altro sorgente: a & b \\ c & d \\ */
  function fromLatex(text){
    if (!/&/.test(text) || !/\\\\/.test(text)) return null;
    const b=scanBody(text, 0, text.length);
    if (!b.rows.length) return null;
    return {data: b.rows.map(r=>r.cells.map(c=>stripComments(text.slice(c.vs, c.ve)))), latex:true};
  }
  /* che cosa c'è negli appunti */
  function read(dt){
    const html=dt.getData('text/html'), latex=dt.getData('text/x-latex'), text=dt.getData('text/plain');
    if (latex){ const x=fromLatex(latex); if (x) return x; }
    if (html && /<table/i.test(html)){ const x=fromHTML(html); if (x && x.data.length) return x; }
    if (!text) return null;
    const lx=fromLatex(text); if (lx) return lx;
    if (/\\begin\s*\{(tabular|tabularx|longtable)/.test(text)) return {tex:text};
    const d = text.includes('\t') ? '\t' : sniff(text);
    return {data: parseDelimited(text.replace(/\n$/,''), d)};
  }
  /* ---------- incolla nella griglia a partire dalla cella selezionata ---------- */
  function fromClipboard(dt){
    const x=read(dt);
    if (!x){ toast('Negli appunti non ci sono dati da incollare'); return; }
    if (x.tex){ Ribbon.insertTable(x.tex.trim()); toast('Tabella LaTeX aggiunta'); return; }
    if (!curT()){ Ribbon.insertTable(build(x, defaults())); toast('Tabella creata dagli appunti'); return; }
    into(x);
  }
  function into(x){
    const T=curT(); const sr=View.range();
    let data=x.data.map(r=>r.map(c=> x.latex ? c : texEscape(c)));
    if (x.bold) for (const [r,c] of x.bold) if (data[r]?.[c]) data[r][c]=`\\textbf{${data[r][c]}}`;
    /* un solo valore su più celle selezionate: le riempie tutte */
    if (data.length===1 && data[0].length===1 && (sr.r2>sr.r1 || sr.c2>sr.c1)) data=Array.from({length:sr.r2-sr.r1+1}, ()=>Array(sr.c2-sr.c1+1).fill(data[0][0]));
    const m=data.length, n=Math.max(...data.map(r=>r.length));
    const ops=[];
    const R=T.rows.length, C=T.ncols;
    const lastType = (()=>{ const col=T.cols[C-1]; return col ? St.src.slice(col.cs,col.e).replace(/\s+/g,'') : 'l'; })();
    for (let c=C;c<sr.c1+n;c++) ops.push({op:'colins', at:c, type:/^[lcr]$/.test(lastType)?lastType:'l'});
    for (let r=R;r<sr.r1+m;r++) ops.push({op:'rowins', at:r});
    const colType = c => c<C ? T.cols[c].type : 'l';
    for (let i=0;i<m;i++) for (let j=0;j<n;j++){
      let t=data[i][j]??''; const c=sr.c1+j;
      if (colType(c)==='S' && t && !isSiNumber(t) && !/^\{[\s\S]*\}$/.test(t)) t='{'+t+'}';
      ops.push({op:'set', r:sr.r1+i, c, t, soft:true});
    }
    for (const g of (x.merges||[])){
      const r=sr.r1+g.r, c=sr.c1+g.c;
      if (g.cs>1) for (let i=0;i<g.rs;i++) ops.push({op:'mergeh', r:r+i, c1:c, c2:c+g.cs-1, spec:'c'});
      if (g.rs>1) ops.push({op:'mergev', c, r1:r, r2:r+g.rs-1});
    }
    /* le celle già uguali non si riscrivono */
    const tmp=Grid.of(T, St.src);
    const final=ops.filter(o=>{ if (o.op!=='set' || !o.soft) return true; const row=tmp.rows[o.r]; if (!row) return true; const f=Grid.find(row, o.c); return !f || row.cells[f.k].t!==o.t; }).map(o=>{ const {soft, ...rest}=o; return rest; });
    if (!final.length){ toast('Niente da cambiare'); return; }
    St.sel={r:sr.r1, c:sr.c1, r2:sr.r1+m-1, c2:sr.c1+n-1};
    doOp({op:'batch', ops:final}, {msg:`Incollate ${m}×${n} celle`+(x.merges?.length?` · ${x.merges.length} unite`:'')});
  }

  /* ---------- nuova tabella dai dati ---------- */
  const defaults = () => ({header:true, style:'booktabs', env:'tabular', float:true, caption:'', si:true});
  function build(x, o){
    let data=x.data.map(r=>r.map(c=> x.latex ? c : texEscape(c)));
    const n=Math.max(1, ...data.map(r=>r.length)); data=data.map(r=>{ const a=r.slice(); while (a.length<n) a.push(''); return a; });
    const body=data.slice(o.header?1:0);
    const align=Array.from({length:n}, (_,c)=>{
      const vals=body.map(r=>r[c]).filter(Boolean);
      const num = vals.length && vals.every(isSiNumber);
      if (!num) return 'l';
      if (!o.si) return 'r';
      let wi=0, wf=0, neg=false;
      for (const v of vals){ const m=/^\s*([+-]?)(\d*)(?:[.,](\d*))?/.exec(v.replace(/\s+/g,'')); if (m[1]==='-') neg=true; wi=Math.max(wi,m[2].length); wf=Math.max(wf,(m[3]||'').length); }
      return `S[table-format=${neg?'-':''}${wi||1}.${wf}]`;
    });
    data=data.map((r,i)=>r.map((v,c)=> /^S/.test(align[c]) && v && !isSiNumber(v) ? '{'+v+'}' : v));
    if (o.header && x.bold) for (const [r,c] of x.bold) if (r>0 && data[r]?.[c]) data[r][c]=`\\textbf{${data[r][c]}}`;
    let tex=genTable(data, {style:o.style, env:o.env, header:o.header, align, float:o.float, caption:o.caption});
    /* celle unite degli appunti: si applicano con le stesse operazioni della griglia */
    if (x.merges?.length){
      const ops=[]; for (const g of x.merges){ if (g.cs>1) for (let i=0;i<g.rs;i++) ops.push({op:'mergeh', r:g.r+i, c1:g.c, c2:g.c+g.cs-1, spec:'c'}); if (g.rs>1) ops.push({op:'mergev', c:g.c, r1:g.r, r2:g.r+g.rs-1}); }
      const res=Ops.run(tex, 0, {op:'batch', ops}); if (!res.error) tex=res.src;
    }
    return tex;
  }
  function modalImport(text='', name=''){
    modal('Importa dati', `<p>Incolla qui le celle copiate da Excel, LibreOffice o Google Fogli, oppure il contenuto di un file CSV${name?` (<code>${esc(name)}</code>)`:''}. Il separatore si riconosce da solo; i caratteri speciali di LaTeX vengono protetti.</p>
      <textarea class="csv" id="im-t" spellcheck="false" placeholder="Nome;Altezza;Peso&#10;Anna;1,68;57&#10;Luca;1,82;79">${esc(text)}</textarea>
      <div class="iform">
        <label>Separatore <select id="im-d"><option value="">automatico</option><option value=",">virgola</option><option value=";">punto e virgola</option><option value="\t">tabulazione</option><option value="|">barra</option></select></label>
        <label>Stile <select id="im-st"><option value="booktabs">booktabs</option><option value="grid">griglia</option><option value="plain">senza regole</option></select></label>
        <label>Ambiente <select id="im-env"><option>tabular</option><option>tabularx</option><option>longtable</option></select></label>
        <label><input type="checkbox" id="im-h" checked> Prima riga come intestazione</label>
        <label><input type="checkbox" id="im-si" checked> Numeri in colonne <code>S</code> (siunitx)</label>
        <label><input type="checkbox" id="im-fl" checked> Dentro <code>table</code></label>
        <label>Didascalia <input type="text" id="im-cap" placeholder="facoltativa"></label>
        <label><button class="btn" id="im-file">Scegli un file CSV…</button></label>
      </div>
      <h3>Anteprima del codice</h3><pre id="im-pv"></pre>
      <div class="pbtns"><button class="btn pri" id="im-ok">Aggiungi la tabella</button><button class="btn" id="im-rep">Sostituisci il sorgente</button>${curT()?'<button class="btn" id="im-in">Incolla nella tabella dalla cella selezionata</button>':''}</div>`);
    const get = () => {
      const t=$('im-t').value; if (!t.trim()) return null;
      const d=$('im-d').value || (t.includes('\t') ? '\t' : sniff(t));
      const lx=fromLatex(t);
      return lx || {data:parseDelimited(t, d)};
    };
    const opts = () => ({header:$('im-h').checked, style:$('im-st').value, env:$('im-env').value, float:$('im-fl').checked && $('im-env').value!=='longtable', caption:texEscape($('im-cap').value), si:$('im-si').checked});
    const upd = () => { const x=get(); $('im-pv').textContent = x ? build(x, opts()) : ''; };
    $('m-b').querySelectorAll('textarea,select,input').forEach(el=>el.addEventListener('input', upd));
    $('im-file').onclick=()=>{ const f=document.createElement('input'); f.type='file'; f.accept='.csv,.tsv,.txt,.dat'; f.onchange=async()=>{ const file=f.files[0]; if (file){ $('im-t').value=await file.text(); upd(); } }; f.click(); };
    $('im-ok').onclick=()=>{ const x=get(); if (!x) return toast('Nessun dato'); closeModal(); Ribbon.insertTable(build(x, opts())); toast('Tabella importata'); };
    $('im-rep').onclick=()=>{ const x=get(); if (!x) return toast('Nessun dato'); closeModal(); St.sel={r:0,c:0,r2:0,c2:0}; St.ti=0; setSource(build(x, opts())+'\n'); toast('Tabella importata'); };
    if ($('im-in')) $('im-in').onclick=()=>{ const x=get(); if (!x) return toast('Nessun dato'); closeModal(); into(x); };
    upd(); $('im-t').focus();
  }
  $('b-import').onclick=()=>modalImport();
  $('e-import').onclick=()=>modalImport();
  /* incollare nel foglio vuoto (senza tabella) crea la tabella */
  document.addEventListener('paste', e=>{
    if (curT() || document.activeElement===ed || $('modal').hidden===false || /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||'')) return;
    if (!$('right').contains(document.activeElement) && document.activeElement!==document.body) return;
    e.preventDefault(); fromClipboard(e.clipboardData);
  });
  return {fromClipboard, read, parseDelimited, sniff, fromHTML, fromLatex, texEscape, build, modalImport, into};
})();
