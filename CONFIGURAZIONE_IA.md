# 🤖 Configurazione IA per SkipTube AI

L'estensione **richiede obbligatoriamente** un'API key Claude o OpenAI per funzionare.

## ⚠️ IMPORTANTE
Senza API configurata, l'estensione **NON funzionerà**. Il sistema pattern-based è stato rimosso.

---

## 🔧 Opzione 1: Claude AI (Consigliato)

### Perché Claude?
- ✅ **Più economico** di OpenAI per questo use case
- ✅ **Context window più grande** (200K tokens vs 128K di GPT-4)
- ✅ **Ottimo con testi italiani**
- ✅ **Haiku è veloce ed economico** (~$0.25 per 1M token input)

### Come ottenere l'API key:

1. Vai su [console.anthropic.com](https://console.anthropic.com/)
2. Crea un account (serve carta di credito)
3. Vai su **Settings → API Keys**
4. Clicca **Create Key**
5. Copia la chiave (inizia con `sk-ant-api03-...`)

### Configurazione:

Apri `background.js` e modifica la riga 5:

```javascript
this.API_KEY = 'sk-ant-api03-TUA_CHIAVE_QUI';
```

**Non modificare** `this.API_ENDPOINT` - è già configurato per Claude.

---

## 🔧 Opzione 2: OpenAI GPT-4

### Come ottenere l'API key:

1. Vai su [platform.openai.com](https://platform.openai.com/)
2. Crea un account
3. Vai su **API keys**
4. Clicca **Create new secret key**
5. Copia la chiave (inizia con `sk-...`)

### Configurazione:

Apri `background.js` e modifica le righe 5-6:

```javascript
this.API_KEY = 'sk-TUA_CHIAVE_OPENAI_QUI';
this.API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
```

E modifica il metodo `analyzeWithAI` (riga ~82):

```javascript
async analyzeWithAI(transcriptText, title, settings) {
  const prompt = this.buildPrompt(transcriptText, title, settings);

  // Per OpenAI GPT-4
  const response = await fetch(this.API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // o 'gpt-4o' per qualità superiore
      max_tokens: 1000,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API Error: ${errorData.error?.message || response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0].message.content;

  // Parsing della risposta
  return this.parseAIResponse(aiResponse);
}
```

---

## 💰 Costi stimati

### Claude (Haiku):
- **Input**: $0.25 per 1M token
- **Output**: $1.25 per 1M token
- **Video tipico** (10 min, ~2000 token): ~$0.0005 - $0.001
- **100 video**: ~$0.05 - $0.10

### OpenAI (GPT-4o-mini):
- **Input**: $0.15 per 1M token
- **Output**: $0.60 per 1M token
- **Video tipico**: ~$0.0003 - $0.0008
- **100 video**: ~$0.03 - $0.08

### OpenAI (GPT-4o):
- **Input**: $2.50 per 1M token
- **Output**: $10.00 per 1M token
- **Video tipico**: ~$0.005 - $0.012
- **100 video**: ~$0.50 - $1.20

**Nota**: I costi sono molto bassi grazie alla cache (ogni video viene analizzato una sola volta).

---

## ✅ Verifica configurazione

Dopo aver configurato l'API:

1. **Ricarica l'estensione** in `chrome://extensions/`
2. **Apri la console del service worker**:
   - Vai su `chrome://extensions/`
   - Trova "SkipTube AI"
   - Clicca su "service worker"
3. **Apri un video YouTube** con sottotitoli
4. **Controlla i log** nella console:

### ✅ Configurazione corretta:
```
🤖 Avvio analisi IA per video: Titolo Video
📝 Trascrizione formattata: 5432 caratteri
✅ Analisi IA completata: 3 segmenti trovati
```

### ❌ API key non configurata:
```
❌ API Key non configurata!
```

### ❌ API key errata:
```
❌ Errore analisi IA: API Error: 401
```

---

## 🔒 Sicurezza

### ⚠️ NON condividere mai la tua API key!

L'API key è visibile nel codice dell'estensione. Se vuoi pubblicarla:

1. **Non includere la key nel repository pubblico**
2. Crea un file `.env` o `config.js` (escluso da git)
3. Oppure chiedi agli utenti di inserire la propria key nelle impostazioni

### Alternativa per distribuzione:

Se vuoi distribuire l'estensione, considera:
- Creare un **backend server** che gestisce le richieste IA
- Gli utenti si collegano al tuo server (con autenticazione)
- Tu paghi l'API centralizzata
- Monetizza con abbonamento/donazioni

---

## 📊 Limiti rate API

### Claude:
- **Tier 1**: 50 richieste/minuto, 40K token/minuto
- Sufficiente per uso personale

### OpenAI:
- **Free tier**: 3 richieste/minuto
- **Tier 1** ($5 spesi): 500 richieste/minuto
- Potrebbero servire rate limits più alti per uso intensivo

---

## 🐛 Troubleshooting

### "API Key non configurata"
→ Hai dimenticato di modificare `background.js` riga 5

### "API Error: 401"
→ API key errata o scaduta

### "API Error: 429"
→ Rate limit superato, aspetta qualche secondo

### "Invalid JSON response"
→ L'IA ha risposto in formato non valido, riprova

### "Empty response"
→ L'IA non ha trovato segmenti da saltare (normale se il video non ha sponsor)

---

## 📝 Esempio completo background.js

```javascript
class AIAnalyzer {
  constructor() {
    // ⬇️ INSERISCI QUI LA TUA API KEY ⬇️
    this.API_KEY = 'sk-ant-api03-LA_TUA_CHIAVE_CLAUDE_QUI';
    this.API_ENDPOINT = 'https://api.anthropic.com/v1/messages';

    this.analysisCache = new Map();
    this.setupMessageListener();
  }
  // ... resto del codice
}
```

---

## 🎓 Prossimi passi

Dopo aver configurato l'API:

1. Testa su diversi video YouTube italiani
2. Controlla i risultati nell'analisi IA
3. Regola le impostazioni se necessario
4. Goditi i video senza sponsor! 🎉
