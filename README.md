# Processo all'AI — voto live + Word Cloud (v2)

Web-app per GitHub Pages + Firebase Firestore. Un unico link/QR per i partecipanti: la pagina resta aperta e segue automaticamente la domanda impostata dalla Regia.

## Funzioni
- scelta/voto con risultati live;
- Word Cloud con una parola/breve espressione per partecipante e tornata;
- apertura/chiusura dalla Regia;
- stesso QR per tutto l'evento;
- nessun account richiesto al partecipante;
- identificativo anonimo locale nel browser.

## Configurazione
1. Crea un progetto Firebase separato dall'app Orto.
2. Attiva Firestore Database.
3. Registra una Web App e copia i parametri in `firebase-config.js`.
4. Pubblica questi file in un repository GitHub con GitHub Pages.
5. Apri `admin.html`; il link partecipanti mostrato in fondo è quello da trasformare in QR.

## Importante prima dell'evento
Le regole Firestore incluse nella v1 erano volutamente demo (`allow write: if true`). Prima dell'uso reale va protetta la Regia e vanno applicate regole/API più robuste per impedire manipolazioni. La protezione anti-doppio invio attuale è adeguata per una prova, non è una garanzia antifrode.
