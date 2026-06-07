SkipTube AI helps you get to the useful part of YouTube videos faster.

The extension reads available video transcripts, analyzes them with your chosen provider, then marks sponsorships, intros, outros, donation reads, and self-promotional segments on the player timeline. You can let it skip those segments automatically or use the markers manually.

You choose Anthropic Claude or OpenAI and use your own API key. Settings, statistics, and cached analyses are stored locally on your device.

MAIN FEATURES

Automatic segment detection
- Finds sponsor breaks, intros, outros, donation acknowledgments, and creator self-promotion
- Uses transcript analysis instead of community votes
- Supports Claude and OpenAI model options

Playback controls
- Auto-skip detected segments during playback
- Show optional previews before a jump
- Adjust skip buffer and confidence threshold
- Enable or disable each category independently

Timeline markers
- Display colored markers on the progress bar
- Click any marker to jump directly
- Review detected categories at a glance

Local cache and statistics
- Cache results locally for 30 days
- Avoid repeated provider calls for videos already analyzed
- Track time saved, skipped segments, and analyzed videos
- Review cached results from the cache viewer

Channel controls
- Exclude specific channels from analysis
- Reanalyze a video manually when needed

Resilient extraction
- Opens and reads available captions or transcripts from the watch page
- Can attempt selector recovery if the page layout changes, using your selected provider and a limited page-structure snapshot

HOW IT WORKS

1. Add your API key
Choose Anthropic Claude or OpenAI in the popup and save your personal key locally.

2. Watch normally
Open a video with captions or an available transcript. SkipTube AI sends the text to your selected provider for segment analysis.

3. Use the timeline
Detected sections appear as colored markers. Let auto-skip handle them or jump manually.

4. Reuse cached results
The same video can use the local cache for up to 30 days, reducing repeat API calls.

PRIVACY

SkipTube AI has no developer-operated backend server. Settings, statistics, API keys, and cached analyses are stored locally in Chrome storage.

Data sent outside your browser:
- Video transcript text is sent only to the provider you select
- If extraction fails, a limited page-structure snapshot may be sent to the same provider for recovery
- Scripts, styles, and images are stripped from the recovery snapshot where possible

The extension developer does not sell user data or add tracking.

Full privacy policy:
https://github.com/ChromuSx/SkipTubeAI/blob/main/PRIVACY.md

REQUIREMENTS

- Google Chrome or another Chromium-based browser
- A personal API key from Anthropic or OpenAI
- Videos with captions or transcripts
- Internet connection for first-time analysis

USEFUL LINKS

GitHub Repository:
https://github.com/ChromuSx/SkipTubeAI

Report Issues:
https://github.com/ChromuSx/SkipTubeAI/issues

Support:
giovanni.guarino1999@gmail.com

Note: SkipTube AI is an independent open source project. It is not affiliated with YouTube, Google, Anthropic, or OpenAI.

Developer: Giovanni Guarino
License: MIT
Version: 1.3.4
