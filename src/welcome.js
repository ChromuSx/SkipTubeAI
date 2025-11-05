// Dark mode toggle - synchronized with extension settings
const darkModeToggle = document.getElementById('dark-mode-toggle');
const body = document.body;
const icon = darkModeToggle.querySelector('.material-icons');

// Load saved preference from chrome storage
chrome.storage.local.get(['darkMode'], (data) => {
  if (data.darkMode) {
    body.classList.add('dark-mode');
    icon.textContent = 'light_mode';
    darkModeToggle.title = 'Enable Light Mode';
  } else {
    icon.textContent = 'dark_mode';
    darkModeToggle.title = 'Enable Dark Mode';
  }
});

// Toggle dark mode
darkModeToggle.addEventListener('click', async () => {
  body.classList.toggle('dark-mode');
  const isNowDark = body.classList.contains('dark-mode');
  icon.textContent = isNowDark ? 'light_mode' : 'dark_mode';
  darkModeToggle.title = isNowDark ? 'Enable Light Mode' : 'Enable Dark Mode';

  // Save to chrome storage to sync with popup
  await chrome.storage.local.set({ darkMode: isNowDark });
});

// Go to YouTube button
document.getElementById('open-youtube').addEventListener('click', () => {
  chrome.tabs.getCurrent((tab) => {
    if (tab) {
      // Update current tab to YouTube
      chrome.tabs.update(tab.id, { url: 'https://www.youtube.com' });
    } else {
      // If we can't get current tab, create a new one
      chrome.tabs.create({ url: 'https://www.youtube.com' });
    }
  });
});

// Open help page button
document.getElementById('open-help').addEventListener('click', () => {
  chrome.tabs.getCurrent((tab) => {
    if (tab) {
      // Update current tab to help page
      chrome.tabs.update(tab.id, { url: 'help.html' });
    } else {
      // If we can't get current tab, create a new one
      chrome.tabs.create({ url: 'help.html' });
    }
  });
});

// Close current tab
document.getElementById('close-tab').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.getCurrent((tab) => {
    if (tab) {
      chrome.tabs.remove(tab.id);
    }
  });
});
