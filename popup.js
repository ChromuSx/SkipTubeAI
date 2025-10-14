// popup.js - Script per il popup dell'estensione
let currentVideoId = null;
let isLoadingSettings = true; // Flag per evitare salvataggi durante il caricamento

// Carica impostazioni salvate
chrome.storage.local.get(['settings', 'stats', 'advancedSettings'], (data) => {
  console.log('📊 Dati caricati dal popup:', data);

  // Usa i valori salvati, oppure i default se non esistono
  const settings = data.settings || {};

  // Helper: usa default=true solo se undefined
  const getDefault = (val) => val === undefined ? true : val;

  document.getElementById('skip-sponsors').checked = getDefault(settings.skipSponsors);
  document.getElementById('skip-intros').checked = getDefault(settings.skipIntros);
  document.getElementById('skip-outros').checked = getDefault(settings.skipOutros);
  document.getElementById('skip-donations').checked = getDefault(settings.skipDonations);
  document.getElementById('skip-selfpromo').checked = getDefault(settings.skipSelfPromo);
  document.getElementById('master-toggle').checked = getDefault(settings.autoSkip);

  updateStatus(getDefault(settings.autoSkip));

  console.log('✓ Impostazioni UI aggiornate:', {
    skipSponsors: document.getElementById('skip-sponsors').checked,
    skipIntros: document.getElementById('skip-intros').checked,
    skipOutros: document.getElementById('skip-outros').checked,
    skipDonations: document.getElementById('skip-donations').checked,
    skipSelfPromo: document.getElementById('skip-selfpromo').checked,
    autoSkip: document.getElementById('master-toggle').checked
  });

  // Carica impostazioni avanzate
  const advSettings = data.advancedSettings || {
    confidenceThreshold: 0.85,
    aiModel: 'haiku',
    skipBuffer: 0.5,
    channelWhitelist: []
  };
  loadAdvancedSettings(advSettings);

  if (data.stats) {
    console.log('✓ Statistiche trovate:', data.stats);
    updateStats(data.stats);
  } else {
    console.log('⚠️ Nessuna statistica trovata in storage');
  }

  // loadCacheInfo deve essere chiamato DOPO updateStats per sovrascrivere videosAnalyzed
  loadCacheInfo();
  loadCurrentVideoInfo();

  // Sblocca i salvataggi dopo che tutto è stato caricato
  setTimeout(() => {
    isLoadingSettings = false;
    console.log('✓ Caricamento completato - eventi abilitati');
  }, 100);
});

// Gestori eventi
document.getElementById('master-toggle').addEventListener('change', (e) => {
  if (isLoadingSettings) {
    console.log('⏳ Caricamento in corso - evento ignorato');
    return;
  }
  const isActive = e.target.checked;
  console.log('✓ Master toggle cambiato:', isActive);
  updateStatus(isActive);
  saveSettings();
});

// Gestori per ogni checkbox - usa 'click' invece di 'change' per catturare anche i click sul label
['skip-sponsors', 'skip-intros', 'skip-outros', 'skip-donations', 'skip-selfpromo']
  .forEach(id => {
    const checkbox = document.getElementById(id);
    checkbox.addEventListener('change', () => {
      if (isLoadingSettings) {
        console.log('⏳ Caricamento in corso - evento ignorato');
        return;
      }
      console.log(`✓ Checkbox ${id} cambiato:`, checkbox.checked);
      saveSettings();
    });
  });

document.getElementById('manual-analyze').addEventListener('click', () => {
  if (currentVideoId) {
    // Cancella cache del video corrente e rianalizzi
    chrome.storage.local.remove(`analysis_${currentVideoId}`, () => {
      sendMessage('manualAnalyze');
      setTimeout(() => window.close(), 500);
    });
  }
});

document.getElementById('view-cache').addEventListener('click', () => {
  const url = chrome.runtime.getURL('cache-viewer.html');
  console.log('Apertura cache viewer:', url);
  chrome.tabs.create({ url: url }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('Errore apertura cache viewer:', chrome.runtime.lastError);
      showToast('Errore apertura pagina cache: ' + chrome.runtime.lastError.message, 'error');
    }
  });
});

document.getElementById('clear-current-cache').addEventListener('click', () => {
  if (!currentVideoId) {
    showToast('Nessun video YouTube attivo nella tab corrente', 'warning');
    return;
  }

  if (confirm('Cancellare la cache per questo video?')) {
    chrome.storage.local.remove(`analysis_${currentVideoId}`, () => {
      showToast('Cache video cancellata! Ricarica la pagina per riananalizzare', 'success');
      loadCacheInfo();
    });
  }
});

