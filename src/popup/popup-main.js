// popup-main.js - Refactored popup script using new infrastructure

import { logger } from '../shared/logger/index.js';
import { StorageService } from '../shared/services/storage-service.js';
import { AnalyticsService } from '../shared/services/analytics-service.js';
import { AdvancedSettings } from '../shared/models/index.js';
import { validateProviderAPIKey } from '../shared/services/providers/index.js';

/**
 * PopupManager - Manages popup UI and interactions
 */
class PopupManager {
  constructor() {
    this.currentVideoId = null;
    this.isLoadingSettings = true;
    this.selectedProvider = 'claude'; // Track selected provider

    // Services
    this.logger = logger.child('PopupManager');
    this.storageService = new StorageService();
    this.analyticsService = new AnalyticsService();

    this.init();
  }

  /**
   * Initialize popup
   */
  async init() {
    try {
      this.logger.info('Initializing popup');

      // Load all data
      await Promise.all([
        this.loadAPIKey(),
        this.loadSettings(),
        this.loadStats(),
        this.loadCacheInfo(),
        this.loadCurrentVideoInfo(),
        this.loadDarkMode()
      ]);

      // Setup event listeners
      this.setupEventListeners();

      // Unlock saves after loading
      setTimeout(() => {
        this.isLoadingSettings = false;
        this.logger.debug('Loading completed - events enabled');
      }, 100);

      this.logger.info('Popup initialized successfully');
    } catch (error) {
      this.logger.error('Initialization failed', { error: error.message });
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const allSettings = await this.storageService.getAllSettings();
      const { settings, advancedSettings } = allSettings;

      // Update UI - Basic settings
      document.getElementById('skip-sponsors').checked = settings.skipSponsors;
      document.getElementById('skip-intros').checked = settings.skipIntros;
      document.getElementById('skip-outros').checked = settings.skipOutros;
      document.getElementById('skip-donations').checked = settings.skipDonations;
      document.getElementById('skip-selfpromo').checked = settings.skipSelfPromo;
      document.getElementById('master-toggle').checked = settings.autoSkip;

      this.updateStatus(settings.autoSkip);

      // Update UI - Advanced settings
      this.loadAdvancedSettingsUI(advancedSettings);

      this.logger.debug('Settings loaded', {
        autoSkip: settings.autoSkip,
        enabled: settings.getEnabledCategories()
      });
    } catch (error) {
      this.logger.error('Failed to load settings', { error: error.message });
    }
  }

  /**
   * Load advanced settings UI
   * @param {AdvancedSettings} advancedSettings - Advanced settings
   */
  loadAdvancedSettingsUI(advancedSettings) {
    // Confidence threshold
    const confidenceSlider = document.getElementById('confidence-slider');
    const confidenceValue = document.getElementById('confidence-value');
    confidenceSlider.value = advancedSettings.confidenceThreshold * 100;
    confidenceValue.textContent = advancedSettings.confidenceThreshold.toFixed(2);

    // AI Model
    const aiModelSelect = document.getElementById('ai-model');
    aiModelSelect.value = advancedSettings.aiModel;

    // Skip buffer
    const bufferSlider = document.getElementById('buffer-slider');
    const bufferValue = document.getElementById('buffer-value');
    bufferSlider.value = advancedSettings.skipBuffer * 10;
    bufferValue.textContent = advancedSettings.skipBuffer.toFixed(1) + 's';

    // Whitelist count
    const whitelistCount = advancedSettings.getWhitelistCount();
    document.getElementById('whitelist-count').textContent =
      whitelistCount === 0 ? '0 excluded channels' :
      whitelistCount === 1 ? '1 excluded channel' :
      `${whitelistCount} excluded channels`;

    this.logger.debug('Advanced settings UI updated', {
      model: advancedSettings.aiModel,
      threshold: advancedSettings.confidenceThreshold
    });
  }

