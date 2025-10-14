// content.js - Gestisce l'interazione con YouTube
class YouTubeSkipManager {
  constructor() {
    this.video = null;
    this.skipSegments = [];
    this.isAnalyzing = false;
    this.currentVideoId = null;
    this.transcriptCache = new Map();
    this.timedtextWarningShown = false; // Flag per evitare spam warning

    this.settings = {
      skipSponsors: true,
      skipIntros: true,
      skipOutros: true,
      skipDonations: true,
      skipSelfPromo: true,
      skipBuffer: 0.5, // secondi di buffer prima dello skip
      enablePreview: true,
      autoSkip: true
    };

    this.init();
  }

  init() {
    this.loadSettings();
    this.observeVideoChanges();
    this.injectTranscriptInterceptor();
    this.setupMessageListener();
    console.log('YouTube Smart Skip inizializzato');
  }

  async loadSettings() {
    const stored = await chrome.storage.local.get('settings');
    if (stored.settings) {
      this.settings = { ...this.settings, ...stored.settings };
    }
  }

  observeVideoChanges() {
    // Osserva cambiamenti nel DOM per rilevare nuovo video
    const observer = new MutationObserver(() => {
      const video = document.querySelector('video');
      const videoId = this.extractVideoId();
      
      if (video && videoId && videoId !== this.currentVideoId) {
        this.handleNewVideo(video, videoId);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Check iniziale
    const video = document.querySelector('video');
    const videoId = this.extractVideoId();
    if (video && videoId) {
      this.handleNewVideo(video, videoId);
    }
  }

  extractVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  async handleNewVideo(video, videoId) {
    this.video = video;
    this.currentVideoId = videoId;
    this.skipSegments = [];
    this.timedtextWarningShown = false; // Reset flag per nuovo video

    console.log(`Nuovo video rilevato: ${videoId}`);

    // Controlla cache locale
    const cached = await this.getCachedAnalysis(videoId);
    if (cached) {
      this.skipSegments = cached;
      this.setupVideoMonitoring();
      this.displaySegments();
      this.showNotification(`✅ ${cached.length} segmenti caricati dalla cache`, 'success');
      console.log(`Caricati ${cached.length} segmenti dalla cache:`);
      cached.forEach((seg, i) => {
        console.log(`  ${i + 1}. [${seg.start}s - ${seg.end}s] ${seg.category}: ${seg.description}`);
      });
      return;
    }

    // Aspetta che la pagina sia completamente caricata
    await new Promise(r => setTimeout(r, 2000));

    // Prova ad aprire automaticamente il pannello trascrizione per facilitare l'estrazione
    this.tryOpenTranscriptPanel();

    // Avvia analisi
    this.analyzeVideo(videoId);
    this.setupVideoMonitoring();
  }

  tryOpenTranscriptPanel() {
    try {
      // Cerca il pulsante "Mostra trascrizione"
      const transcriptButton = Array.from(document.querySelectorAll('button'))
        .find(btn => {
          const text = btn.textContent.toLowerCase();
          return text.includes('trascrizione') || text.includes('transcript');
        });

      if (transcriptButton && !transcriptButton.getAttribute('aria-pressed')) {
        console.log('Apertura automatica pannello trascrizione...');
        transcriptButton.click();
      }
    } catch (error) {
      // Ignora errori, questo è solo un helper
    }
  }

  setupVideoMonitoring() {
    if (!this.video) {
      console.warn('⚠️ setupVideoMonitoring: video element non trovato');
      return;
    }

    // Unisci segmenti sovrapposti prima di iniziare il monitoraggio
    this.skipSegments = this.mergeOverlappingSegments(this.skipSegments);

    console.log(`✓ Setup monitoraggio video con ${this.skipSegments.length} segmenti da saltare`);

    // Rimuovi listener precedenti
    this.video.removeEventListener('timeupdate', this.handleTimeUpdate);

    // Aggiungi nuovo listener
    this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
    this.video.addEventListener('timeupdate', this.handleTimeUpdate);

    console.log(`✓ Listener timeupdate aggiunto. AutoSkip: ${this.settings.autoSkip}`);
  }

  mergeOverlappingSegments(segments) {
    if (segments.length <= 1) return segments;

    // Ordina per tempo di inizio
    const sorted = segments.slice().sort((a, b) => a.start - b.start);
    const merged = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const lastMerged = merged[merged.length - 1];

      // Se il segmento corrente si sovrappone con l'ultimo unito
      if (current.start <= lastMerged.end) {
        // Unisci estendendo l'end time al massimo
        lastMerged.end = Math.max(lastMerged.end, current.end);
        // Combina le categorie
        if (!lastMerged.category.includes(current.category)) {
          lastMerged.category += ` + ${current.category}`;
        }
        lastMerged.description += ` | ${current.description}`;
        console.log(`🔗 Uniti segmenti sovrapposti: ${lastMerged.start}s-${lastMerged.end}s (${lastMerged.category})`);
      } else {
        // Nessuna sovrapposizione, aggiungi come nuovo segmento
        merged.push(current);
      }
    }

    return merged;
  }

  handleTimeUpdate() {
    if (!this.settings.autoSkip || !this.video) return;

    const currentTime = this.video.currentTime;

    // Controlla se siamo in un segmento da saltare
    for (const segment of this.skipSegments) {
      if (currentTime >= segment.start - this.settings.skipBuffer &&
          currentTime < segment.end) {

        console.log(`⏩ Rilevato segmento da saltare a ${currentTime}s: ${segment.category} (${segment.start}s - ${segment.end}s)`);

        // Mostra preview se abilitato
        if (this.settings.enablePreview) {
          this.showSkipPreview(segment);
        }

        // Esegui skip
        this.performSkip(segment);
        break;
      }
    }
  }

  performSkip(segment) {
    if (!this.video) return;

    console.log(`⏩ Saltando: ${segment.category} (${segment.start}s - ${segment.end}s)`);

    // Salva statistiche
    this.updateStats(segment);

    // Animazione fade se possibile
    this.video.style.transition = 'opacity 0.3s';
    this.video.style.opacity = '0.5';

    const newTime = segment.end;

    setTimeout(() => {
      this.video.currentTime = newTime;
      this.video.style.opacity = '1';
      this.showNotification(`⏩ Saltato: ${segment.category} (${Math.floor(segment.end - segment.start)}s risparmiati)`, 'success');

      // Rimuovi tutti i segmenti che sono stati saltati o superati
      // Questo previene skip multipli di segmenti sovrapposti
      this.skipSegments = this.skipSegments.filter(s => s.end > newTime);
      console.log(`✓ ${this.skipSegments.length} segmenti rimanenti da saltare`);
    }, 300);
  }

  async updateStats(segment) {
    const timeSaved = segment.end - segment.start;

    chrome.storage.local.get('stats', (data) => {
      const stats = data.stats || {
        timeSaved: 0,
        segmentsSkipped: 0,
        videosAnalyzed: 0
      };

      stats.timeSaved = (stats.timeSaved || 0) + timeSaved;
      stats.segmentsSkipped = (stats.segmentsSkipped || 0) + 1;

      chrome.storage.local.set({ stats }, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Errore salvataggio statistiche:', chrome.runtime.lastError);
        } else {
          console.log(`📊 Statistiche salvate: ${Math.floor(stats.timeSaved)}s risparmiati, ${stats.segmentsSkipped} segmenti saltati`);
          console.log('📊 Oggetto stats completo:', stats);
        }
      });
    });
  }

