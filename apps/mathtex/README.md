# Tavolo MathTeX

[![Demo](https://img.shields.io/badge/demo-online-blue)](https://giozoc.github.io/tavolo-mathtex/)
[![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-blue)](#stack-tecnologico)
[![LaTeX](https://img.shields.io/badge/LaTeX-amsmath%20%7C%20amssymb-blue)](#funzionalità)
[![Licenza](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](#licenza)

![Anteprima di Tavolo MathTeX: il file degli esempi aperto come documento, con la lista delle formule, il codice e la formula sincronizzati](docs/anteprima.png)

---

## Documentazione

Tavolo MathTeX è un **editor visuale di equazioni matematiche in LaTeX** che funziona interamente nel browser, senza installare nulla e senza backend. È il fratello di [Tavolo TikZ](https://github.com/giozoc/tavolo-tikz): stessa interfaccia a due ante, stessa attenzione al codice sorgente, applicate alle formule.

- **Contenuto del repository**:

  * Editor del sorgente LaTeX con evidenziazione, numeri di riga, suggerimenti dei comandi e segnalazione degli errori
  * Formula modificabile con il cursore, basata su [MathLive](https://cortexjs.io/mathlive/)
  * Sincronizzazione bidirezionale che **riscrive solo la parte cambiata** del sorgente
  * Barra multifunzione con strutture e simboli organizzati come nell'editor di equazioni di Word
  * **Documenti interi**: lista delle formule di un file `.tex`, ciascuna modificabile, e salvataggio del file aggiornato
  * **Macro personali** (`\newcommand`, `\DeclareMathOperator`, …) lette dal preambolo e modificabili nella formula
  * Anteprima e verifica indipendente con MathJax
  * Esempi `.tex` compilabili con pdfLaTeX e prove automatiche nel browser

---

## Panoramica del Progetto

Scrivere una formula in LaTeX significa ricordare comandi, contare graffe e ricompilare. Tavolo MathTeX tiene **il codice a sinistra e la formula a destra, sincronizzati nei due sensi**:

- ogni modifica al codice si vede **subito** nella formula
- nella formula si clicca, si sposta il cursore nel numeratore, si seleziona un'espressione, si sostituisce un esponente o si inserisce una struttura dai menu: il codice LaTeX si aggiorna da solo
- la modifica visuale **non riscrive l'intera formula**: commenti, a capo, spazi e grafia del sorgente restano dove sono, e cambia solo il tratto toccato
- il risultato è **LaTeX standard** (amsmath e amssymb), pronto da incollare in articoli, tesi e appunti

L'editor non si ferma alla singola formula. Aprendo una tesi o un articolo, **tutte le formule in display compaiono in una lista laterale**: si sceglie quella da modificare, le modifiche tornano nel punto giusto del file, e alla fine si scarica il documento intero. Le **macro del preambolo** (`\R`, `\norm{v}`, `\sen x`) vengono riconosciute: nella formula si vedono disegnate, nel sorgente restano scritte come le ha scritte l'autore.

> La formula a destra è disegnata da MathLive; l'anteprima sotto è di MathJax e fa da controllo: se compila lì, il codice è LaTeX valido. Per la versione finale conviene comunque compilare con pdfLaTeX.

---

## Funzionalità

**Barra multifunzione** (organizzazione alla Word, aspetto Tavolo)
- *Strumenti*: testo normale, spazi matematici, stili di carattere (`\mathbb`, `\mathcal`, `\mathfrak`, `\mathrm`, `\mathbf`, `\mathsf`, `\mathtt`, …), delimitatori della formula (nessuno, `$…$`, `\[…\]`, `equation`, `equation*`, `align*`, `gather*`), vista display o in linea
- *Simboli*: lettere greche, operatori, relazioni, frecce, logica, insiemi e simboli vari, con galleria completa della categoria
- *Strutture*, ciascuna con una galleria di modelli disegnati:
  frazioni (in pila, lineari, continue, annidate) · indici (apici, pedici, a sinistra) · radicali · integrali (definiti, multipli, di linea, differenziali) · grandi operatori (sommatorie, produttorie, unioni, intersezioni) · parentesi (fisse, adattive, con separatore, binomiali, casi) · funzioni (trigonometriche, logaritmi, derivate) · accenti e annotazioni (vettori, cappelli, graffe, `\overset`, `\boxed`) · limiti · operatori con frecce estensibili · matrici (vuote, con parentesi, determinanti, sistemi, array e **matrice di dimensione a scelta**)
- ogni modello ha caselle da riempire: si passa dall'una all'altra con **Tab**; se c'è una selezione, la struttura la avvolge
- i menu agiscono dove si trova il cursore: nella formula, oppure **direttamente nel codice** se l'ultimo pannello usato è il sorgente

**Editor del codice**
- evidenziazione di comandi, ambienti, numeri, indici, graffe e commenti, con numeri di riga
- **suggerimenti dei comandi** mentre si scrive `\` + lettere (Tab o Invio per completare), comprese le macro personali
- Tab inserisce due spazi, Invio mantiene il rientro della riga
- il tratto riscritto da una modifica visuale si illumina per un istante

**Sorgente sempre disponibile**
- copia del LaTeX con un pulsante e con **Ctrl+Maiusc+C**; dalla finestra *Esporta* anche come `$…$`, `\[…\]`, `equation` o sorgente così com'è
- esportazione come documento `.tex` con i pacchetti necessari (aggiunge `mathtools`, `cancel`, `xcolor`, `bm` quando servono) e le macro nel preambolo, come **SVG**, **PNG** e **MathML**; con un documento aperto, anche il file intero
- annulla e ripeti con **una sola cronologia** per codice e formula; cancella e ripristina
- 18 **esempi** pronti (formula risolutiva, Maxwell con `align*`, sistemi, matrici, Schrödinger con `equation`, …), alcuni con commenti e a capo da conservare

**Documenti interi**
- aprendo un file `.tex` (pulsante *Apri* o trascinandolo sulla pagina), o **incollando nel codice più formule insieme**, le formule in display (`\[…\]`, `$$…$$`, `equation`, `align`, `gather`, `multline`, `flalign`, `displaymath`, con o senza asterisco) compaiono in una **lista laterale** con l'anteprima; quelle commentate restano fuori
- se nel codice di una formula ne compaiono più d'una (LaTeX non le accetta annidate), un messaggio lo segnala e con un clic le divide in voci separate
- un clic su una formula la porta nell'editor; **Alt+PagSu** e **Alt+PagGiù** passano alla precedente e alla successiva
- ogni modifica torna nel documento, nel punto da cui viene la formula, senza toccare il resto del file; le formule cambiate sono segnate con un pallino e contate in alto
- ogni formula ha la sua cronologia di annulla e ripeti
- *Scarica* (o **Ctrl+S**) salva il file intero con le formule aggiornate; chiudendo un documento con modifiche non scaricate, l'editor chiede se scaricarlo prima

**Macro personali**
- le definizioni (`\newcommand`, `\renewcommand`, `\providecommand`, `\DeclareMathOperator` anche con asterisco, `\def` con argomenti `#1…#9`) vengono lette all'apertura del file e passate a MathLive: `\R`, `\norm{v}`, `\sen x` si vedono disegnati nella formula e restano scritti così nel sorgente
- la finestra *Macro* mostra le definizioni riconosciute e permette di scriverle a mano, anche senza aprire un file; il pulsante resta evidenziato finché ce n'è almeno una attiva
- valgono anche per l'anteprima MathJax, per le miniature della lista, per i suggerimenti del codice e per le esportazioni

**Errori senza blocchi**
- graffe non chiuse, `\begin`/`\end` e `\left`/`\right` spaiati, doppi esponenti: sottolineati nel codice, con la riga segnata
- comandi sconosciuti a LaTeX o non modificabili nella formula: segnalati, ma il resto continua a funzionare
- errori di MathJax tradotti in italiano e riportati sul comando che li causa
- clic su un messaggio per andare al punto del sorgente

**Interfaccia**
- tema chiaro e scuro, divisore tra le ante trascinabile, zoom della formula, anteprima MathJax che si può nascondere
- su schermi stretti le ante si impilano: formula in alto, codice sotto, lista delle formule in una striscia scorrevole
- il browser ricorda la formula, il documento aperto, le macro, il tema, lo zoom e le altre preferenze tra una visita e l'altra (in `localStorage`, solo su quel browser)

---

## Stack Tecnologico

- **Linguaggio**: JavaScript (ES2020), senza framework né passaggi di compilazione, come Tavolo TikZ
- **Formula modificabile**: [MathLive](https://cortexjs.io/mathlive/) 0.111.1 (licenza MIT, caricato da CDN)
- **Anteprima e verifica LaTeX**: [MathJax](https://www.mathjax.org/) 3.2.2 (caricato da CDN)
- **Interfaccia**: HTML e CSS ripresi da Tavolo TikZ, con temi chiaro e scuro
- **Pubblicazione**: sito statico, adatto a GitHub Pages

### Perché MathLive

Un editor di formule con cursore, caselle e selezione strutturale è un progetto a sé. MathLive lo offre già, è mantenuto, funziona nel browser senza dipendenze, capisce i modelli con caselle (`\frac{#0}{#?}`) e accetta macro definite dall'utente. Tavolo MathTeX lo usa come **rappresentazione modificabile**, ma non come fonte di verità: la fonte di verità resta il testo del sorgente. Le alternative valutate (scrivere un editor strutturale da zero, oppure un `contenteditable` sopra l'output di MathJax) avrebbero richiesto un parser e un modello della formula propri, che è proprio ciò che si voleva evitare.

---

## Architettura

Tre livelli distinti, sempre separati:

1. **Sorgente** – il testo dell'utente, unica fonte di verità. Non viene mai riscritto per intero se non è indispensabile
2. **Rappresentazione modificabile** – MathLive riceve il *corpo* della formula (i delimitatori come `\begin{align*}` restano nel sorgente e non vengono toccati; per `align*` e `gather*` la formula riceve un `aligned` o `gathered`)
3. **Risultato renderizzato** – MathLive a schermo, MathJax come anteprima e controllo indipendente

### Sincronizzazione

È a senso unico per evento, così non nascono cicli:

- **codice → formula**: a ogni battitura il corpo viene passato a MathLive senza generare eventi
- **formula → codice** (`js/03-sync.js`):
  1. si confrontano le serializzazioni di MathLive prima e dopo la modifica, per isolare i token cambiati
  2. i token del sorgente (senza spazi e commenti) vengono allineati a quelli di MathLive con una LCS: così si sa a quale tratto del sorgente corrisponde la modifica, anche se la grafia è diversa (`\frac12` e `\frac{1}{2}`, `x^{2}` e `x^2`)
  3. si sostituisce solo quel tratto e **si verifica**: il nuovo sorgente, riletto da un secondo campo MathLive nascosto, deve dare esattamente la formula mostrata e non deve avere più errori di sintassi di prima. Se la verifica fallisce si prova un tratto più ampio (il gruppo che contiene la modifica) e, solo come ultima risorsa, si riscrive il corpo
  4. se MathLive produce uno stato che il suo stesso LaTeX non riproduce (per esempio due esponenti sullo stesso simbolo dopo una cancellazione), nel sorgente si scrive la forma valida e la formula viene riallineata, con il cursore nello stesso punto

Quello che si scrive all'inizio della formula va prima del primo simbolo del corpo: a capo, rientro e commenti iniziali restano dove sono (`\begin{equation}` ⏎ `  kE=mc^2`, non `\begin{equation}k`).

Il codice prodotto da MathLive passa da una piccola pulizia perché resti LaTeX standard: `\middle{|}` diventa `\middle|`, `^{\doubleprime}` diventa `''`, `\frac12` diventa `\frac{1}{2}`, e le scorciatoie di MathLive che userebbero comandi suoi (`\differentialD`, `\exponentialE`, …) sono sostituite con quelli standard.

Le caselle vuote (`\placeholder{}` in MathLive) non finiscono mai nel sorgente (`js/02-latex.js`): un argomento vuoto si scrive `{}` (`\frac{}{}`, `x^{}`), una cella vuota di matrice o sistema `{}` e un indice vuoto `[]` (`\sqrt[]{}`), tutto LaTeX valido. Così le righe vuote di un sistema non spariscono alla rilettura e, quando la formula viene ricaricata dal codice, ogni argomento vuoto torna a mostrare la sua casella.

### Documenti e macro

`js/09-document.js` contiene due moduli:

- **`Formulas`** divide il file in testo e formule: `gaps[k]` è il testo prima della formula `k`, `fs[k]` la formula. La formula scelta va nell'editor come un sorgente qualsiasi; ogni cambio torna in `fs[k]`, e il file si ricompone unendo le due liste. Il resto del documento non passa mai dall'editor, quindi non può essere alterato. Ogni voce conserva la propria cronologia, e il documento è salvato nel browser a ogni modifica
- **`Macros`** legge le definizioni con `parseMacros` (`js/02-latex.js`) e le passa a MathLive con l'opzione `macros` e `expand: false`: così la serializzazione della formula riporta `\R` e non `\mathbb{R}`, e la riscrittura minima continua a funzionare. A MathJax le stesse definizioni arrivano come `\newcommand` davanti al testo da disegnare

### Accorgimenti su MathLive

- **Focus immediato**: dopo un clic, MathLive porta il focus sulla formula con un `setTimeout`; i tasti premuti nel frattempo finirebbero nel codice. Il ricevitore dei tasti di MathLive prende il focus già al `pointerdown`
- **Ambienti annidati**: un `align`, `align*`, `displaymath` o `eqnarray` dentro il corpo trasforma la radice di MathLive in quell'ambiente, e la radice resta tale anche per i valori successivi. Alla formula arriva l'equivalente annidabile (`aligned`, `gathered`, `array`), mentre il sorgente resta invariato
- **Rianalisi forzata**: MathLive ignora un valore uguale a quello che ha già; prima di ricaricare la formula dal codice il campo viene svuotato, così la formula riflette sempre il sorgente

---

## Struttura del Repository

```text
tavolo-mathtex/
├── index.html              # pagina principale
├── css/
│   └── style.css           # stile e temi, ripresi da Tavolo TikZ
├── js/
│   ├── 01-core.js          # utilità, modali, tema, divisore, rendering MathJax
│   ├── 02-latex.js         # token, delimitatori, macro, evidenziazione, controlli, modelli, caselle
│   ├── 03-sync.js          # riscrittura minima del sorgente dalla formula
│   ├── 04-editor.js        # editor del codice, cronologia, suggerimenti
│   ├── 05-mathfield.js     # formula modificabile (MathLive) e campo di verifica
│   ├── 06-catalog.js       # strutture e simboli della barra multifunzione
│   ├── 07-ribbon.js        # barra multifunzione e gallerie
│   ├── 08-preview.js       # verifica e anteprima MathJax, messaggi
│   ├── 09-document.js      # macro personali, formule del file aperto
│   └── 10-panel.js         # esportazione, esempi, apertura dei file, scorciatoie, avvio
├── esempi/
│   └── formule.tex         # gli esempi dell'editor, compilabili con pdfLaTeX
├── tests/
│   ├── harness.py          # avvio dell'app in Chromium headless
│   ├── test_ui.py          # scenari con mouse e tastiera
│   ├── test_menus.py       # ogni voce dei menu
│   ├── test_fuzz.py        # modifiche casuali sulla formula
│   ├── test_pdflatex.py    # compilazione con pdfLaTeX
│   └── readme_shot.py      # immagine del README
├── docs/
│   └── anteprima.png       # immagine del README
└── LICENSE
```

I file in `js/` sono script classici caricati in ordine da `index.html`, senza moduli né bundler: ciascuno usa ciò che definiscono i precedenti.

---

## Avvio

**Online**: [giozoc.github.io/tavolo-mathtex](https://giozoc.github.io/tavolo-mathtex/)

**In locale**:

1. Clona il repository ed entra nella cartella.
2. Avvia un server statico e apri il browser su `http://localhost:8000`:

```bash
   python3 -m http.server 8000
```

   Non servono altri passaggi: i file si caricano così come sono (MathLive e MathJax arrivano dal CDN jsDelivr). Funziona anche aprendo direttamente `index.html`.

3. Per pubblicarlo su GitHub Pages basta attivare Pages sul ramo principale, cartella radice.

4. Per confrontare con LaTeX, compila gli esempi:

```bash
   cd esempi
   pdflatex formule.tex
```

---

## Prove automatiche

Le prove usano Playwright con Chromium e si eseguono dalla cartella `tests`:

```bash
pip install playwright && playwright install chromium
cd tests
python test_ui.py          # facoltativo: percorso dello screenshot finale (predefinito ui.png)
python test_menus.py
python test_fuzz.py        # facoltativi: passi per formula e numero di semi casuali (predefiniti 40 e 3)
python test_pdflatex.py    # richiede pdflatex nel PATH
python readme_shot.py ../docs/anteprima.png
```

| Prova | Cosa controlla |
|---|---|
| `test_ui.py` | scenari reali con mouse e tastiera: frazione da menu e Tab tra le caselle, radice e stile sulla selezione, esponente sostituito, modifiche che lasciano intatti commenti e a capo, annulla e ripeti, inserimento nel codice, errori, `align*`, matrice personalizzata, matrici a una colonna e sistemi (le righe vuote restano), caselle per gli argomenti vuoti scritti nel codice, delimitatori, esportazione, documenti interi (lista, modifiche riscritte nel file, cronologia per formula, Alt+PagGiù), macro del preambolo e scritte a mano, tasti premuti subito dopo il clic, scrittura all'inizio di una formula con `\label`, più formule incollate insieme, `align*` annidato |
| `test_menus.py` | ogni voce dei menu (oltre 400) inserita in una formula vuota: deve dare LaTeX che MathJax compila e MathLive rilegge senza errori |
| `test_fuzz.py` | migliaia di modifiche casuali sulla formula, su formule semplici, annidate, con commenti e delimitatori: il sorgente deve sempre corrispondere alla formula, restare valido e cambiare solo dove serve |
| `test_pdflatex.py` | compila con pdfLaTeX tutto ciò che l'editor produce (menu, esempi, formule modificate a caso) |

Ultimo risultato: 58/58 scenari superati; 420 voci di menu valide; su circa 1400 modifiche casuali il 98% riscrive solo il tratto cambiato (in media il 3,2% del testo), con zero incoerenze tra codice e formula e zero sorgenti resi non validi; 446 formule su 446 compilano con pdfLaTeX.

Le prove premono «seleziona tutto» con `ControlOrMeta+a`, che su macOS diventa Cmd+A: in MathLive, Ctrl+A su Mac porta il cursore a inizio riga. Senza rete, la variabile `LOCAL_LIBS` può puntare a una cartella `node_modules` con `mathlive` e `mathjax`.

---

## Scorciatoie

Su Mac, Ctrl corrisponde a Cmd.

| Tasto | Azione |
|---|---|
| Ctrl+Z / Ctrl+Y (o Ctrl+Maiusc+Z) | Annulla / Ripeti (codice e formula condividono la cronologia; con un documento aperto, una per formula) |
| Ctrl+Maiusc+C | Copia il codice LaTeX |
| Ctrl+S | Scarica la formula come documento `.tex`; con un file aperto, il file intero con le formule aggiornate |
| Alt+PagSu / Alt+PagGiù | Formula precedente / successiva del file aperto |
| Alt+F · Alt+E · Alt+R · Alt+I · Alt+S | Frazione · Indici · Radicale · Integrale · Grande operatore |
| Alt+P · Alt+U · Alt+A · Alt+L · Alt+O · Alt+M | Parentesi · Funzione · Accento · Limite · Operatore · Matrice |
| Alt+T · Alt+G | Testo normale · Tutti i simboli |
| Esc | Chiude la galleria o la finestra aperta |
| F1 | Elenco delle scorciatoie |

**Nella formula**

| Tasto | Azione |
|---|---|
| Tab / Maiusc+Tab | Casella successiva / precedente |
| Frecce · Maiusc+frecce | Muove il cursore nella struttura · seleziona (poi una struttura dalla barra avvolge la selezione) |
| `/` `^` `_` | Frazione, apice, pedice mentre si scrive |
| `\` + comando + Invio | Scrive un comando LaTeX direttamente |
| `sqrt` `int` `sum` `pi` `infty` | Scorciatoie testuali: diventano √, ∫, Σ, π, ∞ |

**Nel codice**

| Tasto | Azione |
|---|---|
| `\` + lettere | Suggerimenti dei comandi (frecce per scegliere, Tab o Invio per completare) |
| Tab · Invio | Due spazi · a capo con lo stesso rientro |
| Clic su un messaggio | Porta all'errore nel sorgente |

---

## Limiti Noti

- La lista di un documento comprende le formule in display; quelle in linea (`$…$`, `\(…\)`) restano nel testo del file.
- Negli ambienti `align*` e `gather*` la formula viene mostrata come un unico `aligned`/`gathered`; `\label` e `\nonumber` restano nel sorgente ma non si modificano visivamente.
- Le macro personali compaiono nella formula come un blocco unico: si spostano e si cancellano, ma i loro argomenti si cambiano nel codice. Una macro con argomento facoltativo (`\newcommand{\x}[2][0]{…}`) vale solo per l'anteprima MathJax.
- Una macro tolta dalla finestra *Macro* resta nota a MathJax fino al ricaricamento della pagina: l'anteprima può ancora compilarla.
- I comandi di pacchetti che MathLive non conosce, e che non sono definiti come macro, restano nel sorgente e vengono segnalati, ma nella formula appaiono come testo da non modificare.
- Alcune grafie compatte di MathLive (`x^2` al posto di `x^{2}`) compaiono nelle parti scritte dalla formula; il resto del sorgente mantiene la grafia originale.
- Formula, documento e macro sono conservati solo nel browser in uso: per non perdere il lavoro conviene scaricare il file.

---

## Ringraziamenti

Interfaccia e impostazione tecnica riprese da [Tavolo TikZ](https://github.com/giozoc/tavolo-tikz). Modifica delle formule con [MathLive](https://github.com/arnog/mathlive) di Arno Gourdol (MIT); anteprima con [MathJax](https://www.mathjax.org/).

---

## Licenza

Questo progetto è distribuito sotto licenza **GNU GPL v3.0**, come Tavolo TikZ.
