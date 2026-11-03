let propsMin = !!store.get('tz-pmin');
/* ============ PANNELLO PROPRIETÀ, ESPORTAZIONE, ESEMPI, AVVIO ============ */
const SWATCH = ['black','gray','red','blue','green!50!black','orange','violet','teal','brown','cyan','magenta','yellow','blue!20','red!20','green!20','yellow!30','gray!20','white'];
function swatches(id, cur, allowNone=true){
  return `<div class="sw" data-sw="${id}">`+(allowNone?`<button class="none${cur==='none'?' on':''}" data-v="none" title="nessuno" aria-label="nessuno"></button>`:'')+
    SWATCH.map(c=>`<button style="background:${css(parseColor(c))}" data-v="${c}" title="${c}" aria-label="${c}"${cur===c?' class="on"':''}></button>`).join('')+'</div>';
}
function curItem(items, pred){ const it=items.find(pred); return it ? it : null; }
function optVal(items, key){ const it=items.find(i=>itemKey(i)===key); if(!it) return null; const k=it.indexOf('='); return k<0?true:unbrace(it.slice(k+1)); }
function updateProps(){
  const box=$('props'); const si=curStmt();
  if (si<0 || !lastR){ box.hidden=true; return; }
  const st=lastR.stmts[si]; const items=optItems(st);
  const cmd=st.cmd; const what = st.cd && st.cd.cell ? `cella ${st.cd.r}-${st.cd.c}` : '\\'+(cmd==='axis'?'begin{axis}':cmd);
  let h=`<h3><button class="pmin" id="p-min" title="Riduci o espandi il pannello" aria-label="Riduci pannello">${propsMin?'+':'−'}</button><span>Proprietà</span><code>${what} · r ${lineOfSrc(st.start)}</code></h3>`;
  const inl = (selNode!==null && selNode!==undefined && lastR.nodes[selNode] && lastR.nodes[selNode].stmt===si && !lastR.nodes[selNode].head && lastR.nodes[selNode].text) ? selNode : null;
  if (inl!==null) h += nodeSectionHTML(inl) + `<div class="sub">Percorso</div>`;
  h += `<div class="pr">`;
  const sel = (id, opts, cur) => `<select id="${id}">`+(cur && !opts.some(o=>o[0]===cur) ? opts.concat([[cur,cur]]) : opts).map(([v,l])=>`<option value="${esc(v)}"${v===cur?' selected':''}>${esc(l)}</option>`).join('')+'</select>';
  const bareCol = (items.find(isBareColor)||'').trim();
  const lw = (items.find(i=>LW[itemKey(i)]!==undefined)||'').trim() || (optVal(items,'line width')?'line width='+optVal(items,'line width'):'');
  const dash = (items.find(i=>isDash(i,itemKey(i)))||'').trim();
  const arr = (items.find(isArrowItem)||'').trim();
  const LWO=[['','normale'],['ultra thin','ultra thin'],['very thin','very thin'],['thin','thin'],['semithick','semithick'],['thick','thick'],['very thick','very thick'],['ultra thick','ultra thick']];
  const DO=[['','continua'],['dashed','dashed'],['densely dashed','densely dashed'],['dotted','dotted'],['densely dotted','densely dotted'],['dash dot','dash dot']];
  const AO=[['','nessuna'],['->','->'],['<-','<-'],['<->','<->'],['-latex','-latex'],['-stealth','-stealth'],['-{Stealth}','-{Stealth}'],['|-|','|-|'],['*-*','*-*'],['o->','o->']];
  if (cmd==='axis'){
    const f = (k,l)=>`<label for="ax-${k}">${l}</label><input type="text" id="ax-${k}" data-k="${k}" value="${esc(String(optVal(items,k)??''))}">`;
    h += f('xlabel','etichetta x')+f('ylabel','etichetta y')+f('title','titolo')+f('xmin','x min')+f('xmax','x max')+f('ymin','y min')+f('ymax','y max')+f('domain','dominio')+f('width','larghezza')+f('height','altezza');
    h += `<label for="ax-grid">griglia</label>`+sel('ax-grid',[['','nessuna'],['major','principale'],['minor','secondaria'],['both','entrambe']], String(optVal(items,'grid')||''));
    h += `<label for="ax-lines">assi</label>`+sel('ax-lines',[['','riquadro'],['middle','centrati'],['left','a sinistra'],['none','nascosti']], String(optVal(items,'axis lines')||''));
    h += `<label for="ax-leg">legenda</label>`+sel('ax-leg',[['','nord-est'],['north west','nord-ovest'],['south east','sud-est'],['south west','sud-ovest'],['outer north east','esterna']], String(optVal(items,'legend pos')||''));
  } else if (cmd==='addplot'){
    h += `<label>colore</label>`+swatches('acol', bareCol, false);
    if (st.expr) h += `<label for="ap-expr">funzione</label><input type="text" id="ap-expr" value="${esc(src.slice(st.expr.s, st.expr.e))}">`;
    h += `<label for="ap-dom">dominio</label><input type="text" id="ap-dom" value="${esc(String(optVal(items,'domain')||''))}" placeholder="-5:5">`;
    h += `<label for="ap-sam">campioni</label><input type="text" id="ap-sam" value="${esc(String(optVal(items,'samples')||''))}" placeholder="25">`;
    h += `<label for="lw">spessore</label>`+sel('lw',LWO,lw)+`<label for="dash">tratto</label>`+sel('dash',DO,dash);
    const mk = items.includes('only marks') ? 'only' : String(optVal(items,'mark')||'');
    h += `<label for="ap-mark">marker</label>`+sel('ap-mark',[['','nessuno'],['*','● pieno'],['o','○ vuoto'],['square*','■ quadrato'],['triangle*','▲ triangolo'],['x','× croce'],['+','+ più'],['only','solo punti']], mk);
    h += `<label for="ap-smooth">smussata</label><input type="checkbox" id="ap-smooth"${items.includes('smooth')?' checked':''}>`;
  } else if (st.uml){
    h += umlPropsHTML(si, st, items, sel);
  } else if (st.cd){
    h += cdPropsHTML(si, st, items, sel);
  } else {
    const isNode = cmd==='node' || cmd==='coordinate' || cmd==='matrix';
    if (st.cz) h += czPropsHTML(si, st, sel);
    if (isNode && st.text){
      h += `<label class="full" for="nd-text">testo (LaTeX)</label><textarea id="nd-text">${esc(src.slice(st.text.s, st.text.e))}</textarea>`;
      const shp = (items.find(i=>['circle','rectangle','ellipse','diamond','star','regular polygon','rounded rectangle','trapezium'].includes(i))||'');
      h += `<label for="nd-shape">forma</label>`+sel('nd-shape',[['','rettangolo'],['circle','cerchio'],['ellipse','ellisse'],['diamond','rombo'],['rounded rectangle','arrotondato'],['regular polygon','poligono'],['star','stella']], shp);
      if (items.some(i=>/^state( with(out)? output)?$/.test(i))){
        h += `<label for="au-init">iniziale</label><input type="checkbox" id="au-init"${items.some(i=>AUT_INIT_RE.test(itemKey(i)))?' checked':''}>`;
        h += `<label for="au-acc">accettante</label><input type="checkbox" id="au-acc"${items.some(i=>AUT_ACC_RE.test(itemKey(i)))?' checked':''}>`;
      }
    }
    const dv = optVal(items,'draw'); const fv = optVal(items,'fill');
    h += `<label>contorno</label>`+swatches('draw', dv===true?'black':dv===null?(isNode?'none':(bareCol||'black')):dv, true);
    h += `<label>riempimento</label>`+swatches('fill', fv===null?(cmd==='fill'||cmd==='filldraw'?bareCol:'none'):fv===true?'black':fv, true);
    if (isNode){ const tv=optVal(items,'text'); h += `<label>testo</label>`+swatches('text', tv||'', false);
      const fs = (String(optVal(items,'font')||'').match(/\\(tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge)/)||[])[1]||'';
      h += `<label for="nd-font">corpo</label>`+sel('nd-font',[['','normale'],['tiny','tiny'],['scriptsize','scriptsize'],['footnotesize','footnotesize'],['small','small'],['large','large'],['Large','Large'],['huge','huge']], fs);
    }
    h += `<label for="lw">spessore</label>`+sel('lw',LWO,lw)+`<label for="dash">tratto</label>`+sel('dash',DO,dash);
    if (!isNode) h += `<label for="arr">frecce</label>`+sel('arr',AO,arr);
    const op = String(optVal(items,'opacity')||optVal(items,'fill opacity')||'');
    h += `<label for="opac">opacità</label>`+sel('opac',[['','100%'],['0.8','80%'],['0.6','60%'],['0.4','40%'],['0.2','20%']], op);
  }
  if (canRotate(si)){ const ri=rotInfo(si,[0,0]); h += `<label for="p-rot">rotazione °</label><input type="text" id="p-rot" inputmode="decimal" value="${ri.angle||0}">`; }
  h += `</div>`+pointsHTML(si);
  h += `<div class="pbtns"><button class="btn" id="p-dup">Duplica</button><button class="btn" id="p-code">Mostra nel codice</button><button class="btn dng" id="p-del">Elimina</button></div>`;
  const focusId = document.activeElement && box.contains(document.activeElement) ? document.activeElement.id : null;
  const caret = focusId && document.activeElement.selectionStart;
  box.innerHTML = h; box.hidden=false; box.classList.toggle('min', propsMin);
  $('p-min').onclick=()=>{ propsMin=!propsMin; store.set('tz-pmin', propsMin?'1':''); updateProps(); };
  if (focusId){ const el=$(focusId); if (el){ el.focus(); try{ el.setSelectionRange(caret,caret); }catch(e){} } }
  wireProps(si, st, items);
  if (inl!==null) wireNodeSection(inl);
}
function wireProps(si, st, items){
  const box=$('props');
  const apply = t => { if (t!==src) setSource(t); };
  const cmd = st.cmd, isNode = cmd==='node'||cmd==='coordinate'||cmd==='matrix';
  box.querySelectorAll('[data-sw]').forEach(sw=>sw.addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return; const v=b.dataset.v; const kind=sw.dataset.sw;
    if (st.uml && (kind==='fill'||kind==='draw')){ apply(setOptions(si,{remove:(it,k)=>k===kind, add:[kind+'='+v]})); return; }
    if (kind==='acol'){ apply(setOptions(si,{remove:(it,k)=>isBareColor(it)||k==='color', add:[v]})); return; }
    if (kind==='text'){ apply(setOptions(si,{remove:(it,k)=>k==='text', add:[`text=${v}`]})); return; }
    if (kind==='draw'){
      if (cmd==='draw' && !isNode){ apply(setOptions(si,{remove:(it,k)=>k==='draw'||k==='color'||isBareColor(it), add: v==='none'?['draw=none']:v==='black'?[]:[v]})); }
      else apply(setOptions(si,{remove:(it,k)=>k==='draw', add: v==='none'?[]:[v==='black'?'draw':'draw='+v]}));
      return;
    }
    if (kind==='fill'){
      if ((cmd==='fill'||cmd==='filldraw') && !isNode) apply(setOptions(si,{remove:(it,k)=>k==='fill'||isBareColor(it), add: v==='none'?['fill=none']:['fill='+v]}));
      else apply(setOptions(si,{remove:(it,k)=>k==='fill', add: v==='none'?[]:['fill='+v]}));
    }
  }));
  const on = (id, fn, ev='change') => { const el=$(id); if (el) el.addEventListener(ev, ()=>fn(el.value, el)); };
  on('lw', v=>apply(setOptions(si,{remove:isLW, add:v?[v]:[]})));
  on('dash', v=>apply(setOptions(si,{remove:isDash, add:v?[v]:[]})));
  on('arr', v=>apply(setOptions(si,{remove:isArrowItem, add:v?[v]:[]})));
  on('opac', v=>apply(setOptions(si,{remove:(it,k)=>k==='opacity'||k==='fill opacity', add:v?[(isNode||cmd==='fill'?'fill opacity=':'opacity=')+v]:[]})));
  on('nd-shape', v=>apply(setOptions(si,{remove:(it)=>['circle','rectangle','ellipse','diamond','star','regular polygon','rounded rectangle','trapezium'].includes(it), add:v?[v]:[]})));
  on('au-init', (v,el)=>apply(setOptions(si,{remove:(it,k)=>AUT_INIT_RE.test(k), add: el.checked?['initial']:[]})));
  on('au-acc', (v,el)=>apply(setOptions(si,{remove:(it,k)=>AUT_ACC_RE.test(k), add: el.checked?['accepting']:[]})));
  on('nd-font', v=>apply(setOptions(si,{remove:(it,k)=>k==='font', add:v?['font=\\'+v]:[]})));
  on('nd-text', v=>{ const s=st.text; src = src.slice(0,s.s)+v+src.slice(s.e); ed.value=src; store.set('tz-src',src); renderNow(); }, 'input');
  box.querySelectorAll('[data-k]').forEach(inp=>inp.addEventListener('change', ()=>{
    const k=inp.dataset.k; let v=inp.value.trim();
    if (v && /[,=\[\]]/.test(v) && !/^\{.*\}$/.test(v)) v='{'+v+'}';
    apply(setOpt(si, k, v||null));
  }));
  box.querySelectorAll('[data-g]').forEach(t=>t.addEventListener('input', ()=>{ const g=st.groups[+t.dataset.g]; src=src.slice(0,g.s)+t.value+src.slice(g.e); ed.value=src; store.set('tz-src',src); renderNow(); }));
  on('um-geom', v=>apply(setOpt(si,'geometry',v||null)));
  on('um-type', v=>apply(setOpt(si,'type',v||null)));
  on('ax-grid', v=>apply(setOpt(si,'grid',v||null)));
  on('ax-lines', v=>apply(setOpt(si,'axis lines',v||null)));
  on('ax-leg', v=>apply(setOpt(si,'legend pos',v||null)));
  on('ap-expr', v=>{ const s=st.expr; apply(src.slice(0,s.s)+v+src.slice(s.e)); });
  on('ap-dom', v=>apply(setOpt(si,'domain',v.trim()||null)));
  on('ap-sam', v=>apply(setOpt(si,'samples',v.trim()||null)));
  on('ap-mark', v=>apply(setOptions(si,{remove:(it,k)=>k==='mark'||k==='only marks'||k==='no marks', add: v==='only'?['only marks']:v?['mark='+v]:['no marks']})));
  on('ap-smooth', (v,el)=>apply(setOptions(si,{remove:(it,k)=>k==='smooth', add: el.checked?['smooth']:[]})));
  const pr=$('p-rot'); if (pr) pr.addEventListener('change', ()=>{ const a=parseFloat(pr.value.replace(',','.'))||0; let c=[0,0]; if (selBB) c=[(selBB.x+selBB.x2)/2, -(selBB.y+selBB.y2)/2]; const ri=rotInfo(si,c); apply(setRotation(si, Math.round(a*10)/10, ri.cl, src)); });
  box.querySelectorAll('[data-pt]').forEach(inp=>inp.addEventListener('change', ()=>{
    const s0=+inp.dataset.s, e0=+inp.dataset.e; let v=inp.value.trim().replace(',','.');
    if (!/^-?\d*\.?\d+(cm|mm|pt|in|bp)?$/.test(v)){ toast('Valore non valido: scrivi un numero, es. -2.35'); inp.value=src.slice(s0,e0); return; }
    apply(src.slice(0,s0)+v+src.slice(e0));
  }));
  box.querySelectorAll('[data-hk]').forEach(l=>l.addEventListener('click', ()=>{ selHandle=+l.dataset.hk; drawOverlay(); updateProps(); }));
  if (st.cd) cdWireProps(si, st, items);
  if (st.cz) czWireProps(si, st);
  $('p-del').onclick=deleteSel; $('p-dup').onclick=duplicateSel;
  $('p-code').onclick=()=>{ ed.focus(); ed.setSelectionRange(st.start, st.end); revealStmt(); };
}

