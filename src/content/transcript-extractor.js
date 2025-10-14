// transcript-extractor.js - Handles YouTube transcript extraction
import { CONFIG } from '../shared/config.js';
import { SELECTORS, YOUTUBE } from '../shared/constants.js';
import { parseTimeString } from '../shared/utils.js';

/**
 * TranscriptExtractor - Extracts transcripts from YouTube videos
 */
export class TranscriptExtractor {
  constructor() {
    this.transcriptCache = new Map();
    this.timedtextWarningShown = false;
  }

  /**
   * Get transcript for a video (tries multiple methods)
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Array|null>} - Transcript array or null
   */
  async getTranscript(videoId) {
    // Check cache first
    if (this.transcriptCache.has(videoId)) {
      console.log('Transcript found in cache');
      return this.transcriptCache.get(videoId);
    }

    console.log('Starting transcript extraction with multiple methods...');

    // Method 1: Extract from DOM (most reliable)
    console.log('Attempt 1: Extracting from DOM...');
    const domTranscript = await this.extractFromDOM();
    if (domTranscript && domTranscript.length > 0) {
      console.log(`✓ Transcript extracted from DOM: ${domTranscript.length} segments`);
      this.transcriptCache.set(videoId, domTranscript);
      return domTranscript;
    }

    // Method 2: Extract from player config
    console.log('Attempt 2: Extracting from player config...');
    const playerTranscript = await this.extractFromPlayerConfig(videoId);
    if (playerTranscript && playerTranscript.length > 0) {
      console.log(`✓ Transcript extracted from player config: ${playerTranscript.length} segments`);
      this.transcriptCache.set(videoId, playerTranscript);
      return playerTranscript;
    }

    // Method 3: Wait for intercepted transcript
    console.log('Attempt 3: Waiting for intercepted transcript...');
    const interceptedTranscript = await this.waitForInterceptedTranscript();
    if (interceptedTranscript && interceptedTranscript.length > 0) {
      console.log(`✓ Intercepted transcript: ${interceptedTranscript.length} segments`);
      this.transcriptCache.set(videoId, interceptedTranscript);
      return interceptedTranscript;
    }

    console.warn('⚠ No transcript available for this video');
    return null;
  }

  /**
   * Try to automatically open the transcript panel
   */
  tryOpenTranscriptPanel() {
    try {
      const transcriptButton = Array.from(document.querySelectorAll('button'))
        .find(btn => {
          const text = btn.textContent.toLowerCase();
          return YOUTUBE.TRANSCRIPT_BUTTON_TEXT.some(keyword => text.includes(keyword));
        });

      if (transcriptButton && !transcriptButton.getAttribute('aria-pressed')) {
        console.log('Automatically opening transcript panel...');
        transcriptButton.click();
      }
    } catch (error) {
      // Ignore errors, this is just a helper
    }
  }

  /**
   * Extract transcript from DOM
   * @returns {Promise<Array|null>}
   */
  async extractFromDOM() {
    try {
      console.log('🔍 Searching for transcript panel in DOM...');

      const extractSegments = () => {
        const transcriptPanel = document.querySelector(SELECTORS.TRANSCRIPT_PANEL);

        if (!transcriptPanel) {
          console.log('⚠️ Transcript panel not found in DOM');
          return null;
        }

        console.log('✓ Transcript panel found:', transcriptPanel.getAttribute('target-id'));

        let segments = transcriptPanel.querySelectorAll(SELECTORS.TRANSCRIPT_SEGMENTS);

        if (segments.length === 0) {
          segments = transcriptPanel.querySelectorAll('[class*="segment"]');
        }

        if (segments.length === 0) {
          console.log('⚠️ No segment element found in panel');
          return null;
        }

        console.log(`Found ${segments.length} segment elements in panel`);

        const transcript = [];
        segments.forEach((segment, index) => {
          let timeElement = segment.querySelector(SELECTORS.SEGMENT_TIMESTAMP);
          let textElement = segment.querySelector(SELECTORS.SEGMENT_TEXT);

          if (!timeElement) {
            timeElement = segment.querySelector('div[role="button"]');
          }
          if (!textElement) {
            const divs = segment.querySelectorAll('div');
            textElement = Array.from(divs).find(div =>
              div.textContent && !div.textContent.match(/^\d+:\d+/)
            );
          }

          if (timeElement && textElement) {
            const timeText = timeElement.textContent || timeElement.innerText;
            const text = textElement.textContent || textElement.innerText;

            if (timeText && text) {
              const time = parseTimeString(timeText);
              transcript.push({
                text: text.trim(),
                start: time,
                duration: CONFIG.TRANSCRIPT.SEGMENT_DEFAULT_DURATION
              });
            }
          } else {
            if (index < 5) { // Log only first 5 to avoid spam
              console.log(`Segment ${index}: timeElement=${!!timeElement}, textElement=${!!textElement}`);
            }
          }
        });

        return transcript.length > 0 ? transcript : null;
      };

      // Try to extract directly if panel is already open
      let transcript = extractSegments();
      if (transcript && transcript.length > 0) {
        console.log(`✓ Panel already open - Extracted ${transcript.length} segments`);
        return transcript;
      }

      console.log('Panel not open, searching for button...');

      // Find and click transcript button
      const buttons = Array.from(document.querySelectorAll('button'));
      const transcriptButton = buttons.find(btn => {
        const text = btn.textContent.toLowerCase();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        return YOUTUBE.TRANSCRIPT_BUTTON_TEXT.some(keyword =>
          text.includes(keyword) || ariaLabel.includes(keyword)
        );
      });

      if (transcriptButton) {
        console.log('✓ Transcript button found, clicking...');
        transcriptButton.click();

        // Wait for panel to open with multiple retries
        console.log('Waiting for segments to load...');
        for (let i = 0; i < CONFIG.TRANSCRIPT.RETRY_COUNT; i++) {
          await new Promise(r => setTimeout(r, CONFIG.TRANSCRIPT.RETRY_DELAY_MS));

          const panel = document.querySelector(SELECTORS.TRANSCRIPT_PANEL);
          if (panel) {
            const isVisible = panel.offsetParent !== null;
            console.log(`Attempt ${i + 1}: Panel ${isVisible ? 'visible' : 'not visible'}`);

            transcript = extractSegments();
            if (transcript && transcript.length > 0) {
              console.log(`✅ Extracted ${transcript.length} segments after opening panel (attempt ${i + 1})`);
              return transcript;
            }

            const loading = panel.querySelector('tp-yt-paper-spinner, ytd-continuation-item-renderer');
            if (loading) {
              console.log('⏳ Loading in progress...');
            }
          }
        }
        console.warn('⚠️ Panel open but no segments found after multiple attempts');

        // Debug: show what's in the panel
        const panel = document.querySelector(SELECTORS.TRANSCRIPT_PANEL);
        if (panel) {
          console.log('Debug panel HTML:', panel.innerHTML.substring(0, 500));
        }
      } else {
        console.log('⚠️ Transcript button not found in DOM');
      }

      console.log('❌ No DOM method worked');
      console.log('💡 Suggestion: Manually open the transcript panel and reload the page');

    } catch (error) {
      console.error('Error extracting transcript from DOM:', error);
    }

    return null;
  }