  /**
   * Load statistics
   */
  async loadStats() {
    try {
      const summary = await this.analyticsService.getLifetimeStats();

      if (summary) {
        document.getElementById('time-saved').textContent = summary.formattedTimeSaved;
        document.getElementById('segments-skipped').textContent = summary.totalSkips;

        this.logger.debug('Stats loaded', {
          totalSkips: summary.totalSkips,
          timeSaved: summary.formattedTimeSaved
        });
      }
    } catch (error) {
      this.logger.error('Failed to load stats', { error: error.message });
    }
  }

  /**
   * Load cache info
   */
  async loadCacheInfo() {
    try {
      const stats = await this.storageService.getCacheStatistics();

      document.getElementById('cache-size').textContent = stats.totalEntries;
      document.getElementById('videos-analyzed').textContent = stats.totalEntries;

      this.logger.debug('Cache info loaded', {
        entries: stats.totalEntries,
        segments: stats.totalSegments
      });
    } catch (error) {
      this.logger.error('Failed to load cache info', { error: error.message });
    }
  }

  /**
   * Load current video info
   */
  async loadCurrentVideoInfo() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (!tab || !tab.url || !tab.url.includes('youtube.com/watch')) {
        return;
      }

      const url = new URL(tab.url);
      this.currentVideoId = url.searchParams.get('v');