/* ---------- modale ---------- */
function modal(title, html){ $('m-t').textContent=title; $('m-b').innerHTML=html; $('modal').hidden=false; }
$('m-x').onclick=()=>$('modal').hidden=true;
$('modal').addEventListener('click', e=>{ if (e.target.id==='modal') $('modal').hidden=true; });
document.addEventListener('keydown', e=>{ if (e.key==='Escape' && !$('modal').hidden){ $('modal').hidden=true; e.stopImmediatePropagation(); } }, true);

/* ---------- esportazione ---------- */
function figureCode(){ const f=figs[Math.min(figIdx,figs.length-1)]; return f ? src.slice(f.s, f.e) : src; }
function libsFor(code){
  const L=new Set();
  if (/[\[,]\s*(state|initial|accepting)\b/.test(code)) L.add('automata');
  if (/Stealth|Latex|Triangle|\{[A-Z][a-z]+\[/.test(code)) L.add('arrows.meta');
  if (/=\s*[\d.]*\s*(cm|mm|pt)?\s*of\s/.test(code)||/=of\s/.test(code)) L.add('positioning');
  if (/\(\s*\$/.test(code)) L.add('calc');
  if (/\b(diamond|star|regular polygon|trapezium|isosceles triangle|semicircle|kite|dart|cylinder|ellipse\s*[,\]])/.test(code)) L.add('shapes.geometric');
  if (/rounded rectangle|chamfered rectangle|signal|tape/.test(code)) L.add('shapes.misc');
  if (/single arrow|double arrow/.test(code)) L.add('shapes.arrows');
  if (/callout/.test(code)) L.add('shapes.callouts');
  if (/pattern\s*=/.test(code)) L.add('patterns');
  if (/matrix/.test(code)) L.add('matrix');
  if (/decorat/.test(code)) L.add('decorations.pathmorphing');
  if (/shading\s*=|ball color|inner color/.test(code)) L.add('shadings');
  if (/pgfonlayer/.test(code)) L.add('backgrounds');
  return [...L];
}
function standalone(){
  const code=figureCode(); const libs=libsFor(code);
  const pre = figs.length ? src.slice(0, figs[0].s).split('\n').filter(l=>/^\s*\\(definecolor|colorlet|tikzset|tikzumlset|tikzcdset|ctikzset|pgfplotsset|pgfplotstableread|usetikzlibrary|newcommand|def|tikzstyle)/.test(l)).join('\n') : '';
  const pgf = /\\begin\{(axis|semilogxaxis|semilogyaxis|loglogaxis)\}|\\addplot|\\pgfplotstableread/.test(code+pre);
  const uml = /\\uml[a-zA-Z]|\\begin\{uml|\\tikzumlset/.test(code+pre);
  const cd = /\\begin\{tikzcd\}|\\tikzcdset/.test(code+pre);
  const circ = /\\begin\{circuitikz\}|\\ctikzset/.test(code+pre) || lastR.stmts.some(st=>st.cz) || new RegExp('\\[[^\\]]*\\b('+Object.keys(CZ_NODES).join('|')+')\\b').test(code);
  const czOpt = (/\\usepackage\s*(\[[^\]]*\])\s*\{circuitikz\}/.exec(src)||[])[1]||'';
  return `\\documentclass[tikz,border=4pt]{standalone}\n`+(uml?`\\usepackage{tikz-uml}\n`:'')+(cd?(/\\(lrcorner|ulcorner|urcorner|llcorner)/.test(code)?`\\usepackage{amssymb}\n`:'')+`\\usepackage{tikz-cd}\n`:'')+(circ?`\\usepackage${czOpt}{circuitikz}\n`:'')+(pgf?`\\usepackage{pgfplots`+(/\\pgfplotstableread/.test(code+pre)?',pgfplotstable':'')+`}\n\\pgfplotsset{compat=1.18}\n`+(/fill between/.test(code)?`\\usepgfplotslibrary{fillbetween}\n`:''):'')+(libs.length?`\\usetikzlibrary{${libs.join(',')}}\n`:'')+(pre?pre+'\n':'')+`\\begin{document}\n${code}\n\\end{document}\n`;
}
function exportSVG(){
  const clone = drawG.cloneNode(true);
  clone.querySelectorAll('.hit,.hitf,.cmark').forEach(el=>el.remove());
  clone.querySelectorAll('[data-s],[data-n]').forEach(el=>{ el.removeAttribute('data-s'); el.removeAttribute('data-n'); });
  let bb; try{ bb=drawG.getBBox(); }catch(e){ bb={x:0,y:0,width:1,height:1}; }
  const m=.1; const x=bb.x-m, y=bb.y-m, w=bb.width+2*m, h=bb.height+2*m;
  const ptw=fmt(w/PT,2), pth=fmt(h/PT,2);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${ptw}pt" height="${pth}pt" viewBox="${fmt(x,4)} ${fmt(y,4)} ${fmt(w,4)} ${fmt(h,4)}">${clone.innerHTML}</svg>`;
}
function pngFrom(svg, scale=4){
  return new Promise((res,rej)=>{
    const img=new Image(); const blob=new Blob([svg],{type:'image/svg+xml'}); const url=URL.createObjectURL(blob);
    img.onload=()=>{ const vb=/viewBox="([^"]+)"/.exec(svg)[1].split(' ').map(Number); const W=Math.max(1,Math.round(vb[2]/PT*scale*1.333)), H=Math.max(1,Math.round(vb[3]/PT*scale*1.333));
      const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.drawImage(img,0,0,W,H); URL.revokeObjectURL(url); try{ res(c.toDataURL('image/png')); }catch(e){ rej(e); } };
    img.onerror=rej; img.src=url;
  });
}
$('b-export').onclick=async()=>{
  const svg=exportSVG(); const sa=standalone();
  const files=[...lastR.dataUsed];
  modal('Esporta', `<p>Il codice si copia negli appunti. L'immagine PNG si salva con clic destro (o tenendo premuto) → «Salva immagine».</p>`+
  (files.length?`<p>La figura legge ${files.map(f=>`<code>${esc(f)}</code>`).join(', ')}: per compilarla tieni ${files.length>1?'i file':'il file'} nella stessa cartella del .tex.</p>`:'')+`
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="x-tikz">Copia codice TikZ</button><button class="btn" id="x-doc">Copia documento LaTeX completo</button><button class="btn" id="x-svg">Scarica SVG</button></div>
  <img id="x-png" alt="Anteprima PNG della figura" style="min-height:40px">
  <pre id="x-pre">${esc(sa)}</pre>`);
  $('x-tikz').onclick=()=>copyText(figureCode(),'Codice TikZ copiato');
  $('x-doc').onclick=()=>copyText(sa,'Documento copiato');
  $('x-svg').onclick=()=>{
    const name = (docName||'figura')+(figs.length>1 ? '-'+(Math.min(figIdx,figs.length-1)+1) : '')+'.svg';
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'})); a.download=name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
    toast('Scaricato '+name);
  };
  try{ $('x-png').src = await pngFrom(svg); }catch(e){ $('x-png').alt='Anteprima PNG non disponibile in questo browser'; }
};

/* ---------- apertura file ---------- */
$('b-open').onclick=()=>$('file').click();
$('file').addEventListener('change', e=>{ loadFiles([...e.target.files]); e.target.value=''; });
/* un .tex diventa il sorgente; .csv, .dat, .tsv (e .txt senza comandi LaTeX) diventano file di dati */
let docName = '';   // nome del .tex aperto, per i file scaricati
async function loadFiles(list){
  const read = f => new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(String(r.result)); r.onerror=()=>res(null); r.readAsText(f); });
  let tex=null; const data={};
  for (const f of list){
    const t=await read(f); if (t===null) continue;
    if (DATA_EXT.test(f.name) && !(/\.txt$/i.test(f.name) && /\\(begin|draw|addplot|node)\b/.test(t))) data[f.name]=t;
    else if (!tex) tex={name:f.name, t};
  }
  const nd=Object.keys(data).length;
  if (nd) setData(data, !tex);
  if (tex){ docName=tex.name.replace(/\.[^.]+$/,''); figIdx=0; selStart=null; setSource(tex.t); requestAnimationFrame(fitView); }
  const missing=[...lastR.dataUsed].filter(n=>dataFile(n)===null);
  toast((tex?'Aperto '+tex.name+(figs.length>1?` · ${figs.length} figure`:''):'')+(tex&&nd?' · ':'')+(nd?`dati: ${Object.keys(data).join(', ')}`:'')+(missing.length?` · manca ${missing.join(', ')}`:''));
}
function setData(obj, render=true){
  Object.assign(DATA, obj);
  try{ localStorage.setItem('tz-data', JSON.stringify(DATA)); }catch(e){ toast('File di dati troppo grandi per essere ricordati al prossimo avvio'); }
  if (render && lastR) renderNow();
}
function dropData(name){ delete DATA[name]; store.set('tz-data', JSON.stringify(DATA)); renderNow(); }
{ try{ const d=JSON.parse(store.get('tz-data')||'{}'); if (d && typeof d==='object') DATA=d; }catch(e){} }
function dataModal(){
  const used=lastR ? [...lastR.dataUsed] : [];
  const rows=Object.keys(DATA).sort().map(k=>{
    const lines=DATA[k].split(/\r?\n/).filter(l=>l.trim());
    return `<tr><td><code>${esc(k)}</code>${used.includes(k)?' <span class="tag">in uso</span>':''}</td><td>${lines.length} righe</td><td><button class="btn" data-dv="${esc(k)}">Anteprima</button> <button class="btn dng" data-dd="${esc(k)}">Rimuovi</button></td></tr>`;
  }).join('');
  const missing=used.filter(n=>dataFile(n)===null);
  modal('Dati', `<p>I grafici possono leggere i dati da file: <code>\\addplot table[col sep=comma] {dati.csv};</code>, <code>\\pgfplotstableread</code> e <code>plot file {…}</code>. Carica qui i file che nel progetto stanno accanto al .tex (o trascinali insieme al .tex). Restano nel browser fino a quando li rimuovi.</p>`+
    (missing.length?`<p class="warn">Il codice usa file non ancora caricati: ${missing.map(m=>`<code>${esc(m)}</code>`).join(', ')}</p>`:'')+
    (rows?`<table class="dt">${rows}</table>`:'<p><i>Nessun file di dati caricato.</i></p>')+
    `<div style="display:flex;gap:8px;margin-top:10px"><button class="btn pri" id="d-add">Aggiungi file…</button></div><pre id="d-pre" hidden></pre>`);
  $('d-add').onclick=()=>$('file').click();
  $('m-b').querySelectorAll('[data-dv]').forEach(b=>b.onclick=()=>{ const p=$('d-pre'); p.hidden=false; p.textContent=DATA[b.dataset.dv].split(/\r?\n/).slice(0,20).join('\n'); });
  $('m-b').querySelectorAll('[data-dd]').forEach(b=>b.onclick=()=>{ dropData(b.dataset.dd); dataModal(); });
}
$('b-data').onclick=dataModal;
let dragDepth=0;
window.addEventListener('dragenter', e=>{ if ([...(e.dataTransfer?.types||[])].includes('Files')){ dragDepth++; $('drop').hidden=false; } });
window.addEventListener('dragleave', ()=>{ if(--dragDepth<=0){ dragDepth=0; $('drop').hidden=true; } });
window.addEventListener('dragover', e=>e.preventDefault());
window.addEventListener('drop', e=>{ e.preventDefault(); dragDepth=0; $('drop').hidden=true; if (e.dataTransfer.files.length) loadFiles([...e.dataTransfer.files]); });
ed.addEventListener('paste', ()=>setTimeout(()=>{ if (findFigures(src).length!==figs.length) { figIdx=0; renderNow(); fitView(); } },0));