document.getElementById('clear-all-cache').addEventListener('click', () => {
  if (confirm('⚠️ ATTENZIONE: Cancellare TUTTA la cache?\n\nTutti i video dovranno essere rianalizzati.')) {
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = Object.keys(items).filter(key => key.startsWith('analysis_'));
      chrome.storage.local.remove(keysToRemove, () => {
        showToast(`${keysToRemove.length} video rimossi dalla cache!`, 'success');
        loadCacheInfo();
      });
    });
  }
});

// ========== ADVANCED SETTINGS EVENT LISTENERS ==========

// Confidence Threshold Slider
document.getElementById('confidence-slider').addEventListener('input', (e) => {
  if (isLoadingSettings) {
    console.log('⏳ Caricamento in corso - evento ignorato');
    return;
  }
  const value = e.target.value / 100; // Convert 50-100 to 0.5-1.0
  document.getElementById('confidence-value').textContent = value.toFixed(2);
  saveAdvancedSettings();
});

// AI Model Selection
document.getElementById('ai-model').addEventListener('change', (e) => {
  if (isLoadingSettings) {
    console.log('⏳ Caricamento in corso - evento ignorato');
    return;
  }
  console.log('🤖 Modello IA cambiato:', e.target.value);
  saveAdvancedSettings();
});

// Skip Buffer Slider
document.getElementById('buffer-slider').addEventListener('input', (e) => {
  if (isLoadingSettings) {
    console.log('⏳ Caricamento in corso - evento ignorato');
    return;
  }
  const value = e.target.value / 10; // Convert 0-30 to 0.0-3.0
  document.getElementById('buffer-value').textContent = value.toFixed(1) + 's';
  saveAdvancedSettings();
});

// Channel Whitelist Button
document.getElementById('whitelist-btn').addEventListener('click', () => {
  openWhitelistManager();
});

function updateStatus(isActive) {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.getElementById('status-text');

  if (isActive) {
    statusDot.classList.remove('inactive');
    statusDot.classList.add('active');
    statusText.textContent = 'Attivo';
  } else {
    statusDot.classList.remove('active');
    statusDot.classList.add('inactive');
    statusText.textContent = 'Inattivo';
  }
}

function saveSettings() {
  const settings = {
    skipSponsors: document.getElementById('skip-sponsors').checked,
    skipIntros: document.getElementById('skip-intros').checked,
    skipOutros: document.getElementById('skip-outros').checked,
    skipDonations: document.getElementById('skip-donations').checked,
    skipSelfPromo: document.getElementById('skip-selfpromo').checked,
    autoSkip: document.getElementById('master-toggle').checked,
    skipBuffer: 0.5,
    enablePreview: true
  };

  console.log('💾 Salvataggio impostazioni:', settings);

  chrome.storage.local.set({ settings }, () => {
    console.log('✓ Impostazioni salvate con successo');
  });

  sendMessage('updateSettings', settings);
}

function loadAdvancedSettings(advSettings) {
  console.log('🔄 loadAdvancedSettings chiamata con:', advSettings);

  // Confidence Threshold
  const confidenceSlider = document.getElementById('confidence-slider');
  const confidenceValue = document.getElementById('confidence-value');
  confidenceSlider.value = advSettings.confidenceThreshold * 100; // Convert 0.85 to 85
  confidenceValue.textContent = advSettings.confidenceThreshold.toFixed(2);

  // AI Model
  const aiModelSelect = document.getElementById('ai-model');
  console.log('🔄 Impostando aiModel a:', advSettings.aiModel, 'valore attuale:', aiModelSelect.value);
  aiModelSelect.value = advSettings.aiModel;
  console.log('✓ aiModel dopo impostazione:', aiModelSelect.value);

  // Skip Buffer
  const bufferSlider = document.getElementById('buffer-slider');
  const bufferValue = document.getElementById('buffer-value');
  bufferSlider.value = advSettings.skipBuffer * 10; // Convert 0.5 to 5
  bufferValue.textContent = advSettings.skipBuffer.toFixed(1) + 's';

  // Channel Whitelist Count
  const whitelistCount = advSettings.channelWhitelist?.length || 0;
  document.getElementById('whitelist-count').textContent =
    whitelistCount === 0 ? '0 canali esclusi' :
    whitelistCount === 1 ? '1 canale escluso' :
    `${whitelistCount} canali esclusi`;

  console.log('✓ Impostazioni avanzate caricate:', advSettings);
}

