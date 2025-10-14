// constants.js - Application constants

// Category mappings for AI responses
export const CATEGORIES = {
  SPONSOR: 'Sponsor',
  SELF_PROMO: 'Self-Promo',
  INTRO: 'Intro',
  OUTRO: 'Outro',
  DONATIONS: 'Donations',
  ACKNOWLEDGMENTS: 'Acknowledgments',
  MERCHANDISE: 'Merchandise'
};

// Category color scheme for visual markers
export const CATEGORY_COLORS = {
  [CATEGORIES.SPONSOR]: '#FF0000',           // Red
  [CATEGORIES.SELF_PROMO]: '#FF8800',        // Orange
  'Autopromo': '#FF8800',                    // Orange (legacy)
  [CATEGORIES.INTRO]: '#00FFFF',             // Cyan
  [CATEGORIES.OUTRO]: '#CC00FF',             // Purple
  [CATEGORIES.DONATIONS]: '#00FF00',         // Green
  'Donazioni': '#00FF00',                    // Green (legacy)
  [CATEGORIES.ACKNOWLEDGMENTS]: '#00FF00',   // Green
  'Ringraziamenti': '#00FF00'                // Green (legacy)
};

// Category translation mappings (AI response -> display name)
export const CATEGORY_TRANSLATIONS = {
  'sponsorships': CATEGORIES.SPONSOR,
  'sponsor': CATEGORIES.SPONSOR,
  'intro': CATEGORIES.INTRO,
  'opening sequence': CATEGORIES.INTRO,
  'outro': CATEGORIES.OUTRO,
  'closing sequence': CATEGORIES.OUTRO,
  'donations': CATEGORIES.DONATIONS,
  'super chat': CATEGORIES.DONATIONS,
  'acknowledgments': CATEGORIES.ACKNOWLEDGMENTS,
  'channel_self_promo': CATEGORIES.SELF_PROMO,
  'self_promo': CATEGORIES.SELF_PROMO,
  'self-promotion': CATEGORIES.SELF_PROMO,
  'merchandise': CATEGORIES.MERCHANDISE,
  'merch': CATEGORIES.MERCHANDISE
};

// DOM Selectors
export const SELECTORS = {
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

// Message actions for chrome.runtime messaging
export const MESSAGE_ACTIONS = {
  ANALYZE_TRANSCRIPT: 'analyzeTranscript',
  UPDATE_SETTINGS: 'updateSettings',
  UPDATE_ADVANCED_SETTINGS: 'updateAdvancedSettings',
  MANUAL_ANALYZE: 'manualAnalyze',
  GET_CURRENT_CHANNEL: 'getCurrentChannel'
};

// Notification types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
};

// Notification colors
export const NOTIFICATION_COLORS = {
  [NOTIFICATION_TYPES.INFO]: '#3498db',
  [NOTIFICATION_TYPES.SUCCESS]: '#27ae60',
  [NOTIFICATION_TYPES.WARNING]: '#f39c12',
  [NOTIFICATION_TYPES.ERROR]: '#e74c3c'
};

// CSS class names
export const CSS_CLASSES = {
  SEGMENT_MARKER: 'yss-segment-marker',
  SEGMENT_TOOLTIP: 'yss-segment-tooltip',
  SKIP_PREVIEW: 'yss-skip-preview',
  NOTIFICATION: 'yss-notification'
};

// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  ADVANCED_SETTINGS: 'advancedSettings',
  STATS: 'stats',
  DARK_MODE: 'darkMode'
};

// YouTube-specific constants
export const YOUTUBE = {
  URL_PATTERN: /youtube\.com\/watch/,
  VIDEO_ID_PARAM: 'v',
  TRANSCRIPT_BUTTON_TEXT: ['trascrizione', 'transcript'],
  MESSAGE_TYPE: 'YSS_TRANSCRIPT'
};

// Error messages
export const ERROR_MESSAGES = {
  API_KEY_NOT_CONFIGURED: 'API Key not configured. Insert your Claude/OpenAI API key in background.js line 5',
  NO_TRANSCRIPT: '⚠️ Transcript not available for this video. The extension only works with videos that have subtitles.',
  ANALYSIS_ERROR: '❌ Error during analysis',
  API_ERROR: '❌ AI analysis error: {error}. Configure API key in background.js',
  TIMEDTEXT_WARNING: '⚠️ YouTube\'s timedtext API is not accessible from extensions (returns content-length: 0)',
  CHANNEL_NOT_FOUND: '⚠️ Channel element not found',
  CONTENT_SCRIPT_UNAVAILABLE: '⚠️ Content script not available: {error}'
};

// Success messages
export const SUCCESS_MESSAGES = {
  SEGMENTS_LOADED: '✅ {count} segments loaded from cache',
  SEGMENTS_FOUND: '✅ Found {count} segments to skip (AI analysis)!',
  NO_SEGMENTS: 'ℹ️ No content to skip detected by AI',
  SKIPPED: '⏩ Skipped: {category} ({duration}s saved)',
  CACHE_CLEARED: 'Video cache cleared! Reload the page to reanalyze'
};

// Info messages
export const INFO_MESSAGES = {
  ANALYZING: '🔍 Analyzing video with AI...',
  TRANSCRIPT_LOADING: '✓ Transcript loaded: {count} segments. Analyzing with AI...',
  CHANNEL_WHITELISTED: 'ℹ️ Channel excluded by advanced settings',
  NOT_YOUTUBE: 'ℹ️ Not on a YouTube page - message not sent'
};
