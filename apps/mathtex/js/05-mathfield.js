/* ============ FORMULA MODIFICABILE: MathLive ============
   MathLive fornisce la rappresentazione matematica modificabile (struttura, cursore, caselle, selezione).
   Il passaggio tra i due pannelli è sempre esplicito e a senso unico per evento, così non nascono cicli:
   - sorgente → formula: setValue(..., silenceNotifications) non genera eventi 'input';
   - formula → sorgente: l'evento 'input' riscrive il sorgente con toMF:false (la formula non viene ricaricata). */
const MF = (()=>{
  const FMT = 'latex-without-placeholders';    /* niente \placeholder{}: solo LaTeX standard */
  /* valore della formula come LaTeX standard: le caselle vuote che reggono la struttura restano {} o [] (vedi slotsToSource) */
  /* 'latex-expanded' è la stessa serializzazione con le caselle; se per qualche costrutto differisse, vale FMT.
     Le macro (\pmod) restano come sono scritte anche in FMT, caselle comprese: per questo si confrontano senza caselle */
  const noPH = t => t.replace(/\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g, '$1');
  const valueOf = f => {
    const v = noPH(f.getValue(FMT)), e = f.getValue('latex-expanded');
    return noPH(e)===v ? slotsToSource(e) : v;
  };
  const mf = $('mf');
  if (window.MathfieldElement){ MathfieldElement.soundsDirectory = null; }
  function configure(f){
    f.mathVirtualKeyboardPolicy = 'manual';
    f.smartFence = false;             /* ( resta ( e non diventa \left( … \right) */
    f.smartMode = false;
    f.smartSuperscript = false;
    f.letterShapeStyle = 'tex';
    f.popoverPolicy = 'off';
    f.removeExtraneousParentheses = false;
    /* scorciatoie testuali: si tolgono quelle che produrrebbero comandi esistenti solo in MathLive
       (\differentialD, \exponentialE, \imaginaryI, \doubleprime) e quelle che disturbano gli indici (ii) */
    try {
      const sc = {...f.inlineShortcuts};
      delete sc.ii; delete sc.ee;
      sc['∂'] = '\\partial'; sc['∆'] = '\\Delta';     /* ^{\doubleprime} di '' viene riscritto come '' da Sync.tidy */
      for (const k of ['dx','dy','dt']) if (sc[k]) sc[k] = typeof sc[k]==='string' ? '\\mathrm{d}'+k[1] : {...sc[k], value:'\\mathrm{d}'+k[1]};
      f.inlineShortcuts = sc;
    } catch(e){}
    f.styleBias = 'none';            /* dopo \mathrm{d} la x resta corsiva: niente stile ereditato */
  }
  configure(mf);
  /* campo nascosto usato solo per analizzare testi: serve alla verifica della riscrittura minima */
  const box = document.createElement('div'); box.style.cssText='position:fixed;left:-10000px;top:0;width:800px;visibility:hidden';
  const nf = new MathfieldElement(); configure(nf); box.appendChild(nf); document.body.appendChild(box);
  const normCache = new Map();
  function normalize(feed){
    if (normCache.has(feed)) return normCache.get(feed);
    nf.setValue(slotsToMF(feed), {silenceNotifications:true, mode:'math'});
    const v = valueOf(nf);
    if (normCache.size>400) normCache.clear();
    normCache.set(feed, v);
    return v;
  }
  /* macro personali: valgono per la formula e per il campo di verifica; expand:false le tiene come sono scritte
     anche nella serializzazione con le caselle, così \R resta \R nel sorgente */
  const baseMacros = {...mf.macros};
  function setMacros(list){
    const all = {...baseMacros};
    for (const m of list) if (m.opt===null) all[m.name] = {def:m.def, args:m.args, expand:false};
    mf.macros = all; nf.macros = all; normCache.clear();
  }
  function analyze(feed){ nf.setValue(slotsToMF(feed), {silenceNotifications:true, mode:'math'}); return {value: valueOf(nf), errors: [...(nf.errors||[])]}; }

  function fromSource(){
    const feed = slotsToMF(feedOf(St.src));
    /* MathLive ignora setValue se il testo coincide con quello attuale: lo si svuota prima,
       così la formula viene sempre rianalizzata dal sorgente */
    if (mf.getValue('latex')===feed) mf.setValue('', {silenceNotifications:true});
    mf.setValue(feed, {silenceNotifications:true, mode:'math'});
    St.prevMF = valueOf(mf);
    setSync('ok');
  }
  function onInput(){
    const next = valueOf(mf);
    if (next === St.prevMF) return;
    const t0 = performance.now();
    /* MathLive a volte produce stati che il suo stesso LaTeX non riproduce (es. due esponenti sullo stesso
       simbolo dopo una cancellazione, x^{a}^{b}): in quel caso nel sorgente si scrive la forma che MathLive
       rilegge (LaTeX valido) e la formula viene riallineata, con il cursore nello stesso punto. */
    let want = next;
    /* align*, gather*: la formula è un unico ambiente aligned/gathered; ciò che si scrive prima o dopo
       l'ambiente appartiene, in LaTeX, alla prima o all'ultima cella */
    const doc = parseDoc(St.src);
    if (doc.inner) want = foldIntoEnv(next, doc.inner);
    const canon = normalize(want);
    const target = canon===want ? want : canon;
    let r;
    try { r = Sync.apply(St.src, St.prevMF, target, normalize); }
    catch(e){ console.error(e); r = {src:null, mode:'error'}; }
    St.prevMF = target;
    if (r.src==null){ setSync('err'); return; }
    setSource(r.src, {from:'mf', toMF:false, flash:r.range, coalesce:true});
    /* rete di sicurezza: la formula mostrata deve sempre essere quella che il sorgente significa */
    if (target!==next || normalize(feedOf(r.src))!==next){
      const pos = mf.position; fromSource();
      try { mf.position = Math.min(pos, mf.lastOffset); } catch(e){}
      setSync('norm'); return;
    }
    setSync(r.mode, performance.now()-t0);
  }
  function foldIntoEnv(v, env){
    const o=`\\begin{${env}}`, c=`\\end{${env}}`;
    const a=v.indexOf(o), b=v.lastIndexOf(c);
    if (a<0 || b<a) return o+v+c;
    const pre=v.slice(0,a), post=v.slice(b+c.length);
    if (!pre && !post) return v;
    return o + pre + v.slice(a+o.length, b) + post + c;
  }
  function setSync(mode, ms){
    const el=$('st-sync');
    el.className = mode==='full'||mode==='norm' ? 'wrn' : mode==='err' ? 'err' : '';
    el.textContent = mode==='full' ? 'corpo riscritto' : mode==='norm' ? 'formula normalizzata' : mode==='group' ? 'gruppo riscritto' : mode==='err' ? 'errore di sincronizzazione' : 'sincronizzato';
    if (mode==='full') hint('La modifica ha richiesto di riscrivere la formula: commenti e a capo interni sono stati normalizzati', 3200);
  }
  mf.addEventListener('input', onInput);
  mf.addEventListener('focusin', ()=>{ St.lastPane='mf'; });
  /* MathLive dà il focus alla formula con un setTimeout dopo il clic: i tasti premuti nel frattempo andrebbero
     al pannello attivo prima (il codice) o persi. Il ricevitore dei tasti di MathLive prende il focus subito */
  mf.addEventListener('pointerdown', ()=>{
    if (mf.hasFocus()) return;
    try { mf.shadowRoot.querySelector('.ML__keyboard-sink').focus({preventScroll:true}); } catch(e){}
  }, true);
  mf.addEventListener('selection-change', ()=>{
    try {
      const s = mf.selection, r = s.ranges[0];
      $('mfinfo').textContent = r[0]===r[1] ? 'Tab: casella successiva · Maiusc+frecce: seleziona' : 'selezione: '+ (mf.getValue(r[0], r[1], FMT)||'');
    } catch(e){}
  });
  /* annulla e ripeti passano sempre dalla cronologia del sorgente, unica per i due pannelli */
  mf.addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    if ((e.ctrlKey||e.metaKey) && !e.altKey && (k==='z'||k==='y')){ e.preventDefault(); e.stopImmediatePropagation(); (k==='y'||e.shiftKey)?redo():undo(); }
  }, true);

  /* selezione com'era prima della modifica: è quella da ripristinare con «annulla» */
  let preSel=null;
  mf.addEventListener('beforeinput', ()=>{ try { preSel = mf.selection; } catch(e){} });
  function getSelection(){ const s = preSel || mf.selection; preSel=null; return s; }
  function setSelection(sel){ try { mf.selection = sel; } catch(e){} }
  /* inserisce un modello (#0 = selezione, #? = casella) dove si trova il cursore */
  function insert(tpl){
    if (St.lastPane==='src'){ insertInSource(tpl); return; }
    mf.focus();
    clearTimeout(histTimer); histTimer=null;          /* un inserimento da menu è un passo di annulla a sé */
    mf.insert(tpl, {format:'latex', mode:'math', selectionMode:'placeholder', insertionMode:'replaceSelection', feedback:false});
    onInput();                                         /* nel caso l'evento non sia stato emesso */
    clearTimeout(histTimer); histTimer=null;
  }
  /* stili di carattere: si applicano alla selezione o al testo che si scrive dopo; «Testo» passa al modo testo */
  function applyFont(it){
    if (St.lastPane==='src'){ insertInSource(it.t); return; }
    mf.focus(); clearTimeout(histTimer); histTimer=null;
    const empty = (()=>{ try { const r=mf.selection.ranges[0]; return r[0]===r[1]; } catch(e){ return true; } })();
    if (it.s.text) mf.executeCommand(['switchMode','text']);
    else mf.applyStyle(it.s);
    onInput(); clearTimeout(histTimer); histTimer=null;
    if (empty) hint(it.s.text ? 'Modo testo: scrivi normalmente (frecce o Esc per uscire)' : `Stile «${it.l}»: vale per ciò che scrivi adesso`);
  }
  function focus(){ if (St.lastPane==='src') ed.focus(); else mf.focus(); }
  function setDisplay(display){
    mf.defaultMode = display ? 'math' : 'inline-math';
    $('right').classList.toggle('inline', !display);
    fromSource();
  }
  /* dimensione della formula */
  let z = +store.get('tl-zoom') || 30;
  function zoom(v){ z = clamp(Math.round(v), 16, 80); document.documentElement.style.setProperty('--mfz', z+'px'); $('zlab').textContent=Math.round(z/30*100)+'%'; store.set('tl-zoom', z); }
  zoom(z);
  $('b-zin').onclick=()=>zoom(z*1.15); $('b-zout').onclick=()=>zoom(z/1.15); $('b-zfit').onclick=()=>zoom(30);
  return {el:mf, FMT, fromSource, onInput, normalize, analyze, setMacros, insert, applyFont, focus, getSelection, setSelection, setDisplay, value:()=>valueOf(mf)};
})();
