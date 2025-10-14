# 📖 Guida all'utilizzo di SkipTube AI

## 🎯 Come funziona l'estensione

SkipTube AI analizza i sottotitoli dei video YouTube per identificare automaticamente e saltare:
- 📢 Sponsorizzazioni
- 🎬 Intro/Sigla iniziale
- 🎵 Outro/Sigla finale
- 💰 Ringraziamenti donazioni/Super Chat
- 📣 Autopromozione canale/merchandise

## ⚠️ Requisito importante

**L'estensione funziona SOLO con video che hanno sottotitoli disponibili** (automatici o caricati dall'autore).

Per verificare se un video ha sottotitoli:
1. Apri un video su YouTube
2. Cerca il pulsante "Mostra trascrizione" sotto il video
3. Se il pulsante è presente, l'estensione può funzionare

## 🚀 Utilizzo base

### Primo metodo (Automatico):
1. Apri un video YouTube con sottotitoli
2. L'estensione cercherà automaticamente di aprire il pannello trascrizione
3. Analizza il video e mostra notifiche sui segmenti trovati

### Secondo metodo (Manuale - consigliato):
1. Apri un video YouTube
2. **Clicca manualmente su "Mostra trascrizione"** sotto il video
3. Ricarica la pagina (F5)
4. L'estensione estrarrà i sottotitoli dal pannello aperto

## 🔧 Limitazioni tecniche

### Perché l'API di YouTube non funziona?

YouTube blocca l'accesso diretto all'API dei sottotitoli (`timedtext`) da estensioni del browser per motivi di sicurezza. Anche usando un background service worker, YouTube restituisce risposte vuote (`content-length: 0`).

**Soluzione implementata:** L'estensione estrae i sottotitoli direttamente dal DOM della pagina quando il pannello trascrizione è aperto.

## 📊 Come verificare che funzioni

Apri la console del browser (F12) e cerca questi messaggi:

### ✅ Funzionamento corretto:
```
✓ Pannello già aperto - Estratti 150 segmenti
✓ Trascrizione ottenuta: 150 segmenti
✅ Trovati 3 segmenti da saltare!
```

### ❌ Problemi comuni:

**Nessuna trascrizione disponibile:**
```
⚠️ Nessuna trascrizione disponibile per questo video
```
**Soluzione:** Il video non ha sottotitoli. Prova un altro video.

**Pulsante non trovato:**
```
⚠️ Pulsante trascrizione non trovato nel DOM
```
**Soluzione:** Apri manualmente il pannello trascrizione e ricarica.

## 🎮 Controlli

- **Auto-skip**: Abilitato di default, salta automaticamente i segmenti
- **Preview**: Mostra un'anteprima prima di saltare
- **Annulla**: Clicca "Annulla" nell'anteprima per non saltare

## 🔍 Debug

Per vedere log dettagliati:
1. Apri console browser (F12)
2. Cerca messaggi con emoji (🔍, ✓, ⚠️, ❌)
3. I log mostrano ogni passaggio dell'estrazione

Per vedere log del background service worker:
1. Vai su `chrome://extensions/`
2. Trova "SkipTube AI"
3. Clicca su "service worker"
4. Guarda i log nella console

## 🐛 Problemi noti

1. **L'estensione non funziona su tutti i video** - Solo video con sottotitoli
2. **Primo caricamento lento** - La prima analisi richiede qualche secondo
3. **Cache** - I risultati vengono salvati in cache per velocizzare i caricamenti successivi

## 💡 Consigli

1. **Apri sempre manualmente il pannello trascrizione** per migliori risultati
2. **Aspetta qualche secondo** dopo l'apertura del video
3. **Controlla la console** se qualcosa non funziona
4. **Testa su video popolari italiani** con sottotitoli automatici

## 📝 Nota sullo sviluppo

Questa estensione è in fase di sviluppo attivo. Le limitazioni attuali sono dovute alle restrizioni di sicurezza di YouTube, non a bug del codice.

### Alternative future:
- Integrazione con API ufficiali di YouTube (richiede API key)
- Database condiviso tipo SponsorBlock
- Supporto per analisi IA con Claude/OpenAI (configurazione API necessaria)
