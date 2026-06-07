# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

SkipTube AI is a Chrome extension (Manifest V3) that uses AI to detect and skip sponsorships, intros, outros, and promotions in YouTube videos. It extracts the transcript of the current video, analyzes it with Codex/OpenAI, caches results locally, and automatically skips identified segments.

The codebase is a **modular ES-module project under `src/`**, bundled with Rollup into `dist/`. The extension is loaded from `dist/` (never from `src/`).

## Project Structure

```
src/
  manifest.json                      # MV3 manifest (copied to dist/ by the popup build)
  content/
    content-main.js                  # YouTubeSkipManager — content script (ISOLATED world)
    transcript-interceptor.js        # MAIN-world network interceptor (no imports)
  background/
    background-main.js               # BackgroundService — service worker
  popup/  cache-viewer/  help/       # UI surfaces (popup.html + *-main.js)
  shared/
    config.js                        # CONFIG: providers, model IDs, endpoints, defaults
    constants.js                     # SELECTORS, INTERCEPTOR contract, CATEGORIES
    services/
      transcript-service.js          # TranscriptService — extraction + AI self-heal
      ai-service.js                  # AIService — analysis + healSelectors()
      storage-service.js  analytics-service.js
      providers/                     # Codex-provider.js, openai-provider.js, base-provider.js
    models/ repositories/ validators/ errors/ logger/
```

### Build

```bash
npm run build          # builds all 4 bundles into dist/
npm run build:content  # rollup -c rollup.config.content.js  -> dist/content-bundle.js
# background / popup / cache-viewer analogous
```

- Each bundle is an IIFE. `rollup.config.popup.js` also **copies** `manifest.json`, the HTML/JS UI files, icons, and `src/content/transcript-interceptor.js` into `dist/`.
- `transcript-interceptor.js` has **no imports** and is copied verbatim (not bundled), because it runs in the page's MAIN world.

## Core Architecture

### Message Passing Flow

```
transcript-interceptor.js  (MAIN world, document_start)
        │  window.postMessage({source:'YSS_INTERCEPTOR', type:'YSS_TRANSCRIPT', payload})
        ▼
content-main.js (ISOLATED world)  <--chrome.runtime.sendMessage-->  background-main.js (Service Worker)
   - DOM manipulation, skip execution                                 - AI API calls (analysis + self-heal)
   - transcript orchestration                                         - cache + analytics
   - video monitoring (video.timeupdate)
```

Two content scripts are declared in the manifest:
1. `transcript-interceptor.js` — `world: "MAIN"`, `run_at: "document_start"`
2. `content-bundle.js` — ISOLATED world, `run_at: "document_idle"`

### Critical Components

**`src/background/background-main.js`** — `BackgroundService`
- Loads provider API keys from `chrome.storage.local` (`claudeApiKey` / `openaiApiKey`; legacy `apiKey` migrated to Codex).
- Message actions: `analyzeTranscript`, `healSelectors`, `updateAPIKey`, `updateProvider`, `getAPIKeyStatus`.
- AI keys are **required** — there is no fallback pattern detection. Without a key, analysis returns an error telling the user to configure it in the popup.

**`src/shared/config.js`** — `CONFIG`
- Codex models: `Codex-haiku-4-5-20251001` (`haiku`, default) and `Codex-sonnet-4-6` (`sonnet`).
- OpenAI models: `gpt-5.5` (best), `gpt-5.4-mini` (fast, default), `gpt-5.4-nano` (cheapest).
- Endpoints, timeouts, cache TTL (30 days), confidence default (0.85), provider default (`Codex`/`haiku`).

**`src/content/content-main.js`** — `YouTubeSkipManager`
- `MutationObserver` detects SPA navigation / new videos.
- On a new video: whitelist check → cache check → `transcriptService.extractFromDOM()` → send `analyzeTranscript` to background → monitor and skip.
- Registers the interceptor bridge and a notifier into `TranscriptService` during `init()`.
- Skip detection via `video.timeupdate`; segments removed after skip to prevent re-skip.

