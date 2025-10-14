// background.js - Service Worker per gestione IA e comunicazioni
class AIAnalyzer {
  constructor() {
    // Configurazione API - sostituire con le proprie chiavi
    this.API_KEY = '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';
    this.API_ENDPOINT = 'https://api.anthropic.com/v1/messages'; // o OpenAI
    
    this.analysisCache = new Map();
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'analyzeTranscript') {
        this.handleTranscriptAnalysis(request.data)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({
            success: false,
            error: error.message
          }));
        return true; // Mantiene il canale aperto per risposta asincrona
      }

      if (request.action === 'fetchTranscript') {
        this.fetchTranscriptUrl(request.url)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({
            success: false,
            error: error.message
          }));
        return true; // Mantiene il canale aperto per risposta asincrona
      }
    });
  }

  async fetchTranscriptUrl(url) {
    try {
      const response = await fetch(url);
      console.log('Background fetch response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);

      if (response.ok) {
        const text = await response.text();
        console.log('Response text length:', text.length);
        console.log('Response preview:', text.substring(0, 500));

        if (text && text.trim().length > 0) {
          try {
            const data = JSON.parse(text);
            return { success: true, data: data };
          } catch (parseError) {
            console.error('Errore parsing JSON sottotitoli:', parseError);
            // Prova a estrarre XML invece di JSON
            if (text.includes('<?xml') || text.includes('<transcript>')) {
              console.log('Risposta in formato XML rilevata');
              return { success: true, data: text, format: 'xml' };
            }
            return { success: false, error: 'Invalid JSON response', rawText: text.substring(0, 200) };
          }
        } else {
          console.warn('Risposta vuota ricevuta');
          return { success: false, error: 'Empty response' };
        }
      } else {
        console.error('Risposta HTTP non OK:', response.status, response.statusText);
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      console.error('Errore fetch trascrizione:', error);
      return { success: false, error: error.message };
    }
  }

  async handleTranscriptAnalysis(data) {
    const { videoId, transcript, title, settings } = data;

    // Verifica che l'API key sia configurata
    if (!this.API_KEY || this.API_KEY === 'YOUR_API_KEY_HERE' || this.API_KEY.length < 20) {
      console.error('❌ API Key non configurata!');
      return {
        success: false,
        error: 'API Key non configurata. Inserisci la tua API key Claude/OpenAI in background.js riga 5'
      };
    }

    // Carica impostazioni avanzate
    const advSettings = await this.getAdvancedSettings();
    console.log('⚙️ Impostazioni avanzate:', advSettings);

    // Controlla cache
    const cacheKey = `${videoId}_${JSON.stringify(settings)}_${advSettings.confidenceThreshold}`;
    if (this.analysisCache.has(cacheKey)) {
      console.log('✓ Analisi trovata in cache');
      return {
        success: true,
        segments: this.analysisCache.get(cacheKey)
      };
    }

    try {
      console.log('🤖 Avvio analisi IA per video:', title);

      // Prepara il testo della trascrizione
      const transcriptText = this.formatTranscript(transcript);
      console.log(`📝 Trascrizione formattata: ${transcriptText.length} caratteri`);

      // Analizza con IA usando impostazioni avanzate
      const segments = await this.analyzeWithAI(transcriptText, title, settings, advSettings);

      // Cache risultato
      this.analysisCache.set(cacheKey, segments);

      // Salva anche in storage persistente
      await this.saveToStorage(videoId, segments);

      console.log(`✅ Analisi IA completata: ${segments.length} segmenti trovati`);

      return {
        success: true,
        segments: segments
      };
    } catch (error) {
      console.error('❌ Errore analisi IA:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAdvancedSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['advancedSettings'], (data) => {
        const defaults = {
          confidenceThreshold: 0.85,
          aiModel: 'haiku',
          skipBuffer: 0.5,
          channelWhitelist: []
        };
        resolve(data.advancedSettings || defaults);
      });
    });
  }

  formatTranscript(transcript) {
    if (!transcript) return '';

    return transcript
      .map(item => `[${Math.floor(item.start)}s] ${item.text}`)
      .join('\n');
  }

  async analyzeWithAI(transcriptText, title, settings, advSettings) {
    const prompt = this.buildPrompt(transcriptText, title, settings, advSettings.confidenceThreshold);

    // Seleziona modello IA in base alle impostazioni
    const modelMap = {
      'haiku': 'claude-3-5-haiku-20241022',
      'sonnet': 'claude-sonnet-4-5-20250929'
    };
    const selectedModel = modelMap[advSettings.aiModel] || modelMap['haiku'];

    console.log('🔑 API Key presente:', this.API_KEY ? `${this.API_KEY.substring(0, 20)}...` : 'NO');
    console.log('🌐 Endpoint:', this.API_ENDPOINT);
    console.log('🤖 Modello selezionato:', selectedModel);
    console.log('🎯 Soglia confidenza:', advSettings.confidenceThreshold);
    console.log('📤 Invio richiesta a Claude API...');

    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      console.log('📥 Risposta ricevuta, status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Errore API:', response.status, errorText);
        throw new Error(`API Error ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      console.log('✅ Dati JSON ricevuti');

      const aiResponse = data.content[0].text;
      console.log('🤖 Risposta IA:', aiResponse.substring(0, 200) + '...');

      // Parsing della risposta con soglia di confidenza personalizzata
      return this.parseAIResponse(aiResponse, advSettings.confidenceThreshold);
    } catch (error) {
      console.error('❌ Errore durante chiamata API:', error);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  buildPrompt(transcript, title, settings, confidenceThreshold = 0.85) {
    const categories = [];
    if (settings.skipSponsors) categories.push('sponsorizzazioni di prodotti/servizi esterni');
    if (settings.skipIntros) categories.push('intro/sigla iniziale (musica, animazioni, loghi)');
    if (settings.skipOutros) categories.push('outro/sigla finale (musica, credits, animazioni di chiusura)');
    if (settings.skipDonations) categories.push('ringraziamenti donazioni/super chat (lettura nomi donatori)');
    if (settings.skipSelfPromo) categories.push('autopromozione canale/merchandise (richieste like/iscrizione/notifiche, vendita merch)');

    return `Sei un esperto nell'analisi di video YouTube. Analizza questa trascrizione del video "${title}" e identifica SOLO i segmenti che contengono:
${categories.map(c => `- ${c}`).join('\n')}

REGOLE IMPORTANTI:
1. NON confondere il contenuto reale del video con sponsor/autopromo
2. AUTOPROMOZIONE include QUALSIASI richiesta di like, iscrizione, attivazione notifiche/campanella, anche se brevi (anche 3-5 secondi)
3. INTRO/OUTRO = sigle musicali, animazioni, loghi, jingle iniziali/finali da SALTARE SEMPRE
4. Autopromozione significa anche: merchandise, prodotti del canale, richieste di supporto economico
5. Sponsor significa: pubblicità di prodotti/servizi ESTERNI (NordVPN, Audible, Raid Shadow Legends, ecc.)
6. Donazioni significa: LETTURA di nomi di donatori o super chat (non semplici ringraziamenti)
7. Se non sei SICURO al 100%, NON includere il segmento
8. Confidence minima richiesta: ${confidenceThreshold}

Trascrizione con timestamp (formato [Xs] dove X = secondi dall'inizio del video):
${transcript}

IMPORTANTE: I timestamp nella trascrizione sono in SECONDI PURI (es. [74s] = 1 minuto e 14 secondi).
Rispondi con start/end ANCHE in secondi puri (es. "start": 74 per 1:14).

Rispondi SOLO in formato JSON:
{
  "segments": [
    {
      "start": <secondi_inizio_numero_intero>,
      "end": <secondi_fine_numero_intero>,
      "category": "<sponsorizzazioni|autopromozione_canale|donazioni|intro|outro>",
      "confidence": <0.0-1.0>,
      "description": "<descrizione_dettagliata_50_caratteri>"
    }
  ]
}

Esempio: se lo sponsor è da [74s] a [143s], rispondi: {"start": 74, "end": 143}
Se NON trovi segmenti da saltare, rispondi: {"segments": []}`;
  }

  parseAIResponse(response, confidenceThreshold = 0.85) {
    try {
      console.log('🔍 Parsing risposta IA completa:', response);

      // Rimuovi eventuali backticks markdown
      let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Estrai JSON dalla risposta usando regex più robusta
      const jsonMatch = cleaned.match(/\{[\s\S]*"segments"[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('❌ JSON non trovato nella risposta');
        return [];
      }

      // Trova la chiusura corretta del JSON
      let jsonStr = jsonMatch[0];
      if (!jsonStr.endsWith('}')) {
        jsonStr += '\n}';
      }

      console.log('📄 JSON estratto:', jsonStr);

      const parsed = JSON.parse(jsonStr);

      console.log(`✓ JSON parsato correttamente, ${parsed.segments?.length || 0} segmenti trovati`);

      if (!parsed.segments || !Array.isArray(parsed.segments)) {
        console.warn('⚠️ Nessun array segments trovato');
        return [];
      }

      // Filtra per confidenza usando il valore personalizzato
      const filtered = parsed.segments
        .filter(seg => seg.confidence >= confidenceThreshold)
        .map(seg => ({
          start: seg.start,
          end: seg.end,
          category: this.translateCategory(seg.category),
          description: seg.description
        }));

      console.log(`✓ ${filtered.length} segmenti dopo filtro confidenza (>=${confidenceThreshold})`);
      return filtered;

    } catch (error) {
      console.error('❌ Errore parsing risposta IA:', error);
      console.error('Risposta originale:', response);
      return [];
    }
  }

  translateCategory(category) {
    const translations = {
      'sponsorizzazioni': 'Sponsor',
      'sponsor': 'Sponsor',
      'intro': 'Intro',
      'sigla iniziale': 'Intro',
      'outro': 'Outro',
      'sigla finale': 'Outro',
      'donazioni': 'Donazioni',
      'super chat': 'Donazioni',
      'ringraziamenti': 'Ringraziamenti',
      'autopromozione': 'Autopromo',
      'merchandise': 'Merchandise',
      'merch': 'Merchandise'
    };
    
    const lowerCategory = category.toLowerCase();
    for (const [key, value] of Object.entries(translations)) {
      if (lowerCategory.includes(key)) {
        return value;
      }
    }
    
    return category;
  }


  async saveToStorage(videoId, segments) {
    const key = `analysis_${videoId}`;
    const data = {
      [key]: segments,
      [`${key}_timestamp`]: Date.now()
    };
    
    await chrome.storage.local.set(data);
    
    // Pulizia cache vecchia (oltre 30 giorni)
    this.cleanOldCache();
  }

  async cleanOldCache() {
    const storage = await chrome.storage.local.get();
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 giorni
    
    const toRemove = [];
    
    for (const key in storage) {
      if (key.endsWith('_timestamp')) {
        const timestamp = storage[key];
        if (now - timestamp > maxAge) {
          const videoKey = key.replace('_timestamp', '');
          toRemove.push(key, videoKey);
        }
      }
    }
    
    if (toRemove.length > 0) {
      await chrome.storage.local.remove(toRemove);
    }
  }
}

// Database condiviso (opzionale - tipo SponsorBlock)
class SharedDatabase {
  constructor() {
    this.API_URL = 'https://your-api.com'; // API del tuo server
  }

  async submitSegments(videoId, segments, userId) {
    try {
      const response = await fetch(`${this.API_URL}/segments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoId,
          segments,
          userId,
          timestamp: Date.now()
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('Errore invio segmenti:', error);
      return false;
    }
  }

  async getSegments(videoId) {
    try {
      const response = await fetch(`${this.API_URL}/segments/${videoId}`);
      
      if (response.ok) {
        const data = await response.json();
        return this.processSharedSegments(data);
      }
    } catch (error) {
      console.error('Errore recupero segmenti condivisi:', error);
    }
    
    return null;
  }

  processSharedSegments(data) {
    // Aggrega e valida segmenti da più utenti
    // Implementa logica di votazione/consenso
    return data.segments;
  }
}

// Inizializza
const analyzer = new AIAnalyzer();
const sharedDB = new SharedDatabase();

// Gestione installazione/aggiornamento
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Prima installazione
    chrome.storage.local.set({
      settings: {
        skipSponsors: true,
        skipIntros: false,
        skipOutros: false,
        skipDonations: true,
        skipSelfPromo: true,
        skipBuffer: 0.5,
        enablePreview: true,
        autoSkip: true
      }
    });
    
    // Apri pagina di benvenuto
    chrome.tabs.create({
      url: 'welcome.html'
    });
  }
});