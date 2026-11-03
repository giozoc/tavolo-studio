"use strict";
/* ============ CORE: unità, colori, espressioni pgfmath, opzioni ============ */
const PT = 1/28.4528;               // 1pt in cm
const UNIT = {cm:1, mm:.1, pt:PT, bp:2.54/72, in:2.54, ex:4.3*PT, em:10*PT, pc:12*PT};
const fmt = (v, d=3) => { let s = (+v).toFixed(d).replace(/\.?0+$/,''); if (s==='-0') s='0'; return s; };
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const D2R = Math.PI/180;

/* ---------- colori xcolor ---------- */
const BASE_COLORS = {
  red:[1,0,0], green:[0,1,0], blue:[0,0,1], cyan:[0,1,1], magenta:[1,0,1], yellow:[1,1,0],
  black:[0,0,0], white:[1,1,1], gray:[.5,.5,.5], darkgray:[.25,.25,.25], lightgray:[.75,.75,.75],
  brown:[.75,.5,.25], lime:[.75,1,0], olive:[.5,.5,0], orange:[1,.5,0], pink:[1,.75,.75],
  purple:[.75,0,.25], teal:[0,.5,.5], violet:[.5,0,.5],
  // dvipsnames più comuni
  ForestGreen:[.13,.55,.13], NavyBlue:[0,.46,.72], RoyalBlue:[0,.44,1], Maroon:[.69,.19,.38],
  BrickRed:[.72,.12,.07], Goldenrod:[1,.9,.16], Orchid:[.68,.36,1], SkyBlue:[.38,.81,1],
  Emerald:[0,1,.5], Plum:[.55,0,1], Mahogany:[.65,0,0], Turquoise:[.15,1,.8], Sepia:[.3,0,0],
  Gray:[.5,.5,.5], OliveGreen:[.24,.5,.04], Peach:[1,.5,.3], Salmon:[1,.47,.62], Tan:[.86,.58,.44],
  MidnightBlue:[0,.44,.57], Cerulean:[.06,.89,1], Aquamarine:[.18,1,.7], Melon:[1,.54,.5],
  CornflowerBlue:[.35,.87,1], Dandelion:[1,.71,.16], Fuchsia:[.45,.01,.92], JungleGreen:[.01,1,.48],
  RedOrange:[1,.23,.13], Rhodamine:[1,.18,1], SeaGreen:[.31,1,.5], Thistle:[.88,.41,1]
};
let userColors = {};
function parseColor(spec){
  // ritorna [r,g,b] oppure null
  if (!spec) return null;
  spec = String(spec).trim().replace(/^\{|\}$/g,'').trim();
  if (spec==='none') return 'none';
  let neg = false;
  if (spec[0]==='-'){ neg=true; spec=spec.slice(1); }
  const parts = spec.split('!').map(s=>s.trim());
  let c = namedColor(parts[0]); if (!c) return null;
  let i = 1;
  while (i < parts.length){
    const pct = parseFloat(parts[i]); if (isNaN(pct)) return null;
    let other = [1,1,1];
    if (i+1 < parts.length){ other = namedColor(parts[i+1]); if(!other) return null; i+=2; } else i++;
    const t = clamp(pct,0,100)/100;
    c = c.map((v,k)=> v*t + other[k]*(1-t));
  }
  if (neg) c = c.map(v=>1-v);
  return c;
}
function namedColor(n){
  if (!n) return null;
  if (userColors[n]) return userColors[n];
  if (BASE_COLORS[n]) return BASE_COLORS[n];
  const lc = Object.keys(BASE_COLORS).find(k=>k.toLowerCase()===n.toLowerCase());
  return lc ? BASE_COLORS[lc] : null;
}
function defineColor(name, model, val){
  const v = val.split(',').map(s=>parseFloat(s));
  let c=null;
  model = model.trim();
  if (model==='rgb') c=v;
  else if (model==='RGB') c=v.map(x=>x/255);
  else if (model==='HTML'){ const h=val.trim(); c=[0,2,4].map(k=>parseInt(h.substr(k,2),16)/255); }
  else if (model==='gray') c=[v[0],v[0],v[0]];
  else if (model==='cmyk'){ const [C,M,Y,K]=v; c=[(1-C)*(1-K),(1-M)*(1-K),(1-Y)*(1-K)]; }
  if (c && c.every(x=>!isNaN(x))) userColors[name.trim()] = c;
}
const css = c => !c ? 'none' : c==='none' ? 'none' : '#'+c.map(v=>Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0')).join('');
const isColorWord = w => parseColor(w)!==null && !/^-?[\d.]/.test(w);

/* ---------- espressioni pgfmath ---------- */
class MathErr extends Error{}
function evalExpr(src, vars={}, opt={}){
  // opt.trig: 'deg' (default) | 'rad'
  const s = String(src); let i=0;
  const rad = opt.trig==='rad';
  const toR = a => rad ? a : a*D2R, frR = a => rad ? a : a/D2R;
  const ws = ()=>{ while(i<s.length && /\s/.test(s[i])) i++; };
  const F = {
    sin:a=>Math.sin(toR(a)), cos:a=>Math.cos(toR(a)), tan:a=>Math.tan(toR(a)),
    sec:a=>1/Math.cos(toR(a)), cosec:a=>1/Math.sin(toR(a)), cot:a=>1/Math.tan(toR(a)),
    asin:a=>frR(Math.asin(a)), acos:a=>frR(Math.acos(a)), atan:a=>frR(Math.atan(a)),
    atan2:(y,x)=>frR(Math.atan2(y,x)), exp:Math.exp, ln:Math.log, log10:Math.log10, log2:Math.log2,
    sqrt:Math.sqrt, abs:Math.abs, floor:Math.floor, ceil:Math.ceil, round:Math.round, int:Math.trunc,
    mod:(a,b)=>a%b, Mod:(a,b)=>((a%b)+b)%b, max:(...a)=>Math.max(...a), min:(...a)=>Math.min(...a),
    pow:Math.pow, rad:a=>a*D2R, deg:a=>a/D2R, sinh:Math.sinh, cosh:Math.cosh, tanh:Math.tanh,
    sign:Math.sign, frac:a=>a-Math.floor(a), veclen:(a,b)=>Math.hypot(a,b), factorial:a=>{let r=1;for(let k=2;k<=a;k++)r*=k;return r},
    rnd:()=>Math.random(), rand:()=>Math.random()*2-1, real:a=>a, neg:a=>-a, not:a=>a?0:1,
    iseven:a=>a%2===0?1:0, isodd:a=>Math.abs(a%2)===1?1:0
  };
  const C = {pi:Math.PI, e:Math.E, true:1, false:0};
  function prim(){
    ws();
    const ch = s[i];
    if (ch===undefined) throw new MathErr('espressione incompleta');
    if (ch==='('||ch==='{'){ const cl = ch==='('?')':'}'; i++; const v=ternary(); ws(); if(s[i]!==cl) throw new MathErr('manca '+cl); i++; return v; }
    if (ch==='-'){ i++; return -pow(); }
    if (ch==='+'){ i++; return pow(); }
    if (ch==='!'){ i++; return prim()?0:1; }
    if (/[\d.]/.test(ch)){
      const m = /^(\d*\.?\d+(?:[eE][-+]?\d+)?|\d+\.)/.exec(s.slice(i)); if(!m) throw new MathErr('numero non valido');
      i += m[0].length; let v = parseFloat(m[0]);
      const u = /^(cm|mm|pt|bp|in|ex|em|pc)(?![a-zA-Z])/.exec(s.slice(i));
      if (u){ i+=u[0].length; v*=UNIT[u[1]]; opt.hadUnit=true; }
      else if (s[i]==='r' && !/[a-zA-Z]/.test(s[i+1]||'')){ i++; if(!rad) v=v/D2R; }
      return v;
    }
    if (ch==='\\'){
      const m = /^\\([a-zA-Z@]+)/.exec(s.slice(i)); if(!m) throw new MathErr('macro non valida');
      i += m[0].length;
      const nm = m[1];
      if (nm in vars){ const v = parseFloat(vars[nm]); if (isNaN(v)) { return evalExpr(vars[nm], vars, opt); } return v; }
      if (nm==='pi') return Math.PI;
      throw new MathErr('variabile \\'+nm+' non definita');
    }
    if (/[a-zA-Z]/.test(ch)){
      const m = /^[a-zA-Z][a-zA-Z0-9]*/.exec(s.slice(i)); i += m[0].length; const nm=m[0];
      ws();
      if (s[i]==='('){
        if (!(nm in F)) throw new MathErr('funzione '+nm+' sconosciuta');
        i++; const args=[]; ws();
        if (s[i]!==')'){ args.push(ternary()); ws(); while(s[i]===','){ i++; args.push(ternary()); ws(); } }
        if (s[i]!==')') throw new MathErr('manca )'); i++;
        return F[nm](...args);
      }
      if (nm in vars){ const v=parseFloat(vars[nm]); if(!isNaN(v)) return v; }
      if (nm in C) return C[nm];
      if (nm in F && /^(rnd|rand)$/.test(nm)) return F[nm]();
      throw new MathErr('nome '+nm+' sconosciuto');
    }
    throw new MathErr('carattere inatteso «'+ch+'»');
  }
  function post(){ let v=prim(); ws(); while(s[i]==='!' && s[i+1]!=='='){ i++; v=F.factorial(v); ws(); } return v; }
  function pow(){ let v=post(); ws(); if(s[i]==='^'){ i++; const e=pow(); return Math.pow(v,e); } return v; }
  function mul(){ let v=pow(); for(;;){ ws(); const c=s[i]; if(c==='*'){i++;v*=pow();} else if(c==='/'){i++;v/=pow();} else return v; } }
  function add(){ let v=mul(); for(;;){ ws(); const c=s[i]; if(c==='+'){i++;v+=mul();} else if(c==='-'){i++;v-=mul();} else return v; } }
  function cmp(){ let v=add(); for(;;){ ws(); const t=s.substr(i,2);
    if(t==='<='){i+=2;v=+(v<=add());} else if(t==='>='){i+=2;v=+(v>=add());} else if(t==='=='){i+=2;v=+(v==add());} else if(t==='!='){i+=2;v=+(v!=add());}
    else if(s[i]==='<'){i++;v=+(v<add());} else if(s[i]==='>'){i++;v=+(v>add());} else return v; } }
  function and(){ let v=cmp(); for(;;){ ws(); if(s.substr(i,2)==='&&'){i+=2; const b=cmp(); v=+(v&&b);} else if(s.substr(i,2)==='||'){i+=2; const b=cmp(); v=+(v||b);} else return v; } }
  function ternary(){ const c=and(); ws(); if(s[i]==='?'){ i++; const a=ternary(); ws(); if(s[i]!==':') throw new MathErr('manca :'); i++; const b=ternary(); return c?a:b; } return c; }
  const v = ternary(); ws();
  if (i < s.length) throw new MathErr('testo in eccesso «'+s.slice(i,i+10)+'»');
  return v;
}
function evalLen(src, vars, defUnit=1){
  // lunghezza: numeri senza unità → defUnit (cm per coordinate, pt per line width ecc.)
  const o={}; const v = evalExpr(src, vars, o);
  return o.hadUnit ? v : v*defUnit;
}

/* ---------- divisione testo bilanciata ---------- */
function splitTop(str, sep=','){
  const out=[]; let d=0, cur='', dollar=false;
  for (let k=0;k<str.length;k++){
    const c=str[k];
    if (c==='\\' && k+1<str.length){ cur+=c+str[++k]; continue; }
    if (c==='$') dollar=!dollar;
    if (c==='{'||c==='('||c==='[') d++;
    else if (c==='}'||c===')'||c===']') d--;
    if (c===sep && d===0 && !dollar){ out.push(cur); cur=''; } else cur+=c;
  }
  out.push(cur);
  return out;
}
const unbrace = s => { s=s.trim(); while(s[0]==='{' && matchClose(s,0)===s.length-1) s=s.slice(1,-1).trim(); return s; };
function matchClose(s, k){
  const o=s[k], c={'{':'}','(':')','[':']'}[o]; let d=0;
  for (let j=k;j<s.length;j++){
    if (s[j]==='\\'){ j++; continue; }
    if (s[j]===o) d++; else if (s[j]===c){ d--; if(!d) return j; }
  }
  return -1;
}
/* opzioni [k=v, ...] → lista di {k,v} (con espansione di stili) */
function parseOptList(text){
  const out=[];
  for (let it of splitTop(text)){
    it = it.trim(); if (!it) continue;
    let eq=-1, d=0;
    for (let k=0;k<it.length;k++){ const c=it[k]; if('{(['.includes(c))d++; else if('})]'.includes(c))d--; else if(c==='='&&d===0){eq=k;break;} }
    if (eq<0) out.push({k:it.replace(/\s+/g,' '), v:null});
    else out.push({k:it.slice(0,eq).trim().replace(/\s+/g,' '), v:unbrace(it.slice(eq+1))});
  }
  return out;
}
const subVars = (txt, vars) => !vars ? txt : txt.replace(/\\([a-zA-Z@]+)/g, (m,n)=> (n in vars) ? String(vars[n]) : m);

/* ---------- matrici affini [a,b,c,d,e,f]: x'=a x + c y + e, y'=b x + d y + f ---------- */
const M_ID = [1,0,0,1,0,0];
const mMul = (m,n)=>[ m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3], m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5] ];
const mApp = (m,x,y)=>[m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]];
const mLin = (m,x,y)=>[m[0]*x+m[2]*y, m[1]*x+m[3]*y];
const mInv = m=>{ const det=m[0]*m[3]-m[1]*m[2]||1e-12; const a=m[3]/det,b=-m[1]/det,c=-m[2]/det,d=m[0]/det; return [a,b,c,d,-(a*m[4]+c*m[5]),-(b*m[4]+d*m[5])]; };
const mRot = deg=>{ const c=Math.cos(deg*D2R), s=Math.sin(deg*D2R); return [c,s,-s,c,0,0]; };
const mTr = (x,y)=>[1,0,0,1,x,y];
const mSc = (x,y)=>[x,0,0,y,0,0];
const mAngle = m => Math.atan2(m[1],m[0])/D2R;
const mScaleF = m => Math.sqrt(Math.abs(m[0]*m[3]-m[1]*m[2]));

