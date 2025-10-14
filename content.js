// content.js - Handles interaction with YouTube
class YouTubeSkipManager {
  constructor() {
    this.video = null;
    this.skipSegments = [];
    this.isAnalyzing = false;
    this.currentVideoId = null;
    this.transcriptCache = new Map();
    this.timedtextWarningShown = false; // Flag to avoid spam warnings

    this.settings = {
      skipSponsors: true,
      skipIntros: true,
      skipOutros: true,
      skipDonations: true,
      skipSelfPromo: true,
      skipBuffer: 0.5, // seconds of buffer before skip
      enablePreview: true,
      autoSkip: true
    };

    this.init();
  }

  init() {
    this.loadSettings();
    this.observeVideoChanges();
    this.injectTranscriptInterceptor();
    this.setupMessageListener();
    console.log('YouTube Smart Skip initialized');
  }

  async loadSettings() {
    const stored = await chrome.storage.local.get('settings');
    if (stored.settings) {
      this.settings = { ...this.settings, ...stored.settings };
    }
  }

  observeVideoChanges() {
    // Observe DOM changes to detect new video
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
  }

  extractVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  async handleNewVideo(video, videoId) {
    this.video = video;
    this.currentVideoId = videoId;
    this.skipSegments = [];
    this.timedtextWarningShown = false; // Reset flag for new video

    console.log(`New video detected: ${videoId}`);

    // Check local cache
    const cached = await this.getCachedAnalysis(videoId);
    if (cached) {
      this.skipSegments = cached;
      this.setupVideoMonitoring();
      this.displaySegments();
      this.showNotification(`✅ ${cached.length} segments loaded from cache`, 'success');
      console.log(`Loaded ${cached.length} segments from cache:`);
      cached.forEach((seg, i) => {
        console.log(`  ${i + 1}. [${seg.start}s - ${seg.end}s] ${seg.category}: ${seg.description}`);
      });
      return;
    }

    // Wait for page to fully load
    await new Promise(r => setTimeout(r, 2000));

    // Try to automatically open transcript panel to facilitate extraction
    this.tryOpenTranscriptPanel();

    // Start analysis
    this.analyzeVideo(videoId);
    this.setupVideoMonitoring();
  }

  tryOpenTranscriptPanel() {
    try {
      // Search for "Show transcript" button
      const transcriptButton = Array.from(document.querySelectorAll('button'))
        .find(btn => {
          const text = btn.textContent.toLowerCase();
          return text.includes('trascrizione') || text.includes('transcript');
        });

      if (transcriptButton && !transcriptButton.getAttribute('aria-pressed')) {
        console.log('Automatically opening transcript panel...');
        transcriptButton.click();
      }
    } catch (error) {
      // Ignore errors, this is just a helper
    }
  }

  setupVideoMonitoring() {
    if (!this.video) {
      console.warn('⚠️ setupVideoMonitoring: video element not found');
      return;
    }

    // Merge overlapping segments before starting monitoring
    this.skipSegments = this.mergeOverlappingSegments(this.skipSegments);

    console.log(`✓ Video monitoring setup with ${this.skipSegments.length} segments to skip`);

    // Remove previous listeners
    this.video.removeEventListener('timeupdate', this.handleTimeUpdate);

    // Add new listener
    this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
    this.video.addEventListener('timeupdate', this.handleTimeUpdate);

    console.log(`✓ Timeupdate listener added. AutoSkip: ${this.settings.autoSkip}`);
  }

  mergeOverlappingSegments(segments) {
    if (segments.length <= 1) return segments;

    // Sort by start time
    const sorted = segments.slice().sort((a, b) => a.start - b.start);
    const merged = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const lastMerged = merged[merged.length - 1];

      // If current segment overlaps with last merged
      if (current.start <= lastMerged.end) {
        // Merge by extending end time to maximum
        lastMerged.end = Math.max(lastMerged.end, current.end);
        // Combine categories
        if (!lastMerged.category.includes(current.category)) {
          lastMerged.category += ` + ${current.category}`;
        }
        lastMerged.description += ` | ${current.description}`;
        console.log(`🔗 Merged overlapping segments: ${lastMerged.start}s-${lastMerged.end}s (${lastMerged.category})`);
      } else {
        // No overlap, add as new segment
        merged.push(current);
      }
    }

