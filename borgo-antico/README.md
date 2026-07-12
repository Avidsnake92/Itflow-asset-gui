# 🏰 Borgo Antico

Un city builder medievale **rilassante** per iPhone, ispirato a *Civitas Nordica / Northlands* con un tocco di *Black & White 2*. Niente fretta, niente game over: costruisci, evolvi, compi miracoli e goditi il tramonto sul tuo borgo.

È una web app (PWA): gira direttamente in Safari su iPhone, si installa sulla schermata Home e funziona anche offline. Nessuna dipendenza, nessun asset esterno: solo HTML, CSS e JavaScript puro.

## ✨ Caratteristiche

- 🎨 **Pixel art procedurale**: terreni con dithering, edifici isometrici disegnati pixel per pixel (intonaco e travi a vista, tetti di paglia e ardesia), alberi, massi e tende nemiche — nessuna immagine esterna, tutto generato dal codice
- 🗺️ **Mappa isometrica procedurale** con boschi, laghi, rocce e terre fertili (ogni partita è diversa)
- 🔨 **21 edifici**: case, fattorie, taglialegna, cave, mulini, panifici, segherie, botteghe, mercati, taverne, chiese, torri, caserme, castello, cattedrale...
- ⚒️ **Mestieri con esperienza** (alla Cultures): contadini, boscaioli e cavatori guadagnano XP lavorando; ogni livello dà +15% di produzione alla catena e sblocca nuove lavorazioni:
  - 🌾 Contadino: grano → **Mulino** (farina) → **Panificio** (pane, nutre ×3)
  - 🪓 Boscaiolo: legna → **Segheria** (assi) → **Falegname** (mobili per la felicità o archi per i soldati, a tua scelta)
  - ⛏️ Cavatore: pietra → **Scalpellino** (blocchi da costruzione) → **Scultore** (opere vendute a caro prezzo)
- 🚶 **Vita nel borgo**: villici che passeggiano tra gli edifici, pecore e mucche al pascolo
- 🧭 **Nebbia di guerra ed esplorazione**: la mappa parte ignota; manda l'esploratore a scoprire il territorio (e i nascondigli dei nemici). Edifici e torri diradano la nebbia
- 💧 **Economia profonda** (dalla guida di Cultures): il pozzo dà l'acqua per panificio e birrificio; pescatore, apiario→miele→idromele (felicità), allevamento→pelle→calzolaio→scarpe (lavoratori più veloci), miniera→ferro→fabbro (armi migliori o attrezzi che potenziano tutti), scuola (+50% esperienza) e magazzino (logistica: +10% ai vicini)
- 👑 **Evoluzione della civiltà** in 5 ere, tutte medievali: Accampamento → Villaggio → Borgo → Città Medievale → Regno
- 🙏 **Miracoli divini** (stile Black & White): benedici i raccolti, invoca la pioggia, proteggi il borgo con uno scudo divino o scaglia fulmini sui nemici — tutto alimentato dalla **Fede** generata da cappelle e chiese
- ⚔️ **Accampamenti nemici** ai confini: crescono lentamente, ogni tanto tentano una razzia (con largo preavviso). Difenditi con torri e soldati, oppure attaccali e saccheggiali. Se perdi una razzia perdi solo qualche scorta: **non si può mai perdere davvero**
- 🌅 **Obiettivo finale chill**: raggiungi il Regno, costruisci la Cattedrale e pacifica la mappa per l'*Età dell'Oro* (e poi continua a costruire quanto vuoi)
- 🌙 Ciclo giorno/notte, finestre che si accendono, fumo dai camini, uccellini di passaggio
- 💾 Salvataggio automatico ogni 10 secondi (localStorage)
- 👆 Controlli touch nativi: trascina per muoverti, pizzica per lo zoom, tocca per costruire

## 📱 Come giocarci su iPhone

Il modo più semplice è **GitHub Pages**:

1. Su GitHub: *Settings → Pages → Source: Deploy from a branch*, scegli il branch e la cartella root
2. Apri `https://<tuo-utente>.github.io/<repo>/borgo-antico/` in **Safari** sull'iPhone
3. Tocca **Condividi → Aggiungi a schermata Home**
4. Avvia il gioco dall'icona: parte a schermo intero, come un'app nativa, e funziona anche offline ✈️

In alternativa, per provarlo al volo in locale (iPhone e computer sulla stessa rete Wi-Fi):

```bash
cd borgo-antico
python3 -m http.server 8080
# poi su Safari: http://<ip-del-computer>:8080
```

> Nota: il salvataggio usa localStorage, quindi resta legato al browser/app con cui giochi.

## 🎮 Guida rapida

| Cosa | Come |
|---|---|
| Muovere la camera | Trascina con un dito |
| Zoom | Pizzica con due dita |
| Costruire | 🔨 Costruisci → scegli edificio → tocca la mappa → ✓ |
| Evolvere era | 👑 Regno → *Evolvi* (servono popolazione e risorse) |
| Miracoli | 🙏 Miracoli (serve ✨ Fede dalle cappelle) |
| Reclutare soldati | Costruisci una caserma, poi 👑 Regno → *Recluta* |
| Attaccare i nemici | Tocca un accampamento ⛺ sulla mappa → *Attacca* |

Consigli da Signore del Borgo: piazza i taglialegna **accanto ai boschi**, le cave **accanto alle rocce**, le fattorie **su terra fertile** (verde chiaro) e vicino a un mulino. E ogni tanto... fermati a guardare il tramonto. 🌇

## 🍎 E l'App Store?

Il gioco è pensato per essere impacchettato con [Capacitor](https://capacitorjs.com/) quando vorrai una vera app nativa: `npx cap add ios` con questa cartella come `webDir` e il gioco gira in un progetto Xcode senza modifiche al codice.

## 🗂️ Struttura

```
borgo-antico/
├── index.html            # struttura pagina e UI
├── css/style.css         # stile (dark, touch-friendly, safe-area iOS)
├── js/config.js          # dati: edifici, ere, miracoli, nemici
├── js/world.js           # generazione procedurale della mappa
├── js/sprites.js         # sprite pixel art generati proceduralmente
├── js/game.js            # stato, economia, combattimento, salvataggio
├── js/render.js          # rendering isometrico su canvas
├── js/input.js           # touch: pan, pinch, tap
├── js/ui.js              # pannelli, toast, modalità costruzione
├── js/main.js            # avvio e game loop
├── sw.js                 # service worker (offline)
└── manifest.webmanifest  # installazione PWA
```
