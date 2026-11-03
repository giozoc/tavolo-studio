/* ============ PANNELLO: esempi, esportazione, apertura dei file, scorciatoie, avvio ============ */
const EXAMPLES = [
['Risultati con booktabs e siunitx', String.raw`\begin{table}[htbp]
  \centering
  \caption{Tempi di esecuzione (media di 10 prove)}
  \label{tab:tempi}
  \begin{tabular}{@{}l S[table-format=3.1] S[table-format=3.1] S[table-format=1.2]@{}}
    \toprule
    & \multicolumn{2}{c}{Tempo (\si{\milli\second})} & \\
    \cmidrule(lr){2-3}
    Algoritmo & {Medio} & {Peggiore} & {Rapporto} \\
    \midrule
    Quicksort  & 12.4  & 98.7  & 0.13 \\ % pivot casuale
    Mergesort  & 15.1  & 16.0  & 0.94 \\
    Heapsort   & 21.8  & 23.5  & 0.93 \\
    Timsort    & 9.6   & 15.2  & 0.63 \\ % implementazione di Python
    \bottomrule
  \end{tabular}
\end{table}`],
['Griglia classica', String.raw`\begin{tabular}{|l|c|r|}
  \hline
  Prodotto & Quantità & Prezzo (\euro) \\
  \hline
  Quaderno & 3 & 4,50 \\
  \hline
  Penna    & 10 & 12,00 \\
  \hline
  Zaino    & 1 & 39,90 \\
  \hline
\end{tabular}`],
['Celle unite', String.raw`\begin{tabular}{llcc}
  \toprule
  \multirow{2}{*}{Regione} & \multirow{2}{*}{Provincia} & \multicolumn{2}{c}{Popolazione} \\
  \cmidrule(lr){3-4}
  & & 2011 & 2021 \\
  \midrule
  \multirow{3}{*}{Campania} & Napoli  & 3054956 & 2988376 \\
                            & Salerno & 1092876 & 1070383 \\
                            & Caserta & 904921  & 916722  \\
  \midrule
  \multirow{2}{*}{Puglia}   & Bari    & 1247303 & 1226784 \\
                            & Lecce   & 802018  & 779090  \\
  \bottomrule
\end{tabular}`],
['Testo lungo con tabularx', String.raw`\begin{tabularx}{\textwidth}{@{}lX@{}}
  \toprule
  Termine & Definizione \\
  \midrule
  Pivot & Elemento scelto per dividere il vettore in due parti: a sinistra i minori, a destra i maggiori. \\
  Stabilità & Un ordinamento è stabile se lascia nello stesso ordine gli elementi con chiavi uguali. \\
  In loco & L'algoritmo usa solo una quantità costante di memoria aggiuntiva. \\
  \bottomrule
\end{tabularx}`],
['Elenco lungo con longtable', String.raw`\begin{longtable}{@{}rlr@{}}
  \caption{Elementi della tavola periodica}\label{tab:elementi} \\
  \toprule
  Z & Elemento & Massa (u) \\
  \midrule
  \endfirsthead
  \toprule
  Z & Elemento & Massa (u) \\
  \midrule
  \endhead
  \bottomrule
  \endfoot
  1 & Idrogeno & 1.008 \\
  2 & Elio & 4.003 \\
  3 & Litio & 6.94 \\
  4 & Berillio & 9.012 \\
  5 & Boro & 10.81 \\
  6 & Carbonio & 12.011 \\
  7 & Azoto & 14.007 \\
  8 & Ossigeno & 15.999 \\
\end{longtable}`],
['Formule nelle celle', String.raw`\begin{tabular}{@{}lll@{}}
  \toprule
  Funzione & Derivata & Primitiva \\
  \midrule
  $x^n$ & $n x^{n-1}$ & $\frac{x^{n+1}}{n+1}$ \\
  $e^x$ & $e^x$ & $e^x$ \\
  $\ln x$ & $\frac{1}{x}$ & $x \ln x - x$ \\
  $\sin x$ & $\cos x$ & $-\cos x$ \\
  $\cos x$ & $-\sin x$ & $\sin x$ \\
  \bottomrule
\end{tabular}`],
['Colori e intestazione in grassetto', String.raw`\begin{tabular}{lcc}
  \toprule
  \rowcolor{gray!15}
  \textbf{Squadra} & \textbf{Punti} & \textbf{Reti} \\
  \midrule
  Napoli & 82 & 77 \\
  \rowcolor{gray!8}
  Inter & 76 & 71 \\
  Milan & 70 & 64 \\
  \bottomrule
\end{tabular}`],
];

