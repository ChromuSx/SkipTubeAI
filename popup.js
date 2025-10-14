// popup.js - Extension popup script
let currentVideoId = null;
let isLoadingSettings = true; // Flag to prevent saves during loading

// Load saved settings
chrome.storage.local.get(['settings', 'stats', 'advancedSettings'], (data) => {
  console.log('📊 Data loaded from popup:', data);

  // Use saved values, or defaults if they don't exist
  const settings = data.settings || {};

  // Helper: use default=true only if undefined
  const getDefault = (val) => val === undefined ? true : val;

  document.getElementById('skip-sponsors').checked = getDefault(settings.skipSponsors);
  document.getElementById('skip-intros').checked = getDefault(settings.skipIntros);
  document.getElementById('skip-outros').checked = getDefault(settings.skipOutros);
  document.getElementById('skip-donations').checked = getDefault(settings.skipDonations);
  document.getElementById('skip-selfpromo').checked = getDefault(settings.skipSelfPromo);
  document.getElementById('master-toggle').checked = getDefault(settings.autoSkip);

  updateStatus(getDefault(settings.autoSkip));

  console.log('✓ UI settings updated:', {
    skipSponsors: document.getElementById('skip-sponsors').checked,
    skipIntros: document.getElementById('skip-intros').checked,
    skipOutros: document.getElementById('skip-outros').checked,
    skipDonations: document.getElementById('skip-donations').checked,
    skipSelfPromo: document.getElementById('skip-selfpromo').checked,
    autoSkip: document.getElementById('master-toggle').checked
  });

  // Load advanced settings
  const advSettings = data.advancedSettings || {
    confidenceThreshold: 0.85,
    aiModel: 'haiku',
    skipBuffer: 0.5,
    channelWhitelist: []
  };
  loadAdvancedSettings(advSettings);

  if (data.stats) {
    console.log('✓ Statistics found:', data.stats);
    updateStats(data.stats);
  } else {
    console.log('⚠️ No statistics found in storage');
  }

  // loadCacheInfo must be called AFTER updateStats to override videosAnalyzed
  loadCacheInfo();
  loadCurrentVideoInfo();

  // Unlock saves after everything is loaded
  setTimeout(() => {
    isLoadingSettings = false;
    console.log('✓ Loading completed - events enabled');
  }, 100);
});

// Event handlers
document.getElementById('master-toggle').addEventListener('change', (e) => {
  if (isLoadingSettings) {
    console.log('⏳ Loading in progress - event ignored');
    return;
  }
  const isActive = e.target.checked;
  console.log('✓ Master toggle changed:', isActive);
  updateStatus(isActive);
  saveSettings();
});

// Handlers for each checkbox - use 'click' instead of 'change' to also capture clicks on the label
['skip-sponsors', 'skip-intros', 'skip-outros', 'skip-donations', 'skip-selfpromo']
  .forEach(id => {
    const checkbox = document.getElementById(id);
    checkbox.addEventListener('change', () => {
      if (isLoadingSettings) {
        console.log('⏳ Loading in progress - event ignored');
        return;
      }
      console.log(`✓ Checkbox ${id} changed:`, checkbox.checked);
      saveSettings();
    });
  });

document.getElementById('manual-analyze').addEventListener('click', () => {
  if (currentVideoId) {
    // Clear current video cache and reanalyze
    chrome.storage.local.remove(`analysis_${currentVideoId}`, () => {
      sendMessage('manualAnalyze');
      setTimeout(() => window.close(), 500);
    });
  }
});

document.getElementById('view-cache').addEventListener('click', () => {
  const url = chrome.runtime.getURL('cache-viewer.html');
  console.log('Opening cache viewer:', url);
  chrome.tabs.create({ url: url }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('Error opening cache viewer:', chrome.runtime.lastError);
      showToast('Error opening cache page: ' + chrome.runtime.lastError.message, 'error');
    }
  });
});

document.getElementById('clear-current-cache').addEventListener('click', () => {
  if (!currentVideoId) {
    showToast('No active YouTube video in current tab', 'warning');
    return;
  }

  if (confirm('Clear cache for this video?')) {
    chrome.storage.local.remove(`analysis_${currentVideoId}`, () => {
      showToast('Video cache cleared! Reload the page to reanalyze', 'success');
      loadCacheInfo();
    });
  }
});

