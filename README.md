# METER – v4 storico votazioni

Questa versione aggiunge uno storico persistente delle tornate in Firestore.

## Novità
- Ogni clic su **Apri** crea una nuova tornata con `roundId` univoco.
- La tornata viene salvata in `sessions/{sessionId}/rounds/{roundId}`.
- Per i voti a scelta, conteggi e totale vengono aggiornati anche nello storico in tempo reale.
- Con **Chiudi** vengono congelati stato, risultati e data/ora.
- Per Word Cloud, alla chiusura vengono salvate anche frequenze delle parole e numero contributi.
- La Regia mostra la sezione **Storico votazioni** con risultati e timestamp.
- **Azzera risposte** non cancella più le tornate precedenti: archivia quella corrente come "AZZERATA" e avvia una nuova tornata vuota.

## File da aggiornare su GitHub
- `admin.html`
- `admin.js`
- `participant.js`
- `style.css`

Gli altri file possono restare invariati.


## Word Cloud v5
- Aggiornamento live in Regia e sullo Schermo tramite listener Firestore.
- Una risposta per dispositivo per tornata.
- Parole uguali accorpate senza distinzione maiuscole/minuscole.
- Dimensione proporzionale alla frequenza.
- Enter invia la parola dal telefono.
- Storico conserva frequenze e totale contributi.

## v6 — Scaletta evento
La Regia contiene ora una Scaletta persistente in Firebase. Puoi aggiungere l'interazione corrente, riordinare le voci, caricarle per modificarle e aprirle direttamente durante l'evento. La scaletta è salvata nella sottoraccolta `sessions/{sessionId}/agenda`.


## v6.1 — Correzione Scaletta
- Corretto un bug che interrompeva il listener Firebase della scaletta in alcune condizioni.
- Aggiunto feedback visibile di salvataggio/errore.
- Cache busting su `admin.js` e `style.css` per evitare che GitHub Pages/browser usino la versione precedente.