/* ---------- pacchetti richiesti ---------- */
function packagesFor(src){
  const p=[];
  const ts=parseAll(src);
  const specs=ts.map(t=>src.slice(t.spec[0], t.spec[1])).join(' ');
  if (/\\(top|mid|bottom|cmid)rule|\\addlinespace|\\specialrule|\\morecmidrules/.test(src)) p.push('booktabs');
  if (/\\multirow/.test(src)) p.push('multirow');
  if (ts.some(t=>t.cols.some(c=>c.type==='S'||c.type==='s')) || /\\(SI|si|num|qty|unit|ang)\b/.test(src)) p.push('siunitx');
  if (ts.some(t=>t.env==='tabularx')) p.push('tabularx');
  if (ts.some(t=>t.env==='tabulary')) p.push('tabulary');
  if (ts.some(t=>/^longtable/.test(t.env))) p.push('longtable');
  if (/[mb]\s*\{|[<>]\s*\{|[wW]\s*\{/.test(specs) || /\\newcolumntype/.test(src)) p.push('array');
  if (/\\(makecell|thead|Xhline|Xcline)/.test(src)) p.push('makecell');
  if (/\\(rowcolor|cellcolor|rowcolors|arrayrulecolor)/.test(src)) p.push('[table]{xcolor}');
  else if (/\\(textcolor|color)\b/.test(src)) p.push('xcolor');
  if (/\\hhline/.test(src)) p.push('hhline');
  if (/\\(hdashline|cdashline)/.test(src)) p.push('arydshln');
  if (/\\(resizebox|scalebox|includegraphics)/.test(src)) p.push('graphicx');
  if (/\\euro/.test(src)) p.push('eurosym');
  if (ts.some(t=>NICE_ENVS.has(t.env))) p.push('nicematrix');
  if (ts.some(t=>TBLR_ENVS.has(t.env))) p.push('tabularray');
  return p;
}
/* tabularray: \toprule e le colonne S vogliono le sue librerie */
function tblrLibraries(src){
  const ts=parseAll(src).filter(t=>TBLR_ENVS.has(t.env)); if (!ts.length) return [];
  const body=ts.map(t=>src.slice(t.bs, t.be)).join('\n'), L=[];
  if (/\\(top|mid|bottom|cmid)rule|\\addlinespace|\\specialrule/.test(body)) L.push('booktabs');
  if (ts.some(t=>t.cols.some(c=>c.type==='S'||c.type==='s')) || /\\(SI|si|num|qty|unit)\b/.test(body)) L.push('siunitx');
  return L;
}
function texDocument(body=St.src){
  const pk=packagesFor(body);
  const lines=['\\documentclass{article}', '\\usepackage[T1]{fontenc}', '\\usepackage{amsmath,amssymb}'];
  for (const x of pk) lines.push(x.startsWith('[') ? `\\usepackage${x}` : `\\usepackage{${x}}`);
  const lib=tblrLibraries(body); if (lib.length) lines.push(`\\UseTblrLibrary{${lib.join(',')}}`);
  return lines.join('\n')+'\n\n\\begin{document}\n\n'+body.replace(/\s+$/,'')+'\n\n\\end{document}\n';
}
/* testo semplice di una cella (per CSV e Markdown) */
const plainOf = t => { const d=document.createElement('div'); d.innerHTML=Render.html(t).replace(/<br>/g,' '); d.querySelectorAll('.m').forEach(m=>m.textContent='$'+m.dataset.tex+'$'); d.querySelectorAll('.lbl').forEach(m=>m.remove()); return d.textContent.replace(/\s+/g,' ').trim(); };
function tableMatrix(T){ return T.rows.filter(r=>!r.special).map(r=>{ const out=[]; for (const c of r.cells){ out.push(plainOf(c.t)); for (let i=1;i<(c.mc?c.mc.n:1);i++) out.push(''); } while (out.length<T.ncols) out.push(''); return out; }); }
const csvOf = m => m.map(r=>r.map(v=>/[",;\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v).join(',')).join('\n')+'\n';
const mdOf = (m, T) => { const al=T.cols.map(colAlign).map(a=>a==='c'?':---:':a==='r'||a==='num'?'---:':'---'); const row=r=>'| '+r.map(v=>v.replace(/\|/g,'\\|')).join(' | ')+' |'; return [row(m[0]||[]), '| '+al.join(' | ')+' |', ...m.slice(1).map(row)].join('\n')+'\n'; };

$('b-export').onclick=()=>{
  const T=curT(); const doc=texDocument(); const pk=packagesFor(St.src);
  modal('Esporta', `<p>Il codice si copia così com'è. Il documento .tex aggiunge i pacchetti che servono${pk.length?': '+pk.map(x=>`<code>${esc(x.replace(/^\[table\]\{(.*)\}$/,'$1 [table]'))}</code>`).join(', '):''}.</p>
    <div class="pbtns"><button class="btn pri" id="x-copy">Copia il LaTeX</button><button class="btn" id="x-doc">Scarica il documento .tex</button><button class="btn" id="x-pre">Copia il preambolo</button>
    ${Docs.active()?`<button class="btn" id="x-file">Scarica ${esc(Docs.name())}</button>`:''}</div>
    ${T?`<h3>Dati della tabella</h3><div class="pbtns"><button class="btn" id="x-csv">Scarica CSV</button><button class="btn" id="x-md">Copia come Markdown</button><button class="btn" id="x-tsv">Copia per Excel</button></div>
    <h3>Immagine</h3><p>La tabella com'è disegnata nella griglia, senza intestazioni e selezione: per slide e anteprime. Per la stampa conviene compilare.</p>
    <div class="pbtns"><button class="btn" id="x-svg">Scarica SVG</button><button class="btn" id="x-png">Scarica PNG</button></div>`:''}
    <h3>Documento</h3><pre>${esc(doc)}</pre>`);
  $('x-copy').onclick=()=>copyText(St.src, 'Codice LaTeX copiato');
  $('x-doc').onclick=()=>{ download('tabella.tex', doc, 'application/x-tex'); toast('Scaricato tabella.tex'); };
  $('x-pre').onclick=()=>copyText(doc.split('\\begin{document}')[0].trim()+'\n', 'Preambolo copiato');
  if ($('x-file')) $('x-file').onclick=()=>Docs.save();
  if (T){
    const m=tableMatrix(T);
    $('x-csv').onclick=()=>{ download('tabella.csv', csvOf(m), 'text/csv'); toast('Scaricato tabella.csv'); };
    $('x-md').onclick=()=>copyText(mdOf(m, T), 'Tabella Markdown copiata');
    $('x-tsv').onclick=()=>copyText(m.map(r=>r.join('\t')).join('\n'), 'Copiata: incollala in un foglio di calcolo');
    $('x-svg').onclick=()=>Tools.exportImage('svg'); $('x-png').onclick=()=>Tools.exportImage('png');
  }
};
const copyLatex = () => copyText(St.src, 'Codice LaTeX copiato');
$('b-copy').onclick=copyLatex; $('b-copy2').onclick=copyLatex;

/* ---------- esempi ---------- */
function openExamples(){
  modal('Esempi', `<div class="exgrid">${EXAMPLES.map(([t,s],k)=>`<button class="exb" data-k="${k}"><span class="exv">${miniTable(s,4,4)}</span><b>${esc(t)}</b></button>`).join('')}</div>`);
  MJ.fill($('m-b'));
  $('m-b').querySelectorAll('.exb').forEach(b=>b.onclick=()=>{ closeModal(); Docs.close(false); St.ti=0; St.sel={r:0,c:0,r2:0,c2:0}; setSource(EXAMPLES[+b.dataset.k][1]); $('gridbox').focus({preventScroll:true}); });
}
$('b-ex').onclick=openExamples; $('e-ex').onclick=openExamples;
$('e-new').onclick=()=>Ribbon.openPop('new', $('b-new'));

/* ---------- apertura dei file ---------- */
$('b-open').onclick=()=>$('file').click();
$('file').addEventListener('change', e=>{ loadFile(e.target.files[0]); e.target.value=''; });
async function loadFile(f){
  if (!f) return;
  const t=await f.text();
  if (/\.(csv|tsv|dat)$/i.test(f.name) || (/\.txt$/i.test(f.name) && !/\\begin/.test(t))){ Paste.modalImport(t, f.name); return; }
  const n=Docs.open(f.name, t);
  toast(n ? `Aperto ${f.name} · ${n} ${n===1?'tabella':'tabelle'}` : `Aperto ${f.name}: nessuna tabella trovata`);
}
let dragDepth=0;
window.addEventListener('dragenter', e=>{ if ([...(e.dataTransfer?.types||[])].includes('Files')){ dragDepth++; $('drop').hidden=false; } });
window.addEventListener('dragleave', ()=>{ if(--dragDepth<=0){ dragDepth=0; $('drop').hidden=true; } });
window.addEventListener('dragover', e=>e.preventDefault());
window.addEventListener('drop', e=>{ e.preventDefault(); dragDepth=0; $('drop').hidden=true; if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]); });

/* ---------- scorciatoie ---------- */
function openHelp(){
  modal('Scorciatoie', `<table class="keys">
    <tr><td>Ctrl+Z · Ctrl+Y</td><td>Annulla · Ripeti (griglia e codice hanno una cronologia sola; con un file aperto, una per tabella)</td></tr>
    <tr><td>Ctrl+Maiusc+C</td><td>Copia il codice LaTeX</td></tr>
    <tr><td>Ctrl+S</td><td>Scarica il documento .tex; con un file aperto, il file intero con le tabelle aggiornate</td></tr>
    <tr><td>Alt+PagSu · Alt+PagGiù</td><td>Tabella precedente · successiva del file aperto</td></tr>
    <tr><td>Ctrl+H</td><td>Cerca e sostituisci nelle celle (Invio: trova la prossima; Ctrl+Invio in «Sostituisci»: tutte)</td></tr>
    <tr><td>F1 · Esc</td><td>Questo elenco · chiude finestre e selezioni</td></tr>
    <tr><td colspan="2"><small>Nella griglia</small></td></tr>
    <tr><td>Frecce · Maiusc+frecce</td><td>Sposta la cella corrente · allarga la selezione (anche trascinando)</td></tr>
    <tr><td>Invio · F2 · doppio clic</td><td>Modifica la cella; scrivere un carattere la sostituisce</td></tr>
    <tr><td>Invio · Tab · Esc</td><td>(durante la modifica) conferma e scende · conferma e va a destra · annulla</td></tr>
    <tr><td>Tab nell'ultima cella</td><td>Aggiunge una riga</td></tr>
    <tr><td>Canc · Backspace</td><td>Svuota le celle selezionate</td></tr>
    <tr><td>Ctrl+C · Ctrl+X · Ctrl+V</td><td>Copia, taglia, incolla celle; incolla anche da Excel, LibreOffice, Google Fogli e righe LaTeX</td></tr>
    <tr><td>Ctrl+Invio · Ctrl+Maiusc+Su</td><td>Riga sotto · riga sopra</td></tr>
    <tr><td>Ctrl+− · Alt+Su · Alt+Giù</td><td>Elimina le righe · sposta la riga</td></tr>
    <tr><td>Alt+Sinistra · Alt+Destra</td><td>Sposta la colonna</td></tr>
    <tr><td>Ctrl+B · Ctrl+I</td><td>Grassetto · corsivo</td></tr>
    <tr><td>Ctrl+M</td><td>Unisci le celle (\\multicolumn; su più righe anche \\multirow)</td></tr>
    <tr><td>Ctrl+E · doppio clic su una formula</td><td>Modifica la formula della cella</td></tr>
    <tr><td colspan="2"><small>Nel codice</small></td></tr>
    <tr><td>\\ + lettere</td><td>Suggerimenti dei comandi (Tab o Invio per completare)</td></tr>
    <tr><td>Clic nel codice</td><td>Seleziona la cella corrispondente nella griglia</td></tr>
    <tr><td>Clic su un messaggio</td><td>Porta all'errore nel sorgente</td></tr></table>`);
}
$('b-help').onclick=openHelp;
document.addEventListener('keydown', e=>{
  const k=e.key.toLowerCase(), ctrl=e.ctrlKey||e.metaKey;
  if (e.key==='F1'){ e.preventDefault(); openHelp(); return; }
  if (ctrl && e.shiftKey && k==='c'){ e.preventDefault(); copyLatex(); return; }
  if (ctrl && !e.shiftKey && !e.altKey && k==='h' && !e.target.closest('#ed')){ e.preventDefault(); e.stopPropagation(); Tools.openFind(); return; }
  if (ctrl && !e.shiftKey && k==='s'){ e.preventDefault(); if (Docs.active()) Docs.save(); else { download('tabella.tex', texDocument(), 'application/x-tex'); toast('Documento tabella.tex scaricato'); } return; }
  if (e.altKey && !ctrl && (e.key==='PageUp'||e.key==='PageDown') && Docs.active()){ e.preventDefault(); Docs.step(e.key==='PageUp'?-1:1); return; }
  if (ctrl && !e.altKey && (k==='z'||k==='y') && !e.target.closest('#ed,#gridbox,#celled,#fpop,input,textarea')){ e.preventDefault(); (k==='y'||e.shiftKey)?redo():undo(); return; }
}, true);

/* ---------- avvio ---------- */
(()=>{
  const saved=store.get('tt-src');
  if (!Docs.restore()) setSource(saved!==null && saved.trim() ? saved : EXAMPLES[0][1], {record:false});
  updateUndoBtns();
  St.sel={r:0,c:0,r2:0,c2:0}; View.render(); syncRibbon();
})();
