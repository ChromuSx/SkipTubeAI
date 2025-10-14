// transcript-service.js - Transcript extraction and management service

import { TranscriptError, TranscriptNotAvailableError, TranscriptExtractionError } from '../errors/index.js';
import { logger } from '../logger/index.js';
import { TranscriptValidator } from '../validators/index.js';
import { Transcript } from '../models/index.js';

/**
 * TranscriptService - Handles transcript extraction and processing
 */
export class TranscriptService {
  constructor() {
    this.logger = logger.child('TranscriptService');
    this.maxRetries = 10;
    this.retryDelay = 800;
  }

  /**
   * Extract transcript from DOM
   * @param {string} videoId - Video ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Transcript>}
   */
  async extractFromDOM(videoId, channelId = '') {
    const stopTimer = this.logger.time(`Extract transcript for ${videoId}`);

    try {
      this.logger.info(`Extracting transcript from DOM`, { videoId });

      // Try to open transcript panel
      const opened = await this.openTranscriptPanel();
      if (!opened) {
        this.logger.warn(`Could not open transcript panel`, { videoId });
      }

      // Wait for transcript to load
      const transcriptData = await this.waitForTranscript();

      if (!transcriptData || transcriptData.length === 0) {
        throw new TranscriptNotAvailableError(videoId);
      }

      // Create transcript model
      const transcript = Transcript.fromDOM(transcriptData, videoId, channelId);

      // Validate
      TranscriptValidator.validate(transcript);

      stopTimer();

      this.logger.info(`Transcript extracted successfully`, {
        videoId,
        wordCount: transcript.getWordCount(),
        segmentCount: transcript.segments.length
      });

      return transcript;
    } catch (error) {
      stopTimer();
      this.logger.error(`Transcript extraction failed`, {
        videoId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Open transcript panel
   * @returns {Promise<boolean>}
   */
  async openTranscriptPanel() {
    try {
      // Look for transcript button (multi-language support)
      const transcriptButton = Array.from(document.querySelectorAll('button'))
        .find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          return text.includes('transcript') || text.includes('trascrizione');
        });

      if (!transcriptButton) {
        this.logger.debug(`Transcript button not found`);
        return false;
      }

      // Check if already open
      const panel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id*="transcript"]');
      if (panel && panel.offsetParent !== null) {
        this.logger.debug(`Transcript panel already open`);
        return true;
      }

      // Click button
      transcriptButton.click();
      this.logger.debug(`Clicked transcript button`);

      // Wait for panel to appear
      await this.delay(500);

      return true;
    } catch (error) {
      this.logger.warn(`Failed to open transcript panel`, { error: error.message });
      return false;
    }
  }

  /**
   * Wait for transcript to load in DOM
   * @returns {Promise<Array>}
   */
  async waitForTranscript() {
    for (let i = 0; i < this.maxRetries; i++) {
      this.logger.debug(`Checking for transcript (attempt ${i + 1}/${this.maxRetries})`);

      const transcriptData = this.extractTranscriptData();

      if (transcriptData && transcriptData.length > 0) {
        this.logger.debug(`Transcript found with ${transcriptData.length} segments`);
        return transcriptData;
      }

      // Wait before retry
      await this.delay(this.retryDelay);
    }

    throw new TranscriptExtractionError('Transcript not found after retries');
  }

  /**
   * Extract transcript data from DOM
   * @returns {Array|null}
   */
  extractTranscriptData() {
    try {
      const panel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id*="transcript"]');

      if (!panel) {
        return null;
      }

      const segments = panel.querySelectorAll('ytd-transcript-segment-renderer');

      if (!segments || segments.length === 0) {
        return null;
      }

      const transcriptData = Array.from(segments).map(segment => {
        const timeElement = segment.querySelector('.segment-timestamp');
        const textElement = segment.querySelector('.segment-text');

        if (!timeElement || !textElement) {
          return null;
        }

        // Parse time (format: "0:00" or "1:23:45")
        const timeText = timeElement.textContent.trim();
        const timeParts = timeText.split(':').map(p => parseInt(p, 10));

        let timeSeconds;
        if (timeParts.length === 2) {
          // MM:SS
          timeSeconds = timeParts[0] * 60 + timeParts[1];
        } else if (timeParts.length === 3) {
          // HH:MM:SS
          timeSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
        } else {
          return null;
        }

        return {
          time: timeSeconds,
          text: textElement.textContent.trim()
        };
      }).filter(item => item !== null);

      return transcriptData.length > 0 ? transcriptData : null;
    } catch (error) {
      this.logger.warn(`Error extracting transcript data`, { error: error.message });
      return null;
    }
  }