document.getElementById('clear-all-cache').addEventListener('click', () => {
  if (confirm('⚠️ WARNING: Clear ALL cache?\n\nAll videos will need to be reanalyzed.')) {
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = Object.keys(items).filter(key => key.startsWith('analysis_'));
      chrome.storage.local.remove(keysToRemove, () => {
        showToast(`${keysToRemove.length} videos removed from cache!`, 'success');
        loadCacheInfo();
      });
    });
  }
});

// ========== ADVANCED SETTINGS EVENT LISTENERS ==========

// Confidence Threshold Slider
document.getElementById('confidence-slider').addEventListener('input', (e) => {
  if (isLoadingSettings) {
    console.log('⏳ Loading in progress - event ignored');
    return;
  }
  const value = e.target.value / 100; // Convert 50-100 to 0.5-1.0
  document.getElementById('confidence-value').textContent = value.toFixed(2);
  saveAdvancedSettings();
});

// AI Model Selection
document.getElementById('ai-model').addEventListener('change', (e) => {
  if (isLoadingSettings) {
    console.log('⏳ Loading in progress - event ignored');
    return;
  }
  console.log('🤖 AI model changed:', e.target.value);
  saveAdvancedSettings();
});

// Skip Buffer Slider
document.getElementById('buffer-slider').addEventListener('input', (e) => {
  if (isLoadingSettings) {
    console.log('⏳ Loading in progress - event ignored');
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
    statusText.textContent = 'Active';
  } else {
    statusDot.classList.remove('active');
    statusDot.classList.add('inactive');
    statusText.textContent = 'Inactive';
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

  console.log('💾 Saving settings:', settings);

  chrome.storage.local.set({ settings }, () => {
    console.log('✓ Settings saved successfully');
  });

  sendMessage('updateSettings', settings);
}

function loadAdvancedSettings(advSettings) {
  console.log('🔄 loadAdvancedSettings called with:', advSettings);

  // Confidence Threshold
  const confidenceSlider = document.getElementById('confidence-slider');
  const confidenceValue = document.getElementById('confidence-value');
  confidenceSlider.value = advSettings.confidenceThreshold * 100; // Convert 0.85 to 85
  confidenceValue.textContent = advSettings.confidenceThreshold.toFixed(2);

  // AI Model
  const aiModelSelect = document.getElementById('ai-model');
  console.log('🔄 Setting aiModel to:', advSettings.aiModel, 'current value:', aiModelSelect.value);
  aiModelSelect.value = advSettings.aiModel;
  console.log('✓ aiModel after setting:', aiModelSelect.value);

  // Skip Buffer
  const bufferSlider = document.getElementById('buffer-slider');
  const bufferValue = document.getElementById('buffer-value');
  bufferSlider.value = advSettings.skipBuffer * 10; // Convert 0.5 to 5
  bufferValue.textContent = advSettings.skipBuffer.toFixed(1) + 's';

  // Channel Whitelist Count
  const whitelistCount = advSettings.channelWhitelist?.length || 0;
  document.getElementById('whitelist-count').textContent =
    whitelistCount === 0 ? '0 excluded channels' :
    whitelistCount === 1 ? '1 excluded channel' :
    `${whitelistCount} excluded channels`;

  console.log('✓ Advanced settings loaded:', advSettings);
}

function saveAdvancedSettings() {
  const aiModelValue = document.getElementById('ai-model').value;
  console.log('💾 saveAdvancedSettings called, current aiModel:', aiModelValue);

  const advSettings = {
    confidenceThreshold: parseFloat(document.getElementById('confidence-slider').value) / 100,
    aiModel: aiModelValue,
    skipBuffer: parseFloat(document.getElementById('buffer-slider').value) / 10,
    channelWhitelist: [] // Will be updated by whitelist manager
  };

  console.log('💾 Settings to save (before adding whitelist):', advSettings);

  // Load current whitelist to not overwrite it
  chrome.storage.local.get(['advancedSettings'], (data) => {
    console.log('💾 Current data in storage:', data);

    if (data.advancedSettings?.channelWhitelist) {
      advSettings.channelWhitelist = data.advancedSettings.channelWhitelist;
    }

    console.log('💾 Final settings to save:', advSettings);

    chrome.storage.local.set({ advancedSettings: advSettings }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error saving:', chrome.runtime.lastError);
        return;
      }

      console.log('✓ Advanced settings saved successfully:', advSettings);

      // Immediate verification
      chrome.storage.local.get(['advancedSettings'], (verifyData) => {
        console.log('🔍 Verify saved data:', verifyData);
      });

      // Notify content script of the change
      sendMessage('updateAdvancedSettings', advSettings);
    });
  });
}

