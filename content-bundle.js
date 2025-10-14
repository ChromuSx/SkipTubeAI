// content-bundle.js - Bundled content script (all modules in one file for Manifest V3 compatibility)

// ============================================================================
// CONFIG
// ============================================================================
const CONFIG = {
  API: {
    ENDPOINT: 'https://api.anthropic.com/v1/messages',
    VERSION: '2023-06-01',
    TIMEOUT: 30000,
    MODELS: {
      HAIKU: 'claude-3-5-haiku-20241022',
      SONNET: 'claude-sonnet-4-5-20250929'
    },
    MAX_TOKENS: 1000
  },
  TRANSCRIPT: {
    RETRY_COUNT: 10,
    RETRY_DELAY_MS: 800,
    WAIT_FOR_INTERCEPT_MS: 10000,
    SEGMENT_DEFAULT_DURATION: 5
  },
  CACHE: {
    MAX_AGE_DAYS: 30,
    KEY_PREFIX: 'analysis_'
  },
  VIDEO: {
    INITIAL_LOAD_DELAY_MS: 2000,
    FADE_TRANSITION_MS: 300,
    FADE_OPACITY: 0.5
  },
  UI: {
    NOTIFICATION_DURATION_MS: 3000,
    TOAST_DURATION_MS: 3000,
    SEGMENT_MARKER_OPACITY: 0.6,
    SEGMENT_MARKER_HOVER_OPACITY: 0.9,
    TOOLTIP_MAX_WIDTH: 300
  },
  DEFAULTS: {
    SETTINGS: {
      skipSponsors: true,
      skipIntros: false,
      skipOutros: false,
      skipDonations: true,
      skipSelfPromo: true,
      skipBuffer: 0.5,
      enablePreview: true,
      autoSkip: true
    },
    ADVANCED_SETTINGS: {
      confidenceThreshold: 0.85,
      aiModel: 'haiku',
      skipBuffer: 0.5,
      channelWhitelist: []
    }
  }
};

// ============================================================================
// CONSTANTS
// ============================================================================
const CATEGORIES = {
  SPONSOR: 'Sponsor',
  SELF_PROMO: 'Self-Promo',
  INTRO: 'Intro',
  OUTRO: 'Outro',
  DONATIONS: 'Donations',
  ACKNOWLEDGMENTS: 'Acknowledgments',
  MERCHANDISE: 'Merchandise'
};

const CATEGORY_COLORS = {
  [CATEGORIES.SPONSOR]: '#FF0000',
  [CATEGORIES.SELF_PROMO]: '#FF8800',
  'Autopromo': '#FF8800',
  [CATEGORIES.INTRO]: '#00FFFF',
  [CATEGORIES.OUTRO]: '#CC00FF',
  [CATEGORIES.DONATIONS]: '#00FF00',
  'Donazioni': '#00FF00',
  [CATEGORIES.ACKNOWLEDGMENTS]: '#00FF00',
  'Ringraziamenti': '#00FF00'
};

const SELECTORS = {
  VIDEO: 'video',
  PROGRESS_BAR: '.ytp-progress-bar',
  CHANNEL_NAME: 'ytd-channel-name a',
  VIDEO_TITLE: 'h1.ytd-watch-metadata yt-formatted-string',
  TRANSCRIPT_PANEL: [
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]'
  ].join(','),
  TRANSCRIPT_SEGMENTS: 'ytd-transcript-segment-renderer',
  SEGMENT_TIMESTAMP: '.segment-timestamp, [class*="timestamp"]',
  SEGMENT_TEXT: '.segment-text, [class*="segment-text"], [class*="cue-text"]'
};

const MESSAGE_ACTIONS = {
  ANALYZE_TRANSCRIPT: 'analyzeTranscript',
  UPDATE_SETTINGS: 'updateSettings',
  UPDATE_ADVANCED_SETTINGS: 'updateAdvancedSettings',
  MANUAL_ANALYZE: 'manualAnalyze',
  GET_CURRENT_CHANNEL: 'getCurrentChannel'
};

const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
};

const NOTIFICATION_COLORS = {
  [NOTIFICATION_TYPES.INFO]: '#3498db',
  [NOTIFICATION_TYPES.SUCCESS]: '#27ae60',
  [NOTIFICATION_TYPES.WARNING]: '#f39c12',
  [NOTIFICATION_TYPES.ERROR]: '#e74c3c'
};

