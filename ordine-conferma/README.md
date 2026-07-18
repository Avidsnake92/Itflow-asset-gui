# Ordine + Conferma ritiro (localhost)

Pagina dimostrativa di un ordine con biglietto/voucher e conferma **Sì / No**.
Toccando il biglietto compare la conferma; premendo **Sì** il biglietto viene
segnato come riscattato (linguetta gialla + croce) e appare il messaggio
"ordine completato con successo".

> Questo è un template **tuo/generico**: non riproduce il marchio o i dati di
> nessun servizio reale. Personalizza testi e colori come indicato sotto.

## Avvio in localhost

Nella cartella `ordine-conferma/`:

```bash
# opzione 1 — Python
python3 -m http.server 8080

# opzione 2 — Node
npx serve -l 8080
```

Poi apri: http://localhost:8080

(In alternativa puoi aprire direttamente `index.html` con un doppio clic.)

## Personalizzazione

- **Testi ordine** (nome cliente, numero, articolo, messaggi): blocco
  `CONFIG` in fondo a `index.html`, dentro `<script>`.
- **Colori** (blu, verde, rosa, giallo): variabili `:root { --... }` in cima
  al `<style>`.
- **Font**: Nunito via Google Fonts, con fallback ai font di sistema se offline.

## Flusso

1. Stato iniziale → biglietto attivo (linguetta rosa).
2. Tocca il biglietto → modale "Confermi il ritiro?" con **Sì / No**.
3. **Sì** → biglietto barrato + banner verde di successo.
4. **No** / Esc / clic fuori → chiude senza modifiche.
5. "Torna al menù" → ripristina lo stato iniziale (comodo per le prove).
