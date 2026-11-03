/* ============ PONTE CON TAVOLO TABLETEX E TAVOLO TIKZ ============
   Quando Tavolo TableTeX apre una formula di una cella, o Tavolo TikZ quella di un nodo («Apri in Tavolo MathTeX»),
   l'indirizzo porta la formula nel frammento: #tabletex=<base64 di {id, tex, origin, where}> (#tikz=… da TikZ).
   La formula entra nell'editor come un sorgente qualsiasi e ogni modifica torna alla tabella o alla figura con
   postMessage, solo verso l'origine che l'ha aperta. L'altra app è la finestra che ha aperto questa (window.opener)
   oppure, dentro Tavolo Studio, la pagina che contiene questa scheda (window.parent), che inoltra i messaggi.
   Senza quel frammento il file non fa nulla. Il lavoro già salvato in Tavolo MathTeX (formula e documento) non viene toccato. */
(()=>{
  const m=/[#&](tabletex|tikz)=([^&]+)/.exec(location.hash); if (!m) return;
  const from = m[1]==='tikz' ? {app:'Tavolo TikZ', what:'del', of:'in', back:'nella figura'} : {app:'Tavolo TableTeX', what:'della cella', of:'di', back:'nella tabella'};
  const peer = window.opener || (window.parent!==window ? window.parent : null);
  const inStudio = !window.opener;
  let d=null;
  try { d=JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[2]))))); } catch(e){ return; }
  if (!d || typeof d.tex!=='string' || typeof d.origin!=='string' || !peer) return;
  history.replaceState(null, '', location.pathname+location.search);

  /* ciò che Tavolo MathTeX aveva salvato resta com'era: la formula della cella non lo sostituisce */
  const keep={src:localStorage.getItem('tl-src'), doc:localStorage.getItem('tl-doc')};
  const set0=store.set; store.set=(k,v)=>{ if (k!=='tl-src') set0(k,v); };
  if (Formulas.active()) Formulas.close(false);
  hist=[]; fut=[];
  St.lastPane='mf';
  setSource(d.tex, {record:false}); updateUndoBtns();

  /* formula da rimandare: senza delimitatori esterni e senza commenti, che in una cella o in un nodo romperebbero la riga */
  const body = () => {
    const doc=parseDoc(St.src);
    return St.src.slice(doc.bs, doc.be).replace(/(^|[^\\])%[^\n]*/g, '$1').replace(/\s*\n\s*/g, ' ').trim();
  };
  let last=d.tex.trim();
  const send = () => {
    const tex=body(); if (tex===last) return; last=tex;
    try { peer.postMessage({type:'tavolo:formula', id:d.id, tex}, d.origin); } catch(e){}
  };
  setInterval(send, 350);

  const bar=document.createElement('div');
  bar.id='ponte';
  bar.style.cssText='display:flex;align-items:center;gap:10px;padding:6px 14px;background:color-mix(in srgb,var(--accent) 12%,var(--panel));border-bottom:1px solid var(--line);font-size:13px';
  bar.innerHTML=`<span>Formula ${from.what} <b>${esc(d.where||'')}</b> ${from.of} ${from.app}: ogni modifica torna ${from.back}.</span><span style="flex:1"></span><button class="btn pri" id="pt-done">Fatto</button>`;
  $('top').after(bar);
  /* in una finestra a parte «Fatto» la chiude; nello Studio chiede di tornare all'altra scheda */
  $('pt-done').onclick=()=>{
    send();
    if (inStudio) peer.postMessage({type:'studio:done', id:d.id, app:m[1]}, d.origin);
    else window.close();
  };
  window.addEventListener('pagehide', ()=>{
    send();
    try {
      if (keep.src!==null) localStorage.setItem('tl-src', keep.src);
      if (keep.doc!==null) localStorage.setItem('tl-doc', keep.doc);
    } catch(e){}
  });
  window.__ponteTableTeX = {id:d.id, send, from:m[1]};
})();