/* frame: sistema di coordinate (affine o assi pgfplots) */
function affineFrame(m){ const inv=mInv(m); return {mat:m, map:(x,y)=>mApp(m,x,y), lin:(x,y)=>mLin(m,x,y), inv:(x,y)=>mApp(inv,x,y), invLin:(x,y)=>mLin(inv,x,y)}; }

/* ---------- geometria ---------- */
const V = { add:(a,b)=>[a[0]+b[0],a[1]+b[1]], sub:(a,b)=>[a[0]-b[0],a[1]-b[1]], mul:(a,k)=>[a[0]*k,a[1]*k],
  len:a=>Math.hypot(a[0],a[1]), lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t], ang:a=>Math.atan2(a[1],a[0])/D2R,
  pol:(deg,r)=>[Math.cos(deg*D2R)*r, Math.sin(deg*D2R)*r], rot:(a,deg)=>{const c=Math.cos(deg*D2R),s=Math.sin(deg*D2R);return [a[0]*c-a[1]*s,a[0]*s+a[1]*c];} };
const bez = (p0,p1,p2,p3,t)=>{ const u=1-t; return [u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0], u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]]; };
const bezD = (p0,p1,p2,p3,t)=>{ const u=1-t; return [3*u*u*(p1[0]-p0[0])+6*u*t*(p2[0]-p1[0])+3*t*t*(p3[0]-p2[0]), 3*u*u*(p1[1]-p0[1])+6*u*t*(p2[1]-p1[1])+3*t*t*(p3[1]-p2[1])]; };
/* arco ellittico in coordinate locali → bezier (lista di [c1,c2,p]) */
function arcBez(cx,cy,rx,ry,a0,a1){
  const out=[]; const n=Math.max(1,Math.ceil(Math.abs(a1-a0)/90)); const da=(a1-a0)/n;
  const k=4/3*Math.tan(da*D2R/4);
  for (let j=0;j<n;j++){
    const t0=(a0+da*j)*D2R, t1=(a0+da*(j+1))*D2R;
    const p0=[cx+rx*Math.cos(t0), cy+ry*Math.sin(t0)], p3=[cx+rx*Math.cos(t1), cy+ry*Math.sin(t1)];
    const c1=[p0[0]-k*rx*Math.sin(t0), p0[1]+k*ry*Math.cos(t0)], c2=[p3[0]+k*rx*Math.sin(t1), p3[1]-k*ry*Math.cos(t1)];
    out.push([c1,c2,p3]);
  }
  return out;
}
/* Catmull-Rom (tension TikZ: 0.5 ≈ 1/6) */
function smoothBez(pts, tension=0.55, closed=false){
  const out=[]; const n=pts.length; if(n<2) return out;
  const g = j => closed ? pts[(j+n)%n] : pts[clamp(j,0,n-1)];
  const f = tension/3;
  const segs = closed ? n : n-1;
  for (let j=0;j<segs;j++){
    const p0=g(j-1),p1=g(j),p2=g(j+1),p3=g(j+2);
    out.push([[p1[0]+(p2[0]-p0[0])*f, p1[1]+(p2[1]-p0[1])*f],[p2[0]-(p3[0]-p1[0])*f, p2[1]-(p3[1]-p1[1])*f], p2]);
  }
  return out;
}
