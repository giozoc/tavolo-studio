/* ============ CATALOGO: strutture e simboli della barra multifunzione ============
   Ogni voce: l = nome breve, t = modello LaTeX (#0 selezione o casella, #? casella), v = anteprima (facoltativa),
   n = nota (pacchetto richiesto ecc.). Solo comandi standard di LaTeX/amsmath/amssymb salvo dove indicato. */
const Catalog = (()=>{
  const S = (title, items, note) => ({title, items, note});
  const I = (l, t, v, n) => ({l, t, v, n});

  const STRUCTS = [
  {id:'frac', l:'Frazione', key:'F', icon:'\\frac{x}{y}', d:'Frazioni in pila, lineari, continue', secs:[
    S('Frazione', [I('In pila','\\frac{#0}{#?}'), I('Lineare','#0/#?'), I('Piccola','\\tfrac{#0}{#?}'), I('Grande (display)','\\dfrac{#0}{#?}'), I('Annidata','\\frac{#0}{\\frac{#?}{#?}}'), I('Al numeratore','\\frac{\\frac{#0}{#?}}{#?}')]),
    S('Frazioni continue', [I('Continua','\\cfrac{#0}{#?+\\cfrac{#?}{#?}}'), I('Continua a tre livelli','a_0+\\cfrac{1}{a_1+\\cfrac{1}{a_2+\\cfrac{1}{#0}}}')]),
    S('Frazioni comuni', [I('Derivata','\\frac{dy}{dx}'), I('Rapporto incrementale','\\frac{\\Delta y}{\\Delta x}'), I('Derivata parziale','\\frac{\\partial y}{\\partial x}'), I('Variazione','\\frac{\\delta y}{\\delta x}'), I('Pi mezzi','\\frac{\\pi}{2}'), I('Un mezzo','\\frac{1}{2}')]),
  ]},
  {id:'script', l:'Indici', key:'E', icon:'e^{x}', d:'Apici, pedici e combinazioni di indici', secs:[
    S('Apici e pedici', [I('Apice','#0^{#?}'), I('Pedice','#0_{#?}'), I('Pedice e apice','#0_{#?}^{#?}'), I('Indici a sinistra','{}_{#?}^{#?}#0'), I('Indici sui quattro lati','{}_{#?}^{#?}#0_{#?}^{#?}'), I('Primo','#0\''), I('Secondo','#0\'\'')]),
    S('Indici comuni', [I('x con pedice n','x_{n}'), I('x al quadrato','x^{2}'), I('Esponenziale complesso','e^{-i\\omega t}'), I('Doppio indice','a_{ij}'), I('Indice con virgola','x_{i,j}'), I('Termine successivo','a_{n+1}'), I('Inversa','#0^{-1}'), I('Trasposta','#0^{\\mathsf{T}}')]),
  ]},
  {id:'rad', l:'Radicale', key:'R', icon:'\\sqrt[n]{x}', d:'Radice quadrata, n-esima, radicali annidati', secs:[
    S('Radicali', [I('Radice quadrata','\\sqrt{#0}'), I('Radice n-esima','\\sqrt[#?]{#0}'), I('Radice cubica','\\sqrt[3]{#0}'), I('Radice quarta','\\sqrt[4]{#0}'), I('Radicale annidato','\\sqrt{#0+\\sqrt{#?}}')]),
    S('Radicali comuni', [I('Formula risolutiva','\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'), I('Ipotenusa','\\sqrt{a^2+b^2}'), I('Norma in tre dimensioni','\\sqrt{x^2+y^2+z^2}')]),
  ]},
  {id:'int', l:'Integrale', key:'I', icon:'\\int_{-x}^{x}', d:'Integrali definiti, indefiniti, multipli e di linea', secs:[
    S('Integrali', [I('Indefinito','\\int #0'), I('Definito','\\int_{#?}^{#?} #0'), I('Con dominio','\\int_{#?} #0'), I('Definito con differenziale','\\int_{#?}^{#?} #0\\,{\\mathrm{d}}#?'), I('Indefinito con differenziale','\\int #0\\,{\\mathrm{d}}#?')]),
    S('Integrali multipli', [I('Doppio','\\iint #0'), I('Doppio su un dominio','\\iint_{#?} #0'), I('Triplo','\\iiint #0'), I('Triplo su un dominio','\\iiint_{#?} #0'), I('Doppio iterato','\\int_{#?}^{#?}\\int_{#?}^{#?} #0\\,{\\mathrm{d}}#?\\,{\\mathrm{d}}#?')]),
    S('Integrali di linea', [I('Di linea','\\oint #0'), I('Su una curva','\\oint_{#?} #0')]),
    S('Differenziali', [I('d x','\\,\\mathrm{d}x'), I('d y','\\,\\mathrm{d}y'), I('d t','\\,\\mathrm{d}t'), I('d generico','\\,{\\mathrm{d}}#0'), I('dx corsivo','\\,dx')]),
  ]},
  {id:'big', l:'Grande operatore', key:'S', icon:'\\sum_{i=0}^{n}', d:'Sommatorie, produttorie, unioni e intersezioni', secs:[
    S('Sommatorie', [I('Sommatoria','\\sum #0'), I('Con limiti','\\sum_{#?}^{#?} #0'), I('Con pedice','\\sum_{#?} #0'), I('Da 1 a n','\\sum_{k=1}^{n} #0'), I('Serie','\\sum_{n=0}^{\\infty} #0'), I('Doppia','\\sum_{i=1}^{m}\\sum_{j=1}^{n} #0')]),
    S('Prodotti e coprodotti', [I('Produttoria','\\prod #0'), I('Produttoria con limiti','\\prod_{#?}^{#?} #0'), I('Produttoria con pedice','\\prod_{#?} #0'), I('Coprodotto','\\coprod_{#?}^{#?} #0')]),
    S('Unioni e intersezioni', [I('Unione','\\bigcup_{#?}^{#?} #0'), I('Intersezione','\\bigcap_{#?}^{#?} #0'), I('Unione con pedice','\\bigcup_{#?} #0'), I('Intersezione con pedice','\\bigcap_{#?} #0')]),
    S('Altri operatori', [I('Somma diretta','\\bigoplus_{#?} #0'), I('Prodotto tensoriale','\\bigotimes_{#?} #0'), I('Disgiunzione','\\bigvee_{#?} #0'), I('Congiunzione','\\bigwedge_{#?} #0'), I('Unione disgiunta','\\bigsqcup_{#?} #0')]),
  ]},
  {id:'brk', l:'Parentesi', key:'P', icon:'\\{()\\}', d:'Parentesi, delimitatori adattivi, binomiali, casi', secs:[
    S('Parentesi', [I('Tonde','(#0)'), I('Quadre','[#0]'), I('Graffe','\\{#0\\}'), I('Angolari','\\langle #0\\rangle'), I('Valore assoluto','|#0|'), I('Norma','\\|#0\\|'), I('Parte intera inferiore','\\lfloor #0\\rfloor'), I('Parte intera superiore','\\lceil #0\\rceil'), I('Intervallo semiaperto','[#0)'), I('Intervallo aperto a sinistra','(#0]')]),
    S('Delimitatori adattivi', [I('Tonde','\\left(#0\\right)'), I('Quadre','\\left[#0\\right]'), I('Graffe','\\left\\{#0\\right\\}'), I('Angolari','\\left\\langle #0\\right\\rangle'), I('Valore assoluto','\\left|#0\\right|'), I('Norma','\\left\\|#0\\right\\|'), I('Valutazione','\\left.#0\\right|_{#?}^{#?}'), I('Graffa a destra','\\left.#0\\right\\}')]),
    S('Con separatore', [I('Insieme per proprietà','\\left\\{#0\\,\\middle|\\,#?\\right\\}'), I('Bra-ket','\\left\\langle #0\\middle|#?\\right\\rangle'), I('Probabilità condizionata','P\\left(#0\\,\\middle|\\,#?\\right)')]),
    S('Binomiali e casi', [I('Coefficiente binomiale','\\binom{#0}{#?}'), I('Binomiale piccolo','\\tbinom{#0}{#?}'), I('Casi','\\begin{cases}#0 & #?\\\\ #? & #?\\end{cases}'), I('Valore assoluto per casi','|x|=\\begin{cases}x & x\\geq 0\\\\ -x & x<0\\end{cases}')]),
  ]},
  {id:'fun', l:'Funzione', key:'U', icon:'\\sin\\theta', d:'Funzioni trigonometriche, logaritmi, derivate', secs:[
    S('Trigonometriche', [I('Seno','\\sin #0'), I('Coseno','\\cos #0'), I('Tangente','\\tan #0'), I('Cotangente','\\cot #0'), I('Secante','\\sec #0'), I('Cosecante','\\csc #0')]),
    S('Inverse e iperboliche', [I('Arcoseno','\\arcsin #0'), I('Arcocoseno','\\arccos #0'), I('Arcotangente','\\arctan #0'), I('Seno iperbolico','\\sinh #0'), I('Coseno iperbolico','\\cosh #0'), I('Tangente iperbolica','\\tanh #0'), I('Seno alla −1','\\sin^{-1} #0'), I('Seno al quadrato','\\sin^{2} #0')]),
    S('Esponenziali e logaritmi', [I('Logaritmo','\\log #0'), I('Logaritmo in base','\\log_{#?} #0'), I('Logaritmo naturale','\\ln #0'), I('Esponenziale','\\exp #0'), I('e alla','e^{#0}')]),
    S('Derivate', [I('Derivata di','\\frac{\\mathrm{d}}{{\\mathrm{d}}#?}#0'), I('Derivata','\\frac{{\\mathrm{d}}#0}{{\\mathrm{d}}#?}'), I('Derivata n-esima','\\frac{\\mathrm{d}^{#?}#0}{{\\mathrm{d}}#?^{#?}}'), I('Parziale','\\frac{\\partial #0}{\\partial #?}'), I('Parziale seconda','\\frac{\\partial^2 #0}{\\partial #?^2}'), I('Parziale mista','\\frac{\\partial^2 #0}{\\partial #?\\,\\partial #?}'), I('Punto (tempo)','\\dot{#0}'), I('Gradiente','\\nabla #0'), I('Divergenza','\\nabla\\cdot #0'), I('Rotore','\\nabla\\times #0'), I('Laplaciano','\\nabla^2 #0')]),
    S('Altre funzioni', [I('Massimo','\\max_{#?} #0'), I('Minimo','\\min_{#?} #0'), I('Estremo superiore','\\sup_{#?} #0'), I('Estremo inferiore','\\inf_{#?} #0'), I('Determinante','\\det #0'), I('Massimo comun divisore','\\gcd(#0)'), I('Argomento','\\arg #0'), I('Operatore personalizzato','\\operatorname{#0}')], 'Operatore personalizzato: \\operatorname richiede amsmath.'),
  ]},
  {id:'acc', l:'Accento', key:'A', icon:'\\ddot{a}', d:'Vettori, cappelli, barre, graffe e annotazioni', secs:[
    S('Accenti', [I('Punto','\\dot{#0}'), I('Due punti','\\ddot{#0}'), I('Tre punti','\\dddot{#0}'), I('Cappello','\\hat{#0}'), I('Pipa','\\check{#0}'), I('Tilde','\\tilde{#0}'), I('Barra','\\bar{#0}'), I('Vettore','\\vec{#0}'), I('Acuto','\\acute{#0}'), I('Grave','\\grave{#0}'), I('Breve','\\breve{#0}'), I('Anello','\\mathring{#0}')]),
    S('Accenti estesi', [I('Cappello largo','\\widehat{#0}'), I('Tilde larga','\\widetilde{#0}'), I('Sopralineato','\\overline{#0}'), I('Sottolineato','\\underline{#0}'), I('Freccia sopra','\\overrightarrow{#0}'), I('Freccia a sinistra','\\overleftarrow{#0}'), I('Freccia doppia','\\overleftrightarrow{#0}'), I('Freccia sotto','\\underrightarrow{#0}')]),
    S('Graffe e annotazioni', [I('Graffa sopra','\\overbrace{#0}^{#?}'), I('Graffa sotto','\\underbrace{#0}_{#?}'), I('Simbolo sopra','\\overset{#?}{#0}'), I('Simbolo sotto','\\underset{#?}{#0}'), I('In un riquadro','\\boxed{#0}'), I('Barrato','\\cancel{#0}')], 'Barrato: richiede \\usepackage{cancel}.'),
  ]},
  {id:'lim', l:'Limite e log', key:'L', icon:'\\lim_{n\\to\\infty}', d:'Limiti con variabile, punto e direzione', secs:[
    S('Limiti', [I('Limite','\\lim_{#?\\to #?} #0'), I('Per x che tende a 0','\\lim_{x\\to 0} #0'), I('Per x che tende a infinito','\\lim_{x\\to\\infty} #0'), I('Per n che tende a infinito','\\lim_{n\\to\\infty} #0'), I('Da destra','\\lim_{x\\to #?^{+}} #0'), I('Da sinistra','\\lim_{x\\to #?^{-}} #0'), I('Limite generico','\\lim_{#?} #0')]),
    S('Limiti superiore e inferiore', [I('Limite superiore','\\limsup_{#?} #0'), I('Limite inferiore','\\liminf_{#?} #0')]),
    S('Limiti comuni', [I('Definizione di derivata','\\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}'), I('Numero di Nepero','\\lim_{n\\to\\infty}\\left(1+\\frac{1}{n}\\right)^{n}'), I('Limite notevole','\\lim_{x\\to 0}\\frac{\\sin x}{x}=1'), I('Logaritmo in base 2','\\log_{2} #0')]),
  ]},
  {id:'op', l:'Operatore', key:'O', icon:'\\overset{\\Delta}{=}', d:'Operatori con annotazioni e frecce estensibili', secs:[
    S('Uguaglianze annotate', [I('Uguale per definizione','\\overset{\\text{def}}{=}'), I('Uguale con delta','\\overset{\\Delta}{=}'), I('Uguale con nota','\\overset{#?}{=}'), I('Definito come','\\coloneqq'), I('Circa uguale','\\approx'), I('Congruo modulo','#0\\equiv #?\\pmod{#?}')], 'Definito come (\\coloneqq) richiede \\usepackage{mathtools}.'),
    S('Frecce estensibili', [I('Freccia con nota','\\xrightarrow{#0}'), I('Freccia a sinistra','\\xleftarrow{#0}'), I('Note sopra e sotto','\\xrightarrow[#?]{#0}'), I('Freccia lunga con nota','\\overset{#0}{\\longrightarrow}'), I('Nota sotto','\\underset{#0}{\\longrightarrow}'), I('Tende a','\\xrightarrow{#0\\to #?}')]),
  ]},
  {id:'mat', l:'Matrice', key:'M', icon:'\\begin{bmatrix}1&0\\\\0&1\\end{bmatrix}', d:'Matrici, determinanti, sistemi e array', custom:true, secs:[
    S('Matrici vuote', [I('1×2','\\begin{matrix}#0 & #?\\end{matrix}'), I('2×1','\\begin{matrix}#0\\\\ #?\\end{matrix}'), I('1×3','\\begin{matrix}#0 & #? & #?\\end{matrix}'), I('3×1','\\begin{matrix}#0\\\\ #?\\\\ #?\\end{matrix}'), I('2×2','\\begin{matrix}#0 & #?\\\\ #? & #?\\end{matrix}'), I('3×3','\\begin{matrix}#0 & #? & #?\\\\ #? & #? & #?\\\\ #? & #? & #?\\end{matrix}')]),
    S('Con parentesi', [I('Tonde 2×2','\\begin{pmatrix}#0 & #?\\\\ #? & #?\\end{pmatrix}'), I('Quadre 2×2','\\begin{bmatrix}#0 & #?\\\\ #? & #?\\end{bmatrix}'), I('Graffe 2×2','\\begin{Bmatrix}#0 & #?\\\\ #? & #?\\end{Bmatrix}'), I('Determinante 2×2','\\begin{vmatrix}#0 & #?\\\\ #? & #?\\end{vmatrix}'), I('Norma 2×2','\\begin{Vmatrix}#0 & #?\\\\ #? & #?\\end{Vmatrix}'), I('Tonde 3×3','\\begin{pmatrix}#0 & #? & #?\\\\ #? & #? & #?\\\\ #? & #? & #?\\end{pmatrix}'), I('Quadre 3×3','\\begin{bmatrix}#0 & #? & #?\\\\ #? & #? & #?\\\\ #? & #? & #?\\end{bmatrix}'), I('Determinante 3×3','\\begin{vmatrix}#0 & #? & #?\\\\ #? & #? & #?\\\\ #? & #? & #?\\end{vmatrix}'), I('Vettore colonna','\\begin{pmatrix}#0\\\\ #?\\\\ #?\\end{pmatrix}')]),
    S('Puntini', [I('In riga','\\cdots'), I('Sulla base','\\ldots'), I('Verticali','\\vdots'), I('Diagonali','\\ddots')]),
    S('Matrici notevoli', [I('Identità 2×2','\\begin{pmatrix}1 & 0\\\\ 0 & 1\\end{pmatrix}'), I('Identità 3×3','\\begin{pmatrix}1 & 0 & 0\\\\ 0 & 1 & 0\\\\ 0 & 0 & 1\\end{pmatrix}'), I('Matrice m×n','\\begin{pmatrix}a_{11} & \\cdots & a_{1n}\\\\ \\vdots & \\ddots & \\vdots\\\\ a_{m1} & \\cdots & a_{mn}\\end{pmatrix}')]),
    S('Sistemi ed equazioni', [I('Sistema di 2 equazioni','\\begin{cases}#0\\\\ #?\\end{cases}'), I('Sistema di 3 equazioni','\\begin{cases}#0\\\\ #?\\\\ #?\\end{cases}'), I('Sistema allineato','\\left\\{\\begin{aligned}#0 &= #?\\\\ #? &= #?\\end{aligned}\\right.'), I('Passaggi allineati','\\begin{aligned}#0 &= #?\\\\ &= #?\\end{aligned}'), I('Array 2×2','\\begin{array}{cc}#0 & #?\\\\ #? & #?\\end{array}')]),
  ]},
  ];

  /* simboli: [comando, nome] — il comando è anche il testo inserito */
  const SYMS = [
  {id:'greek', l:'Lettere greche minuscole', s:[['\\alpha','alfa'],['\\beta','beta'],['\\gamma','gamma'],['\\delta','delta'],['\\epsilon','epsilon'],['\\varepsilon','epsilon variante'],['\\zeta','zeta'],['\\eta','eta'],['\\theta','theta'],['\\vartheta','theta variante'],['\\iota','iota'],['\\kappa','kappa'],['\\lambda','lambda'],['\\mu','mu'],['\\nu','nu'],['\\xi','xi'],['\\pi','pi'],['\\varpi','pi variante'],['\\rho','rho'],['\\varrho','rho variante'],['\\sigma','sigma'],['\\varsigma','sigma finale'],['\\tau','tau'],['\\upsilon','upsilon'],['\\phi','phi'],['\\varphi','phi variante'],['\\chi','chi'],['\\psi','psi'],['\\omega','omega']]},
  {id:'Greek', l:'Lettere greche maiuscole', s:[['\\Gamma','Gamma'],['\\Delta','Delta'],['\\Theta','Theta'],['\\Lambda','Lambda'],['\\Xi','Xi'],['\\Pi','Pi'],['\\Sigma','Sigma'],['\\Upsilon','Upsilon'],['\\Phi','Phi'],['\\Psi','Psi'],['\\Omega','Omega']]},
  {id:'ops', l:'Operatori', s:[['+','più'],['-','meno'],['\\pm','più o meno'],['\\mp','meno o più'],['\\times','per'],['\\div','diviso'],['\\cdot','punto (prodotto)'],['\\ast','asterisco'],['\\star','stella'],['\\circ','composizione'],['\\bullet','pallino'],['\\oplus','somma diretta'],['\\ominus','meno cerchiato'],['\\otimes','prodotto tensoriale'],['\\oslash','barra cerchiata'],['\\odot','punto cerchiato'],['\\cap','intersezione'],['\\cup','unione'],['\\setminus','differenza'],['\\wedge','e logico'],['\\vee','o logico'],['\\sqcap','intersezione quadra'],['\\sqcup','unione quadra'],['\\dagger','croce'],['\\ddagger','doppia croce'],['\\wr','prodotto intrecciato'],['\\amalg','amalgama']]},
  {id:'rel', l:'Relazioni', s:[['=','uguale'],['\\neq','diverso'],['<','minore'],['>','maggiore'],['\\leq','minore o uguale'],['\\geq','maggiore o uguale'],['\\leqslant','minore o uguale (obliquo)'],['\\geqslant','maggiore o uguale (obliquo)'],['\\ll','molto minore'],['\\gg','molto maggiore'],['\\approx','circa uguale'],['\\sim','simile'],['\\simeq','asintoticamente uguale'],['\\cong','congruente'],['\\equiv','identico'],['\\propto','proporzionale'],['\\doteq','tende a'],['\\asymp','equivalente'],['\\prec','precede'],['\\succ','segue'],['\\preceq','precede o uguale'],['\\succeq','segue o uguale'],['\\parallel','parallelo'],['\\perp','perpendicolare'],['\\mid','divide'],['\\nmid','non divide'],['\\models','modella'],['\\vdash','deriva'],['\\dashv','deriva a sinistra']]},
  {id:'arr', l:'Frecce', s:[['\\to','tende a'],['\\gets','freccia a sinistra'],['\\leftrightarrow','freccia doppia'],['\\Rightarrow','implica'],['\\Leftarrow','è implicato'],['\\Leftrightarrow','se e solo se'],['\\longrightarrow','freccia lunga'],['\\longleftarrow','freccia lunga a sinistra'],['\\Longrightarrow','implica (lunga)'],['\\Longleftrightarrow','equivale (lunga)'],['\\mapsto','associa'],['\\longmapsto','associa (lunga)'],['\\uparrow','su'],['\\downarrow','giù'],['\\updownarrow','su e giù'],['\\Uparrow','doppia su'],['\\Downarrow','doppia giù'],['\\nearrow','nord-est'],['\\searrow','sud-est'],['\\swarrow','sud-ovest'],['\\nwarrow','nord-ovest'],['\\hookrightarrow','inclusione'],['\\hookleftarrow','uncino a sinistra'],['\\rightharpoonup','arpione'],['\\rightleftharpoons','equilibrio'],['\\twoheadrightarrow','suriezione'],['\\rightarrowtail','iniezione']]},
  {id:'logic', l:'Logica', s:[['\\forall','per ogni'],['\\exists','esiste'],['\\nexists','non esiste'],['\\neg','non'],['\\land','e'],['\\lor','o'],['\\implies','implica'],['\\impliedby','è implicato'],['\\iff','se e solo se'],['\\top','vero'],['\\bot','falso'],['\\therefore','quindi'],['\\because','poiché'],['\\vdash','deriva'],['\\models','modella'],['\\square','quadrato (fine)'],['\\blacksquare','q.e.d.']]},
  {id:'sets', l:'Insiemi', s:[['\\in','appartiene'],['\\notin','non appartiene'],['\\ni','contiene'],['\\subset','sottoinsieme'],['\\supset','sovrainsieme'],['\\subseteq','sottoinsieme o uguale'],['\\supseteq','sovrainsieme o uguale'],['\\subsetneq','sottoinsieme proprio'],['\\supsetneq','sovrainsieme proprio'],['\\cup','unione'],['\\cap','intersezione'],['\\setminus','differenza'],['\\emptyset','insieme vuoto'],['\\varnothing','insieme vuoto (variante)'],['\\complement','complementare'],['\\mathbb{N}','naturali'],['\\mathbb{Z}','interi'],['\\mathbb{Q}','razionali'],['\\mathbb{R}','reali'],['\\mathbb{C}','complessi'],['\\mathcal{P}','insieme delle parti'],['\\aleph','aleph'],['\\times','prodotto cartesiano']]},
  {id:'misc', l:'Varie', s:[['\\infty','infinito'],['\\partial','derivata parziale'],['\\nabla','nabla'],['\\hbar','acca tagliata'],['\\ell','elle corsiva'],['\\Re','parte reale'],['\\Im','parte immaginaria'],['\\wp','p di Weierstrass'],['\\angle','angolo'],['\\measuredangle','angolo misurato'],['\\triangle','triangolo'],['\\prime','primo'],['^{\\circ}','grado'],['\\ldots','puntini'],['\\cdots','puntini centrati'],['\\vdots','puntini verticali'],['\\ddots','puntini diagonali'],['\\checkmark','spunta'],['\\dagger','croce'],['\\S','paragrafo'],['\\clubsuit','fiori'],['\\diamondsuit','quadri'],['\\heartsuit','cuori'],['\\spadesuit','picche'],['\\flat','bemolle'],['\\natural','bequadro'],['\\sharp','diesis']]},
  ];
  /* strumenti a tendina della sezione Strumenti */
  const SPACES = [I('Sottile','\\,','a\\,b'), I('Medio','\\:','a\\:b'), I('Spesso','\\;','a\\;b'), I('Quad','\\quad','a\\quad b'), I('Doppio quad','\\qquad','a\\qquad b'), I('Negativo','\\!','a\\!b'), I('Normale (non divisibile)','~','a~b')];
  /* gli stili di carattere si applicano alla selezione o a ciò che si scrive dopo (come in Word): s = stile MathLive */
  const F = (l, t, v, st) => ({l, t, v, s:st});
  const FONTS = [F('Lavagna (insiemi)','\\mathbb{#0}','\\mathbb{R}',{variant:'double-struck'}), F('Calligrafico','\\mathcal{#0}','\\mathcal{L}',{variant:'calligraphic'}), F('Gotico','\\mathfrak{#0}','\\mathfrak{g}',{variant:'fraktur'}), F('Tondo','\\mathrm{#0}','\\mathrm{d}',{variant:'normal',variantStyle:'up'}), F('Grassetto','\\mathbf{#0}','\\mathbf{v}',{variant:'normal',variantStyle:'bold'}), F('Corsivo matematico','\\mathnormal{#0}','\\mathnormal{ab}',{variant:'normal',variantStyle:'italic'}), F('Senza grazie','\\mathsf{#0}','\\mathsf{A}',{variant:'sans-serif',variantStyle:'up'}), F('Spaziatura fissa','\\mathtt{#0}','\\mathtt{x}',{variant:'monospace'}), F('Testo','\\text{#0}','\\text{se}',{text:true})];

  /* lista per l'autocompletamento: comandi delle strutture e dei simboli, con una descrizione */
  let ac=null;
  function acList(){
    if (ac) return ac;
    const seen=new Map();
    const add=(c, d, ins)=>{ if (!seen.has(c)) seen.set(c, {c, d, ins}); };
    for (const g of SYMS) for (const [cmd,name] of g.s){ const m=/^\\([a-zA-Z]+)$/.exec(cmd); if (m) add(m[1], name, cmd); }
    for (const st of STRUCTS) for (const sec of st.secs) for (const it of sec.items){
      const m=/^\\([a-zA-Z]+)/.exec(it.t); if (!m) continue;
      /* il primo modello di ogni comando con argomenti: \frac → \frac{#0}{#?} */
      const tpl = it.t.startsWith('\\'+m[1]) && /#/.test(it.t) ? it.t.replace(/#0/g,'#?') : '\\'+m[1];
      add(m[1], it.l.toLowerCase(), tpl);
    }
    for (const it of [...FONTS]){ const m=/^\\([a-zA-Z]+)/.exec(it.t); add(m[1], it.l.toLowerCase(), it.t.replace('#0','#?')); }
    const extra = [['begin','ambiente','\\begin{#?}\n  \n\\end{}'],['left','delimitatore adattivo','\\left'],['right','delimitatore adattivo','\\right'],['middle','delimitatore centrale','\\middle'],
      ['quad','spazio quad','\\quad'],['qquad','spazio doppio','\\qquad'],['displaystyle','stile display','\\displaystyle'],['textstyle','stile in linea','\\textstyle'],['label','etichetta','\\label{#?}'],['tag','numero personalizzato','\\tag{#?}'],['nonumber','senza numero','\\nonumber'],['notag','senza numero','\\notag'],['hline','riga orizzontale','\\hline'],['color','colore (xcolor)','\\color{#?}'],['textcolor','testo colorato','\\textcolor{#?}{#?}'],['phantom','spazio invisibile','\\phantom{#?}'],['mathop','operatore','\\mathop{#?}'],['bmod','modulo','\\bmod'],['pmod','modulo tra parentesi','\\pmod{#?}'],['sinh','seno iperbolico','\\sinh'],['ker','nucleo','\\ker'],['dim','dimensione','\\dim'],['deg','grado','\\deg'],['hom','omomorfismi','\\hom'],['Pr','probabilità','\\Pr'],['lg','logaritmo in base 2','\\lg']];
    for (const [c,d,ins] of extra) add(c,d,ins);
    ac=[...seen.values()];
    return ac;
  }
  return {STRUCTS, SYMS, SPACES, FONTS, acList};
})();
