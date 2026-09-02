# Processo all'AI — voto live + Word Cloud (v3)

Web-app per GitHub Pages + Firebase Firestore.

## Novità v3
- Risposte partecipante impilate verticalmente, larghe e ben distanziate.
- Nuova pagina `display.html` dedicata a maxischermo/proiettore.
- Responso con percentuali grandi, numero voti, barre animate ed evidenza del risultato più votato.
- Dalla Regia: pulsante **Apri Schermo** e checkbox **Rivela il responso sullo schermo**.
- Il link partecipante e il link schermo mantengono lo stesso codice sessione.

## Pagine
- `index.html`: partecipanti
- `admin.html`: regia
- `display.html`: schermo/proiettore

## Uso rapido
1. Apri Regia.
2. Configura domanda e opzioni.
3. Premi **Apri**.
4. Apri **Schermo** sul PC collegato al proiettore.
5. Durante la votazione lo schermo mostra “Votazione in corso”.
6. Quando vuoi rivelare il risultato, attiva **Rivela il responso sullo schermo**.

La configurazione Firebase del progetto METER è già inclusa in `firebase-config.js`.
