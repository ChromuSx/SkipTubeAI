// cache-viewer.js - Script for cache viewer page
let cacheData = [];

// Load dark mode preference on startup
loadDarkMode();

// Load cache on startup
loadCache();

// Event listeners
document.getElementById('refresh-btn').addEventListener('click', loadCache);
document.getElementById('clear-all-btn').addEventListener('click', clearAllCache);
document.getElementById('search-input').addEventListener('input', filterVideos);
document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);

// Dark mode functions
async function loadDarkMode() {
  const data = await chrome.storage.local.get(['darkMode']);
  if (data.darkMode) {
    document.body.classList.add('dark-mode');
    updateDarkModeIcon();
  }
}

async function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  await chrome.storage.local.set({ darkMode: isDark });
  updateDarkModeIcon();
}

function updateDarkModeIcon() {
  const toggle = document.getElementById('dark-mode-toggle');
  const icon = toggle.querySelector('.material-icons');
  icon.textContent = document.body.classList.contains('dark-mode') ? 'light_mode' : 'dark_mode';
}

function loadCache() {
  chrome.storage.local.get(null, (items) => {
    cacheData = [];
    let totalSegments = 0;
    let totalTime = 0;
    let cacheSize = 0;

    console.log('📋 Loading cache...', items);

    Object.keys(items).forEach(key => {
      if (key.startsWith('analysis_')) {
        const videoId = key.replace('analysis_', '');
        const segments = items[key];

        // Validate that it's an array with segments
        if (Array.isArray(segments) && segments.length > 0) {
          totalSegments += segments.length;

          // Calculate total time of segments
          segments.forEach(seg => {
            totalTime += (seg.end - seg.start);
          });

          cacheData.push({
            videoId,
            segments,
            timestamp: Date.now() // Could save real timestamp
          });

          // Estimate cache size
          cacheSize += JSON.stringify(segments).length;
        } else {
          console.warn(`⚠️ Invalid or empty cache key: ${key}`, segments);
        }
      }
    });

    console.log(`✓ Found ${cacheData.length} valid videos in cache`);

    // Sort by timestamp (most recent first)
    cacheData.sort((a, b) => b.timestamp - a.timestamp);

    // Update statistics
    document.getElementById('total-videos').textContent = cacheData.length;
    document.getElementById('total-segments').textContent = totalSegments;
    document.getElementById('cache-size').textContent = formatBytes(cacheSize);
    document.getElementById('total-time').textContent = formatTime(totalTime);

    // Render list
    renderVideoList(cacheData);
  });
}

function renderVideoList(videos) {
  const container = document.getElementById('video-list');

  if (videos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <h2>No videos in cache</h2>
        <p>Analyzed videos will appear here after the first analysis</p>
      </div>
    `;
    return;
  }

  container.innerHTML = videos.map(video => `
    <div class="video-card" data-video-id="${video.videoId}">
      <div class="video-header">
        <div class="video-info">
          <div class="video-id">📹 ${video.videoId}</div>
          <div style="font-size: 14px; opacity: 0.8;">
            ${video.segments.length} segments detected
          </div>
        </div>
        <div class="video-actions">
          <button class="icon-btn" onclick="openVideo('${video.videoId}')" title="Open on YouTube">
            🔗
          </button>
          <button class="icon-btn danger" onclick="deleteVideo('${video.videoId}')" title="Remove from cache">
            🗑️
          </button>
        </div>
      </div>

      <div class="segments">
        ${video.segments.map(seg => {
          const category = getCategoryInfo(seg.category);
          return `
            <span class="segment-badge ${category.class}" title="${seg.description}">
              ${category.icon} ${seg.category}
              <span class="segment-time">${formatSeconds(seg.start)}s-${formatSeconds(seg.end)}s</span>
            </span>
          `;
        }).join('')}
      </div>

      <div class="segment-details">
        Total time to skip: <strong>${formatTime(video.segments.reduce((sum, s) => sum + (s.end - s.start), 0))}</strong>
      </div>
    </div>
  `).join('');
}

function getCategoryInfo(category) {
  const categories = {
    'Sponsor': { icon: '📢', class: 'sponsor' },
    'Self-Promo': { icon: '📣', class: 'autopromo' },
    'Intro': { icon: '🎬', class: 'intro' },
    'Outro': { icon: '👋', class: 'outro' },
    'Donations': { icon: '💰', class: 'donations' },
    'Acknowledgments': { icon: '🙏', class: 'donations' }
  };

  return categories[category] || { icon: '📌', class: 'sponsor' };
}

function filterVideos() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const filtered = cacheData.filter(video =>
    video.videoId.toLowerCase().includes(search)
  );
  renderVideoList(filtered);
}

function openVideo(videoId) {
  chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}` });
}

function deleteVideo(videoId) {
  if (confirm(`Remove video ${videoId} from cache?`)) {
    chrome.storage.local.remove(`analysis_${videoId}`, () => {
      loadCache();
    });
  }
}

function clearAllCache() {
  if (confirm(`⚠️ WARNING\n\nDelete ALL ${cacheData.length} videos from cache?\n\nThis action cannot be undone.`)) {
    const keys = cacheData.map(v => `analysis_${v.videoId}`);
    chrome.storage.local.remove(keys, () => {
      loadCache();
      alert(`✓ ${keys.length} videos removed from cache!`);
    });
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatSeconds(seconds) {
  return Math.floor(seconds);
}
