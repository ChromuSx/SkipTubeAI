// response-parser.js - Parses AI responses and translates categories
import { CATEGORY_TRANSLATIONS } from '../shared/constants.js';

/**
 * ResponseParser - Parses and validates AI responses
 */
export class ResponseParser {
  /**
   * Parse AI response and extract segments
   * @param {string} response - AI response text
   * @param {number} confidenceThreshold - Minimum confidence threshold
   * @returns {Array} - Array of segments
   */
  parse(response, confidenceThreshold = 0.85) {
    try {
      console.log('🔍 Parsing complete AI response:', response);

      // Remove any markdown backticks
      let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Extract JSON from response using robust regex
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

      // Filter by confidence and translate categories
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

  /**
   * Translate category from AI response to display name
   * @param {string} category - Category from AI
   * @returns {string} - Translated category
   */
  translateCategory(category) {
    const lowerCategory = category.toLowerCase();

    // Check translations map
    for (const [key, value] of Object.entries(CATEGORY_TRANSLATIONS)) {
      if (lowerCategory.includes(key)) {
        return value;
      }
    }

    // Return original if no translation found
    return category;
  }

  /**
   * Validate segment structure
   * @param {Object} segment - Segment to validate
   * @returns {boolean}
   */
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

  /**
   * Filter and validate segments
   * @param {Array} segments - Segments to validate
   * @returns {Array}
   */
  filterValidSegments(segments) {
    return segments.filter(seg => this.validateSegment(seg));
  }

  /**
   * Extract segments with error handling
   * @param {string} response - AI response
   * @param {number} confidenceThreshold - Confidence threshold
   * @returns {Array}
   */
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
