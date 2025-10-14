// background.js - Service Worker for AI management and communications
class AIAnalyzer {
  constructor() {
    // API Configuration - replace with your own keys
    this.API_KEY = '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';
    this.API_ENDPOINT = 'https://api.anthropic.com/v1/messages';

    this.analysisCache = new Map();
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
        return true; // Keeps the channel open for async response
      }
    });
  }

  async handleTranscriptAnalysis(data) {
    const { videoId, transcript, title, settings } = data;

    // Verify API key is configured
    if (!this.API_KEY || this.API_KEY === 'YOUR_API_KEY_HERE' || this.API_KEY.length < 20) {
      console.error('❌ API Key not configured!');
      return {
        success: false,
        error: 'API Key not configured. Insert your Claude/OpenAI API key in background.js line 5'
      };
    }

    // Load advanced settings
    const advSettings = await this.getAdvancedSettings();
    console.log('⚙️ Advanced settings:', advSettings);

    // Check cache
    const cacheKey = `${videoId}_${JSON.stringify(settings)}_${advSettings.confidenceThreshold}`;
    if (this.analysisCache.has(cacheKey)) {
      console.log('✓ Analysis found in cache');
      return {
        success: true,
        segments: this.analysisCache.get(cacheKey)
      };
    }

    try {
      console.log('🤖 Starting AI analysis for video:', title);

      // Prepare transcript text
      const transcriptText = this.formatTranscript(transcript);
      console.log(`📝 Formatted transcript: ${transcriptText.length} characters`);

      // Analyze with AI using advanced settings
      const segments = await this.analyzeWithAI(transcriptText, title, settings, advSettings);

      // Cache result
      this.analysisCache.set(cacheKey, segments);

      // Save to persistent storage
      await this.saveToStorage(videoId, segments);

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
    return new Promise((resolve) => {
      chrome.storage.local.get(['advancedSettings'], (data) => {
        const defaults = {
          confidenceThreshold: 0.85,
          aiModel: 'haiku',
          skipBuffer: 0.5,
          channelWhitelist: []
        };
        resolve(data.advancedSettings || defaults);
      });
    });
  }

  formatTranscript(transcript) {
    if (!transcript) return '';

    return transcript
      .map(item => `[${Math.floor(item.start)}s] ${item.text}`)
      .join('\n');
  }

  async analyzeWithAI(transcriptText, title, settings, advSettings) {
    const prompt = this.buildPrompt(transcriptText, title, settings, advSettings.confidenceThreshold);

    // Select AI model based on settings
    const modelMap = {
      'haiku': 'claude-3-5-haiku-20241022',
      'sonnet': 'claude-sonnet-4-5-20250929'
    };
    const selectedModel = modelMap[advSettings.aiModel] || modelMap['haiku'];

    console.log('🔑 API Key present:', this.API_KEY ? `${this.API_KEY.substring(0, 20)}...` : 'NO');
    console.log('🌐 Endpoint:', this.API_ENDPOINT);
    console.log('🤖 Selected model:', selectedModel);
    console.log('🎯 Confidence threshold:', advSettings.confidenceThreshold);
    console.log('📤 Sending request to Claude API...');

    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 1000,
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

      // Parse response with custom confidence threshold
      return this.parseAIResponse(aiResponse, advSettings.confidenceThreshold);
    } catch (error) {
      console.error('❌ Error during API call:', error);
      console.error('Stack trace:', error.stack);
      throw error;
    }
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

  parseAIResponse(response, confidenceThreshold = 0.85) {
    try {
      console.log('🔍 Parsing complete AI response:', response);

      // Remove any markdown backticks
      let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Extract JSON from response using more robust regex
      const jsonMatch = cleaned.match(/\{[\s\S]*"segments"[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('❌ JSON not found in response');
        return [];
      }

      // Find correct JSON closing
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

      // Filter by confidence using custom value
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
    const translations = {
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

    const lowerCategory = category.toLowerCase();
    for (const [key, value] of Object.entries(translations)) {
      if (lowerCategory.includes(key)) {
        return value;
      }
    }

    return category;
  }


  async saveToStorage(videoId, segments) {
    const key = `analysis_${videoId}`;
    const data = {
      [key]: segments,
      [`${key}_timestamp`]: Date.now()
    };

    await chrome.storage.local.set(data);

    // Clean old cache (over 30 days)
    this.cleanOldCache();
  }

  async cleanOldCache() {
    const storage = await chrome.storage.local.get();
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

    const toRemove = [];

    for (const key in storage) {
      if (key.endsWith('_timestamp')) {
        const timestamp = storage[key];
        if (now - timestamp > maxAge) {
          const videoKey = key.replace('_timestamp', '');
          toRemove.push(key, videoKey);
        }
      }
    }

    if (toRemove.length > 0) {
      await chrome.storage.local.remove(toRemove);
    }
  }
}

// Initialize
const analyzer = new AIAnalyzer();

// Handle installation/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First installation
    chrome.storage.local.set({
      settings: {
        skipSponsors: true,
        skipIntros: false,
        skipOutros: false,
        skipDonations: true,
        skipSelfPromo: true,
        skipBuffer: 0.5,
        enablePreview: true,
        autoSkip: true
      }
    });

    // Open welcome page
    chrome.tabs.create({
      url: 'welcome.html'
    });
  }
});