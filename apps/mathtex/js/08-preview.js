/* ============ VERIFICA E ANTEPRIMA: controlli, MathLive, MathJax ============
   Il risultato renderizzato da MathJax serve da controllo indipendente: un comando che MathLive accetta
   ma LaTeX non conosce (o viceversa) viene segnalato, senza mai bloccare l'editor. */
const ML_ERR = {
  'unknown-command': a=>`comando sconosciuto ${a}`,
  'unknown-environment': a=>`ambiente sconosciuto ${a}`,
  'unbalanced-braces': ()=>'graffe non bilanciate',
  'unbalanced-environment': a=>`ambiente non bilanciato ${a||''}`,
  'unbalanced-mode-shift': ()=>'cambio di modo ($) non chiuso',
  'missing-argument': a=>`argomento mancante ${a||''}`,
  'too-many-infix-commands': ()=>'troppi comandi infissi (\\over, \\choose) nello stesso gruppo',
  'unexpected-command-in-string': ()=>'comando inatteso in una stringa',
  'missing-unit': ()=>'unità di misura mancante',
  'unexpected-delimiter': a=>`delimitatore inatteso ${a||''}`,
  'unexpected-token': a=>`simbolo inatteso ${a||''}`,
  'unexpected-end-of-string': ()=>'la formula finisce in modo inatteso',
  'improper-alphabetic-constant': ()=>'costante alfabetica non valida (es. `a)',
  'expected-argument': a=>`atteso un argomento ${a||''}`,
};
const MJ_ERR = [
  [/^Undefined control sequence (.+)$/, m=>`comando non definito in LaTeX: ${m[1]}`],
  [/^Missing close brace$/, ()=>'manca una graffa di chiusura «}»'],
  [/^Extra close brace or missing open brace$/, ()=>'graffa «}» in più o «{» mancante'],
  [/^Double exponent: use braces to clarify$/, ()=>'doppio esponente: usa le graffe'],
  [/^Double subscripts: use braces to clarify$/, ()=>'doppio pedice: usa le graffe'],
  [/^Missing argument for (.+)$/, m=>`manca l'argomento di ${m[1]}`],
  [/^Misplaced (.+)$/, m=>`${m[1]} fuori posto (serve un ambiente come aligned o matrix)`],
  [/^Unknown environment '(.+)'$/, m=>`ambiente sconosciuto «${m[1]}»`],
  [/^Extra \\right$/, ()=>'\\right in più'],
  [/^Missing \\right or extra \\left$/, ()=>'manca \\right o c\'è un \\left in più'],
  [/^\\begin\{(.+)\} ended with \\end\{(.+)\}$/, m=>`\\begin{${m[1]}} chiuso con \\end{${m[2]}}`],
  [/^Missing \\(.+) inserted$/, m=>`manca \\${m[1]}`],
];
const Preview = (()=>{
  let seq=0, pvOn = store.get('tl-pv')!=='0', lastOK='';
  function showPv(){ $('pvbox').hidden=!pvOn; $('b-pv').classList.toggle('on', pvOn); }
  $('b-pv').onclick=()=>{ pvOn=!pvOn; store.set('tl-pv', pvOn?'1':'0'); showPv(); if (pvOn) check(); };
  showPv();

  async function check(){
    const my=++seq, src=St.src, doc=parseDoc(src);
    const issues = lint(src, doc);
    /* MathLive: errori di analisi, riportati al punto del sorgente quando si può */
    const feed = feedOf(src, doc);
    const {errors} = MF.analyze(feed);
    const bodyToks = solid(tokenize(src, doc.bs, doc.be));
    const mlMsgs=[];
    for (const er of errors){
      const f = ML_ERR[er.code]; const msg = (f ? f(er.arg) : er.code+(er.arg?' '+er.arg:'')).trim();
      if (er.code==='unbalanced-braces' && issues.some(x=>/graffa/.test(x.msg))) continue;
      if (er.arg && /^\\/.test(er.arg)){
        const hits = bodyToks.filter(t=>t.t===er.arg);
        if (hits.length){ for (const t of hits) issues.push({s:t.s, e:t.e, kind:'w', msg:msg+' — non modificabile nella formula', src:'ml', arg:er.arg}); continue; }
      }
      mlMsgs.push({s:doc.bs, e:doc.bs, kind:'w', msg:'editor visuale: '+msg});
    }
    issues.push(...mlMsgs);
    /* più formule nel sorgente: LaTeX le vuole separate, e la formula a destra ne mostra una sola */
    const nfs = findFormulas(src).length;
    if (nfs>1) issues.unshift({s:doc.bs, e:doc.bs, kind:'e', split:true, msg:`il sorgente contiene ${nfs} formule distinte: clic qui per aprirle come elenco, una per voce`});
    St.issues = issues; updateHL(); listMsgs(null);
    /* MathJax: verifica indipendente e anteprima */
    let mjErr=null;
    {
      await MJ.whenReady(); if (my!==seq) return;
      const mjIn = doc.inner ? src.slice(doc.os, doc.ce) : src.slice(doc.bs, doc.be);
      try {
        const node = await MathJax.tex2svgPromise(Macros.mj(mjIn.trim() || '\\phantom{x}'), {display: $('stylesel').value!=='inline'});
        if (my!==seq) return;
        const er = node.querySelector('[data-mjx-error]');
        if (er){ mjErr = er.getAttribute('data-mjx-error'); }
        else { const sv=node.querySelector('svg'); sv.setAttribute('role','img'); sv.removeAttribute('aria-hidden'); sv.setAttribute('aria-label', mjIn.trim()); $('pv').innerHTML=''; $('pv').appendChild(sv); lastOK = mjIn; }
      } catch(e){ mjErr = String(e.message||e); }
      if (my!==seq) return;
      if (mjErr){
        let msg=mjErr; for (const [re,f] of MJ_ERR){ const m=re.exec(mjErr); if (m){ msg=f(m); break; } }
        /* se l'errore riguarda un comando, lo si sottolinea dove compare */
        const um = /Undefined control sequence (\\[a-zA-Z@]+)/.exec(mjErr);
        let placed=false;
        if (um){ for (const t of bodyToks.filter(t=>t.t===um[1])){ const ex=St.issues.find(x=>x.s===t.s); if (ex){ ex.kind='e'; ex.msg=msg; } else St.issues.push({s:t.s,e:t.e,kind:'e',msg}); placed=true; } }
        if (!placed && !St.issues.some(x=>x.kind==='e')) St.issues.push({s:doc.bs, e:doc.bs, kind:'e', msg:'LaTeX: '+msg});
        else if (!placed) St.issues.push({s:doc.bs, e:doc.bs, kind:'i', msg:'MathJax: '+msg});
        $('pv').innerHTML = `<div class="pverr">${esc('Errore LaTeX: '+msg)}</div>`;
      }
      updateHL();
    }
    listMsgs(mjErr);
  }
  function listMsgs(mjErr){
    const w = St.issues.slice().sort((a,b)=>({e:0,w:1,i:2}[a.kind]-{e:0,w:1,i:2}[b.kind]) || a.s-b.s);
    $('msgs').innerHTML = w.slice(0,40).map(x=>`<div class="${x.kind}" data-p="${x.s}"${x.split?' data-split="1"':''}>riga ${lineOf(St.src,x.s)} · ${esc(x.msg)}</div>`).join('');
    const ne = w.filter(x=>x.kind==='e').length, nw = w.filter(x=>x.kind==='w').length;
    const m=$('st-msg');
    m.className = ne ? 'err' : nw ? 'wrn' : 'ok';
    m.textContent = ne ? `${ne} ${ne===1?'errore':'errori'}` : nw ? `${nw} ${nw===1?'avviso':'avvisi'}` : 'LaTeX valido';
    const pst=$('pvst'); pst.className = ne||mjErr ? 'err' : 'ok'; pst.textContent = mjErr ? 'non compila' : ne ? 'errori nel sorgente' : 'compila';
  }
  $('msgs').addEventListener('click', e=>{ const d=e.target.closest('[data-p]'); if(!d) return; if (d.dataset.split){ Formulas.split(); return; } const p=+d.dataset.p; ed.focus(); const it=St.issues.find(x=>x.s===p); ed.setSelectionRange(p, it?it.e:p); scrollEdTo(p); });
  return {check, lastOK:()=>lastOK};
})();
function scheduleCheck(){ clearTimeout(checkTimer); checkTimer=setTimeout(Preview.check, 180); }