  /**
   * Extract from player config (fallback method)
   * @param {string} videoId - Video ID
   * @returns {Promise<Transcript|null>}
   */
  async extractFromPlayerConfig(videoId) {
    try {
      this.logger.debug(`Trying player config extraction`, { videoId });

      // Access ytInitialPlayerResponse
      if (typeof window.ytInitialPlayerResponse === 'undefined') {
        this.logger.debug(`ytInitialPlayerResponse not available`);
        return null;
      }

      const captions = window.ytInitialPlayerResponse?.captions;
      if (!captions) {
        this.logger.debug(`No captions in player config`);
        return null;
      }

      const captionTracks = captions.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captionTracks || captionTracks.length === 0) {
        this.logger.debug(`No caption tracks found`);
        return null;
      }

      // Find English track or first available
      const track = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0];

      this.logger.info(`Found caption track`, {
        videoId,
        language: track.languageCode
      });

      // Note: Cannot fetch due to CORS, but we know transcript exists
      return null;
    } catch (error) {
      this.logger.warn(`Player config extraction failed`, { error: error.message });
      return null;
    }
  }

  /**
   * Check if transcript is available
   * @returns {Promise<boolean>}
   */
  async isTranscriptAvailable() {
    try {
      // Try to open panel
      await this.openTranscriptPanel();

      // Check for segments
      await this.delay(1000);
      const data = this.extractTranscriptData();

      return data !== null && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Format transcript for display
   * @param {Transcript} transcript - Transcript to format
   * @param {number} maxLength - Maximum length
   * @returns {string}
   */
  formatForDisplay(transcript, maxLength = 500) {
    const excerpt = transcript.getExcerpt(maxLength);
    const metadata = transcript.getMetadata();

    return `Transcript (${metadata.wordCount} words):\n${excerpt}`;
  }

  /**
   * Search transcript
   * @param {Transcript} transcript - Transcript to search
   * @param {string} query - Search query
   * @param {boolean} caseSensitive - Case sensitive
   * @returns {Array}
   */
  searchTranscript(transcript, query, caseSensitive = false) {
    const results = transcript.search(query, caseSensitive);

    this.logger.debug(`Transcript search`, {
      query,
      resultsCount: results.length
    });

    return results;
  }

  /**
   * Get segment at time
   * @param {Transcript} transcript - Transcript
   * @param {number} time - Time in seconds
   * @returns {Object|null}
   */
  getSegmentAtTime(transcript, time) {
    return transcript.getSegmentAtTime(time);
  }

  /**
   * Validate transcript quality
   * @param {Transcript} transcript - Transcript to validate
   * @returns {Object}
   */
  validateQuality(transcript) {
    const metadata = transcript.getMetadata();

    const quality = {
      isValid: true,
      hasSufficientContent: metadata.hasSufficientContent,
      wordCount: metadata.wordCount,
      charCount: metadata.charCount,
      segmentCount: metadata.segmentCount,
      issues: []
    };

    // Check word count
    if (metadata.wordCount < 50) {
      quality.isValid = false;
      quality.issues.push('Transcript too short (less than 50 words)');
    }

    // Check segment count
    if (metadata.segmentCount === 0 && transcript.text.length > 0) {
      quality.issues.push('No segments available (may affect timestamp accuracy)');
    }

    // Check for empty text
    if (metadata.charCount === 0) {
      quality.isValid = false;
      quality.issues.push('Transcript is empty');
    }

    return quality;
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean transcript text (remove special characters, normalize whitespace)
   * @param {string} text - Text to clean
   * @returns {string}
   */
  static cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?-]/g, '')
      .trim();
  }

  /**
   * Merge transcript segments
   * @param {Array} segments - Segments to merge
   * @returns {string}
   */
  static mergeSegments(segments) {
    return segments.map(s => s.text).join(' ');
  }
}
