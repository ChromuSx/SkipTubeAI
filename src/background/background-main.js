// background-main.js - Refactored background service worker using new infrastructure

import { logger, LogLevel } from '../shared/logger/index.js';
import { AIService } from '../shared/services/ai-service.js';
import { createProvider } from '../shared/services/providers/index.js';
import { StorageService } from '../shared/services/storage-service.js';
import { AnalyticsService } from '../shared/services/analytics-service.js';
import { Transcript, AnalysisResult } from '../shared/models/index.js';
import { CONFIG } from '../shared/config.js';
import {
  APIKeyError,
  TranscriptNotAvailableError,
  StorageError
} from '../shared/errors/index.js';

/**
 * BackgroundService - Main background service worker
 */
class BackgroundService {
  constructor() {
    // API Configuration
    this.API_KEYS = {
      claude: null,
      openai: null
    };
    this.selectedProvider = 'claude'; // Default provider

    // Initialize services
    this.logger = logger.child('BackgroundService');
    this.storageService = new StorageService();
    this.analyticsService = new AnalyticsService();

    // AI service will be initialized after loading API keys
    this.aiService = null;

    // Track initialization state
    this.isInitialized = false;
    this.initializationPromise = null;

    // Setup message listener FIRST (synchronously) to avoid race conditions
    // This ensures the listener is ready even if initialization is still in progress
    this.setupMessageListener();

    // Initialize async (API keys, AI service, maintenance)
    this.initializationPromise = this.initialize();
  }

  /**
   * Initialize background service (async)
   */
  async initialize() {
    try {
      // Load API key from storage
      await this.loadAPIKey();

      this.schedulePeriodicMaintenance();

      this.isInitialized = true;

      this.logger.info('Background service initialized', {
        selectedProvider: this.selectedProvider,
        hasClaudeKey: !!this.API_KEYS.claude,
        hasOpenAIKey: !!this.API_KEYS.openai,
        hasAIService: !!this.aiService
      });
    } catch (error) {
      this.logger.error('Failed to initialize background service', {
        error: error.message
      });
    }
  }

  /**
   * Ensure initialization is complete
   * @returns {Promise<void>}
   */
  async ensureInitialized() {
    if (this.isInitialized) {
      return;
    }

    this.logger.debug('Waiting for initialization to complete');
    await this.initializationPromise;
  }

  /**
   * Load API keys and provider selection from storage
   */
  async loadAPIKey() {
    try {
      // Load settings to get provider selection
      const advancedSettings = await this.storageService.getAdvancedSettings();
      this.selectedProvider = advancedSettings.aiProvider || 'claude';

      // Load API keys for both providers
      const data = await chrome.storage.local.get(['claudeApiKey', 'openaiApiKey', 'apiKey']);

      // Handle legacy single API key (assumed to be Claude)
      if (data.apiKey && data.apiKey.length >= 20 && !data.claudeApiKey) {
        this.API_KEYS.claude = data.apiKey;
        // Migrate to new format
        await chrome.storage.local.set({ claudeApiKey: data.apiKey });
        await chrome.storage.local.remove('apiKey');
        this.logger.info('Migrated legacy API key to Claude key');
      }

      // Load provider-specific keys
      if (data.claudeApiKey && data.claudeApiKey.length >= 20) {
        this.API_KEYS.claude = data.claudeApiKey;
        this.logger.info('Claude API key loaded');
      }

      if (data.openaiApiKey && data.openaiApiKey.length >= 20) {
        this.API_KEYS.openai = data.openaiApiKey;
        this.logger.info('OpenAI API key loaded');
      }

      // Initialize AI service with selected provider
      await this.initializeAIService();

    } catch (error) {
      this.logger.error('Failed to load API keys', {
        error: error.message
      });
    }
  }

