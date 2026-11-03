/* ============ TAVOLO STUDIO: schede, tema comune e ponte tra gli editor ============
   Ogni editor resta un'applicazione a sé in apps/<nome>/ e gira nel suo iframe, della stessa origine dello Studio:
   così i nomi globali dei tre non si scontrano e ciascuno conserva il proprio salvataggio (tz-, tl-, tt- in localStorage).
   Lo Studio aggiunge la barra delle schede, un solo tema per tutti e l'inoltro dei messaggi del ponte delle formule
   (TableTeX → MathTeX → TableTeX), che fuori dallo Studio passa da una finestra all'altra. */
(()=>{
  const $ = id => document.getElementById(id);
  const store = { get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };
  const APPS = {
    tikz:     {name:'TikZ',     src:'apps/tikz/index.html',     theme:'tz-theme'},
    mathtex:  {name:'MathTeX',  src:'apps/mathtex/index.html',  theme:'tl-theme'},
    tabletex: {name:'TableTeX', src:'apps/tabletex/index.html', theme:'tt-theme'},
  };
  const frames = {};   /* gli iframe nascosti restano disposti (visibility): gli editor misurano lo spazio all'avvio */
  let cur = null;

  /* ---------- tema: uno per tutti; lo scrive anche nelle chiavi dei singoli editor ---------- */
  const theme = () => store.get('ts-theme');
  function applyTheme(doc){
    const t=theme(); const r=doc.documentElement;
    if (t) r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
  }
  $('s-theme').onclick=()=>{
    const t=theme();
    const dark = t ? t==='dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    store.set('ts-theme', next);
    for (const a of Object.values(APPS)) store.set(a.theme, next);
    applyTheme(document);
    for (const f of Object.values(frames)) { try { applyTheme(f.contentDocument); } catch(e){} }
  };
  applyTheme(document);

  /* ---------- editor nei loro iframe ---------- */
  function makeFrame(app, hash=''){
    const old=frames[app]; if (old) old.remove();
    const f=document.createElement('iframe');
    f.title='Tavolo '+APPS[app].name; f.dataset.app=app;
    f.allow='clipboard-read; clipboard-write';
    f.addEventListener('load', ()=>{
      try {
        const d=f.contentDocument;
        /* il nome e il tema sono già nella barra dello Studio */
        const st=d.createElement('style'); st.id='studio-css';
        st.textContent='.brand,#b-theme{display:none!important}';
        d.head.appendChild(st);
        applyTheme(d);
      } catch(e){}
    });
    f.src=APPS[app].src+hash;
    f.classList.toggle('off', app!==cur);
    $('frames').appendChild(f);
    frames[app]=f;
    return f;
  }
  function show(app, {push=true}={}){
    if (!APPS[app]) app=null;
    cur=app;
    $('home').hidden = !!app;
    if (app && !frames[app]) makeFrame(app);
    for (const [k,f] of Object.entries(frames)) f.classList.toggle('off', k!==app);
    document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-selected', String(t.dataset.app===app)));
    document.title = app ? 'Tavolo '+APPS[app].name+' · Tavolo Studio' : 'Tavolo Studio';
    if (app) store.set('ts-app', app);
    if (push) history.replaceState(null, '', location.pathname+location.search+(app ? '#'+app : ''));
    if (app) setTimeout(()=>{ try { frames[app].contentWindow.focus(); } catch(e){} }, 0);
  }
  document.querySelectorAll('[data-app]').forEach(b=>{ if (b.tagName==='BUTTON') b.onclick=()=>show(b.dataset.app); });
  $('s-home').onclick=()=>show(null);
  /* frecce sinistra/destra tra le schede */
  document.querySelector('.tabs').addEventListener('keydown', e=>{
    if (e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
    const tabs=[...document.querySelectorAll('.tab')]; const k=tabs.indexOf(document.activeElement); if (k<0) return;
    const n=tabs[(k+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length]; n.focus(); show(n.dataset.app); e.preventDefault();
  });
  window.addEventListener('hashchange', ()=>show(location.hash.slice(1), {push:false}));

  /* ---------- ponte delle formule ----------
     TableTeX chiede di aprire una formula (studio:open): MathTeX si ricarica con la formula nel frammento.
     Le modifiche che MathTeX rimanda (tavolo:formula) vanno a TableTeX; «Fatto» (studio:done) torna alla tabella
     e riapre MathTeX com'era, con il lavoro salvato prima. Si accettano solo messaggi dei propri iframe. */
  const fromFrame = src => Object.keys(frames).find(k=>frames[k].contentWindow===src);
  window.addEventListener('message', e=>{
    if (e.origin!==location.origin) return;
    const d=e.data, from=fromFrame(e.source); if (!d || !from) return;
    if (d.type==='studio:open' && from==='tabletex' && d.app==='mathtex' && /^#tabletex=/.test(d.hash||'')){
      makeFrame('mathtex', d.hash);
      document.querySelector('.tab[data-app="mathtex"]').classList.add('ponte');
      show('mathtex');
    }
    else if (d.type==='tavolo:formula' && from==='mathtex' && frames.tabletex){
      frames.tabletex.contentWindow.postMessage(d, location.origin);
    }
    else if (d.type==='studio:done' && from==='mathtex'){
      document.querySelector('.tab[data-app="mathtex"]').classList.remove('ponte');
      show(d.app==='tikz' ? 'tikz' : 'tabletex');
      makeFrame('mathtex');
    }
  });

  window.TavoloStudio = {show, frames, apps:APPS};
  const start = location.hash.slice(1);
  show(APPS[start] ? start : store.get('ts-app'), {push:!!APPS[start]});
})();
