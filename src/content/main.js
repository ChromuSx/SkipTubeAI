// main.js - Main orchestrator for YouTube skip functionality
import { CONFIG } from '../shared/config.js';
import {
  MESSAGE_ACTIONS,
  ERROR_MESSAGES,
  INFO_MESSAGES,
  SUCCESS_MESSAGES,
  SELECTORS,
  STORAGE_KEYS
} from '../shared/constants.js';
import { storage, runtime, extractVideoId, isYouTubeWatchPage, templateReplace } from '../shared/utils.js';
import { TranscriptExtractor } from './transcript-extractor.js';
import { UIManager } from './ui-manager.js';
import { SegmentManager } from './segment-manager.js';
import { VideoMonitor } from './video-monitor.js';

/**
 * YouTubeSkipManager - Main orchestrator class
 */
class YouTubeSkipManager {
  constructor() {
    this.currentVideoId = null;
    this.isAnalyzing = false;
    this.settings = CONFIG.DEFAULTS.SETTINGS;

    // Initialize modules
    this.transcriptExtractor = new TranscriptExtractor();
    this.uiManager = new UIManager();
    this.segmentManager = new SegmentManager();
    this.videoMonitor = new VideoMonitor(this.segmentManager, this.uiManager, this.settings);

    this.init();
  }