**`src/popup/popup-main.js`** — Settings & UI
- `isLoadingSettings` flag prevents saves during initial load (avoids race conditions).
- Preserves `channelWhitelist` when saving other advanced settings.
- Provider/model selector in `popup.html` (`#ai-model`); options are filtered by `data-provider`.

## Transcript Extraction Strategy (hybrid, resilient to redesigns)

YouTube periodically renames DOM elements and gates its caption endpoints, so extraction is **layered**. `TranscriptService.extractFromDOM()` orchestrates it; opening the transcript panel is what makes the page issue its own authenticated request.

**Empirical facts (verified May 2026):**
- Fetching `captionTracks[].baseUrl` (even `&fmt=json3`, even same-origin) returns an **empty body** — dead.
- A direct InnerTube `POST /youtubei/v1/get_transcript` returns **400 "Precondition check failed"** without full session state — too fragile to rely on.
- The robust approach is to let the **page itself** issue `get_transcript` (by opening the panel) and read the result.

### Layer 1 — MAIN-world interceptor (PRIMARY)
`src/content/transcript-interceptor.js` hooks `fetch` and `XMLHttpRequest` in the page context. When YouTube loads the transcript (using the user's real session), it deep-parses the JSON and relays segments via `window.postMessage`. **No CSS dependency** → survives DOM redesigns. Two endpoints / two cue formats are handled (YouTube serves either depending on the UI):
- Legacy panel → `/youtubei/v1/get_transcript`, cues under `transcriptSegmentRenderer` (`startMs/endMs` + `snippet.runs/simpleText`).
- Modern view-model panel → `/youtubei/v1/get_panel`, cues under `transcriptSegmentViewModel` (`simpleText` + formatted `timestamp` string, no endMs). `get_panel` is generic, but only transcript responses yield segments, so hooking it is safe.
- Contract in `constants.js` → `INTERCEPTOR` (`MESSAGE_SOURCE: 'YSS_INTERCEPTOR'`, `MESSAGE_TYPE: 'YSS_TRANSCRIPT'`).
- `TranscriptService.setupInterceptorBridge()` (a `window.message` listener) stores the latest captured transcript per `videoId`.

### Layer 2 — DOM scraping (FALLBACK)
`extractTranscriptData()` scrapes the rendered panel with **resilient selectors** (class-substring fallbacks). To open the panel, `openTranscriptPanel()` first **expands the description** (`expandDescription()`) because the "Show transcript" button now lives inside the collapsed description; then `findTranscriptButton()` locates it (section renderer, then text/aria-label, EN+IT).
- Panel: `ytd-engagement-panel-section-list-renderer[target-id*="transcript"]` (matches the modern `PAmodern_transcript_view`).
- Two coexisting transcript UIs (YouTube is migrating gradually) — selectors cover both:
  - Legacy Polymer: `ytd-transcript-segment-renderer` (`.segment-timestamp` / `.segment-text`).
  - Modern view-model: `transcript-segment-view-model` (`.ytwTranscriptSegmentViewModelTimestamp` / `.ytAttributedStringHost`).
  - The class sets are disjoint, so the combined selectors are safe (only one matches per segment).

### Layer 3 — AI self-heal (LAST RESORT)
If layers 1+2 both fail, `selfHeal()` snapshots the relevant DOM (`buildDomSnapshot()` — description + engagement panels, scripts/styles/SVGs stripped, capped at 12 000 chars), sends `healSelectors` to the background, and `AIService.healSelectors()` asks a **forced stronger model** (`sonnet` / `gpt-5.5`) for the working selectors.
- Returned selectors are syntactically validated and **merged on top of the defaults as comma-combined fallbacks** (`"<healed>, <default>"`) — a stale healed selector can never be worse than the built-in.
- Accepted selectors are cached in `chrome.storage.local` under `healedSelectors` and reloaded each session (`loadHealedSelectors()`), so the AI cost is paid once until they break again.
- User-facing notifications fire via an injected notifier: info on start, success when applied.

> Selector state lives on the `TranscriptService` instance: `_defaultSelectors` (immutable base) and `selectors` (active, possibly healed). All runtime lookups use `this.selectors.*`, never the constants directly.

## AI Analysis & Caching

- **Cache key**: `analysis_${videoId}` (`CONFIG.CACHE.KEY_PREFIX`). Cleaned after 30 days by `BackgroundService.schedulePeriodicMaintenance()`.
- **Flow** (`background-main.js` → `handleTranscriptAnalysis`): cache check → `Transcript.fromDOM()` → `AIService.analyzeTranscript()` → merge overlapping → cache → return segments.
- **Prompt** (`AIService.getSystemPrompt()`): English; transcript formatted with `[Xs]` timestamps; returns `{segments:[{start,end,category,confidence,description}]}`. Confidence threshold filtering (default 0.85).
- **Categories** (AI side): `sponsorships`, `channel_self_promo`, `donations`, `intro`, `outro` → mapped to display names by `AIService.translateCategory()` (`Sponsor`, `Self-Promo`, `Donations`/`Acknowledgments`, `Intro`, `Outro`).

## Skip Execution & Visual Markers (`content-main.js`)

- `handleTimeUpdate()` skips when `currentTime` enters a segment (with `skipBuffer`), shows a preview if `enablePreview`, performs a 0.3s opacity fade, then removes the segment.
- Markers are absolutely-positioned divs on `.ytp-progress-bar`, color-coded by category (Sponsor=red, Self-Promo/Merch=orange, Intro=cyan, Outro=purple, Donations/Acknowledgments=green). Color keys in `constants.js` keep some legacy Italian names for backward compatibility with old cached segments. Clickable to skip; hover tooltip in English.

## Development

### Testing / debugging
```
chrome://extensions/  → Developer Mode → Load unpacked → select the dist/ folder
Service worker logs: chrome://extensions/ → "service worker"
Content script logs: F12 on a YouTube watch page (use a video WITH subtitles)
```

Inspect the transcript layers in the console:
- Layer 1 hit: `Transcript via interceptor (N segments)` / `Interceptor captured transcript`
- Layer 2 hit: `Transcript via DOM (N segments)`
- Layer 3: `attempting AI self-heal` → `Self-heal applied new selectors`

### Storage inspection
```javascript
chrome.storage.local.get(null, console.log)          // everything
chrome.storage.local.get('analysis_VIDEO_ID')        // a cached analysis
chrome.storage.local.get('healedSelectors')          // AI-healed selectors
chrome.storage.local.remove('healedSelectors')       // reset self-heal
chrome.storage.local.clear()                          // wipe
```

### Logging
Structured logger (`src/shared/logger`) with child scopes (e.g. `TranscriptService`, `AIService`). All messages in English.

## Critical Implementation Details

**Channel Whitelist** — extracted from `ytd-channel-name a`; compares handle (`@name`) and ID (`UCxxxx`); checked before analysis. Notification: "ℹ️ Channel excluded by advanced settings".

**Settings synchronization** — popup saves to `chrome.storage.local` and messages the content/background scripts (`updateSettings`, `updateAdvancedSettings`, `updateProvider`); validated/sanitized via `validators/settings-validator.js` (this is also where the valid model lists live — keep them in sync with `config.js`).

**Updating model IDs** — model strings appear in several places that must stay consistent: `config.js`, `providers/Codex-provider.js`, `providers/openai-provider.js`, `validators/settings-validator.js`, `models/settings.js` (display names), and `popup.html` (selector options).

**Segment merging** — overlapping segments merged (sorted by start, combined labels) before monitoring to prevent multiple skips.

## Common Issues

- **"API Key not configured"** — set a valid key (≥20 chars) in the popup. No key ⇒ no analysis.
- **"Transcript not available"** — the video genuinely has no transcript, or all three extraction layers failed. The interceptor only fires once the page itself loads `get_transcript`, which requires opening the panel.
- **timedtext / get_transcript blocked in automation** — expected. YouTube gates the data layer against bots/headless; it works in a real logged-in browser. Do not rely on raw `baseUrl` fetches or unauthenticated `get_transcript` POSTs.
- **Self-heal not triggering** — requires a configured AI key and both prior layers to fail; check console for `attempting AI self-heal`.
- **Segments not skipping** — verify `settings.autoSkip === true` and that `setupVideoMonitoring()` ran.
