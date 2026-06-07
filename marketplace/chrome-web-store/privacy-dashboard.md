# Chrome Web Store Privacy Dashboard Copy

Use this file as the paste-ready source for the Chrome Web Store privacy and permissions fields.

## Single Purpose

SkipTube AI helps users save time while watching YouTube videos by automatically detecting and skipping sponsorships, intros, outros, donations, and promotional content using AI transcript analysis. The extension analyzes video transcripts with the user's selected Claude or OpenAI provider, caches results locally, and skips identified segments based on user preferences.

## Permission Justifications

### `storage`

Required to store user preferences, skip settings, category filters, AI provider configuration, local usage statistics, and cached AI analysis results. Caching avoids repeated API calls for previously analyzed videos. All extension data is stored locally on the user's device.

### `activeTab`

Required to interact with the active YouTube tab, extract video transcripts from the page, read the current video context, and control playback for automatic skipping.

### Host Permissions

- `https://www.youtube.com/*` and `https://youtube.com/*`: Required to access YouTube video pages, extract transcripts, display timeline markers, and inject skip functionality into the video player.
- `https://api.anthropic.com/*`: Required to send transcripts to Anthropic Claude for AI analysis when the user selects Claude as the provider.
- `https://api.openai.com/*`: Required to send transcripts to OpenAI for AI analysis when the user selects OpenAI as the provider.

## Privacy Policy URL

https://github.com/ChromuSx/SkipTubeAI/blob/main/PRIVACY.md

## Data Handling Summary

- SkipTube AI does not operate backend servers.
- SkipTube AI does not collect, receive, sell, or track user data.
- API keys, settings, statistics, and cache are stored locally in Chrome storage.
- Video transcripts are sent only to the AI provider selected by the user.
- If transcript extraction fails, a limited YouTube page-structure snapshot may be sent to the same selected AI provider so the extension can attempt to recover working transcript selectors.
- Users can clear cached analyses and remove their API key from the extension settings.
