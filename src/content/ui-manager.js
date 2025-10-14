// ui-manager.js - Handles all UI-related operations (notifications, markers, tooltips)
import { CONFIG } from '../shared/config.js';
import {
  CATEGORY_COLORS,
  NOTIFICATION_COLORS,
  NOTIFICATION_TYPES,
  CSS_CLASSES,
  SELECTORS
} from '../shared/constants.js';
import { formatTime, templateReplace } from '../shared/utils.js';

/**
 * UIManager - Manages all user interface elements
 */
export class UIManager {
  constructor() {
    this.currentTooltip = null;
    this.injectStyles();
  }

  /**
   * Inject CSS styles into page
   */
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

  /**
   * Show notification
   * @param {string} message - Message to display
   * @param {string} type - Notification type (info, success, warning, error)
   */
  showNotification(message, type = NOTIFICATION_TYPES.INFO) {
    const notification = document.createElement('div');
    notification.className = `${CSS_CLASSES.NOTIFICATION} yss-${type}`;
    notification.textContent = message;
    notification.style.background = NOTIFICATION_COLORS[type] || NOTIFICATION_COLORS.info;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), CONFIG.UI.NOTIFICATION_DURATION_MS);
  }

  /**
   * Show skip preview notification
   * @param {Object} segment - Segment to skip
   * @param {number} skipBuffer - Skip buffer in seconds
   * @param {Function} onCancel - Cancel callback
   */
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

    // Handle cancellation
    preview.querySelector('.yss-cancel-skip').onclick = () => {
      if (onCancel) onCancel();
      preview.remove();
    };

    // Auto remove after buffer time
    setTimeout(() => preview.remove(), skipBuffer * 1000 + 500);

    return preview;
  }

  /**
   * Display segment markers on video progress bar
   * @param {Array} segments - Array of segments
   * @param {HTMLVideoElement} video - Video element
   * @param {Function} onMarkerClick - Click handler
   */
  displaySegmentMarkers(segments, video, onMarkerClick) {
    // Remove previous markers
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
      // Get color for category
      const color = this.getCategoryColor(segment.category);

      // Calculate position and width
      const left = (segment.start / duration) * 100;
      const width = ((segment.end - segment.start) / duration) * 100;

      // Create marker
      const marker = document.createElement('div');
      marker.className = CSS_CLASSES.SEGMENT_MARKER;
      marker.dataset.index = index;
      marker.style.cssText = `
        left: ${left}%;
        width: ${width}%;
        background: ${color};
      `;

      // Hover to show tooltip
      marker.addEventListener('mouseenter', (e) => {
        marker.style.opacity = CONFIG.UI.SEGMENT_MARKER_HOVER_OPACITY;
        this.showSegmentTooltip(segment, e);
      });

      marker.addEventListener('mouseleave', () => {
        marker.style.opacity = CONFIG.UI.SEGMENT_MARKER_OPACITY;
        this.hideSegmentTooltip();
      });

      // Click to skip
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onMarkerClick) {
          onMarkerClick(segment);
        }
      });

      progressBar.appendChild(marker);
    });
  }

  /**
   * Clear all segment markers
   */
  clearSegmentMarkers() {
    document.querySelectorAll(`.${CSS_CLASSES.SEGMENT_MARKER}`).forEach(m => m.remove());
    document.querySelectorAll(`.${CSS_CLASSES.SEGMENT_TOOLTIP}`).forEach(t => t.remove());
  }

  /**
   * Show segment tooltip
   * @param {Object} segment - Segment data
   * @param {Event} event - Mouse event
   */
  showSegmentTooltip(segment, event) {
    // Remove existing tooltip
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

    // Position tooltip near cursor
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.bottom = `${window.innerHeight - rect.top + 10}px`;

    this.currentTooltip = tooltip;
  }

  /**
   * Hide segment tooltip
   */
  hideSegmentTooltip() {
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
  }

  /**
   * Get color for category
   * @param {string} category - Category name
   * @returns {string} - Color hex code
   */
  getCategoryColor(category) {
    // Check for exact match or partial match
    for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
      if (category.includes(key)) {
        return color;
      }
    }
    return CATEGORY_COLORS.Sponsor; // Default red
  }

  /**
   * Apply fade effect to video
   * @param {HTMLVideoElement} video - Video element
   * @param {boolean} fadeOut - Fade out if true, fade in if false
   */
  applyFadeEffect(video, fadeOut = true) {
    if (!video) return;

    video.style.transition = `opacity ${CONFIG.VIDEO.FADE_TRANSITION_MS}ms`;
    video.style.opacity = fadeOut ? CONFIG.VIDEO.FADE_OPACITY : '1';
  }

  /**
   * Remove all UI elements
   */
  cleanup() {
    this.clearSegmentMarkers();
    this.hideSegmentTooltip();
    document.querySelectorAll(`.${CSS_CLASSES.NOTIFICATION}`).forEach(n => n.remove());
    document.querySelectorAll(`.${CSS_CLASSES.SKIP_PREVIEW}`).forEach(p => p.remove());
  }
}