/* ---------- esempi ---------- */
const EXAMPLES = {
'Funzioni (pgfplots)': String.raw`\begin{tikzpicture}
  \begin{axis}[
      axis lines=middle, xlabel=$x$, ylabel=$y$,
      xmin=-3.5, xmax=3.5, ymin=-1.5, ymax=4.5,
      grid=major, legend pos=north west,
      width=9cm, height=6.5cm]
    \addplot[blue, very thick, domain=-3:3, samples=80] {x^2/2};
    \addplot[red, thick, domain=-3.4:3.4, samples=120] {sin(deg(2*x))};
    \addplot[only marks, mark=*, black] coordinates {(-2,2) (0,0) (2,2)};
    \legend{$\frac{x^2}{2}$, $\sin 2x$, campioni}
  \end{axis}
\end{tikzpicture}`,
'Barre': String.raw`\begin{tikzpicture}
  \begin{axis}[
      ybar, bar width=12pt, ymin=0,
      symbolic x coords={Lun,Mar,Mer,Gio,Ven}, xtick=data,
      ylabel={Ore}, title={Studio settimanale},
      nodes near coords, enlarge x limits=0.15,
      legend pos=north west]
    \addplot coordinates {(Lun,3) (Mar,4.5) (Mer,2) (Gio,5) (Ven,3.5)};
    \addplot coordinates {(Lun,1) (Mar,2) (Mer,2.5) (Gio,1.5) (Ven,3)};
    \legend{Analisi, Fisica}
  \end{axis}
\end{tikzpicture}`,
'Area tra curve': String.raw`\begin{tikzpicture}
  \begin{axis}[axis lines=left, xlabel=$x$, ylabel=$y$, domain=0:2, samples=60, enlargelimits=false, ymax=4.5]
    \addplot[name path=f, thick, blue] {x^2};
    \addplot[name path=g, thick, red] {2*x};
    \addplot[blue!20] fill between[of=f and g];
    \node[anchor=west] at (axis cs:1.2,1) {$\int_0^2 (2x-x^2)\,dx$};
  \end{axis}
\end{tikzpicture}`,
'Logaritmico': String.raw`\begin{tikzpicture}
  \begin{semilogyaxis}[xlabel={$n$}, ylabel={tempo (s)}, grid=both, legend pos=north west, mark size=1.5pt]
    \addplot coordinates {(1,0.002) (2,0.01) (3,0.08) (4,0.5) (5,4) (6,30)};
    \addplot+[dashed] coordinates {(1,0.001) (2,0.002) (3,0.004) (4,0.008) (5,0.016) (6,0.032)};
    \legend{esponenziale, lineare}
  \end{semilogyaxis}
\end{tikzpicture}`,
'Diagramma a blocchi': String.raw`\begin{tikzpicture}[
    box/.style={draw, rounded corners, fill=blue!10, minimum width=2.4cm, minimum height=9mm},
    >=stealth, node distance=12mm]
  \node[box] (in) at (0,0) {Ingresso};
  \node[box, fill=orange!20] (pr) at (3.5,0) {Elaborazione};
  \node[box] (out) at (7,0) {Uscita};
  \node[draw, circle, fill=green!20] (fb) at (3.5,-2) {$K$};
  \draw[->, thick] (in) -- (pr);
  \draw[->, thick] (pr) -- node[above] {$y(t)$} (out);
  \draw[->] (out) |- (fb);
  \draw[->] (fb) -| (in);
\end{tikzpicture}`,
'Geometria': String.raw`\begin{tikzpicture}[scale=1.2]
  \draw[help lines] (-0.5,-0.5) grid (4.5,3.5);
  \coordinate (A) at (0,0);
  \coordinate (B) at (4,0);
  \coordinate (C) at (1.5,3);
  \fill[blue!15] (A) -- (B) -- (C) -- cycle;
  \draw[thick] (A) -- (B) -- (C) -- cycle;
  \draw[red, dashed] (C) -- (1.5,0);
  \draw (1.5,0.25) -- (1.75,0.25) -- (1.75,0);
  \foreach \p/\pos in {A/below left, B/below right, C/above} \fill (\p) circle (1.5pt) node[\pos] {$\p$};
  \draw (0.6,0) arc (0:63.4:0.6) node[midway, right] {$\alpha$};
\end{tikzpicture}`,
'Grafo': String.raw`\begin{tikzpicture}[every node/.style={draw, circle, minimum size=8mm, fill=white}, >=latex]
  \node (a) at (0,0) {$a$};
  \node (b) at (2.5,1.2) {$b$};
  \node (c) at (2.5,-1.2) {$c$};
  \node (d) at (5,0) {$d$};
  \draw[->] (a) to[bend left] node[draw=none, fill=none, above] {3} (b);
  \draw[->] (a) to[bend right] node[draw=none, fill=none, below] {5} (c);
  \draw[->] (b) -- (c);
  \draw[->] (b) to[bend left] (d);
  \draw[->] (c) to[bend right] (d);
  \draw[->] (d) to[loop right] (d);
\end{tikzpicture}`,
'Automa (automata)': String.raw`\begin{tikzpicture}[->, >=Stealth, shorten >=1pt, auto, node distance=2.8cm, on grid, semithick]
  \node[state, initial] (q0) {$q_0$};
  \node[state] (q1) [above right=of q0] {$q_1$};
  \node[state] (q2) [below right=of q0] {$q_2$};
  \node[state, accepting] (q3) [below right=of q1] {$q_3$};
  \path (q0) edge node {$a$} (q1)
             edge node [swap] {$b$} (q2)
        (q1) edge [loop above] node {$a$} ()
             edge node {$b$} (q3)
        (q2) edge [bend right] node [swap] {$a$} (q3)
        (q3) edge [bend right] node [swap] {$b$} (q2);
\end{tikzpicture}`,
'Albero': String.raw`\begin{tikzpicture}[level distance=13mm, level 1/.style={sibling distance=30mm}, level 2/.style={sibling distance=14mm},
    every node/.style={draw, circle, fill=teal!15, minimum size=7mm}]
  \node {8}
    child {node {3} child {node {1}} child {node {6}}}
    child {node {10} child {node {9}} child {node {14}}};
\end{tikzpicture}`,
'Matrice': String.raw`\begin{tikzpicture}
  \matrix (m) [matrix of math nodes, row sep=12mm, column sep=14mm] {
    A & B \\
    C & D \\
  };
  \draw[->] (m-1-1) -- node[above] {$f$} (m-1-2);
  \draw[->] (m-1-1) -- node[left] {$g$} (m-2-1);
  \draw[->] (m-1-2) -- node[right] {$h$} (m-2-2);
  \draw[->] (m-2-1) -- node[below] {$k$} (m-2-2);
\end{tikzpicture}`,
'Classi UML (tikz-uml)': String.raw`\begin{tikzpicture}
  \begin{umlpackage}{zoo}
    \umlabstract[x=0, y=0]{Animale}{
      \# nome : String \\ \# eta : int
    }{
      + verso() : void \\ \umlstatic{+ conta() : int}
    }
    \umlclass[x=-2.5, y=-3.5]{Cane}{}{+ verso() : void}
    \umlclass[x=2.5, y=-3.5]{Gatto}{- vite : int}{+ verso() : void}
  \end{umlpackage}
  \umlinterface[x=6.5, y=0]{Nutribile}{}{+ mangia(c : Cibo) : void}
  \umlinherit[geometry=|-|]{Cane}{Animale}
  \umlinherit[geometry=|-|]{Gatto}{Animale}
  \umlimpl{Animale}{Nutribile}
  \umlclass[x=6.5, y=-3.5]{Ciotola}{}{}
  \umlaggreg[arg2=cibo, mult2=0..*, pos2=0.85]{Ciotola}{Nutribile}
  \umlnote[x=10, y=-1, width=2.6cm]{Nutribile}{Ogni animale dello zoo deve poter mangiare.}
\end{tikzpicture}`,
'Casi d\'uso (tikz-uml)': String.raw`\begin{tikzpicture}
  \umlactor[x=0, y=0]{Cliente}
  \begin{umlsystem}{Negozio online}
    \umlusecase[x=4, y=1.2, name=ord]{Ordina un prodotto}
    \umlusecase[x=4, y=-1.2, name=pag]{Paga}
    \umlusecase[x=9, y=-1.2, name=sconto]{Applica sconto}
  \end{umlsystem}
  \umlassoc{Cliente}{ord}
  \umlassoc{Cliente}{pag}
  \umlinclude{ord}{pag}
  \umlextend{sconto}{ord}
\end{tikzpicture}`,
'Stati (tikz-uml)': String.raw`\begin{tikzpicture}
  \umlstateinitial[x=0, y=0, name=ini]
  \umlbasicstate[x=2.5, y=0, name=att]{Attesa}
  \umlbasicstate[x=6, y=0, name=lav]{In lavorazione}
  \umlstatefinal[x=6, y=-2.5, name=fin]
  \umltrans{ini}{att}
  \umltrans[arg=richiesta]{att}{lav}
  \umltrans[arg=fine]{lav}{fin}
  \umltrans[recursive=60|120|1.2cm, arg=timeout]{att}{att}
\end{tikzpicture}`,
'Sequenza (tikz-uml)': String.raw`\begin{tikzpicture}
  \begin{umlseqdiag}
    \umlactor[x=0, class=Utente]{u}
    \umlobject[x=3.5, class=Server]{s}
    \umldatabase[x=7, class=DB]{db}
    \begin{umlcall}[op=login(), return=token]{u}{s}
      \begin{umlcall}[op=cerca(id), return=dati]{s}{db}
      \end{umlcall}
      \begin{umlcallself}[op=verifica()]{s}
      \end{umlcallself}
    \end{umlcall}
    \begin{umlfragment}[type=alt, label=token valido]
      \begin{umlcall}[op=richiesta(), return=risposta]{u}{s}
      \end{umlcall}
      \umlfpart[altrimenti]
      \begin{umlcall}[op=errore(), type=asynchron]{s}{u}
      \end{umlcall}
    \end{umlfragment}
  \end{umlseqdiag}
\end{tikzpicture}`,
'Componenti (tikz-uml)': String.raw`\begin{tikzpicture}
  \begin{umlcomponent}[x=0, y=0]{Applicazione}
    \umlbasiccomponent[x=0, y=0]{Interfaccia utente}
    \umlbasiccomponent[x=4.5, y=0]{Logica}
  \end{umlcomponent}
  \umlbasiccomponent[x=10, y=0]{Archivio}
  \umlassemblyconnector[interface=Servizi]{Interfaccia utente}{Logica}
  \umlprovidedinterface[interface=Dati, distance=1.2cm]{Archivio}
  \umlrequiredinterface[interface=Configurazione, distance=1.2cm]{Applicazione}
  \umlport{Logica}{east}
  \umldelegateconnector{Logica-east-port}{Archivio}
\end{tikzpicture}`,
'Onde e \\foreach': String.raw`\begin{tikzpicture}
  \foreach \i in {0,...,5} {
    \draw[blue!\i0!red, thick] plot[smooth, domain=0:6.28, samples=50] (\x, {sin(deg(\x) + \i*30)*0.4 + \i*0.5});
  }
  \draw[->] (0,-0.6) -- (6.6,-0.6) node[right] {$t$};
\end{tikzpicture}`,
'Diagramma commutativo (tikz-cd)': String.raw`\begin{tikzcd}[column sep=large, row sep=large]
  A \arrow[r, "f"] \arrow[d, "g"'] \arrow[dr, dashed, "h" description] & B \arrow[d, "k"] \\
  C \arrow[r, hook, "i"'] & D \arrow[r, two heads, "p"] & E \arrow[l, bend right, "s"']
\end{tikzcd}`,
'Circuito RLC (circuitikz)': String.raw`\begin{circuitikz}
  \draw (0,0) to[V, v=$V_s$] (0,3)
        to[R=$R_1$, i=$i$] (3,3)
        to[L=$L$] (6,3)
        to[C=$C$] (6,0) -- (0,0);
  \draw (3,3) to[R=$R_2$, *-*] (3,0);
  \draw (3,0) node[ground]{};
\end{circuitikz}`,
'Dati da CSV (pgfplots)': String.raw`\begin{tikzpicture}
  \begin{axis}[xlabel={ore}, ylabel={$^\circ$C}, grid=major, legend pos=south east, width=9cm, height=6cm]
    \addplot[blue, thick, mark=*] table[x=tempo, y=temperatura, col sep=comma] {misure.csv};
    \addlegendentry{temperatura}
  \end{axis}
\end{tikzpicture}`
};
/* file di dati che accompagnano gli esempi */
const EXAMPLE_DATA = {'Dati da CSV (pgfplots)': {'misure.csv': `tempo,temperatura,umidita\n0,18.2,61\n1,18.9,60\n2,19.8,57\n3,21.4,52\n4,22.9,48\n5,23.6,46\n6,23.1,47\n7,22.0,50\n8,20.7,54\n`}};
$('b-ex').onclick=()=>{
  modal('Esempi', `<p>Carica un esempio: sostituisce il codice attuale (puoi annullare con Ctrl+Z).</p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px">`+
    Object.keys(EXAMPLES).map(k=>`<button class="btn" data-ex="${esc(k)}" style="text-align:left;padding:10px">${esc(k)}</button>`).join('')+'</div>');
  $('m-b').querySelectorAll('[data-ex]').forEach(b=>b.onclick=()=>{ $('modal').hidden=true; figIdx=0; selStart=null; if (EXAMPLE_DATA[b.dataset.ex]) setData(EXAMPLE_DATA[b.dataset.ex], false); setSource(EXAMPLES[b.dataset.ex]); requestAnimationFrame(fitView); });
};

