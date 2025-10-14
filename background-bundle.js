// background-bundle.js - Bundled background service worker

// ============================================================================
// SHARED: CONFIG
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
  CACHE: {
    MAX_AGE_DAYS: 30,
    KEY_PREFIX: 'analysis_'
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
// SHARED: CONSTANTS
// ============================================================================
const CATEGORY_TRANSLATIONS = {
  'sponsorships': 'Sponsor',
  'sponsor': 'Sponsor',
  'intro': 'Intro',
  'opening sequence': 'Intro',
  'outro': 'Outro',
  'closing sequence': 'Outro',
  'donations': 'Donations',
  'super chat': 'Donations',
  'acknowledgments': 'Acknowledgments',
  'channel_self_promo': 'Self-Promo',
  'self_promo': 'Self-Promo',
  'self-promotion': 'Self-Promo',
  'merchandise': 'Merchandise',
  'merch': 'Merchandise'
};

const STORAGE_KEYS = {
  SETTINGS: 'settings',
  ADVANCED_SETTINGS: 'advancedSettings',
  STATS: 'stats',
  DARK_MODE: 'darkMode'
};

// ============================================================================
// SHARED: UTILS
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

function generateCacheKey(videoId) {
  return `analysis_${videoId}`;
}

function isCacheExpired(timestamp, maxAgeDays) {
  const now = Date.now();
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
  return now - timestamp > maxAge;
}

// ============================================================================
// AI CLIENT
// ============================================================================
class AIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.endpoint = CONFIG.API.ENDPOINT;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  getApiKey() {
    return this.apiKey;
  }

  isApiKeyValid() {
    return this.apiKey &&
           this.apiKey !== 'YOUR_API_KEY_HERE' &&
           this.apiKey.length >= 20;
  }

  getModelName(modelType) {
    const modelMap = {
      'haiku': CONFIG.API.MODELS.HAIKU,
      'sonnet': CONFIG.API.MODELS.SONNET
    };
    return modelMap[modelType] || CONFIG.API.MODELS.HAIKU;
  }

  buildPrompt(transcript, title, settings, confidenceThreshold = 0.85) {
    const categories = [];
    if (settings.skipSponsors) categories.push('sponsorships of external products/services');
    if (settings.skipIntros) categories.push('intro/opening sequence (music, animations, logos)');
    if (settings.skipOutros) categories.push('outro/closing sequence (music, credits, closing animations)');
    if (settings.skipDonations) categories.push('donation acknowledgments/super chat (reading donor names)');
    if (settings.skipSelfPromo) categories.push('channel self-promotion/merchandise (like/subscribe/notification requests, merch sales)');

    return `You are an expert in YouTube video analysis. Analyze this transcript from the video "${title}" and identify ONLY segments that contain:
${categories.map(c => `- ${c}`).join('\n')}

IMPORTANT RULES:
1. DO NOT confuse the actual video content with sponsors/self-promo
2. SELF-PROMOTION includes ANY request for likes, subscriptions, notification/bell activation, even if brief (even 3-5 seconds)
3. INTRO/OUTRO = musical themes, animations, logos, opening/closing jingles to ALWAYS SKIP
4. Self-promotion also means: merchandise, channel products, requests for financial support
5. Sponsor means: advertising for EXTERNAL products/services (NordVPN, Audible, Raid Shadow Legends, etc.)
6. Donations means: READING of donor names or super chat (not simple thank-yous)
7. If you are not 100% SURE, DO NOT include the segment
8. Minimum required confidence: ${confidenceThreshold}

Transcript with timestamps (format [Xs] where X = seconds from video start):
${transcript}

IMPORTANT: Timestamps in the transcript are in PURE SECONDS (e.g. [74s] = 1 minute and 14 seconds).
Respond with start/end ALSO in pure seconds (e.g. "start": 74 for 1:14).

Respond ONLY in JSON format:
{
  "segments": [
    {
      "start": <start_seconds_integer>,
      "end": <end_seconds_integer>,
      "category": "<sponsorships|channel_self_promo|donations|intro|outro>",
      "confidence": <0.0-1.0>,
      "description": "<detailed_description_50_chars>"
    }
  ]
}

Example: if the sponsor is from [74s] to [143s], respond: {"start": 74, "end": 143}
If you find NO segments to skip, respond: {"segments": []}`;
  }

  formatTranscript(transcript) {
    if (!transcript) return '';
    return transcript
      .map(item => `[${Math.floor(item.start)}s] ${item.text}`)
      .join('\n');
  }

  async sendRequest(prompt, modelType = 'haiku') {
    const selectedModel = this.getModelName(modelType);

    console.log('🔑 API Key present:', this.apiKey ? `${this.apiKey.substring(0, 20)}...` : 'NO');
    console.log('🌐 Endpoint:', this.endpoint);
    console.log('🤖 Selected model:', selectedModel);
    console.log('📤 Sending request to Claude API...');

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': CONFIG.API.VERSION,
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: CONFIG.API.MAX_TOKENS,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      console.log('📥 Response received, status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        throw new Error(`API Error ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      console.log('✅ JSON data received');

      const aiResponse = data.content[0].text;
      console.log('🤖 AI Response:', aiResponse.substring(0, 200) + '...');

      return aiResponse;

    } catch (error) {
      console.error('❌ Error during API call:', error);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  async analyze(transcript, title, settings, advancedSettings) {
    const transcriptText = this.formatTranscript(transcript);
    console.log(`📝 Formatted transcript: ${transcriptText.length} characters`);

    const prompt = this.buildPrompt(
      transcriptText,
      title,
      settings,
      advancedSettings.confidenceThreshold
    );

    console.log('🎯 Confidence threshold:', advancedSettings.confidenceThreshold);

    const response = await this.sendRequest(prompt, advancedSettings.aiModel);
    return response;
  }
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================
class ResponseParser {
  parse(response, confidenceThreshold = 0.85) {
    try {
      console.log('🔍 Parsing complete AI response:', response);

      let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const jsonMatch = cleaned.match(/\{[\s\S]*"segments"[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('❌ JSON not found in response');
        return [];
      }

      let jsonStr = jsonMatch[0];
      if (!jsonStr.endsWith('}')) {
        jsonStr += '\n}';
      }

      console.log('📄 Extracted JSON:', jsonStr);

      const parsed = JSON.parse(jsonStr);

      console.log(`✓ JSON parsed correctly, ${parsed.segments?.length || 0} segments found`);

      if (!parsed.segments || !Array.isArray(parsed.segments)) {
        console.warn('⚠️ No segments array found');
        return [];
      }

      const filtered = parsed.segments
        .filter(seg => seg.confidence >= confidenceThreshold)
        .map(seg => ({
          start: seg.start,
          end: seg.end,
          category: this.translateCategory(seg.category),
          description: seg.description
        }));

      console.log(`✓ ${filtered.length} segments after confidence filter (>=${confidenceThreshold})`);
      return filtered;

    } catch (error) {
      console.error('❌ Error parsing AI response:', error);
      console.error('Original response:', response);
      return [];
    }
  }

  translateCategory(category) {
    const lowerCategory = category.toLowerCase();

    for (const [key, value] of Object.entries(CATEGORY_TRANSLATIONS)) {
      if (lowerCategory.includes(key)) {
        return value;
      }
    }

    return category;
  }

  validateSegment(segment) {
    return segment &&
           typeof segment.start === 'number' &&
           typeof segment.end === 'number' &&
           segment.start >= 0 &&
           segment.end > segment.start &&
           segment.category &&
           typeof segment.category === 'string' &&
           segment.description &&
           typeof segment.description === 'string';
  }

  filterValidSegments(segments) {
    return segments.filter(seg => this.validateSegment(seg));
  }

  safeExtract(response, confidenceThreshold = 0.85) {
    try {
      const segments = this.parse(response, confidenceThreshold);
      return this.filterValidSegments(segments);
    } catch (error) {
      console.error('Error extracting segments:', error);
      return [];
    }
  }
}

// ============================================================================
// CACHE MANAGER
// ============================================================================
class CacheManager {
  constructor() {
    this.memoryCache = new Map();
  }

  generateKey(videoId, settings, confidenceThreshold) {
    return generateCacheKey(videoId);
  }

  getFromMemory(key) {
    return this.memoryCache.get(key) || null;
  }

  setInMemory(key, value) {
    this.memoryCache.set(key, value);
  }

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

  async get(videoId, settings, confidenceThreshold) {
    const cacheKey = this.generateKey(videoId, settings, confidenceThreshold);

    const memoryResult = this.getFromMemory(cacheKey);
    if (memoryResult) {
      console.log('✓ Analysis found in memory cache');
      return memoryResult;
    }

    const storageResult = await this.getFromStorage(videoId);
    if (storageResult) {
      console.log('✓ Analysis found in persistent storage');
      this.setInMemory(cacheKey, storageResult);
      return storageResult;
    }

    return null;
  }

  async save(videoId, segments, settings, confidenceThreshold) {
    const cacheKey = this.generateKey(videoId, settings, confidenceThreshold);
    this.setInMemory(cacheKey, segments);
    await this.saveToStorage(videoId, segments);
  }

  clearMemory() {
    this.memoryCache.clear();
    console.log('✓ Memory cache cleared');
  }

  async cleanOldCache() {
    try {
      const allStorage = await storage.local.get(null);
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

  async remove(videoId) {
    try {
      const cacheKey = generateCacheKey(videoId);
      this.memoryCache.delete(cacheKey);
      await storage.local.remove([cacheKey, `${cacheKey}_timestamp`]);
      console.log(`✓ Removed cache for video: ${videoId}`);
    } catch (error) {
      console.error('Error removing cache:', error);
    }
  }
}

// ============================================================================
// MAIN AI ANALYZER
// ============================================================================
class AIAnalyzer {
  constructor() {
    // IMPORTANT: Replace with your actual API key
    const API_KEY = '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';

    this.aiClient = new AIClient(API_KEY);
    this.responseParser = new ResponseParser();
    this.cacheManager = new CacheManager();

    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'analyzeTranscript') {
        this.handleTranscriptAnalysis(request.data)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({
            success: false,
            error: error.message
          }));
        return true;
      }
    });
  }

  async handleTranscriptAnalysis(data) {
    const { videoId, transcript, title, settings } = data;

    if (!this.aiClient.isApiKeyValid()) {
      console.error('❌ API Key not configured!');
      return {
        success: false,
        error: 'API Key not configured. Insert your Claude/OpenAI API key in background.js line 5'
      };
    }

    const advSettings = await this.getAdvancedSettings();
    console.log('⚙️ Advanced settings:', advSettings);

    const cached = await this.cacheManager.get(videoId, settings, advSettings.confidenceThreshold);
    if (cached) {
      console.log('✓ Analysis found in cache');
      return {
        success: true,
        segments: cached
      };
    }

    try {
      console.log('🤖 Starting AI analysis for video:', title);

      const aiResponse = await this.aiClient.analyze(
        transcript,
        title,
        settings,
        advSettings
      );

      const segments = this.responseParser.parse(
        aiResponse,
        advSettings.confidenceThreshold
      );

      await this.cacheManager.save(videoId, segments, settings, advSettings.confidenceThreshold);

      await this.cacheManager.cleanOldCache();

      console.log(`✅ AI analysis completed: ${segments.length} segments found`);

      return {
        success: true,
        segments: segments
      };

    } catch (error) {
      console.error('❌ AI analysis error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAdvancedSettings() {
    try {
      const data = await storage.local.get(STORAGE_KEYS.ADVANCED_SETTINGS);
      return data[STORAGE_KEYS.ADVANCED_SETTINGS] || CONFIG.DEFAULTS.ADVANCED_SETTINGS;
    } catch (error) {
      console.error('Error loading advanced settings:', error);
      return CONFIG.DEFAULTS.ADVANCED_SETTINGS;
    }
  }
}

// Initialize analyzer
const analyzer = new AIAnalyzer();

// Handle installation/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: CONFIG.DEFAULTS.SETTINGS
    });

    const welcomePageUrl = chrome.runtime.getURL('welcome.html');
    fetch(welcomePageUrl, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          chrome.tabs.create({ url: 'welcome.html' });
        }
      })
      .catch(() => {
        // Welcome page doesn't exist, skip
      });
  }
});
