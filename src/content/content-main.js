// content-main.js - Refactored content script using new infrastructure

import { logger } from '../shared/logger/index.js';
import { TranscriptService } from '../shared/services/transcript-service.js';
import { StorageService } from '../shared/services/storage-service.js';
import { AnalyticsService } from '../shared/services/analytics-service.js';
import { Segment, AnalysisResult } from '../shared/models/index.js';
import {
  TranscriptNotAvailableError,
  TranscriptExtractionError
} from '../shared/errors/index.js';

/**
 * YouTubeSkipManager - Main content script manager
 */
class YouTubeSkipManager {
  constructor() {
    this.video = null;
    this.skipSegments = [];
    this.currentVideoId = null;
    this.isAnalyzing = false;

    // Services
    this.logger = logger.child('YouTubeSkipManager');
    this.transcriptService = new TranscriptService();
    this.storageService = new StorageService();
    this.analyticsService = new AnalyticsService();

    // Settings (will be loaded from storage)
    this.settings = null;
    this.advancedSettings = null;

    this.init();
  }

  /**
   * Initialize manager
   */
  async init() {
    try {
      this.logger.info('Initializing YouTube Skip Manager');

      // Load settings
      await this.loadSettings();

      // Setup observers
      this.observeVideoChanges();
      this.setupMessageListener();

      this.logger.info('YouTube Skip Manager initialized successfully');
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
      this.settings = allSettings.settings;
      this.advancedSettings = allSettings.advancedSettings;

      this.logger.debug('Settings loaded', {
        autoSkip: this.settings.autoSkip,
        enabledCategories: this.settings.getEnabledCategories()
      });
    } catch (error) {
      this.logger.error('Failed to load settings', { error: error.message });
      // Use defaults if loading fails
      const { Settings, AdvancedSettings } = await import('../shared/models/index.js');
      this.settings = Settings.createDefault();
      this.advancedSettings = AdvancedSettings.createDefault();
    }
  }

  /**
   * Observe DOM changes to detect video changes
   */
  observeVideoChanges() {
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

    // Initial check
    const video = document.querySelector('video');
    const videoId = this.extractVideoId();
    if (video && videoId) {
      this.handleNewVideo(video, videoId);
    }

    this.logger.debug('Video change observer configured');
  }

  /**
   * Extract video ID from URL
   * @returns {string|null}
   */
  extractVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  /**
   * Extract channel ID from page
   * @returns {string}
   */
  extractChannelId() {
    try {
      const channelLinkElement = document.querySelector('ytd-channel-name a');
      if (!channelLinkElement) return '';

      const channelUrl = channelLinkElement.href;
      return channelUrl?.split('/').pop() || '';
    } catch (error) {
      this.logger.warn('Failed to extract channel ID', { error: error.message });
      return '';
    }
  }

  /**
   * Handle new video detection
   * @param {HTMLVideoElement} video - Video element
   * @param {string} videoId - Video ID
   */
  async handleNewVideo(video, videoId) {
    try {
      this.logger.info('New video detected', { videoId });

      this.video = video;
      this.currentVideoId = videoId;
      this.skipSegments = [];

      // Track video view
      const channelId = this.extractChannelId();
      await this.analyticsService.trackVideoView(videoId, channelId);

      // Check if channel is whitelisted
      if (await this.isChannelWhitelisted()) {
        this.logger.info('Channel whitelisted, skipping analysis', { videoId });
        this.showNotification('ℹ️ Channel excluded by advanced settings', 'info');
        return;
      }

      // Check cache
      const cachedResult = await this.storageService.getCachedAnalysis(videoId);
      if (cachedResult) {
        this.logger.info('Cache hit', {
          videoId,
          segments: cachedResult.getSegmentCount()
        });

        // Convert to Segment models
        this.skipSegments = cachedResult.segments;

        this.setupVideoMonitoring();
        this.displaySegments();
        this.showNotification(
          `✅ ${cachedResult.getSegmentCount()} segments loaded from cache`,
          'success'
        );
        return;
      }

      // Wait for page to load
      await this.delay(2000);

      // Try to open transcript panel
      await this.transcriptService.openTranscriptPanel();

      // Start analysis
      this.analyzeVideo(videoId);
      this.setupVideoMonitoring();

    } catch (error) {
      this.logger.error('Failed to handle new video', {
        videoId,
        error: error.message
      });
    }
  }

  /**
   * Check if current channel is whitelisted
   * @returns {Promise<boolean>}
   */
  async isChannelWhitelisted() {
    try {
      const channelId = this.extractChannelId();
      if (!channelId) return false;

      return await this.storageService.isChannelWhitelisted(channelId);
    } catch (error) {
      this.logger.error('Failed to check whitelist', { error: error.message });
      return false;
    }
  }

