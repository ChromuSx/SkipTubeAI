# SkipTube AI

AI-powered Chrome extension that automatically detects and skips sponsorships, intros, outros, and other content in YouTube videos using Claude AI.

## 🚀 Features

- **AI-Powered Detection**: Uses Claude AI to analyze video transcripts
- **Automatic Skipping**: Seamlessly skips detected segments
- **Visual Timeline Markers**: See skip segments on the video progress bar
- **Customizable Categories**: Choose what to skip (sponsors, intros, outros, donations, self-promo)
- **Smart Caching**: Stores analysis results for faster subsequent views
- **Channel Whitelist**: Exclude specific channels from analysis
- **Advanced Settings**: Configure AI model, confidence threshold, and skip buffer

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Chrome browser
- Claude API key (from https://www.anthropic.com)

## 🛠️ Development Setup

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd SkipTubeAI
npm install
```

### 2. Configure API Key

Edit `src/background/main.js` and replace the API key on line 8:

```javascript
const API_KEY = 'your-claude-api-key-here';
```

### 3. Build the Extension

```bash
# Development build (with source maps)
npm run build

# Watch mode (rebuilds on file changes)
npm run watch

# Production build (minified)
NODE_ENV=production npm run build
```

### 4. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `SkipTubeAI` directory
5. The extension is now loaded and ready to use!

## 📁 Project Structure

```
SkipTubeAI/
├── src/
│   ├── background/              # Background service worker
│   │   ├── ai-client.js        # AI API communication
│   │   ├── response-parser.js  # Response parsing & validation
│   │   ├── cache-manager.js    # Dual-layer caching
│   │   └── main.js             # Main orchestrator
│   │
│   ├── content/                 # Content script (runs on YouTube)
│   │   ├── transcript-extractor.js  # Transcript extraction
│   │   ├── ui-manager.js           # UI rendering
│   │   ├── segment-manager.js      # Segment operations
│   │   ├── video-monitor.js        # Video monitoring & skipping
│   │   └── main.js                 # Main orchestrator
│   │
│   └── shared/                  # Shared utilities
│       ├── config.js           # Configuration
│       ├── constants.js        # Constants & messages
│       └── utils.js            # Utility functions
│
├── background-bundle.js         # Built background script
├── content-bundle.js            # Built content script
├── popup.html                   # Extension popup UI
├── popup.js                     # Popup logic
├── popup-utils.js              # Popup utilities
├── manifest.json               # Chrome extension manifest
├── package.json                # Node dependencies
├── tsconfig.json               # TypeScript configuration
├── rollup.config.background.js # Rollup config for background
├── rollup.config.content.js    # Rollup config for content
└── README.md                   # This file
```

## 🏗️ Architecture

### Message Flow

```
YouTube Page (content.js)
      ↓
  Extract Transcript
      ↓
  Send to Background ──→ Background Service Worker
                              ↓
                         AI Analysis (Claude)
                              ↓
                         Parse & Cache
                              ↓
  Content Script ←──── Return Segments
      ↓
  Monitor Video & Skip
```

### Key Components

#### Background Service Worker
- **AIClient**: Handles API communication with Claude
- **ResponseParser**: Parses and validates AI responses
- **CacheManager**: Manages dual-layer caching (memory + storage)

#### Content Script
- **TranscriptExtractor**: Extracts transcripts from YouTube DOM
- **VideoMonitor**: Monitors video playback and executes skips
- **SegmentManager**: Manages segment data and statistics
- **UIManager**: Renders visual markers and notifications

#### Shared Modules
- **config.js**: Centralized configuration
- **constants.js**: Application constants
- **utils.js**: Common utility functions

## 🔧 Configuration

### API Settings (src/shared/config.js)

```javascript
API: {
  ENDPOINT: 'https://api.anthropic.com/v1/messages',
  MODELS: {
    HAIKU: 'claude-3-5-haiku-20241022',    // Fast & cheap
    SONNET: 'claude-sonnet-4-5-20250929'   // Accurate & expensive
  }
}
```

### Cache Settings

```javascript
CACHE: {
  MAX_AGE_DAYS: 30,  // Auto-clean cache older than 30 days
  KEY_PREFIX: 'analysis_'
}
```

### Default Settings

```javascript
DEFAULTS: {
  SETTINGS: {
    skipSponsors: true,
    skipIntros: false,
    skipOutros: false,
    skipDonations: true,
    skipSelfPromo: true,
    skipBuffer: 0.5,
    enablePreview: true,
    autoSkip: true
  }
}
```

## 📦 Build System

The project uses **Rollup** for bundling:

- **Modular source code** in `src/` directory
- **Bundled output** for Chrome extension compatibility
- **Development mode** with source maps
- **Production mode** with minification

### Build Commands

```bash
npm run build          # Build both content and background
npm run build:content  # Build content script only
npm run build:background  # Build background script only
npm run watch          # Watch mode for development
npm run clean          # Clean build artifacts
```

## 🧪 Testing

### Manual Testing

1. Load extension in Chrome
2. Open YouTube video with subtitles
3. Check console logs for analysis status
4. Verify segments appear on timeline
5. Test auto-skip functionality

### Debugging Tips

- **Background logs**: Click "service worker" link in chrome://extensions/
- **Content logs**: Open DevTools (F12) on YouTube page
- **Clear cache**: Use "Clear all" button in extension popup
- **Reanalyze video**: Click "Reanalyze" button in popup

## 🐛 Common Issues

### "API Key not configured"
- Edit `src/background/main.js` line 8
- Ensure API key is valid (starts with `sk-ant-`)
- Rebuild: `npm run build`

### "Transcript not available"
- Video must have subtitles/captions
- Try manually opening transcript panel on YouTube
- Check console for extraction errors

### Segments not skipping
- Verify "Active" toggle is ON
- Check that autoSkip setting is enabled
- Ensure segments were detected (check timeline)

### Build errors
- Delete `node_modules/` and reinstall: `npm install`
- Clear build artifacts: `npm run clean`
- Check Node.js version: `node --version` (should be v16+)

## 📊 Performance

- **AI Analysis**: ~2-5 seconds per video (first time)
- **Cache Hit**: Instant (< 100ms)
- **Memory Usage**: ~5-10 MB
- **Storage**: ~1-2 KB per analyzed video

## 🔒 Privacy

- **API calls**: Only to Claude API (Anthropic)
- **Data stored**: Analysis results cached locally
- **No tracking**: No user data sent to third parties
- **Open source**: All code is auditable

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Build and test: `npm run build`
5. Commit: `git commit -m "Add feature"`
6. Push: `git push origin feature-name`
7. Create Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Claude AI by Anthropic
- Chrome Extensions API
- Rollup bundler
- YouTube for providing transcript data

## 📞 Support

- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions
- **Documentation**: See CLAUDE.md for detailed implementation notes