/* ---------- barra ---------- */
$('b-undo').onclick=undo; $('b-redo').onclick=redo;
$('b-snap').onclick=()=>{ snapOn=!snapOn; $('b-snap').classList.toggle('on',snapOn); };
$('snapstep').onchange=e=>{ snapStep=+e.target.value; const s=snapStep; const p=$('gridp'); };

/* ---------- avvio ---------- */
window.__onMJ = () => { textCache.clear(); renderNow(); };
(function boot(){
  const saved = store.get('tz-src');
  src = saved && saved.trim() ? saved : EXAMPLES['Funzioni (pgfplots)'] + '\n';
  ed.value = src;
  renderNow(); applyView();
  requestAnimationFrame(()=>{ applyView(); fitView(); });
  if (window.__mjReady) window.__onMJ();
})();

function pointsHTML(si){
  const rows=[]; let np=0, nc=0;
  stmtHandles(si).forEach((h,ord)=>{ if (rows.length>=24) return; const key=ord;
    const hh=h.h; let lab, a, b;
    if (hh.kind==='abs'){ a=hh.x; b=hh.y; }
    else if (hh.kind==='polar'){ a=hh.a; b=hh.r; }
    else if (hh.kind==='radius'){ a=null; b=hh.r; }
    else if (hh.kind==='x'){ a=hh.x; b=null; }
    if (hh.proxy) lab='('+hh.pname+')';
    else if (hh.kind==='radius') lab='raggio';
    else if (h.role==='ctl') lab='c'+(++nc);
    else lab=(h.base?'+':'')+'P'+(++np);
    if (hh.kind==='polar') lab+=' ∠,r';
    const inp = sp => sp ? `<input type="text" inputmode="decimal" data-pt="1" data-s="${sp.s}" data-e="${sp.e}" value="${esc(src.slice(sp.s,sp.e))}" aria-label="${lab}">` : '<span></span>';
    rows.push(`<label data-hk="${key}" class="${selHandle===ord?'on':''}" title="Seleziona: poi muovi con le frecce (Ctrl = passo 0,01)">${esc(lab)}</label>${inp(a)}${inp(b)}`);
  });
  if (!rows.length) return '';
  return `<div class="pts"><div class="ph">Coordinate · x, y</div>${rows.join('')}<div class="ptip">Trascina con <b>Alt</b> per ignorare la griglia. Clic su un punto, poi frecce per spostarlo (<b>Ctrl</b>+frecce: passo 0,01).</div></div>`;
}