  /**
   * Setup video monitoring for skip detection
   */
  setupVideoMonitoring() {
    if (!this.video) {
      this.logger.warn('Cannot setup monitoring: video element not found');
      return;
    }

    // Merge overlapping segments
    if (this.skipSegments.length > 0) {
      const mergedSegments = Segment.mergeOverlapping(this.skipSegments);
      this.skipSegments = mergedSegments;

      this.logger.debug('Segments merged', {
        original: this.skipSegments.length,
        merged: mergedSegments.length
      });
    }

    this.logger.info('Video monitoring setup', {
      segments: this.skipSegments.length,
      autoSkip: this.settings.autoSkip
    });

    // Remove previous listener
    this.video.removeEventListener('timeupdate', this.handleTimeUpdate);

    // Add new listener
    this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
    this.video.addEventListener('timeupdate', this.handleTimeUpdate);
  }

  /**
   * Handle video time update
   */
  handleTimeUpdate() {
    if (!this.settings.autoSkip || !this.video || this.skipSegments.length === 0) {
      return;
    }

    const currentTime = this.video.currentTime;

    // Check if we're in a segment to skip
    for (const segment of this.skipSegments) {
      if (segment.contains(currentTime, this.settings.skipBuffer)) {
        this.logger.debug('Segment detected', {
          currentTime,
          segment: segment.category,
          range: segment.getTimeRange()
        });

        // Show preview if enabled
        if (this.settings.enablePreview) {
          this.showSkipPreview(segment);
        }

        // Perform skip
        this.performSkip(segment);
        break;
      }
    }
  }

  /**
   * Perform skip action
   * @param {Segment} segment - Segment to skip
   */
  async performSkip(segment) {
    if (!this.video) return;

    this.logger.info('Performing skip', {
      category: segment.category,
      duration: segment.getDuration(),
      range: segment.getTimeRange()
    });

    // Track skip
    await this.analyticsService.trackSegmentSkip(segment, this.currentVideoId);

    // Fade animation
    this.video.style.transition = 'opacity 0.3s';
    this.video.style.opacity = '0.5';

    const newTime = segment.end;

    setTimeout(() => {
      this.video.currentTime = newTime;
      this.video.style.opacity = '1';

      this.showNotification(
        `⏩ Skipped: ${segment.category} (${segment.getDuration()}s saved)`,
        'success'
      );

      // Remove skipped segments
      this.skipSegments = this.skipSegments.filter(s => s.end > newTime);

      this.logger.debug('Skip complete', {
        remainingSegments: this.skipSegments.length
      });
    }, 300);
  }

