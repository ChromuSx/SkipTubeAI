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
   * @param {AdvancedSettings} settings - Advanced settings
   * @returns {Promise<AnalysisResult>}
   */
  async analyzeTranscript(transcript, settings) {
    const stopTimer = this.logger.time(`AI analysis for ${transcript.videoId}`);

    try {
      this.logger.info(`Starting AI analysis`, {
        videoId: transcript.videoId,
        model: settings.aiModel,
        wordCount: transcript.getWordCount()
      });

      // Format transcript for AI
      const formattedText = transcript.formatForAI();

      // Create request payload
      const payload = this.createPayload(formattedText, settings.aiModel);

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
        settings.confidenceThreshold
      );

      // Create segments
      const segments = filteredSegments.map(s => Segment.fromAPI(s));

      // Create result
      const result = new AnalysisResult(transcript.videoId, segments, {
        model: settings.aiModel,
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
   * Create request payload
   * @param {string} text - Formatted transcript text
   * @param {string} model - AI model
   * @returns {Object}
   */
  createPayload(text, model) {
    const modelMap = {
      'haiku': 'claude-3-5-haiku-20241022',
      'sonnet': 'claude-sonnet-4-5-20250929'
    };

    const systemPrompt = this.getSystemPrompt();
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
   * @returns {string}
   */
  getSystemPrompt() {
    return `You are an AI assistant specialized in analyzing YouTube video transcripts to identify segments that viewers might want to skip.

Your task is to analyze the provided transcript and identify segments that fall into these categories:
- sponsorships: Paid promotions, sponsored content
- intro: Opening sequences, channel intros
- outro: Closing sequences, end screens
- donations: Super chat acknowledgments, donation mentions
- channel_self_promo: Channel promotions, merch plugs, social media callouts

Return ONLY a valid JSON object in this exact format:
{
  "segments": [
    {
      "start": <number>,
      "end": <number>,
      "category": "<category>",
      "confidence": <number between 0 and 1>,
      "description": "<brief description>"
    }
  ]
}

Important:
- Times must be in seconds (integers)
- Categories must be exactly as listed above
- Confidence should reflect how certain you are (0.0 to 1.0)
- Only include segments you're confident about
- Return empty segments array if nothing found`;
  }

  /**
   * Get user message
   * @param {string} text - Formatted transcript
   * @returns {string}
   */
  getUserMessage(text) {
    return `Analyze this YouTube video transcript and identify segments to skip:

${text}

Return the analysis as JSON.`;
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
