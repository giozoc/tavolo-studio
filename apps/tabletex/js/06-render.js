/* ============ RESA DELLE CELLE: testo LaTeX in modo testo → HTML ============
   Non è un compilatore: copre ciò che sta di solito in una cella (formule, grassetto e corsivo, siunitx, colori,
   caratteri speciali, \makecell) e mostra il resto come codice, senza mai alterarlo. Le formule passano da MathJax. */
const Render = (()=>{
  const ACC = {"'":{a:'á',e:'é',i:'í',o:'ó',u:'ú',E:'É',A:'Á'}, '`':{a:'à',e:'è',i:'ì',o:'ò',u:'ù',E:'È',A:'À'}, '^':{a:'â',e:'ê',i:'î',o:'ô',u:'û'}, '"':{a:'ä',e:'ë',i:'ï',o:'ö',u:'ü',A:'Ä',O:'Ö',U:'Ü'}, '~':{n:'ñ',a:'ã',o:'õ'}};
  const SYM = {'%':'%','&':'&amp;','#':'#','_':'_','$':'$','{':'{','}':'}',',':' ',';':' ',':':' ',' ':' ','!':'','/':'','-':'',
    textbackslash:'\\', ldots:'…', dots:'…', textdegree:'°', degree:'°', textpm:'±', pm:'±', times:'×', textasciitilde:'~', textasciicircum:'^',
    textendash:'–', textemdash:'—', textquoteright:'’', textquoteleft:'‘', euro:'€', texteuro:'€', copyright:'©', S:'§', P:'¶', textbar:'|',
    LaTeX:'L<sup style="font-size:.7em;margin-left:-.3em;margin-right:-.15em">A</sup>T<sub style="margin-left:-.12em;margin-right:-.1em">E</sub>X', TeX:'T<sub style="margin-left:-.12em;margin-right:-.1em">E</sub>X',
    checkmark:'✓', ding:'', quad:' ', qquad:'  ', enspace:' ', thinspace:' ', noindent:'', centering:'', raggedright:'', raggedleft:'',
    newline:'<br>', linebreak:'<br>', hfill:'', strut:'', null:'', relax:'', small:'', footnotesize:'', scriptsize:'', tiny:'', normalsize:'', large:'', Large:'', bfseries:'', itshape:'', ttfamily:'', sffamily:'', scshape:'', upshape:'', mdseries:'', bf:'', it:'', em:''};
  const IGNORE1 = new Set(['label','hspace','vspace','phantom','hphantom','vphantom','rule','addlinespace','index','footnote','tablefootnote','footnotemark','cite','ref','eqref',
    'SetCell','SetRow','SetRows','SetCells','SetColumn','SetHline','SetHlines','SetVline','SetVlines']);
  const PLAIN = new Set(['textrm','textsf','textup','textnormal','text','mbox','textmd','fbox','hbox','tabularcell','ensuremath']);
  const UNITS = {metre:'m',meter:'m',second:'s',gram:'g',kilogram:'kg',ampere:'A',kelvin:'K',mole:'mol',candela:'cd',hertz:'Hz',newton:'N',pascal:'Pa',joule:'J',watt:'W',
    coulomb:'C',volt:'V',farad:'F',ohm:'Ω',siemens:'S',tesla:'T',henry:'H',celsius:'°C',degreeCelsius:'°C',lumen:'lm',lux:'lx',litre:'L',liter:'L',minute:'min',hour:'h',day:'d',
    percent:'%',degree:'°',bar:'bar',electronvolt:'eV',byte:'B',bit:'bit',decibel:'dB',
    kilo:'k',mega:'M',giga:'G',tera:'T',milli:'m',micro:'µ',nano:'n',pico:'p',centi:'c',deci:'d',hecto:'h'};
  const COLORS = {red:'#e3242b',green:'#1a9a3c',blue:'#2453c4',cyan:'#00a6c8',magenta:'#c2188f',yellow:'#ffd93b',black:'#000',white:'#fff',gray:'#808080',lightgray:'#bfbfbf',
    darkgray:'#404040',brown:'#8b5a2b',lime:'#9be000',olive:'#808000',orange:'#ff8c1a',pink:'#ffb6c1',purple:'#8a2be2',teal:'#008080',violet:'#7d3cff'};
  /* colore xcolor: nome, nome!percentuale, nome!p!altro, [HTML]{…}, [rgb]{…}, [gray]{…} */
  function color(model, spec){
    spec=(spec||'').trim();
    if (model==='HTML' && /^[0-9a-fA-F]{6}$/.test(spec)) return '#'+spec;
    if (model==='rgb'){ const v=spec.split(',').map(Number); if (v.length===3) return `rgb(${v.map(x=>Math.round(x*255)).join(',')})`; }
    if (model==='RGB'){ const v=spec.split(',').map(Number); if (v.length===3) return `rgb(${v.join(',')})`; }
    if (model==='gray'){ const g=Math.round(Number(spec)*255); return `rgb(${g},${g},${g})`; }
    const p=spec.split('!');
    let c=COLORS[p[0]]; if (!c) return null;
    for (let i=1;i<p.length;i+=2){ const pc=parseFloat(p[i]); if (isNaN(pc)) break; const o=COLORS[p[i+1]]||'#fff'; c=`color-mix(in srgb, ${c} ${pc}%, ${o})`; }
    return c;
  }
  function units(u){
    let out='', per=false;
    for (const m of u.matchAll(/\\([a-zA-Z]+)|([^\\\s]+)/g)){
      if (m[1]==='per'){ per=true; out+='/'; continue; }
      if (m[1]==='square'){ out+=''; continue; }
      if (m[1]==='squared'||m[1]==='cubed'){ out+= m[1]==='squared'?'²':'³'; continue; }
      if (m[1]) out += (UNITS[m[1]]??m[1]); else out+=m[2].replace(/\./g,'·').replace(/\^\{?(-?\d)\}?/g, (x,d)=>d.replace('-','⁻').replace(/\d/g,c=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[c]));
      if (/^(kilo|mega|giga|tera|milli|micro|nano|pico|centi|deci|hecto)$/.test(m[1]||'')) continue;
    }
    return esc(out).replace(/&amp;/g,'&');
  }
  const numTxt = n => esc(n.trim().replace(/\+-|\\pm/g,' ± ').replace(/^-/,'−').replace(/([0-9])[eE]([+-]?\d+)$/, (x,a,b)=>a+'×10<sup>'+b.replace('-','−')+'</sup>')).replace(/&lt;sup&gt;|&lt;\/sup&gt;/g, m=>m==='&lt;sup&gt;'?'<sup>':'</sup>');

  /* lettura di un gruppo {…} o dell'argomento successivo */
  function arg(t, i){
    while (t[i]===' ') i++;
    if (t[i]==='{'){ const k=matchClose(t,i); if (k<0) return {v:t.slice(i+1), e:t.length}; return {v:t.slice(i+1,k), e:k+1}; }
    if (t[i]==='\\'){ const c=readCs(t,i); return {v:t.slice(i,c.e), e:c.e}; }
    return {v:t[i]||'', e:i+1};
  }
  function opt(t, i){ let j=i; while (t[j]===' ') j++; if (t[j]!=='[') return {v:null, e:i}; const k=matchClose(t,j); if (k<0) return {v:null, e:i}; return {v:t.slice(j+1,k), e:k+1}; }

  /* testo → HTML; info raccoglie il colore di sfondo (\cellcolor) */
  function html(t, info={}){
    let out='', i=0;
    let wrap=[]; /* dichiarazioni nel gruppo (\bfseries …) */
    while (i<t.length){
      const ch=t[i];
      if (ch==='%'){ i=commentEnd(t,i); continue; }
      if (ch==='$'){
        const dd = t[i+1]==='$'; const k = t.indexOf(dd?'$$':'$', i+(dd?2:1));
        const e = k<0 ? t.length : k; const tex=t.slice(i+(dd?2:1), e);
        out+=`<span class="m" data-tex="${esc(tex)}">${esc(tex)}</span>`; i = k<0 ? t.length : e+(dd?2:1); continue;
      }
      if (ch==='{'){ const k=matchClose(t,i); const inner = k<0 ? t.slice(i+1) : t.slice(i+1,k); out+=html(inner, info); i = k<0 ? t.length : k+1; continue; }
      if (ch==='}'){ i++; continue; }
      if (ch==='~'){ out+='&nbsp;'; i++; continue; }
      if (ch==='-' && t[i+1]==='-'){ if (t[i+2]==='-'){ out+='—'; i+=3; } else { out+='–'; i+=2; } continue; }
      if (ch==='`' && t[i+1]==='`'){ out+='“'; i+=2; continue; }
      if (ch==="'" && t[i+1]==="'"){ out+='”'; i+=2; continue; }
      if (ch==='`'){ out+='‘'; i++; continue; }
      if (ch==="'"){ out+='’'; i++; continue; }
      if (ch==='<'||ch==='>'||ch==='&'||ch==='"'){ out+=esc(ch); i++; continue; }
      if (ch!=='\\'){ out+=ch; i++; continue; }
      const c=readCs(t,i); const n=c.name; let j=c.e;
      if (n==='\\'){ out+='<br>'; const o=opt(t,j); i=o.e; continue; }
      if (n==='('){ const k=t.indexOf('\\)', j); const tex=t.slice(j, k<0?t.length:k); out+=`<span class="m" data-tex="${esc(tex)}">${esc(tex)}</span>`; i = k<0 ? t.length : k+2; continue; }
      if (n in ACC && isLetter(t[j]) || n in ACC && t[j]==='{'){ const a=arg(t,j); out+=(ACC[n][a.v]||a.v); i=a.e; continue; }
      if (n in SYM){ out+=SYM[n]; i=j; if (isLetter(n[0]) && t[i]===' ') i++; if (/^(bfseries|bf)$/.test(n)) wrap.push('b'); if (/^(itshape|it|em)$/.test(n)) wrap.push('i'); continue; }
      if (n==='textbf'){ const a=arg(t,j); out+='<b>'+html(a.v,info)+'</b>'; i=a.e; continue; }
      if (n==='textit'||n==='emph'||n==='textsl'){ const a=arg(t,j); out+='<i>'+html(a.v,info)+'</i>'; i=a.e; continue; }
      if (n==='texttt'){ const a=arg(t,j); out+='<span style="font-family:var(--f-code);font-size:.9em">'+html(a.v,info)+'</span>'; i=a.e; continue; }
      if (n==='textsc'){ const a=arg(t,j); out+='<span style="font-variant:small-caps">'+html(a.v,info)+'</span>'; i=a.e; continue; }
      if (n==='underline'){ const a=arg(t,j); out+='<u>'+html(a.v,info)+'</u>'; i=a.e; continue; }
      if (n==='textsuperscript'){ const a=arg(t,j); out+='<sup>'+html(a.v,info)+'</sup>'; i=a.e; continue; }
      if (n==='textsubscript'){ const a=arg(t,j); out+='<sub>'+html(a.v,info)+'</sub>'; i=a.e; continue; }
      if (PLAIN.has(n)){ const a=arg(t,j); out+= n==='ensuremath' ? `<span class="m" data-tex="${esc(a.v)}">${esc(a.v)}</span>` : html(a.v,info); i=a.e; continue; }
      if (n==='makecell'||n==='shortstack'||n==='thead'){ const o=opt(t,j); const a=arg(t,o.e); out+='<span style="display:inline-block;text-align:center">'+html(a.v,info)+'</span>'; i=a.e; continue; }
      if (n==='parbox'){ const o=opt(t,j); const w=arg(t,o.e); const a=arg(t,w.e); out+=html(a.v,info); i=a.e; continue; }
      if (n==='cellcolor'||n==='rowcolor'){ const o=opt(t,j); const a=arg(t,o.e); const c=color(o.v,a.v); if (c) info.bg=c; i=a.e; continue; }
      if (n==='textcolor'){ const o=opt(t,j); const a=arg(t,o.e); const b=arg(t,a.e); const c=color(o.v,a.v); out+=`<span style="color:${c||'inherit'}">${html(b.v,info)}</span>`; i=b.e; continue; }
      if (n==='color'){ const o=opt(t,j); const a=arg(t,o.e); const c=color(o.v,a.v); out+=`<span style="color:${c||'inherit'}">`; wrap.push('span'); i=a.e; continue; }
      if (n==='num'){ const o=opt(t,j); const a=arg(t,o.e); out+=numTxt(a.v); i=a.e; continue; }
      if (n==='si'||n==='unit'){ const o=opt(t,j); const a=arg(t,o.e); out+=units(a.v); i=a.e; continue; }
      if (n==='SI'||n==='qty'){ const o=opt(t,j); const a=arg(t,o.e); const b=arg(t,a.e); out+=numTxt(a.v)+' '+units(b.v); i=b.e; continue; }
      if (n==='ang'){ const o=opt(t,j); const a=arg(t,o.e); out+=esc(a.v.replace(/;/g,'° '))+'°'; i=a.e; continue; }
      if (n==='caption'||n==='captionof'){ if (n==='captionof') j=arg(t,j).e; const o=opt(t,j); const a=arg(t,o.e); out+='<span class="lbl">didascalia</span>'+html(a.v,info); i=a.e; continue; }
      if (IGNORE1.has(n)){ const o=opt(t,j); const a=arg(t,o.e); i = n==='rule' ? arg(t,a.e).e : a.e; continue; }
      if (n==='Block'){ const o=opt(t,j); const a=arg(t,o.e), b=arg(t,a.e); out+=html(b.v,info); i=b.e; continue; }
      if (n==='multicolumn'){ const a=arg(t,j), b=arg(t,a.e), c3=arg(t,b.e); out+=html(c3.v,info); i=c3.e; continue; }
      if (n==='multirow'){ let k=opt(t,j).e; const a=arg(t,k); k=opt(t,a.e).e; const w=arg(t,k); k=opt(t,w.e).e; const c3=arg(t,k); out+=html(c3.v,info); i=c3.e; continue; }
      if (n==='begin'){ const en=envName(t,j); if (en && /^(tabular|array)$/.test(en.name)){ const sp=arg(t,en.e); const k=t.indexOf('\\end{'+en.name+'}', sp.e); const inner=t.slice(sp.e, k<0?t.length:k); out+='<span style="display:inline-block;text-align:center;vertical-align:middle">'+inner.split(/\\\\/).map(x=>html(x.replace(/&/g,' '),info)).join('<br>')+'</span>'; i = k<0 ? t.length : k+6+en.name.length; continue; } }
      /* comando sconosciuto: si mostra com'è, e gli argomenti si leggono normalmente */
      out+=`<span class="raw">${esc(t.slice(i,j))}</span>`; i=j;
    }
    for (const w of wrap.reverse()) out = (w==='b' ? '<b>'+out+'</b>' : w==='i' ? '<i>'+out+'</i>' : out+'</span>');
    return out;
  }
  /* numero di una colonna S: parte intera e decimale, per allinearle sulla virgola */
  function siParts(t){
    const m=/^\s*([<>~]?[+-]?\d*)([.,]\d*)?(.*)$/.exec(t.trim().replace(/\\pm|\+-/,'±'));
    if (!m) return null;
    return {i:m[1].replace(/^-/,'−'), f:(m[2]||'')+(m[3]||'').replace(/±/,' ± ').replace(/([0-9])[eE]([+-]?\d+)/,'$1e$2')};
  }
  return {html, color, siParts};
})();