      if (this.currentVideoId) {
        const result = await this.storageService.getCachedAnalysis(this.currentVideoId);

        if (result && result.segments.length > 0) {
          document.getElementById('current-video-section').style.display = 'block';
          document.getElementById('current-video-title').textContent =
            tab.title.replace(' - YouTube', '');

          const categories = result.segments.map(s => s.category).join(', ');
          document.getElementById('current-video-segments').textContent =
            `${result.segments.length} segments detected: ${categories}`;

          this.logger.debug('Current video info loaded', {
            videoId: this.currentVideoId,
            segments: result.segments.length
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to load current video info', { error: error.message });
    }
  }

  /**
   * Load dark mode preference
   */
  async loadDarkMode() {
    try {
      const data = await chrome.storage.local.get(['darkMode']);
      if (data.darkMode) {
        document.body.classList.add('dark-mode');
        this.updateDarkModeIcon(true);
      }
    } catch (error) {
      this.logger.error('Failed to load dark mode', { error: error.message });
    }
  }

  /**
   * Load API keys and provider selection from storage
   */
  async loadAPIKey() {
    try {
      // Load provider from advanced settings
      const advancedSettings = await this.storageService.getAdvancedSettings();
      this.selectedProvider = advancedSettings.aiProvider || 'claude';

      // Update provider selector
      document.getElementById('ai-provider-select').value = this.selectedProvider;

      // Load both API keys
      const data = await chrome.storage.local.get(['claudeApiKey', 'openaiApiKey', 'apiKey']);

      // Handle legacy single API key (migrate to Claude)
      if (data.apiKey && !data.claudeApiKey) {
        await chrome.storage.local.set({ claudeApiKey: data.apiKey });
        data.claudeApiKey = data.apiKey;
        this.logger.info('Migrated legacy API key');
      }

      // Load Claude API key
      if (data.claudeApiKey && data.claudeApiKey.length >= 20) {
        document.getElementById('claude-api-key-input').value = data.claudeApiKey;
        this.updateAPIKeyStatus('claude', true);
        this.logger.info('Claude API key loaded');
      } else {
        this.updateAPIKeyStatus('claude', false);
      }

      // Load OpenAI API key
      if (data.openaiApiKey && data.openaiApiKey.length >= 20) {
        document.getElementById('openai-api-key-input').value = data.openaiApiKey;
        this.updateAPIKeyStatus('openai', true);
        this.logger.info('OpenAI API key loaded');
      } else {
        this.updateAPIKeyStatus('openai', false);
      }

      // Update UI for selected provider
      this.updateProviderUI();

    } catch (error) {
      this.logger.error('Failed to load API keys', { error: error.message });
      this.updateAPIKeyStatus('claude', false);
      this.updateAPIKeyStatus('openai', false);
    }
  }

  /**
   * Update API key status indicator for a specific provider
   * @param {string} provider - Provider name ('claude' or 'openai')
   * @param {boolean} isConfigured - Whether API key is configured
   */
  updateAPIKeyStatus(provider, isConfigured) {
    const statusEl = document.getElementById(`${provider}-api-key-status`);

    if (statusEl) {
      if (isConfigured) {
        statusEl.textContent = 'Configured';
        statusEl.style.background = '#00aa00';
      } else {
        statusEl.textContent = 'Not Configured';
        statusEl.style.background = '#ff0000';
      }
    }
  }

  /**
   * Validate API key format for a specific provider
   * @param {string} provider - Provider name
   * @param {string} apiKey - API key to validate
   * @returns {boolean}
   */
  validateAPIKey(provider, apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Minimum length check
    if (apiKey.length < 20) {
      return false;
    }

    // Use provider-specific validation
    return validateProviderAPIKey(provider, apiKey);
  }

  /**
   * Save API key for specific provider
   * @param {string} provider - Provider name
   */
  async saveAPIKey(provider) {
    try {
      const inputId = `${provider}-api-key-input`;
      const apiKey = document.getElementById(inputId).value.trim();

      // Validate format
      if (!this.validateAPIKey(provider, apiKey)) {
        const providerName = provider === 'claude' ? 'Claude (sk-ant-)' : 'OpenAI (sk-)';
        this.showToast(`Invalid ${providerName} API key format`, 'error', 5000);
        return;
      }

      // Save to storage
      const storageKey = `${provider}ApiKey`;
      await chrome.storage.local.set({ [storageKey]: apiKey });

      // Notify background service
      chrome.runtime.sendMessage(
        { action: 'updateAPIKey', data: { provider, apiKey } },
        (response) => {
          if (chrome.runtime.lastError) {
            this.logger.error('Failed to notify background', {
              error: chrome.runtime.lastError.message
            });
            this.showToast('Failed to update background service', 'error');
            return;
          }

          if (response && response.success) {
            this.updateAPIKeyStatus(provider, true);
            this.showToast(`${provider === 'claude' ? 'Claude' : 'OpenAI'} API key saved!`, 'success');
            this.logger.info(`${provider} API key saved`);
          } else {
            this.showToast('Failed to update API key', 'error');
          }
        }
      );
    } catch (error) {
      this.logger.error('Failed to save API key', { error: error.message });
      this.showToast('Failed to save API key', 'error');
    }
  }

  /**
   * Update provider UI (show/hide sections and models)
   */
  updateProviderUI() {
    // Show/hide API key sections
    const claudeSection = document.getElementById('claude-api-key-section');
    const openaiSection = document.getElementById('openai-api-key-section');

    if (this.selectedProvider === 'claude') {
      claudeSection.style.display = 'flex';
      openaiSection.style.display = 'none';
    } else {
      claudeSection.style.display = 'none';
      openaiSection.style.display = 'flex';
    }

    // Update AI model options
    const modelSelect = document.getElementById('ai-model');
    const options = modelSelect.querySelectorAll('option');

    options.forEach(option => {
      const optionProvider = option.getAttribute('data-provider');
      if (optionProvider === this.selectedProvider) {
        option.style.display = '';
        option.disabled = false;
      } else {
        option.style.display = 'none';
        option.disabled = true;
      }
    });

    // Set default model for provider if current is invalid
    const currentModel = modelSelect.value;
    const currentModelOption = modelSelect.querySelector(`option[value="${currentModel}"]`);

    if (!currentModelOption || currentModelOption.getAttribute('data-provider') !== this.selectedProvider) {
      // Select first available model for provider
      const firstAvailable = modelSelect.querySelector(`option[data-provider="${this.selectedProvider}"]`);
      if (firstAvailable) {
        modelSelect.value = firstAvailable.value;
      }
    }
  }

  /**
   * Handle provider change
   * @param {string} newProvider - New provider
   */
  async handleProviderChange(newProvider) {
    try {
      this.selectedProvider = newProvider;

      // Update UI
      this.updateProviderUI();

      // Save to advanced settings
      const current = await this.storageService.getAdvancedSettings();
      const updated = current.merge({ aiProvider: newProvider });
      await this.storageService.saveAdvancedSettings(updated);

      // Notify background service
      chrome.runtime.sendMessage(
        { action: 'updateProvider', provider: newProvider },
        (response) => {
          if (!chrome.runtime.lastError && response?.success) {
            this.logger.info(`Provider changed to ${newProvider}`);
          }
        }
      );

      this.showToast(`Switched to ${newProvider === 'claude' ? 'Claude' : 'OpenAI'}`, 'success');
    } catch (error) {
      this.logger.error('Failed to change provider', { error: error.message });
      this.showToast('Failed to change provider', 'error');
    }
  }

  /**
   * Toggle API key visibility for specific provider
   * @param {string} provider - Provider name
   */
  toggleAPIKeyVisibility(provider) {
    const input = document.getElementById(`${provider}-api-key-input`);
    const button = document.getElementById(`toggle-${provider}-api-key-visibility`);
    const icon = button.querySelector('.material-icons');

    if (input.type === 'password') {
      input.type = 'text';
      icon.textContent = 'visibility_off';
    } else {
      input.type = 'password';
      icon.textContent = 'visibility';
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // AI Provider selection
    document.getElementById('ai-provider-select').addEventListener('change', (e) => {
      this.handleProviderChange(e.target.value);
    });

    // Claude API Key management
    document.getElementById('save-claude-api-key-btn').addEventListener('click', () => {
      this.saveAPIKey('claude');
    });

    document.getElementById('toggle-claude-api-key-visibility').addEventListener('click', () => {
      this.toggleAPIKeyVisibility('claude');
    });

    document.getElementById('claude-api-key-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveAPIKey('claude');
      }
    });

    // OpenAI API Key management
    document.getElementById('save-openai-api-key-btn').addEventListener('click', () => {
      this.saveAPIKey('openai');
    });

    document.getElementById('toggle-openai-api-key-visibility').addEventListener('click', () => {
      this.toggleAPIKeyVisibility('openai');
    });

    document.getElementById('openai-api-key-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveAPIKey('openai');
      }
    });

