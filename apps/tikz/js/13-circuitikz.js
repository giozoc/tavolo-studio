/* ============ CIRCUITIKZ: componenti sui percorsi to[...] e nodi dei circuiti ============ */
/* misure in frazioni di bipoles/length (1,4 cm), come in pgfcirc */
let CZ = null;
const CZ_DEF = () => ({len:1.4, res:'american', ind:'cute', volt:'european', cur:'european'});
/* nome della chiave → [disegno, larghezza, altezza] */
const CZ_BIP = {
  short:['short',0,0], open:['open',0,0],
  R:['R',.8,.3], resistor:['R',.8,.3], 'american resistor':['aR',.8,.3], 'european resistor':['eR',.8,.3], eR:['eR',.8,.3], generic:['eR',.8,.3],
  C:['C',.2,.6], capacitor:['C',.2,.6], eC:['eC',.2,.5], 'polar capacitor':['eC',.2,.5], pC:['eC',.2,.6],
  L:['L',.6,.3], inductor:['L',.6,.3], 'cute inductor':['cL',.6,.3], 'american inductor':['aL',.8,.3], 'european inductor':['eL',.8,.3], cL:['cL',.6,.3],
  V:['V',.6,.6], vsource:['V',.6,.6], 'voltage source':['V',.6,.6], 'european voltage source':['eV',.6,.6], 'american voltage source':['aV',.6,.6], vsourceAM:['aV',.6,.6],
  I:['I',.6,.6], isource:['I',.6,.6], 'current source':['I',.6,.6], 'european current source':['eI',.6,.6], 'american current source':['aI',.6,.6], isourceAM:['aI',.6,.6],
  sV:['sV',.6,.6], vsourcesin:['sV',.6,.6], 'sinusoidal voltage source':['sV',.6,.6], sI:['sI',.6,.6],
  battery:['bat',.3,.6], battery1:['bat1',.3,.6], battery2:['bat1',.3,.6],
  D:['D',.4,.5], diode:['D',.4,.5], 'empty diode':['D',.4,.5], 'D*':['D*',.4,.5], 'full diode':['D*',.4,.5],
  led:['led',.4,.5], leD:['led',.4,.5], 'leD*':['led*',.4,.5], zD:['zD',.4,.5], 'zD*':['zD*',.4,.5], 'zener diode':['zD',.4,.5],
  lamp:['lamp',.6,.6], bulb:['lamp',.8,.8], fuse:['fuse',.5,.2],
  ammeter:['meter:A',.6,.6], voltmeter:['meter:V',.6,.6], ohmmeter:['meter:\\Omega',.6,.6],
  switch:['sw',.35,.3], nos:['sw',.35,.3], spst:['sw',.35,.35], 'normal open switch':['sw',.35,.3],
  ncs:['swc',.35,.3], 'normal closed switch':['swc',.35,.3], cspst:['swcl',.35,.35], 'closing switch':['swcl',.35,.35], ospst:['swop',.35,.35], 'opening switch':['swop',.35,.35]
};
const CZ_LAB = /^(l|l\^|l_|a|a\^|a_|v|v\^|v_|v<|v>|v\^<|v\^>|v_<|v_>|i|i\^|i_|i<|i>|i\^<|i\^>|i_<|i_>|i<\^|i>\^|i<_|i>_|label|annotation|voltage|current)$/;
const CZ_POLE = /^([*od]?)-([*od]?)$/;

