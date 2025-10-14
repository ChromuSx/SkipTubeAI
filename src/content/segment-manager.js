// segment-manager.js - Manages video segments (caching, merging, storage)
import { storage, generateCacheKey, templateReplace } from '../shared/utils.js';
import { SUCCESS_MESSAGES } from '../shared/constants.js';

/**
 * SegmentManager - Handles segment operations
 */
export class SegmentManager {
  constructor() {
    this.segments = [];
  }

  /**
   * Get segments
   * @returns {Array}
   */
  getSegments() {
    return this.segments;
  }

  /**
   * Set segments
   * @param {Array} segments - Segments array
   */
  setSegments(segments) {
    this.segments = segments;
  }

  /**
   * Add segment
   * @param {Object} segment - Segment to add
   */
  addSegment(segment) {
    this.segments.push(segment);
  }

  /**
   * Clear all segments
   */
  clearSegments() {
    this.segments = [];
  }

  /**
   * Remove segment
   * @param {Object} segment - Segment to remove
   */
  removeSegment(segment) {
    this.segments = this.segments.filter(s => s !== segment);
  }

  /**
   * Remove segments that have been passed
   * @param {number} currentTime - Current video time
   */
  removePassedSegments(currentTime) {
    const before = this.segments.length;
    this.segments = this.segments.filter(s => s.end > currentTime);
    const removed = before - this.segments.length;
    if (removed > 0) {
      console.log(`✓ Removed ${removed} passed segments, ${this.segments.length} remaining`);
    }
  }

  /**
   * Merge overlapping segments
   * @param {Array} segments - Segments to merge
   * @returns {Array} - Merged segments
   */
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

        // Combine descriptions
        lastMerged.description += ` | ${current.description}`;

        console.log(`🔗 Merged overlapping segments: ${lastMerged.start}s-${lastMerged.end}s (${lastMerged.category})`);
      } else {
        // No overlap, add as new segment
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Get cached analysis from storage
   * @param {string} videoId - Video ID
   * @returns {Promise<Array|null>}
   */
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

  /**
   * Cache analysis to storage
   * @param {string} videoId - Video ID
   * @param {Array} segments - Segments to cache
   */
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

  /**
   * Find segment at current time
   * @param {number} currentTime - Current video time
   * @param {number} skipBuffer - Skip buffer in seconds
   * @returns {Object|null} - Segment or null
   */
  findSegmentAtTime(currentTime, skipBuffer = 0) {
    return this.segments.find(segment =>
      currentTime >= segment.start - skipBuffer &&
      currentTime < segment.end
    );
  }

  /**
   * Get total duration of all segments
   * @returns {number} - Total duration in seconds
   */
  getTotalDuration() {
    return this.segments.reduce((total, segment) => {
      return total + (segment.end - segment.start);
    }, 0);
  }

  /**
   * Get segments by category
   * @param {string} category - Category name
   * @returns {Array}
   */
  getSegmentsByCategory(category) {
    return this.segments.filter(segment =>
      segment.category.includes(category)
    );
  }

  /**
   * Count segments by category
   * @returns {Object} - Category counts
   */
  countByCategory() {
    const counts = {};
    this.segments.forEach(segment => {
      // Handle merged categories
      const categories = segment.category.split(' + ');
      categories.forEach(cat => {
        counts[cat] = (counts[cat] || 0) + 1;
      });
    });
    return counts;
  }

  /**
   * Update statistics in storage
   * @param {Object} segment - Skipped segment
   */
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

  /**
   * Get formatted success message
   * @param {number} count - Number of segments
   * @param {boolean} fromCache - Whether loaded from cache
   * @returns {string}
   */
  getLoadMessage(count, fromCache = false) {
    if (fromCache) {
      return templateReplace(SUCCESS_MESSAGES.SEGMENTS_LOADED, { count });
    } else {
      return templateReplace(SUCCESS_MESSAGES.SEGMENTS_FOUND, { count });
    }
  }

  /**
   * Log segments details
   */
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

  /**
   * Validate segment structure
   * @param {Object} segment - Segment to validate
   * @returns {boolean}
   */
  isValidSegment(segment) {
    return segment &&
           typeof segment.start === 'number' &&
           typeof segment.end === 'number' &&
           segment.start >= 0 &&
           segment.end > segment.start &&
           segment.category &&
           typeof segment.category === 'string';
  }

  /**
   * Filter invalid segments
   * @param {Array} segments - Segments to filter
   * @returns {Array}
   */
  filterValidSegments(segments) {
    return segments.filter(seg => this.isValidSegment(seg));
  }

  /**
   * Sort segments by start time
   * @param {Array} segments - Segments to sort
   * @returns {Array}
   */
  sortSegments(segments) {
    return segments.slice().sort((a, b) => a.start - b.start);
  }
}
