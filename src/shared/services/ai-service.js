// ai-service.js - AI analysis service

import { APIError, APIKeyError, APITimeoutError } from '../errors/index.js';
import { logger } from '../logger/index.js';
import { APIValidator } from '../validators/index.js';
import { AnalysisResult, Segment } from '../models/index.js';
import { CONFIG } from '../config.js';

/**
 * AIService - Handles AI analysis operations
 */
export class AIService {
  constructor(apiKey, baseUrl = 'https://api.anthropic.com/v1/messages') {
    if (!apiKey || apiKey.length < 20) {
      throw new APIKeyError('Valid API key required');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.logger = logger.child('AIService');
    this.timeout = 60000; // 60 seconds
  }

  /**
   * Analyze transcript with AI
   * @param {Transcript} transcript - Transcript to analyze
   * @param {AdvancedSettings} advancedSettings - Advanced settings
   * @param {Settings} userSettings - User settings (for enabled categories)
   * @returns {Promise<AnalysisResult>}
   */
  async analyzeTranscript(transcript, advancedSettings, userSettings = null) {
    const stopTimer = this.logger.time(`AI analysis for ${transcript.videoId}`);

    try {
      // Get enabled categories from user settings
      const enabledCategories = userSettings
        ? this.getEnabledAICategories(userSettings)
        : null; // null means all categories

      this.logger.info(`Starting AI analysis`, {
        videoId: transcript.videoId,
        model: advancedSettings.aiModel,
        wordCount: transcript.getWordCount(),
        enabledCategories: enabledCategories || 'all'
      });

      // Format transcript for AI
      const formattedText = transcript.formatForAI();

      // Create request payload with enabled categories
      const payload = this.createPayload(formattedText, advancedSettings.aiModel, enabledCategories);

      // Validate payload
      APIValidator.validateRequestPayload(payload);

      // Send request
      const response = await this.sendRequest(payload);

      // Validate response
      APIValidator.validateAIResponse(response);

      // Parse response
      const parsed = this.parseResponse(response);

      // Validate parsed response
      APIValidator.validateParsedResponse(parsed);

      // Filter by confidence threshold
      const filteredSegments = this.filterByConfidence(
        parsed.segments,
        advancedSettings.confidenceThreshold
      );

      // Create segments
      const segments = filteredSegments.map(s => Segment.fromAPI(s));

      // Create result
      const result = new AnalysisResult(transcript.videoId, segments, {
        model: advancedSettings.aiModel,
        transcriptLength: transcript.getCharCount(),
        processingTime: stopTimer()
      });

      this.logger.info(`AI analysis complete`, {
        videoId: transcript.videoId,
        segmentCount: result.getSegmentCount(),
        duration: result.getTotalSkipDuration()
      });

      return result;
    } catch (error) {
      stopTimer();
      this.logger.error(`AI analysis failed`, {
        videoId: transcript.videoId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get enabled AI categories from user settings
   * @param {Settings} userSettings - User settings
   * @returns {Array<Object>} Array of enabled category objects
   */
  getEnabledAICategories(userSettings) {
    const categories = [];

    if (userSettings.skipSponsors) {
      categories.push({
        name: 'sponsorships',
        description: 'Paid promotions, sponsored content'
      });
    }

    if (userSettings.skipIntros) {
      categories.push({
        name: 'intro',
        description: 'Opening sequences, channel intros'
      });
    }

    if (userSettings.skipOutros) {
      categories.push({
        name: 'outro',
        description: 'Closing sequences, end screens'
      });
    }

    if (userSettings.skipDonations) {
      categories.push({
        name: 'donations',
        description: 'Super chat acknowledgments, donation mentions'
      });
    }

    if (userSettings.skipSelfPromo) {
      categories.push({
        name: 'channel_self_promo',
        description: 'Channel promotions, merch plugs, social media callouts'
      });
    }

    return categories;
  }

  /**
   * Create request payload
   * @param {string} text - Formatted transcript text
   * @param {string} model - AI model
   * @param {Array<Object>} enabledCategories - Enabled categories (null = all)
   * @returns {Object}
   */
  createPayload(text, model, enabledCategories = null) {
    const modelMap = {
      'haiku': 'claude-3-5-haiku-20241022',
      'sonnet': 'claude-sonnet-4-5-20250929'
    };

    const systemPrompt = this.getSystemPrompt(enabledCategories);
    const userMessage = this.getUserMessage(text);

    return {
      model: modelMap[model] || modelMap['haiku'],
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    };
  }

  /**
   * Get system prompt
   * @param {Array<Object>} enabledCategories - Enabled categories (null = all)
   * @returns {string}
   */
  getSystemPrompt(enabledCategories = null) {
    // Default categories if none specified
    const defaultCategories = [
      { name: 'sponsorships', description: 'Paid promotions, sponsored content' },
      { name: 'intro', description: 'Opening sequences, channel intros' },
      { name: 'outro', description: 'Closing sequences, end screens' },
      { name: 'donations', description: 'Super chat acknowledgments, donation mentions' },
      { name: 'channel_self_promo', description: 'Channel promotions, merch plugs, social media callouts' }
    ];

    const categoriesToUse = enabledCategories && enabledCategories.length > 0
      ? enabledCategories
      : defaultCategories;

    // Build category list for prompt
    const categoryList = categoriesToUse
      .map(cat => `- ${cat.name}: ${cat.description}`)
      .join('\n');

    // Build allowed categories for validation
    const allowedCategories = categoriesToUse.map(cat => cat.name).join(', ');

    return `Analyze this YouTube video transcript to identify segments viewers might want to skip.

<objective>
Your task is to identify time ranges in the transcript that fall into these specific categories:

${categoryList}
</objective>

<analysis_steps>
Follow these steps to analyze the transcript:

1. Read through the entire transcript carefully to understand the video's flow and content
2. Identify transitions in content (e.g., sudden topic changes, promotional language, channel-specific callouts)
3. Look for linguistic patterns:
   - Sponsorships: "This video is sponsored by...", "Thanks to [brand] for...", product descriptions with affiliate links
   - Intros: Channel greetings, "Welcome back to...", theme music descriptions, episode numbers
   - Outros: "Thanks for watching", "Don't forget to subscribe", end cards, social media mentions at video end
   - Donations: "Thank you to...", super chat readings, patron shout-outs
   - Self-promotion: "Check out my merch", "Join the Discord", "New video coming", course/product announcements
4. Determine precise start and end timestamps for each identified segment
5. Assign confidence level based on:
   - High (0.9-1.0): Clear, unambiguous promotional/non-content language
   - Medium (0.7-0.89): Probable but with some content mixed in
   - Low (0.5-0.69): Uncertain, could be legitimate content
6. Only include segments with confidence >= 0.5
</analysis_steps>

<output_requirements>
Return ONLY a valid JSON object without any markdown formatting or explanation:

{
  "segments": [
    {
      "start": <integer seconds>,
      "end": <integer seconds>,
      "category": "<one of: ${allowedCategories}>",
      "confidence": <number 0.0-1.0>,
      "description": "<brief 5-10 word description of what happens in this segment>"
    }
  ]
}
</output_requirements>

<guidelines>
- Times MUST be integers in seconds
- Categories MUST be exactly one of: ${allowedCategories}
- Confidence must be a decimal between 0.0 and 1.0
- Description should be concise and specific (e.g., "NordVPN sponsorship read" not just "sponsor")
- ONLY identify segments matching the categories above - ignore everything else
- If no segments found, return empty array: {"segments": []}
- Prefer slightly longer segments over splitting into multiple parts (merge adjacent segments of same category)
- Do NOT include legitimate video content even if briefly mentioning brands/products in educational context
</guidelines>

<examples>
Example of a good segment identification:
{
  "start": 45,
  "end": 98,
  "category": "sponsorships",
  "confidence": 0.95,
  "description": "Surfshark VPN sponsorship with discount code"
}

Example of what NOT to flag:
- Brief product mentions in tutorial/review content
- Creator discussing their past videos as part of current topic
- Genuine acknowledgments integrated into content discussion
</examples>`;
  }

  /**
   * Get user message
   * @param {string} text - Formatted transcript
   * @returns {string}
   */
  getUserMessage(text) {
    return `<transcript>
${text}
</transcript>

Analyze the transcript above and return your analysis as a JSON object containing the segments to skip.`;
  }

  /**
   * Send request to AI API
   * @param {Object} payload - Request payload
   * @returns {Promise<Object>}
   */
  async sendRequest(payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      this.logger.debug(`Sending AI request`, { model: payload.model });

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error?.message || `API request failed: ${response.status}`,
          response.status,
          errorData
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new APITimeoutError(this.timeout);
      }

      throw error;
    }
  }

  /**
   * Parse AI response
   * @param {Object} response - AI response
   * @returns {Object}
   */
  parseResponse(response) {
    try {
      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent) {
        throw new Error('No text content in response');
      }

      // Extract JSON from response
      let jsonText = textContent.text.trim();

      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Parse JSON
      const parsed = JSON.parse(jsonText);

      return parsed;
    } catch (error) {
      this.logger.error(`Failed to parse response`, {
        error: error.message,
        response: JSON.stringify(response).substring(0, 200)
      });
      throw new APIError('Failed to parse AI response', 0, { originalError: error.message });
    }
  }

  /**
   * Filter segments by confidence threshold
   * @param {Array} segments - Segments from AI
   * @param {number} threshold - Minimum confidence
   * @returns {Array}
   */
  filterByConfidence(segments, threshold) {
    const filtered = segments.filter(segment => {
      return segment.confidence >= threshold;
    });

    this.logger.debug(`Filtered by confidence`, {
      original: segments.length,
      filtered: filtered.length,
      threshold
    });

    return filtered;
  }

  /**
   * Translate AI category to display name
   * @param {string} category - AI category
   * @returns {string}
   */
  static translateCategory(category) {
    const categoryLower = category.toLowerCase();

    if (categoryLower.includes('sponsor')) return 'Sponsor';
    if (categoryLower.includes('intro') || categoryLower.includes('opening')) return 'Intro';
    if (categoryLower.includes('outro') || categoryLower.includes('closing')) return 'Outro';
    if (categoryLower.includes('donation') || categoryLower.includes('super chat')) return 'Donations';
    if (categoryLower.includes('acknowledgment') || categoryLower.includes('ringraziament')) return 'Acknowledgments';
    if (categoryLower.includes('promo') || categoryLower.includes('merch')) return 'Self-Promo';

    return category;
  }

  /**
   * Test API connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      const payload = {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ]
      };

      await this.sendRequest(payload);
      return true;
    } catch (error) {
      this.logger.error(`Connection test failed`, { error: error.message });
      return false;
    }
  }
}