function czReset(src, fig){
  CZ = CZ_DEF();
  const pk=/\\usepackage\s*\[([^\]]*)\]\s*\{circuitikz\}/.exec(src);
  if (pk) czStyleWords(pk[1]);
  if (fig && fig.env==='circuitikz'){ const op=/^\s*\[([^\]]*)\]/.exec(src.slice(fig.bodyS, fig.bodyS+400)); if (op) czStyleWords(op[1]); }
}
function czStyleWords(t){
  for (const w0 of t.split(',')){
    const w=w0.trim().replace(/\s+/g,'');
    if (w==='european'){ CZ.res='european'; CZ.ind='european'; CZ.volt='european'; CZ.cur='european'; }
    else if (w==='american'){ CZ.res='american'; CZ.ind='american'; CZ.volt='american'; CZ.cur='american'; }
    else if (/^(european|american)resistors?$/.test(w)) CZ.res=w.startsWith('e')?'european':'american';
    else if (/^(european|american)inductors?$/.test(w)) CZ.ind=w.startsWith('e')?'european':'american';
    else if (/^cuteinductors?$/.test(w)) CZ.ind='cute';
    else if (/^(european|american)voltages?$/.test(w)) CZ.volt=w.startsWith('e')?'european':'american';
    else if (/^(european|american)currents?$/.test(w)) CZ.cur=w.startsWith('e')?'european':'american';
  }
}
/* \ctikzset{bipoles/length=1cm, european, ...} */
function czSet(text, ctx){
  if (!CZ) CZ=CZ_DEF();
  for (const {k,v} of parseOptList(subVars(text, ctx.vars))){
    if (k==='bipoles/length'){ try{ CZ.len=lenCm(v, ctx); }catch(e){ ctx.warn(e.message); } }
    else if (v===null && /^(european|american|cute)/.test(k.replace(/\s+/g,''))) czStyleWords(k);
    else if (/^(resistors?|inductors?|voltages?|currents?)\/?$/.test(k) || /^(resistor|inductor|voltage|current)$/.test(k)) czStyleWords((v||'')+k.replace(/\/$/,''));
  }
}

/* opzioni di to[...]: componente, etichette, poli; null se non c'è un componente */
function czParse(opText, ctx){
  if (!opText || !CZ) return null;
  const items=splitTop(opText).map(s=>s.trim()).filter(Boolean);
  let comp=null; const rest=[], lab={}; let poles=null, invert=false, mirror=false;
  for (const it of items){
    const eq=(()=>{ let d=0; for (let k=0;k<it.length;k++){ const c=it[k]; if ('{(['.includes(c)) d++; else if ('})]'.includes(c)) d--; else if (c==='='&&d===0) return k; } return -1; })();
    const k=(eq<0?it:it.slice(0,eq)).trim(), v=eq<0?null:unbrace(it.slice(eq+1));
    if (!comp && CZ_BIP[k]){ comp=k; if (v!==null) lab.l={text:v, side:1}; continue; }
    if (CZ_LAB.test(k)){
      const kind = k==='label'?'l' : k==='annotation'?'a' : k==='voltage'?'v' : k==='current'?'i' : k[0];
      const side = /\^/.test(k) ? 1 : /_/.test(k) ? -1 : kind==='a' ? -1 : 1;
      const dir = /</.test(k) ? -1 : /\>/.test(k) ? 1 : 0;
      lab[kind]={text:v||'', side, dir}; continue;
    }
    if (v===null && CZ_POLE.test(k)){ poles=CZ_POLE.exec(k).slice(1); continue; }
    if (k==='invert'){ invert=true; continue; }
    if (k==='mirror'){ mirror=true; continue; }
    if (/^(n|name|f|f\^|f_|f<|f>|bipole|l2|l2 halign|l2 valign|v\^?|nodes width|bipoles\/.*)$/.test(k)) continue;
    rest.push(it);
  }
  if (!comp) return null;
  return {comp, def:CZ_BIP[comp], lab, poles, invert, mirror, rest:rest.join(',')};
}