  showSkipPreview(segment) {
    const preview = document.createElement('div');
    preview.className = 'yss-skip-preview';
    preview.innerHTML = `
      <div class="yss-preview-content">
        <span>⏩ Salto ${segment.category} in ${this.settings.skipBuffer}s</span>
        <button class="yss-cancel-skip">Annulla</button>
      </div>
    `;
    
    preview.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 9999;
      font-family: Roboto, Arial, sans-serif;
    `;
    
    document.body.appendChild(preview);
    
    // Gestisci annullamento
    preview.querySelector('.yss-cancel-skip').onclick = () => {
      this.skipSegments = this.skipSegments.filter(s => s !== segment);
      preview.remove();
    };
    
    // Rimuovi dopo lo skip
    setTimeout(() => preview.remove(), this.settings.skipBuffer * 1000 + 500);
  }

  async analyzeVideo(videoId) {
    if (this.isAnalyzing) return;

    // Controlla se il canale è nella whitelist
    const isWhitelisted = await this.isChannelWhitelisted();
    if (isWhitelisted) {
      console.log('⚪ Canale escluso dalla whitelist, skip analisi');
      this.showNotification('ℹ️ Canale escluso dalle impostazioni avanzate', 'info');
      this.isAnalyzing = false;
      return;
    }

    this.isAnalyzing = true;
    this.showNotification('🔍 Analizzando video con IA...', 'info');

    try {
      // Ottieni trascrizione
      const transcript = await this.getTranscript(videoId);

      if (!transcript || transcript.length === 0) {
        console.warn('Trascrizione non disponibile, impossibile analizzare');
        this.showNotification(
          '⚠️ Trascrizione non disponibile per questo video. L\'estensione funziona solo con video che hanno sottotitoli.',
          'warning'
        );
        this.isAnalyzing = false;
        return;
      }

      console.log(`✓ Trascrizione ottenuta: ${transcript.length} segmenti`);
      this.showNotification(`✓ Trascrizione caricata: ${transcript.length} segmenti. Analizzando con IA...`, 'info');

      // Ottieni il titolo del video
      const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'Video YouTube';

      // Invia a background per analisi IA
      const result = await chrome.runtime.sendMessage({
        action: 'analyzeTranscript',
        data: {
          videoId: videoId,
          transcript: transcript,
          title: videoTitle,
          settings: this.settings
        }
      });

      if (result.success && result.segments && result.segments.length > 0) {
        this.skipSegments = result.segments;
        await this.cacheAnalysis(videoId, result.segments);

        // IMPORTANTE: Riconfigura il monitoraggio dopo aver assegnato i segmenti
        this.setupVideoMonitoring();

        const message = result.fallback
          ? `⚠️ IA non disponibile. L'estensione richiede una API key configurata.`
          : `✅ Trovati ${result.segments.length} segmenti da saltare (analisi IA)!`;

        this.showNotification(message, result.fallback ? 'warning' : 'success');
        this.displaySegments();

        // Log dettagliato dei segmenti trovati
        console.log('Segmenti da saltare:');
        result.segments.forEach((seg, i) => {
          console.log(`  ${i + 1}. [${seg.start}s - ${seg.end}s] ${seg.category}: ${seg.description}`);
        });
      } else if (result.success) {
        this.showNotification('ℹ️ Nessun contenuto da saltare rilevato dall\'IA', 'info');
      } else {
        console.error('Errore analisi IA:', result.error);
        this.showNotification(
          `❌ Errore analisi IA: ${result.error}. Configura l'API key in background.js`,
          'error'
        );
      }

    } catch (error) {
      console.error('Errore analisi:', error);
      this.showNotification('❌ Errore durante l\'analisi', 'error');
    }

    this.isAnalyzing = false;
  }
  

  async getTranscript(videoId) {
    // Prima controlla cache
    if (this.transcriptCache.has(videoId)) {
      console.log('Trascrizione trovata in cache');
      return this.transcriptCache.get(videoId);
    }

    console.log('Avvio estrazione trascrizione con metodi multipli...');

    // Metodo 1: Estrai dal DOM (più affidabile)
    console.log('Tentativo 1: Estrazione dal DOM...');
    const domTranscript = await this.extractTranscriptFromDOM();
    if (domTranscript && domTranscript.length > 0) {
      console.log(`✓ Trascrizione estratta dal DOM: ${domTranscript.length} segmenti`);
      this.transcriptCache.set(videoId, domTranscript);
      return domTranscript;
    }

    // Metodo 2: Estrai dal player config
    console.log('Tentativo 2: Estrazione dal player config...');
    const playerTranscript = await this.extractFromPlayerConfig(videoId);
    if (playerTranscript && playerTranscript.length > 0) {
      console.log(`✓ Trascrizione estratta dal player config: ${playerTranscript.length} segmenti`);
      this.transcriptCache.set(videoId, playerTranscript);
      return playerTranscript;
    }

    // Metodo 3: Attendi trascrizione intercettata
    console.log('Tentativo 3: Attesa trascrizione intercettata...');
    const interceptedTranscript = await this.waitForInterceptedTranscript();
    if (interceptedTranscript && interceptedTranscript.length > 0) {
      console.log(`✓ Trascrizione intercettata: ${interceptedTranscript.length} segmenti`);
      this.transcriptCache.set(videoId, interceptedTranscript);
      return interceptedTranscript;
    }

    console.warn('⚠ Nessuna trascrizione disponibile per questo video');
    return null;
  }
  
  async waitForInterceptedTranscript() {
    return new Promise((resolve) => {
      let timeout = setTimeout(() => {
        console.log('⏱️ Timeout attesa trascrizione intercettata');
        resolve(null);
      }, 10000); // Aumentato a 10 secondi
      
      const messageHandler = (event) => {
        if (event.data && event.data.type === 'YSS_TRANSCRIPT') {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          const transcript = this.parseYouTubeTranscript(event.data.data);
          resolve(transcript);
        }
      };
      
      window.addEventListener('message', messageHandler);
    });
  }
  
  async extractFromPlayerConfig(videoId) {
    try {
      console.log('Cercando ytInitialPlayerResponse...');

      // Metodo 1: Prova a leggere direttamente dalla finestra (più affidabile)
      if (window.ytInitialPlayerResponse) {
        console.log('✓ ytInitialPlayerResponse trovato nella finestra globale');
        const result = await this.extractTranscriptFromPlayerResponse(window.ytInitialPlayerResponse);
        if (result) return result;
      }

      // Metodo 2: Prova a ottenere ytInitialPlayerResponse dagli script tag
      console.log('Cercando negli script tag...');
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        if (content && content.includes('ytInitialPlayerResponse')) {
          const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
          if (match) {
            console.log('✓ ytInitialPlayerResponse trovato negli script');
            const playerResponse = JSON.parse(match[1]);
            return this.extractTranscriptFromPlayerResponse(playerResponse);
          }
        }
      }

      console.log('ytInitialPlayerResponse non trovato');
    } catch (error) {
      console.error('Errore estrazione dal player config:', error);
    }
    return null;
  }
  
  async extractTranscriptFromPlayerResponse(playerResponse) {
    try {
      const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captions || captions.length === 0) {
        console.log('Nessuna traccia caption trovata in playerResponse');
        return null;
      }

      // Trova la traccia italiana o inglese
      let captionTrack = captions.find(c => c.languageCode === 'it') ||
                         captions.find(c => c.languageCode === 'en') ||
                         captions[0];

      if (captionTrack && captionTrack.baseUrl) {
        // Mostra il warning solo una volta per video
        if (!this.timedtextWarningShown) {
          console.log(`Traccia sottotitoli trovata (${captionTrack.languageCode}):`, captionTrack.baseUrl);
          console.warn('⚠️ L\'API timedtext di YouTube non è accessibile da estensioni (restituisce content-length: 0)');
          console.log('💡 Usa l\'estrazione DOM invece - apri manualmente il pannello trascrizione se necessario');
          this.timedtextWarningShown = true;
        }
      }
    } catch (error) {
      console.error('Errore estrazione trascrizione dal player response:', error);
    }
    return null;
  }
  
  parseYouTubeTranscript(data) {
    try {
      if (data && data.events) {
        return data.events
          .filter(event => event.segs)
          .map(event => ({
            text: event.segs.map(seg => seg.utf8).join(''),
            start: (event.tStartMs || 0) / 1000,
            duration: (event.dDurationMs || 0) / 1000
          }));
      }
    } catch (error) {
      console.error('Errore parsing trascrizione:', error);
    }
    return null;
  }

  parseXMLTranscript(xmlString) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      // Controlla errori di parsing
      if (xmlDoc.querySelector('parsererror')) {
        console.error('Errore parsing XML');
        return null;
      }

      const textElements = xmlDoc.querySelectorAll('text');
      if (textElements.length === 0) {
        console.warn('Nessun elemento text trovato nell\'XML');
        return null;
      }

      const transcript = [];
      textElements.forEach(textEl => {
        const start = parseFloat(textEl.getAttribute('start') || '0');
        const dur = parseFloat(textEl.getAttribute('dur') || '5');
        const text = textEl.textContent || '';

        if (text.trim()) {
          transcript.push({
            text: text.trim(),
            start: start,
            duration: dur
          });
        }
      });

      console.log(`✓ Parsed ${transcript.length} segmenti da XML`);
      return transcript;
    } catch (error) {
      console.error('Errore parsing XML trascrizione:', error);
      return null;
    }
  }

  parseTranscript(data) {
    if (!data.events) return null;
    
    const transcript = data.events
      .filter(event => event.segs)
      .map(event => ({
        text: event.segs.map(seg => seg.utf8).join(''),
        start: event.tStartMs / 1000,
        duration: event.dDurationMs / 1000
      }));
    
    this.transcriptCache.set(this.currentVideoId, transcript);
    return transcript;
  }

  async extractTranscriptFromDOM() {
    try {
      console.log('🔍 Cercando pannello trascrizione nel DOM...');

      // Helper function per estrarre segmenti
      const extractSegments = () => {
        // Cerca entrambe le varianti del selettore
        const transcriptPanel = document.querySelector(
          'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"],' +
          'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]'
        );

        if (!transcriptPanel) {
          console.log('⚠️ Pannello trascrizione non trovato nel DOM');
          return null;
        }

        console.log('✓ Pannello trascrizione trovato:', transcriptPanel.getAttribute('target-id'));

        // Prova con selettori multipli per maggiore compatibilità
        let segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');

        // Se non trova nulla, prova selettori alternativi
        if (segments.length === 0) {
          segments = transcriptPanel.querySelectorAll('[class*="segment"]');
        }

        if (segments.length === 0) {
          console.log('⚠️ Nessun elemento segmento trovato nel pannello');
          return null;
        }

        console.log(`Trovati ${segments.length} elementi segmento nel pannello`);

        const transcript = [];
        segments.forEach((segment, index) => {
          // Prova selettori multipli per timestamp e testo
          let timeElement = segment.querySelector('.segment-timestamp, [class*="timestamp"]');
          let textElement = segment.querySelector('.segment-text, [class*="segment-text"], [class*="cue-text"]');

          // Se non trova con classi, prova con tag
          if (!timeElement) {
            timeElement = segment.querySelector('div[role="button"]');
          }
          if (!textElement) {
            const divs = segment.querySelectorAll('div');
            textElement = Array.from(divs).find(div => div.textContent && !div.textContent.match(/^\d+:\d+/));
          }

          if (timeElement && textElement) {
            const timeText = timeElement.textContent || timeElement.innerText;
            const text = textElement.textContent || textElement.innerText;

            if (timeText && text) {
              const time = this.parseTimeString(timeText);
              transcript.push({
                text: text.trim(),
                start: time,
                duration: 5
              });
            }
          } else {
            if (index < 5) { // Log solo i primi 5 per non spammare
              console.log(`Segmento ${index}: timeElement=${!!timeElement}, textElement=${!!textElement}`);
            }
          }
        });

        return transcript.length > 0 ? transcript : null;
      };

      // Metodo 1: Cerca direttamente nel DOM se il pannello è già aperto
      let transcript = extractSegments();
      if (transcript && transcript.length > 0) {
        console.log(`✓ Pannello già aperto - Estratti ${transcript.length} segmenti`);
        return transcript;
      }

      console.log('Pannello non aperto, cercando pulsante...');

      // Metodo 2: Cerca e clicca il pulsante trascrizione
      const buttons = Array.from(document.querySelectorAll('button'));
      const transcriptButton = buttons.find(btn => {
        const text = btn.textContent.toLowerCase();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        return text.includes('trascrizione') || text.includes('transcript') ||
               ariaLabel.includes('trascrizione') || ariaLabel.includes('transcript');
      });

      if (transcriptButton) {
        console.log('✓ Pulsante trascrizione trovato, click...');
        transcriptButton.click();

        // Aspetta che il pannello si apra e prova più volte con attese più lunghe
        console.log('Attesa caricamento segmenti...');
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 800));

          // Verifica che il pannello sia visibile
          const panel = document.querySelector(
            'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"],' +
            'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]'
          );
          if (panel) {
            const isVisible = panel.offsetParent !== null;
            console.log(`Tentativo ${i + 1}: Pannello ${isVisible ? 'visibile' : 'non visibile'}`);

            transcript = extractSegments();
            if (transcript && transcript.length > 0) {
              console.log(`✅ Estratti ${transcript.length} segmenti dopo apertura pannello (tentativo ${i + 1})`);
              return transcript;
            }

            // Verifica se ci sono elementi di loading
            const loading = panel.querySelector('tp-yt-paper-spinner, ytd-continuation-item-renderer');
            if (loading) {
              console.log('⏳ Caricamento in corso...');
            }
          }
        }
        console.warn('⚠️ Pannello aperto ma nessun segmento trovato dopo 10 tentativi');

        // Debug: mostra cosa c'è nel pannello
        const panel = document.querySelector(
          'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"],' +
          'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]'
        );
        if (panel) {
          console.log('Debug pannello HTML:', panel.innerHTML.substring(0, 500));
        }
      } else {
        console.log('⚠️ Pulsante trascrizione non trovato nel DOM');
      }

      console.log('❌ Nessun metodo DOM ha funzionato');
      console.log('💡 Suggerimento: Apri manualmente il pannello trascrizione e ricarica la pagina');

    } catch (error) {
      console.error('Errore estrazione trascrizione dal DOM:', error);
    }

    return null;
  }
  
  parseTimeString(timeStr) {
    // Converte "1:23" o "1:23:45" in secondi
    const parts = timeStr.trim().split(':').map(p => parseInt(p));
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }

  displaySegments() {
    // Rimuovi marker precedenti
    document.querySelectorAll('.yss-segment-marker').forEach(m => m.remove());
    document.querySelectorAll('.yss-segment-tooltip').forEach(t => t.remove());

    const progressBar = document.querySelector('.ytp-progress-bar');
    if (!progressBar || !this.video) return;

    const duration = this.video.duration;
    if (!duration || duration === 0) {
      console.warn('⚠️ Durata video non disponibile, impossibile mostrare timeline');
      return;
    }

    console.log(`🎨 Visualizzando ${this.skipSegments.length} segmenti sulla timeline`);

    this.skipSegments.forEach((segment, index) => {
      // Colori per categoria
      const colors = {
        'Sponsor': '#FF0000',
        'Autopromo': '#FF8800',
        'Intro': '#00FFFF',
        'Outro': '#CC00FF',
        'Donazioni': '#00FF00',
        'Ringraziamenti': '#00FF00'
      };

      // Trova il colore della categoria principale
      let color = '#FF0000'; // Default rosso
      for (const [cat, col] of Object.entries(colors)) {
        if (segment.category.includes(cat)) {
          color = col;
          break;
        }
      }

      // Calcola posizione e larghezza
      const left = (segment.start / duration) * 100;
      const width = ((segment.end - segment.start) / duration) * 100;

      // Crea il marker
      const marker = document.createElement('div');
      marker.className = 'yss-segment-marker';
      marker.dataset.index = index;
      marker.style.cssText = `
        position: absolute;
        left: ${left}%;
        width: ${width}%;
        height: 100%;
        background: ${color};
        opacity: 0.6;
        z-index: 25;
        cursor: pointer;
        transition: opacity 0.2s;
      `;

      // Hover per mostrare tooltip
      marker.addEventListener('mouseenter', (e) => {
        marker.style.opacity = '0.9';
        this.showSegmentTooltip(segment, e);
      });

      marker.addEventListener('mouseleave', () => {
        marker.style.opacity = '0.6';
        this.hideSegmentTooltip();
      });

      // Click per saltare al segmento
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.video) {
          this.video.currentTime = segment.end;
          this.showNotification(`⏩ Saltato manualmente: ${segment.category}`, 'info');
        }
      });

      progressBar.appendChild(marker);
    });
  }

  showSegmentTooltip(segment, event) {
    // Rimuovi tooltip esistente
    this.hideSegmentTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'yss-segment-tooltip';

    const duration = Math.floor(segment.end - segment.start);
    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">${segment.category}</div>
      <div style="font-size: 12px; opacity: 0.9;">
        ${this.formatTime(segment.start)} - ${this.formatTime(segment.end)} (${duration}s)
      </div>
      <div style="font-size: 11px; margin-top: 4px; opacity: 0.8;">
        ${segment.description}
      </div>
      <div style="font-size: 10px; margin-top: 6px; opacity: 0.7; font-style: italic;">
        Click per saltare
      </div>
    `;

    tooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 10px 12px;
      border-radius: 6px;
      z-index: 10000;
      pointer-events: none;
      font-family: Roboto, Arial, sans-serif;
      font-size: 13px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;

    document.body.appendChild(tooltip);

    // Posiziona il tooltip vicino al cursore
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  }

  hideSegmentTooltip() {
    const tooltip = document.querySelector('.yss-segment-tooltip');
    if (tooltip) tooltip.remove();
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `yss-notification yss-${type}`;
    notification.textContent = message;
    
    const colors = {
      info: '#3498db',
      success: '#27ae60',
      warning: '#f39c12',
      error: '#e74c3c'
    };
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 9999;
      font-family: Roboto, Arial, sans-serif;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  async getCachedAnalysis(videoId) {
    const cached = await chrome.storage.local.get(`analysis_${videoId}`);
    return cached[`analysis_${videoId}`] || null;
  }

  async cacheAnalysis(videoId, segments) {
    await chrome.storage.local.set({
      [`analysis_${videoId}`]: segments
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateSettings') {
        this.settings = { ...this.settings, ...request.settings };
        this.saveSettings();
      }
      if (request.action === 'updateAdvancedSettings') {
        // Aggiorna skipBuffer dalle impostazioni avanzate
        if (request.advancedSettings && request.advancedSettings.skipBuffer !== undefined) {
          this.settings.skipBuffer = request.advancedSettings.skipBuffer;
          console.log('⚙️ Skip buffer aggiornato:', this.settings.skipBuffer);
        }
      }
      if (request.action === 'manualAnalyze') {
        this.analyzeVideo(this.currentVideoId);
      }
      if (request.action === 'toggleAutoSkip') {
        this.settings.autoSkip = !this.settings.autoSkip;
        this.saveSettings();
      }
      if (request.action === 'getCurrentChannel') {
        // Ottieni informazioni sul canale corrente
        const channelLinkElement = document.querySelector('ytd-channel-name a');
        if (channelLinkElement) {
          const channelHandle = channelLinkElement.textContent?.trim();
          const channelUrl = channelLinkElement.href;
          const channelId = channelUrl?.split('/').pop();

          sendResponse({
            channelName: channelHandle || channelId,
            channelId: channelId,
            channelUrl: channelUrl
          });
        } else {
          sendResponse({ channelName: null });
        }
        return true; // Mantieni il canale aperto per sendResponse asincrono
      }
    });
  }

  async saveSettings() {
    await chrome.storage.local.set({ settings: this.settings });
  }

  async isChannelWhitelisted() {
    try {
      // Ottieni il nome/ID del canale corrente
      const channelLinkElement = document.querySelector('ytd-channel-name a');
      if (!channelLinkElement) {
        console.log('⚠️ Elemento canale non trovato');
        return false;
      }

      const channelHandle = channelLinkElement.textContent?.trim();
      const channelUrl = channelLinkElement.href;
      const channelId = channelUrl?.split('/').pop(); // Es: @NomeCanale o UCxxxxxx

      console.log('📺 Canale corrente:', { channelHandle, channelId });

      // Carica la whitelist dalle impostazioni avanzate
      const data = await chrome.storage.local.get(['advancedSettings']);
      const whitelist = data.advancedSettings?.channelWhitelist || [];

      // Controlla se il canale è nella whitelist (per handle o ID)
      const isWhitelisted = whitelist.some(item => {
        return item === channelHandle ||
               item === channelId ||
               channelHandle?.includes(item) ||
               channelId?.includes(item);
      });

      if (isWhitelisted) {
        console.log('✓ Canale trovato nella whitelist:', channelHandle || channelId);
      }

      return isWhitelisted;
    } catch (error) {
      console.error('❌ Errore controllo whitelist:', error);
      return false;
    }
  }

  injectTranscriptInterceptor() {
    // Non iniettare script inline a causa della CSP
    // Invece, osserviamo le performance entries per le richieste di rete
    console.log('YouTube Smart Skip: Monitoraggio richieste sottotitoli...');
    
    // Monitora le richieste usando PerformanceObserver se disponibile
    if (window.PerformanceObserver) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name && (entry.name.includes('timedtext') || entry.name.includes('caption'))) {
            console.log('Richiesta sottotitoli rilevata:', entry.name);
            // Prova a fare fetch dell'URL
            this.fetchTranscriptFromUrl(entry.name);
          }
        }
      });
      
      try {
        observer.observe({ entryTypes: ['resource'] });
      } catch (e) {
        console.log('PerformanceObserver non supportato per resource entries');
      }
    }
    
    // Metodo alternativo: periodicamente controlla se ci sono nuovi elementi script con ytInitialPlayerResponse
    this.checkForPlayerResponse();
  }
  
  checkForPlayerResponse() {
    const interval = setInterval(() => {
      if (this.transcriptCache.has(this.currentVideoId)) {
        clearInterval(interval);
        return;
      }
      
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        if (content && content.includes('ytInitialPlayerResponse')) {
          const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
          if (match) {
            try {
              const playerResponse = JSON.parse(match[1]);
              this.extractTranscriptFromPlayerResponse(playerResponse).then(transcript => {
                if (transcript) {
                  clearInterval(interval);
                  console.log('Trascrizione estratta dal player response');
                }
              });
            } catch (e) {
              console.error('Errore parsing player response:', e);
            }
          }
        }
      }
    }, 2000);
    
    // Ferma dopo 30 secondi
    setTimeout(() => clearInterval(interval), 30000);
  }
  
  async fetchTranscriptFromUrl(url) {
    try {
      if (!url.includes('fmt=json')) {
        url += '&fmt=json3';
      }

      // Usa il background service worker per scaricare i sottotitoli (bypassa CORS)
      const result = await chrome.runtime.sendMessage({
        action: 'fetchTranscript',
        url: url
      });

      if (result.success && result.data) {
        const transcript = this.parseYouTubeTranscript(result.data);
        if (transcript && transcript.length > 0) {
          this.transcriptCache.set(this.currentVideoId, transcript);
          console.log('Trascrizione scaricata con successo tramite background service worker');
        }
      } else {
        console.warn('Errore fetch trascrizione:', result.error);
      }
    } catch (error) {
      console.error('Errore comunicazione con background script:', error);
    }
  }
}

// Stili CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .yss-cancel-skip {
    margin-left: 10px;
    padding: 5px 10px;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid white;
    color: white;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .yss-cancel-skip:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;
document.head.appendChild(style);

// Inizializza quando la pagina è pronta
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new YouTubeSkipManager());
} else {
  new YouTubeSkipManager();
}