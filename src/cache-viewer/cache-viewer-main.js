// cache-viewer-main.js - Main cache viewer application

import { StorageService } from '../shared/services/storage-service.js';
import { logger } from '../shared/logger/index.js';

/**
 * CacheViewerApp - Main application for cache viewer page
 */
class CacheViewerApp {
  constructor() {
    this.cacheData = [];
    this.storageService = new StorageService();
    this.logger = logger.child('CacheViewerApp');

    this.init();
  }

  /**
   * Initialize application
   */
  async init() {
    try {
      this.logger.info('Initializing cache viewer');

      // Load dark mode preference
      await this.loadDarkMode();

      // Setup event listeners
      this.setupEventListeners();

      // Load cache data
      await this.loadCache();

      this.logger.info('Cache viewer initialized');
    } catch (error) {
      this.logger.error('Initialization failed', { error: error.message });
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    document.getElementById('refresh-btn').addEventListener('click', () => this.loadCache());
    document.getElementById('clear-all-btn').addEventListener('click', () => this.clearAllCache());
    document.getElementById('search-input').addEventListener('input', () => this.filterVideos());
    document.getElementById('dark-mode-toggle').addEventListener('click', () => this.toggleDarkMode());
  }

  /**
   * Load dark mode preference
   */
  async loadDarkMode() {
    const data = await chrome.storage.local.get(['darkMode']);
    if (data.darkMode) {
      document.body.classList.add('dark-mode');
      this.updateDarkModeIcon();
    }
  }

  /**
   * Toggle dark mode
   */
  async toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    await chrome.storage.local.set({ darkMode: isDark });
    this.updateDarkModeIcon();
  }

  /**
   * Update dark mode icon
   */
  updateDarkModeIcon() {
    const toggle = document.getElementById('dark-mode-toggle');
    const icon = toggle.querySelector('.material-icons');
    icon.textContent = document.body.classList.contains('dark-mode') ? 'light_mode' : 'dark_mode';
  }

  /**
   * Load cache data
   */
  async loadCache() {
    try {
      this.logger.info('Loading cache data');

      const allData = await chrome.storage.local.get(null);
      this.cacheData = [];

      let totalSegments = 0;
      let totalTime = 0;
      let cacheSize = 0;

      Object.keys(allData).forEach(key => {
        if (key.startsWith('analysis_')) {
          const videoId = key.replace('analysis_', '');
          const data = allData[key];

          // Handle both old format (array) and new format (AnalysisResult object)
          let segments = [];
          let timestamp = Date.now();
          let metadata = {};

          if (Array.isArray(data)) {
            // Old format - direct array of segments
            segments = data;
          } else if (data && data.segments) {
            // New format - AnalysisResult object
            segments = data.segments;
            metadata = data.metadata || {};
            timestamp = metadata.analyzedAt ? new Date(metadata.analyzedAt).getTime() : Date.now();
          } else {
            this.logger.warn('Invalid cache format', { key, data });
            return;
          }

          // Validate that we have segments
          if (segments.length > 0) {
            totalSegments += segments.length;

            // Calculate total time of segments
            segments.forEach(seg => {
              totalTime += (seg.end - seg.start);
            });

            this.cacheData.push({
              videoId,
              segments,
              timestamp,
              metadata
            });

            // Estimate cache size
            cacheSize += JSON.stringify(data).length;
          } else {
            this.logger.warn('No segments found', { key });
          }
        }
      });

      this.logger.info('Cache loaded', {
        videos: this.cacheData.length,
        segments: totalSegments
      });

      // Sort by timestamp (most recent first)
      this.cacheData.sort((a, b) => b.timestamp - a.timestamp);

      // Update statistics
      this.updateStatistics(totalSegments, totalTime, cacheSize);

      // Render list
      this.renderVideoList(this.cacheData);
    } catch (error) {
      this.logger.error('Failed to load cache', { error: error.message });
    }
  }

  /**
   * Update statistics display
   */
  updateStatistics(totalSegments, totalTime, cacheSize) {
    document.getElementById('total-videos').textContent = this.cacheData.length;
    document.getElementById('total-segments').textContent = totalSegments;
    document.getElementById('cache-size').textContent = this.formatBytes(cacheSize);
    document.getElementById('total-time').textContent = this.formatTime(totalTime);
  }