  /**
   * Show skip preview notification
   * @param {Segment} segment - Segment to preview
   */
  showSkipPreview(segment) {
    const preview = document.createElement('div');
    preview.className = 'yss-skip-preview';

    preview.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="material-icons" style="font-size: 20px; flex-shrink: 0; color: #f9ab00;">fast_forward</span>
        <div style="flex: 1;">
          <div style="font-weight: 500; font-size: 14px; margin-bottom: 4px;">Skipping ${segment.category}</div>
          <div style="font-size: 12px; opacity: 0.9;">In ${this.settings.skipBuffer}s</div>
        </div>
        <button class="yss-cancel-skip" style="
          padding: 8px 16px;
          background: #1a73e8;
          color: white;
          border: none;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          font-family: Roboto, Arial, sans-serif;
          transition: background 0.2s cubic-bezier(0.2, 0, 0, 1);
          white-space: nowrap;
        ">Cancel</button>
      </div>
    `;

    preview.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: white;
      color: #202124;
      padding: 14px 16px;
      border-radius: 8px;
      border-left: 4px solid #f9ab00;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-family: Roboto, Arial, sans-serif;
      min-width: 300px;
      animation: yss-slideIn 0.3s cubic-bezier(0.2, 0, 0, 1);
    `;

    document.body.appendChild(preview);

    // Handle cancellation
    const cancelBtn = preview.querySelector('.yss-cancel-skip');
    cancelBtn.onclick = () => {
      this.skipSegments = this.skipSegments.filter(s => s !== segment);
      preview.style.animation = 'yss-slideOut 0.2s cubic-bezier(0.2, 0, 0, 1)';
      setTimeout(() => preview.remove(), 200);
      this.logger.debug('Skip cancelled', { category: segment.category });
    };

    // Hover effect
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = '#1765cc';
    });

    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = '#1a73e8';
    });

    // Auto remove
    setTimeout(() => {
      if (preview.parentElement) {
        preview.style.animation = 'yss-slideOut 0.2s cubic-bezier(0.2, 0, 0, 1)';
        setTimeout(() => preview.remove(), 200);
      }
    }, this.settings.skipBuffer * 1000 + 500);
  }

  /**
   * Analyze video with AI
   * @param {string} videoId - Video ID
   */
  async analyzeVideo(videoId) {
    if (this.isAnalyzing) {
      this.logger.warn('Analysis already in progress', { videoId });
      return;
    }

    this.isAnalyzing = true;
    this.showNotification('🔍 Analyzing video with AI...', 'info');

    const stopTimer = this.logger.time(`analyzeVideo:${videoId}`);

    try {
      // Extract transcript
      const channelId = this.extractChannelId();
      const transcript = await this.transcriptService.extractFromDOM(videoId, channelId);

      if (!transcript) {
        throw new TranscriptNotAvailableError(videoId);
      }

      this.logger.info('Transcript extracted', {
        videoId,
        wordCount: transcript.getWordCount(),
        segments: transcript.segments.length
      });

      // Validate transcript quality
      const quality = this.transcriptService.validateQuality(transcript);
      if (!quality.isValid) {
        this.logger.warn('Transcript quality issues', { issues: quality.issues });
      }

      this.showNotification(
        `✓ Transcript loaded: ${transcript.segments.length} segments. Analyzing with AI...`,
        'info'
      );

      // Get video title
      const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'YouTube Video';

      // Send to background for AI analysis
      const result = await chrome.runtime.sendMessage({
        action: 'analyzeTranscript',
        data: {
          videoId: videoId,
          transcript: transcript.segments,
          title: videoTitle,
          settings: this.settings.toJSON()
        }
      });

      stopTimer();

      if (result.success && result.segments && result.segments.length > 0) {
        // Convert to Segment models
        this.skipSegments = result.segments.map(s => Segment.fromJSON(s));

        // Setup monitoring with new segments
        this.setupVideoMonitoring();

        // Display on timeline
        this.displaySegments();

        this.showNotification(
          `✅ Found ${result.segments.length} segments to skip!`,
          'success'
        );

        this.logger.info('Analysis complete', {
          videoId,
          segments: result.segments.length,
          categories: Segment.groupByCategory(this.skipSegments)
        });

      } else if (result.success) {
        this.showNotification('ℹ️ No content to skip detected by AI', 'info');
        this.logger.info('No segments found', { videoId });
      } else {
        throw new Error(result.error || 'Unknown analysis error');
      }

    } catch (error) {
      stopTimer();

      this.logger.error('Analysis failed', {
        videoId,
        error: error.message,
        name: error.name
      });

      if (error instanceof TranscriptNotAvailableError) {
        this.showNotification(
          '⚠️ Transcript not available for this video. The extension only works with videos that have subtitles.',
          'warning'
        );
      } else {
        this.showNotification(
          `❌ Analysis error: ${error.message}`,
          'error'
        );
      }
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Display segments on video timeline
   */
  displaySegments() {
    // Remove previous markers
    document.querySelectorAll('.yss-segment-marker').forEach(m => m.remove());
    document.querySelectorAll('.yss-segment-tooltip').forEach(t => t.remove());

    const progressBar = document.querySelector('.ytp-progress-bar');
    if (!progressBar || !this.video) return;

    const duration = this.video.duration;
    if (!duration || duration === 0) {
      this.logger.warn('Video duration not available');
      return;
    }

    this.logger.debug('Displaying segments on timeline', {
      count: this.skipSegments.length,
      duration
    });

    this.skipSegments.forEach((segment, index) => {
      // Get color by category
      const color = this.getCategoryColor(segment.category);

      // Calculate position and width
      const left = (segment.start / duration) * 100;
      const width = (segment.getDuration() / duration) * 100;

      // Create marker
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

      // Hover handlers
      marker.addEventListener('mouseenter', (e) => {
        marker.style.opacity = '0.9';
        this.showSegmentTooltip(segment, e);
      });

      marker.addEventListener('mouseleave', () => {
        marker.style.opacity = '0.6';
        this.hideSegmentTooltip();
      });

      // Click to skip
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.video) {
          this.video.currentTime = segment.end;
          this.showNotification(`⏩ Skipped manually: ${segment.category}`, 'info');
        }
      });

      progressBar.appendChild(marker);
    });
  }

  /**
   * Get color for category
   * @param {string} category - Category name
   * @returns {string}
   */
  getCategoryColor(category) {
    const colors = {
      'Sponsor': '#FF0000',
      'Self-Promo': '#FF8800',
      'Autopromo': '#FF8800',
      'Intro': '#00FFFF',
      'Outro': '#CC00FF',
      'Donations': '#00FF00',
      'Ringraziamenti': '#00FF00',
      'Acknowledgments': '#00FF00',
      'Merchandise': '#FF8800'
    };

    // Find matching color
    for (const [cat, col] of Object.entries(colors)) {
      if (category.includes(cat)) {
        return col;
      }
    }

    return '#FF0000'; // Default red
  }

  /**
   * Show segment tooltip
   * @param {Segment} segment - Segment
   * @param {Event} event - Mouse event
   */
  showSegmentTooltip(segment, event) {
    this.hideSegmentTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'yss-segment-tooltip';

    const categoryColor = this.getCategoryColor(segment.category);

    tooltip.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <div style="width: 4px; height: 16px; background: ${categoryColor}; border-radius: 2px;"></div>
        <div style="font-weight: 500; font-size: 14px; color: #202124;">${segment.category}</div>
      </div>
      <div style="font-size: 12px; color: #5f6368; margin-bottom: 6px;">
        ${segment.getTimeRange()} • ${segment.getDuration()}s
      </div>
      <div style="font-size: 12px; color: #202124; line-height: 1.5; margin-bottom: 8px;">
        ${segment.description}
      </div>
      <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #5f6368; padding-top: 6px; border-top: 1px solid #e8eaed;">
        <span class="material-icons" style="font-size: 14px;">touch_app</span>
        <span>Click to skip</span>
      </div>
    `;

    tooltip.style.cssText = `
      position: fixed;
      background: white;
      color: #202124;
      padding: 12px 14px;
      border-radius: 8px;
      z-index: 10000;
      pointer-events: none;
      font-family: Roboto, Arial, sans-serif;
      max-width: 300px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.12);
      border: 1px solid #dadce0;
    `;

    document.body.appendChild(tooltip);

    // Position tooltip
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  }

  /**
   * Hide segment tooltip
   */
  hideSegmentTooltip() {
    const tooltip = document.querySelector('.yss-segment-tooltip');
    if (tooltip) tooltip.remove();
  }

  /**
   * Show notification
   * @param {string} message - Message
   * @param {string} type - Type (info, success, warning, error)
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `yss-notification yss-${type}`;

    // Material Icons
    const icons = {
      info: 'info_outline',
      success: 'check_circle',
      warning: 'warning',
      error: 'error_outline'
    };

    const borderColors = {
      info: '#1a73e8',
      success: '#0f9d58',
      warning: '#f9ab00',
      error: '#d93025'
    };

    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="material-icons" style="font-size: 20px; flex-shrink: 0; color: ${borderColors[type]};">${icons[type]}</span>
        <span style="flex: 1; font-size: 14px; line-height: 20px;">${message}</span>
        <button class="yss-close-notification" style="background: none; border: none; color: #5f6368; cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">&times;</button>
      </div>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      color: #202124;
      padding: 14px 16px;
      border-radius: 8px;
      border-left: 4px solid ${borderColors[type]};
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-family: Roboto, Arial, sans-serif;
      min-width: 280px;
      max-width: 400px;
      animation: yss-slideIn 0.3s cubic-bezier(0.2, 0, 0, 1);
    `;

    // Close button handler
    const closeBtn = notification.querySelector('.yss-close-notification');
    closeBtn.addEventListener('click', () => {
      notification.style.animation = 'yss-slideOut 0.2s cubic-bezier(0.2, 0, 0, 1)';
      setTimeout(() => notification.remove(), 200);
    });

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.color = '#202124';
    });

    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.color = '#5f6368';
    });

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'yss-slideOut 0.2s cubic-bezier(0.2, 0, 0, 1)';
        setTimeout(() => notification.remove(), 200);
      }
    }, 3000);
  }

  /**
   * Setup message listener
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.logger.debug('Message received', { action: request.action });

      if (request.action === 'updateSettings') {
        this.loadSettings().then(() => {
          this.logger.info('Settings updated from popup');
        });
      }

      if (request.action === 'updateAdvancedSettings') {
        this.loadSettings().then(() => {
          this.logger.info('Advanced settings updated from popup');
        });
      }

      if (request.action === 'manualAnalyze') {
        if (this.currentVideoId) {
          // Clear cache and reanalyze
          this.storageService.invalidateCache(this.currentVideoId).then(() => {
            this.analyzeVideo(this.currentVideoId);
          });
        }
      }

      if (request.action === 'getCurrentChannel') {
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
        return true;
      }
    });
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Load Material Icons font
const materialIconsLink = document.createElement('link');
materialIconsLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
materialIconsLink.rel = 'stylesheet';
document.head.appendChild(materialIconsLink);

// CSS Styles - Material Design 3
const style = document.createElement('style');
style.textContent = `
  /* Material Icons support */
  .material-icons {
    font-family: 'Material Icons';
    font-weight: normal;
    font-style: normal;
    font-size: 24px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'liga';
  }

  /* Material Design animations */
  @keyframes yss-slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes yss-slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  /* Notification hover effects */
  .yss-notification {
    transition: box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
  }

  .yss-notification:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.15);
  }
`;
document.head.appendChild(style);

// Initialize when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeSkipManager();
  });
} else {
  new YouTubeSkipManager();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { YouTubeSkipManager };
}
