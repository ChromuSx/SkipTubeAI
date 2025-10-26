// config.js - Centralized configuration
export const CONFIG = {
  // AI Provider Configuration
  AI_PROVIDERS: {
    CLAUDE: {
      NAME: 'claude',
      ENDPOINT: 'https://api.anthropic.com/v1/messages',
      VERSION: '2023-06-01',
      TIMEOUT: 60000,
      MODELS: {
        HAIKU: 'claude-3-5-haiku-20241022',
        SONNET: 'claude-sonnet-4-5-20250929'
      }
    },
    OPENAI: {
      NAME: 'openai',
      ENDPOINT: 'https://api.openai.com/v1/chat/completions',
      TIMEOUT: 60000,
      MODELS: {
        GPT_4O: 'gpt-4o',
        GPT_4O_MINI: 'gpt-4o-mini',
        GPT_4_TURBO: 'gpt-4-turbo'
      }
    }
  },

  // Legacy API Configuration (for backwards compatibility)
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
      skipIntros: true,
      skipOutros: true,
      skipDonations: true,
      skipSelfPromo: true,
      skipBuffer: 0.5,
      enablePreview: true,
      autoSkip: true
    },
    ADVANCED_SETTINGS: {
      confidenceThreshold: 0.85,
      aiProvider: 'claude', // 'claude' or 'openai'
      aiModel: 'haiku',
      skipBuffer: 0.5,
      channelWhitelist: []
    }
  }
};