  /**
   * Initialize AI service with selected provider
   */
  async initializeAIService() {
    try {
      this.logger.debug('Starting AI service initialization', {
        provider: this.selectedProvider
      });

      const apiKey = this.API_KEYS[this.selectedProvider];

      if (!apiKey || apiKey.length < 20) {
        this.logger.warn(`No valid API key for provider: ${this.selectedProvider}`);
        this.aiService = null;
        return;
      }

      this.logger.debug('API key found, creating provider', {
        provider: this.selectedProvider,
        keyLength: apiKey.length
      });

      // Get provider config
      const providerConfig = this.selectedProvider === 'claude'
        ? CONFIG.AI_PROVIDERS.CLAUDE
        : CONFIG.AI_PROVIDERS.OPENAI;

      this.logger.debug('Provider config loaded', {
        endpoint: providerConfig.ENDPOINT
      });

      // Create provider instance
      const provider = createProvider(
        this.selectedProvider,
        apiKey,
        {
          baseUrl: providerConfig.ENDPOINT,
          timeout: providerConfig.TIMEOUT,
          version: providerConfig.VERSION
        }
      );

      this.logger.debug('Provider instance created');

      // Initialize AI service with provider
      this.aiService = new AIService(provider);

      this.logger.info('AI service initialized successfully', {
        provider: this.selectedProvider
      });

    } catch (error) {
      this.logger.error('Failed to initialize AI service', {
        error: error.message,
        stack: error.stack,
        provider: this.selectedProvider
      });
      this.aiService = null;
    }
  }

