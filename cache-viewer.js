// cache-viewer.js - Script per la pagina di visualizzazione cache
let cacheData = [];

// Carica cache all'avvio
loadCache();

// Event listeners
document.getElementById('refresh-btn').addEventListener('click', loadCache);
document.getElementById('clear-all-btn').addEventListener('click', clearAllCache);
document.getElementById('search-input').addEventListener('input', filterVideos);

function loadCache() {
  chrome.storage.local.get(null, (items) => {
    cacheData = [];
    let totalSegments = 0;
    let totalTime = 0;
    let cacheSize = 0;

    console.log('📋 Caricamento cache...', items);

    Object.keys(items).forEach(key => {
      if (key.startsWith('analysis_')) {
        const videoId = key.replace('analysis_', '');
        const segments = items[key];

        // Valida che sia un array con segmenti
        if (Array.isArray(segments) && segments.length > 0) {
          totalSegments += segments.length;

          // Calcola tempo totale dei segmenti
          segments.forEach(seg => {
            totalTime += (seg.end - seg.start);
          });

          cacheData.push({
            videoId,
            segments,
            timestamp: Date.now() // Potremmo salvare il timestamp reale
          });

          // Stima dimensione cache
          cacheSize += JSON.stringify(segments).length;
        } else {
          console.warn(`⚠️ Chiave cache invalida o vuota: ${key}`, segments);
        }
      }
    });

    console.log(`✓ Trovati ${cacheData.length} video validi in cache`);

    // Ordina per timestamp (più recenti prima)
    cacheData.sort((a, b) => b.timestamp - a.timestamp);

    // Aggiorna statistiche
    document.getElementById('total-videos').textContent = cacheData.length;
    document.getElementById('total-segments').textContent = totalSegments;
    document.getElementById('cache-size').textContent = formatBytes(cacheSize);
    document.getElementById('total-time').textContent = formatTime(totalTime);

    // Renderizza lista
    renderVideoList(cacheData);
  });
}

function renderVideoList(videos) {
  const container = document.getElementById('video-list');

  if (videos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <h2>Nessun video in cache</h2>
        <p>I video analizzati appariranno qui dopo la prima analisi</p>
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
            ${video.segments.length} segmenti rilevati
          </div>
        </div>
        <div class="video-actions">
          <button class="icon-btn" onclick="openVideo('${video.videoId}')" title="Apri su YouTube">
            🔗
          </button>
          <button class="icon-btn danger" onclick="deleteVideo('${video.videoId}')" title="Rimuovi dalla cache">
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
        Tempo totale da saltare: <strong>${formatTime(video.segments.reduce((sum, s) => sum + (s.end - s.start), 0))}</strong>
      </div>
    </div>
  `).join('');
}

function getCategoryInfo(category) {
  const categories = {
    'Sponsor': { icon: '📢', class: 'sponsor' },
    'Autopromo': { icon: '📣', class: 'autopromo' },
    'Intro': { icon: '🎬', class: 'intro' },
    'Outro': { icon: '👋', class: 'outro' },
    'Donazioni': { icon: '💰', class: 'donations' },
    'Ringraziamenti': { icon: '🙏', class: 'donations' }
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
  if (confirm(`Rimuovere il video ${videoId} dalla cache?`)) {
    chrome.storage.local.remove(`analysis_${videoId}`, () => {
      loadCache();
    });
  }
}

function clearAllCache() {
  if (confirm(`⚠️ ATTENZIONE\n\nCancellare TUTTI i ${cacheData.length} video dalla cache?\n\nQuesta azione non può essere annullata.`)) {
    const keys = cacheData.map(v => `analysis_${v.videoId}`);
    chrome.storage.local.remove(keys, () => {
      loadCache();
      alert(`✓ ${keys.length} video rimossi dalla cache!`);
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
