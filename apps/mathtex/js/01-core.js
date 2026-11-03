/* ============ NUCLEO: utilità condivise (riprese da Tavolo TikZ) ============ */
const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const store = { get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };

/* ---------- messaggi brevi ---------- */
let toastT=null;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),1700); }
let hintT=null;
function hint(msg, ms=2200){ const h=$('hint'); h.textContent=msg; h.classList.add('on'); clearTimeout(hintT); if(ms) hintT=setTimeout(()=>h.classList.remove('on'),ms); }
async function copyText(t, okMsg='Copiato negli appunti'){
  try { await navigator.clipboard.writeText(t); toast(okMsg); return true; }
  catch(e){
    /* ripiego per i contesti senza Clipboard API (iframe, http) */
    try { const ta=document.createElement('textarea'); ta.value=t; ta.style.cssText='position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); ta.remove(); if(ok){ toast(okMsg); return true; } } catch(e2){}
    toast('Copia non disponibile: seleziona il testo e usa Ctrl+C'); return false;
  }
}
function download(name, data, type='text/plain'){
  const blob = data instanceof Blob ? data : new Blob([data],{type});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 400);
}

/* ---------- modale ---------- */
function modal(title, html){ $('m-t').textContent=title; $('m-b').innerHTML=html; $('modal').hidden=false; }
function closeModal(){ $('modal').hidden=true; }
$('m-x').onclick=closeModal;
$('modal').addEventListener('click', e=>{ if (e.target.id==='modal') closeModal(); });
document.addEventListener('keydown', e=>{ if (e.key==='Escape' && !$('modal').hidden){ closeModal(); e.stopImmediatePropagation(); } }, true);

/* ---------- tema ---------- */
$('b-theme').onclick=()=>{
  const r=document.documentElement; const cur=r.getAttribute('data-theme');
  const dark = cur ? cur==='dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.setAttribute('data-theme', dark?'light':'dark'); store.set('tl-theme', dark?'light':'dark');
};
{ const t=store.get('tl-theme'); if (t) document.documentElement.setAttribute('data-theme', t); }

/* ---------- divisore tra le due ante ---------- */
(()=>{ const sp=$('split'); let on=false;
  sp.addEventListener('pointerdown', e=>{ on=true; sp.setPointerCapture(e.pointerId); });
  sp.addEventListener('pointermove', e=>{ if(!on) return; const x0=$('left').getBoundingClientRect().left; const w=clamp(e.clientX-x0,240,window.innerWidth-x0-320); $('left').style.width=w+'px'; });
  sp.addEventListener('pointerup', ()=>{ on=false; store.set('tl-split',$('left').style.width); });
  const w=store.get('tl-split'); if (w) $('left').style.width=w;
})();

/* ---------- MathJax: rendering SVG delle anteprime, delle icone e delle gallerie ---------- */
const MJ = (()=>{
  let ready = null;
  const cache = new Map();
  function whenReady(){
    if (!ready) ready = new Promise(res=>{ if (window.__mjReady) res(); else { const prev=window.__onMJ; window.__onMJ=()=>{ prev&&prev(); res(); }; } });
    return ready;
  }
  /* restituisce il markup SVG (stringa) di una formula; display=true per lo stile display */
  async function svg(tex, display=false){
    const key=(display?'D':'T')+tex;
    if (cache.has(key)) return cache.get(key);
    await whenReady();
    let out='';
    try {
      const node = await MathJax.tex2svgPromise(tex, {display});
      const s = node.querySelector('svg');
      if (node.querySelector('[data-mjx-error]')) out = '<span class="tx">'+esc(tex)+'</span>';
      else out = s ? s.outerHTML : '';
    } catch(e){ out = '<span class="tx">'+esc(tex)+'</span>'; }
    cache.set(key, out);
    return out;
  }
  /* riempie gli elementi [data-tex] dentro root, a gruppi per non bloccare l'interfaccia */
  async function fill(root){
    const els=[...root.querySelectorAll('[data-tex]:not([data-done])')];
    for (let k=0;k<els.length;k++){
      const el=els[k]; el.dataset.done='1';
      el.innerHTML = await svg(el.dataset.tex, el.dataset.disp==='1');
      if (k%24===23) await new Promise(r=>setTimeout(r,0));
    }
  }
  return {whenReady, svg, fill};
})();
