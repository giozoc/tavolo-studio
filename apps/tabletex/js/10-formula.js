/* ============ FORMULE NELLE CELLE: MathLive qui, oppure Tavolo MathTeX in un'altra finestra ============
   Una cella con $…$ (o \(…\)) si apre in una piccola finestra con la formula modificabile (MathLive, lo stesso
   motore di Tavolo MathTeX) e il suo codice. «Apri in Tavolo MathTeX» porta la formula nell'editor completo:
   ogni modifica fatta lì torna in questa cella, finché la formula resta aperta (vedi apps/mathtex/js/11-ponte.js). */
const Formula = (()=>{
  const fp=$('fpop'), src=$('fp-src');
  const MATHTEX = () => store.get('tt-mathtex-url') || '../mathtex/index.html';
  let cur=null, mf=null, pending=new Map(), seq=0;

  /* tratti di formula in linea dentro il testo di una cella: [inizio, fine, apertura, chiusura] */
  function segments(t){
    const out=[];
    for (let i=0;i<t.length;i++){
      const ch=t[i];
      if (ch==='\\'){
        if (t[i+1]==='('){ const k=t.indexOf('\\)', i+2); if (k<0) break; out.push({s:i, e:k+2, a:i+2, b:k, o:'\\(', c:'\\)'}); i=k+1; continue; }
        i++; continue;
      }
      if (ch==='$'){
        let k=i+1; while (k<t.length && !(t[k]==='$' && t[k-1]!=='\\')) k++;
        if (k>=t.length) break;
        out.push({s:i, e:k+1, a:i+1, b:k, o:'$', c:'$'}); i=k; continue;
      }
    }
    return out;
  }
  function ensureMF(){
    if (mf) return true;
    if (!window.MathfieldElement){ return false; }
    MathfieldElement.fontsDirectory='https://cdn.jsdelivr.net/npm/mathlive@0.111.1/fonts'; MathfieldElement.soundsDirectory=null;
    mf=new MathfieldElement(); mf.className='mf';
    mf.mathVirtualKeyboardPolicy='manual'; mf.smartFence=false; mf.smartMode=false; mf.popoverPolicy='off'; mf.letterShapeStyle='tex';
    $('fp-mfbox').appendChild(mf);
    mf.addEventListener('input', ()=>{ src.value=mf.getValue('latex-without-placeholders'); status(); });
    return true;
  }
  function status(){ const st=$('fp-st'); const ok=balanced(src.value); st.textContent = ok ? (cur && src.value!==cur.tex ? 'modificata' : '') : 'graffe non bilanciate'; st.className=ok?'':'err'; }
  const balanced = t => { let d=0; for (let i=0;i<t.length;i++){ if (t[i]==='\\'){ i++; continue; } if (t[i]==='{') d++; else if (t[i]==='}' && --d<0) return false; } return d===0; };
  src.addEventListener('input', ()=>{ if (mf) mf.setValue(src.value, {silenceNotifications:true}); status(); });

  /* apre la formula k della cella (r,c); raw permette di passare il testo che si stava scrivendo */
  function openFor(r, c, raw=null, k=0){
    const x=View.srcCell(r, c); if (!x || !curT()){ toast('Seleziona una cella'); return; }
    if (x.anchor?.special){ toast('Le formule vanno nelle celle, non nella didascalia'); return; }
    const old = x.cell ? St.src.slice(x.cell.cs, x.cell.ce) : '';
    const text = raw!==null ? raw : old;
    const segs=segments(text); const seg=segs[clamp(k,0,segs.length-1)] || null;
    cur={r:x.vr??r, c:x.c, sr:x.sr, old, text, seg, tex: seg ? text.slice(seg.a, seg.b) : '', ti:St.ti};
    src.value=cur.tex;
    $('fp-where').textContent = `cella ${View.colName(cur.c)}${cur.r+1}` + (segs.length>1 ? ` · formula ${segs.indexOf(seg)+1} di ${segs.length}` : seg ? '' : ' · nuova formula');
    fp.hidden=false;
    const td=document.querySelector(`#grid td[data-r="${cur.r}"][data-c="${cur.c}"]`);
    const b=(td||$('gridbox')).getBoundingClientRect();
    const w=fp.offsetWidth, h=fp.offsetHeight;
    fp.style.left=clamp(b.left, 8, innerWidth-w-8)+'px';
    fp.style.top=(b.bottom+8+h<innerHeight ? b.bottom+8 : Math.max(8, b.top-h-8))+'px';
    if (ensureMF()){ mf.setValue(cur.tex, {silenceNotifications:true}); setTimeout(()=>mf.focus(), 30); }
    else { $('fp-mfbox').innerHTML='<span class="ph" style="color:#7b8499;font-size:12px">MathLive non è disponibile: modifica il codice qui sotto</span>'; src.focus(); }
    status();
  }
  /* testo della cella con la formula sostituita */
  function cellWith(text, seg, tex){
    if (!seg) return (text.trim() ? text.replace(/\s+$/,'')+' ' : '')+'$'+tex+'$';
    return text.slice(0, seg.a)+tex+text.slice(seg.b);
  }
  function apply(){
    if (!cur) return close();
    const tex=src.value.trim();
    if (!balanced(tex)){ toast('Graffe non bilanciate nella formula'); return; }
    if (tex===cur.tex && cur.text===cur.old){ close(); return; }
    let t = tex || cur.seg ? cellWith(cur.text, cur.seg, tex) : cur.text;
    if (!tex && cur.seg) t=(cur.text.slice(0,cur.seg.s)+cur.text.slice(cur.seg.e)).replace(/\s+/g,' ').trim();
    const p=View.prepCell(t, cur.c, cur.old); if (p===null) return;
    const c=cur; close();
    St.ti=c.ti; doOp({op:'set', r:c.sr, c:c.c, t:p}, {msg:'Formula aggiornata'});
  }
  function close(){ fp.hidden=true; cur=null; if (St.lastPane==='grid') $('gridbox').focus({preventScroll:true}); }
  $('fp-ok').onclick=apply; $('fp-x').onclick=close;
  fp.addEventListener('keydown', e=>{
    if (e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); close(); }
    if (e.key==='Enter' && (e.ctrlKey||e.metaKey || e.target!==src)){ e.preventDefault(); apply(); }
  });
  document.addEventListener('pointerdown', e=>{ if (!fp.hidden && !fp.contains(e.target) && !e.target.closest('#b-formula')) close(); });

  /* ---------- ponte con Tavolo MathTeX ----------
     La formula parte nel frammento dell'indirizzo (#tabletex=…, in base64); Tavolo MathTeX, con js/11-ponte.js,
     rimanda ogni modifica con postMessage. Si accettano solo messaggi dall'origine configurata.
     Dentro Tavolo Studio la formula non apre una finestra: lo Studio la apre nella scheda di MathTeX e inoltra i messaggi. */
  const studio = () => window.parent!==window && window.parent.location.origin===location.origin && !!window.parent.TavoloStudio;
  function toMathTeX(){
    if (!cur) return;
    const id='f'+(++seq)+'-'+Date.now().toString(36);
    const c={...cur, tex:src.value};
    pending.set(id, c);
    const payload={id, tex:c.tex, origin:location.origin, where:`${View.colName(c.c)}${c.r+1}`};
    const b64=btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const url=MATHTEX().replace(/#.*$/,'')+'#tabletex='+b64;
    let inStudio=false; try { inStudio=studio(); } catch(_){}
    if (inStudio){
      close();
      window.parent.postMessage({type:'studio:open', app:'mathtex', hash:'#tabletex='+b64}, location.origin);
      return;
    }
    const w=window.open(url, 'tavolo-mathtex');
    close();
    if (!w) toast('Il browser ha bloccato la nuova finestra: consenti i popup per questo sito');
    else hint('La formula è aperta in Tavolo MathTeX: le modifiche tornano qui', 3200);
  }
  $('fp-mt').onclick=toMathTeX;
  window.addEventListener('message', e=>{
    const d=e.data; if (!d || d.type!=='tavolo:formula' || !pending.has(d.id)) return;
    let ok=false; try { ok = new URL(MATHTEX(), location.href).origin===e.origin; } catch(_){}
    if (!ok) return;
    const c=pending.get(d.id); const tex=String(d.tex||'').trim();
    if (!balanced(tex)) return;
    /* la cella si rilegge ora: il sorgente può essere cambiato nel frattempo */
    if (c.ti!==St.ti && St.tables[c.ti]) St.ti=c.ti;
    const x=View.srcCell(c.r, c.c); if (!x || !x.cell) return;
    const now=St.src.slice(x.cell.cs, x.cell.ce);
    const segs=segments(now); const k=c.seg ? segments(c.text).findIndex(s=>s.s===c.seg.s) : -1;
    const seg = k>=0 ? segs[k] : null;
    if (seg && now.slice(seg.a, seg.b)===tex) return;
    const t=View.prepCell(cellWith(now, seg, tex), c.c, now); if (t===null) return;
    if (!seg){ c.seg=segments(t).pop(); c.text=t; }
    doOp({op:'set', r:x.sr, c:c.c, t}, {msg:'Formula aggiornata da Tavolo MathTeX'});
  });
  return {openFor, segments, close, isOpen:()=>!fp.hidden};
})();