/* disegna il componente tra a e b; i fili fanno parte del percorso */
function czTo(ps, a, b, lst, cz, ctx){
  const d=V.sub(b,a), L=V.len(d);
  let [kind, wf, hf] = cz.def;
  if (kind==='R') kind = CZ.res==='european' ? 'eR' : 'aR';
  if (kind==='L') kind = CZ.ind==='european' ? 'eL' : CZ.ind==='american' ? 'aL' : 'cL';
  if (kind==='V') kind = CZ.volt==='american' ? 'aV' : 'eV';
  if (kind==='I') kind = CZ.cur==='american' ? 'aI' : 'eI';
  if (kind==='eR' || kind==='eL'){ wf=.8; hf=.3; }
  const Rl=CZ.len, w=Math.min(wf*Rl, L), h=hf*Rl;
  let u = L>1e-9 ? V.mul(d,1/L) : [1,0], nrm=[-u[1],u[0]];
  const mid=V.lerp(a,b,.5);
  const p1=V.sub(mid,V.mul(u,w/2)), p2=V.add(mid,V.mul(u,w/2));
  // fili
  if (kind!=='open'){
    if (!curSub(ps) || ps.curNode) startSub(ps, a);
    pushOp(ps, {t:'L', p: kind==='short' ? b : p1});
    if (kind!=='short'){ startSub(ps, p2); pushOp(ps, {t:'L', p:b}); }
  } else startSub(ps, b);
  // il simbolo, in coordinate locali (x lungo il ramo, y a sinistra)
  if (cz.invert){ u=V.mul(u,-1); nrm=V.mul(nrm,-1); }
  if (cz.mirror) nrm=V.mul(nrm,-1);
  const T=(x,y)=>V.add(mid, V.add(V.mul(u,x), V.mul(nrm,y)));
  const st=cloneStyle(lst); st.arrows=['','']; st.shorten=[0,0]; st.dash=null; st.double=null; st.rounded=0;
  const col=css(st.draw && st.draw!==true && st.draw!=='none' ? st.draw : st.color), lw=fmt(2*st.lw,5);   // i simboli hanno spessore doppio dei fili
  const sk=`stroke="${col}" stroke-width="${lw}" stroke-linejoin="round"`;
  const line=(pts, fill='none')=>`<path d="${ptsPath(pts.map(p=>T(...p)), fill!=='none')}" fill="${fill}" ${sk}/>`;
  const circ=(x,y,r,fill='none')=>{ const c=T(x,y); return `<circle cx="${fmt(c[0],4)}" cy="${fmt(-c[1],4)}" r="${fmt(r,4)}" fill="${fill}" ${sk}/>`; };
  const W=w/2, H=h/2;
  let g='';
  const sym=(t,p,f=.8)=>{ const ns=nodeBaseStyle(newStyle(), ctx, 'node'); ns.color=st.draw && st.draw!==true && st.draw!=='none' ? st.draw : st.color; ns.font=f; ns.isep=[0,0]; return nodeSVG(buildNode(ns, t, p, ctx)); };
  const diode=(full)=>line([[-W,-H],[W,0],[-W,H]], full?col:'#fff')+line([[W,-H],[W,H]]);
  const arrowsOut=(x0,y0)=>{ let s=''; for (const dx of [0,.12]){ const p=[x0+dx,y0], q=[x0+dx+.12,y0+.12]; s+=line([p,q])+line([[q[0]-.06,q[1]],q,[q[0],q[1]-.06]]); } return s; };
  switch(kind){
    case 'aR': { const pts=[[-W,0]]; for (let k=0;k<6;k++) pts.push([-W+(2*k+1)*w/12, (k%2?-H:H)]); pts.push([W,0]); g=line(pts); break; }
    case 'eR': g=line([[-W,-H],[W,-H],[W,H],[-W,H]], '#fff'); break;
    case 'eL': g=line([[-W,-H],[W,-H],[W,H],[-W,H]], col); break;
    case 'C': g=line([[-W,-H],[-W,H]])+line([[W,-H],[W,H]]); break;
    case 'eC': g=line([[-W,-H],[-W,H]])+`<path d="M${P(T(W*1.4,-H))}Q${P(T(W*.6,0))} ${P(T(W*1.4,H))}" fill="none" ${sk}/>`; break;
    case 'aL': { const r=w/8, ry=Math.min(H, r*1.4), pts=[]; for (let k=0;k<4;k++) for (let j=0;j<=12;j++){ const th=Math.PI*(1-j/12); pts.push([-W+(2*k+1)*r+r*Math.cos(th), ry*Math.sin(th)]); } g=line(pts); break; }
    case 'cL': { const N=5, A=1.6*w/(2*Math.PI*N), pts=[]; for (let k=0;k<=N*24;k++){ const t=k/(N*24), th=2*Math.PI*N*t; pts.push([-W+w*t-A*Math.sin(th), H/2*(1-Math.cos(th))]); } g=line(pts); break; }
    case 'eV': g=circ(0,0,W,'#fff')+line([[-W,0],[W,0]]); break;
    case 'aV': g=circ(0,0,W,'#fff')+sym('$+$', T(W*.45,0))+sym('$-$', T(-W*.45,0)); break;
    case 'eI': g=circ(0,0,W,'#fff')+line([[0,-W],[0,W]]); break;
    case 'aI': g=circ(0,0,W,'#fff')+line([[-W*.55,0],[W*.55,0]])+line([[W*.25,.13],[W*.55,0],[W*.25,-.13]]); break;
    case 'sV': case 'sI': { const pts=[]; for (let k=0;k<=24;k++){ const t=k/24; pts.push([-W*.6+1.2*W*t, W*.35*Math.sin(t*2*Math.PI)]); } g=circ(0,0,W,'#fff')+line(pts.map(([x,y])=>[y,x])); break; }
    case 'bat1': g=line([[-W,-H],[-W,H]])+`<path d="M${P(T(W,-H/2))}L${P(T(W,H/2))}" stroke="${col}" stroke-width="${fmt(st.lw*3,5)}"/>`; break;
    case 'bat': { const q=w/3; g=line([[-W,-H],[-W,H]])+line([[-W+q,-H/2],[-W+q,H/2]])+line([[-W+2*q,-H],[-W+2*q,H]])+line([[W,-H/2],[W,H/2]]); break; }
    case 'D': case 'D*': g=diode(kind==='D*'); break;
    case 'led': case 'led*': g=diode(kind==='led*')+arrowsOut(-W*.2, H*.9); break;
    case 'zD': case 'zD*': g=line([[-W,-H],[W,0],[-W,H]], kind==='zD*'?col:'#fff')+line([[W-.08,-H-.05],[W,-H],[W,H],[W+.08,H+.05]]); break;
    case 'lamp': { const r=W, k=r*.707; g=circ(0,0,r,'#fff')+line([[-k,-k],[k,k]])+line([[-k,k],[k,-k]]); break; }
    case 'fuse': g=line([[-W,-H],[W,-H],[W,H],[-W,H]], '#fff')+line([[-W,0],[W,0]]); break;
    case 'sw': case 'swc': case 'swcl': case 'swop': {
      g = kind==='swc' ? line([[-W,0],[W,H*.25]]) : line([[-W,0],[W*.95,H]]);
      if (kind==='swcl' || kind==='swop'){ const s=kind==='swcl'?1:-1, r=w*.55; g+=`<path d="M${P(T(-W+r*.5,H*1.4))}Q${P(T(0,H*2.1))} ${P(T(W*.6,H*1.2))}" fill="none" ${sk}/>`+line([[W*.6-.07*s,H*1.2+.05],[W*.6,H*1.2],[W*.6-.02,H*1.2+.09*s]]); }
      break; }
    default:
      if (kind.startsWith('meter:')) g=circ(0,0,W,'#fff')+sym('$\\mathrm{'+kind.slice(6)+'}$', mid, 1);
  }
  // area di clic: il ramo intero e il riquadro del simbolo con le etichette
  g += `<path class="hit" fill="none" d="M${P(a)}L${P(b)}"/>`;
  if (kind!=='short' && kind!=='open'){ const e=Math.max(H,.12)+.3; g += `<path class="hitf" fill="transparent" d="${ptsPath([T(-W,-e),T(W,-e),T(W,e),T(-W,e)])}"/>`; }
  R.pins.push({p:a, s:ps.sIdx}, {p:b, s:ps.sIdx});
  // poli
  const pole=(t,p)=> t==='*' ? `<circle cx="${fmt(p[0],4)}" cy="${fmt(-p[1],4)}" r="${fmt(.04*Rl,4)}" fill="${col}" ${sk}/>` : t==='o' ? `<circle cx="${fmt(p[0],4)}" cy="${fmt(-p[1],4)}" r="${fmt(.04*Rl,4)}" fill="#fff" ${sk}/>` : '';
  if (cz.poles) g += pole(cz.poles[0], a) + pole(cz.poles[1], b);
  // etichette
  const uu=L>1e-9 ? V.mul(d,1/L) : [1,0], nn=[-uu[1],uu[0]];
  const names=['east','north east','north','north west','west','south west','south','south east'];
  const label=(text, p, dirv)=>{
    if (!text) return '';
    const ls=nodeBaseStyle(newStyle(), ctx, 'node'); ls.color=lst.color; ls.isep=[2*PT,2*PT];
    const a=V.ang(V.mul(dirv,-1)); ls.anchor=names[Math.round((((a%360)+360)%360)/45)%8];
    return nodeSVG(buildNode(ls, text, p, ctx));
  };
  // ingombro del simbolo a sinistra e a destra del ramo (bobine e interruttori stanno da un lato)
  const one = /^(cL|aL|sw|swc|swcl|swop)$/.test(kind), ext = kind==='short'||kind==='open' ? [.03,.03] : one ? [H, .03] : [H, H];
  const side = s => (cz.mirror ? -s : s)*(cz.invert ? -1 : 1) > 0 ? ext[0] : ext[1];
  for (const kk of ['l','a']){ const lb=cz.lab[kk]; if (!lb) continue; const dv=V.mul(nn,lb.side); g+=label(lb.text, V.add(mid, V.mul(dv, side(lb.side))), dv); }
  if (cz.lab.v){
    const lb=cz.lab.v, dv=V.mul(nn,lb.side), off=side(lb.side)+.2, sgn=lb.dir<0 ? -1 : 1;
    if (CZ.volt==='american'){
      g+=label('$+$', V.add(V.add(mid,V.mul(uu,-sgn*W*1.1)), V.mul(dv,off-.05)), dv)+label('$-$', V.add(V.add(mid,V.mul(uu,sgn*W*1.1)), V.mul(dv,off-.05)), dv);
      g+=label(lb.text, V.add(mid, V.mul(dv,off)), dv);
    } else {
      const q0=V.add(V.add(mid,V.mul(uu,-sgn*Math.max(W,.3))), V.mul(dv,off)), q1=V.add(V.add(mid,V.mul(uu,sgn*Math.max(W,.3))), V.mul(dv,off)), qc=V.add(mid, V.mul(dv,off+.12));
      const vs=cloneStyle(st); vs.arrows=['','>']; vs.arrowDef='Latex'; vs.draw=st.draw&&st.draw!==true?st.draw:st.color;
      g+=pathSVG({st:vs, subs:[{start:q0, ops:[{t:'C', c1:V.lerp(q0,qc,.7), c2:V.lerp(q1,qc,.7), p:q1}], closed:false}], extraSVG:[], edges:[], nodes:[]}, ctx, false).svg;
      g+=label(lb.text, V.add(mid, V.mul(dv,off+.12)), dv);
    }
  }
  if (cz.lab.i){
    const lb=cz.lab.i, sgn=lb.dir<0 ? -1 : 1;
    const pc = kind==='short'||kind==='open' ? mid : V.lerp(p2, b, .5);
    const ang=V.ang(V.mul(uu, sgn));
    const is=cloneStyle(st); is.arrowDef='Latex';
    g+=tipSVG(tipInfo('Latex', is, false), V.add(pc, V.mul(uu, sgn*.08)), ang, is);
    g+=label(lb.text, V.add(pc, V.mul(nn, lb.side*.1)), V.mul(nn, lb.side));
  }
  ps.extraSVG.push(g);
}

