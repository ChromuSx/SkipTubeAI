# Privacy Policy for SkipTube AI

## Introduction

SkipTube AI ("the Extension") is a Chrome browser extension that uses artificial intelligence to analyze YouTube video transcripts and automatically skip sponsorships, intros, outros, and other content segments. This Privacy Policy explains how we collect, use, and protect your information.

## Information We Collect

### 1. YouTube Video Transcripts
The Extension extracts publicly available transcripts/subtitles from YouTube videos you watch. These transcripts contain:
- Video dialogue text
- Timestamp information
- No personal information about you

### 2. API Key
You provide your own API key (Claude AI from Anthropic or OpenAI), which is:
- Stored locally in your browser using Chrome's storage API
- Never transmitted to us or any third party (except your chosen AI provider's API)
- Used only to authenticate requests to your selected AI provider

### 3. Extension Settings
Your preferences are stored locally, including:
- Skip preferences (which content types to skip)
- Channel whitelist
- Advanced settings (confidence threshold, skip buffer, etc.)

### 4. Analysis Cache
Results from AI analysis are stored locally to improve performance:
- Video ID and detected segments
- Cached for 30 days, then automatically deleted
- Never shared with anyone

### 5. Usage Statistics
Basic statistics tracked locally only:
- Number of segments skipped
- Total time saved
- This data never leaves your device

## How We Use Your Information

### Video Transcript Analysis
- Transcripts are sent to your chosen AI provider (Anthropic's Claude AI or OpenAI) for analysis
- The AI identifies sponsorships, intros, outros, and promotional content
- Results are cached locally to avoid repeat analysis

### Extension Functionality
- Settings are used to control skip behavior
- Cache is used to improve performance and reduce API calls
- Statistics provide you with usage insights

## Third-Party Services

### AI Providers

#### Anthropic (Claude AI)
- **What we share:** Video transcripts and your API key
- **Purpose:** AI-powered content analysis
- **Their privacy policy:** https://www.anthropic.com/legal/privacy
- **Your control:** You provide and control your own API key

#### OpenAI
- **What we share:** Video transcripts and your API key
- **Purpose:** AI-powered content analysis (alternative provider)
- **Their privacy policy:** https://openai.com/privacy
- **Your control:** You provide and control your own API key

### YouTube
- **What we access:** Publicly available video transcripts
- **How:** Direct extraction from YouTube's webpage DOM
- **No data sent to YouTube:** We only read, never write or transmit data to YouTube

## Data Storage and Security

### Local Storage Only
All data is stored locally on your device using Chrome's secure storage API:
- API key (encrypted by Chrome)
- Extension settings
- Analysis cache
- Usage statistics

### No Remote Servers
We do not operate any servers or databases. We do not:
- Collect your personal information
- Track your browsing history
- Store your data on remote servers
- Share your data with third parties (except your chosen AI provider's API for analysis)

### Data Retention
- **API Key:** Stored until you remove it or uninstall the extension
- **Settings:** Stored until you reset or uninstall
- **Cache:** Automatically deleted after 30 days
- **Statistics:** Stored until you clear or uninstall

## Your Rights and Controls

### You Can:
1. **View Your Data:** All settings available in the extension popup
2. **Delete Your Data:**
   - Clear cache using "Clear Cache" button
   - Remove API key from settings
   - Uninstall the extension to remove all local data
3. **Control What's Skipped:** Configure categories in settings
4. **Whitelist Channels:** Exclude specific channels from analysis
5. **Disable the Extension:** Toggle on/off at any time

### We Cannot:
- Access your data (it's stored locally on your device)
- Track your usage across devices
- Identify you personally
- Share your data with anyone

## Children's Privacy

The Extension does not knowingly collect information from children under 13. The Extension is designed for general YouTube users and does not target children specifically.

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be reflected by updating the "Last Updated" date at the top of this policy. Continued use of the Extension after changes constitutes acceptance of the updated policy.

## Data Sharing and Disclosure

We do not sell, trade, or otherwise transfer your information to third parties, except:

### AI Providers (Required for Functionality)
- Video transcripts are sent to your chosen AI provider (Anthropic Claude AI or OpenAI) for analysis
- Communication is encrypted (HTTPS)
- Subject to the respective provider's privacy policy
- You control this by providing your own API key and selecting your preferred provider

### Legal Requirements
We may disclose information if required by law, but since we don't collect or store user data on servers, there is typically nothing to disclose.

## Permissions Explained

The Extension requests the following Chrome permissions:

### `storage`
- **Purpose:** Save your settings and cache locally
- **Scope:** Local device only

### `activeTab`
- **Purpose:** Access the current YouTube tab to extract transcripts
- **Scope:** Only when you're on YouTube

### Host Permissions
- `https://www.youtube.com/*` and `https://youtube.com/*`
  - **Purpose:** Extract transcripts from YouTube pages
- `https://api.anthropic.com/*`
  - **Purpose:** Send transcripts to Claude AI for analysis
- `https://api.openai.com/*`
  - **Purpose:** Send transcripts to OpenAI for analysis (alternative provider)

## International Users

The Extension can be used globally. However:
- AI providers (Anthropic and OpenAI) may have geographic restrictions
- Data sent to AI providers is subject to their respective data handling practices
- Your API key and settings remain local to your device regardless of location

## Contact Information

For questions, concerns, or requests regarding this Privacy Policy:

- **GitHub Issues:** https://github.com/ChromuSx/SkipTubeAI/issues
- **Email:** giovanni.guarino1999@gmail.com

## Open Source

SkipTube AI is open source. You can review the complete source code to verify our privacy practices:
- **Repository:** https://github.com/ChromuSx/SkipTubeAI
- **License:** MIT License

## Consent

By installing and using SkipTube AI, you consent to this Privacy Policy.

## Summary (TL;DR)

- ✅ All your data stored locally on your device
- ✅ Only video transcripts sent to your chosen AI provider (Anthropic or OpenAI) for analysis (using your API key)
- ✅ No tracking, no analytics, no third-party data sharing
- ✅ You control your API key and can delete all data anytime
- ✅ Open source - verify our claims by reviewing the code
- ❌ We don't collect personal information
- ❌ We don't operate servers or databases
- ❌ We don't sell or share your data

---

**Your privacy matters to us. If you have any concerns or questions, please don't hesitate to reach out.**
