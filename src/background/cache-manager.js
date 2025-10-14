// cache-manager.js - Manages analysis caching (in-memory + persistent storage)
import { CONFIG } from '../shared/config.js';
import { storage, generateCacheKey, isCacheExpired } from '../shared/utils.js';

/**
 * CacheManager - Handles dual-layer caching (memory + storage)
 */
export class CacheManager {
  constructor() {
    this.memoryCache = new Map();
  }

  /**
   * Generate cache key from video ID and settings
   * @param {string} videoId - Video ID
   * @param {Object} settings - User settings
   * @param {number} confidenceThreshold - Confidence threshold
   * @returns {string}
   */
  generateKey(videoId, settings, confidenceThreshold) {
    // Note: Currently using simple key without settings hash for backward compatibility
    // Future: Could include settings hash for more granular caching
    return generateCacheKey(videoId);
  }

  /**
   * Get from memory cache
   * @param {string} key - Cache key
   * @returns {Array|null}
   */
  getFromMemory(key) {
    return this.memoryCache.get(key) || null;
  }

  /**
   * Set in memory cache
   * @param {string} key - Cache key
   * @param {Array} value - Segments array
   */
  setInMemory(key, value) {
    this.memoryCache.set(key, value);
  }

  /**
   * Get from persistent storage
   * @param {string} videoId - Video ID
   * @returns {Promise<Array|null>}
   */
  async getFromStorage(videoId) {
    try {
      const cacheKey = generateCacheKey(videoId);
      const result = await storage.local.get(cacheKey);
      return result[cacheKey] || null;
    } catch (error) {
      console.error('Error getting from storage:', error);
      return null;
    }
  }

  /**
   * Save to persistent storage
   * @param {string} videoId - Video ID
   * @param {Array} segments - Segments array
   */
  async saveToStorage(videoId, segments) {
    try {
      const cacheKey = generateCacheKey(videoId);
      const data = {
        [cacheKey]: segments,
        [`${cacheKey}_timestamp`]: Date.now()
      };

      await storage.local.set(data);
      console.log(`✓ Saved to storage: ${cacheKey}`);
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }

  /**
   * Get cached analysis (checks memory first, then storage)
   * @param {string} videoId - Video ID
   * @param {Object} settings - User settings
   * @param {number} confidenceThreshold - Confidence threshold
   * @returns {Promise<Array|null>}
   */
  async get(videoId, settings, confidenceThreshold) {
    const cacheKey = this.generateKey(videoId, settings, confidenceThreshold);

    // Check memory cache first
    const memoryResult = this.getFromMemory(cacheKey);
    if (memoryResult) {
      console.log('✓ Analysis found in memory cache');
      return memoryResult;
    }

    // Check persistent storage
    const storageResult = await this.getFromStorage(videoId);
    if (storageResult) {
      console.log('✓ Analysis found in persistent storage');
      // Populate memory cache
      this.setInMemory(cacheKey, storageResult);
      return storageResult;
    }

    return null;
  }

  /**
   * Save to cache (both memory and storage)
   * @param {string} videoId - Video ID
   * @param {Array} segments - Segments array
   * @param {Object} settings - User settings
   * @param {number} confidenceThreshold - Confidence threshold
   */
  async save(videoId, segments, settings, confidenceThreshold) {
    const cacheKey = this.generateKey(videoId, settings, confidenceThreshold);

    // Save to memory cache
    this.setInMemory(cacheKey, segments);

    // Save to persistent storage
    await this.saveToStorage(videoId, segments);
  }

  /**
   * Clear memory cache
   */
  clearMemory() {
    this.memoryCache.clear();
    console.log('✓ Memory cache cleared');
  }

  /**
   * Clean old cache entries (older than maxAge)
   */
  async cleanOldCache() {
    try {
      const allStorage = await storage.local.get(null);
      const now = Date.now();
      const maxAge = CONFIG.CACHE.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

      const toRemove = [];

      for (const key in allStorage) {
        if (key.endsWith('_timestamp')) {
          const timestamp = allStorage[key];
          if (isCacheExpired(timestamp, CONFIG.CACHE.MAX_AGE_DAYS)) {
            const videoKey = key.replace('_timestamp', '');
            toRemove.push(key, videoKey);
          }
        }
      }

      if (toRemove.length > 0) {
        await storage.local.remove(toRemove);
        console.log(`✓ Cleaned ${toRemove.length / 2} old cache entries`);
      }
    } catch (error) {
      console.error('Error cleaning old cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const allStorage = await storage.local.get(null);
      const cacheKeys = Object.keys(allStorage).filter(key =>
        key.startsWith(CONFIG.CACHE.KEY_PREFIX) && !key.endsWith('_timestamp')
      );

      return {
        memoryCount: this.memoryCache.size,
        storageCount: cacheKeys.length,
        totalSize: JSON.stringify(allStorage).length
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        memoryCount: 0,
        storageCount: 0,
        totalSize: 0
      };
    }
  }

  /**
   * Remove specific cache entry
   * @param {string} videoId - Video ID
   */
  async remove(videoId) {
    try {
      const cacheKey = generateCacheKey(videoId);

      // Remove from memory
      this.memoryCache.delete(cacheKey);

      // Remove from storage
      await storage.local.remove([cacheKey, `${cacheKey}_timestamp`]);

      console.log(`✓ Removed cache for video: ${videoId}`);
    } catch (error) {
      console.error('Error removing cache:', error);
    }
  }

  /**
   * Clear all cache (memory + storage)
   */
  async clearAll() {
    try {
      // Clear memory
      this.clearMemory();

      // Clear storage
      const allStorage = await storage.local.get(null);
      const cacheKeys = Object.keys(allStorage).filter(key =>
        key.startsWith(CONFIG.CACHE.KEY_PREFIX)
      );

      if (cacheKeys.length > 0) {
        await storage.local.remove(cacheKeys);
        console.log(`✓ Cleared all cache (${cacheKeys.length} entries)`);
      }
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }
}