function saveAdvancedSettings() {
  const aiModelValue = document.getElementById('ai-model').value;
  console.log('💾 saveAdvancedSettings chiamata, aiModel corrente:', aiModelValue);

  const advSettings = {
    confidenceThreshold: parseFloat(document.getElementById('confidence-slider').value) / 100,
    aiModel: aiModelValue,
    skipBuffer: parseFloat(document.getElementById('buffer-slider').value) / 10,
    channelWhitelist: [] // Verrà aggiornato dalla whitelist manager
  };

  console.log('💾 Impostazioni da salvare (prima di aggiungere whitelist):', advSettings);

  // Carica l'attuale whitelist per non sovrascriverla
  chrome.storage.local.get(['advancedSettings'], (data) => {
    console.log('💾 Dati attuali in storage:', data);

    if (data.advancedSettings?.channelWhitelist) {
      advSettings.channelWhitelist = data.advancedSettings.channelWhitelist;
    }

    console.log('💾 Impostazioni finali da salvare:', advSettings);

    chrome.storage.local.set({ advancedSettings: advSettings }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Errore nel salvataggio:', chrome.runtime.lastError);
        return;
      }

      console.log('✓ Impostazioni avanzate salvate con successo:', advSettings);

      // Verifica immediata
      chrome.storage.local.get(['advancedSettings'], (verifyData) => {
        console.log('🔍 Verifica dati salvati:', verifyData);
      });

      // Notifica content script del cambiamento
      sendMessage('updateAdvancedSettings', advSettings);
    });
  });
}

function openWhitelistManager() {
  const modal = document.getElementById('whitelist-modal');
  modal.classList.add('active');

  // Carica la lista canali
  loadWhitelistChannels();

  // Prova a ottenere il canale corrente dalla tab attiva
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/watch')) {
      // Richiedi il nome del canale al content script
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getCurrentChannel' }, (response) => {
        if (response && response.channelName) {
          const currentChannelInfo = document.getElementById('current-channel-info');
          const currentChannelText = document.getElementById('current-channel-text');
          currentChannelText.textContent = `📺 ${response.channelName}`;
          currentChannelInfo.style.display = 'block';

          // Handler per aggiungere canale corrente
          document.getElementById('add-current-channel-btn').onclick = () => {
            addChannelToWhitelist(response.channelName);
          };
        }
      });
    }
  });
}

function loadWhitelistChannels() {
  chrome.storage.local.get(['advancedSettings'], (data) => {
    const whitelist = data.advancedSettings?.channelWhitelist || [];
    const whitelistList = document.getElementById('whitelist-list');

    if (whitelist.length === 0) {
      whitelistList.innerHTML = '<div class="empty-state">Nessun canale escluso.<br>Aggiungi canali per non analizzarli mai.</div>';
    } else {
      whitelistList.innerHTML = whitelist.map(channel => `
        <div class="whitelist-item">
          <span class="whitelist-item-name">${channel}</span>
          <button class="whitelist-item-remove" data-channel="${channel}">Rimuovi</button>
        </div>
      `).join('');

      // Aggiungi event listeners per i pulsanti rimuovi
      document.querySelectorAll('.whitelist-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const channelToRemove = e.target.getAttribute('data-channel');
          removeChannelFromWhitelist(channelToRemove);
        });
      });
    }
  });
}

function addChannelToWhitelist(channelName) {
  if (!channelName || !channelName.trim()) {
    showToast('Inserisci un nome canale valido', 'warning');
    return;
  }

  chrome.storage.local.get(['advancedSettings'], (data) => {
    const advSettings = data.advancedSettings || {
      confidenceThreshold: 0.85,
      aiModel: 'haiku',
      skipBuffer: 0.5,
      channelWhitelist: []
    };

    if (advSettings.channelWhitelist.includes(channelName.trim())) {
      showToast('Canale già presente nella whitelist', 'warning');
      return;
    }

    advSettings.channelWhitelist.push(channelName.trim());
    chrome.storage.local.set({ advancedSettings: advSettings }, () => {
      loadAdvancedSettings(advSettings);
      loadWhitelistChannels();
      showToast(`Canale "${channelName}" aggiunto alla whitelist`, 'success');

      // Pulisci input
      const input = document.getElementById('channel-input');
      if (input) input.value = '';
    });
  });
}

function removeChannelFromWhitelist(channelName) {
  chrome.storage.local.get(['advancedSettings'], (data) => {
    const advSettings = data.advancedSettings || {
      confidenceThreshold: 0.85,
      aiModel: 'haiku',
      skipBuffer: 0.5,
      channelWhitelist: []
    };

    advSettings.channelWhitelist = advSettings.channelWhitelist.filter(ch => ch !== channelName);
    chrome.storage.local.set({ advancedSettings: advSettings }, () => {
      loadAdvancedSettings(advSettings);
      loadWhitelistChannels();
      showToast(`Canale "${channelName}" rimosso dalla whitelist`, 'info');
    });
  });
}

