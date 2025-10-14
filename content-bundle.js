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

  /**
   * TranscriptValidationError - Transcript validation errors
   */
  class TranscriptValidationError extends ValidationError {
    constructor(message) {
      super(message, 'transcript', null);
    }

    getUserMessage() {
      return `Invalid transcript: ${this.message}`;
    }
  }

  // transcript-error.js - Transcript extraction errors


  /**
   * TranscriptError - Transcript extraction errors
   */
  class TranscriptError extends BaseError {
    constructor(message, videoId, method = null) {
      super(message, 'TRANSCRIPT_ERROR', { videoId, method });
      this.videoId = videoId;
      this.method = method;
    }

    getUserMessage() {
      return 'Unable to extract transcript from this video.';
    }

    getSeverity() {
      return 'warning';
    }
  }

  /**
   * TranscriptNotAvailableError - Video has no transcript
   */
  class TranscriptNotAvailableError extends TranscriptError {
    constructor(videoId) {
      super('Transcript not available for this video', videoId);
    }

    getUserMessage() {
      return 'This video does not have subtitles/transcript available. The extension only works with videos that have captions.';
    }
  }

  /**
   * TranscriptExtractionError - Failed to extract transcript
   */
  class TranscriptExtractionError extends TranscriptError {
    constructor(message, videoId, method) {
      super(message, videoId, method);
    }

    isRetryable() {
      return true;
    }

    getUserMessage() {
      return 'Failed to extract transcript. Retrying with different method...';
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

  // transcript-validator.js - Transcript validation logic


  /**
   * TranscriptValidator - Validates transcript data
   */
  class TranscriptValidator {
    /**
     * Validate complete transcript object
     * @param {Object} transcript - Transcript to validate
     * @throws {TranscriptValidationError}
     */
    static validate(transcript) {
      if (!transcript || typeof transcript !== 'object') {
        throw new TranscriptValidationError(
          'Transcript must be an object',
          'transcript',
          transcript
        );
      }

      if (!transcript.text || typeof transcript.text !== 'string') {
        throw new TranscriptValidationError(
          'Transcript must contain text',
          'text',
          transcript.text
        );
      }

      if (transcript.text.trim().length === 0) {
        throw new TranscriptValidationError(
          'Transcript text cannot be empty',
          'text',
          transcript.text
        );
      }

      // Validate segments if present
      if (transcript.segments !== undefined) {
        this.validateSegments(transcript.segments);
      }

      return true;
    }

    /**
     * Validate transcript segments array
     * @param {Array} segments - Transcript segments
     * @throws {TranscriptValidationError}
     */
    static validateSegments(segments) {
      if (!Array.isArray(segments)) {
        throw new TranscriptValidationError(
          'Segments must be an array',
          'segments',
          segments
        );
      }

      if (segments.length === 0) {
        throw new TranscriptValidationError(
          'Segments array cannot be empty',
          'segments',
          segments
        );
      }

      segments.forEach((segment, index) => {
        this.validateSegment(segment, index);
      });

      return true;
    }

    /**
     * Validate individual transcript segment
     * @param {Object} segment - Segment to validate
     * @param {number} index - Segment index
     * @throws {TranscriptValidationError}
     */
    static validateSegment(segment, index) {
      if (!segment || typeof segment !== 'object') {
        throw new TranscriptValidationError(
          `Segment at index ${index} must be an object`,
          `segments[${index}]`,
          segment
        );
      }

      // Validate time
      if (segment.time !== undefined) {
        if (typeof segment.time !== 'number') {
          throw new TranscriptValidationError(
            `Segment at index ${index}: time must be a number`,
            `segments[${index}].time`,
            segment.time
          );
        }

        if (segment.time < 0) {
          throw new TranscriptValidationError(
            `Segment at index ${index}: time must be non-negative`,
            `segments[${index}].time`,
            segment.time
          );
        }
      }

      // Validate text
      if (segment.text !== undefined) {
        if (typeof segment.text !== 'string') {
          throw new TranscriptValidationError(
            `Segment at index ${index}: text must be a string`,
            `segments[${index}].text`,
            segment.text
          );
        }
      }

      return true;
    }

    /**
     * Validate transcript text format
     * @param {string} text - Transcript text
     * @throws {TranscriptValidationError}
     */
    static validateText(text) {
      if (typeof text !== 'string') {
        throw new TranscriptValidationError(
          'Transcript text must be a string',
          'text',
          text
        );
      }

      if (text.trim().length === 0) {
        throw new TranscriptValidationError(
          'Transcript text cannot be empty',
          'text',
          text
        );
      }

      // Check minimum length (at least 10 characters)
      if (text.length < 10) {
        throw new TranscriptValidationError(
          'Transcript text too short (minimum 10 characters)',
          'text',
          text
        );
      }

      return true;
    }

    /**
     * Validate video ID
     * @param {string} videoId - YouTube video ID
     * @throws {TranscriptValidationError}
     */
    static validateVideoId(videoId) {
      if (typeof videoId !== 'string') {
        throw new TranscriptValidationError(
          'Video ID must be a string',
          'videoId',
          videoId
        );
      }

      if (videoId.trim().length === 0) {
        throw new TranscriptValidationError(
          'Video ID cannot be empty',
          'videoId',
          videoId
        );
      }

      // YouTube video IDs are typically 11 characters
      if (videoId.length !== 11) {
        throw new TranscriptValidationError(
          'Video ID must be 11 characters',
          'videoId',
          videoId
        );
      }

      // Valid characters: alphanumeric, hyphen, underscore
      const validPattern = /^[a-zA-Z0-9_-]+$/;
      if (!validPattern.test(videoId)) {
        throw new TranscriptValidationError(
          'Video ID contains invalid characters',
          'videoId',
          videoId
        );
      }

      return true;
    }

    /**
     * Validate channel ID
     * @param {string} channelId - YouTube channel ID
     * @throws {TranscriptValidationError}
     */
    static validateChannelId(channelId) {
      if (typeof channelId !== 'string') {
        throw new TranscriptValidationError(
          'Channel ID must be a string',
          'channelId',
          channelId
        );
      }

      if (channelId.trim().length === 0) {
        throw new TranscriptValidationError(
          'Channel ID cannot be empty',
          'channelId',
          channelId
        );
      }

      // Channel IDs can be handles (@username) or UC IDs (UCxxxxxxxxxx)
      const isHandle = channelId.startsWith('@');
      const isUCId = channelId.startsWith('UC') && channelId.length === 24;

      if (!isHandle && !isUCId) {
        throw new TranscriptValidationError(
          'Channel ID must be a handle (@username) or UC ID (UC...)',
          'channelId',
          channelId
        );
      }

      return true;
    }

    /**
     * Sanitize transcript (normalize text, remove invalid segments)
     * @param {Object} transcript - Transcript to sanitize
     * @returns {Object} - Sanitized transcript
     */
    static sanitize(transcript) {
      if (!transcript || typeof transcript !== 'object') {
        return { text: '', segments: [] };
      }

      const sanitized = {
        text: (transcript.text || '').trim(),
        videoId: transcript.videoId || '',
        channelId: transcript.channelId || ''
      };

      // Sanitize segments if present
      if (Array.isArray(transcript.segments)) {
        sanitized.segments = transcript.segments
          .filter(segment => {
            return segment &&
                   typeof segment === 'object' &&
                   (segment.time === undefined || typeof segment.time === 'number') &&
                   (segment.text === undefined || typeof segment.text === 'string');
          })
          .map(segment => ({
            time: Math.max(0, segment.time || 0),
            text: (segment.text || '').trim()
          }));
      }

      return sanitized;
    }

    /**
     * Validate safe - returns null on failure
     * @param {Object} transcript - Transcript to validate
     * @returns {boolean|null}
     */
    static validateSafe(transcript) {
      try {
        this.validate(transcript);
        return true;
      } catch (error) {
        return null;
      }
    }

    /**
     * Check if transcript has sufficient content for analysis
     * @param {Object} transcript - Transcript to check
     * @param {number} minLength - Minimum text length
     * @returns {boolean}
     */
    static hasSufficientContent(transcript, minLength = 100) {
      if (!transcript || !transcript.text) {
        return false;
      }

      return transcript.text.trim().length >= minLength;
    }

    /**
     * Validate transcript format (DOM vs API)
     * @param {Array} transcriptArray - Array of transcript entries
     * @throws {TranscriptValidationError}
     */
    static validateFormat(transcriptArray) {
      if (!Array.isArray(transcriptArray)) {
        throw new TranscriptValidationError(
          'Transcript must be an array',
          'transcript',
          transcriptArray
        );
      }

      if (transcriptArray.length === 0) {
        throw new TranscriptValidationError(
          'Transcript array cannot be empty',
          'transcript',
          transcriptArray
        );
      }

      // Each entry should have time and text
      transcriptArray.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object') {
          throw new TranscriptValidationError(
            `Entry at index ${index} must be an object`,
            `transcript[${index}]`,
            entry
          );
        }

        if (typeof entry.time !== 'number') {
          throw new TranscriptValidationError(
            `Entry at index ${index} must have numeric time`,
            `transcript[${index}].time`,
            entry.time
          );
        }

        if (typeof entry.text !== 'string') {
          throw new TranscriptValidationError(
            `Entry at index ${index} must have string text`,
            `transcript[${index}].text`,
            entry.text
          );
        }
      });

      return true;
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

  // transcript.js - Transcript domain model


  /**
   * Transcript - Represents a video transcript
   */
  class Transcript {
    /**
     * @param {string} text - Full transcript text
     * @param {string} videoId - YouTube video ID
     * @param {string} channelId - YouTube channel ID
     * @param {Array} segments - Optional transcript segments
     */
    constructor(text, videoId, channelId = '', segments = []) {
      // Validate on construction
      TranscriptValidator.validate({ text, segments });
      TranscriptValidator.validateVideoId(videoId);

      this.text = text.trim();
      this.videoId = videoId;
      this.channelId = channelId;
      this.segments = segments;
      this.extractedAt = new Date().toISOString();
    }

    /**
     * Get transcript word count
     * @returns {number}
     */
    getWordCount() {
      return this.text.split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Get transcript character count
     * @returns {number}
     */
    getCharCount() {
      return this.text.length;
    }

    /**
     * Get estimated reading time in minutes
     * @param {number} wordsPerMinute - Reading speed (default 200)
     * @returns {number}
     */
    getEstimatedReadingTime(wordsPerMinute = 200) {
      return Math.ceil(this.getWordCount() / wordsPerMinute);
    }

    /**
     * Check if transcript has sufficient content for analysis
     * @param {number} minWords - Minimum word count
     * @returns {boolean}
     */
    hasSufficientContent(minWords = 50) {
      return this.getWordCount() >= minWords;
    }

    /**
     * Get transcript excerpt
     * @param {number} maxLength - Maximum length
     * @returns {string}
     */
    getExcerpt(maxLength = 200) {
      if (this.text.length <= maxLength) {
        return this.text;
      }
      return this.text.substring(0, maxLength) + '...';
    }

    /**
     * Get segment at specific time
     * @param {number} time - Time in seconds
     * @returns {Object|null}
     */
    getSegmentAtTime(time) {
      return this.segments.find(segment => {
        return time >= segment.time &&
               (segment.end === undefined || time < segment.end);
      }) || null;
    }

    /**
     * Get segments in time range
     * @param {number} start - Start time
     * @param {number} end - End time
     * @returns {Array}
     */
    getSegmentsInRange(start, end) {
      return this.segments.filter(segment => {
        return segment.time >= start && segment.time < end;
      });
    }

    /**
     * Format for AI analysis
     * @returns {string}
     */
    formatForAI() {
      if (this.segments.length > 0) {
        // Format with timestamps if we have segments
        return this.segments
          .map(segment => `[${Math.floor(segment.time)}s] ${segment.text}`)
          .join('\n');
      }
      return this.text;
    }

    /**
     * Get metadata
     * @returns {Object}
     */
    getMetadata() {
      return {
        videoId: this.videoId,
        channelId: this.channelId,
        wordCount: this.getWordCount(),
        charCount: this.getCharCount(),
        segmentCount: this.segments.length,
        extractedAt: this.extractedAt,
        hasSufficientContent: this.hasSufficientContent()
      };
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toJSON() {
      return {
        text: this.text,
        videoId: this.videoId,
        channelId: this.channelId,
        segments: this.segments,
        extractedAt: this.extractedAt,
        metadata: this.getMetadata()
      };
    }

    /**
     * Create from plain object
     * @param {Object} data - Plain object data
     * @returns {Transcript}
     */
    static fromJSON(data) {
      const transcript = new Transcript(
        data.text,
        data.videoId,
        data.channelId || '',
        data.segments || []
      );

      if (data.extractedAt) {
        transcript.extractedAt = data.extractedAt;
      }

      return transcript;
    }

    /**
     * Create from DOM extraction
     * @param {Array} domSegments - Segments extracted from DOM
     * @param {string} videoId - Video ID
     * @param {string} channelId - Channel ID
     * @returns {Transcript}
     */
    static fromDOM(domSegments, videoId, channelId = '') {
      // Combine all text
      const text = domSegments.map(s => s.text).join(' ');

      // Create transcript with segments
      return new Transcript(text, videoId, channelId, domSegments);
    }

    /**
     * Create from API response
     * @param {Object} apiData - API response data
     * @param {string} videoId - Video ID
     * @param {string} channelId - Channel ID
     * @returns {Transcript}
     */
    static fromAPI(apiData, videoId, channelId = '') {
      // Parse API format (could be various formats)
      const segments = apiData.events || apiData.segments || [];
      const text = segments.map(s => s.segs?.[0]?.utf8 || s.text || '').join(' ');

      return new Transcript(text, videoId, channelId, segments);
    }

    /**
     * Merge multiple transcripts
     * @param {Array<Transcript>} transcripts - Transcripts to merge
     * @returns {Transcript}
     */
    static merge(transcripts) {
      if (transcripts.length === 0) {
        throw new Error('Cannot merge empty transcripts array');
      }

      const first = transcripts[0];
      const allText = transcripts.map(t => t.text).join(' ');
      const allSegments = transcripts.flatMap(t => t.segments);

      return new Transcript(
        allText,
        first.videoId,
        first.channelId,
        allSegments
      );
    }

    /**
     * Search for text in transcript
     * @param {string} query - Search query
     * @param {boolean} caseSensitive - Case sensitive search
     * @returns {Array} - Matches with positions
     */
    search(query, caseSensitive = false) {
      const text = caseSensitive ? this.text : this.text.toLowerCase();
      const searchQuery = caseSensitive ? query : query.toLowerCase();
      const matches = [];
      let position = 0;

      while ((position = text.indexOf(searchQuery, position)) !== -1) {
        matches.push({
          position,
          text: this.text.substring(position, position + query.length),
          context: this.text.substring(
            Math.max(0, position - 50),
            Math.min(this.text.length, position + query.length + 50)
          )
        });
        position += query.length;
      }

      return matches;
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

  // index.js - Models module exports

  var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    AdvancedSettings: AdvancedSettings,
    AnalysisResult: AnalysisResult,
    Segment: Segment,
    Settings: Settings,
    Transcript: Transcript
  });

  // transcript-service.js - Transcript extraction and management service


  /**
   * TranscriptService - Handles transcript extraction and processing
   */
  class TranscriptService {
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

  // content-main.js - Refactored content script using new infrastructure


  /**
   * YouTubeSkipManager - Main content script manager
   */
  class YouTubeSkipManager {
    constructor() {
      this.video = null;
      this.skipSegments = [];
      this.currentVideoId = null;
      this.isAnalyzing = false;

      // Services
      this.logger = logger.child('YouTubeSkipManager');
      this.transcriptService = new TranscriptService();
      this.storageService = new StorageService();
      this.analyticsService = new AnalyticsService();

      // Settings (will be loaded from storage)
      this.settings = null;
      this.advancedSettings = null;

      this.init();
    }

    /**
     * Initialize manager
     */
    async init() {
      try {
        this.logger.info('Initializing YouTube Skip Manager');

        // Load settings
        await this.loadSettings();

        // Setup observers
        this.observeVideoChanges();
        this.setupMessageListener();

        this.logger.info('YouTube Skip Manager initialized successfully');
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
        this.settings = allSettings.settings;
        this.advancedSettings = allSettings.advancedSettings;

        this.logger.debug('Settings loaded', {
          autoSkip: this.settings.autoSkip,
          enabledCategories: this.settings.getEnabledCategories()
        });
      } catch (error) {
        this.logger.error('Failed to load settings', { error: error.message });
        // Use defaults if loading fails
        const { Settings, AdvancedSettings } = await Promise.resolve().then(function () { return index; });
        this.settings = Settings.createDefault();
        this.advancedSettings = AdvancedSettings.createDefault();
      }
    }

    /**
     * Observe DOM changes to detect video changes
     */
    observeVideoChanges() {
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

      this.logger.debug('Video change observer configured');
    }

    /**
     * Extract video ID from URL
     * @returns {string|null}
     */
    extractVideoId() {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('v');
    }

    /**
     * Extract channel ID from page
     * @returns {string}
     */
    extractChannelId() {
      try {
        const channelLinkElement = document.querySelector('ytd-channel-name a');
        if (!channelLinkElement) return '';

        const channelUrl = channelLinkElement.href;
        return channelUrl?.split('/').pop() || '';
      } catch (error) {
        this.logger.warn('Failed to extract channel ID', { error: error.message });
        return '';
      }
    }

    /**
     * Handle new video detection
     * @param {HTMLVideoElement} video - Video element
     * @param {string} videoId - Video ID
     */
    async handleNewVideo(video, videoId) {
      try {
        this.logger.info('New video detected', { videoId });

        this.video = video;
        this.currentVideoId = videoId;
        this.skipSegments = [];

        // Track video view
        const channelId = this.extractChannelId();
        await this.analyticsService.trackVideoView(videoId, channelId);

        // Check if channel is whitelisted
        if (await this.isChannelWhitelisted()) {
          this.logger.info('Channel whitelisted, skipping analysis', { videoId });
          this.showNotification('ℹ️ Channel excluded by advanced settings', 'info');
          return;
        }

        // Check cache
        const cachedResult = await this.storageService.getCachedAnalysis(videoId);
        if (cachedResult) {
          this.logger.info('Cache hit', {
            videoId,
            segments: cachedResult.getSegmentCount()
          });

          // Convert to Segment models
          this.skipSegments = cachedResult.segments;

          this.setupVideoMonitoring();
          this.displaySegments();
          this.showNotification(
            `✅ ${cachedResult.getSegmentCount()} segments loaded from cache`,
            'success'
          );
          return;
        }

        // Wait for page to load
        await this.delay(2000);

        // Try to open transcript panel
        await this.transcriptService.openTranscriptPanel();

        // Start analysis
        this.analyzeVideo(videoId);
        this.setupVideoMonitoring();

      } catch (error) {
        this.logger.error('Failed to handle new video', {
          videoId,
          error: error.message
        });
      }
    }

    /**
     * Check if current channel is whitelisted
     * @returns {Promise<boolean>}
     */
    async isChannelWhitelisted() {
      try {
        const channelId = this.extractChannelId();
        if (!channelId) return false;

        return await this.storageService.isChannelWhitelisted(channelId);
      } catch (error) {
        this.logger.error('Failed to check whitelist', { error: error.message });
        return false;
      }
    }

    /**
     * Setup video monitoring for skip detection
     */
    setupVideoMonitoring() {
      if (!this.video) {
        this.logger.warn('Cannot setup monitoring: video element not found');
        return;
      }

      // Merge overlapping segments
      if (this.skipSegments.length > 0) {
        const mergedSegments = Segment.mergeOverlapping(this.skipSegments);
        this.skipSegments = mergedSegments;

        this.logger.debug('Segments merged', {
          original: this.skipSegments.length,
          merged: mergedSegments.length
        });
      }

      this.logger.info('Video monitoring setup', {
        segments: this.skipSegments.length,
        autoSkip: this.settings.autoSkip
      });

      // Remove previous listener
      this.video.removeEventListener('timeupdate', this.handleTimeUpdate);

      // Add new listener
      this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
      this.video.addEventListener('timeupdate', this.handleTimeUpdate);
    }

    /**
     * Handle video time update
     */
    handleTimeUpdate() {
      if (!this.settings.autoSkip || !this.video || this.skipSegments.length === 0) {
        return;
      }

      const currentTime = this.video.currentTime;

      // Check if we're in a segment to skip
      for (const segment of this.skipSegments) {
        if (segment.contains(currentTime, this.settings.skipBuffer)) {
          this.logger.debug('Segment detected', {
            currentTime,
            segment: segment.category,
            range: segment.getTimeRange()
          });

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

    /**
     * Perform skip action
     * @param {Segment} segment - Segment to skip
     */
    async performSkip(segment) {
      if (!this.video) return;

      this.logger.info('Performing skip', {
        category: segment.category,
        duration: segment.getDuration(),
        range: segment.getTimeRange()
      });

      // Track skip
      await this.analyticsService.trackSegmentSkip(segment, this.currentVideoId);

      // Fade animation
      this.video.style.transition = 'opacity 0.3s';
      this.video.style.opacity = '0.5';

      const newTime = segment.end;

      setTimeout(() => {
        this.video.currentTime = newTime;
        this.video.style.opacity = '1';

        this.showNotification(
          `⏩ Skipped: ${segment.category} (${segment.getDuration()}s saved)`,
          'success'
        );

        // Remove skipped segments
        this.skipSegments = this.skipSegments.filter(s => s.end > newTime);

        this.logger.debug('Skip complete', {
          remainingSegments: this.skipSegments.length
        });
      }, 300);
    }

    /**
     * Show skip preview notification
     * @param {Segment} segment - Segment to preview
     */
    showSkipPreview(segment) {
      const preview = document.createElement('div');
      preview.className = 'yss-skip-preview';

      preview.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="material-icons" style="font-size: 20px; flex-shrink: 0; color: #f9ab00;">fast_forward</span>
        <div style="flex: 1;">
          <div style="font-weight: 500; font-size: 14px; margin-bottom: 4px;">Skipping ${segment.category}</div>
          <div style="font-size: 12px; opacity: 0.9;">In ${this.settings.skipBuffer}s</div>
        </div>
        <button class="yss-cancel-skip" style="
          padding: 8px 16px;
          background: #1a73e8;
          color: white;
          border: none;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          font-family: Roboto, Arial, sans-serif;
          transition: background 0.2s cubic-bezier(0.2, 0, 0, 1);
          white-space: nowrap;
        ">Cancel</button>
      </div>
    `;

      preview.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: white;
      color: #202124;
      padding: 14px 16px;
      border-radius: 8px;
      border-left: 4px solid #f9ab00;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-family: Roboto, Arial, sans-serif;
      min-width: 300px;
      animation: yss-slideIn 0.3s cubic-bezier(0.2, 0, 0, 1);
    `;

      document.body.appendChild(preview);

      // Handle cancellation
      const cancelBtn = preview.querySelector('.yss-cancel-skip');
      cancelBtn.onclick = () => {
        this.skipSegments = this.skipSegments.filter(s => s !== segment);
        preview.style.animation = 'yss-slideOut 0.2s cubic-bezier(0.2, 0, 0, 1)';
        setTimeout(() => preview.remove(), 200);
        this.logger.debug('Skip cancelled', { category: segment.category });
      };

      // Hover effect
      cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = '#1765cc';
      });

      cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = '#1a73e8';
      });

      // Auto remove
      setTimeout(() => {
        if (preview.parentElement) {
          preview.style.animation = 'yss-slideOut 0.2s cubic-bezier(0.2, 0, 0, 1)';
          setTimeout(() => preview.remove(), 200);
        }
      }, this.settings.skipBuffer * 1000 + 500);
    }

    /**
     * Analyze video with AI
     * @param {string} videoId - Video ID
     */
    async analyzeVideo(videoId) {
      if (this.isAnalyzing) {
        this.logger.warn('Analysis already in progress', { videoId });
        return;
      }

      this.isAnalyzing = true;
      this.showNotification('🔍 Analyzing video with AI...', 'info');

      const stopTimer = this.logger.time(`analyzeVideo:${videoId}`);

      try {
        // Extract transcript
        const channelId = this.extractChannelId();
        const transcript = await this.transcriptService.extractFromDOM(videoId, channelId);

        if (!transcript) {
          throw new TranscriptNotAvailableError(videoId);
        }

        this.logger.info('Transcript extracted', {
          videoId,
          wordCount: transcript.getWordCount(),
          segments: transcript.segments.length
        });

        // Validate transcript quality
        const quality = this.transcriptService.validateQuality(transcript);
        if (!quality.isValid) {
          this.logger.warn('Transcript quality issues', { issues: quality.issues });
        }

        this.showNotification(
          `✓ Transcript loaded: ${transcript.segments.length} segments. Analyzing with AI...`,
          'info'
        );

        // Get video title
        const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'YouTube Video';

        // Send to background for AI analysis
        const result = await chrome.runtime.sendMessage({
          action: 'analyzeTranscript',
          data: {
            videoId: videoId,
            transcript: transcript.segments,
            title: videoTitle,
            settings: this.settings.toJSON()
          }
        });

        stopTimer();

        if (result.success && result.segments && result.segments.length > 0) {
          // Convert to Segment models
          this.skipSegments = result.segments.map(s => Segment.fromJSON(s));

          // Setup monitoring with new segments
          this.setupVideoMonitoring();

          // Display on timeline
          this.displaySegments();

          this.showNotification(
            `✅ Found ${result.segments.length} segments to skip!`,
            'success'
          );

          this.logger.info('Analysis complete', {
            videoId,
            segments: result.segments.length,
            categories: Segment.groupByCategory(this.skipSegments)
          });

        } else if (result.success) {
          this.showNotification('ℹ️ No content to skip detected by AI', 'info');
          this.logger.info('No segments found', { videoId });
        } else {
          throw new Error(result.error || 'Unknown analysis error');
        }

      } catch (error) {
        stopTimer();

        this.logger.error('Analysis failed', {
          videoId,
          error: error.message,
          name: error.name
        });

        if (error instanceof TranscriptNotAvailableError) {
          this.showNotification(
            '⚠️ Transcript not available for this video. The extension only works with videos that have subtitles.',
            'warning'
          );
        } else {
          this.showNotification(
            `❌ Analysis error: ${error.message}`,
            'error'
          );
        }
      } finally {
        this.isAnalyzing = false;
      }
    }

    /**
     * Display segments on video timeline
     */
    displaySegments() {
      // Remove previous markers
      document.querySelectorAll('.yss-segment-marker').forEach(m => m.remove());
      document.querySelectorAll('.yss-segment-tooltip').forEach(t => t.remove());

      const progressBar = document.querySelector('.ytp-progress-bar');
      if (!progressBar || !this.video) return;

      const duration = this.video.duration;
      if (!duration || duration === 0) {
        this.logger.warn('Video duration not available');
        return;
      }

      this.logger.debug('Displaying segments on timeline', {
        count: this.skipSegments.length,
        duration
      });

      this.skipSegments.forEach((segment, index) => {
        // Get color by category
        const color = this.getCategoryColor(segment.category);

        // Calculate position and width
        const left = (segment.start / duration) * 100;
        const width = (segment.getDuration() / duration) * 100;

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

        // Hover handlers
        marker.addEventListener('mouseenter', (e) => {
          marker.style.opacity = '0.9';
          this.showSegmentTooltip(segment, e);
        });

        marker.addEventListener('mouseleave', () => {
          marker.style.opacity = '0.6';
          this.hideSegmentTooltip();
        });

        // Click to skip
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

    /**
     * Get color for category
     * @param {string} category - Category name
     * @returns {string}
     */
    getCategoryColor(category) {
      const colors = {
        'Sponsor': '#FF0000',
        'Self-Promo': '#FF8800',
        'Autopromo': '#FF8800',
        'Intro': '#00FFFF',
        'Outro': '#CC00FF',
        'Donations': '#00FF00',
        'Ringraziamenti': '#00FF00',
        'Acknowledgments': '#00FF00',
        'Merchandise': '#FF8800'
      };

      // Find matching color
      for (const [cat, col] of Object.entries(colors)) {
        if (category.includes(cat)) {
          return col;
        }
      }

      return '#FF0000'; // Default red
    }

    /**
     * Show segment tooltip
     * @param {Segment} segment - Segment
     * @param {Event} event - Mouse event
     */
    showSegmentTooltip(segment, event) {
      this.hideSegmentTooltip();

      const tooltip = document.createElement('div');
      tooltip.className = 'yss-segment-tooltip';

      const categoryColor = this.getCategoryColor(segment.category);

      tooltip.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <div style="width: 4px; height: 16px; background: ${categoryColor}; border-radius: 2px;"></div>
        <div style="font-weight: 500; font-size: 14px; color: #202124;">${segment.category}</div>
      </div>
      <div style="font-size: 12px; color: #5f6368; margin-bottom: 6px;">
        ${segment.getTimeRange()} • ${segment.getDuration()}s
      </div>
      <div style="font-size: 12px; color: #202124; line-height: 1.5; margin-bottom: 8px;">
        ${segment.description}
      </div>
      <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #5f6368; padding-top: 6px; border-top: 1px solid #e8eaed;">
        <span class="material-icons" style="font-size: 14px;">touch_app</span>
        <span>Click to skip</span>
      </div>
    `;

      tooltip.style.cssText = `
      position: fixed;
      background: white;
      color: #202124;
      padding: 12px 14px;
      border-radius: 8px;
      z-index: 10000;
      pointer-events: none;
      font-family: Roboto, Arial, sans-serif;
      max-width: 300px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.12);
      border: 1px solid #dadce0;
    `;

      document.body.appendChild(tooltip);

      // Position tooltip
      const rect = event.target.getBoundingClientRect();
      tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
      tooltip.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    }

    /**
     * Hide segment tooltip
     */
    hideSegmentTooltip() {
      const tooltip = document.querySelector('.yss-segment-tooltip');
      if (tooltip) tooltip.remove();
    }

    /**
     * Show notification
     * @param {string} message - Message
     * @param {string} type - Type (info, success, warning, error)
     */
    showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = `yss-notification yss-${type}`;

      // Material Icons
      const icons = {
        info: 'info_outline',
        success: 'check_circle',
        warning: 'warning',
        error: 'error_outline'
      };

      const borderColors = {
        info: '#1a73e8',
        success: '#0f9d58',
        warning: '#f9ab00',
        error: '#d93025'
      };

      notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="material-icons" style="font-size: 20px; flex-shrink: 0; color: ${borderColors[type]};">${icons[type]}</span>
        <span style="flex: 1; font-size: 14px; line-height: 20px;">${message}</span>
        <button class="yss-close-notification" style="background: none; border: none; color: #5f6368; cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">&times;</button>
      </div>
    `;

      notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      color: #202124;
      padding: 14px 16px;
      border-radius: 8px;
      border-left: 4px solid ${borderColors[type]};
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-family: Roboto, Arial, sans-serif;
      min-width: 280px;
      max-width: 400px;
      animation: yss-slideIn 0.3s cubic-bezier(0.2, 0, 0, 1);
    `;

      // Close button handler
      const closeBtn = notification.querySelector('.yss-close-notification');
      closeBtn.addEventListener('click', () => {
        notification.style.animation = 'yss-slideOut 0.2s cubic-bezier(0.2, 0, 0, 1)';
        setTimeout(() => notification.remove(), 200);
      });

      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.color = '#202124';
      });

      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.color = '#5f6368';
      });

      document.body.appendChild(notification);

      // Auto remove after 3 seconds
      setTimeout(() => {
        if (notification.parentElement) {
          notification.style.animation = 'yss-slideOut 0.2s cubic-bezier(0.2, 0, 0, 1)';
          setTimeout(() => notification.remove(), 200);
        }
      }, 3000);
    }

    /**
     * Setup message listener
     */
    setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.logger.debug('Message received', { action: request.action });

        if (request.action === 'updateSettings') {
          this.loadSettings().then(() => {
            this.logger.info('Settings updated from popup');
          });
        }

        if (request.action === 'updateAdvancedSettings') {
          this.loadSettings().then(() => {
            this.logger.info('Advanced settings updated from popup');
          });
        }

        if (request.action === 'manualAnalyze') {
          if (this.currentVideoId) {
            // Clear cache and reanalyze
            this.storageService.invalidateCache(this.currentVideoId).then(() => {
              this.analyzeVideo(this.currentVideoId);
            });
          }
        }

        if (request.action === 'getCurrentChannel') {
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
          return true;
        }
      });
    }

    /**
     * Delay helper
     * @param {number} ms - Milliseconds
     * @returns {Promise}
     */
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // Load Material Icons font
  const materialIconsLink = document.createElement('link');
  materialIconsLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
  materialIconsLink.rel = 'stylesheet';
  document.head.appendChild(materialIconsLink);

  // CSS Styles - Material Design 3
  const style = document.createElement('style');
  style.textContent = `
  /* Material Icons support */
  .material-icons {
    font-family: 'Material Icons';
    font-weight: normal;
    font-style: normal;
    font-size: 24px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'liga';
  }

  /* Material Design animations */
  @keyframes yss-slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes yss-slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  /* Notification hover effects */
  .yss-notification {
    transition: box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
  }

  .yss-notification:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.15);
  }
`;
  document.head.appendChild(style);

  // Initialize when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new YouTubeSkipManager();
    });
  } else {
    new YouTubeSkipManager();
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { YouTubeSkipManager };
  }

})();
