// video-monitor.js - Monitors video playback and performs skip operations
import { CONFIG } from '../shared/config.js';
import { SUCCESS_MESSAGES } from '../shared/constants.js';
import { templateReplace } from '../shared/utils.js';

/**
 * VideoMonitor - Monitors video and executes skips
 */
export class VideoMonitor {
  constructor(segmentManager, uiManager, settings) {
    this.segmentManager = segmentManager;
    this.uiManager = uiManager;
    this.settings = settings;
    this.video = null;
    this.boundTimeUpdateHandler = null;
  }

  /**
   * Set video element
   * @param {HTMLVideoElement} video - Video element
   */
  setVideo(video) {
    this.video = video;
  }

  /**
   * Get video element
   * @returns {HTMLVideoElement|null}
   */
  getVideo() {
    return this.video;
  }

  /**
   * Update settings
   * @param {Object} settings - New settings
   */
  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Setup video monitoring
   */
  setupMonitoring() {
    if (!this.video) {
      console.warn('⚠️ setupVideoMonitoring: video element not found');
      return;
    }

    // Merge overlapping segments before monitoring
    const segments = this.segmentManager.getSegments();
    const merged = this.segmentManager.mergeOverlappingSegments(segments);
    this.segmentManager.setSegments(merged);

    console.log(`✓ Video monitoring setup with ${merged.length} segments to skip`);

    // Remove previous listeners
    if (this.boundTimeUpdateHandler) {
      this.video.removeEventListener('timeupdate', this.boundTimeUpdateHandler);
    }

    // Add new listener
    this.boundTimeUpdateHandler = this.handleTimeUpdate.bind(this);
    this.video.addEventListener('timeupdate', this.boundTimeUpdateHandler);

    console.log(`✓ Timeupdate listener added. AutoSkip: ${this.settings.autoSkip}`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.video && this.boundTimeUpdateHandler) {
      this.video.removeEventListener('timeupdate', this.boundTimeUpdateHandler);
      this.boundTimeUpdateHandler = null;
      console.log('✓ Video monitoring stopped');
    }
  }

  /**
   * Handle time update event
   */
  handleTimeUpdate() {
    if (!this.settings.autoSkip || !this.video) return;

    const currentTime = this.video.currentTime;

    // Find segment to skip
    const segment = this.segmentManager.findSegmentAtTime(
      currentTime,
      this.settings.skipBuffer
    );

    if (segment) {
      console.log(`⏩ Detected segment to skip at ${currentTime}s: ${segment.category} (${segment.start}s - ${segment.end}s)`);

      // Show preview if enabled
      if (this.settings.enablePreview) {
        this.showSkipPreview(segment);
      }

      // Perform skip
      this.performSkip(segment);
    }
  }

  /**
   * Show skip preview
   * @param {Object} segment - Segment to preview
   */
  showSkipPreview(segment) {
    this.uiManager.showSkipPreview(
      segment,
      this.settings.skipBuffer,
      () => {
        // Cancel handler - remove segment from skip list
        this.segmentManager.removeSegment(segment);
      }
    );
  }

  /**
   * Perform skip operation
   * @param {Object} segment - Segment to skip
   */
  performSkip(segment) {
    if (!this.video) return;

    console.log(`⏩ Skipping: ${segment.category} (${segment.start}s - ${segment.end}s)`);

    // Update statistics
    this.segmentManager.updateStats(segment);

    // Apply fade effect
    this.uiManager.applyFadeEffect(this.video, true);

    const newTime = segment.end;

    setTimeout(() => {
      if (this.video) {
        this.video.currentTime = newTime;
        this.uiManager.applyFadeEffect(this.video, false);

        // Show notification
        const duration = Math.floor(segment.end - segment.start);
        const message = templateReplace(SUCCESS_MESSAGES.SKIPPED, {
          category: segment.category,
          duration
        });
        this.uiManager.showNotification(message, 'success');

        // Remove passed segments
        this.segmentManager.removePassedSegments(newTime);
      }
    }, CONFIG.VIDEO.FADE_TRANSITION_MS);
  }

  /**
   * Skip to specific segment end
   * @param {Object} segment - Segment to skip to
   */
  skipToSegment(segment) {
    if (!this.video) return;

    this.video.currentTime = segment.end;
    this.uiManager.showNotification(
      `⏩ Skipped manually: ${segment.category}`,
      'info'
    );

    // Remove passed segments
    this.segmentManager.removePassedSegments(segment.end);
  }

  /**
   * Check if video is valid
   * @returns {boolean}
   */
  isVideoValid() {
    return this.video &&
           this.video.duration &&
           this.video.duration > 0 &&
           !isNaN(this.video.duration);
  }

  /**
   * Get video duration
   * @returns {number}
   */
  getVideoDuration() {
    return this.video ? this.video.duration : 0;
  }

  /**
   * Get current time
   * @returns {number}
   */
  getCurrentTime() {
    return this.video ? this.video.currentTime : 0;
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopMonitoring();
    this.video = null;
  }
}
