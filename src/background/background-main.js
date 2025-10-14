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
    // API Configuration - replace with your own key
    this.API_KEY = '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';
    this.API_ENDPOINT = 'https://api.anthropic.com/v1/messages';

    // Initialize services
    this.logger = logger.child('BackgroundService');
    this.storageService = new StorageService();
    this.analyticsService = new AnalyticsService();

    // Initialize AI service
    try {
      this.aiService = new AIService(this.API_KEY, this.API_ENDPOINT);
      this.logger.info('Background service initialized', {
        hasAPIKey: !!this.API_KEY
      });
    } catch (error) {
      this.logger.error('Failed to initialize AI service', {
        error: error.message
      });
      this.aiService = null;
    }

    this.setupMessageListener();
    this.schedulePeriodicMaintenance();
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

      return false;
    });

    this.logger.info('Message listener configured');
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
        throw new APIKeyError('AI service not initialized - check API key');
      }

      // Validate input
      if (!videoId || !transcript || transcript.length === 0) {
        throw new TranscriptNotAvailableError(videoId);
      }

      // Get advanced settings
      const advancedSettings = await this.storageService.getAdvancedSettings();

      // Check cache first
      const cachedResult = await this.storageService.getCachedAnalysis(videoId);
      if (cachedResult) {
        this.logger.info('Cache hit', { videoId });

        // Track cache performance
        this.analyticsService.trackCachePerformance(videoId, true, stopTimer());

        return {
          success: true,
          segments: cachedResult.segments.map(s => s.toJSON()),
          cached: true
        };
      }

      // Create transcript model
      const transcriptModel = Transcript.fromDOM(transcript, videoId);

      // Analyze with AI
      const analysisResult = await this.aiService.analyzeTranscript(
        transcriptModel,
        advancedSettings
      );

      // Merge overlapping segments
      const mergedResult = analysisResult.mergeOverlapping();

      // Filter by user settings (enabled categories)
      const userSettings = await this.storageService.getSettings();
      const filteredSegments = mergedResult.getEnabledSegments(userSettings);

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