  /**
   * Extract transcript from player config
   * @param {string} videoId - Video ID
   * @returns {Promise<Array|null>}
   */
  async extractFromPlayerConfig(videoId) {
    try {
      console.log('Searching for ytInitialPlayerResponse...');

      // Method 1: Try reading directly from window
      if (window.ytInitialPlayerResponse) {
        console.log('✓ ytInitialPlayerResponse found in global window');
        const result = await this.extractFromPlayerResponse(window.ytInitialPlayerResponse);
        if (result) return result;
      }

      // Method 2: Try getting from script tags
      console.log('Searching in script tags...');
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        if (content && content.includes('ytInitialPlayerResponse')) {
          const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
          if (match) {
            console.log('✓ ytInitialPlayerResponse found in scripts');
            const playerResponse = JSON.parse(match[1]);
            return this.extractFromPlayerResponse(playerResponse);
          }
        }
      }

      console.log('ytInitialPlayerResponse not found');
    } catch (error) {
      console.error('Error extracting from player config:', error);
    }
    return null;
  }

  /**
   * Extract transcript from player response object
   * @param {Object} playerResponse - YouTube player response
   * @returns {Promise<Array|null>}
   */
  async extractFromPlayerResponse(playerResponse) {
    try {
      const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captions || captions.length === 0) {
        console.log('No caption track found in playerResponse');
        return null;
      }

      // Find Italian or English track
      let captionTrack = captions.find(c => c.languageCode === 'it') ||
                         captions.find(c => c.languageCode === 'en') ||
                         captions[0];

      if (captionTrack && captionTrack.baseUrl) {
        // Show warning only once per video
        if (!this.timedtextWarningShown) {
          console.log(`Subtitle track found (${captionTrack.languageCode}):`, captionTrack.baseUrl);
          console.warn('⚠️ YouTube\'s timedtext API is not accessible from extensions (returns content-length: 0)');
          console.log('💡 Use DOM extraction instead - manually open transcript panel if necessary');
          this.timedtextWarningShown = true;
        }
      }
    } catch (error) {
      console.error('Error extracting transcript from player response:', error);
    }
    return null;
  }

  /**
   * Wait for intercepted transcript from window messages
   * @returns {Promise<Array|null>}
   */
  async waitForInterceptedTranscript() {
    return new Promise((resolve) => {
      let timeout = setTimeout(() => {
        console.log('⏱️ Timeout waiting for intercepted transcript');
        resolve(null);
      }, CONFIG.TRANSCRIPT.WAIT_FOR_INTERCEPT_MS);

      const messageHandler = (event) => {
        if (event.data && event.data.type === YOUTUBE.MESSAGE_TYPE) {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          const transcript = this.parseYouTubeTranscript(event.data.data);
          resolve(transcript);
        }
      };

      window.addEventListener('message', messageHandler);
    });
  }

  /**
   * Parse YouTube transcript data
   * @param {Object} data - Transcript data
   * @returns {Array|null}
   */
  parseYouTubeTranscript(data) {
    try {
      if (data && data.events) {
        return data.events
          .filter(event => event.segs)
          .map(event => ({
            text: event.segs.map(seg => seg.utf8).join(''),
            start: (event.tStartMs || 0) / 1000,
            duration: (event.dDurationMs || 0) / 1000
          }));
      }
    } catch (error) {
      console.error('Error parsing transcript:', error);
    }
    return null;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.transcriptCache.clear();
    this.timedtextWarningShown = false;
  }
}