    return merged;
  }

  handleTimeUpdate() {
    if (!this.settings.autoSkip || !this.video) return;

    const currentTime = this.video.currentTime;

    // Check if we're in a segment to skip
    for (const segment of this.skipSegments) {
      if (currentTime >= segment.start - this.settings.skipBuffer &&
          currentTime < segment.end) {

        console.log(`⏩ Detected segment to skip at ${currentTime}s: ${segment.category} (${segment.start}s - ${segment.end}s)`);

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

  performSkip(segment) {
    if (!this.video) return;

    console.log(`⏩ Skipping: ${segment.category} (${segment.start}s - ${segment.end}s)`);

    // Save statistics
    this.updateStats(segment);

    // Fade animation if possible
    this.video.style.transition = 'opacity 0.3s';
    this.video.style.opacity = '0.5';

    const newTime = segment.end;

    setTimeout(() => {
      this.video.currentTime = newTime;
      this.video.style.opacity = '1';
      this.showNotification(`⏩ Skipped: ${segment.category} (${Math.floor(segment.end - segment.start)}s saved)`, 'success');

      // Remove all segments that have been skipped or passed
      // This prevents multiple skips of overlapping segments
      this.skipSegments = this.skipSegments.filter(s => s.end > newTime);
      console.log(`✓ ${this.skipSegments.length} segments remaining to skip`);
    }, 300);
  }

  async updateStats(segment) {
    const timeSaved = segment.end - segment.start;

    chrome.storage.local.get('stats', (data) => {
      const stats = data.stats || {
        timeSaved: 0,
        segmentsSkipped: 0,
        videosAnalyzed: 0
      };

      stats.timeSaved = (stats.timeSaved || 0) + timeSaved;
      stats.segmentsSkipped = (stats.segmentsSkipped || 0) + 1;

      chrome.storage.local.set({ stats }, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Error saving statistics:', chrome.runtime.lastError);
        } else {
          console.log(`📊 Statistics saved: ${Math.floor(stats.timeSaved)}s saved, ${stats.segmentsSkipped} segments skipped`);
          console.log('📊 Complete stats object:', stats);
        }
      });
    });
  }

  showSkipPreview(segment) {
    const preview = document.createElement('div');
    preview.className = 'yss-skip-preview';
    preview.innerHTML = `
      <div class="yss-preview-content">
        <span>⏩ Skipping ${segment.category} in ${this.settings.skipBuffer}s</span>
        <button class="yss-cancel-skip">Cancel</button>
      </div>
    `;

    preview.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 9999;
      font-family: Roboto, Arial, sans-serif;
    `;

    document.body.appendChild(preview);

    // Handle cancellation
    preview.querySelector('.yss-cancel-skip').onclick = () => {
      this.skipSegments = this.skipSegments.filter(s => s !== segment);
      preview.remove();
    };

    // Remove after skip
    setTimeout(() => preview.remove(), this.settings.skipBuffer * 1000 + 500);
  }

  async analyzeVideo(videoId) {
    if (this.isAnalyzing) return;

    // Check if channel is in whitelist
    const isWhitelisted = await this.isChannelWhitelisted();
    if (isWhitelisted) {
      console.log('⚪ Channel excluded from whitelist, skipping analysis');
      this.showNotification('ℹ️ Channel excluded by advanced settings', 'info');
      this.isAnalyzing = false;
      return;
    }

    this.isAnalyzing = true;
    this.showNotification('🔍 Analyzing video with AI...', 'info');

    try {
      // Get transcript
      const transcript = await this.getTranscript(videoId);

      if (!transcript || transcript.length === 0) {
        console.warn('Transcript not available, unable to analyze');
        this.showNotification(
          '⚠️ Transcript not available for this video. The extension only works with videos that have subtitles.',
          'warning'
        );
        this.isAnalyzing = false;
        return;
      }

      console.log(`✓ Transcript obtained: ${transcript.length} segments`);
      this.showNotification(`✓ Transcript loaded: ${transcript.length} segments. Analyzing with AI...`, 'info');

      // Get video title
      const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'YouTube Video';

      // Send to background for AI analysis
      const result = await chrome.runtime.sendMessage({
        action: 'analyzeTranscript',
        data: {
          videoId: videoId,
          transcript: transcript,
          title: videoTitle,
          settings: this.settings
        }
      });

      if (result.success && result.segments && result.segments.length > 0) {
        this.skipSegments = result.segments;
        await this.cacheAnalysis(videoId, result.segments);

        // IMPORTANT: Reconfigure monitoring after assigning segments
        this.setupVideoMonitoring();

        this.showNotification(`✅ Found ${result.segments.length} segments to skip (AI analysis)!`, 'success');
        this.displaySegments();

        // Detailed log of found segments
        console.log('Segments to skip:');
        result.segments.forEach((seg, i) => {
          console.log(`  ${i + 1}. [${seg.start}s - ${seg.end}s] ${seg.category}: ${seg.description}`);
        });
      } else if (result.success) {
        this.showNotification('ℹ️ No content to skip detected by AI', 'info');
      } else {
        console.error('AI analysis error:', result.error);
        this.showNotification(
          `❌ AI analysis error: ${result.error}. Configure API key in background.js`,
          'error'
        );
      }

    } catch (error) {
      console.error('Analysis error:', error);
      this.showNotification('❌ Error during analysis', 'error');
    }

    this.isAnalyzing = false;
  }
  

  async getTranscript(videoId) {
    // First check cache
    if (this.transcriptCache.has(videoId)) {
      console.log('Transcript found in cache');
      return this.transcriptCache.get(videoId);
    }

    console.log('Starting transcript extraction with multiple methods...');

    // Method 1: Extract from DOM (most reliable)
    console.log('Attempt 1: Extracting from DOM...');
    const domTranscript = await this.extractTranscriptFromDOM();
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
  
  async waitForInterceptedTranscript() {
    return new Promise((resolve) => {
      let timeout = setTimeout(() => {
        console.log('⏱️ Timeout waiting for intercepted transcript');
        resolve(null);
      }, 10000); // Increased to 10 seconds

      const messageHandler = (event) => {
        if (event.data && event.data.type === 'YSS_TRANSCRIPT') {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          const transcript = this.parseYouTubeTranscript(event.data.data);
          resolve(transcript);
        }
      };

      window.addEventListener('message', messageHandler);
    });
  }
  
  async extractFromPlayerConfig(videoId) {
    try {
      console.log('Searching for ytInitialPlayerResponse...');

      // Method 1: Try reading directly from window (most reliable)
      if (window.ytInitialPlayerResponse) {
        console.log('✓ ytInitialPlayerResponse found in global window');
        const result = await this.extractTranscriptFromPlayerResponse(window.ytInitialPlayerResponse);
        if (result) return result;
      }

      // Method 2: Try getting ytInitialPlayerResponse from script tags
      console.log('Searching in script tags...');
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        if (content && content.includes('ytInitialPlayerResponse')) {
          const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
          if (match) {
            console.log('✓ ytInitialPlayerResponse found in scripts');
            const playerResponse = JSON.parse(match[1]);
            return this.extractTranscriptFromPlayerResponse(playerResponse);
          }
        }
      }

      console.log('ytInitialPlayerResponse not found');
    } catch (error) {
      console.error('Error extracting from player config:', error);
    }
    return null;
  }
  
  async extractTranscriptFromPlayerResponse(playerResponse) {
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


  async extractTranscriptFromDOM() {
    try {
      console.log('🔍 Searching for transcript panel in DOM...');

      // Helper function to extract segments
      const extractSegments = () => {
        // Search for both selector variants
        const transcriptPanel = document.querySelector(
          'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"],' +
          'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]'
        );

        if (!transcriptPanel) {
          console.log('⚠️ Transcript panel not found in DOM');
          return null;
        }

        console.log('✓ Transcript panel found:', transcriptPanel.getAttribute('target-id'));

        // Try multiple selectors for better compatibility
        let segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');

        // If nothing found, try alternative selectors
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
          // Try multiple selectors for timestamp and text
          let timeElement = segment.querySelector('.segment-timestamp, [class*="timestamp"]');
          let textElement = segment.querySelector('.segment-text, [class*="segment-text"], [class*="cue-text"]');

          // If not found with classes, try with tags
          if (!timeElement) {
            timeElement = segment.querySelector('div[role="button"]');
          }
          if (!textElement) {
            const divs = segment.querySelectorAll('div');
            textElement = Array.from(divs).find(div => div.textContent && !div.textContent.match(/^\d+:\d+/));
          }

          if (timeElement && textElement) {
            const timeText = timeElement.textContent || timeElement.innerText;
            const text = textElement.textContent || textElement.innerText;

            if (timeText && text) {
              const time = this.parseTimeString(timeText);
              transcript.push({
                text: text.trim(),
                start: time,
                duration: 5
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

      // Method 1: Search directly in DOM if panel is already open
      let transcript = extractSegments();
      if (transcript && transcript.length > 0) {
        console.log(`✓ Panel already open - Extracted ${transcript.length} segments`);
        return transcript;
      }

      console.log('Panel not open, searching for button...');

      // Method 2: Search and click transcript button
      const buttons = Array.from(document.querySelectorAll('button'));
      const transcriptButton = buttons.find(btn => {
        const text = btn.textContent.toLowerCase();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        return text.includes('trascrizione') || text.includes('transcript') ||
               ariaLabel.includes('trascrizione') || ariaLabel.includes('transcript');
      });

      if (transcriptButton) {
        console.log('✓ Transcript button found, clicking...');
        transcriptButton.click();

        // Wait for panel to open and try multiple times with longer waits
        console.log('Waiting for segments to load...');
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 800));

          // Verify panel is visible
          const panel = document.querySelector(
            'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"],' +
            'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]'
          );
          if (panel) {
            const isVisible = panel.offsetParent !== null;
            console.log(`Attempt ${i + 1}: Panel ${isVisible ? 'visible' : 'not visible'}`);

            transcript = extractSegments();
            if (transcript && transcript.length > 0) {
              console.log(`✅ Extracted ${transcript.length} segments after opening panel (attempt ${i + 1})`);
              return transcript;
            }

            // Check if there are loading elements
            const loading = panel.querySelector('tp-yt-paper-spinner, ytd-continuation-item-renderer');
            if (loading) {
              console.log('⏳ Loading in progress...');
            }
          }
        }
        console.warn('⚠️ Panel open but no segments found after 10 attempts');

        // Debug: show what's in the panel
        const panel = document.querySelector(
          'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"],' +
          'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]'
        );
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
  
  parseTimeString(timeStr) {
    // Convert "1:23" or "1:23:45" to seconds
    const parts = timeStr.trim().split(':').map(p => parseInt(p));
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }

  displaySegments() {
    // Remove previous markers
    document.querySelectorAll('.yss-segment-marker').forEach(m => m.remove());
    document.querySelectorAll('.yss-segment-tooltip').forEach(t => t.remove());

    const progressBar = document.querySelector('.ytp-progress-bar');
    if (!progressBar || !this.video) return;

    const duration = this.video.duration;
    if (!duration || duration === 0) {
      console.warn('⚠️ Video duration not available, unable to show timeline');
      return;
    }

    console.log(`🎨 Displaying ${this.skipSegments.length} segments on timeline`);

    this.skipSegments.forEach((segment, index) => {
      // Colors by category
      const colors = {
        'Sponsor': '#FF0000',
        'Autopromo': '#FF8800',
        'Intro': '#00FFFF',
        'Outro': '#CC00FF',
        'Donazioni': '#00FF00',
        'Ringraziamenti': '#00FF00'
      };

      // Find main category color
      let color = '#FF0000'; // Default red
      for (const [cat, col] of Object.entries(colors)) {
        if (segment.category.includes(cat)) {
          color = col;
          break;
        }
      }

      // Calculate position and width
      const left = (segment.start / duration) * 100;
      const width = ((segment.end - segment.start) / duration) * 100;

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

      // Hover to show tooltip
      marker.addEventListener('mouseenter', (e) => {
        marker.style.opacity = '0.9';
        this.showSegmentTooltip(segment, e);
      });

      marker.addEventListener('mouseleave', () => {
        marker.style.opacity = '0.6';
        this.hideSegmentTooltip();
      });

      // Click to skip to segment
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

  showSegmentTooltip(segment, event) {
    // Remove existing tooltip
    this.hideSegmentTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'yss-segment-tooltip';

    const duration = Math.floor(segment.end - segment.start);
    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">${segment.category}</div>
      <div style="font-size: 12px; opacity: 0.9;">
        ${this.formatTime(segment.start)} - ${this.formatTime(segment.end)} (${duration}s)
      </div>
      <div style="font-size: 11px; margin-top: 4px; opacity: 0.8;">
        ${segment.description}
      </div>
      <div style="font-size: 10px; margin-top: 6px; opacity: 0.7; font-style: italic;">
        Click to skip
      </div>
    `;

    tooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 10px 12px;
      border-radius: 6px;
      z-index: 10000;
      pointer-events: none;
      font-family: Roboto, Arial, sans-serif;
      font-size: 13px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;

    document.body.appendChild(tooltip);

    // Position tooltip near cursor
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  }

  hideSegmentTooltip() {
    const tooltip = document.querySelector('.yss-segment-tooltip');
    if (tooltip) tooltip.remove();
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `yss-notification yss-${type}`;
    notification.textContent = message;
    
    const colors = {
      info: '#3498db',
      success: '#27ae60',
      warning: '#f39c12',
      error: '#e74c3c'
    };
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 9999;
      font-family: Roboto, Arial, sans-serif;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  async getCachedAnalysis(videoId) {
    const cached = await chrome.storage.local.get(`analysis_${videoId}`);
    return cached[`analysis_${videoId}`] || null;
  }

  async cacheAnalysis(videoId, segments) {
    await chrome.storage.local.set({
      [`analysis_${videoId}`]: segments
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateSettings') {
        this.settings = { ...this.settings, ...request.settings };
        this.saveSettings();
      }
      if (request.action === 'updateAdvancedSettings') {
        // Update skipBuffer from advanced settings
        if (request.advancedSettings && request.advancedSettings.skipBuffer !== undefined) {
          this.settings.skipBuffer = request.advancedSettings.skipBuffer;
          console.log('⚙️ Skip buffer updated:', this.settings.skipBuffer);
        }
      }
      if (request.action === 'manualAnalyze') {
        this.analyzeVideo(this.currentVideoId);
      }
      if (request.action === 'getCurrentChannel') {
        // Get current channel information
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
        return true; // Keep channel open for async sendResponse
      }
    });
  }

  async saveSettings() {
    await chrome.storage.local.set({ settings: this.settings });
  }

  async isChannelWhitelisted() {
    try {
      // Get current channel name/ID
      const channelLinkElement = document.querySelector('ytd-channel-name a');
      if (!channelLinkElement) {
        console.log('⚠️ Channel element not found');
        return false;
      }

      const channelHandle = channelLinkElement.textContent?.trim();
      const channelUrl = channelLinkElement.href;
      const channelId = channelUrl?.split('/').pop(); // Ex: @ChannelName or UCxxxxxx

      console.log('📺 Current channel:', { channelHandle, channelId });

      // Load whitelist from advanced settings
      const data = await chrome.storage.local.get(['advancedSettings']);
      const whitelist = data.advancedSettings?.channelWhitelist || [];

      // Check if channel is in whitelist (by handle or ID)
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

  injectTranscriptInterceptor() {
    console.log('YouTube Smart Skip: Transcript interceptor initialized');
  }
}

// CSS Styles
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
`;
document.head.appendChild(style);

// Initialize when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new YouTubeSkipManager());
} else {
  new YouTubeSkipManager();
}