/* ---------- elementi tikz-uml ---------- */
function umlPropsHTML(si, st, items, sel){
  const cmd=st.cmd; let h='';
  (st.groups||[]).forEach((g,k)=>{ h += `<label class="full" for="um-g${k}">${esc(g.label)}</label><textarea id="um-g${k}" data-g="${k}">${esc(src.slice(g.s,g.e))}</textarea>`; });
  const val = k => { const v=optVal(items,k); return v===null||v===true ? '' : String(v); };
  const f = (k,l,ph='') => `<label for="um-${k.replace(/\s/g,'-')}">${l}</label><input type="text" id="um-${k.replace(/\s/g,'-')}" data-k="${k}" value="${esc(val(k))}" placeholder="${esc(ph)}">`;
  if (st.uml==='rel'){
    if (!/^uml(HV|VH)/.test(cmd)) h += `<label for="um-geom">geometria</label>`+sel('um-geom',[['','-- diretta'],['-|','-| orizzontale, poi verticale'],['|-','|- verticale, poi orizzontale'],['-|-','-|- a gradino orizzontale'],['|-|','|-| a gradino verticale']], val('geometry'));
    if (/assemblyconnector$/.test(cmd)) return h + f('interface','interfaccia');
    if (/trans$/.test(cmd)) return h + f('arg','etichetta');
    h += f('arg1','etichetta 1')+f('mult1','molteplicità 1','es. 1..*')+f('arg2','etichetta 2')+f('mult2','molteplicità 2')+f('stereo','stereotipo');
    return h;
  }
  if (st.uml==='call'){
    h += `<label for="um-type">tipo</label>`+sel('um-type',[['','sincrona'],['asynchron','asincrona']], val('type'));
    return h + f('op','operazione','es. calcola()') + f('return','ritorno') + f('dt','ritardo (ex)');
  }
  if (cmd==='umlfragment'){
    h += `<label for="um-type">tipo</label>`+sel('um-type',[['','opt'],['alt','alt'],['loop','loop'],['par','par'],['break','break'],['critical','critical'],['neg','neg'],['ref','ref']], val('type'));
    return h + f('label','condizione');
  }
  if (/interface$/.test(cmd)) return h + f('interface','interfaccia') + f('distance','distanza','1.5cm');
  if (cmd==='umlclass') h += `<label for="um-type">tipo</label>`+sel('um-type',[['','classe'],['abstract','astratta'],['interface','interfaccia'],['typedef','typedef'],['enum','enumerazione']], val('type'));
  if (/^uml(object|database|multi|entity|boundary|control|createcall)$/.test(cmd) || (cmd==='umlactor' && st.seq)) h += f('class','classe');
  if (!/^uml(state(initial|final|join)|port|seqdiag|createcall)$/.test(cmd)){
    h += `<label>riempimento</label>`+swatches('fill', val('fill'), false);
    h += `<label>contorno</label>`+swatches('draw', val('draw'), false);
    h += `<label>testo</label>`+swatches('text', val('text'), false);
  }
  if (st.uml==='el' && !stmtHandles(si).length && !/^uml(port|providedinterface|requiredinterface|createcall)$/.test(cmd)) h += f('x','x','0')+(st.seq?'':f('y','y','0'));
  if (st.uml==='el' && !/^uml(actor|statefinal|stateinitial|statejoin)$/.test(cmd)) h += f('width','larghezza', /note/.test(cmd)?'3cm':'');
  if (/^uml(class|abstract|interface|typedef|enum)$/.test(cmd)) h += f('template','template');
  return h;
}

