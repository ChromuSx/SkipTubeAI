(function () {
  'use strict';

  // log-levels.js - Log level definitions

  /**
   * Log levels (ordered by severity)
   */
  const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4,
    NONE: 5
  };

  /**
   * Log level names
   */
  const LogLevelNames = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.CRITICAL]: 'CRITICAL',
    [LogLevel.NONE]: 'NONE'
  };

  /**
   * Log level colors for console
   */
  const LogLevelColors = {
    [LogLevel.DEBUG]: '#9E9E9E',    // Gray
    [LogLevel.INFO]: '#2196F3',     // Blue
    [LogLevel.WARN]: '#FF9800',     // Orange
    [LogLevel.ERROR]: '#F44336',    // Red
    [LogLevel.CRITICAL]: '#9C27B0'  // Purple
  };

  /**
   * Log level emojis
   */
  const LogLevelEmojis = {
    [LogLevel.DEBUG]: '🔍',
    [LogLevel.INFO]: 'ℹ️',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.ERROR]: '❌',
    [LogLevel.CRITICAL]: '🔥'
  };

  // logger.js - Main logger class


  /**
   * Logger - Structured logging system
   */
  class Logger {
    /**
     * @param {string} context - Logger context (e.g., 'AIClient', 'TranscriptExtractor')
     * @param {number} minLevel - Minimum log level
     */
    constructor(context = 'App', minLevel = LogLevel.INFO) {
      this.context = context;
      this.minLevel = minLevel;
      this.transports = [];
    }

    /**
     * Add transport (output destination)
     * @param {Object} transport - Transport object with log method
     */
    addTransport(transport) {
      this.transports.push(transport);
    }

    /**
     * Set minimum log level
     * @param {number} level - Log level
     */
    setLevel(level) {
      this.minLevel = level;
    }

    /**
     * Check if level should be logged
     * @param {number} level - Log level
     * @returns {boolean}
     */
    shouldLog(level) {
      return level >= this.minLevel;
    }

    /**
     * Core log method
     * @param {number} level - Log level
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     */
    log(level, message, data = {}) {
      if (!this.shouldLog(level)) {
        return;
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevelNames[level],
        context: this.context,
        message,
        data,
        ...this.getMetadata()
      };

      // Send to all transports
      if (this.transports.length > 0) {
        this.transports.forEach(transport => {
          try {
            transport.log(logEntry, level);
          } catch (error) {
            console.error('Transport error:', error);
          }
        });
      } else {
        // Fallback to console if no transports
        this.consoleLog(logEntry, level);
      }
    }

    /**
     * Console log with colors
     * @param {Object} entry - Log entry
     * @param {number} level - Log level
     */
    consoleLog(entry, level) {
      const emoji = LogLevelEmojis[level];
      const color = LogLevelColors[level];
      const prefix = `${emoji} [${entry.context}]`;

      const hasData = Object.keys(entry.data).length > 0;

      console.log(
        `%c${prefix} ${entry.message}`,
        `color: ${color}; font-weight: bold`,
        hasData ? entry.data : ''
      );
    }

    /**
     * Get metadata for log entry
     * @returns {Object}
     */
    getMetadata() {
      return {
        url: typeof window !== 'undefined' ? window.location?.href : 'background',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
      };
    }

    /**
     * Debug log
     * @param {string} message - Message
     * @param {Object} data - Data
     */
    debug(message, data = {}) {
      this.log(LogLevel.DEBUG, message, data);
    }

    /**
     * Info log
     * @param {string} message - Message
     * @param {Object} data - Data
     */
    info(message, data = {}) {
      this.log(LogLevel.INFO, message, data);
    }

    /**
     * Warning log
     * @param {string} message - Message
     * @param {Object} data - Data
     */
    warn(message, data = {}) {
      this.log(LogLevel.WARN, message, data);
    }

    /**
     * Error log
     * @param {string} message - Message
     * @param {Object} data - Data
     */
    error(message, data = {}) {
      this.log(LogLevel.ERROR, message, data);
    }

    /**
     * Critical log
     * @param {string} message - Message
     * @param {Object} data - Data
     */
    critical(message, data = {}) {
      this.log(LogLevel.CRITICAL, message, data);
    }

    /**
     * Create child logger with sub-context
     * @param {string} subContext - Sub-context name
     * @returns {Logger}
     */
    child(subContext) {
      const childLogger = new Logger(
        `${this.context}:${subContext}`,
        this.minLevel
      );
      childLogger.transports = this.transports;
      return childLogger;
    }

    /**
     * Measure execution time
     * @param {string} label - Timer label
     * @returns {Function} - Stop function
     */
    time(label) {
      const start = performance.now();
      this.debug(`⏱️ Timer started: ${label}`);

      return () => {
        const duration = performance.now() - start;
        this.debug(`⏱️ Timer stopped: ${label}`, { duration: `${duration.toFixed(2)}ms` });
        return duration;
      };
    }

    /**
     * Group logs
     * @param {string} label - Group label
     */
    group(label) {
      if (typeof console.group === 'function') {
        console.group(`[${this.context}] ${label}`);
      }
    }

    /**
     * End group
     */
    groupEnd() {
      if (typeof console.groupEnd === 'function') {
        console.groupEnd();
      }
    }
  }

  /**
   * Console transport - logs to browser console
   */
  class ConsoleTransport {
    log(entry, level) {
      const emoji = LogLevelEmojis[level];
      const color = LogLevelColors[level];
      const prefix = `${emoji} [${entry.context}]`;

      const hasData = Object.keys(entry.data).length > 0;

      console.log(
        `%c${prefix} ${entry.message}`,
        `color: ${color}; font-weight: bold`,
        hasData ? entry.data : ''
      );
    }
  }

  /**
   * Storage transport - logs to chrome storage
   */
  class StorageTransport {
    constructor(maxLogs = 100) {
      this.maxLogs = maxLogs;
      this.storageKey = 'app_logs';
    }

    async log(entry, level) {
      try {
        // Only log ERROR and CRITICAL to storage
        if (level < LogLevel.ERROR) {
          return;
        }

        const result = await chrome.storage.local.get(this.storageKey);
        const logs = result[this.storageKey] || [];

        logs.push(entry);

        // Keep only last maxLogs entries
        const trimmedLogs = logs.slice(-this.maxLogs);

        await chrome.storage.local.set({
          [this.storageKey]: trimmedLogs
        });
      } catch (error) {
        console.error('StorageTransport error:', error);
      }
    }

    async getLogs() {
      try {
        const result = await chrome.storage.local.get(this.storageKey);
        return result[this.storageKey] || [];
      } catch (error) {
        console.error('Error getting logs:', error);
        return [];
      }
    }

    async clearLogs() {
      try {
        await chrome.storage.local.remove(this.storageKey);
      } catch (error) {
        console.error('Error clearing logs:', error);
      }
    }
  }

  // Global logger instance
  const logger = new Logger('SkipTubeAI', LogLevel.INFO);
  logger.addTransport(new ConsoleTransport());

  // Add storage transport for errors
  if (typeof chrome !== 'undefined' && chrome.storage) {
    logger.addTransport(new StorageTransport());
  }

  // base-error.js - Base error class for custom errors

  /**
   * BaseError - Abstract base class for all custom errors
   */
  class BaseError extends Error {
    /**
     * @param {string} message - Error message
     * @param {string} code - Error code
     * @param {Object} context - Additional context
     */
    constructor(message, code, context = {}) {
      super(message);

      this.name = this.constructor.name;
      this.code = code;
      this.context = context;
      this.timestamp = new Date().toISOString();

      // Maintains proper stack trace for where our error was thrown
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      }
    }

    /**
     * Get error as JSON object
     * @returns {Object}
     */
    toJSON() {
      return {
        name: this.name,
        message: this.message,
        code: this.code,
        context: this.context,
        timestamp: this.timestamp,
        stack: this.stack
      };
    }

    /**
     * Get user-friendly message
     * @returns {string}
     */
    getUserMessage() {
      return this.message;
    }

    /**
     * Check if error is retryable
     * @returns {boolean}
     */
    isRetryable() {
      return false;
    }

    /**
     * Get severity level
     * @returns {string}
     */
    getSeverity() {
      return 'error';
    }
  }

  // storage-error.js - Storage-related errors


  /**
   * StorageError - Errors related to storage operations
   */
  class StorageError extends BaseError {
    constructor(message, operation, key = null) {
      super(message, 'STORAGE_ERROR', { operation, key });
      this.operation = operation;
      this.key = key;
    }

    getUserMessage() {
      return `Storage operation failed: ${this.operation}`;
    }
  }

  /**
   * CacheError - Cache-specific errors
   */
  class CacheError extends BaseError {
    constructor(message, cacheKey) {
      super(message, 'CACHE_ERROR', { cacheKey });
      this.cacheKey = cacheKey;
    }

    isRetryable() {
      return true;
    }

    getUserMessage() {
      return 'Cache operation failed. Data will be reloaded.';
    }

    getSeverity() {
      return 'warning';
    }
  }

  // validation-error.js - Validation errors


  /**
   * ValidationError - Data validation errors
   */
  class ValidationError extends BaseError {
    constructor(message, field, value, constraints = {}) {
      super(message, 'VALIDATION_ERROR', { field, value, constraints });
      this.field = field;
      this.value = value;
      this.constraints = constraints;
    }

    getUserMessage() {
      return `Invalid ${this.field}: ${this.message}`;
    }

    getSeverity() {
      return 'warning';
    }
  }

  /**
   * SegmentValidationError - Segment-specific validation errors
   */
  class SegmentValidationError extends ValidationError {
    constructor(message, segment, field) {
      super(message, field, segment);
      this.segment = segment;
    }

    getUserMessage() {
      return `Invalid segment ${this.field}: ${this.message}`;
    }
  }

  /**
   * SettingsValidationError - Settings validation errors
   */
  class SettingsValidationError extends ValidationError {
    constructor(message, settingKey, value) {
      super(message, settingKey, value);
    }

    getUserMessage() {
      return `Invalid setting "${this.field}": ${this.message}`;
    }
  }

  // segment-validator.js - Segment validation logic


  /**
   * SegmentValidator - Validates segment data
   */
  class SegmentValidator {
    /**
     * Validate a single segment
     * @param {Object} segment - Segment to validate
     * @throws {SegmentValidationError}
     */
    static validate(segment) {
      if (!segment || typeof segment !== 'object') {
        throw new SegmentValidationError('Segment must be an object', segment, 'segment');
      }

      this.validateStart(segment.start);
      this.validateEnd(segment.end, segment.start);
      this.validateCategory(segment.category);
      this.validateDescription(segment.description);

      return true;
    }

    /**
     * Validate start time
     * @param {number} start - Start time
     * @throws {SegmentValidationError}
     */
    static validateStart(start) {
      if (typeof start !== 'number') {
        throw new SegmentValidationError('Start must be a number', 'start', start);
      }

      if (start < 0) {
        throw new SegmentValidationError('Start must be non-negative', 'start', start);
      }

      if (!Number.isFinite(start)) {
        throw new SegmentValidationError('Start must be finite', 'start', start);
      }
    }

    /**
     * Validate end time
     * @param {number} end - End time
     * @param {number} start - Start time (for comparison)
     * @throws {SegmentValidationError}
     */
    static validateEnd(end, start) {
      if (typeof end !== 'number') {
        throw new SegmentValidationError('End must be a number', 'end', end);
      }

      if (end <= 0) {
        throw new SegmentValidationError('End must be positive', 'end', end);
      }

      if (!Number.isFinite(end)) {
        throw new SegmentValidationError('End must be finite', 'end', end);
      }

      if (start !== undefined && end <= start) {
        throw new SegmentValidationError(
          'End must be greater than start',
          'end',
          { start, end }
        );
      }
    }

    /**
     * Validate category
     * @param {string} category - Category
     * @throws {SegmentValidationError}
     */
    static validateCategory(category) {
      if (typeof category !== 'string') {
        throw new SegmentValidationError('Category must be a string', 'category', category);
      }

      if (category.trim().length === 0) {
        throw new SegmentValidationError('Category cannot be empty', 'category', category);
      }
    }

    /**
     * Validate description
     * @param {string} description - Description (optional)
     * @throws {SegmentValidationError}
     */
    static validateDescription(description) {
      if (description !== undefined && typeof description !== 'string') {
        throw new SegmentValidationError('Description must be a string', 'description', description);
      }
    }

    /**
     * Validate array of segments
     * @param {Array} segments - Segments array
     * @returns {boolean}
     * @throws {SegmentValidationError}
     */
    static validateArray(segments) {
      if (!Array.isArray(segments)) {
        throw new SegmentValidationError('Segments must be an array', 'segments', segments);
      }

      segments.forEach((segment, index) => {
        try {
          this.validate(segment);
        } catch (error) {
          throw new SegmentValidationError(
            `Invalid segment at index ${index}: ${error.message}`,
            segment,
            `segments[${index}]`
          );
        }
      });

      return true;
    }

    /**
     * Validate that segments don't overlap
     * @param {Array} segments - Segments array (must be sorted)
     * @returns {boolean}
     * @throws {SegmentValidationError}
     */
    static validateNoOverlap(segments) {
      this.validateArray(segments);

      for (let i = 1; i < segments.length; i++) {
        const prev = segments[i - 1];
        const current = segments[i];

        if (current.start < prev.end) {
          throw new SegmentValidationError(
            `Segments overlap at index ${i}`,
            { prev, current },
            `segments[${i}]`
          );
        }
      }

      return true;
    }

    /**
     * Sanitize segment (remove invalid fields, normalize values)
     * @param {Object} segment - Segment to sanitize
     * @returns {Object} - Sanitized segment
     */
    static sanitize(segment) {
      return {
        start: Math.max(0, Math.floor(segment.start || 0)),
        end: Math.max(1, Math.ceil(segment.end || 1)),
        category: (segment.category || 'Unknown').trim(),
        description: (segment.description || '').trim()
      };
    }

    /**
     * Try to validate, return null if invalid
     * @param {Object} segment - Segment to validate
     * @returns {Object|null} - Valid segment or null
     */
    static validateSafe(segment) {
      try {
        this.validate(segment);
        return segment;
      } catch (error) {
        return null;
      }
    }
  }

  // config.js - Centralized configuration
  const CONFIG = {
    // API Configuration
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

    // Transcript extraction settings
    TRANSCRIPT: {
      RETRY_COUNT: 10,
      RETRY_DELAY_MS: 800,
      WAIT_FOR_INTERCEPT_MS: 10000,
      SEGMENT_DEFAULT_DURATION: 5
    },

    // Cache settings
    CACHE: {
      MAX_AGE_DAYS: 30,
      KEY_PREFIX: 'analysis_'
    },

    // Video monitoring settings
    VIDEO: {
      INITIAL_LOAD_DELAY_MS: 2000,
      FADE_TRANSITION_MS: 300,
      FADE_OPACITY: 0.5
    },

    // UI settings
    UI: {
      NOTIFICATION_DURATION_MS: 3000,
      TOAST_DURATION_MS: 3000,
      SEGMENT_MARKER_OPACITY: 0.6,
      SEGMENT_MARKER_HOVER_OPACITY: 0.9,
      TOOLTIP_MAX_WIDTH: 300
    },

    // Default settings
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

  // settings-validator.js - Settings validation logic


  /**
   * SettingsValidator - Validates user settings
   */
  class SettingsValidator {
    /**
     * Validate complete settings object
     * @param {Object} settings - Settings to validate
     * @returns {boolean}
     * @throws {SettingsValidationError}
     */
    static validate(settings) {
      if (!settings || typeof settings !== 'object') {
        throw new SettingsValidationError('Settings must be an object', 'settings', settings);
      }

      // Validate boolean settings
      const booleanSettings = [
        'skipSponsors',
        'skipIntros',
        'skipOutros',
        'skipDonations',
        'skipSelfPromo',
        'enablePreview',
        'autoSkip'
      ];

      booleanSettings.forEach(key => {
        if (settings[key] !== undefined) {
          this.validateBoolean(key, settings[key]);
        }
      });

      // Validate numeric settings
      if (settings.skipBuffer !== undefined) {
        this.validateSkipBuffer(settings.skipBuffer);
      }

      return true;
    }

    /**
     * Validate boolean setting
     * @param {string} key - Setting key
     * @param {any} value - Value to validate
     * @throws {SettingsValidationError}
     */
    static validateBoolean(key, value) {
      if (typeof value !== 'boolean') {
        throw new SettingsValidationError(
          `Must be a boolean`,
          key,
          value
        );
      }
    }

    /**
     * Validate skip buffer
     * @param {number} value - Skip buffer value
     * @throws {SettingsValidationError}
     */
    static validateSkipBuffer(value) {
      if (typeof value !== 'number') {
        throw new SettingsValidationError(
          'Must be a number',
          'skipBuffer',
          value
        );
      }

      if (value < 0 || value > 10) {
        throw new SettingsValidationError(
          'Must be between 0 and 10 seconds',
          'skipBuffer',
          value
        );
      }
    }

    /**
     * Validate advanced settings
     * @param {Object} advancedSettings - Advanced settings
     * @returns {boolean}
     * @throws {SettingsValidationError}
     */
    static validateAdvanced(advancedSettings) {
      if (!advancedSettings || typeof advancedSettings !== 'object') {
        throw new SettingsValidationError(
          'Advanced settings must be an object',
          'advancedSettings',
          advancedSettings
        );
      }

      // Validate confidence threshold
      if (advancedSettings.confidenceThreshold !== undefined) {
        this.validateConfidenceThreshold(advancedSettings.confidenceThreshold);
      }

      // Validate AI model
      if (advancedSettings.aiModel !== undefined) {
        this.validateAIModel(advancedSettings.aiModel);
      }

      // Validate channel whitelist
      if (advancedSettings.channelWhitelist !== undefined) {
        this.validateChannelWhitelist(advancedSettings.channelWhitelist);
      }

      return true;
    }

    /**
     * Validate confidence threshold
     * @param {number} value - Confidence threshold
     * @throws {SettingsValidationError}
     */
    static validateConfidenceThreshold(value) {
      if (typeof value !== 'number') {
        throw new SettingsValidationError(
          'Must be a number',
          'confidenceThreshold',
          value
        );
      }

      if (value < 0 || value > 1) {
        throw new SettingsValidationError(
          'Must be between 0 and 1',
          'confidenceThreshold',
          value
        );
      }
    }

    /**
     * Validate AI model selection
     * @param {string} value - AI model
     * @throws {SettingsValidationError}
     */
    static validateAIModel(value) {
      if (typeof value !== 'string') {
        throw new SettingsValidationError(
          'Must be a string',
          'aiModel',
          value
        );
      }

      const validModels = ['haiku', 'sonnet'];
      if (!validModels.includes(value)) {
        throw new SettingsValidationError(
          `Must be one of: ${validModels.join(', ')}`,
          'aiModel',
          value
        );
      }
    }

    /**
     * Validate channel whitelist
     * @param {Array} value - Channel whitelist
     * @throws {SettingsValidationError}
     */
    static validateChannelWhitelist(value) {
      if (!Array.isArray(value)) {
        throw new SettingsValidationError(
          'Must be an array',
          'channelWhitelist',
          value
        );
      }

      value.forEach((channel, index) => {
        if (typeof channel !== 'string') {
          throw new SettingsValidationError(
            `Channel at index ${index} must be a string`,
            'channelWhitelist',
            channel
          );
        }

        if (channel.trim().length === 0) {
          throw new SettingsValidationError(
            `Channel at index ${index} cannot be empty`,
            'channelWhitelist',
            channel
          );
        }
      });
    }

    /**
     * Sanitize settings (apply defaults, remove invalid fields)
     * @param {Object} settings - Settings to sanitize
     * @returns {Object} - Sanitized settings
     */
    static sanitize(settings) {
      const defaults = CONFIG.DEFAULTS.SETTINGS;

      return {
        skipSponsors: typeof settings.skipSponsors === 'boolean'
          ? settings.skipSponsors
          : defaults.skipSponsors,

        skipIntros: typeof settings.skipIntros === 'boolean'
          ? settings.skipIntros
          : defaults.skipIntros,

        skipOutros: typeof settings.skipOutros === 'boolean'
          ? settings.skipOutros
          : defaults.skipOutros,

        skipDonations: typeof settings.skipDonations === 'boolean'
          ? settings.skipDonations
          : defaults.skipDonations,

        skipSelfPromo: typeof settings.skipSelfPromo === 'boolean'
          ? settings.skipSelfPromo
          : defaults.skipSelfPromo,

        skipBuffer: typeof settings.skipBuffer === 'number'
          ? Math.max(0, Math.min(10, settings.skipBuffer))
          : defaults.skipBuffer,

        enablePreview: typeof settings.enablePreview === 'boolean'
          ? settings.enablePreview
          : defaults.enablePreview,

        autoSkip: typeof settings.autoSkip === 'boolean'
          ? settings.autoSkip
          : defaults.autoSkip
      };
    }

    /**
     * Sanitize advanced settings
     * @param {Object} advancedSettings - Advanced settings
     * @returns {Object} - Sanitized advanced settings
     */
    static sanitizeAdvanced(advancedSettings) {
      const defaults = CONFIG.DEFAULTS.ADVANCED_SETTINGS;

      return {
        confidenceThreshold: typeof advancedSettings.confidenceThreshold === 'number'
          ? Math.max(0, Math.min(1, advancedSettings.confidenceThreshold))
          : defaults.confidenceThreshold,

        aiModel: ['haiku', 'sonnet'].includes(advancedSettings.aiModel)
          ? advancedSettings.aiModel
          : defaults.aiModel,

        skipBuffer: typeof advancedSettings.skipBuffer === 'number'
          ? Math.max(0, Math.min(10, advancedSettings.skipBuffer))
          : defaults.skipBuffer,

        channelWhitelist: Array.isArray(advancedSettings.channelWhitelist)
          ? advancedSettings.channelWhitelist.filter(c => typeof c === 'string' && c.trim().length > 0)
          : defaults.channelWhitelist
      };
    }
  }

  // segment.js - Segment domain model


  /**
   * Segment - Represents a video segment to skip
   */
  class Segment {
    /**
     * @param {number} start - Start time in seconds
     * @param {number} end - End time in seconds
     * @param {string} category - Segment category
     * @param {string} description - Optional description
     * @param {number} confidence - AI confidence (0-1)
     */
    constructor(start, end, category, description = '', confidence = 1.0) {
      // Validate on construction
      SegmentValidator.validate({ start, end, category, description });

      this.start = start;
      this.end = end;
      this.category = category;
      this.description = description;
      this.confidence = confidence;
    }

    /**
     * Get segment duration in seconds
     * @returns {number}
     */
    getDuration() {
      return this.end - this.start;
    }

    /**
     * Get formatted duration (MM:SS)
     * @returns {string}
     */
    getFormattedDuration() {
      const duration = this.getDuration();
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Get formatted time range
     * @returns {string}
     */
    getTimeRange() {
      return `${this.formatTime(this.start)} - ${this.formatTime(this.end)}`;
    }

    /**
     * Format time as MM:SS
     * @param {number} seconds - Time in seconds
     * @returns {string}
     */
    formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Check if time is within this segment
     * @param {number} time - Current time in seconds
     * @param {number} buffer - Optional buffer in seconds
     * @returns {boolean}
     */
    contains(time, buffer = 0) {
      return time >= (this.start - buffer) && time < this.end;
    }

    /**
     * Check if this segment overlaps with another
     * @param {Segment} other - Other segment
     * @returns {boolean}
     */
    overlaps(other) {
      return this.start < other.end && this.end > other.start;
    }

    /**
     * Merge with another segment
     * @param {Segment} other - Segment to merge
     * @returns {Segment} - New merged segment
     */
    merge(other) {
      const start = Math.min(this.start, other.start);
      const end = Math.max(this.end, other.end);
      const category = this.category === other.category
        ? this.category
        : `${this.category} + ${other.category}`;
      const description = [this.description, other.description]
        .filter(d => d.length > 0)
        .join(' | ');
      const confidence = Math.min(this.confidence, other.confidence);

      return new Segment(start, end, category, description, confidence);
    }

    /**
     * Clone this segment
     * @returns {Segment}
     */
    clone() {
      return new Segment(
        this.start,
        this.end,
        this.category,
        this.description,
        this.confidence
      );
    }

    /**
     * Check if segment meets confidence threshold
     * @param {number} threshold - Minimum confidence
     * @returns {boolean}
     */
    meetsConfidenceThreshold(threshold) {
      return this.confidence >= threshold;
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toJSON() {
      return {
        start: this.start,
        end: this.end,
        category: this.category,
        description: this.description,
        confidence: this.confidence,
        duration: this.getDuration()
      };
    }

    /**
     * Create from plain object
     * @param {Object} data - Plain object data
     * @returns {Segment}
     */
    static fromJSON(data) {
      return new Segment(
        data.start,
        data.end,
        data.category,
        data.description || '',
        data.confidence || 1.0
      );
    }

    /**
     * Create from API response
     * @param {Object} data - API response data
     * @returns {Segment}
     */
    static fromAPI(data) {
      return new Segment(
        data.start,
        data.end,
        data.category,
        data.description || '',
        data.confidence || 1.0
      );
    }

    /**
     * Sort segments by start time
     * @param {Array<Segment>} segments - Segments to sort
     * @returns {Array<Segment>}
     */
    static sort(segments) {
      return segments.sort((a, b) => a.start - b.start);
    }

    /**
     * Merge overlapping segments
     * @param {Array<Segment>} segments - Segments to merge
     * @returns {Array<Segment>}
     */
    static mergeOverlapping(segments) {
      if (segments.length === 0) return [];

      const sorted = Segment.sort(segments);
      const merged = [sorted[0].clone()];

      for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const lastMerged = merged[merged.length - 1];

        if (current.overlaps(lastMerged)) {
          merged[merged.length - 1] = lastMerged.merge(current);
        } else {
          merged.push(current.clone());
        }
      }

      return merged;
    }

    /**
     * Filter by confidence threshold
     * @param {Array<Segment>} segments - Segments to filter
     * @param {number} threshold - Minimum confidence
     * @returns {Array<Segment>}
     */
    static filterByConfidence(segments, threshold) {
      return segments.filter(s => s.meetsConfidenceThreshold(threshold));
    }

    /**
     * Get total duration of segments
     * @param {Array<Segment>} segments - Segments
     * @returns {number} - Total duration in seconds
     */
    static getTotalDuration(segments) {
      return segments.reduce((total, segment) => total + segment.getDuration(), 0);
    }

    /**
     * Group segments by category
     * @param {Array<Segment>} segments - Segments to group
     * @returns {Object} - Segments grouped by category
     */
    static groupByCategory(segments) {
      return segments.reduce((groups, segment) => {
        const category = segment.category;
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(segment);
        return groups;
      }, {});
    }
  }

  // settings.js - Settings domain model


  /**
   * Settings - Represents user settings
   */
  class Settings {
    /**
     * @param {Object} settings - Settings object
     */
    constructor(settings = {}) {
      // Validate and sanitize
      const sanitized = SettingsValidator.sanitize(settings);

      this.skipSponsors = sanitized.skipSponsors;
      this.skipIntros = sanitized.skipIntros;
      this.skipOutros = sanitized.skipOutros;
      this.skipDonations = sanitized.skipDonations;
      this.skipSelfPromo = sanitized.skipSelfPromo;
      this.skipBuffer = sanitized.skipBuffer;
      this.enablePreview = sanitized.enablePreview;
      this.autoSkip = sanitized.autoSkip;
    }

    /**
     * Get enabled skip categories
     * @returns {Array<string>}
     */
    getEnabledCategories() {
      const categories = [];
      if (this.skipSponsors) categories.push('Sponsor');
      if (this.skipIntros) categories.push('Intro');
      if (this.skipOutros) categories.push('Outro');
      if (this.skipDonations) categories.push('Donations');
      if (this.skipSelfPromo) categories.push('Self-Promo');
      return categories;
    }

    /**
     * Check if category should be skipped
     * @param {string} category - Category name
     * @returns {boolean}
     */
    shouldSkipCategory(category) {
      const categoryLower = category.toLowerCase();

      if (categoryLower.includes('sponsor')) return this.skipSponsors;
      if (categoryLower.includes('intro')) return this.skipIntros;
      if (categoryLower.includes('outro')) return this.skipOutros;
      if (categoryLower.includes('donation') || categoryLower.includes('acknowledgment')) {
        return this.skipDonations;
      }
      if (categoryLower.includes('promo') || categoryLower.includes('merch')) {
        return this.skipSelfPromo;
      }

      return false;
    }

    /**
     * Get count of enabled categories
     * @returns {number}
     */
    getEnabledCount() {
      return this.getEnabledCategories().length;
    }

    /**
     * Check if any skip is enabled
     * @returns {boolean}
     */
    hasAnyEnabled() {
      return this.getEnabledCount() > 0;
    }

    /**
     * Check if all skips are enabled
     * @returns {boolean}
     */
    hasAllEnabled() {
      return this.skipSponsors &&
             this.skipIntros &&
             this.skipOutros &&
             this.skipDonations &&
             this.skipSelfPromo;
    }

    /**
     * Toggle category
     * @param {string} category - Category to toggle
     */
    toggleCategory(category) {
      switch (category) {
        case 'skipSponsors':
          this.skipSponsors = !this.skipSponsors;
          break;
        case 'skipIntros':
          this.skipIntros = !this.skipIntros;
          break;
        case 'skipOutros':
          this.skipOutros = !this.skipOutros;
          break;
        case 'skipDonations':
          this.skipDonations = !this.skipDonations;
          break;
        case 'skipSelfPromo':
          this.skipSelfPromo = !this.skipSelfPromo;
          break;
      }
    }

    /**
     * Enable all categories
     */
    enableAll() {
      this.skipSponsors = true;
      this.skipIntros = true;
      this.skipOutros = true;
      this.skipDonations = true;
      this.skipSelfPromo = true;
    }

    /**
     * Disable all categories
     */
    disableAll() {
      this.skipSponsors = false;
      this.skipIntros = false;
      this.skipOutros = false;
      this.skipDonations = false;
      this.skipSelfPromo = false;
    }

    /**
     * Get summary
     * @returns {string}
     */
    getSummary() {
      const enabled = this.getEnabledCategories();
      if (enabled.length === 0) return 'No categories enabled';
      if (this.hasAllEnabled()) return 'All categories enabled';
      return `${enabled.length} categories enabled: ${enabled.join(', ')}`;
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toJSON() {
      return {
        skipSponsors: this.skipSponsors,
        skipIntros: this.skipIntros,
        skipOutros: this.skipOutros,
        skipDonations: this.skipDonations,
        skipSelfPromo: this.skipSelfPromo,
        skipBuffer: this.skipBuffer,
        enablePreview: this.enablePreview,
        autoSkip: this.autoSkip
      };
    }

    /**
     * Create from plain object
     * @param {Object} data - Plain object data
     * @returns {Settings}
     */
    static fromJSON(data) {
      return new Settings(data);
    }

    /**
     * Create default settings
     * @returns {Settings}
     */
    static createDefault() {
      return new Settings(CONFIG.DEFAULTS.SETTINGS);
    }

    /**
     * Merge with partial settings
     * @param {Object} partial - Partial settings
     * @returns {Settings}
     */
    merge(partial) {
      return new Settings({
        ...this.toJSON(),
        ...partial
      });
    }

    /**
     * Clone settings
     * @returns {Settings}
     */
    clone() {
      return new Settings(this.toJSON());
    }
  }

  /**
   * AdvancedSettings - Advanced user settings
   */
  class AdvancedSettings {
    /**
     * @param {Object} settings - Advanced settings object
     */
    constructor(settings = {}) {
      // Validate and sanitize
      const sanitized = SettingsValidator.sanitizeAdvanced(settings);

      this.confidenceThreshold = sanitized.confidenceThreshold;
      this.aiModel = sanitized.aiModel;
      this.skipBuffer = sanitized.skipBuffer;
      this.channelWhitelist = sanitized.channelWhitelist;
    }

    /**
     * Check if channel is whitelisted
     * @param {string} channelId - Channel ID or handle
     * @returns {boolean}
     */
    isChannelWhitelisted(channelId) {
      if (this.channelWhitelist.length === 0) return false;
      return this.channelWhitelist.some(id => {
        return channelId === id || channelId.includes(id) || id.includes(channelId);
      });
    }

    /**
     * Add channel to whitelist
     * @param {string} channelId - Channel ID or handle
     */
    addToWhitelist(channelId) {
      if (!this.isChannelWhitelisted(channelId)) {
        this.channelWhitelist.push(channelId);
      }
    }

    /**
     * Remove channel from whitelist
     * @param {string} channelId - Channel ID or handle
     */
    removeFromWhitelist(channelId) {
      this.channelWhitelist = this.channelWhitelist.filter(id => id !== channelId);
    }

    /**
     * Clear whitelist
     */
    clearWhitelist() {
      this.channelWhitelist = [];
    }

    /**
     * Get whitelist count
     * @returns {number}
     */
    getWhitelistCount() {
      return this.channelWhitelist.length;
    }

    /**
     * Get AI model display name
     * @returns {string}
     */
    getModelDisplayName() {
      return this.aiModel === 'haiku' ? 'Claude Haiku (Fast)' : 'Claude Sonnet (Accurate)';
    }

    /**
     * Get confidence threshold as percentage
     * @returns {string}
     */
    getConfidencePercentage() {
      return `${Math.round(this.confidenceThreshold * 100)}%`;
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toJSON() {
      return {
        confidenceThreshold: this.confidenceThreshold,
        aiModel: this.aiModel,
        skipBuffer: this.skipBuffer,
        channelWhitelist: [...this.channelWhitelist]
      };
    }

    /**
     * Create from plain object
     * @param {Object} data - Plain object data
     * @returns {AdvancedSettings}
     */
    static fromJSON(data) {
      return new AdvancedSettings(data);
    }

    /**
     * Create default advanced settings
     * @returns {AdvancedSettings}
     */
    static createDefault() {
      return new AdvancedSettings(CONFIG.DEFAULTS.ADVANCED_SETTINGS);
    }

    /**
     * Merge with partial settings
     * @param {Object} partial - Partial settings
     * @returns {AdvancedSettings}
     */
    merge(partial) {
      return new AdvancedSettings({
        ...this.toJSON(),
        ...partial
      });
    }

    /**
     * Clone settings
     * @returns {AdvancedSettings}
     */
    clone() {
      return new AdvancedSettings(this.toJSON());
    }
  }

  // analysis-result.js - Analysis result domain model


  /**
   * AnalysisResult - Represents the result of AI video analysis
   */
  class AnalysisResult {
    /**
     * @param {string} videoId - Video ID
     * @param {Array<Segment>} segments - Detected segments
     * @param {Object} metadata - Analysis metadata
     */
    constructor(videoId, segments = [], metadata = {}) {
      this.videoId = videoId;
      this.segments = segments;
      this.metadata = {
        analyzedAt: new Date().toISOString(),
        model: metadata.model || 'unknown',
        processingTime: metadata.processingTime || 0,
        transcriptLength: metadata.transcriptLength || 0,
        ...metadata
      };
    }

    /**
     * Get segment count
     * @returns {number}
     */
    getSegmentCount() {
      return this.segments.length;
    }

    /**
     * Get total skip duration
     * @returns {number}
     */
    getTotalSkipDuration() {
      return Segment.getTotalDuration(this.segments);
    }

    /**
     * Get formatted skip duration
     * @returns {string}
     */
    getFormattedSkipDuration() {
      const duration = this.getTotalSkipDuration();
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Get segments by category
     * @returns {Object}
     */
    getSegmentsByCategory() {
      return Segment.groupByCategory(this.segments);
    }

    /**
     * Get category counts
     * @returns {Object}
     */
    getCategoryCounts() {
      const groups = this.getSegmentsByCategory();
      return Object.keys(groups).reduce((counts, category) => {
        counts[category] = groups[category].length;
        return counts;
      }, {});
    }

    /**
     * Check if analysis is empty
     * @returns {boolean}
     */
    isEmpty() {
      return this.segments.length === 0;
    }

    /**
     * Check if analysis has segments
     * @returns {boolean}
     */
    hasSegments() {
      return this.segments.length > 0;
    }

    /**
     * Filter segments by confidence
     * @param {number} threshold - Minimum confidence
     * @returns {AnalysisResult}
     */
    filterByConfidence(threshold) {
      const filtered = Segment.filterByConfidence(this.segments, threshold);
      return new AnalysisResult(this.videoId, filtered, this.metadata);
    }

    /**
     * Merge overlapping segments
     * @returns {AnalysisResult}
     */
    mergeOverlapping() {
      const merged = Segment.mergeOverlapping(this.segments);
      return new AnalysisResult(this.videoId, merged, this.metadata);
    }

    /**
     * Get segments for enabled categories
     * @param {Settings} settings - User settings
     * @returns {Array<Segment>}
     */
    getEnabledSegments(settings) {
      return this.segments.filter(segment => {
        return settings.shouldSkipCategory(segment.category);
      });
    }

    /**
     * Get analysis summary
     * @returns {Object}
     */
    getSummary() {
      const categoryCounts = this.getCategoryCounts();

      return {
        videoId: this.videoId,
        segmentCount: this.getSegmentCount(),
        totalDuration: this.getTotalSkipDuration(),
        formattedDuration: this.getFormattedSkipDuration(),
        categories: categoryCounts,
        analyzedAt: this.metadata.analyzedAt,
        model: this.metadata.model,
        processingTime: this.metadata.processingTime
      };
    }

    /**
     * Check if analysis is stale
     * @param {number} maxAgeMs - Maximum age in milliseconds
     * @returns {boolean}
     */
    isStale(maxAgeMs = 30 * 24 * 60 * 60 * 1000) { // 30 days default
      const analyzedAt = new Date(this.metadata.analyzedAt).getTime();
      const now = Date.now();
      return (now - analyzedAt) > maxAgeMs;
    }

    /**
     * Get age in days
     * @returns {number}
     */
    getAgeInDays() {
      const analyzedAt = new Date(this.metadata.analyzedAt).getTime();
      const now = Date.now();
      return Math.floor((now - analyzedAt) / (24 * 60 * 60 * 1000));
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toJSON() {
      return {
        videoId: this.videoId,
        segments: this.segments.map(s => s.toJSON()),
        metadata: this.metadata,
        summary: this.getSummary()
      };
    }

    /**
     * Create from plain object
     * @param {Object} data - Plain object data
     * @returns {AnalysisResult}
     */
    static fromJSON(data) {
      const segments = (data.segments || []).map(s => Segment.fromJSON(s));
      return new AnalysisResult(data.videoId, segments, data.metadata || {});
    }

    /**
     * Create from API response
     * @param {string} videoId - Video ID
     * @param {Object} apiResponse - API response
     * @param {Object} metadata - Additional metadata
     * @returns {AnalysisResult}
     */
    static fromAPI(videoId, apiResponse, metadata = {}) {
      const segments = (apiResponse.segments || []).map(s => Segment.fromAPI(s));
      return new AnalysisResult(videoId, segments, {
        ...metadata,
        rawResponse: apiResponse
      });
    }

    /**
     * Create empty result
     * @param {string} videoId - Video ID
     * @returns {AnalysisResult}
     */
    static createEmpty(videoId) {
      return new AnalysisResult(videoId, [], {
        empty: true,
        reason: 'No segments detected'
      });
    }

    /**
     * Merge multiple results
     * @param {Array<AnalysisResult>} results - Results to merge
     * @returns {AnalysisResult}
     */
    static merge(results) {
      if (results.length === 0) {
        throw new Error('Cannot merge empty results array');
      }

      const first = results[0];
      const allSegments = results.flatMap(r => r.segments);
      const merged = Segment.mergeOverlapping(allSegments);

      return new AnalysisResult(first.videoId, merged, {
        merged: true,
        sourceCount: results.length,
        models: results.map(r => r.metadata.model)
      });
    }
  }

  // cache-repository.js - Cache data access layer


  /**
   * CacheRepository - Manages analysis cache storage
   */
  class CacheRepository {
    constructor() {
      this.storagePrefix = 'analysis_';
      this.memoryCache = new Map();
      this.logger = logger.child('CacheRepository');
    }

    /**
     * Get cache key for video
     * @param {string} videoId - Video ID
     * @returns {string}
     */
    getCacheKey(videoId) {
      return `${this.storagePrefix}${videoId}`;
    }

    /**
     * Get from memory cache
     * @param {string} videoId - Video ID
     * @returns {AnalysisResult|null}
     */
    getFromMemory(videoId) {
      return this.memoryCache.get(videoId) || null;
    }

    /**
     * Set in memory cache
     * @param {string} videoId - Video ID
     * @param {AnalysisResult} result - Analysis result
     */
    setInMemory(videoId, result) {
      this.memoryCache.set(videoId, result);
      this.logger.debug(`Memory cache updated`, { videoId });
    }

    /**
     * Get from persistent storage
     * @param {string} videoId - Video ID
     * @returns {Promise<AnalysisResult|null>}
     */
    async getFromStorage(videoId) {
      try {
        const key = this.getCacheKey(videoId);
        const result = await chrome.storage.local.get(key);

        if (!result[key]) {
          return null;
        }

        this.logger.debug(`Cache hit`, { videoId });
        return AnalysisResult.fromJSON(result[key]);
      } catch (error) {
        this.logger.error(`Failed to get from storage`, { videoId, error: error.message });
        throw new StorageError('Failed to read from cache', error);
      }
    }

    /**
     * Set in persistent storage
     * @param {string} videoId - Video ID
     * @param {AnalysisResult} result - Analysis result
     * @returns {Promise<void>}
     */
    async setInStorage(videoId, result) {
      try {
        const key = this.getCacheKey(videoId);
        const data = result.toJSON();

        await chrome.storage.local.set({ [key]: data });
        this.logger.debug(`Storage cache updated`, { videoId });
      } catch (error) {
        this.logger.error(`Failed to set in storage`, { videoId, error: error.message });
        throw new StorageError('Failed to write to cache', error);
      }
    }

    /**
     * Get analysis result (memory first, then storage)
     * @param {string} videoId - Video ID
     * @returns {Promise<AnalysisResult|null>}
     */
    async get(videoId) {
      this.logger.debug(`Getting analysis`, { videoId });

      // Try memory cache first
      const memoryResult = this.getFromMemory(videoId);
      if (memoryResult) {
        this.logger.debug(`Memory cache hit`, { videoId });
        return memoryResult;
      }

      // Try persistent storage
      const storageResult = await this.getFromStorage(videoId);
      if (storageResult) {
        // Update memory cache
        this.setInMemory(videoId, storageResult);
        return storageResult;
      }

      this.logger.debug(`Cache miss`, { videoId });
      return null;
    }

    /**
     * Set analysis result (both memory and storage)
     * @param {string} videoId - Video ID
     * @param {AnalysisResult} result - Analysis result
     * @returns {Promise<void>}
     */
    async set(videoId, result) {
      this.logger.debug(`Setting analysis`, { videoId, segmentCount: result.getSegmentCount() });

      // Update both caches
      this.setInMemory(videoId, result);
      await this.setInStorage(videoId, result);

      this.logger.info(`Analysis cached`, { videoId, segments: result.getSegmentCount() });
    }

    /**
     * Delete analysis result
     * @param {string} videoId - Video ID
     * @returns {Promise<void>}
     */
    async delete(videoId) {
      try {
        // Remove from memory
        this.memoryCache.delete(videoId);

        // Remove from storage
        const key = this.getCacheKey(videoId);
        await chrome.storage.local.remove(key);

        this.logger.debug(`Cache deleted`, { videoId });
      } catch (error) {
        this.logger.error(`Failed to delete cache`, { videoId, error: error.message });
        throw new StorageError('Failed to delete from cache', error);
      }
    }

    /**
     * Check if cached result exists
     * @param {string} videoId - Video ID
     * @returns {Promise<boolean>}
     */
    async has(videoId) {
      // Check memory first
      if (this.memoryCache.has(videoId)) {
        return true;
      }

      // Check storage
      const result = await this.getFromStorage(videoId);
      return result !== null;
    }

    /**
     * Get all cached video IDs
     * @returns {Promise<Array<string>>}
     */
    async getAllVideoIds() {
      try {
        const allData = await chrome.storage.local.get(null);
        const videoIds = Object.keys(allData)
          .filter(key => key.startsWith(this.storagePrefix))
          .map(key => key.replace(this.storagePrefix, ''));

        return videoIds;
      } catch (error) {
        this.logger.error(`Failed to get all video IDs`, { error: error.message });
        throw new StorageError('Failed to read cache keys', error);
      }
    }

    /**
     * Get all cached results
     * @returns {Promise<Array<AnalysisResult>>}
     */
    async getAll() {
      try {
        const videoIds = await this.getAllVideoIds();
        const results = await Promise.all(
          videoIds.map(videoId => this.get(videoId))
        );

        return results.filter(r => r !== null);
      } catch (error) {
        this.logger.error(`Failed to get all results`, { error: error.message });
        throw new StorageError('Failed to read all cache entries', error);
      }
    }

    /**
     * Clean stale cache entries
     * @param {number} maxAgeMs - Maximum age in milliseconds
     * @returns {Promise<number>} - Number of deleted entries
     */
    async cleanStale(maxAgeMs = 30 * 24 * 60 * 60 * 1000) { // 30 days
      try {
        this.logger.info(`Cleaning stale cache entries`, { maxAgeMs });

        const results = await this.getAll();
        let deletedCount = 0;

        for (const result of results) {
          if (result.isStale(maxAgeMs)) {
            await this.delete(result.videoId);
            deletedCount++;
          }
        }

        this.logger.info(`Cleaned stale cache`, { deleted: deletedCount, total: results.length });
        return deletedCount;
      } catch (error) {
        this.logger.error(`Failed to clean stale cache`, { error: error.message });
        throw new CacheError('Failed to clean stale cache', error);
      }
    }

    /**
     * Clear all cache (memory + storage)
     * @returns {Promise<void>}
     */
    async clear() {
      try {
        this.logger.warn(`Clearing all cache`);

        // Clear memory
        this.memoryCache.clear();

        // Clear storage
        const videoIds = await this.getAllVideoIds();
        const keys = videoIds.map(id => this.getCacheKey(id));
        await chrome.storage.local.remove(keys);

        this.logger.info(`Cache cleared`, { count: videoIds.length });
      } catch (error) {
        this.logger.error(`Failed to clear cache`, { error: error.message });
        throw new CacheError('Failed to clear cache', error);
      }
    }

    /**
     * Get cache size
     * @returns {Promise<Object>} - Size information
     */
    async getSize() {
      try {
        const videoIds = await this.getAllVideoIds();
        const results = await this.getAll();

        return {
          memoryCount: this.memoryCache.size,
          storageCount: videoIds.length,
          totalSegments: results.reduce((sum, r) => sum + r.getSegmentCount(), 0)
        };
      } catch (error) {
        this.logger.error(`Failed to get cache size`, { error: error.message });
        throw new CacheError('Failed to get cache size', error);
      }
    }

    /**
     * Get cache statistics
     * @returns {Promise<Object>}
     */
    async getStatistics() {
      try {
        const results = await this.getAll();
        const size = await this.getSize();

        const stats = {
          totalEntries: results.length,
          memoryEntries: size.memoryCount,
          storageEntries: size.storageCount,
          totalSegments: size.totalSegments,
          averageSegments: results.length > 0 ? size.totalSegments / results.length : 0,
          oldestEntry: null,
          newestEntry: null,
          staleEntries: 0
        };

        if (results.length > 0) {
          const sorted = results.sort((a, b) => {
            return new Date(a.metadata.analyzedAt) - new Date(b.metadata.analyzedAt);
          });

          stats.oldestEntry = sorted[0].metadata.analyzedAt;
          stats.newestEntry = sorted[sorted.length - 1].metadata.analyzedAt;
          stats.staleEntries = results.filter(r => r.isStale()).length;
        }

        return stats;
      } catch (error) {
        this.logger.error(`Failed to get statistics`, { error: error.message });
        throw new CacheError('Failed to get cache statistics', error);
      }
    }

    /**
     * Invalidate cache for video
     * @param {string} videoId - Video ID
     * @returns {Promise<void>}
     */
    async invalidate(videoId) {
      this.logger.info(`Invalidating cache`, { videoId });
      await this.delete(videoId);
    }
  }

  // settings-repository.js - Settings data access layer


  /**
   * SettingsRepository - Manages user settings storage
   */
  class SettingsRepository {
    constructor() {
      this.storageKey = 'user_settings';
      this.advancedKey = 'advanced_settings';
      this.logger = logger.child('SettingsRepository');
    }

    /**
     * Get settings from storage
     * @returns {Promise<Settings>}
     */
    async getSettings() {
      try {
        const result = await chrome.storage.local.get(this.storageKey);

        if (!result[this.storageKey]) {
          this.logger.debug(`No settings found, using defaults`);
          return Settings.createDefault();
        }

        const settings = Settings.fromJSON(result[this.storageKey]);
        this.logger.debug(`Settings loaded`, { summary: settings.getSummary() });

        return settings;
      } catch (error) {
        this.logger.error(`Failed to get settings`, { error: error.message });
        throw new StorageError('Failed to read settings', error);
      }
    }

    /**
     * Save settings to storage
     * @param {Settings} settings - Settings to save
     * @returns {Promise<void>}
     */
    async saveSettings(settings) {
      try {
        const data = settings.toJSON();
        await chrome.storage.local.set({ [this.storageKey]: data });

        this.logger.info(`Settings saved`, { summary: settings.getSummary() });
      } catch (error) {
        this.logger.error(`Failed to save settings`, { error: error.message });
        throw new StorageError('Failed to save settings', error);
      }
    }

    /**
     * Update partial settings
     * @param {Object} partial - Partial settings
     * @returns {Promise<Settings>}
     */
    async updateSettings(partial) {
      const current = await this.getSettings();
      const updated = current.merge(partial);
      await this.saveSettings(updated);

      this.logger.debug(`Settings updated`, { fields: Object.keys(partial) });
      return updated;
    }

    /**
     * Reset settings to defaults
     * @returns {Promise<Settings>}
     */
    async resetSettings() {
      const defaults = Settings.createDefault();
      await this.saveSettings(defaults);

      this.logger.info(`Settings reset to defaults`);
      return defaults;
    }

    /**
     * Get advanced settings
     * @returns {Promise<AdvancedSettings>}
     */
    async getAdvancedSettings() {
      try {
        const result = await chrome.storage.local.get(this.advancedKey);

        if (!result[this.advancedKey]) {
          this.logger.debug(`No advanced settings found, using defaults`);
          return AdvancedSettings.createDefault();
        }

        const settings = AdvancedSettings.fromJSON(result[this.advancedKey]);
        this.logger.debug(`Advanced settings loaded`, {
          model: settings.aiModel,
          threshold: settings.confidenceThreshold,
          whitelistCount: settings.getWhitelistCount()
        });

        return settings;
      } catch (error) {
        this.logger.error(`Failed to get advanced settings`, { error: error.message });
        throw new StorageError('Failed to read advanced settings', error);
      }
    }

    /**
     * Save advanced settings
     * @param {AdvancedSettings} settings - Advanced settings to save
     * @returns {Promise<void>}
     */
    async saveAdvancedSettings(settings) {
      try {
        const data = settings.toJSON();
        await chrome.storage.local.set({ [this.advancedKey]: data });

        this.logger.info(`Advanced settings saved`, {
          model: settings.aiModel,
          threshold: settings.confidenceThreshold
        });
      } catch (error) {
        this.logger.error(`Failed to save advanced settings`, { error: error.message });
        throw new StorageError('Failed to save advanced settings', error);
      }
    }

    /**
     * Update partial advanced settings
     * @param {Object} partial - Partial advanced settings
     * @returns {Promise<AdvancedSettings>}
     */
    async updateAdvancedSettings(partial) {
      const current = await this.getAdvancedSettings();
      const updated = current.merge(partial);
      await this.saveAdvancedSettings(updated);

      this.logger.debug(`Advanced settings updated`, { fields: Object.keys(partial) });
      return updated;
    }

    /**
     * Reset advanced settings to defaults
     * @returns {Promise<AdvancedSettings>}
     */
    async resetAdvancedSettings() {
      const defaults = AdvancedSettings.createDefault();
      await this.saveAdvancedSettings(defaults);

      this.logger.info(`Advanced settings reset to defaults`);
      return defaults;
    }

    /**
     * Get all settings (regular + advanced)
     * @returns {Promise<Object>}
     */
    async getAllSettings() {
      const [settings, advancedSettings] = await Promise.all([
        this.getSettings(),
        this.getAdvancedSettings()
      ]);

      return {
        settings,
        advancedSettings
      };
    }

    /**
     * Export settings to JSON
     * @returns {Promise<string>}
     */
    async exportSettings() {
      try {
        const all = await this.getAllSettings();
        const exportData = {
          version: CONFIG.VERSION,
          exportedAt: new Date().toISOString(),
          settings: all.settings.toJSON(),
          advancedSettings: all.advancedSettings.toJSON()
        };

        return JSON.stringify(exportData, null, 2);
      } catch (error) {
        this.logger.error(`Failed to export settings`, { error: error.message });
        throw new StorageError('Failed to export settings', error);
      }
    }

    /**
     * Import settings from JSON
     * @param {string} json - JSON string
     * @returns {Promise<void>}
     */
    async importSettings(json) {
      try {
        const data = JSON.parse(json);

        if (!data.settings || !data.advancedSettings) {
          throw new Error('Invalid import data format');
        }

        const settings = Settings.fromJSON(data.settings);
        const advancedSettings = AdvancedSettings.fromJSON(data.advancedSettings);

        await this.saveSettings(settings);
        await this.saveAdvancedSettings(advancedSettings);

        this.logger.info(`Settings imported`, { version: data.version });
      } catch (error) {
        this.logger.error(`Failed to import settings`, { error: error.message });
        throw new StorageError('Failed to import settings', error);
      }
    }

    /**
     * Add channel to whitelist
     * @param {string} channelId - Channel ID or handle
     * @returns {Promise<void>}
     */
    async addToWhitelist(channelId) {
      const settings = await this.getAdvancedSettings();
      settings.addToWhitelist(channelId);
      await this.saveAdvancedSettings(settings);

      this.logger.info(`Channel added to whitelist`, { channelId });
    }

    /**
     * Remove channel from whitelist
     * @param {string} channelId - Channel ID or handle
     * @returns {Promise<void>}
     */
    async removeFromWhitelist(channelId) {
      const settings = await this.getAdvancedSettings();
      settings.removeFromWhitelist(channelId);
      await this.saveAdvancedSettings(settings);

      this.logger.info(`Channel removed from whitelist`, { channelId });
    }

    /**
     * Check if channel is whitelisted
     * @param {string} channelId - Channel ID or handle
     * @returns {Promise<boolean>}
     */
    async isChannelWhitelisted(channelId) {
      const settings = await this.getAdvancedSettings();
      return settings.isChannelWhitelisted(channelId);
    }

    /**
     * Listen for settings changes
     * @param {Function} callback - Callback function
     */
    onSettingsChange(callback) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;

        if (changes[this.storageKey] || changes[this.advancedKey]) {
          this.logger.debug(`Settings changed externally`);
          callback();
        }
      });
    }
  }

  // stats-repository.js - Statistics data access layer


  /**
   * StatsRepository - Manages usage statistics storage
   */
  class StatsRepository {
    constructor() {
      this.storageKey = 'user_stats';
      this.logger = logger.child('StatsRepository');
    }

    /**
     * Get default stats structure
     * @returns {Object}
     */
    getDefaultStats() {
      return {
        totalSkips: 0,
        totalTimeSaved: 0,
        videosAnalyzed: 0,
        categoryStats: {
          'Sponsor': 0,
          'Intro': 0,
          'Outro': 0,
          'Donations': 0,
          'Self-Promo': 0
        },
        lastUpdated: new Date().toISOString(),
        firstUse: new Date().toISOString()
      };
    }

    /**
     * Get statistics from storage
     * @returns {Promise<Object>}
     */
    async getStats() {
      try {
        const result = await chrome.storage.local.get(this.storageKey);

        if (!result[this.storageKey]) {
          this.logger.debug(`No stats found, creating defaults`);
          const defaults = this.getDefaultStats();
          await this.saveStats(defaults);
          return defaults;
        }

        return result[this.storageKey];
      } catch (error) {
        this.logger.error(`Failed to get stats`, { error: error.message });
        throw new StorageError('Failed to read statistics', error);
      }
    }

    /**
     * Save statistics to storage
     * @param {Object} stats - Statistics to save
     * @returns {Promise<void>}
     */
    async saveStats(stats) {
      try {
        stats.lastUpdated = new Date().toISOString();
        await chrome.storage.local.set({ [this.storageKey]: stats });

        this.logger.debug(`Stats saved`, { totalSkips: stats.totalSkips });
      } catch (error) {
        this.logger.error(`Failed to save stats`, { error: error.message });
        throw new StorageError('Failed to save statistics', error);
      }
    }

    /**
     * Increment skip count for category
     * @param {string} category - Category name
     * @param {number} duration - Skip duration in seconds
     * @returns {Promise<void>}
     */
    async incrementSkip(category, duration = 0) {
      try {
        const stats = await this.getStats();

        stats.totalSkips++;
        stats.totalTimeSaved += duration;

        if (stats.categoryStats[category] !== undefined) {
          stats.categoryStats[category]++;
        } else {
          stats.categoryStats[category] = 1;
        }

        await this.saveStats(stats);

        this.logger.debug(`Skip recorded`, { category, duration });
      } catch (error) {
        this.logger.error(`Failed to increment skip`, { error: error.message });
        throw new StorageError('Failed to update statistics', error);
      }
    }

    /**
     * Increment videos analyzed count
     * @returns {Promise<void>}
     */
    async incrementVideosAnalyzed() {
      try {
        const stats = await this.getStats();
        stats.videosAnalyzed++;
        await this.saveStats(stats);

        this.logger.debug(`Videos analyzed incremented`, { total: stats.videosAnalyzed });
      } catch (error) {
        this.logger.error(`Failed to increment videos analyzed`, { error: error.message });
        throw new StorageError('Failed to update statistics', error);
      }
    }

    /**
     * Get formatted time saved
     * @param {number} seconds - Seconds saved
     * @returns {string}
     */
    formatTimeSaved(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    }

    /**
     * Get statistics summary
     * @returns {Promise<Object>}
     */
    async getSummary() {
      try {
        const stats = await this.getStats();

        // Calculate top category
        let topCategory = null;
        let maxCount = 0;
        Object.entries(stats.categoryStats).forEach(([category, count]) => {
          if (count > maxCount) {
            maxCount = count;
            topCategory = category;
          }
        });

        // Calculate days since first use
        const firstUse = new Date(stats.firstUse);
        const now = new Date();
        const daysSinceFirstUse = Math.floor((now - firstUse) / (1000 * 60 * 60 * 24));

        // Average skips per day
        const averageSkipsPerDay = daysSinceFirstUse > 0
          ? (stats.totalSkips / daysSinceFirstUse).toFixed(1)
          : stats.totalSkips;

        return {
          totalSkips: stats.totalSkips,
          totalTimeSaved: stats.totalTimeSaved,
          formattedTimeSaved: this.formatTimeSaved(stats.totalTimeSaved),
          videosAnalyzed: stats.videosAnalyzed,
          topCategory,
          topCategoryCount: maxCount,
          categoryStats: stats.categoryStats,
          daysSinceFirstUse,
          averageSkipsPerDay,
          lastUpdated: stats.lastUpdated,
          firstUse: stats.firstUse
        };
      } catch (error) {
        this.logger.error(`Failed to get summary`, { error: error.message });
        throw new StorageError('Failed to get statistics summary', error);
      }
    }

    /**
     * Get category statistics
     * @returns {Promise<Array>}
     */
    async getCategoryStats() {
      try {
        const stats = await this.getStats();

        return Object.entries(stats.categoryStats)
          .map(([category, count]) => ({
            category,
            count,
            percentage: stats.totalSkips > 0
              ? Math.round((count / stats.totalSkips) * 100)
              : 0
          }))
          .sort((a, b) => b.count - a.count);
      } catch (error) {
        this.logger.error(`Failed to get category stats`, { error: error.message });
        throw new StorageError('Failed to get category statistics', error);
      }
    }

    /**
     * Reset statistics
     * @returns {Promise<void>}
     */
    async resetStats() {
      try {
        const defaults = this.getDefaultStats();
        await this.saveStats(defaults);

        this.logger.info(`Stats reset`);
      } catch (error) {
        this.logger.error(`Failed to reset stats`, { error: error.message });
        throw new StorageError('Failed to reset statistics', error);
      }
    }

    /**
     * Export statistics to JSON
     * @returns {Promise<string>}
     */
    async exportStats() {
      try {
        const stats = await this.getStats();
        const summary = await this.getSummary();

        const exportData = {
          stats,
          summary,
          exportedAt: new Date().toISOString()
        };

        return JSON.stringify(exportData, null, 2);
      } catch (error) {
        this.logger.error(`Failed to export stats`, { error: error.message });
        throw new StorageError('Failed to export statistics', error);
      }
    }

    /**
     * Get time saved percentage (compared to total watch time)
     * @param {number} totalWatchTimeSeconds - Total time spent watching
     * @returns {Promise<number>}
     */
    async getTimeSavedPercentage(totalWatchTimeSeconds) {
      try {
        const stats = await this.getStats();

        if (totalWatchTimeSeconds === 0) return 0;

        return Math.round((stats.totalTimeSaved / totalWatchTimeSeconds) * 100);
      } catch (error) {
        this.logger.error(`Failed to calculate time saved percentage`, { error: error.message });
        return 0;
      }
    }

    /**
     * Get most skipped category
     * @returns {Promise<Object|null>}
     */
    async getMostSkippedCategory() {
      try {
        const categoryStats = await this.getCategoryStats();

        if (categoryStats.length === 0) return null;

        return categoryStats[0]; // Already sorted by count
      } catch (error) {
        this.logger.error(`Failed to get most skipped category`, { error: error.message });
        return null;
      }
    }

    /**
     * Record bulk skips (for migration or batch operations)
     * @param {Array} skips - Array of skip records
     * @returns {Promise<void>}
     */
    async recordBulkSkips(skips) {
      try {
        const stats = await this.getStats();

        skips.forEach(skip => {
          stats.totalSkips++;
          stats.totalTimeSaved += skip.duration || 0;

          if (stats.categoryStats[skip.category] !== undefined) {
            stats.categoryStats[skip.category]++;
          } else {
            stats.categoryStats[skip.category] = 1;
          }
        });

        await this.saveStats(stats);

        this.logger.info(`Bulk skips recorded`, { count: skips.length });
      } catch (error) {
        this.logger.error(`Failed to record bulk skips`, { error: error.message });
        throw new StorageError('Failed to record bulk skips', error);
      }
    }
  }

  // storage-service.js - Storage orchestration service


  /**
   * StorageService - Orchestrates all storage operations
   */
  class StorageService {
    constructor() {
      this.cacheRepo = new CacheRepository();
      this.settingsRepo = new SettingsRepository();
      this.statsRepo = new StatsRepository();
      this.logger = logger.child('StorageService');
    }

    // ==================== Cache Operations ====================

    /**
     * Get cached analysis
     * @param {string} videoId - Video ID
     * @returns {Promise<AnalysisResult|null>}
     */
    async getCachedAnalysis(videoId) {
      return await this.cacheRepo.get(videoId);
    }

    /**
     * Cache analysis result
     * @param {string} videoId - Video ID
     * @param {AnalysisResult} result - Analysis result
     * @returns {Promise<void>}
     */
    async cacheAnalysis(videoId, result) {
      await this.cacheRepo.set(videoId, result);
    }

    /**
     * Invalidate cached analysis
     * @param {string} videoId - Video ID
     * @returns {Promise<void>}
     */
    async invalidateCache(videoId) {
      await this.cacheRepo.invalidate(videoId);
    }

    /**
     * Clean stale cache entries
     * @param {number} maxAgeMs - Maximum age
     * @returns {Promise<number>}
     */
    async cleanStaleCache(maxAgeMs) {
      return await this.cacheRepo.cleanStale(maxAgeMs);
    }

    /**
     * Get cache statistics
     * @returns {Promise<Object>}
     */
    async getCacheStatistics() {
      return await this.cacheRepo.getStatistics();
    }

    /**
     * Clear all cache
     * @returns {Promise<void>}
     */
    async clearCache() {
      await this.cacheRepo.clear();
    }

    // ==================== Settings Operations ====================

    /**
     * Get user settings
     * @returns {Promise<Settings>}
     */
    async getSettings() {
      return await this.settingsRepo.getSettings();
    }

    /**
     * Save user settings
     * @param {Settings} settings - Settings to save
     * @returns {Promise<void>}
     */
    async saveSettings(settings) {
      await this.settingsRepo.saveSettings(settings);
    }

    /**
     * Update partial settings
     * @param {Object} partial - Partial settings
     * @returns {Promise<Settings>}
     */
    async updateSettings(partial) {
      return await this.settingsRepo.updateSettings(partial);
    }

    /**
     * Get advanced settings
     * @returns {Promise<AdvancedSettings>}
     */
    async getAdvancedSettings() {
      return await this.settingsRepo.getAdvancedSettings();
    }

    /**
     * Save advanced settings
     * @param {AdvancedSettings} settings - Advanced settings
     * @returns {Promise<void>}
     */
    async saveAdvancedSettings(settings) {
      await this.settingsRepo.saveAdvancedSettings(settings);
    }

    /**
     * Get all settings
     * @returns {Promise<Object>}
     */
    async getAllSettings() {
      return await this.settingsRepo.getAllSettings();
    }

    /**
     * Check if channel is whitelisted
     * @param {string} channelId - Channel ID
     * @returns {Promise<boolean>}
     */
    async isChannelWhitelisted(channelId) {
      return await this.settingsRepo.isChannelWhitelisted(channelId);
    }

    /**
     * Add channel to whitelist
     * @param {string} channelId - Channel ID
     * @returns {Promise<void>}
     */
    async addToWhitelist(channelId) {
      await this.settingsRepo.addToWhitelist(channelId);
    }

    /**
     * Remove channel from whitelist
     * @param {string} channelId - Channel ID
     * @returns {Promise<void>}
     */
    async removeFromWhitelist(channelId) {
      await this.settingsRepo.removeFromWhitelist(channelId);
    }

    /**
     * Export settings
     * @returns {Promise<string>}
     */
    async exportSettings() {
      return await this.settingsRepo.exportSettings();
    }

    /**
     * Import settings
     * @param {string} json - JSON string
     * @returns {Promise<void>}
     */
    async importSettings(json) {
      await this.settingsRepo.importSettings(json);
    }

    // ==================== Statistics Operations ====================

    /**
     * Get user statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
      return await this.statsRepo.getStats();
    }

    /**
     * Get statistics summary
     * @returns {Promise<Object>}
     */
    async getStatsSummary() {
      return await this.statsRepo.getSummary();
    }

    /**
     * Record skip
     * @param {string} category - Category
     * @param {number} duration - Duration in seconds
     * @returns {Promise<void>}
     */
    async recordSkip(category, duration) {
      await this.statsRepo.incrementSkip(category, duration);
    }

    /**
     * Record video analysis
     * @returns {Promise<void>}
     */
    async recordVideoAnalysis() {
      await this.statsRepo.incrementVideosAnalyzed();
    }

    /**
     * Get category statistics
     * @returns {Promise<Array>}
     */
    async getCategoryStats() {
      return await this.statsRepo.getCategoryStats();
    }

    /**
     * Reset statistics
     * @returns {Promise<void>}
     */
    async resetStats() {
      await this.statsRepo.resetStats();
    }

    /**
     * Export statistics
     * @returns {Promise<string>}
     */
    async exportStats() {
      return await this.statsRepo.exportStats();
    }

    // ==================== Combined Operations ====================

    /**
     * Get storage usage
     * @returns {Promise<Object>}
     */
    async getStorageUsage() {
      try {
        const bytesInUse = await chrome.storage.local.getBytesInUse();
        const quota = chrome.storage.local.QUOTA_BYTES;

        return {
          used: bytesInUse,
          total: quota,
          available: quota - bytesInUse,
          percentage: Math.round((bytesInUse / quota) * 100)
        };
      } catch (error) {
        this.logger.error(`Failed to get storage usage`, { error: error.message });
        throw new StorageError('Failed to get storage usage', error);
      }
    }

    /**
     * Check storage quota
     * @returns {Promise<boolean>}
     */
    async checkStorageQuota() {
      const usage = await this.getStorageUsage();

      if (usage.percentage > 90) {
        this.logger.warn(`Storage quota high`, {
          percentage: usage.percentage,
          used: usage.used,
          available: usage.available
        });

        return false;
      }

      return true;
    }

    /**
     * Optimize storage (clean old data)
     * @returns {Promise<Object>}
     */
    async optimizeStorage() {
      this.logger.info(`Optimizing storage`);

      const results = {
        cacheEntriesRemoved: 0,
        bytesFreed: 0
      };

      try {
        // Get usage before
        const usageBefore = await this.getStorageUsage();

        // Clean stale cache (30 days)
        results.cacheEntriesRemoved = await this.cleanStaleCache(30 * 24 * 60 * 60 * 1000);

        // Get usage after
        const usageAfter = await this.getStorageUsage();
        results.bytesFreed = usageBefore.used - usageAfter.used;

        this.logger.info(`Storage optimized`, results);

        return results;
      } catch (error) {
        this.logger.error(`Storage optimization failed`, { error: error.message });
        throw new StorageError('Failed to optimize storage', error);
      }
    }

    /**
     * Export all data
     * @returns {Promise<string>}
     */
    async exportAllData() {
      try {
        this.logger.info(`Exporting all data`);

        const [settings, stats, cacheStats] = await Promise.all([
          this.exportSettings(),
          this.exportStats(),
          this.getCacheStatistics()
        ]);

        const exportData = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          settings: JSON.parse(settings),
          stats: JSON.parse(stats),
          cache: cacheStats
        };

        return JSON.stringify(exportData, null, 2);
      } catch (error) {
        this.logger.error(`Export failed`, { error: error.message });
        throw new StorageError('Failed to export data', error);
      }
    }

    /**
     * Clear all data
     * @returns {Promise<void>}
     */
    async clearAllData() {
      this.logger.warn(`Clearing all data`);

      try {
        await Promise.all([
          this.clearCache(),
          this.settingsRepo.resetSettings(),
          this.settingsRepo.resetAdvancedSettings(),
          this.resetStats()
        ]);

        this.logger.info(`All data cleared`);
      } catch (error) {
        this.logger.error(`Failed to clear all data`, { error: error.message });
        throw new StorageError('Failed to clear all data', error);
      }
    }

    /**
     * Get storage summary
     * @returns {Promise<Object>}
     */
    async getStorageSummary() {
      try {
        const [usage, cacheStats, stats, settings] = await Promise.all([
          this.getStorageUsage(),
          this.getCacheStatistics(),
          this.getStatsSummary(),
          this.getAllSettings()
        ]);

        return {
          storage: usage,
          cache: cacheStats,
          statistics: stats,
          settings: {
            enabledCategories: settings.settings.getEnabledCategories(),
            model: settings.advancedSettings.aiModel,
            whitelistCount: settings.advancedSettings.getWhitelistCount()
          }
        };
      } catch (error) {
        this.logger.error(`Failed to get storage summary`, { error: error.message });
        throw new StorageError('Failed to get storage summary', error);
      }
    }

    /**
     * Listen for storage changes
     * @param {Function} callback - Callback function
     */
    onStorageChange(callback) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
          this.logger.debug(`Storage changed`, { keys: Object.keys(changes) });
          callback(changes);
        }
      });
    }
  }

  // analytics-service.js - Analytics and monitoring service


  /**
   * AnalyticsService - Handles analytics and monitoring
   */
  class AnalyticsService {
    constructor() {
      this.statsRepo = new StatsRepository();
      this.logger = logger.child('AnalyticsService');
      this.sessionData = {
        sessionStart: Date.now(),
        videosWatched: 0,
        segmentsSkipped: 0,
        totalTimeSaved: 0
      };
    }

    /**
     * Track video view
     * @param {string} videoId - Video ID
     * @param {string} channelId - Channel ID
     */
    async trackVideoView(videoId, channelId) {
      this.sessionData.videosWatched++;

      this.logger.debug(`Video view tracked`, {
        videoId,
        channelId,
        sessionVideos: this.sessionData.videosWatched
      });
    }

    /**
     * Track segment skip
     * @param {Segment} segment - Skipped segment
     * @param {string} videoId - Video ID
     */
    async trackSegmentSkip(segment, videoId) {
      try {
        const duration = segment.getDuration();

        // Update session data
        this.sessionData.segmentsSkipped++;
        this.sessionData.totalTimeSaved += duration;

        // Update persistent stats
        await this.statsRepo.incrementSkip(segment.category, duration);

        this.logger.info(`Segment skip tracked`, {
          videoId,
          category: segment.category,
          duration,
          sessionTotal: this.sessionData.segmentsSkipped
        });
      } catch (error) {
        this.logger.error(`Failed to track skip`, { error: error.message });
      }
    }

    /**
     * Track analysis completion
     * @param {string} videoId - Video ID
     * @param {AnalysisResult} result - Analysis result
     * @param {number} processingTime - Processing time in ms
     */
    async trackAnalysis(videoId, result, processingTime) {
      try {
        await this.statsRepo.incrementVideosAnalyzed();

        this.logger.info(`Analysis tracked`, {
          videoId,
          segmentCount: result.getSegmentCount(),
          totalDuration: result.getTotalSkipDuration(),
          processingTime
        });
      } catch (error) {
        this.logger.error(`Failed to track analysis`, { error: error.message });
      }
    }

    /**
     * Track error
     * @param {Error} error - Error object
     * @param {string} context - Error context
     * @param {Object} metadata - Additional metadata
     */
    trackError(error, context, metadata = {}) {
      this.logger.error(`Error tracked`, {
        context,
        error: error.message,
        name: error.name,
        code: error.code,
        ...metadata
      });
    }

    /**
     * Track performance metric
     * @param {string} metricName - Metric name
     * @param {number} value - Metric value
     * @param {string} unit - Unit (ms, bytes, etc)
     */
    trackPerformance(metricName, value, unit = 'ms') {
      this.logger.debug(`Performance metric`, {
        metric: metricName,
        value,
        unit
      });
    }

    /**
     * Get session summary
     * @returns {Object}
     */
    getSessionSummary() {
      const sessionDuration = Date.now() - this.sessionData.sessionStart;
      const sessionMinutes = Math.floor(sessionDuration / 60000);

      return {
        sessionStart: new Date(this.sessionData.sessionStart).toISOString(),
        sessionDuration: sessionMinutes,
        videosWatched: this.sessionData.videosWatched,
        segmentsSkipped: this.sessionData.segmentsSkipped,
        totalTimeSaved: this.sessionData.totalTimeSaved,
        formattedTimeSaved: this.formatDuration(this.sessionData.totalTimeSaved)
      };
    }

    /**
     * Get lifetime statistics
     * @returns {Promise<Object>}
     */
    async getLifetimeStats() {
      try {
        const summary = await this.statsRepo.getSummary();
        const categoryStats = await this.statsRepo.getCategoryStats();

        return {
          ...summary,
          categoryBreakdown: categoryStats,
          session: this.getSessionSummary()
        };
      } catch (error) {
        this.logger.error(`Failed to get lifetime stats`, { error: error.message });
        return null;
      }
    }

    /**
     * Get insights from statistics
     * @returns {Promise<Object>}
     */
    async getInsights() {
      try {
        const stats = await this.getLifetimeStats();

        if (!stats) {
          return null;
        }

        const insights = {
          mostSkippedCategory: stats.topCategory,
          averageSkipsPerDay: parseFloat(stats.averageSkipsPerDay),
          totalTimeSavedHours: Math.round(stats.totalTimeSaved / 3600),
          efficiency: this.calculateEfficiency(stats),
          usage: this.analyzeUsagePattern(stats)
        };

        return insights;
      } catch (error) {
        this.logger.error(`Failed to get insights`, { error: error.message });
        return null;
      }
    }

    /**
     * Calculate efficiency score
     * @param {Object} stats - Statistics
     * @returns {number}
     */
    calculateEfficiency(stats) {
      // Efficiency = (time saved / videos analyzed) * 100
      if (stats.videosAnalyzed === 0) return 0;

      const avgTimeSavedPerVideo = stats.totalTimeSaved / stats.videosAnalyzed;
      return Math.round(avgTimeSavedPerVideo);
    }

    /**
     * Analyze usage pattern
     * @param {Object} stats - Statistics
     * @returns {string}
     */
    analyzeUsagePattern(stats) {
      const skipsPerDay = parseFloat(stats.averageSkipsPerDay);

      if (skipsPerDay > 50) return 'power user';
      if (skipsPerDay > 20) return 'regular user';
      if (skipsPerDay > 5) return 'casual user';
      return 'light user';
    }

    /**
     * Track cache performance
     * @param {string} videoId - Video ID
     * @param {boolean} cacheHit - Whether cache hit occurred
     * @param {number} loadTime - Load time in ms
     */
    trackCachePerformance(videoId, cacheHit, loadTime) {
      this.logger.debug(`Cache performance`, {
        videoId,
        cacheHit,
        loadTime
      });

      this.trackPerformance(
        cacheHit ? 'cache_hit_time' : 'cache_miss_time',
        loadTime,
        'ms'
      );
    }

    /**
     * Track API performance
     * @param {string} endpoint - API endpoint
     * @param {number} responseTime - Response time in ms
     * @param {boolean} success - Whether request succeeded
     */
    trackAPIPerformance(endpoint, responseTime, success) {
      this.logger.debug(`API performance`, {
        endpoint,
        responseTime,
        success
      });

      this.trackPerformance(
        success ? 'api_success_time' : 'api_error_time',
        responseTime,
        'ms'
      );
    }

    /**
     * Format duration
     * @param {number} seconds - Duration in seconds
     * @returns {string}
     */
    formatDuration(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);

      if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    }

    /**
     * Generate report
     * @returns {Promise<string>}
     */
    async generateReport() {
      try {
        const stats = await this.getLifetimeStats();
        const insights = await this.getInsights();

        const report = {
          generatedAt: new Date().toISOString(),
          lifetime: stats,
          insights,
          session: this.getSessionSummary()
        };

        return JSON.stringify(report, null, 2);
      } catch (error) {
        this.logger.error(`Failed to generate report`, { error: error.message });
        throw error;
      }
    }

    /**
     * Reset session data
     */
    resetSession() {
      this.sessionData = {
        sessionStart: Date.now(),
        videosWatched: 0,
        segmentsSkipped: 0,
        totalTimeSaved: 0
      };

      this.logger.info(`Session reset`);
    }
  }

  // popup-main.js - Refactored popup script using new infrastructure


  /**
   * PopupManager - Manages popup UI and interactions
   */
  class PopupManager {
    constructor() {
      this.currentVideoId = null;
      this.isLoadingSettings = true;

      // Services
      this.logger = logger.child('PopupManager');
      this.storageService = new StorageService();
      this.analyticsService = new AnalyticsService();

      this.init();
    }

    /**
     * Initialize popup
     */
    async init() {
      try {
        this.logger.info('Initializing popup');

        // Load all data
        await Promise.all([
          this.loadSettings(),
          this.loadStats(),
          this.loadCacheInfo(),
          this.loadCurrentVideoInfo(),
          this.loadDarkMode()
        ]);

        // Setup event listeners
        this.setupEventListeners();

        // Unlock saves after loading
        setTimeout(() => {
          this.isLoadingSettings = false;
          this.logger.debug('Loading completed - events enabled');
        }, 100);

        this.logger.info('Popup initialized successfully');
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
        const { settings, advancedSettings } = allSettings;

        // Update UI - Basic settings
        document.getElementById('skip-sponsors').checked = settings.skipSponsors;
        document.getElementById('skip-intros').checked = settings.skipIntros;
        document.getElementById('skip-outros').checked = settings.skipOutros;
        document.getElementById('skip-donations').checked = settings.skipDonations;
        document.getElementById('skip-selfpromo').checked = settings.skipSelfPromo;
        document.getElementById('master-toggle').checked = settings.autoSkip;

        this.updateStatus(settings.autoSkip);

        // Update UI - Advanced settings
        this.loadAdvancedSettingsUI(advancedSettings);

        this.logger.debug('Settings loaded', {
          autoSkip: settings.autoSkip,
          enabled: settings.getEnabledCategories()
        });
      } catch (error) {
        this.logger.error('Failed to load settings', { error: error.message });
      }
    }

    /**
     * Load advanced settings UI
     * @param {AdvancedSettings} advancedSettings - Advanced settings
     */
    loadAdvancedSettingsUI(advancedSettings) {
      // Confidence threshold
      const confidenceSlider = document.getElementById('confidence-slider');
      const confidenceValue = document.getElementById('confidence-value');
      confidenceSlider.value = advancedSettings.confidenceThreshold * 100;
      confidenceValue.textContent = advancedSettings.confidenceThreshold.toFixed(2);

      // AI Model
      const aiModelSelect = document.getElementById('ai-model');
      aiModelSelect.value = advancedSettings.aiModel;

      // Skip buffer
      const bufferSlider = document.getElementById('buffer-slider');
      const bufferValue = document.getElementById('buffer-value');
      bufferSlider.value = advancedSettings.skipBuffer * 10;
      bufferValue.textContent = advancedSettings.skipBuffer.toFixed(1) + 's';

      // Whitelist count
      const whitelistCount = advancedSettings.getWhitelistCount();
      document.getElementById('whitelist-count').textContent =
        whitelistCount === 0 ? '0 excluded channels' :
        whitelistCount === 1 ? '1 excluded channel' :
        `${whitelistCount} excluded channels`;

      this.logger.debug('Advanced settings UI updated', {
        model: advancedSettings.aiModel,
        threshold: advancedSettings.confidenceThreshold
      });
    }

    /**
     * Load statistics
     */
    async loadStats() {
      try {
        const summary = await this.analyticsService.getLifetimeStats();

        if (summary) {
          document.getElementById('time-saved').textContent = summary.formattedTimeSaved;
          document.getElementById('segments-skipped').textContent = summary.totalSkips;

          this.logger.debug('Stats loaded', {
            totalSkips: summary.totalSkips,
            timeSaved: summary.formattedTimeSaved
          });
        }
      } catch (error) {
        this.logger.error('Failed to load stats', { error: error.message });
      }
    }

    /**
     * Load cache info
     */
    async loadCacheInfo() {
      try {
        const stats = await this.storageService.getCacheStatistics();

        document.getElementById('cache-size').textContent = stats.totalEntries;
        document.getElementById('videos-analyzed').textContent = stats.totalEntries;

        this.logger.debug('Cache info loaded', {
          entries: stats.totalEntries,
          segments: stats.totalSegments
        });
      } catch (error) {
        this.logger.error('Failed to load cache info', { error: error.message });
      }
    }

    /**
     * Load current video info
     */
    async loadCurrentVideoInfo() {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];

        if (!tab || !tab.url || !tab.url.includes('youtube.com/watch')) {
          return;
        }

        const url = new URL(tab.url);
        this.currentVideoId = url.searchParams.get('v');

        if (this.currentVideoId) {
          const result = await this.storageService.getCachedAnalysis(this.currentVideoId);

          if (result && result.segments.length > 0) {
            document.getElementById('current-video-section').style.display = 'block';
            document.getElementById('current-video-title').textContent =
              tab.title.replace(' - YouTube', '');

            const categories = result.segments.map(s => s.category).join(', ');
            document.getElementById('current-video-segments').textContent =
              `${result.segments.length} segments detected: ${categories}`;

            this.logger.debug('Current video info loaded', {
              videoId: this.currentVideoId,
              segments: result.segments.length
            });
          }
        }
      } catch (error) {
        this.logger.error('Failed to load current video info', { error: error.message });
      }
    }

    /**
     * Load dark mode preference
     */
    async loadDarkMode() {
      try {
        const data = await chrome.storage.local.get(['darkMode']);
        if (data.darkMode) {
          document.body.classList.add('dark-mode');
          this.updateDarkModeIcon(true);
        }
      } catch (error) {
        this.logger.error('Failed to load dark mode', { error: error.message });
      }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
      // Master toggle
      document.getElementById('master-toggle').addEventListener('change', (e) => {
        if (this.isLoadingSettings) return;
        this.updateStatus(e.target.checked);
        this.saveSettings();
      });

      // Category checkboxes
      ['skip-sponsors', 'skip-intros', 'skip-outros', 'skip-donations', 'skip-selfpromo']
        .forEach(id => {
          document.getElementById(id).addEventListener('change', () => {
            if (this.isLoadingSettings) return;
            this.saveSettings();
          });
        });

      // Advanced settings
      document.getElementById('confidence-slider').addEventListener('input', (e) => {
        if (this.isLoadingSettings) return;
        const value = e.target.value / 100;
        document.getElementById('confidence-value').textContent = value.toFixed(2);
        this.saveAdvancedSettings();
      });

      document.getElementById('ai-model').addEventListener('change', () => {
        if (this.isLoadingSettings) return;
        this.saveAdvancedSettings();
      });

      document.getElementById('buffer-slider').addEventListener('input', (e) => {
        if (this.isLoadingSettings) return;
        const value = e.target.value / 10;
        document.getElementById('buffer-value').textContent = value.toFixed(1) + 's';
        this.saveAdvancedSettings();
      });

      // Buttons
      document.getElementById('manual-analyze').addEventListener('click', () => {
        this.handleManualAnalyze();
      });

      document.getElementById('view-cache').addEventListener('click', () => {
        this.openCacheViewer();
      });

      document.getElementById('clear-current-cache').addEventListener('click', () => {
        this.clearCurrentCache();
      });

      document.getElementById('clear-all-cache').addEventListener('click', () => {
        this.clearAllCache();
      });

      document.getElementById('whitelist-btn').addEventListener('click', () => {
        this.openWhitelistManager();
      });

      document.getElementById('dark-mode-toggle').addEventListener('click', () => {
        this.toggleDarkMode();
      });

      // Modal
      document.getElementById('modal-close').addEventListener('click', () => {
        this.closeWhitelistModal();
      });

      document.getElementById('whitelist-modal').addEventListener('click', (e) => {
        if (e.target.id === 'whitelist-modal') {
          this.closeWhitelistModal();
        }
      });

      document.getElementById('add-channel-btn').addEventListener('click', () => {
        const input = document.getElementById('channel-input');
        this.addChannelToWhitelist(input.value.trim());
      });

      document.getElementById('channel-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.addChannelToWhitelist(e.target.value.trim());
        }
      });

      // Footer links
      document.getElementById('help').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/yourusername/youtube-smart-skip/wiki' });
      });

      document.getElementById('privacy').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'privacy.html' });
      });

      document.getElementById('feedback').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/yourusername/youtube-smart-skip/issues' });
      });

      this.logger.debug('Event listeners configured');
    }

    /**
     * Update status indicator
     * @param {boolean} isActive - Active status
     */
    updateStatus(isActive) {
      const statusDot = document.querySelector('.status-dot');
      const statusText = document.getElementById('status-text');

      if (isActive) {
        statusDot.classList.remove('inactive');
        statusDot.classList.add('active');
        statusText.textContent = 'Active';
      } else {
        statusDot.classList.remove('active');
        statusDot.classList.add('inactive');
        statusText.textContent = 'Inactive';
      }
    }

    /**
     * Save settings
     */
    async saveSettings() {
      try {
        const settings = {
          skipSponsors: document.getElementById('skip-sponsors').checked,
          skipIntros: document.getElementById('skip-intros').checked,
          skipOutros: document.getElementById('skip-outros').checked,
          skipDonations: document.getElementById('skip-donations').checked,
          skipSelfPromo: document.getElementById('skip-selfpromo').checked,
          autoSkip: document.getElementById('master-toggle').checked,
          skipBuffer: 0.5,
          enablePreview: true
        };

        await this.storageService.updateSettings(settings);

        // Notify content script
        this.sendMessageToContentScript('updateSettings', settings);

        this.logger.info('Settings saved', settings);
      } catch (error) {
        this.logger.error('Failed to save settings', { error: error.message });
        this.showToast('Failed to save settings', 'error');
      }
    }

    /**
     * Save advanced settings
     */
    async saveAdvancedSettings() {
      try {
        // Get current whitelist first
        const current = await this.storageService.getAdvancedSettings();

        const advSettings = {
          confidenceThreshold: parseFloat(document.getElementById('confidence-slider').value) / 100,
          aiModel: document.getElementById('ai-model').value,
          skipBuffer: parseFloat(document.getElementById('buffer-slider').value) / 10,
          channelWhitelist: current.channelWhitelist // Preserve whitelist
        };

        await this.storageService.saveAdvancedSettings(
          AdvancedSettings.fromJSON(advSettings)
        );

        // Notify content script
        this.sendMessageToContentScript('updateAdvancedSettings', advSettings);

        this.logger.info('Advanced settings saved', advSettings);
      } catch (error) {
        this.logger.error('Failed to save advanced settings', { error: error.message });
        this.showToast('Failed to save advanced settings', 'error');
      }
    }

    /**
     * Handle manual analyze
     */
    async handleManualAnalyze() {
      if (!this.currentVideoId) {
        this.showToast('No active video', 'warning');
        return;
      }

      try {
        await this.storageService.invalidateCache(this.currentVideoId);
        this.sendMessageToContentScript('manualAnalyze');
        setTimeout(() => window.close(), 500);
      } catch (error) {
        this.logger.error('Failed to trigger manual analyze', { error: error.message });
        this.showToast('Failed to start analysis', 'error');
      }
    }

    /**
     * Open cache viewer
     */
    openCacheViewer() {
      const url = chrome.runtime.getURL('cache-viewer.html');
      chrome.tabs.create({ url }, (tab) => {
        if (chrome.runtime.lastError) {
          this.logger.error('Failed to open cache viewer', {
            error: chrome.runtime.lastError.message
          });
          this.showToast('Error opening cache page', 'error');
        }
      });
    }

    /**
     * Clear current video cache
     */
    async clearCurrentCache() {
      if (!this.currentVideoId) {
        this.showToast('No active YouTube video', 'warning');
        return;
      }

      if (!confirm('Clear cache for this video?')) {
        return;
      }

      try {
        await this.storageService.invalidateCache(this.currentVideoId);
        this.showToast('Video cache cleared! Reload page to reanalyze', 'success');
        await this.loadCacheInfo();
      } catch (error) {
        this.logger.error('Failed to clear current cache', { error: error.message });
        this.showToast('Failed to clear cache', 'error');
      }
    }

    /**
     * Clear all cache
     */
    async clearAllCache() {
      if (!confirm('⚠️ WARNING: Clear ALL cache?\n\nAll videos will need to be reanalyzed.')) {
        return;
      }

      try {
        await this.storageService.clearCache();
        const stats = await this.storageService.getCacheStatistics();
        this.showToast(`Cache cleared!`, 'success');
        await this.loadCacheInfo();
      } catch (error) {
        this.logger.error('Failed to clear all cache', { error: error.message });
        this.showToast('Failed to clear cache', 'error');
      }
    }

    /**
     * Open whitelist manager
     */
    async openWhitelistManager() {
      const modal = document.getElementById('whitelist-modal');
      modal.classList.add('active');

      await this.loadWhitelistChannels();

      // Try to get current channel
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/watch')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getCurrentChannel' }, (response) => {
          if (response && response.channelName) {
            const currentChannelInfo = document.getElementById('current-channel-info');
            const currentChannelText = document.getElementById('current-channel-text');
            currentChannelText.textContent = `📺 ${response.channelName}`;
            currentChannelInfo.style.display = 'block';

            document.getElementById('add-current-channel-btn').onclick = () => {
              this.addChannelToWhitelist(response.channelName);
            };
          }
        });
      }
    }

    /**
     * Close whitelist modal
     */
    closeWhitelistModal() {
      document.getElementById('whitelist-modal').classList.remove('active');
    }

    /**
     * Load whitelist channels
     */
    async loadWhitelistChannels() {
      try {
        const advSettings = await this.storageService.getAdvancedSettings();
        const whitelist = advSettings.channelWhitelist;
        const whitelistList = document.getElementById('whitelist-list');

        if (whitelist.length === 0) {
          whitelistList.innerHTML = '<div class="empty-state">No excluded channels.<br>Add channels to never analyze them.</div>';
        } else {
          whitelistList.innerHTML = whitelist.map(channel => `
          <div class="whitelist-item">
            <span class="whitelist-item-name">${channel}</span>
            <button class="whitelist-item-remove" data-channel="${channel}">Remove</button>
          </div>
        `).join('');

          // Add remove handlers
          document.querySelectorAll('.whitelist-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
              this.removeChannelFromWhitelist(e.target.getAttribute('data-channel'));
            });
          });
        }
      } catch (error) {
        this.logger.error('Failed to load whitelist', { error: error.message });
      }
    }

    /**
     * Add channel to whitelist
     * @param {string} channelName - Channel name
     */
    async addChannelToWhitelist(channelName) {
      if (!channelName || !channelName.trim()) {
        this.showToast('Enter a valid channel name', 'warning');
        return;
      }

      try {
        await this.storageService.addToWhitelist(channelName.trim());

        const advSettings = await this.storageService.getAdvancedSettings();
        this.loadAdvancedSettingsUI(advSettings);
        await this.loadWhitelistChannels();

        this.showToast(`Channel "${channelName}" added to whitelist`, 'success');

        const input = document.getElementById('channel-input');
        if (input) input.value = '';
      } catch (error) {
        this.logger.error('Failed to add channel', { error: error.message });
        this.showToast('Channel already in whitelist', 'warning');
      }
    }

    /**
     * Remove channel from whitelist
     * @param {string} channelName - Channel name
     */
    async removeChannelFromWhitelist(channelName) {
      try {
        await this.storageService.removeFromWhitelist(channelName);

        const advSettings = await this.storageService.getAdvancedSettings();
        this.loadAdvancedSettingsUI(advSettings);
        await this.loadWhitelistChannels();

        this.showToast(`Channel "${channelName}" removed`, 'info');
      } catch (error) {
        this.logger.error('Failed to remove channel', { error: error.message });
        this.showToast('Failed to remove channel', 'error');
      }
    }

    /**
     * Toggle dark mode
     */
    async toggleDarkMode() {
      const isDark = document.body.classList.toggle('dark-mode');
      await chrome.storage.local.set({ darkMode: isDark });
      this.updateDarkModeIcon(isDark);
      this.showToast(isDark ? 'Dark mode enabled' : 'Dark mode disabled', 'info', 2000);
    }

    /**
     * Update dark mode icon
     * @param {boolean} isDark - Dark mode status
     */
    updateDarkModeIcon(isDark) {
      const toggle = document.getElementById('dark-mode-toggle');
      const icon = toggle.querySelector('.material-icons');
      icon.textContent = isDark ? 'light_mode' : 'dark_mode';
      toggle.title = isDark ? 'Enable Light Mode' : 'Enable Dark Mode';
    }

    /**
     * Send message to content script
     * @param {string} action - Action
     * @param {Object} data - Data
     */
    sendMessageToContentScript(action, data = {}) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/watch')) {
          chrome.tabs.sendMessage(tabs[0].id, { action, ...data }, (response) => {
            if (chrome.runtime.lastError) {
              this.logger.debug('Content script not available', {
                error: chrome.runtime.lastError.message
              });
            }
          });
        }
      });
    }

    /**
     * Show toast notification
     * @param {string} message - Message
     * @param {string} type - Type
     * @param {number} duration - Duration in ms
     */
    showToast(message, type = 'info', duration = 3000) {
      const container = document.getElementById('toast-container');

      const iconMap = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
      };

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `
      <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close">&times;</button>
    `;

      container.appendChild(toast);

      toast.querySelector('.toast-close').addEventListener('click', () => {
        this.removeToast(toast);
      });

      setTimeout(() => {
        this.removeToast(toast);
      }, duration);
    }

    /**
     * Remove toast
     * @param {HTMLElement} toast - Toast element
     */
    removeToast(toast) {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new PopupManager();
    });
  } else {
    new PopupManager();
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PopupManager };
  }

})();