/* ---------- nodi: massa, alimentazioni, punti, op amp, transistor ---------- */
/* forma: {w,h} semilarghezze in frazioni di bipoles/length, ancore e disegno in coordinate locali (cm) */
const CZ_NODES = {
  ground:{box:[.15,.15,0,.4], draw:(L)=>[['M',[0,0],[0,-.3*L]],['B',[-.15*L,-.3*L],[.15*L,-.3*L]],['B',[-.1*L,-.35*L],[.1*L,-.35*L]],['B',[-.05*L,-.4*L],[.05*L,-.4*L]]]},
  rground:{box:[.15,.15,0,.3], draw:(L)=>[['M',[0,0],[0,-.3*L]],['B',[-.15*L,-.3*L],[.15*L,-.3*L]]]},
  sground:{box:[.15,.15,0,.45], draw:(L)=>[['M',[0,0],[0,-.3*L]],['F',[-.12*L,-.3*L],[.12*L,-.3*L],[0,-.45*L]]]},
  tlground:{box:[.15,.15,0,.12], draw:(L)=>[['M',[0,0],[0,-.1*L]],['M',[-.15*L,-.1*L],[.15*L,-.1*L]],['M',[-.15*L,-.1*L],[-.22*L,-.17*L]],['M',[0,-.1*L],[-.07*L,-.17*L]],['M',[.15*L,-.1*L],[.08*L,-.17*L]]]},
  vcc:{box:[.1,.1,.2,0], draw:(L)=>[['M',[0,0],[0,.2*L]],['M',[-.07*L,.13*L],[0,.2*L],[.07*L,.13*L]]]},
  vee:{box:[.1,.1,0,.2], draw:(L)=>[['M',[0,0],[0,-.2*L]],['M',[-.07*L,-.13*L],[0,-.2*L],[.07*L,-.13*L]]]},
  circ:{box:[.04,.04,.04,.04], dot:'full'}, ocirc:{box:[.04,.04,.04,.04], dot:'open'}, diamondpole:{box:[.04,.04,.04,.04], dot:'full'}, nodepole:{box:[0,0,0,0]},
  'op amp':{box:[.85,.85,.7,.7], text:true, draw:(L)=>[['F0',[-.595*L,.7*L],[.595*L,0],[-.595*L,-.7*L]],['M',[-.85*L,.35*L],[-.595*L,.35*L]],['M',[-.85*L,-.35*L],[-.595*L,-.35*L]],['M',[.595*L,0],[.85*L,0]],['T','-',[-.4*L,.35*L]],['T','+',[-.4*L,-.35*L]]],
    anchors:(L)=>({'-':[-.85*L,.35*L], '+':[-.85*L,-.35*L], out:[.85*L,0], up:[0,.35*L], down:[0,-.35*L]})},
  npn:{box:[.6,.3,.55,.55], draw:(L)=>[['M',[-.6*L,0],[-.3*L,0]],['B',[-.3*L,-.22*L],[-.3*L,.22*L]],['M',[-.3*L,.08*L],[0,.3*L],[0,.55*L]],['M',[-.3*L,-.08*L],[0,-.3*L],[0,-.55*L]],['A',[-.3*L,-.08*L],[0,-.3*L]]],
    anchors:(L)=>({B:[-.6*L,0], C:[0,.55*L], E:[0,-.55*L], base:[-.6*L,0], collector:[0,.55*L], emitter:[0,-.55*L]})},
  pnp:{box:[.6,.3,.55,.55], draw:(L)=>[['M',[-.6*L,0],[-.3*L,0]],['B',[-.3*L,-.22*L],[-.3*L,.22*L]],['M',[-.3*L,.08*L],[0,.3*L],[0,.55*L]],['M',[-.3*L,-.08*L],[0,-.3*L],[0,-.55*L]],['A',[0,.3*L],[-.3*L,.08*L]]],
    anchors:(L)=>({B:[-.6*L,0], C:[0,-.55*L], E:[0,.55*L], base:[-.6*L,0], collector:[0,-.55*L], emitter:[0,.55*L]})},
  nmos:{box:[.35,.25,.55,.55], draw:(L)=>[['M',[-.35*L,0],[-.2*L,0]],['M',[-.2*L,-.2*L],[-.2*L,.2*L]],['M',[-.13*L,-.25*L],[-.13*L,.25*L]],['M',[-.13*L,.2*L],[0,.2*L],[0,.55*L]],['M',[-.13*L,-.2*L],[0,-.2*L],[0,-.55*L]],['A',[-.08*L,-.2*L],[0,-.2*L]]],
    anchors:(L)=>({G:[-.35*L,0], D:[0,.55*L], S:[0,-.55*L], gate:[-.35*L,0], drain:[0,.55*L], source:[0,-.55*L]})},
  pmos:{box:[.35,.25,.55,.55], draw:(L)=>[['M',[-.35*L,0],[-.2*L,0]],['M',[-.2*L,-.2*L],[-.2*L,.2*L]],['M',[-.13*L,-.25*L],[-.13*L,.25*L]],['M',[-.13*L,.2*L],[0,.2*L],[0,.55*L]],['M',[-.13*L,-.2*L],[0,-.2*L],[0,-.55*L]],['A',[0,.2*L],[-.1*L,.2*L]]],
    anchors:(L)=>({G:[-.35*L,0], D:[0,-.55*L], S:[0,.55*L], gate:[-.35*L,0], drain:[0,-.55*L], source:[0,.55*L]})}
};
CZ_NODES.nigfete = CZ_NODES.nmos; CZ_NODES.pigfete = CZ_NODES.pmos;
function czGeom(n){
  const def=CZ_NODES[n.st.shape], L=(CZ?CZ.len:1.4);
  const [l,r,u,d]=def.box.map(v=>v*L);
  n.kind='cz'; n.cz=def; n.czL=L;
  n.poly=[[-l,-d],[r,-d],[r,u],[-l,u]]; n.hw=Math.max(l,r); n.hh=Math.max(u,d);
}
function czAnchor(n, name){
  const def=n.cz, L=n.czL;
  if (def.anchors){ const a=def.anchors(L)[name]; if (a) return a; }
  if (name==='center' || name==='') return [0,0];
  return null;
}
function czNodeSVG(n){
  const def=n.cz, L=n.czL, st=n.st;
  const col=css(st.draw && st.draw!==true && st.draw!=='none' ? st.draw : st.color), lw=fmt(st.lw,5);
  const loc=p=>toPage(n,p), sk=`stroke="${col}" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"`;
  let out='';
  if (def.dot){ const c=n.c; return `<circle cx="${fmt(c[0],4)}" cy="${fmt(-c[1],4)}" r="${fmt(.04*L,4)}" fill="${def.dot==='full'?col:'#fff'}" ${sk}/>`; }
  for (const [t,...pts] of (def.draw ? def.draw(L) : [])){
    if (t==='M' || t==='B') out+=`<path d="${ptsPath(pts.map(loc),false)}" fill="none" ${sk}${t==='B'?` stroke-width="${fmt(st.lw*2,5)}"`:''}/>`;
    else if (t==='F' || t==='F0') out+=`<path d="${ptsPath(pts.map(loc),true)}" fill="${t==='F'?col:css(st.fill && st.fill!==true && st.fill!=='none'?st.fill:[1,1,1])}" ${sk} stroke-width="${fmt(st.lw*2,5)}"/>`;
    else if (t==='A'){ const ts=cloneStyle(st); ts.draw=st.draw||true; out+=tipSVG(tipInfo('Latex', ts, false), loc(pts[1]), V.ang(V.sub(loc(pts[1]),loc(pts[0]))), ts); }
    else if (t==='T'){ const ns=nodeBaseStyle(newStyle(), {styles:{}, vars:{}, warn:()=>{}}, 'node'); ns.color=st.color; ns.font=.8; out+=nodeSVG(buildNode(ns, '$'+pts[0]+'$', loc(pts[1]), {warn:()=>{}})); }
  }
  return out;
}