  /**
   * Initialize the manager
   */
  async init() {
    await this.loadSettings();
    this.observeVideoChanges();
    this.setupMessageListener();
    console.log('YouTube Smart Skip initialized');
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const stored = await storage.local.get(STORAGE_KEYS.SETTINGS);
      if (stored[STORAGE_KEYS.SETTINGS]) {
        this.settings = { ...this.settings, ...stored[STORAGE_KEYS.SETTINGS] };
        this.videoMonitor.updateSettings(this.settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    try {
      await storage.local.set({ [STORAGE_KEYS.SETTINGS]: this.settings });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  /**
   * Observe video changes in the DOM
   */
  observeVideoChanges() {
    const observer = new MutationObserver(() => {
      const video = document.querySelector(SELECTORS.VIDEO);
      const videoId = extractVideoId(window.location.href);

      if (video && videoId && videoId !== this.currentVideoId) {
        this.handleNewVideo(video, videoId);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial check
    const video = document.querySelector(SELECTORS.VIDEO);
    const videoId = extractVideoId(window.location.href);
    if (video && videoId) {
      this.handleNewVideo(video, videoId);
    }
  }

  /**
   * Handle new video detection
   * @param {HTMLVideoElement} video - Video element
   * @param {string} videoId - YouTube video ID
   */
  async handleNewVideo(video, videoId) {
    // Set video in monitor
    this.videoMonitor.setVideo(video);
    this.currentVideoId = videoId;

    // Clear previous segments
    this.segmentManager.clearSegments();

    // Reset transcript warning flag for new video
    this.transcriptExtractor.timedtextWarningShown = false;

    console.log(`New video detected: ${videoId}`);

    // Check cache first
    const cached = await this.segmentManager.getCachedAnalysis(videoId);
    if (cached && cached.length > 0) {
      this.segmentManager.setSegments(cached);
      this.videoMonitor.setupMonitoring();
      this.displaySegments();

      const message = this.segmentManager.getLoadMessage(cached.length, true);
      this.uiManager.showNotification(message, 'success');

      console.log(`Loaded ${cached.length} segments from cache:`);
      this.segmentManager.logSegments();
      return;
    }

    // Wait for page to fully load
    await new Promise(r => setTimeout(r, CONFIG.VIDEO.INITIAL_LOAD_DELAY_MS));

    // Try to automatically open transcript panel
    this.transcriptExtractor.tryOpenTranscriptPanel();

    // Start analysis
    await this.analyzeVideo(videoId);

    // Setup monitoring
    this.videoMonitor.setupMonitoring();
  }

  /**
   * Analyze video with AI
   * @param {string} videoId - Video ID
   */
  async analyzeVideo(videoId) {
    if (this.isAnalyzing) return;

    // Check if channel is whitelisted
    const isWhitelisted = await this.isChannelWhitelisted();
    if (isWhitelisted) {
      console.log('⚪ Channel excluded from whitelist, skipping analysis');
      this.uiManager.showNotification(INFO_MESSAGES.CHANNEL_WHITELISTED, 'info');
      this.isAnalyzing = false;
      return;
    }

    this.isAnalyzing = true;
    this.uiManager.showNotification(INFO_MESSAGES.ANALYZING, 'info');

    try {
      // Get transcript
      const transcript = await this.transcriptExtractor.getTranscript(videoId);

      if (!transcript || transcript.length === 0) {
        console.warn('Transcript not available, unable to analyze');
        this.uiManager.showNotification(ERROR_MESSAGES.NO_TRANSCRIPT, 'warning');
        this.isAnalyzing = false;
        return;
      }

      console.log(`✓ Transcript obtained: ${transcript.length} segments`);
      const loadingMessage = templateReplace(INFO_MESSAGES.TRANSCRIPT_LOADING, {
        count: transcript.length
      });
      this.uiManager.showNotification(loadingMessage, 'info');

      // Get video title
      const videoTitle = document.querySelector(SELECTORS.VIDEO_TITLE)?.textContent || 'YouTube Video';

      // Send to background for AI analysis
      const result = await runtime.sendMessage({
        action: MESSAGE_ACTIONS.ANALYZE_TRANSCRIPT,
        data: {
          videoId: videoId,
          transcript: transcript,
          title: videoTitle,
          settings: this.settings
        }
      });

      if (result.success && result.segments && result.segments.length > 0) {
        // Filter and validate segments
        const validSegments = this.segmentManager.filterValidSegments(result.segments);
        this.segmentManager.setSegments(validSegments);

        // Cache analysis
        await this.segmentManager.cacheAnalysis(videoId, validSegments);

        // Reconfigure monitoring after assigning segments
        this.videoMonitor.setupMonitoring();

        // Display segments
        this.displaySegments();

        // Show success notification
        const message = this.segmentManager.getLoadMessage(validSegments.length, false);
        this.uiManager.showNotification(message, 'success');

        // Log segments
        this.segmentManager.logSegments();

      } else if (result.success) {
        this.uiManager.showNotification(SUCCESS_MESSAGES.NO_SEGMENTS, 'info');
      } else {
        console.error('AI analysis error:', result.error);
        const errorMessage = templateReplace(ERROR_MESSAGES.API_ERROR, {
          error: result.error
        });
        this.uiManager.showNotification(errorMessage, 'error');
      }

    } catch (error) {
      console.error('Analysis error:', error);
      this.uiManager.showNotification(ERROR_MESSAGES.ANALYSIS_ERROR, 'error');
    }

    this.isAnalyzing = false;
  }

  /**
   * Display segments on video timeline
   */
  displaySegments() {
    const video = this.videoMonitor.getVideo();
    const segments = this.segmentManager.getSegments();

    if (!video || !segments.length) return;

    this.uiManager.displaySegmentMarkers(
      segments,
      video,
      (segment) => {
        // Handle marker click - skip to segment end
        this.videoMonitor.skipToSegment(segment);
      }
    );
  }

  /**
   * Check if current channel is whitelisted
   * @returns {Promise<boolean>}
   */
  async isChannelWhitelisted() {
    try {
      const channelLinkElement = document.querySelector(SELECTORS.CHANNEL_NAME);
      if (!channelLinkElement) {
        console.log(ERROR_MESSAGES.CHANNEL_NOT_FOUND);
        return false;
      }

      const channelHandle = channelLinkElement.textContent?.trim();
      const channelUrl = channelLinkElement.href;
      const channelId = channelUrl?.split('/').pop();

      console.log('📺 Current channel:', { channelHandle, channelId });

      // Load whitelist from advanced settings
      const data = await storage.local.get(STORAGE_KEYS.ADVANCED_SETTINGS);
      const whitelist = data[STORAGE_KEYS.ADVANCED_SETTINGS]?.channelWhitelist || [];

      // Check if channel is in whitelist
      const isWhitelisted = whitelist.some(item => {
        return item === channelHandle ||
               item === channelId ||
               channelHandle?.includes(item) ||
               channelId?.includes(item);
      });

      if (isWhitelisted) {
        console.log('✓ Channel found in whitelist:', channelHandle || channelId);
      }

      return isWhitelisted;
    } catch (error) {
      console.error('❌ Error checking whitelist:', error);
      return false;
    }
  }

  /**
   * Setup message listener for popup/background communication
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case MESSAGE_ACTIONS.UPDATE_SETTINGS:
          this.settings = { ...this.settings, ...request.settings };
          this.videoMonitor.updateSettings(this.settings);
          this.saveSettings();
          break;

        case MESSAGE_ACTIONS.UPDATE_ADVANCED_SETTINGS:
          if (request.advancedSettings && request.advancedSettings.skipBuffer !== undefined) {
            this.settings.skipBuffer = request.advancedSettings.skipBuffer;
            this.videoMonitor.updateSettings(this.settings);
            console.log('⚙️ Skip buffer updated:', this.settings.skipBuffer);
          }
          break;

        case MESSAGE_ACTIONS.MANUAL_ANALYZE:
          this.analyzeVideo(this.currentVideoId);
          break;

        case MESSAGE_ACTIONS.GET_CURRENT_CHANNEL:
          const channelLinkElement = document.querySelector(SELECTORS.CHANNEL_NAME);
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
          return true; // Keep channel open for async sendResponse
      }
    });
  }
}

// Initialize when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new YouTubeSkipManager());
} else {
  new YouTubeSkipManager();
}
