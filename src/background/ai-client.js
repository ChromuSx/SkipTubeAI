// ai-client.js - Handles AI API communication
import { CONFIG } from '../shared/config.js';

/**
 * AIClient - Manages communication with AI API (Claude/OpenAI)
 */
export class AIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.endpoint = CONFIG.API.ENDPOINT;
  }

  /**
   * Set API key
   * @param {string} apiKey - API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Get API key
   * @returns {string}
   */
  getApiKey() {
    return this.apiKey;
  }

  /**
   * Validate API key
   * @returns {boolean}
   */
  isApiKeyValid() {
    return this.apiKey &&
           this.apiKey !== 'YOUR_API_KEY_HERE' &&
           this.apiKey.length >= 20;
  }

  /**
   * Get model name from settings
   * @param {string} modelType - Model type ('haiku' or 'sonnet')
   * @returns {string}
   */
  getModelName(modelType) {
    const modelMap = {
      'haiku': CONFIG.API.MODELS.HAIKU,
      'sonnet': CONFIG.API.MODELS.SONNET
    };
    return modelMap[modelType] || CONFIG.API.MODELS.HAIKU;
  }

  /**
   * Build AI prompt for transcript analysis
   * @param {string} transcript - Formatted transcript
   * @param {string} title - Video title
   * @param {Object} settings - User settings
   * @param {number} confidenceThreshold - Confidence threshold
   * @returns {string}
   */
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

  /**
   * Format transcript for AI
   * @param {Array} transcript - Transcript array
   * @returns {string}
   */
  formatTranscript(transcript) {
    if (!transcript) return '';

    return transcript
      .map(item => `[${Math.floor(item.start)}s] ${item.text}`)
      .join('\n');
  }

  /**
   * Send request to AI API
   * @param {string} prompt - Prompt text
   * @param {string} modelType - Model type
   * @returns {Promise<string>}
   */
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

  /**
   * Analyze transcript with AI
   * @param {Array} transcript - Transcript array
   * @param {string} title - Video title
   * @param {Object} settings - User settings
   * @param {Object} advancedSettings - Advanced settings
   * @returns {Promise<string>}
   */
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