  /**
   * Render video list
   */
  renderVideoList(videos) {
    const container = document.getElementById('video-list');

    if (videos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <h2>No videos in cache</h2>
          <p>Analyzed videos will appear here after the first analysis</p>
        </div>
      `;
      return;
    }

    container.innerHTML = videos.map(video => `
      <div class="video-card" data-video-id="${video.videoId}">
        <div class="video-header">
          <div class="video-info">
            <div class="video-id">📹 ${video.videoId}</div>
            <div style="font-size: 14px; opacity: 0.8;">
              ${video.segments.length} segments detected
            </div>
          </div>
          <div class="video-actions">
            <button class="icon-btn btn-open-video" data-video-id="${video.videoId}" title="Open on YouTube">
              <span class="material-icons">open_in_new</span>
            </button>
            <button class="icon-btn danger btn-delete-video" data-video-id="${video.videoId}" title="Remove from cache">
              <span class="material-icons">delete</span>
            </button>
          </div>
        </div>

        <div class="segments">
          ${video.segments.map(seg => {
            const category = this.getCategoryInfo(seg.category);
            return `
              <span class="segment-badge ${category.class}" title="${seg.description || ''}">
                ${category.icon} ${seg.category}
                <span class="segment-time">${Math.floor(seg.start)}s-${Math.floor(seg.end)}s</span>
              </span>
            `;
          }).join('')}
        </div>

        <div class="segment-details">
          Total time to skip: <strong>${this.formatTime(video.segments.reduce((sum, s) => sum + (s.end - s.start), 0))}</strong>
        </div>
      </div>
    `).join('');

    // Add event listeners using delegation
    this.attachVideoListeners();
  }

  /**
   * Attach video action listeners
   */
  attachVideoListeners() {
    const container = document.getElementById('video-list');

    // Remove old listeners by cloning
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);

    // Add new listeners with event delegation
    newContainer.addEventListener('click', (e) => {
      const openBtn = e.target.closest('.btn-open-video');
      const deleteBtn = e.target.closest('.btn-delete-video');

      if (openBtn) {
        const videoId = openBtn.dataset.videoId;
        this.openVideo(videoId);
      } else if (deleteBtn) {
        const videoId = deleteBtn.dataset.videoId;
        this.deleteVideo(videoId);
      }
    });
  }

  /**
   * Get category info
   */
  getCategoryInfo(category) {
    const categories = {
      'Sponsor': { icon: '📢', class: 'sponsor' },
      'Self-Promo': { icon: '📣', class: 'autopromo' },
      'Intro': { icon: '🎬', class: 'intro' },
      'Outro': { icon: '👋', class: 'outro' },
      'Donations': { icon: '💰', class: 'donations' },
      'Acknowledgments': { icon: '🙏', class: 'donations' },
      'Merchandise': { icon: '👕', class: 'autopromo' }
    };

    return categories[category] || { icon: '📌', class: 'sponsor' };
  }

  /**
   * Filter videos by search term
   */
  filterVideos() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const filtered = this.cacheData.filter(video =>
      video.videoId.toLowerCase().includes(search)
    );
    this.renderVideoList(filtered);
  }

  /**
   * Open video on YouTube
   */
  openVideo(videoId) {
    chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}` });
    this.logger.info('Opening video', { videoId });
  }

  /**
   * Delete video from cache
   */
  async deleteVideo(videoId) {
    if (confirm(`Remove video ${videoId} from cache?`)) {
      try {
        await chrome.storage.local.remove(`analysis_${videoId}`);
        this.logger.info('Video deleted', { videoId });
        await this.loadCache();
      } catch (error) {
        this.logger.error('Failed to delete video', { videoId, error: error.message });
        alert('Failed to delete video');
      }
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    if (confirm(`⚠️ WARNING\n\nDelete ALL ${this.cacheData.length} videos from cache?\n\nThis action cannot be undone.`)) {
      try {
        const keys = this.cacheData.map(v => `analysis_${v.videoId}`);
        await chrome.storage.local.remove(keys);
        this.logger.info('Cache cleared', { count: keys.length });
        await this.loadCache();
        alert(`✓ ${keys.length} videos removed from cache!`);
      } catch (error) {
        this.logger.error('Failed to clear cache', { error: error.message });
        alert('Failed to clear cache');
      }
    }
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * Format time to human readable
   */
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }
}

// Initialize when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CacheViewerApp();
  });
} else {
  new CacheViewerApp();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CacheViewerApp };
}