const CSS_CLASSES = {
  SEGMENT_MARKER: 'yss-segment-marker',
  SEGMENT_TOOLTIP: 'yss-segment-tooltip',
  SKIP_PREVIEW: 'yss-skip-preview',
  NOTIFICATION: 'yss-notification'
};

const STORAGE_KEYS = {
  SETTINGS: 'settings',
  ADVANCED_SETTINGS: 'advancedSettings',
  STATS: 'stats',
  DARK_MODE: 'darkMode'
};

const YOUTUBE = {
  TRANSCRIPT_BUTTON_TEXT: ['trascrizione', 'transcript'],
  MESSAGE_TYPE: 'YSS_TRANSCRIPT'
};

const ERROR_MESSAGES = {
  NO_TRANSCRIPT: '⚠️ Transcript not available for this video. The extension only works with videos that have subtitles.',
  ANALYSIS_ERROR: '❌ Error during analysis',
  API_ERROR: '❌ AI analysis error: {error}. Configure API key in background.js',
  CHANNEL_NOT_FOUND: '⚠️ Channel element not found'
};

const SUCCESS_MESSAGES = {
  SEGMENTS_LOADED: '✅ {count} segments loaded from cache',
  SEGMENTS_FOUND: '✅ Found {count} segments to skip (AI analysis)!',
  NO_SEGMENTS: 'ℹ️ No content to skip detected by AI',
  SKIPPED: '⏩ Skipped: {category} ({duration}s saved)'
};

const INFO_MESSAGES = {
  ANALYZING: '🔍 Analyzing video with AI...',
  TRANSCRIPT_LOADING: '✓ Transcript loaded: {count} segments. Analyzing with AI...',
  CHANNEL_WHITELISTED: 'ℹ️ Channel excluded by advanced settings'
};

