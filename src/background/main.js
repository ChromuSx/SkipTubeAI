// main.js - Main background service worker
import { CONFIG } from '../shared/config.js';
import { STORAGE_KEYS } from '../shared/constants.js';
import { storage } from '../shared/utils.js';
import { AIClient } from './ai-client.js';
import { ResponseParser } from './response-parser.js';
import { CacheManager } from './cache-manager.js';

/**
 * AIAnalyzer - Main background service orchestrator
 */
class AIAnalyzer {
  constructor() {
    // IMPORTANT: Replace with your actual API key
    const API_KEY = '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';

    this.aiClient = new AIClient(API_KEY);
    this.responseParser = new ResponseParser();
    this.cacheManager = new CacheManager();

    this.setupMessageListener();
  }

  /**
   * Setup message listener for content script communication
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'analyzeTranscript') {
        this.handleTranscriptAnalysis(request.data)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({
            success: false,
            error: error.message
          }));
        return true; // Keeps the channel open for async response
      }
    });
  }

  /**
   * Handle transcript analysis request
   * @param {Object} data - Request data
   * @returns {Promise<Object>}
   */
  async handleTranscriptAnalysis(data) {
    const { videoId, transcript, title, settings } = data;

    // Verify API key is configured
    if (!this.aiClient.isApiKeyValid()) {
      console.error('❌ API Key not configured!');
      return {
        success: false,
        error: 'API Key not configured. Insert your Claude/OpenAI API key in background.js line 5'
      };
    }

    // Load advanced settings
    const advSettings = await this.getAdvancedSettings();
    console.log('⚙️ Advanced settings:', advSettings);

    // Check cache
    const cached = await this.cacheManager.get(videoId, settings, advSettings.confidenceThreshold);
    if (cached) {
      console.log('✓ Analysis found in cache');
      return {
        success: true,
        segments: cached
      };
    }

    try {
      console.log('🤖 Starting AI analysis for video:', title);

      // Analyze with AI
      const aiResponse = await this.aiClient.analyze(
        transcript,
        title,
        settings,
        advSettings
      );

      // Parse response
      const segments = this.responseParser.parse(
        aiResponse,
        advSettings.confidenceThreshold
      );

      // Cache result
      await this.cacheManager.save(videoId, segments, settings, advSettings.confidenceThreshold);

      // Clean old cache periodically
      await this.cacheManager.cleanOldCache();

      console.log(`✅ AI analysis completed: ${segments.length} segments found`);

      return {
        success: true,
        segments: segments
      };

    } catch (error) {
      console.error('❌ AI analysis error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get advanced settings from storage
   * @returns {Promise<Object>}
   */
  async getAdvancedSettings() {
    try {
      const data = await storage.local.get(STORAGE_KEYS.ADVANCED_SETTINGS);
      return data[STORAGE_KEYS.ADVANCED_SETTINGS] || CONFIG.DEFAULTS.ADVANCED_SETTINGS;
    } catch (error) {
      console.error('Error loading advanced settings:', error);
      return CONFIG.DEFAULTS.ADVANCED_SETTINGS;
    }
  }
}

// Initialize analyzer
const analyzer = new AIAnalyzer();

// Handle installation/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First installation - set default settings
    chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: CONFIG.DEFAULTS.SETTINGS
    });

    // Open welcome page (if exists)
    const welcomePageUrl = chrome.runtime.getURL('welcome.html');
    fetch(welcomePageUrl, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          chrome.tabs.create({ url: 'welcome.html' });
        }
      })
      .catch(() => {
        // Welcome page doesn't exist, skip
      });
  }
});
