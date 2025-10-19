# SkipTube AI

<div align="center">

![SkipTube AI Logo](logo.png)

**AI-powered Chrome extension that automatically detects and skips sponsorships, intros, outros, and promotional content in YouTube videos using Claude AI.**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/ChromuSx/SkipTubeAI/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-orange.svg)](https://chrome.google.com/webstore)

[Install from Chrome Web Store](#installation) • [Documentation](#documentation) • [Support](#support)

</div>

---

## 📸 Screenshots

<div align="center">
<img src="Screenshots/1-extension-settings.png" width="45%" alt="Extension Settings">
<img src="Screenshots/3-statistics-dashboard.png" width="45%" alt="Statistics Dashboard">
</div>

<div align="center">
<img src="Screenshots/4-cache-viewer.png" width="90%" alt="Cache Viewer">
</div>

---

## 🚀 Features

- **🤖 AI-Powered Detection**: Uses Claude AI to analyze video transcripts with high accuracy
- **⚡ Automatic Skipping**: Seamlessly skips detected segments without interruption
- **🎨 Visual Timeline Markers**: Color-coded segments on YouTube's progress bar
- **⚙️ Customizable Categories**: Choose what to skip (sponsors, intros, outros, donations, self-promo)
- **💾 Smart Caching**: Stores analysis results locally for 30 days
- **📊 Detailed Statistics**: Track time saved, segments skipped, and analyzed videos
- **🔒 Privacy-First**: All data stored locally, you control your own API key
- **🎯 Channel Whitelist**: Exclude specific channels to support your favorite creators
- **⚡ Advanced Settings**: Configure AI model, confidence threshold, and skip buffer

---

## 📦 Installation

### For Users

1. **Install from Chrome Web Store** (Recommended)
   - Visit the [Chrome Web Store page](#) (coming soon)
   - Click "Add to Chrome"
   - Follow the installation prompts

2. **Get Your API Key**
   - Visit [Anthropic Console](https://console.anthropic.com/settings/keys)
   - Create a free account if you don't have one
   - Generate a new API key

3. **Configure the Extension**
   - Click the SkipTube AI icon in your Chrome toolbar
   - Paste your API key in the "API Configuration" section
   - Click "Save"
   - Choose which categories to skip
   - Done! Start watching YouTube videos

### For Developers

See [Development Setup](#development-setup) below.

---

## 🎬 How It Works

1. **Transcript Extraction**: When you watch a YouTube video with captions, SkipTube AI extracts the transcript from the page
2. **AI Analysis**: The transcript is sent to Claude AI for intelligent analysis
3. **Segment Detection**: Claude identifies sponsorships, intros, outros, donations, and self-promotions
4. **Smart Caching**: Results are cached locally for 30 days to avoid re-analysis
5. **Visual Feedback**: Colored markers appear on the video timeline
6. **Automatic Skipping**: The extension automatically skips identified segments during playback

---

## 💰 Cost

SkipTube AI uses **your personal Claude API key**, so you pay only for what you use:

- **Claude Haiku** (default): ~$0.001-0.002 per video
- **Claude Sonnet** (more accurate): ~$0.005-0.010 per video

Thanks to intelligent caching, each video is analyzed **only once**. For average usage (50 videos/month), the monthly cost is approximately **$0.10-0.50**.

Anthropic provides **free credits** for new accounts to get started!

---

## 🔒 Privacy & Security

- ✅ **Your API key** is stored locally in your browser (encrypted by Chrome)
- ✅ **All settings and cache** are stored locally on your device
- ✅ **No tracking** - we don't collect any personal data
- ✅ **No remote servers** - we don't operate any backend
- ✅ **Open source** - all code is publicly auditable
- ✅ **Transparent** - only video transcripts are sent to Anthropic for analysis

Read our full [Privacy Policy](PRIVACY.md).

---

## 📋 Detected Categories

| Category | Description | Color |
|----------|-------------|-------|
| 🎯 **Sponsorships** | Paid promotions, sponsored content, discount codes | 🔴 Red |
| 🎬 **Intros** | Opening sequences, channel intros | 🔵 Cyan |
| 👋 **Outros** | Closing sequences, end screens | 🟣 Purple |
| 💝 **Donations** | SuperChat readings, patron mentions | 🟢 Green |
| 📢 **Self-Promotion** | Merch plugs, social media callouts | 🟠 Orange |

---

## ❓ FAQ

<details>
<summary><b>Does it work on all YouTube videos?</b></summary>

It works on videos with available captions/transcripts. If a video doesn't have captions, the extension cannot analyze it.
</details>

<details>
<summary><b>Is my API key secure?</b></summary>

Yes! Your API key is stored locally using Chrome's secure storage API. It's never transmitted to us or third parties (except Anthropic for analysis).
</details>

<details>
<summary><b>Can I exclude certain channels?</b></summary>

Absolutely! Go to "Advanced Settings" → "Excluded channels" and add channels you want to support.
</details>

<details>
<summary><b>Does it slow down YouTube?</b></summary>

No! Analysis happens in the background. Already-analyzed videos load instantly (< 100ms) thanks to caching.
</details>

<details>
<summary><b>Can I customize what gets skipped?</b></summary>

Yes! You can individually enable/disable each category and adjust the AI confidence threshold (0.5-1.0).
</details>

---

## 🛠️ Development Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Chrome browser
- Claude API key (from [Anthropic Console](https://console.anthropic.com))

### 1. Clone and Install

```bash
git clone https://github.com/ChromuSx/SkipTubeAI.git
cd SkipTubeAI
npm install
```

### 2. Build the Extension

```bash
# Development build (with source maps)
npm run build

# Watch mode (rebuilds on file changes)
npm run watch

# Production build (minified)
NODE_ENV=production npm run build
```

### 3. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `SkipTubeAI` directory
5. The extension is now loaded!

### 4. Configure API Key

1. Click the extension icon in Chrome toolbar
2. Enter your Claude API key in the popup
3. Click "Save"

**Note**: Unlike the old version, the API key is now configured through the UI, not hardcoded in source files.

---

## 📁 Project Structure

```
SkipTubeAI/
├── src/
│   ├── background/                    # Background service worker
│   │   └── background-main.js         # Main background orchestrator
│   │
│   ├── content/                       # Content script (YouTube page)
│   │   └── content-main.js            # Main content orchestrator
│   │
│   ├── popup/                         # Extension popup
│   │   └── popup-main.js              # Popup logic
│   │
│   ├── cache-viewer/                  # Cache viewer page
│   │   └── cache-viewer-main.js       # Cache viewer logic
│   │
│   └── shared/                        # Shared modules
│       ├── config.js                  # Configuration constants
│       ├── constants.js               # Application constants
│       ├── utils.js                   # Utility functions
│       │
│       ├── errors/                    # Error classes
│       │   ├── base-error.js
│       │   ├── api-error.js
│       │   ├── storage-error.js
│       │   ├── validation-error.js
│       │   ├── transcript-error.js
│       │   └── error-handler.js
│       │
│       ├── logger/                    # Logging system
│       │   ├── log-levels.js
│       │   └── logger.js
│       │
│       ├── models/                    # Data models
│       │   ├── segment.js
│       │   ├── transcript.js
│       │   ├── settings.js
│       │   └── analysis-result.js
│       │
│       ├── validators/                # Validation logic
│       │   ├── segment-validator.js
│       │   ├── settings-validator.js
│       │   ├── api-validator.js
│       │   └── transcript-validator.js
│       │
│       ├── repositories/              # Data access layer
│       │   ├── cache-repository.js
│       │   ├── settings-repository.js
│       │   └── stats-repository.js
│       │
│       └── services/                  # Business logic
│           ├── ai-service.js          # AI analysis
│           ├── storage-service.js     # Chrome storage wrapper
│           ├── analytics-service.js   # Statistics tracking
│           └── transcript-service.js  # Transcript extraction
│
├── dist/                              # Built bundles
│   ├── background-bundle.js
│   ├── content-bundle.js
│   ├── popup-bundle.js
│   └── cache-viewer-bundle.js
│
├── icons/                             # Extension icons
├── Screenshots/                       # Screenshots for Web Store
├── popup.html                         # Popup UI
├── cache-viewer.html                  # Cache viewer UI
├── help.html                          # Help page
├── manifest.json                      # Chrome extension manifest
├── PRIVACY.md                         # Privacy policy
├── CLAUDE.md                          # Claude Code instructions
└── README.md                          # This file
```

---

## 🏗️ Architecture

### Message Flow

```
YouTube Page (content.js)
      ↓
  Extract Transcript
      ↓
  Send to Background ──→ Background Service Worker
                              ↓
                         Check Cache
                              ↓
                      AI Analysis (Claude)
                              ↓
                      Parse & Validate
                              ↓
                         Save Cache
                              ↓
  Content Script ←──── Return Segments
      ↓
  Render Markers
      ↓
  Monitor & Skip
```

### Key Components

#### Background Service Worker
- **AIService**: Handles Claude API communication
- **StorageService**: Manages Chrome storage operations
- **CacheRepository**: Dual-layer caching (memory + persistent)
- **AnalyticsService**: Tracks statistics

#### Content Script
- **TranscriptService**: Extracts transcripts from YouTube DOM
- **VideoMonitor**: Monitors playback and executes skips
- **SegmentManager**: Manages skip segments
- **UIManager**: Renders visual markers and notifications

#### Popup
- **PopupManager**: Manages settings UI
- **SettingsRepository**: Persists user preferences

#### Shared Infrastructure
- **Models**: Type-safe data structures (Segment, Transcript, Settings, AnalysisResult)
- **Validators**: Input validation and sanitization
- **Errors**: Custom error hierarchy
- **Logger**: Structured logging with levels

---

## 🔧 Configuration

### AI Models

```javascript
// src/shared/config.js
API: {
  ENDPOINT: 'https://api.anthropic.com/v1/messages',
  MODELS: {
    HAIKU: 'claude-3-5-haiku-20241022',    // Fast & economical
    SONNET: 'claude-sonnet-4-5-20250929'   // More accurate
  }
}
```

### Cache Settings

```javascript
CACHE: {
  MAX_AGE_DAYS: 30,        // Auto-clean cache older than 30 days
  KEY_PREFIX: 'analysis_'
}
```

### Default User Settings

```javascript
DEFAULTS: {
  skipSponsors: true,
  skipIntros: false,
  skipOutros: false,
  skipDonations: true,
  skipSelfPromo: true,
  autoSkip: true,
  enablePreview: true
}
```

---

## 📦 Build System

The project uses **Rollup** for bundling with the following features:

- ✅ Modular ES6+ source code
- ✅ Tree-shaking for optimized bundles
- ✅ Source maps in development mode
- ✅ Minification in production mode
- ✅ Separate bundles for background, content, popup, and cache-viewer

### Build Commands

```bash
npm run build                  # Build all bundles
npm run build:content          # Build content script only
npm run build:background       # Build background script only
npm run build:popup            # Build popup only
npm run build:cache-viewer     # Build cache viewer only
npm run watch                  # Watch mode for development
```

---

## 🧪 Testing

### Manual Testing

1. Load extension in Chrome (see [Development Setup](#development-setup))
2. Open a YouTube video with captions
3. Open DevTools Console (F12)
4. Verify analysis starts automatically
5. Check timeline for colored markers
6. Test auto-skip functionality

### Debugging

- **Background logs**: `chrome://extensions/` → Click "service worker" link
- **Content logs**: F12 on YouTube page → Console tab
- **Storage**: DevTools → Application → Storage → Extension
- **Clear cache**: Click "Clear all" in extension popup
- **Force reanalysis**: Click "Reanalyze" button

---

## 🐛 Common Issues

### Extension not working

1. Verify the extension is **enabled** in `chrome://extensions/`
2. Check that the **Active toggle** is ON in the popup
3. Ensure you've configured a valid **API key**
4. Verify the video has **captions/transcripts available**

### "API Key not configured" error

1. Click the extension icon
2. Enter your Claude API key in the "API Configuration" section
3. Click "Save"
4. Reload the YouTube page

### Segments not appearing

- Video must have captions/transcripts
- Try manually opening the transcript panel on YouTube
- Check browser console for errors
- Verify at least one skip category is enabled

### Build errors

```bash
rm -rf node_modules dist
npm install
npm run build
```

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| First analysis | 2-5 seconds |
| Cached video | < 100ms |
| Memory usage | 5-10 MB |
| Storage per video | 1-2 KB |

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Build and test: `npm run build`
5. Commit: `git commit -m "Add amazing feature"`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add JSDoc comments for new functions
- Test thoroughly before submitting
- Update documentation if needed

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Claude AI** by Anthropic for providing the AI analysis engine
- **Chrome Extensions API** for the extension framework
- **Rollup** for the build system
- **YouTube** for providing transcript data
- All contributors and users who provide feedback

---

## 📞 Support

- **🐛 Report bugs**: [GitHub Issues](https://github.com/ChromuSx/SkipTubeAI/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/ChromuSx/SkipTubeAI/discussions)
- **📖 Documentation**: See [CLAUDE.md](CLAUDE.md) for detailed implementation notes
- **✉️ Email**: giovanni.guarino1999@gmail.com

---

## 🔗 Links

- [Chrome Web Store](#) (coming soon)
- [Privacy Policy](PRIVACY.md)
- [GitHub Repository](https://github.com/ChromuSx/SkipTubeAI)
- [Anthropic Console](https://console.anthropic.com)

---

<div align="center">

**Made with ❤️ by Giovanni Guarino**

If you find this extension helpful, consider ⭐ starring the repository!

</div>