// ============================================================================
// UTILS
// ============================================================================
const promisify = (fn) => (...args) =>
  new Promise((resolve, reject) => {
    fn(...args, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });

const storage = {
  local: {
    get: promisify(chrome.storage.local.get.bind(chrome.storage.local)),
    set: promisify(chrome.storage.local.set.bind(chrome.storage.local)),
    remove: promisify(chrome.storage.local.remove.bind(chrome.storage.local)),
    clear: promisify(chrome.storage.local.clear.bind(chrome.storage.local))
  }
};

const runtime = {
  sendMessage: promisify(chrome.runtime.sendMessage.bind(chrome.runtime))
};

function parseTimeString(timeStr) {
  const parts = timeStr.trim().split(':').map(p => parseInt(p));
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function extractVideoId(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('v');
  } catch {
    return null;
  }
}

function templateReplace(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

function generateCacheKey(videoId) {
  return `analysis_${videoId}`;
}

// ============================================================================
// TRANSCRIPT EXTRACTOR
// ============================================================================
class TranscriptExtractor {
  constructor() {
    this.transcriptCache = new Map();
    this.timedtextWarningShown = false;
  }

  async getTranscript(videoId) {
    if (this.transcriptCache.has(videoId)) {
      console.log('Transcript found in cache');
      return this.transcriptCache.get(videoId);
    }

    console.log('Starting transcript extraction with multiple methods...');

    const domTranscript = await this.extractFromDOM();
    if (domTranscript && domTranscript.length > 0) {
      console.log(`✓ Transcript extracted from DOM: ${domTranscript.length} segments`);
      this.transcriptCache.set(videoId, domTranscript);
      return domTranscript;
    }

    const playerTranscript = await this.extractFromPlayerConfig(videoId);
    if (playerTranscript && playerTranscript.length > 0) {
      console.log(`✓ Transcript extracted from player config: ${playerTranscript.length} segments`);
      this.transcriptCache.set(videoId, playerTranscript);
      return playerTranscript;
    }

    const interceptedTranscript = await this.waitForInterceptedTranscript();
    if (interceptedTranscript && interceptedTranscript.length > 0) {
      console.log(`✓ Intercepted transcript: ${interceptedTranscript.length} segments`);
      this.transcriptCache.set(videoId, interceptedTranscript);
      return interceptedTranscript;
    }

    console.warn('⚠ No transcript available for this video');
    return null;
  }

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
      // Ignore errors
    }
  }

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
            if (index < 5) {
              console.log(`Segment ${index}: timeElement=${!!timeElement}, textElement=${!!textElement}`);
            }
          }
        });

        return transcript.length > 0 ? transcript : null;
      };

      let transcript = extractSegments();
      if (transcript && transcript.length > 0) {
        console.log(`✓ Panel already open - Extracted ${transcript.length} segments`);
        return transcript;
      }

      console.log('Panel not open, searching for button...');

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
      } else {
        console.log('⚠️ Transcript button not found in DOM');
      }

      console.log('❌ No DOM method worked');

    } catch (error) {
      console.error('Error extracting transcript from DOM:', error);
    }

    return null;
  }

  async extractFromPlayerConfig(videoId) {
    try {
      console.log('Searching for ytInitialPlayerResponse...');

      if (window.ytInitialPlayerResponse) {
        console.log('✓ ytInitialPlayerResponse found in global window');
        const result = await this.extractFromPlayerResponse(window.ytInitialPlayerResponse);
        if (result) return result;
      }

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

  async extractFromPlayerResponse(playerResponse) {
    try {
      const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captions || captions.length === 0) {
        console.log('No caption track found in playerResponse');
        return null;
      }

      let captionTrack = captions.find(c => c.languageCode === 'it') ||
                         captions.find(c => c.languageCode === 'en') ||
                         captions[0];

      if (captionTrack && captionTrack.baseUrl) {
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

  clearCache() {
    this.transcriptCache.clear();
    this.timedtextWarningShown = false;
  }
}

// ============================================================================
// UI MANAGER
// ============================================================================
class UIManager {
  constructor() {
    this.currentTooltip = null;
    this.injectStyles();
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .${CSS_CLASSES.NOTIFICATION} {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 9999;
        font-family: Roboto, Arial, sans-serif;
        animation: slideIn 0.3s ease;
        color: white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .${CSS_CLASSES.SKIP_PREVIEW} {
        position: fixed;
        top: 80px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px;
        border-radius: 8px;
        z-index: 9999;
        font-family: Roboto, Arial, sans-serif;
      }

      .yss-preview-content {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .yss-cancel-skip {
        margin-left: 10px;
        padding: 5px 10px;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid white;
        color: white;
        border-radius: 4px;
        cursor: pointer;
      }

      .yss-cancel-skip:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .${CSS_CLASSES.SEGMENT_MARKER} {
        position: absolute;
        height: 100%;
        opacity: ${CONFIG.UI.SEGMENT_MARKER_OPACITY};
        z-index: 25;
        cursor: pointer;
        transition: opacity 0.2s;
      }

      .${CSS_CLASSES.SEGMENT_MARKER}:hover {
        opacity: ${CONFIG.UI.SEGMENT_MARKER_HOVER_OPACITY} !important;
      }

      .${CSS_CLASSES.SEGMENT_TOOLTIP} {
        position: fixed;
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 10px 12px;
        border-radius: 6px;
        z-index: 10000;
        pointer-events: none;
        font-family: Roboto, Arial, sans-serif;
        font-size: 13px;
        max-width: ${CONFIG.UI.TOOLTIP_MAX_WIDTH}px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
    `;
    document.head.appendChild(style);
  }

  showNotification(message, type = NOTIFICATION_TYPES.INFO) {
    const notification = document.createElement('div');
    notification.className = `${CSS_CLASSES.NOTIFICATION} yss-${type}`;
    notification.textContent = message;
    notification.style.background = NOTIFICATION_COLORS[type] || NOTIFICATION_COLORS.info;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), CONFIG.UI.NOTIFICATION_DURATION_MS);
  }

  showSkipPreview(segment, skipBuffer, onCancel) {
    const preview = document.createElement('div');
    preview.className = CSS_CLASSES.SKIP_PREVIEW;
    preview.innerHTML = `
      <div class="yss-preview-content">
        <span>⏩ Skipping ${segment.category} in ${skipBuffer}s</span>
        <button class="yss-cancel-skip">Cancel</button>
      </div>
    `;

    document.body.appendChild(preview);

    preview.querySelector('.yss-cancel-skip').onclick = () => {
      if (onCancel) onCancel();
      preview.remove();
    };

    setTimeout(() => preview.remove(), skipBuffer * 1000 + 500);

    return preview;
  }

  displaySegmentMarkers(segments, video, onMarkerClick) {
    this.clearSegmentMarkers();

    const progressBar = document.querySelector(SELECTORS.PROGRESS_BAR);
    if (!progressBar || !video) return;

    const duration = video.duration;
    if (!duration || duration === 0) {
      console.warn('⚠️ Video duration not available, unable to show timeline');
      return;
    }

    console.log(`🎨 Displaying ${segments.length} segments on timeline`);

    segments.forEach((segment, index) => {
      const color = this.getCategoryColor(segment.category);

      const left = (segment.start / duration) * 100;
      const width = ((segment.end - segment.start) / duration) * 100;

      const marker = document.createElement('div');
      marker.className = CSS_CLASSES.SEGMENT_MARKER;
      marker.dataset.index = index;
      marker.style.cssText = `
        left: ${left}%;
        width: ${width}%;
        background: ${color};
      `;

      marker.addEventListener('mouseenter', (e) => {
        marker.style.opacity = CONFIG.UI.SEGMENT_MARKER_HOVER_OPACITY;
        this.showSegmentTooltip(segment, e);
      });

      marker.addEventListener('mouseleave', () => {
        marker.style.opacity = CONFIG.UI.SEGMENT_MARKER_OPACITY;
        this.hideSegmentTooltip();
      });

      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onMarkerClick) {
          onMarkerClick(segment);
        }
      });

      progressBar.appendChild(marker);
    });
  }

  clearSegmentMarkers() {
    document.querySelectorAll(`.${CSS_CLASSES.SEGMENT_MARKER}`).forEach(m => m.remove());
    document.querySelectorAll(`.${CSS_CLASSES.SEGMENT_TOOLTIP}`).forEach(t => t.remove());
  }

  showSegmentTooltip(segment, event) {
    this.hideSegmentTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = CSS_CLASSES.SEGMENT_TOOLTIP;

    const duration = Math.floor(segment.end - segment.start);
    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">${segment.category}</div>
      <div style="font-size: 12px; opacity: 0.9;">
        ${formatTime(segment.start)} - ${formatTime(segment.end)} (${duration}s)
      </div>
      <div style="font-size: 11px; margin-top: 4px; opacity: 0.8;">
        ${segment.description}
      </div>
      <div style="font-size: 10px; margin-top: 6px; opacity: 0.7; font-style: italic;">
        Click to skip
      </div>
    `;

    document.body.appendChild(tooltip);

    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.bottom = `${window.innerHeight - rect.top + 10}px`;

    this.currentTooltip = tooltip;
  }

  hideSegmentTooltip() {
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
  }

  getCategoryColor(category) {
    for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
      if (category.includes(key)) {
        return color;
      }
    }
    return CATEGORY_COLORS.Sponsor;
  }

  applyFadeEffect(video, fadeOut = true) {
    if (!video) return;
    video.style.transition = `opacity ${CONFIG.VIDEO.FADE_TRANSITION_MS}ms`;
    video.style.opacity = fadeOut ? CONFIG.VIDEO.FADE_OPACITY : '1';
  }

  cleanup() {
    this.clearSegmentMarkers();
    this.hideSegmentTooltip();
    document.querySelectorAll(`.${CSS_CLASSES.NOTIFICATION}`).forEach(n => n.remove());
    document.querySelectorAll(`.${CSS_CLASSES.SKIP_PREVIEW}`).forEach(p => p.remove());
  }
}

// ============================================================================
// SEGMENT MANAGER
// ============================================================================
class SegmentManager {
  constructor() {
    this.segments = [];
  }

  getSegments() {
    return this.segments;
  }

  setSegments(segments) {
    this.segments = segments;
  }

  clearSegments() {
    this.segments = [];
  }

  removeSegment(segment) {
    this.segments = this.segments.filter(s => s !== segment);
  }

  removePassedSegments(currentTime) {
    const before = this.segments.length;
    this.segments = this.segments.filter(s => s.end > currentTime);
    const removed = before - this.segments.length;
    if (removed > 0) {
      console.log(`✓ Removed ${removed} passed segments, ${this.segments.length} remaining`);
    }
  }

  mergeOverlappingSegments(segments) {
    if (segments.length <= 1) return segments;

    const sorted = segments.slice().sort((a, b) => a.start - b.start);
    const merged = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const lastMerged = merged[merged.length - 1];

      if (current.start <= lastMerged.end) {
        lastMerged.end = Math.max(lastMerged.end, current.end);
        if (!lastMerged.category.includes(current.category)) {
          lastMerged.category += ` + ${current.category}`;
        }
        lastMerged.description += ` | ${current.description}`;
        console.log(`🔗 Merged overlapping segments: ${lastMerged.start}s-${lastMerged.end}s (${lastMerged.category})`);
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  async getCachedAnalysis(videoId) {
    try {
      const cacheKey = generateCacheKey(videoId);
      const cached = await storage.local.get(cacheKey);
      return cached[cacheKey] || null;
    } catch (error) {
      console.error('Error getting cached analysis:', error);
      return null;
    }
  }

  async cacheAnalysis(videoId, segments) {
    try {
      const cacheKey = generateCacheKey(videoId);
      await storage.local.set({
        [cacheKey]: segments,
        [`${cacheKey}_timestamp`]: Date.now()
      });
      console.log(`✓ Cached analysis for video ${videoId}`);
    } catch (error) {
      console.error('Error caching analysis:', error);
    }
  }

  findSegmentAtTime(currentTime, skipBuffer = 0) {
    return this.segments.find(segment =>
      currentTime >= segment.start - skipBuffer &&
      currentTime < segment.end
    );
  }

  async updateStats(segment) {
    try {
      const timeSaved = segment.end - segment.start;
      const data = await storage.local.get('stats');

      const stats = data.stats || {
        timeSaved: 0,
        segmentsSkipped: 0,
        videosAnalyzed: 0
      };

      stats.timeSaved = (stats.timeSaved || 0) + timeSaved;
      stats.segmentsSkipped = (stats.segmentsSkipped || 0) + 1;

      await storage.local.set({ stats });

      console.log(`📊 Statistics saved: ${Math.floor(stats.timeSaved)}s saved, ${stats.segmentsSkipped} segments skipped`);
    } catch (error) {
      console.error('❌ Error saving statistics:', error);
    }
  }

  getLoadMessage(count, fromCache = false) {
    if (fromCache) {
      return templateReplace(SUCCESS_MESSAGES.SEGMENTS_LOADED, { count });
    } else {
      return templateReplace(SUCCESS_MESSAGES.SEGMENTS_FOUND, { count });
    }
  }

  logSegments() {
    if (this.segments.length === 0) {
      console.log('No segments to skip');
      return;
    }

    console.log(`Segments to skip (${this.segments.length}):`);
    this.segments.forEach((seg, i) => {
      const duration = Math.floor(seg.end - seg.start);
      console.log(`  ${i + 1}. [${seg.start}s - ${seg.end}s] ${seg.category} (${duration}s): ${seg.description}`);
    });
  }

  isValidSegment(segment) {
    return segment &&
           typeof segment.start === 'number' &&
           typeof segment.end === 'number' &&
           segment.start >= 0 &&
           segment.end > segment.start &&
           segment.category &&
           typeof segment.category === 'string';
  }

  filterValidSegments(segments) {
    return segments.filter(seg => this.isValidSegment(seg));
  }
}

// ============================================================================
// VIDEO MONITOR
// ============================================================================
class VideoMonitor {
  constructor(segmentManager, uiManager, settings) {
    this.segmentManager = segmentManager;
    this.uiManager = uiManager;
    this.settings = settings;
    this.video = null;
    this.boundTimeUpdateHandler = null;
  }

  setVideo(video) {
    this.video = video;
  }

  getVideo() {
    return this.video;
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
  }

  setupMonitoring() {
    if (!this.video) {
      console.warn('⚠️ setupVideoMonitoring: video element not found');
      return;
    }

    const segments = this.segmentManager.getSegments();
    const merged = this.segmentManager.mergeOverlappingSegments(segments);
    this.segmentManager.setSegments(merged);

    console.log(`✓ Video monitoring setup with ${merged.length} segments to skip`);

    if (this.boundTimeUpdateHandler) {
      this.video.removeEventListener('timeupdate', this.boundTimeUpdateHandler);
    }

    this.boundTimeUpdateHandler = this.handleTimeUpdate.bind(this);
    this.video.addEventListener('timeupdate', this.boundTimeUpdateHandler);

    console.log(`✓ Timeupdate listener added. AutoSkip: ${this.settings.autoSkip}`);
  }

  stopMonitoring() {
    if (this.video && this.boundTimeUpdateHandler) {
      this.video.removeEventListener('timeupdate', this.boundTimeUpdateHandler);
      this.boundTimeUpdateHandler = null;
      console.log('✓ Video monitoring stopped');
    }
  }

  handleTimeUpdate() {
    if (!this.settings.autoSkip || !this.video) return;

    const currentTime = this.video.currentTime;

    const segment = this.segmentManager.findSegmentAtTime(
      currentTime,
      this.settings.skipBuffer
    );

    if (segment) {
      console.log(`⏩ Detected segment to skip at ${currentTime}s: ${segment.category} (${segment.start}s - ${segment.end}s)`);

      if (this.settings.enablePreview) {
        this.showSkipPreview(segment);
      }

      this.performSkip(segment);
    }
  }

  showSkipPreview(segment) {
    this.uiManager.showSkipPreview(
      segment,
      this.settings.skipBuffer,
      () => {
        this.segmentManager.removeSegment(segment);
      }
    );
  }

  performSkip(segment) {
    if (!this.video) return;

    console.log(`⏩ Skipping: ${segment.category} (${segment.start}s - ${segment.end}s)`);

    this.segmentManager.updateStats(segment);

    this.uiManager.applyFadeEffect(this.video, true);

    const newTime = segment.end;

    setTimeout(() => {
      if (this.video) {
        this.video.currentTime = newTime;
        this.uiManager.applyFadeEffect(this.video, false);

        const duration = Math.floor(segment.end - segment.start);
        const message = templateReplace(SUCCESS_MESSAGES.SKIPPED, {
          category: segment.category,
          duration
        });
        this.uiManager.showNotification(message, 'success');

        this.segmentManager.removePassedSegments(newTime);
      }
    }, CONFIG.VIDEO.FADE_TRANSITION_MS);
  }

  skipToSegment(segment) {
    if (!this.video) return;

    this.video.currentTime = segment.end;
    this.uiManager.showNotification(
      `⏩ Skipped manually: ${segment.category}`,
      'info'
    );

    this.segmentManager.removePassedSegments(segment.end);
  }

  cleanup() {
    this.stopMonitoring();
    this.video = null;
  }
}

// ============================================================================
// MAIN YOUTUBE SKIP MANAGER
// ============================================================================
class YouTubeSkipManager {
  constructor() {
    this.currentVideoId = null;
    this.isAnalyzing = false;
    this.settings = CONFIG.DEFAULTS.SETTINGS;

    this.transcriptExtractor = new TranscriptExtractor();
    this.uiManager = new UIManager();
    this.segmentManager = new SegmentManager();
    this.videoMonitor = new VideoMonitor(this.segmentManager, this.uiManager, this.settings);

    this.init();
  }

  async init() {
    await this.loadSettings();
    this.observeVideoChanges();
    this.setupMessageListener();
    console.log('YouTube Smart Skip initialized');
  }

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

  async saveSettings() {
    try {
      await storage.local.set({ [STORAGE_KEYS.SETTINGS]: this.settings });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

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

    const video = document.querySelector(SELECTORS.VIDEO);
    const videoId = extractVideoId(window.location.href);
    if (video && videoId) {
      this.handleNewVideo(video, videoId);
    }
  }

  async handleNewVideo(video, videoId) {
    this.videoMonitor.setVideo(video);
    this.currentVideoId = videoId;
    this.segmentManager.clearSegments();
    this.transcriptExtractor.timedtextWarningShown = false;

    console.log(`New video detected: ${videoId}`);

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

    await new Promise(r => setTimeout(r, CONFIG.VIDEO.INITIAL_LOAD_DELAY_MS));

    this.transcriptExtractor.tryOpenTranscriptPanel();

    await this.analyzeVideo(videoId);

    this.videoMonitor.setupMonitoring();
  }

  async analyzeVideo(videoId) {
    if (this.isAnalyzing) return;

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

      const videoTitle = document.querySelector(SELECTORS.VIDEO_TITLE)?.textContent || 'YouTube Video';

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
        const validSegments = this.segmentManager.filterValidSegments(result.segments);
        this.segmentManager.setSegments(validSegments);

        await this.segmentManager.cacheAnalysis(videoId, validSegments);

        this.videoMonitor.setupMonitoring();

        this.displaySegments();

        const message = this.segmentManager.getLoadMessage(validSegments.length, false);
        this.uiManager.showNotification(message, 'success');

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

  displaySegments() {
    const video = this.videoMonitor.getVideo();
    const segments = this.segmentManager.getSegments();

    if (!video || !segments.length) return;

    this.uiManager.displaySegmentMarkers(
      segments,
      video,
      (segment) => {
        this.videoMonitor.skipToSegment(segment);
      }
    );
  }

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

      const data = await storage.local.get(STORAGE_KEYS.ADVANCED_SETTINGS);
      const whitelist = data[STORAGE_KEYS.ADVANCED_SETTINGS]?.channelWhitelist || [];

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
          return true;
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