/* ---------- nodo dentro un percorso: testo, corpo, posizione ---------- */
const PLACES = [['','sul punto'],['above','sopra'],['below','sotto'],['left','a sinistra'],['right','a destra'],['above left','sopra a sinistra'],['above right','sopra a destra'],['below left','sotto a sinistra'],['below right','sotto a destra']];
const ALONG = [['','alla fine'],['at start','all\'inizio'],['near start','vicino all\'inizio'],['midway','a metà'],['near end','vicino alla fine']];
const FONTS = [['','normale'],['\\tiny','tiny'],['\\scriptsize','scriptsize'],['\\footnotesize','footnotesize'],['\\small','small'],['\\large','large'],['\\Large','Large'],['\\huge','huge']];
function nodeSectionHTML(n){
  const nd=lastR.nodes[n]; const it=nodeItems(n);
  const sel=(id,opts,cur)=>`<select id="${id}">`+(cur && !opts.some(o=>o[0]===cur) ? opts.concat([[cur,cur]]) : opts).map(([v,l])=>`<option value="${esc(v)}"${v===cur?' selected':''}>${esc(l)}</option>`).join('')+'</select>';
  const pl = it.find(i=>PLACE[itemKey(i)]); const plK = pl?itemKey(pl):''; const plV = pl && pl.includes('=') ? unbrace(pl.slice(pl.indexOf('=')+1)) : '';
  const al = it.find(i=>/^(at start|near start|midway|near end|at end|very near start|very near end)$/.test(i)) || '';
  const fv = optVal(it,'font'); const fsz = fv && fv!==true ? ((String(fv).match(/\\(tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge)/)||[])[0]||'') : '';
  const xs=optVal(it,'xshift'), ys=optVal(it,'yshift'), tv=optVal(it,'text');
  return `<div class="sub">Testo del nodo</div><div class="pr">
    <textarea id="nn-text" aria-label="Testo del nodo">${esc(src.slice(nd.text.s, nd.text.e))}</textarea>
    <label for="nn-font">corpo</label>${sel('nn-font',FONTS,fsz)}
    <label for="nn-bold">grassetto</label><input type="checkbox" id="nn-bold"${fv&&/\\bfseries/.test(String(fv))?' checked':''}>
    <label for="nn-place">posizione</label>${sel('nn-place',PLACES,plK)}
    <label for="nn-dist">distanza</label><input type="text" id="nn-dist" value="${esc(plV)}" placeholder="es. 2mm"${plK?'':' disabled'}>
    <label for="nn-along">sul tratto</label>${sel('nn-along',ALONG,al)}
    <label for="nn-sloped">inclinato</label><input type="checkbox" id="nn-sloped"${it.includes('sloped')?' checked':''}>
    <label>colore</label>${swatches('nn-col', tv&&tv!==true?String(tv):'', false)}
    <label>spostamento</label><span class="shiftv">${xs||ys ? esc((xs||'0pt')+', '+(ys||'0pt'))+' <button class="btn" id="nn-reset">azzera</button>' : 'trascina il testo'}</span>
  </div>`;
}
function wireNodeSection(n){
  const apply = t => { if (t!==src) setSource(t); };
  const set = (rm, add) => apply(setNodeOpts(n, {remove:rm, add}));
  const g = id => $(id);
  const tx=g('nn-text'); if (tx) tx.addEventListener('input', ()=>{ const s=lastR.nodes[n].text; src=src.slice(0,s.s)+tx.value+src.slice(s.e); ed.value=src; store.set('tz-src',src); renderNow(); });
  const fontVal = () => { const f=g('nn-font').value, b=g('nn-bold').checked; const v=(f||'')+(b?'\\bfseries':''); return v ? ['font='+v] : []; };
  g('nn-font').onchange = ()=>set((it,k)=>k==='font', fontVal());
  g('nn-bold').onchange = ()=>set((it,k)=>k==='font', fontVal());
  const place = ()=>{ const p=g('nn-place').value, d=g('nn-dist').value.trim(); return p ? [d ? `${p}=${d}` : p] : []; };
  g('nn-place').onchange = ()=>set((it,k)=>!!PLACE[k] || k==='anchor', place());
  g('nn-dist').onchange = ()=>set((it,k)=>!!PLACE[k], place());
  g('nn-along').onchange = ()=>set((it,k)=>/^(at start|near start|midway|near end|at end|very near start|very near end|pos)$/.test(k), g('nn-along').value?[g('nn-along').value]:[]);
  g('nn-sloped').onchange = ()=>set((it,k)=>k==='sloped', g('nn-sloped').checked?['sloped']:[]);
  const r=g('nn-reset'); if (r) r.onclick=()=>set((it,k)=>k==='xshift'||k==='yshift', []);
  document.querySelectorAll('[data-sw="nn-col"]').forEach(sw=>sw.addEventListener('click', e=>{ e.stopPropagation(); const b=e.target.closest('button'); if(!b) return; set((it,k)=>k==='text', ['text='+b.dataset.v]); }, true));
}