function openWhitelistManager() {
  const modal = document.getElementById('whitelist-modal');
  modal.classList.add('active');

  // Load channels list
  loadWhitelistChannels();

  // Try to get current channel from active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/watch')) {
      // Request channel name from content script
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getCurrentChannel' }, (response) => {
        if (response && response.channelName) {
          const currentChannelInfo = document.getElementById('current-channel-info');
          const currentChannelText = document.getElementById('current-channel-text');
          currentChannelText.textContent = `📺 ${response.channelName}`;
          currentChannelInfo.style.display = 'block';

          // Handler to add current channel
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
      whitelistList.innerHTML = '<div class="empty-state">No excluded channels.<br>Add channels to never analyze them.</div>';
    } else {
      whitelistList.innerHTML = whitelist.map(channel => `
        <div class="whitelist-item">
          <span class="whitelist-item-name">${channel}</span>
          <button class="whitelist-item-remove" data-channel="${channel}">Remove</button>
        </div>
      `).join('');

      // Add event listeners for remove buttons
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
    showToast('Enter a valid channel name', 'warning');
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
      showToast('Channel already in whitelist', 'warning');
      return;
    }

    advSettings.channelWhitelist.push(channelName.trim());
    chrome.storage.local.set({ advancedSettings: advSettings }, () => {
      loadAdvancedSettings(advSettings);
      loadWhitelistChannels();
      showToast(`Channel "${channelName}" added to whitelist`, 'success');

      // Clear input
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
      showToast(`Channel "${channelName}" removed from whitelist`, 'info');
    });
  });
}

function sendMessage(action, data = {}) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/watch')) {
      chrome.tabs.sendMessage(tabs[0].id, { action, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('⚠️ Content script not available:', chrome.runtime.lastError.message);
        }
      });
    } else {
      console.log('ℹ️ Not on a YouTube page - message not sent');
    }
  });
}

function updateStats(stats) {
  // Format time saved
  const hours = Math.floor((stats.timeSaved || 0) / 3600);
  const minutes = Math.floor(((stats.timeSaved || 0) % 3600) / 60);
  document.getElementById('time-saved').textContent = `${hours}h ${minutes}m`;

  document.getElementById('segments-skipped').textContent = stats.segmentsSkipped || 0;
  // Don't update videos-analyzed here, loadCacheInfo() does it
}

function loadCacheInfo() {
  chrome.storage.local.get(null, (items) => {
    // Filter only analysis_* keys with valid arrays
    const cacheKeys = Object.keys(items).filter(key => {
      if (!key.startsWith('analysis_')) return false;
      const value = items[key];
      const isValid = Array.isArray(value) && value.length > 0;
      if (!isValid) {
        console.warn(`⚠️ Invalid cache key: ${key}`, value);
      }
      return isValid;
    });

    console.log(`📋 Videos in cache: ${cacheKeys.length}`, cacheKeys);

    // Show number of videos in cache
    document.getElementById('cache-size').textContent = cacheKeys.length;

    // Also show in "Videos Analyzed" counter
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
              `${analysis.length} segments detected: ${analysis.map(s => s.category).join(', ')}`;
          }
        });
      }
    }
  });
}

// Footer links
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

// Close modal with X
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('whitelist-modal').classList.remove('active');
});

// Close modal by clicking outside
document.getElementById('whitelist-modal').addEventListener('click', (e) => {
  if (e.target.id === 'whitelist-modal') {
    document.getElementById('whitelist-modal').classList.remove('active');
  }
});

// Add channel from input
document.getElementById('add-channel-btn').addEventListener('click', () => {
  const channelInput = document.getElementById('channel-input');
  const channelName = channelInput.value.trim();
  if (channelName) {
    addChannelToWhitelist(channelName);
  }
});

// Add channel with Enter
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

// Load dark mode preference
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
  showToast(isDark ? 'Dark mode enabled' : 'Dark mode disabled', 'info', 2000);
});

function updateDarkModeIcon(isDark) {
  const toggle = document.getElementById('dark-mode-toggle');
  const icon = toggle.querySelector('.material-icons');
  icon.textContent = isDark ? 'light_mode' : 'dark_mode';
  toggle.title = isDark ? 'Enable Light Mode' : 'Enable Dark Mode';
}
