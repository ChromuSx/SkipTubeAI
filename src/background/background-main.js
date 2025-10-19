// background-main.js - Refactored background service worker using new infrastructure

import { logger, LogLevel } from '../shared/logger/index.js';
import { AIService } from '../shared/services/ai-service.js';
import { StorageService } from '../shared/services/storage-service.js';
import { AnalyticsService } from '../shared/services/analytics-service.js';
import { Transcript, AnalysisResult } from '../shared/models/index.js';
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
    this.API_KEY = null;
    this.API_ENDPOINT = 'https://api.anthropic.com/v1/messages';

    // Initialize services
    this.logger = logger.child('BackgroundService');
    this.storageService = new StorageService();
    this.analyticsService = new AnalyticsService();

    // AI service will be initialized after loading API key
    this.aiService = null;

    // Initialize async
    this.initialize();
  }

  /**
   * Initialize background service (async)
   */
  async initialize() {
    try {
      // Load API key from storage
      await this.loadAPIKey();

      this.setupMessageListener();
      this.schedulePeriodicMaintenance();

      this.logger.info('Background service initialized', {
        hasAPIKey: !!this.API_KEY
      });
    } catch (error) {
      this.logger.error('Failed to initialize background service', {
        error: error.message
      });
    }
  }

  /**
   * Load API key from storage
   */
  async loadAPIKey() {
    try {
      const data = await chrome.storage.local.get(['apiKey']);

      if (data.apiKey && data.apiKey.length >= 20) {
        this.API_KEY = data.apiKey;

        // Initialize AI service with the loaded key
        this.aiService = new AIService(this.API_KEY, this.API_ENDPOINT);

        this.logger.info('API key loaded successfully');
      } else {
        this.logger.warn('No valid API key found in storage');
      }
    } catch (error) {
      this.logger.error('Failed to load API key', {
        error: error.message
      });
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
        this.handleTranscriptAnalysis(request.data)
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
        this.handleAPIKeyUpdate(request.apiKey)
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

      if (request.action === 'getAPIKeyStatus') {
        sendResponse({
          configured: !!this.API_KEY,
          hasAIService: !!this.aiService
        });
        return false;
      }

      return false;
    });

    this.logger.info('Message listener configured');
  }

  /**
   * Handle API key update
   * @param {string} newKey - New API key
   */
  async handleAPIKeyUpdate(newKey) {
    try {
      if (!newKey || newKey.length < 20) {
        throw new APIKeyError('Invalid API key format');
      }

      this.API_KEY = newKey;

      // Reinitialize AI service with new key
      this.aiService = new AIService(this.API_KEY, this.API_ENDPOINT);

      this.logger.info('API key updated successfully');
    } catch (error) {
      this.logger.error('Failed to update API key', {
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
      if (!this.aiService || !this.API_KEY) {
        throw new APIKeyError(
          'API key not configured. Please open the extension popup and enter your Claude API key. ' +
          'Get your API key from https://console.anthropic.com/settings/keys'
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