    // Master toggle
    document.getElementById('master-toggle').addEventListener('change', (e) => {
      if (this.isLoadingSettings) return;
      this.updateStatus(e.target.checked);
      this.saveSettings();
    });

    // Category checkboxes
    ['skip-sponsors', 'skip-intros', 'skip-outros', 'skip-donations', 'skip-selfpromo']
      .forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
          if (this.isLoadingSettings) return;
          this.saveSettings();
        });
      });

    // Advanced settings
    document.getElementById('confidence-slider').addEventListener('input', (e) => {
      if (this.isLoadingSettings) return;
      const value = e.target.value / 100;
      document.getElementById('confidence-value').textContent = value.toFixed(2);
      this.saveAdvancedSettings();
    });

    document.getElementById('ai-model').addEventListener('change', () => {
      if (this.isLoadingSettings) return;
      this.saveAdvancedSettings();
    });

    document.getElementById('buffer-slider').addEventListener('input', (e) => {
      if (this.isLoadingSettings) return;
      const value = e.target.value / 10;
      document.getElementById('buffer-value').textContent = value.toFixed(1) + 's';
      this.saveAdvancedSettings();
    });

    // Buttons
    document.getElementById('manual-analyze').addEventListener('click', () => {
      this.handleManualAnalyze();
    });

    document.getElementById('view-cache').addEventListener('click', () => {
      this.openCacheViewer();
    });

    document.getElementById('clear-current-cache').addEventListener('click', () => {
      this.clearCurrentCache();
    });

    document.getElementById('clear-all-cache').addEventListener('click', () => {
      this.clearAllCache();
    });

    document.getElementById('whitelist-btn').addEventListener('click', () => {
      this.openWhitelistManager();
    });

    document.getElementById('dark-mode-toggle').addEventListener('click', () => {
      this.toggleDarkMode();
    });

    // Modal
    document.getElementById('modal-close').addEventListener('click', () => {
      this.closeWhitelistModal();
    });

    document.getElementById('whitelist-modal').addEventListener('click', (e) => {
      if (e.target.id === 'whitelist-modal') {
        this.closeWhitelistModal();
      }
    });

    document.getElementById('add-channel-btn').addEventListener('click', () => {
      const input = document.getElementById('channel-input');
      this.addChannelToWhitelist(input.value.trim());
    });

    document.getElementById('channel-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addChannelToWhitelist(e.target.value.trim());
      }
    });

    // Footer links
    document.getElementById('help').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
    });

    document.getElementById('privacy').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://github.com/ChromuSx/SkipTubeAI/blob/main/PRIVACY.md' });
    });

    document.getElementById('feedback').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://github.com/ChromuSx/SkipTubeAI/issues' });
    });

    this.logger.debug('Event listeners configured');
  }

  /**
   * Update status indicator
   * @param {boolean} isActive - Active status
   */
  updateStatus(isActive) {
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

  /**
   * Save settings
   */
  async saveSettings() {
    try {
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

      await this.storageService.updateSettings(settings);

      // Notify content script
      this.sendMessageToContentScript('updateSettings', settings);

      this.logger.info('Settings saved', settings);
    } catch (error) {
      this.logger.error('Failed to save settings', { error: error.message });
      this.showToast('Failed to save settings', 'error');
    }
  }

  /**
   * Save advanced settings
   */
  async saveAdvancedSettings() {
    try {
      // Get current whitelist first
      const current = await this.storageService.getAdvancedSettings();

      const advSettings = {
        confidenceThreshold: parseFloat(document.getElementById('confidence-slider').value) / 100,
        aiModel: document.getElementById('ai-model').value,
        skipBuffer: parseFloat(document.getElementById('buffer-slider').value) / 10,
        channelWhitelist: current.channelWhitelist // Preserve whitelist
      };

      await this.storageService.saveAdvancedSettings(
        AdvancedSettings.fromJSON(advSettings)
      );

      // Notify content script
      this.sendMessageToContentScript('updateAdvancedSettings', advSettings);

      this.logger.info('Advanced settings saved', advSettings);
    } catch (error) {
      this.logger.error('Failed to save advanced settings', { error: error.message });
      this.showToast('Failed to save advanced settings', 'error');
    }
  }

  /**
   * Handle manual analyze
   */
  async handleManualAnalyze() {
    if (!this.currentVideoId) {
      this.showToast('No active video', 'warning');
      return;
    }

    try {
      await this.storageService.invalidateCache(this.currentVideoId);
      this.sendMessageToContentScript('manualAnalyze');
      setTimeout(() => window.close(), 500);
    } catch (error) {
      this.logger.error('Failed to trigger manual analyze', { error: error.message });
      this.showToast('Failed to start analysis', 'error');
    }
  }

  /**
   * Open cache viewer
   */
  openCacheViewer() {
    const url = chrome.runtime.getURL('cache-viewer.html');
    chrome.tabs.create({ url }, (tab) => {
      if (chrome.runtime.lastError) {
        this.logger.error('Failed to open cache viewer', {
          error: chrome.runtime.lastError.message
        });
        this.showToast('Error opening cache page', 'error');
      }
    });
  }

  /**
   * Clear current video cache
   */
  async clearCurrentCache() {
    if (!this.currentVideoId) {
      this.showToast('No active YouTube video', 'warning');
      return;
    }

    if (!confirm('Clear cache for this video?')) {
      return;
    }

    try {
      await this.storageService.invalidateCache(this.currentVideoId);
      this.showToast('Video cache cleared! Reload page to reanalyze', 'success');
      await this.loadCacheInfo();
    } catch (error) {
      this.logger.error('Failed to clear current cache', { error: error.message });
      this.showToast('Failed to clear cache', 'error');
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    if (!confirm('⚠️ WARNING: Clear ALL cache?\n\nAll videos will need to be reanalyzed.')) {
      return;
    }

    try {
      await this.storageService.clearCache();
      const stats = await this.storageService.getCacheStatistics();
      this.showToast(`Cache cleared!`, 'success');
      await this.loadCacheInfo();
    } catch (error) {
      this.logger.error('Failed to clear all cache', { error: error.message });
      this.showToast('Failed to clear cache', 'error');
    }
  }

  /**
   * Open whitelist manager
   */
  async openWhitelistManager() {
    const modal = document.getElementById('whitelist-modal');
    modal.classList.add('active');

    await this.loadWhitelistChannels();

    // Try to get current channel
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/watch')) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getCurrentChannel' }, (response) => {
        if (response && response.channelName) {
          const currentChannelInfo = document.getElementById('current-channel-info');
          const currentChannelText = document.getElementById('current-channel-text');
          currentChannelText.textContent = `📺 ${response.channelName}`;
          currentChannelInfo.style.display = 'block';

          document.getElementById('add-current-channel-btn').onclick = () => {
            this.addChannelToWhitelist(response.channelName);
          };
        }
      });
    }
  }

  /**
   * Close whitelist modal
   */
  closeWhitelistModal() {
    document.getElementById('whitelist-modal').classList.remove('active');
  }

  /**
   * Load whitelist channels
   */
  async loadWhitelistChannels() {
    try {
      const advSettings = await this.storageService.getAdvancedSettings();
      const whitelist = advSettings.channelWhitelist;
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

        // Add remove handlers
        document.querySelectorAll('.whitelist-item-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            this.removeChannelFromWhitelist(e.target.getAttribute('data-channel'));
          });
        });
      }
    } catch (error) {
      this.logger.error('Failed to load whitelist', { error: error.message });
    }
  }

  /**
   * Add channel to whitelist
   * @param {string} channelName - Channel name
   */
  async addChannelToWhitelist(channelName) {
    if (!channelName || !channelName.trim()) {
      this.showToast('Enter a valid channel name', 'warning');
      return;
    }

    try {
      await this.storageService.addToWhitelist(channelName.trim());

      const advSettings = await this.storageService.getAdvancedSettings();
      this.loadAdvancedSettingsUI(advSettings);
      await this.loadWhitelistChannels();

      this.showToast(`Channel "${channelName}" added to whitelist`, 'success');

      const input = document.getElementById('channel-input');
      if (input) input.value = '';
    } catch (error) {
      this.logger.error('Failed to add channel', { error: error.message });
      this.showToast('Channel already in whitelist', 'warning');
    }
  }

  /**
   * Remove channel from whitelist
   * @param {string} channelName - Channel name
   */
  async removeChannelFromWhitelist(channelName) {
    try {
      await this.storageService.removeFromWhitelist(channelName);

      const advSettings = await this.storageService.getAdvancedSettings();
      this.loadAdvancedSettingsUI(advSettings);
      await this.loadWhitelistChannels();

      this.showToast(`Channel "${channelName}" removed`, 'info');
    } catch (error) {
      this.logger.error('Failed to remove channel', { error: error.message });
      this.showToast('Failed to remove channel', 'error');
    }
  }

  /**
   * Toggle dark mode
   */
  async toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    await chrome.storage.local.set({ darkMode: isDark });
    this.updateDarkModeIcon(isDark);
    this.showToast(isDark ? 'Dark mode enabled' : 'Dark mode disabled', 'info', 2000);
  }

  /**
   * Update dark mode icon
   * @param {boolean} isDark - Dark mode status
   */
  updateDarkModeIcon(isDark) {
    const toggle = document.getElementById('dark-mode-toggle');
    const icon = toggle.querySelector('.material-icons');
    icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    toggle.title = isDark ? 'Enable Light Mode' : 'Enable Dark Mode';
  }

  /**
   * Send message to content script
   * @param {string} action - Action
   * @param {Object} data - Data
   */
  sendMessageToContentScript(action, data = {}) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/watch')) {
        chrome.tabs.sendMessage(tabs[0].id, { action, ...data }, (response) => {
          if (chrome.runtime.lastError) {
            this.logger.debug('Content script not available', {
              error: chrome.runtime.lastError.message
            });
          }
        });
      }
    });
  }

  /**
   * Show toast notification
   * @param {string} message - Message
   * @param {string} type - Type
   * @param {number} duration - Duration in ms
   */
  showToast(message, type = 'info', duration = 3000) {
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

    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.removeToast(toast);
    });

    setTimeout(() => {
      this.removeToast(toast);
    }, duration);
  }

  /**
   * Remove toast
   * @param {HTMLElement} toast - Toast element
   */
  removeToast(toast) {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
  });
} else {
  new PopupManager();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PopupManager };
}