function sendMessage(action, data = {}) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/watch')) {
      chrome.tabs.sendMessage(tabs[0].id, { action, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('⚠️ Content script non disponibile:', chrome.runtime.lastError.message);
        }
      });
    } else {
      console.log('ℹ️ Non sei su una pagina YouTube - messaggio non inviato');
    }
  });
}

function updateStats(stats) {
  // Formatta tempo risparmiato
  const hours = Math.floor((stats.timeSaved || 0) / 3600);
  const minutes = Math.floor(((stats.timeSaved || 0) % 3600) / 60);
  document.getElementById('time-saved').textContent = `${hours}h ${minutes}m`;

  document.getElementById('segments-skipped').textContent = stats.segmentsSkipped || 0;
  // Non aggiorniamo videos-analyzed qui, lo fa loadCacheInfo()
}

function loadCacheInfo() {
  chrome.storage.local.get(null, (items) => {
    // Filtra solo chiavi analysis_* con array validi
    const cacheKeys = Object.keys(items).filter(key => {
      if (!key.startsWith('analysis_')) return false;
      const value = items[key];
      const isValid = Array.isArray(value) && value.length > 0;
      if (!isValid) {
        console.warn(`⚠️ Chiave cache invalida: ${key}`, value);
      }
      return isValid;
    });

    console.log(`📋 Video in cache: ${cacheKeys.length}`, cacheKeys);

    // Mostra il numero di video in cache
    document.getElementById('cache-size').textContent = cacheKeys.length;

    // Mostra anche nel contatore "Video Analizzati"
    document.getElementById('videos-analyzed').textContent = cacheKeys.length;
  });
}

function loadCurrentVideoInfo() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/watch')) {
      const url = new URL(tabs[0].url);
      currentVideoId = url.searchParams.get('v');

      if (currentVideoId) {
        chrome.storage.local.get(`analysis_${currentVideoId}`, (data) => {
          const analysis = data[`analysis_${currentVideoId}`];
          if (analysis && analysis.length > 0) {
            document.getElementById('current-video-section').style.display = 'block';
            document.getElementById('current-video-title').textContent = tabs[0].title.replace(' - YouTube', '');
            document.getElementById('current-video-segments').textContent =
              `${analysis.length} segmenti rilevati: ${analysis.map(s => s.category).join(', ')}`;
          }
        });
      }
    }
  });
}

// Link footer
document.getElementById('help').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://github.com/yourusername/youtube-smart-skip/wiki' });
});

document.getElementById('privacy').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'privacy.html' });
});

document.getElementById('feedback').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://github.com/yourusername/youtube-smart-skip/issues' });
});

// ========== MODAL EVENT LISTENERS ==========

// Chiudi modal con X
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('whitelist-modal').classList.remove('active');
});

// Chiudi modal cliccando fuori
document.getElementById('whitelist-modal').addEventListener('click', (e) => {
  if (e.target.id === 'whitelist-modal') {
    document.getElementById('whitelist-modal').classList.remove('active');
  }
});

// Aggiungi canale da input
document.getElementById('add-channel-btn').addEventListener('click', () => {
  const channelInput = document.getElementById('channel-input');
  const channelName = channelInput.value.trim();
  if (channelName) {
    addChannelToWhitelist(channelName);
  }
});

// Aggiungi canale con Enter
document.getElementById('channel-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const channelName = e.target.value.trim();
    if (channelName) {
      addChannelToWhitelist(channelName);
    }
  }
});

// ========== TOAST NOTIFICATIONS SYSTEM ==========

function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close">&times;</button>
  `;

  container.appendChild(toast);

  // Close button handler
  toast.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toast);
  });

  // Auto remove after duration
  setTimeout(() => {
    removeToast(toast);
  }, duration);
}

function removeToast(toast) {
  toast.style.animation = 'slideOut 0.3s ease';
  setTimeout(() => {
    toast.remove();
  }, 300);
}

// ========== DARK MODE ==========

// Carica preferenza dark mode
chrome.storage.local.get(['darkMode'], (data) => {
  if (data.darkMode) {
    document.body.classList.add('dark-mode');
    updateDarkModeIcon(true);
  }
});

// Toggle dark mode
document.getElementById('dark-mode-toggle').addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-mode');
  chrome.storage.local.set({ darkMode: isDark });
  updateDarkModeIcon(isDark);
  showToast(isDark ? 'Dark mode attivato' : 'Dark mode disattivato', 'info', 2000);
});

function updateDarkModeIcon(isDark) {
  const toggle = document.getElementById('dark-mode-toggle');
  const icon = toggle.querySelector('.material-icons');
  icon.textContent = isDark ? 'light_mode' : 'dark_mode';
  toggle.title = isDark ? 'Attiva Light Mode' : 'Attiva Dark Mode';
}