  /**
   * Setup message listener for content script communication
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.logger.debug('Message received', {
        action: request.action,
        tabId: sender.tab?.id
      });

      if (request.action === 'analyzeTranscript') {
        // Wait for initialization to complete before processing
        this.ensureInitialized()
          .then(() => this.handleTranscriptAnalysis(request.data))
          .then(result => sendResponse(result))
          .catch(error => {
            this.logger.error('Analysis failed', {
              error: error.message,
              stack: error.stack
            });
            sendResponse({
              success: false,
              error: error.message
            });
          });
        return true; // Keep channel open for async response
      }

      if (request.action === 'updateAPIKey') {
        this.handleAPIKeyUpdate(request.data || request.apiKey)
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            this.logger.error('API key update failed', {
              error: error.message
            });
            sendResponse({
              success: false,
              error: error.message
            });
          });
        return true; // Keep channel open for async response
      }

      if (request.action === 'updateProvider') {
        this.handleProviderChange(request.provider)
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            this.logger.error('Provider update failed', {
              error: error.message
            });
            sendResponse({
              success: false,
              error: error.message
            });
          });
        return true; // Keep channel open for async response
      }

      if (request.action === 'getAPIKeyStatus') {
        sendResponse({
          configured: !!(this.API_KEYS[this.selectedProvider]),
          hasAIService: !!this.aiService,
          selectedProvider: this.selectedProvider,
          availableKeys: {
            claude: !!this.API_KEYS.claude,
            openai: !!this.API_KEYS.openai
          }
        });
        return false;
      }

      return false;
    });

    this.logger.info('Message listener configured');
  }

  /**
   * Handle API key update
   * @param {Object} data - Update data {provider, apiKey} or legacy {apiKey}
   */
  async handleAPIKeyUpdate(data) {
    try {
      // Handle legacy format (single apiKey)
      if (typeof data === 'string') {
        data = { provider: 'claude', apiKey: data };
      }

      const { provider, apiKey } = data;

      if (!apiKey || apiKey.length < 20) {
        throw new APIKeyError('Invalid API key format');
      }

      if (!['claude', 'openai'].includes(provider)) {
        throw new APIKeyError('Invalid provider');
      }

      // Update API key for provider
      this.API_KEYS[provider] = apiKey;

      // If updating the currently selected provider, reinitialize
      if (provider === this.selectedProvider) {
        await this.initializeAIService();
      }

      this.logger.info('API key updated successfully', { provider });
    } catch (error) {
      this.logger.error('Failed to update API key', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle provider change
   * @param {string} newProvider - New provider selection
   */
  async handleProviderChange(newProvider) {
    try {
      if (!['claude', 'openai'].includes(newProvider)) {
        throw new Error('Invalid provider');
      }

      this.selectedProvider = newProvider;

      // Reinitialize AI service with new provider
      await this.initializeAIService();

      this.logger.info('Provider changed successfully', { provider: newProvider });
    } catch (error) {
      this.logger.error('Failed to change provider', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle transcript analysis request
   * @param {Object} data - Request data
   * @returns {Promise<Object>}
   */
  async handleTranscriptAnalysis(data) {
    const stopTimer = this.logger.time('handleTranscriptAnalysis');

    try {
      const { videoId, transcript, title, settings } = data;

      this.logger.info('Starting analysis', {
        videoId,
        title: title?.substring(0, 50),
        transcriptSegments: transcript?.length
      });

      // Verify AI service is available
      if (!this.aiService) {
        const providerName = this.selectedProvider === 'claude' ? 'Claude' : 'OpenAI';
        const consoleUrl = this.selectedProvider === 'claude'
          ? 'https://console.anthropic.com/settings/keys'
          : 'https://platform.openai.com/api-keys';

        throw new APIKeyError(
          `API key not configured. Please open the extension popup and enter your ${providerName} API key. ` +
          `Get your API key from ${consoleUrl}`
        );
      }

      // Validate input
      if (!videoId || !transcript || transcript.length === 0) {
        throw new TranscriptNotAvailableError(videoId);
      }

      // Get advanced settings and user settings
      const advancedSettings = await this.storageService.getAdvancedSettings();
      const userSettings = await this.storageService.getSettings();

      // Check cache first
      const cachedResult = await this.storageService.getCachedAnalysis(videoId);
      if (cachedResult) {
        this.logger.info('Cache hit', { videoId });

        // Track cache performance
        this.analyticsService.trackCachePerformance(videoId, true, stopTimer());

        // Filter cached segments by current user settings
        const filteredSegments = cachedResult.getEnabledSegments(userSettings);

        return {
          success: true,
          segments: filteredSegments.map(s => s.toJSON()),
          cached: true
        };
      }

      // Create transcript model
      const transcriptModel = Transcript.fromDOM(transcript, videoId);

      // Analyze with AI (passing user settings to optimize prompt)
      const analysisResult = await this.aiService.analyzeTranscript(
        transcriptModel,
        advancedSettings,
        userSettings
      );

      // Merge overlapping segments
      const mergedResult = analysisResult.mergeOverlapping();

      // Segments are already filtered by AI based on enabled categories
      const filteredSegments = mergedResult.segments;

      // Create final result
      const finalResult = new AnalysisResult(
        videoId,
        filteredSegments,
        mergedResult.metadata
      );

      // Cache result
      await this.storageService.cacheAnalysis(videoId, finalResult);

      // Track analytics
      await this.analyticsService.trackAnalysis(
        videoId,
        finalResult,
        stopTimer()
      );

      this.logger.info('Analysis completed', {
        videoId,
        segments: finalResult.getSegmentCount(),
        duration: finalResult.getTotalSkipDuration()
      });

      return {
        success: true,
        segments: finalResult.segments.map(s => s.toJSON()),
        cached: false
      };

    } catch (error) {
      stopTimer();

      this.logger.error('Analysis error', {
        error: error.message,
        name: error.name,
        code: error.code
      });

      // Track error
      this.analyticsService.trackError(error, 'handleTranscriptAnalysis', {
        videoId: data.videoId
      });

      return {
        success: false,
        error: this.formatErrorMessage(error)
      };
    }
  }

  /**
   * Format error message for user
   * @param {Error} error - Error object
   * @returns {string}
   */
  formatErrorMessage(error) {
    if (error instanceof APIKeyError) {
      return 'API Key not configured. Insert your Claude/OpenAI API key in background.js';
    }

    if (error instanceof TranscriptNotAvailableError) {
      return 'Transcript not available for this video. The extension only works with videos that have subtitles.';
    }

    if (error instanceof StorageError) {
      return 'Storage error. Try clearing cache and reloading.';
    }

    return `Error: ${error.message}`;
  }

  /**
   * Schedule periodic maintenance tasks
   */
  schedulePeriodicMaintenance() {
    // Clean stale cache every 24 hours
    setInterval(async () => {
      try {
        this.logger.info('Running periodic maintenance');

        const deleted = await this.storageService.cleanStaleCache(
          30 * 24 * 60 * 60 * 1000 // 30 days
        );

        this.logger.info('Maintenance complete', { deletedEntries: deleted });
      } catch (error) {
        this.logger.error('Maintenance failed', { error: error.message });
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    this.logger.info('Periodic maintenance scheduled');
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Handle installation/update
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info('Extension installed/updated', { reason: details.reason });

  if (details.reason === 'install') {
    // First installation - set default settings
    const storageService = new StorageService();

    try {
      await storageService.updateSettings({
        skipSponsors: true,
        skipIntros: false,
        skipOutros: false,
        skipDonations: true,
        skipSelfPromo: true,
        skipBuffer: 0.5,
        enablePreview: true,
        autoSkip: true
      });

      logger.info('Default settings created');

      // Open welcome page
      chrome.tabs.create({
        url: 'welcome.html'
      });
    } catch (error) {
      logger.error('Failed to set default settings', { error: error.message });
    }
  }
});

// Export for potential testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BackgroundService };
}
